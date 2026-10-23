//go:build windows

package main

// Appels Windows de l'installeur : fenêtre (coins, déplacement, réduction), dossiers spéciaux, choix d'un dossier,
// espace libre, message d'erreur. Tout passe par les DLL du système, sans dépendance de plus.

import (
	"errors"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	user32  = windows.NewLazySystemDLL("user32.dll")
	dwmapi  = windows.NewLazySystemDLL("dwmapi.dll")
	ole32   = windows.NewLazySystemDLL("ole32.dll")
	shell32 = windows.NewLazySystemDLL("shell32.dll")

	procReleaseCapture        = user32.NewProc("ReleaseCapture")
	procPostMessageW          = user32.NewProc("PostMessageW")
	procShowWindow            = user32.NewProc("ShowWindow")
	procGetDpiForSystem       = user32.NewProc("GetDpiForSystem")
	procMessageBoxW           = user32.NewProc("MessageBoxW")
	procSetForegroundWindow   = user32.NewProc("SetForegroundWindow")
	procDwmSetWindowAttribute = dwmapi.NewProc("DwmSetWindowAttribute")
	procCoCreateInstance      = ole32.NewProc("CoCreateInstance")
	procCoTaskMemFree         = ole32.NewProc("CoTaskMemFree")
	procSHCreateItemFromPath  = shell32.NewProc("SHCreateItemFromParsingName")
	procSHGetFolderPathW      = shell32.NewProc("SHGetFolderPathW")
)

const (
	wmClose        = 0x0010
	wmNcLButtonDn  = 0x00A1
	htCaption      = 2
	swMinimize     = 6
	mbIconError    = 0x10
	mbIconWarning  = 0x30
	csidlDesktop   = 0x0010 // CSIDL_DESKTOPDIRECTORY
	csidlPrograms  = 0x0002 // CSIDL_PROGRAMS (menu Démarrer de l'utilisateur)
	dwmaCorner     = 33     // DWMWA_WINDOW_CORNER_PREFERENCE (Windows 11)
	dwmcpRound     = 2
	dwmaDarkMode   = 20 // DWMWA_USE_IMMERSIVE_DARK_MODE
	sigdnFilePath  = 0x80058000
	fosPickFolders = 0x20
	fosForceFsys   = 0x40
	fosNoReadOnly  = 0x8000 // FOS_NOREADONLYRETURN
)

// dpiScale : facteur d'affichage de l'écran principal (1 à 100 %, 1,5 à 150 %…).
func dpiScale() float64 {
	if procGetDpiForSystem.Find() != nil {
		return 1
	}
	d, _, _ := procGetDpiForSystem.Call()
	if d == 0 {
		return 1
	}
	return float64(d) / 96
}

// roundWindow : coins arrondis et bord sombre sous Windows 11 (sans effet sous Windows 10).
func roundWindow(hwnd uintptr) {
	if procDwmSetWindowAttribute.Find() != nil {
		return
	}
	pref := uint32(dwmcpRound)
	_, _, _ = procDwmSetWindowAttribute.Call(hwnd, dwmaCorner, uintptr(unsafe.Pointer(&pref)), 4)
	dark := uint32(1)
	_, _, _ = procDwmSetWindowAttribute.Call(hwnd, dwmaDarkMode, uintptr(unsafe.Pointer(&dark)), 4)
}

// dragWindow : la fenêtre sans cadre se déplace comme par sa barre de titre.
func dragWindow(hwnd uintptr) {
	_, _, _ = procReleaseCapture.Call()
	_, _, _ = procPostMessageW.Call(hwnd, wmNcLButtonDn, htCaption, 0)
}

func minimizeWindow(hwnd uintptr) { _, _, _ = procShowWindow.Call(hwnd, swMinimize) }
func closeWindow(hwnd uintptr)    { _, _, _ = procPostMessageW.Call(hwnd, wmClose, 0, 0) }
func foreground(hwnd uintptr)     { _, _, _ = procSetForegroundWindow.Call(hwnd) }

func messageBox(hwnd uintptr, title, text string, warn bool) {
	t, _ := windows.UTF16PtrFromString(title)
	m, _ := windows.UTF16PtrFromString(text)
	flags := uintptr(mbIconError)
	if warn {
		flags = mbIconWarning
	}
	_, _, _ = procMessageBoxW.Call(hwnd, uintptr(unsafe.Pointer(m)), uintptr(unsafe.Pointer(t)), flags)
}

// specialFolder : Bureau ou menu Démarrer de l'utilisateur (suit les dossiers déplacés, OneDrive compris).
func specialFolder(csidl int) string {
	buf := make([]uint16, windows.MAX_PATH)
	r, _, _ := procSHGetFolderPathW.Call(0, uintptr(csidl), 0, 0, uintptr(unsafe.Pointer(&buf[0])))
	if r != 0 {
		return ""
	}
	return windows.UTF16ToString(buf)
}

