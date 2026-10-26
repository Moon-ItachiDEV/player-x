//go:build windows

package main

// Essai automatique (GitHub Actions) : une mise à jour simulée de bout en bout, avec la vraie fenêtre.
// Un faux « Player X » (ping.exe) se ferme, de faux fichiers sont décompressés dans %TEMP%\nsSELFTEST.tmp\7z-out puis copiés,
// un faux Player X relancé (copie de ping.exe nommée « Player X.exe ») écrit done.json. La fenêtre doit tout cocher puis
// se fermer seule. Captures : <dir>/fenetre-NN.png. Code 0 si tout s'est passé comme prévu.

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

const selfTo = "0.9.5-beta.4"

func copyTo(from, to string) error {
	in, err := os.Open(from)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(to)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}

func hidden(cmd *exec.Cmd) *exec.Cmd {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	return cmd
}

func selftest(out string, noRelaunch bool) int {
	_ = os.MkdirAll(out, 0o755)
	root := filepath.Join(os.TempDir(), fmt.Sprintf("pxu-selftest-%d", time.Now().UnixNano()))
	inst := filepath.Join(root, "Player X")
	_ = os.MkdirAll(inst, 0o755)
	const files, size = 40, 1 << 20
	chunk := make([]byte, size)
	for i := 0; i < files; i++ {
		_ = os.WriteFile(filepath.Join(inst, fmt.Sprintf("f%02d.bin", i)), chunk, 0o644)
	}
	ping := filepath.Join(os.Getenv("SystemRoot"), "System32", "PING.EXE")
	parent := hidden(exec.Command(ping, "-n", "4", "127.0.0.1"))
	if err := parent.Start(); err != nil {
		fmt.Println("faux Player X :", err)
		return 1
	}
	cfg := Config{
		Pid: uint32(parent.Process.Pid), InstallDir: inst, Exe: "Player X.exe", From: "0.9.5-beta.3", To: selfTo,
		Expected: files * size, Done: filepath.Join(root, "done.json"),
	}
	if noRelaunch {
		cfg.NoRelaunchMs, cfg.ErrorCloseMs = 6000, 4000
	}
	b, _ := json.Marshal(cfg)
	cfgPath := filepath.Join(root, "config.json")
	_ = os.WriteFile(cfgPath, b, 0o644)
	self, _ := os.Executable()
	win := exec.Command(self, "--config", cfgPath, "--shots", out)
	t0 := time.Now()
	if err := win.Start(); err != nil {
		fmt.Println("fenêtre :", err)
		return 1
	}
	exited := make(chan error, 1)
	go func() { exited <- win.Wait() }()
	log := func(f string, a ...any) { fmt.Printf("%5.1f s  %s\n", time.Since(t0).Seconds(), fmt.Sprintf(f, a...)) }

	// NSIS simulé : attend la fermeture, sort l'ancienne version, décompresse, copie, relance.
	_ = parent.Wait()
	log("faux Player X fermé")
	old := filepath.Join(root, "old")
	_ = os.Rename(inst, old)
	ext := filepath.Join(os.TempDir(), "nsSELFTEST.tmp", "7z-out")
	_ = os.RemoveAll(filepath.Dir(ext))
	_ = os.MkdirAll(ext, 0o755)
	for i := 0; i < files; i++ {
		_ = os.WriteFile(filepath.Join(ext, fmt.Sprintf("f%02d.bin", i)), chunk, 0o644)
		time.Sleep(100 * time.Millisecond)
	}
	log("décompression finie")
	_ = os.MkdirAll(inst, 0o755)
	for i := 0; i < files; i++ {
		_ = copyTo(filepath.Join(ext, fmt.Sprintf("f%02d.bin", i)), filepath.Join(inst, fmt.Sprintf("f%02d.bin", i)))
		time.Sleep(25 * time.Millisecond)
	}
	log("copie finie")
	_ = os.RemoveAll(filepath.Dir(ext))
	var app *exec.Cmd
	if !noRelaunch {
		fake := filepath.Join(root, "bin", "Player X.exe")
		_ = os.MkdirAll(filepath.Dir(fake), 0o755)
		if err := copyTo(ping, fake); err != nil {
			log("faux Player X relancé : %v", err)
			return 1
		}
		app = hidden(exec.Command(fake, "-n", "30", "127.0.0.1"))
		if err := app.Start(); err != nil {
			log("faux Player X relancé : %v", err)
			return 1
		}
		log("faux Player X relancé")
		time.Sleep(1500 * time.Millisecond)
		_ = os.WriteFile(cfg.Done, []byte(`{"version":"`+selfTo+`","ok":true}`), 0o644)
		log("done.json écrit")
		time.Sleep(900 * time.Millisecond)
		_ = os.WriteFile(cfg.Done, []byte(`{"version":"`+selfTo+`","ok":true,"shown":true}`), 0o644)
		log("page de Player X dessinée")
	}
	code := 0
	select {
	case err := <-exited:
		log("fenêtre fermée seule (%v)", err)
		if err != nil {
			code = 1
		}
	case <-time.After(25 * time.Second):
		log("ERREUR : la fenêtre ne s'est pas fermée seule")
		_ = win.Process.Kill()
		code = 1
	}
	if app != nil {
		_ = app.Process.Kill()
	}
	shots, _ := filepath.Glob(filepath.Join(out, "fenetre-*.png"))
	log("%d captures", len(shots))
	if len(shots) == 0 {
		log("ERREUR : aucune capture (fenêtre jamais affichée ?)")
		code = 1
	}
	_ = os.RemoveAll(root)
	if strings.TrimSpace(os.Getenv("PXU_KEEP")) == "" {
		_ = os.RemoveAll(filepath.Join(os.TempDir(), "nsSELFTEST.tmp"))
	}
	return code
}
