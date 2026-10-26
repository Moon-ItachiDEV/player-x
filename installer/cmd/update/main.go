//go:build windows

// Fenêtre « Mise à jour de Player X » : pendant l'installation silencieuse d'une mise à jour, Player X est fermé ;
// cette petite fenêtre (WebView2, dessinée comme l'installeur sur mesure) montre où en est l'installation, puis s'efface
// quand la nouvelle version est ouverte. Elle ne fait qu'observer (internal/updwatch) : elle ne touche ni à
// l'installation ni à Player X. Si elle ne démarre pas, l'installation se fait exactement comme avant.
//
// Player X (src/main/services/updateWindow.ts) la copie dans %TEMP%\PlayerXUpdate\<n>\ (hors du dossier d'installation,
// que NSIS vide) et la lance juste avant quitAndInstall :
//
//	player-x-update.exe --config <config.json>                 la vraie mise à jour
//	player-x-update.exe --config <config.json> --shots <dir>   pareil, avec une capture de la fenêtre toutes les 700 ms (essai)
//	player-x-update.exe --selftest <dir>                       mise à jour simulée de bout en bout (GitHub Actions)
//	player-x-update.exe --selftest-norelaunch <dir>            pareil, sans relance : message « Player X ne s'est pas rouvert »
package main

import (
	_ "embed"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image/png"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"time"

	"playerx-installer/internal/updwatch"
	"playerx-installer/internal/webview2"
	"playerx-installer/internal/winx"
)

//go:embed ui/page.html
var page string

//go:embed payload/icon.png
var iconPNG []byte

// Config : écrite par Player X juste avant de se fermer.
type Config struct {
	Pid        uint32 `json:"pid"`        // Player X qui se ferme
	InstallDir string `json:"installDir"` // dossier d'installation (vidé puis rempli par NSIS)
	Exe        string `json:"exe"`        // « Player X.exe »
	From       string `json:"from"`
	To         string `json:"to"`
	Expected   int64  `json:"expected"` // taille du dossier d'installation avant la mise à jour (octets)
	X          int32  `json:"x"`        // centre de la fenêtre de Player X, en pixels d'écran (0, 0 : écran principal)
	Y          int32  `json:"y"`
	Done       string `json:"done"` // done.json, écrit par la nouvelle version au démarrage
	// Essais seulement : délais raccourcis (millisecondes).
	NoRelaunchMs int `json:"noRelaunchMs,omitempty"`
	ErrorCloseMs int `json:"errorCloseMs,omitempty"`
}

func init() {
	// WebView2 veut le fil principal, initialisé en STA.
	runtime.LockOSThread()
}

func main() {
	args := os.Args[1:]
	if len(args) == 2 && (args[0] == "--selftest" || args[0] == "--selftest-norelaunch") {
		os.Exit(selftest(args[1], args[0] == "--selftest-norelaunch"))
	}
	cfgPath, shots := "", ""
	for i := 0; i+1 < len(args); i += 2 {
		switch args[i] {
		case "--config":
			cfgPath = args[i+1]
		case "--shots":
			shots = args[i+1]
		}
	}
	b, err := os.ReadFile(cfgPath)
	var cfg Config
	if err != nil || json.Unmarshal(b, &cfg) != nil || cfg.To == "" {
		return
	}
	os.Exit(run(cfg, filepath.Dir(cfgPath), shots))
}

// ---------- observation ----------

var nsTmp = regexp.MustCompile(`(?i)^ns[^\\/]*\.tmp$`)

// dirSize : somme des fichiers (0 si le dossier n'existe pas, -1 s'il est illisible).
func dirSize(dir string) int64 {
	if _, err := os.Stat(dir); err != nil {
		if os.IsNotExist(err) {
			return 0
		}
		return -1
	}
	var n int64
	_ = filepath.WalkDir(dir, func(_ string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil // fichier déplacé pendant la lecture : on continue
		}
		if !d.IsDir() {
			if fi, err := d.Info(); err == nil {
				n += fi.Size()
			}
		}
		return nil
	})
	return n
}

// findExtract : dossier où NSIS décompresse la nouvelle version (%TEMP%\nsXXXX.tmp\7z-out), créé après since.
func findExtract(since time.Time) string {
	tmp := os.TempDir()
	entries, err := os.ReadDir(tmp)
	if err != nil {
		return ""
	}
	for _, e := range entries {
		if !e.IsDir() || !nsTmp.MatchString(e.Name()) {
			continue
		}
		out := filepath.Join(tmp, e.Name(), "7z-out")
		if fi, err := os.Stat(out); err == nil && fi.IsDir() && fi.ModTime().After(since) {
			return out
		}
	}
	return ""
}

func readDone(path string) *updwatch.Done {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var d updwatch.Done
	if json.Unmarshal(b, &d) != nil {
		return nil
	}
	return &d
}

// ---------- fenêtre ----------