// freeBytes : place libre sur le disque qui contient path (ou son premier parent existant).
func freeBytes(path string) (uint64, error) {
	p, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return 0, err
	}
	var free, total, all uint64
	if err := windows.GetDiskFreeSpaceEx(p, &free, &total, &all); err != nil {
		return 0, err
	}
	return free, nil
}

// ---------- choix d'un dossier (boîte « Sélectionner un dossier » de Windows) ----------

var (
	clsidFileOpenDialog = windows.GUID{Data1: 0xDC1C5A9C, Data2: 0xE88A, Data3: 0x4DDE, Data4: [8]byte{0xA5, 0xA1, 0x60, 0xF8, 0x2A, 0x20, 0xAE, 0xF7}}
	iidIFileOpenDialog  = windows.GUID{Data1: 0xD57C7288, Data2: 0xD4AD, Data3: 0x4768, Data4: [8]byte{0xBE, 0x02, 0x9D, 0x96, 0x95, 0x32, 0xD9, 0x60}}
	iidIShellItem       = windows.GUID{Data1: 0x43826D1E, Data2: 0xE718, Data3: 0x42EE, Data4: [8]byte{0xBC, 0x55, 0xA1, 0xE2, 0x61, 0xC3, 0x7B, 0xFE}}
)

// vtbl : appel d'une méthode COM par son rang dans la table virtuelle.
func vcall(obj uintptr, index int, args ...uintptr) uintptr {
	vtbl := *(*uintptr)(unsafe.Pointer(obj))
	fn := *(*uintptr)(unsafe.Pointer(vtbl + uintptr(index)*unsafe.Sizeof(uintptr(0))))
	r, _, _ := syscall.SyscallN(fn, append([]uintptr{obj}, args...)...)
	return r
}

func release(obj uintptr) {
	if obj != 0 {
		vcall(obj, 2)
	}
}

// pickFolder ouvre le choix d'un dossier, en partant de start. Renvoie "" si annulé.
func pickFolder(owner uintptr, start, title string) (string, error) {
	var dlg uintptr
	const clsctxInproc = 1
	hr, _, _ := procCoCreateInstance.Call(uintptr(unsafe.Pointer(&clsidFileOpenDialog)), 0, clsctxInproc, uintptr(unsafe.Pointer(&iidIFileOpenDialog)), uintptr(unsafe.Pointer(&dlg)))
	if hr != 0 || dlg == 0 {
		return "", errors.New("boîte de choix du dossier indisponible")
	}
	defer release(dlg)
	// IFileDialog : 9 SetOptions, 10 GetOptions, 12 SetFolder, 17 SetTitle, 18 SetOkButtonLabel, 20 GetResult ; IModalWindow : 3 Show.
	var opts uint32
	vcall(dlg, 10, uintptr(unsafe.Pointer(&opts)))
	vcall(dlg, 9, uintptr(opts|fosPickFolders|fosForceFsys|fosNoReadOnly))
	if t, err := windows.UTF16PtrFromString(title); err == nil {
		vcall(dlg, 17, uintptr(unsafe.Pointer(t)))
	}
	if ok, err := windows.UTF16PtrFromString("Choisir ce dossier"); err == nil {
		vcall(dlg, 18, uintptr(unsafe.Pointer(ok)))
	}
	if start != "" {
		if p, err := windows.UTF16PtrFromString(start); err == nil {
			var item uintptr
			r, _, _ := procSHCreateItemFromPath.Call(uintptr(unsafe.Pointer(p)), 0, uintptr(unsafe.Pointer(&iidIShellItem)), uintptr(unsafe.Pointer(&item)))
			if r == 0 && item != 0 {
				vcall(dlg, 12, item)
				release(item)
			}
		}
	}
	if r := vcall(dlg, 3, owner); r != 0 {
		return "", nil // annulé (HRESULT_FROM_WIN32(ERROR_CANCELLED)) ou fermé
	}
	var res uintptr
	if r := vcall(dlg, 20, uintptr(unsafe.Pointer(&res))); r != 0 || res == 0 {
		return "", errors.New("dossier illisible")
	}
	defer release(res)
	var name *uint16
	// IShellItem : 5 GetDisplayName
	if r := vcall(res, 5, sigdnFilePath, uintptr(unsafe.Pointer(&name))); r != 0 || name == nil {
		return "", errors.New("ce dossier n'est pas sur un disque")
	}
	defer procCoTaskMemFree.Call(uintptr(unsafe.Pointer(name)))
	return windows.UTF16PtrToString(name), nil
}
