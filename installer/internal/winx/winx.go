//go:build windows

// Package winx : appels Windows de la fenêtre « Mise à jour de Player X » (cmd/update) : fenêtre sans cadre, position,
// capture pour l'essai automatique, processus. Mêmes appels que installer/win.go (l'installeur garde les siens, inchangés).
package winx

import (
	"errors"
	"image"
	"strings"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	user32 = windows.NewLazySystemDLL("user32.dll")
	dwmapi = windows.NewLazySystemDLL("dwmapi.dll")
	gdi32  = windows.NewLazySystemDLL("gdi32.dll")

	procReleaseCapture         = user32.NewProc("ReleaseCapture")
	procPostMessageW           = user32.NewProc("PostMessageW")
	procShowWindow             = user32.NewProc("ShowWindow")
	procGetDpiForSystem        = user32.NewProc("GetDpiForSystem")
	procSetForegroundWindow    = user32.NewProc("SetForegroundWindow")
	procAllowSetForeground     = user32.NewProc("AllowSetForegroundWindow")
	procSetWindowPos           = user32.NewProc("SetWindowPos")
	procGetWindowRect          = user32.NewProc("GetWindowRect")
	procMonitorFromPoint       = user32.NewProc("MonitorFromPoint")
	procGetMonitorInfoW        = user32.NewProc("GetMonitorInfoW")
	procDwmSetWindowAttribute  = dwmapi.NewProc("DwmSetWindowAttribute")
	procGetDC                  = user32.NewProc("GetDC")
	procReleaseDC              = user32.NewProc("ReleaseDC")
	procPrintWindow            = user32.NewProc("PrintWindow")
	procGetClientRect          = user32.NewProc("GetClientRect")
	procClientToScreen         = user32.NewProc("ClientToScreen")
	procCreateCompatibleDC     = gdi32.NewProc("CreateCompatibleDC")
	procCreateCompatibleBitmap = gdi32.NewProc("CreateCompatibleBitmap")
	procSelectObject           = gdi32.NewProc("SelectObject")
	procDeleteObject           = gdi32.NewProc("DeleteObject")
	procDeleteDC               = gdi32.NewProc("DeleteDC")
	procGetDIBits              = gdi32.NewProc("GetDIBits")
	procBitBlt                 = gdi32.NewProc("BitBlt")
)

const (
	wmClose       = 0x0010
	wmNcLButtonDn = 0x00A1
	htCaption     = 2
	swMinimize    = 6
	dwmaCorner    = 33 // DWMWA_WINDOW_CORNER_PREFERENCE (Windows 11)
	dwmcpRound    = 2
	dwmaDarkMode  = 20 // DWMWA_USE_IMMERSIVE_DARK_MODE
)

type rect struct{ Left, Top, Right, Bottom int32 }

// DpiScale : facteur d'affichage de l'écran principal (1 à 100 %, 1,5 à 150 %…).
func DpiScale() float64 {
	if procGetDpiForSystem.Find() != nil {
		return 1
	}
	d, _, _ := procGetDpiForSystem.Call()
	if d == 0 {
		return 1
	}
	return float64(d) / 96
}

// RoundWindow : coins arrondis et bord sombre sous Windows 11 (sans effet sous Windows 10).
func RoundWindow(hwnd uintptr) {
	if procDwmSetWindowAttribute.Find() != nil {
		return
	}
	pref := uint32(dwmcpRound)
	_, _, _ = procDwmSetWindowAttribute.Call(hwnd, dwmaCorner, uintptr(unsafe.Pointer(&pref)), 4)
	dark := uint32(1)
	_, _, _ = procDwmSetWindowAttribute.Call(hwnd, dwmaDarkMode, uintptr(unsafe.Pointer(&dark)), 4)
}

// DragWindow : la fenêtre sans cadre se déplace comme par sa barre de titre.
func DragWindow(hwnd uintptr) {
	_, _, _ = procReleaseCapture.Call()
	_, _, _ = procPostMessageW.Call(hwnd, wmNcLButtonDn, htCaption, 0)
}

func MinimizeWindow(hwnd uintptr) { _, _, _ = procShowWindow.Call(hwnd, swMinimize) }
func CloseWindow(hwnd uintptr)    { _, _, _ = procPostMessageW.Call(hwnd, wmClose, 0, 0) }
func Foreground(hwnd uintptr)     { _, _, _ = procSetForegroundWindow.Call(hwnd) }

// LetOthersForeground : la nouvelle version de Player X, lancée par l'installeur, pourra passer devant (sinon Windows
// la laisserait derrière la fenêtre de mise à jour, qui est au premier plan).
func LetOthersForeground() {
	const asfwAny = ^uintptr(0) // ASFW_ANY = (DWORD)-1
	_, _, _ = procAllowSetForeground.Call(asfwAny & 0xFFFFFFFF)
}

// CenterOn : centre la fenêtre sur le point (x, y) en pixels d'écran, sans dépasser la zone utile de cet écran.
func CenterOn(hwnd uintptr, x, y int32) {
	var r rect
	if ok, _, _ := procGetWindowRect.Call(hwnd, uintptr(unsafe.Pointer(&r))); ok == 0 {
		return
	}
	w, h := r.Right-r.Left, r.Bottom-r.Top
	const monitorDefaultToNearest = 2
	mon, _, _ := procMonitorFromPoint.Call(uintptr(uint32(x))|uintptr(uint32(y))<<32, monitorDefaultToNearest)
	type monitorInfo struct {
		Size    uint32
		Monitor rect
		Work    rect
		Flags   uint32
	}
	mi := monitorInfo{Size: uint32(unsafe.Sizeof(monitorInfo{}))}
	left, top := x-w/2, y-h/2
	if mon != 0 {
		if ok, _, _ := procGetMonitorInfoW.Call(mon, uintptr(unsafe.Pointer(&mi))); ok != 0 {
			a := mi.Work
			left = max(a.Left, min(left, a.Right-w))
			top = max(a.Top, min(top, a.Bottom-h))
		}
	}
	const swpNoSize, swpNoZOrder, swpNoActivate = 0x0001, 0x0004, 0x0010
	_, _, _ = procSetWindowPos.Call(hwnd, 0, uintptr(left), uintptr(top), 0, 0, swpNoSize|swpNoZOrder|swpNoActivate)
}

