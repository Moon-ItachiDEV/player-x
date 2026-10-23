//go:build windows

package main

// Installation proprement dite : l'installeur signé habituel de Player X (NSIS, le même que pour les mises à jour)
// est lancé en silencieux dans le dossier choisi. La progression suit la taille réellement copiée ; chaque étape
// n'est cochée qu'après vérification sur le disque.

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"golang.org/x/sys/windows/registry"
)

const appName = "Player X"

// payloadInfo : décrit l'installeur embarqué (écrit à la construction, scripts/build-installer.mjs).
type payloadInfo struct {
	Version string `json:"version"`
	Size    int64  `json:"size"` // octets une fois installé (dossier win-unpacked)
}

// Options choisies dans la fenêtre.
type Options struct {
	Dir     string `json:"dir"`
	Desktop bool   `json:"desktop"`
	Boot    bool   `json:"boot"`
}

// Progress : envoyé à la page à chaque changement. Step : 0 copie, 1 raccourcis, 2 mises à jour, 3 fini.
type Progress struct {
	Percent int    `json:"percent"`
	Step    int    `json:"step"`
	Error   string `json:"error,omitempty"`
	Note    string `json:"note,omitempty"`
}

// standardDir : le dossier d'installation habituel (par utilisateur), %LOCALAPPDATA%\Programs\Player X.
func standardDir() string {
	return filepath.Join(os.Getenv("LOCALAPPDATA"), "Programs", appName)
}

// defaultDir : l'installation existante si Player X est déjà là, sinon le dossier habituel.
func defaultDir() string {
	if d := existingDir(); d != "" {
		return d
	}
	return standardDir()
}

// existingDir lit le dossier d'une installation précédente (clé de désinstallation écrite par NSIS).
func existingDir() string {
	k, err := registry.OpenKey(registry.CURRENT_USER, `Software\Microsoft\Windows\CurrentVersion\Uninstall`, registry.ENUMERATE_SUB_KEYS)
	if err != nil {
		return ""
	}
	defer k.Close()
	names, _ := k.ReadSubKeyNames(-1)
	for _, n := range names {
		sk, err := registry.OpenKey(k, n, registry.QUERY_VALUE)
		if err != nil {
			continue
		}
		name, _, _ := sk.GetStringValue("DisplayName")
		loc, _, _ := sk.GetStringValue("InstallLocation")
		sk.Close()
		if strings.HasPrefix(name, appName+" ") || name == appName {
			if loc != "" && exists(filepath.Join(loc, appName+".exe")) {
				return loc
			}
		}
	}
	// La clé ne donne pas toujours le dossier : l'emplacement habituel suffit s'il contient Player X.
	if d := standardDir(); exists(filepath.Join(d, appName+".exe")) {
		return d
	}
	return ""
}

// normalizeDir : un dossier choisi qui ne s'appelle pas « Player X » en reçoit un sous-dossier, comme les autres installeurs.
func normalizeDir(dir string) (string, error) {
	dir = strings.TrimSpace(dir)
	if dir == "" || !filepath.IsAbs(dir) {
		return "", errors.New("choisis un dossier sur un disque de ce PC")
	}
	dir = filepath.Clean(dir)
	if strings.ContainsAny(dir, `"<>|?*`) {
		return "", errors.New("ce nom de dossier contient un caractère interdit")
	}
	if !strings.EqualFold(filepath.Base(dir), appName) {
		dir = filepath.Join(dir, appName)
	}
	return dir, nil
}

// existingParent : le dossier lui-même ou son premier parent qui existe (pour mesurer la place libre).
func existingParent(dir string) string {
	for d := dir; ; d = filepath.Dir(d) {
		if st, err := os.Stat(d); err == nil && st.IsDir() {
			return d
		}
		if filepath.Dir(d) == d {
			return d
		}
	}
}

func dirSize(dir string) int64 {
	var n int64
	_ = filepath.WalkDir(dir, func(_ string, d fs.DirEntry, err error) error {
		if err == nil && !d.IsDir() {
			if fi, err := d.Info(); err == nil {
				n += fi.Size()
			}
		}
		return nil
	})
	return n
}

func exists(p string) bool {
	_, err := os.Stat(p)
	return err == nil
}

func copyFile(from, to string) bool {
	if from == "" {
		return false
	}
	b, err := os.ReadFile(from)
	return err == nil && os.WriteFile(to, b, 0o644) == nil
}

// writeSetup dépose l'installeur embarqué dans le dossier temporaire.
func writeSetup(version string) (string, error) {
	p := filepath.Join(os.TempDir(), fmt.Sprintf("Player-X-Setup-%s.exe", version))
	if err := os.WriteFile(p, setupExe, 0o755); err != nil {
		return "", fmt.Errorf("impossible d'écrire dans le dossier temporaire : %w", err)
	}
	return p, nil
}