func run(cfg Config, dir, shots string) int {
	start := time.Now()
	parent := winx.OpenProcess(cfg.Pid)
	defer parent.Close()

	lim := updwatch.DefaultLimits
	if cfg.NoRelaunchMs > 0 {
		lim.NoRelaunch = time.Duration(cfg.NoRelaunchMs) * time.Millisecond
	}
	if cfg.ErrorCloseMs > 0 {
		lim.ErrorClose = time.Duration(cfg.ErrorCloseMs) * time.Millisecond
	}
	watch := updwatch.New(cfg.To, cfg.Expected, lim, start)

	data := filepath.Join(dir, "wv2")
	defer os.RemoveAll(data)
	scale := winx.DpiScale()
	w := webview2.NewWithOptions(webview2.WebViewOptions{
		DataPath:  data,
		AutoFocus: true,
		WindowOptions: webview2.WindowOptions{
			Title:      "Mise à jour de Player X",
			Width:      uint(640 * scale),
			Height:     uint(340 * scale),
			IconId:     1,
			Center:     true,
			Frameless:  true,
			Hidden:     true,
			Background: 0x00110A0C, // fond de l'appli (#0c0a11), jamais transparent
		},
	})
	if w == nil {
		// Pas de WebView2 : rien à montrer, l'installation continue sans fenêtre.
		return 0
	}
	defer w.Destroy()
	hwnd := uintptr(w.Window())
	winx.RoundWindow(hwnd)
	w.SetBackground(0x0c, 0x0a, 0x11)
	if cfg.X != 0 || cfg.Y != 0 {
		winx.CenterOn(hwnd, cfg.X, cfg.Y)
	}

	var (
		mu        sync.Mutex
		ready     bool // page dessinée
		shown     bool
		quitting  bool
		lastState string
	)
	showNow := func() {
		if !shown {
			shown = true
			w.Show()
			winx.Foreground(hwnd)
			winx.LetOthersForeground()
		}
	}
	closeNow := func() {
		mu.Lock()
		quitting = true
		mu.Unlock()
		winx.CloseWindow(hwnd)
	}
	_ = w.Bind("pxReady", func() {
		mu.Lock()
		ready = true
		mu.Unlock()
	})
	_ = w.Bind("pxDrag", func() { winx.DragWindow(hwnd) })
	_ = w.Bind("pxMinimize", func() { winx.MinimizeWindow(hwnd) })
	_ = w.Bind("pxClose", func() { w.Dispatch(closeNow) })
	_ = w.Bind("pxOpen", func() error {
		if err := winx.Open(filepath.Join(cfg.InstallDir, cfg.Exe)); err != nil {
			return err
		}
		w.Dispatch(closeNow)
		return nil
	})

	html := strings.ReplaceAll(page, "__PX_ICON__", "data:image/png;base64,"+base64.StdEncoding.EncodeToString(iconPNG))
	w.SetHtml(html)

	// Observation toutes les 250 ms, hors du fil de la fenêtre ; l'affichage passe par Dispatch.
	go func() {
		extract := ""
		var wantShowAt time.Time
		shot := 0
		var lastShot time.Time
		for {
			time.Sleep(250 * time.Millisecond)
			now := time.Now()
			o := updwatch.Obs{ParentAlive: parent.Alive(), Extracted: -1, Installed: -1}
			if gone := watch.ParentGone(); !gone.IsZero() {
				if extract == "" {
					extract = findExtract(start.Add(-5 * time.Second))
				}
				if extract != "" {
					o.Extracted = dirSize(extract)
				}
				o.Installed = dirSize(cfg.InstallDir)
				o.NewApp = winx.StartedSince(cfg.Exe, cfg.Pid, gone.Add(-2*time.Second))
				o.Done = readDone(cfg.Done)
			}
			v := watch.Next(o, now)
			state := map[string]any{"step": v.Step, "percent": v.Percent, "written": v.Written, "total": v.Total, "from": cfg.From, "to": cfg.To}
			if v.Error != "" {
				state["error"] = v.Error
			}
			if v.Out {
				state["out"] = true
			}
			b, _ := json.Marshal(state)
			js := string(b)
			mu.Lock()
			pageReady, q := ready, quitting
			mu.Unlock()
			if q {
				return
			}
			if v.Show && wantShowAt.IsZero() {
				wantShowAt = now
			}
			w.Dispatch(func() {
				if js != lastState {
					lastState = js
					w.Eval("window.pxUpdate && window.pxUpdate(" + js + ")")
				}
				// Montrée quand la page est dessinée (filet : 3 s après la fermeture de Player X).
				if v.Show && (pageReady || now.Sub(wantShowAt) > 3*time.Second) {
					showNow()
				}
			})
			if shots != "" && v.Show && pageReady && now.Sub(lastShot) >= 700*time.Millisecond {
				lastShot = now
				n := shot
				shot++
				w.Dispatch(func() { saveShot(hwnd, filepath.Join(shots, fmt.Sprintf("fenetre-%02d.png", n))) })
			}
			if v.Quit {
				w.Dispatch(closeNow)
				return
			}
		}
	}()
	w.Run()
	return 0
}

func saveShot(hwnd uintptr, name string) {
	img, err := winx.CaptureWindow(hwnd, false)
	if err != nil {
		return
	}
	if f, err := os.Create(name); err == nil {
		_ = png.Encode(f, img)
		f.Close()
	}
}