// ---------- processus ----------

// Process : processus attendu (Player X qui se ferme pour installer).
type Process struct{ h windows.Handle }

// OpenProcess : nil si le processus n'existe déjà plus.
func OpenProcess(pid uint32) *Process {
	if pid == 0 {
		return nil
	}
	h, err := windows.OpenProcess(windows.SYNCHRONIZE, false, pid)
	if err != nil {
		return nil
	}
	return &Process{h: h}
}

// Alive : le processus tourne encore.
func (p *Process) Alive() bool {
	if p == nil {
		return false
	}
	ev, _ := windows.WaitForSingleObject(p.h, 0)
	return ev == uint32(windows.WAIT_TIMEOUT)
}

func (p *Process) Close() {
	if p != nil {
		_ = windows.CloseHandle(p.h)
	}
}

// StartedSince : un processus de ce nom d'exécutable (ex. « Player X.exe »), autre que skip, démarré après since.
func StartedSince(exe string, skip uint32, since time.Time) bool {
	snap, err := windows.CreateToolhelp32Snapshot(windows.TH32CS_SNAPPROCESS, 0)
	if err != nil {
		return false
	}
	defer windows.CloseHandle(snap)
	var e windows.ProcessEntry32
	e.Size = uint32(unsafe.Sizeof(e))
	for err = windows.Process32First(snap, &e); err == nil; err = windows.Process32Next(snap, &e) {
		if e.ProcessID == skip || !strings.EqualFold(windows.UTF16ToString(e.ExeFile[:]), exe) {
			continue
		}
		h, err := windows.OpenProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, e.ProcessID)
		if err != nil {
			continue
		}
		var created, exit, kernel, user windows.Filetime
		err = windows.GetProcessTimes(h, &created, &exit, &kernel, &user)
		_ = windows.CloseHandle(h)
		if err == nil && time.Unix(0, created.Nanoseconds()).After(since) {
			return true
		}
	}
	return false
}

// Open : ouvre un fichier ou un programme comme un double-clic (bouton « Ouvrir Player X »).
func Open(path string) error {
	verb, _ := windows.UTF16PtrFromString("open")
	file, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return err
	}
	return windows.ShellExecute(0, verb, file, nil, nil, windows.SW_SHOWNORMAL)
}

// ---------- capture de la fenêtre (essai automatique) ----------

type bitmapInfoHeader struct {
	Size          uint32
	Width         int32
	Height        int32
	Planes        uint16
	BitCount      uint16
	Compression   uint32
	SizeImage     uint32
	XPelsPerMeter int32
	YPelsPerMeter int32
	ClrUsed       uint32
	ClrImportant  uint32
}

// CaptureWindow : image de la zone cliente, telle que dessinée (PrintWindow avec le contenu composé, sinon copie de l'écran).
func CaptureWindow(hwnd uintptr, fromScreen bool) (*image.RGBA, error) {
	var r rect
	_, _, _ = procGetClientRect.Call(hwnd, uintptr(unsafe.Pointer(&r)))
	w, h := int(r.Right-r.Left), int(r.Bottom-r.Top)
	if w <= 0 || h <= 0 {
		return nil, errors.New("fenêtre sans taille")
	}
	screen, _, _ := procGetDC.Call(0)
	defer procReleaseDC.Call(0, screen)
	mem, _, _ := procCreateCompatibleDC.Call(screen)
	defer procDeleteDC.Call(mem)
	bmp, _, _ := procCreateCompatibleBitmap.Call(screen, uintptr(w), uintptr(h))
	defer procDeleteObject.Call(bmp)
	old, _, _ := procSelectObject.Call(mem, bmp)
	if fromScreen {
		var pt struct{ X, Y int32 }
		_, _, _ = procClientToScreen.Call(hwnd, uintptr(unsafe.Pointer(&pt)))
		const srccopy = 0x00CC0020
		_, _, _ = procBitBlt.Call(mem, 0, 0, uintptr(w), uintptr(h), screen, uintptr(pt.X), uintptr(pt.Y), srccopy)
	} else {
		const pwClientOnly, pwRenderFull = 1, 2
		_, _, _ = procPrintWindow.Call(hwnd, mem, pwClientOnly|pwRenderFull)
	}
	_, _, _ = procSelectObject.Call(mem, old)
	bi := bitmapInfoHeader{Size: 40, Width: int32(w), Height: -int32(h), Planes: 1, BitCount: 32}
	buf := make([]byte, w*h*4)
	if r, _, _ := procGetDIBits.Call(mem, bmp, 0, uintptr(h), uintptr(unsafe.Pointer(&buf[0])), uintptr(unsafe.Pointer(&bi)), 0); r == 0 {
		return nil, errors.New("lecture de l'image impossible")
	}
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for i := 0; i < w*h; i++ {
		img.Pix[i*4], img.Pix[i*4+1], img.Pix[i*4+2], img.Pix[i*4+3] = buf[i*4+2], buf[i*4+1], buf[i*4], 255
	}
	return img, nil
}