// runSilent lance l'installeur NSIS sans fenêtre. /D doit être le dernier argument, sans guillemets (règle NSIS).
func runSilent(setup, dir string) *exec.Cmd {
	cmd := exec.Command(setup)
	cmd.SysProcAttr = &syscall.SysProcAttr{CmdLine: fmt.Sprintf(`"%s" /S /D=%s`, setup, dir)}
	return cmd
}

// install déroule l'installation et rend compte par report (appelé hors du fil de la fenêtre).
func install(info payloadInfo, o Options, report func(Progress)) {
	fail := func(step int, msg string) { report(Progress{Step: step, Error: msg}) }
	dir, err := normalizeDir(o.Dir)
	if err != nil {
		fail(0, err.Error())
		return
	}
	if free, err := freeBytes(existingParent(dir)); err == nil && info.Size > 0 && free < uint64(info.Size) {
		fail(0, "Pas assez de place sur ce disque.")
		return
	}
	report(Progress{Percent: 1, Step: 0})
	setup, err := writeSetup(info.Version)
	if err != nil {
		fail(0, err.Error())
		return
	}
	defer os.Remove(setup)

	// 1. Copie des fichiers : la progression suit la taille du dossier, jusqu'à la fin de l'installeur.
	cmd := runSilent(setup, dir)
	if err := cmd.Start(); err != nil {
		fail(0, "Windows a refusé de lancer l'installation : "+err.Error())
		return
	}
	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()
	tick := time.NewTicker(250 * time.Millisecond)
	defer tick.Stop()
	last := 1
wait:
	for {
		select {
		case err := <-done:
			if err != nil {
				fail(0, "L'installation n'a pas abouti ("+err.Error()+"). Ferme Player X s'il est ouvert, puis réessaie.")
				return
			}
			break wait
		case <-tick.C:
			if info.Size <= 0 {
				continue
			}
			// Une réinstallation retire d'abord l'ancienne version : la barre ne recule jamais.
			p := int(float64(dirSize(dir)) / float64(info.Size) * 68)
			if p > 68 {
				p = 68
			}
			if p > last {
				last = p
				report(Progress{Percent: p, Step: 0})
			}
		}
	}
	exe := filepath.Join(dir, appName+".exe")
	if !exists(exe) {
		fail(0, "Player X n'a pas été trouvé dans le dossier après l'installation.")
		return
	}
	report(Progress{Percent: 70, Step: 1})

	// 2. Raccourcis : celui du menu Démarrer est créé par l'installeur ; celui du Bureau est retiré s'il n'est pas voulu.
	note := ""
	desk := filepath.Join(specialFolder(csidlDesktop), appName+".lnk")
	startLnk := ""
	if start := specialFolder(csidlPrograms); start != "" {
		startLnk = filepath.Join(start, appName+".lnk")
	}
	if startLnk == "" || !exists(startLnk) {
		note = "Le raccourci du menu Démarrer n'a pas été trouvé."
	}
	if !o.Desktop {
		_ = os.Remove(desk)
	} else if !exists(desk) {
		// L'installeur silencieux ne crée pas toujours celui du Bureau : copie de celui du menu Démarrer (même cible).
		if !copyFile(startLnk, desk) {
			note = strings.TrimSpace(note + " Le raccourci du Bureau n'a pas pu être créé.")
		}
	}
	time.Sleep(350 * time.Millisecond)
	report(Progress{Percent: 88, Step: 2, Note: note})

	// 3. Mises à jour signées : le fichier qui relie Player X à ses mises à jour doit être en place.
	if !exists(filepath.Join(dir, "resources", "app-update.yml")) {
		fail(2, "Le fichier des mises à jour automatiques manque. Lance l'installeur classique pour réparer.")
		return
	}
	writeFirstRun(o)
	time.Sleep(350 * time.Millisecond)
	report(Progress{Percent: 100, Step: 3, Note: note})
}

// writeFirstRun : les choix que Player X applique à son premier lancement (Démarrer avec Windows).
func writeFirstRun(o Options) {
	dir := filepath.Join(os.Getenv("APPDATA"), appName)
	_ = os.MkdirAll(dir, 0o755)
	b, _ := json.Marshal(map[string]any{"startWithWindows": o.Boot})
	_ = os.WriteFile(filepath.Join(dir, "install-options.json"), b, 0o644)
}

// launch démarre Player X, détaché de l'installeur.
func launch(dir string) error {
	d, err := normalizeDir(dir)
	if err != nil {
		return err
	}
	cmd := exec.Command(filepath.Join(d, appName+".exe"))
	cmd.Dir = d
	return cmd.Start()
}

// classic lance l'installeur habituel, avec ses fenêtres (repli si WebView2 manque, ou après une erreur).
func classic(version string) error {
	setup, err := writeSetup(version)
	if err != nil {
		return err
	}
	return exec.Command(setup).Start()
}
