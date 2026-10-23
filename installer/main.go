//go:build windows

// Installeur de Player X : une fenêtre sans cadre dessinée comme l'appli (WebView2, déjà présent sous Windows 10
// et 11), qui installe l'installeur signé habituel en silencieux. Sans WebView2, l'installeur classique s'ouvre.
//
//	Player-X-Installer.exe                    installation normale
//	Player-X-Installer.exe --selftest         ouvre la fenêtre, attend la page, puis se ferme (code 0 si tout va bien)
//	Player-X-Installer.exe --selftest-install <dossier>   installe sans fenêtre dans <dossier> (vérification en CI)
package main

import (
	_ "embed"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"playerx-installer/internal/webview2"
)

//go:embed ui/page.html
var page string

//go:embed payload/setup.exe
var setupExe []byte

//go:embed payload/info.json
var infoJSON []byte

//go:embed payload/icon.png
var iconPNG []byte

func init() {
	// WebView2 et les boîtes de dialogue veulent le fil principal, initialisé en STA.
	runtime.LockOSThread()
}

func main() {
	var info payloadInfo
	if err := json.Unmarshal(infoJSON, &info); err != nil || len(setupExe) < 1024 {
		messageBox(0, "Player X", "Cet installeur est incomplet. Télécharge-le à nouveau.", false)
		os.Exit(1)
	}
	args := os.Args[1:]
	if len(args) == 2 && args[0] == "--selftest-install" {
		os.Exit(selftestInstall(info, args[1]))
	}
	selftest := len(args) == 1 && args[0] == "--selftest"

	data := filepath.Join(os.TempDir(), "PlayerXInstaller")
	defer os.RemoveAll(data)
	scale := dpiScale()
	w := webview2.NewWithOptions(webview2.WebViewOptions{
		DataPath:  data,
		AutoFocus: true,
		WindowOptions: webview2.WindowOptions{
			Title:     "Installation de Player X",
			Width:     uint(880 * scale),
			Height:    uint(690 * scale),
			IconId:    1,
			Center:    true,
			Frameless: true,
			Hidden:    true,
		},
	})
	if w == nil {
		// Pas de WebView2 : l'installeur classique, avec ses fenêtres Windows.
		if selftest {
			os.Exit(2)
		}
		if err := classic(info.Version); err != nil {
			messageBox(0, "Player X", "Impossible de lancer l'installation : "+err.Error(), false)
			os.Exit(1)
		}
		return
	}
	defer w.Destroy()
	hwnd := uintptr(w.Window())
	roundWindow(hwnd)
	w.SetBackground(0x0c, 0x0a, 0x11)

	var (
		mu      sync.Mutex
		busy    bool
		dir     = defaultDir()
		shown   bool
		code    = 0
		showNow = func() {
			if !shown {
				shown = true
				w.Show()
				foreground(hwnd)
			}
		}
	)

	_ = w.Bind("pxReady", func() {
		showNow()
		if selftest {
			go func() {
				time.Sleep(1500 * time.Millisecond)
				w.Dispatch(func() { closeWindow(hwnd) })
			}()
		}
	})
	_ = w.Bind("pxInfo", func() map[string]any {
		mu.Lock()
		d := dir
		mu.Unlock()
		free, _ := freeBytes(existingParent(d))
		return map[string]any{"version": info.Version, "dir": d, "need": info.Size, "free": free, "update": existingDir() != ""}
	})
	_ = w.Bind("pxFree", func(d string) uint64 {
		free, _ := freeBytes(existingParent(d))
		return free
	})
	_ = w.Bind("pxPick", func(current string) (string, error) {
		p, err := pickFolder(hwnd, existingParent(current), "Où installer Player X ?")
		if err != nil || p == "" {
			return "", err
		}
		n, err := normalizeDir(p)
		if err != nil {
			return "", err
		}
		mu.Lock()
		dir = n
		mu.Unlock()
		return n, nil
	})
	_ = w.Bind("pxInstall", func(o Options) error {
		mu.Lock()
		defer mu.Unlock()
		if busy {
			return fmt.Errorf("installation déjà en cours")
		}
		busy = true
		dir = o.Dir
		go install(info, o, func(p Progress) {
			if p.Error != "" || p.Step == 3 {
				mu.Lock()
				busy = false
				mu.Unlock()
			}
			b, _ := json.Marshal(p)
			w.Dispatch(func() { w.Eval("window.pxProgress && window.pxProgress(" + string(b) + ")") })
		})
		return nil
	})
	_ = w.Bind("pxLaunch", func(d string) error {
		if err := launch(d); err != nil {
			return err
		}
		w.Dispatch(func() { closeWindow(hwnd) })
		return nil
	})
	_ = w.Bind("pxClassic", func() error {
		if err := classic(info.Version); err != nil {
			return err
		}
		w.Dispatch(func() { closeWindow(hwnd) })
		return nil
	})
	_ = w.Bind("pxDrag", func() { dragWindow(hwnd) })
	_ = w.Bind("pxMinimize", func() { minimizeWindow(hwnd) })
	_ = w.Bind("pxClose", func() {
		mu.Lock()
		b := busy
		mu.Unlock()
		if !b {
			closeWindow(hwnd)
		}
	})

	html := strings.Replace(page, "__PX_ICON__", "data:image/png;base64,"+base64.StdEncoding.EncodeToString(iconPNG), -1)
	w.SetHtml(html)
	// Filet de sécurité : la fenêtre s'affiche même si la page tarde à le demander.
	go func() {
		time.Sleep(3 * time.Second)
		w.Dispatch(showNow)
		if selftest {
			time.Sleep(10 * time.Second)
			w.Dispatch(func() {
				if !shown {
					code = 3
				}
				closeWindow(hwnd)
			})
		}
	}()
	w.Run()
	if selftest && code != 0 {
		os.Exit(code)
	}
}

// selftestInstall : installation sans fenêtre, pour la vérification automatique (GitHub Actions).
func selftestInstall(info payloadInfo, dir string) int {
	ok := true
	install(info, Options{Dir: dir, Desktop: false, Boot: false}, func(p Progress) {
		fmt.Printf("étape %d · %d %%", p.Step, p.Percent)
		if p.Note != "" {
			fmt.Printf(" · %s", p.Note)
		}
		if p.Error != "" {
			fmt.Printf(" · ERREUR : %s", p.Error)
			ok = false
		}
		fmt.Println()
	})
	if !ok {
		return 1
	}
	return 0
}
