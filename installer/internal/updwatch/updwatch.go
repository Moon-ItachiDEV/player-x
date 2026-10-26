// Package updwatch : ce que montre la fenêtre « Mise à jour de Player X » (cmd/update) à partir de ce qu'elle observe.
// Logique pure, sans appel à Windows : testée partout (go test ./internal/updwatch).
//
// La fenêtre ne fait qu'observer l'installation silencieuse lancée par Player X (electron-updater, NSIS) :
//   - Player X se ferme (étape 0) ;
//   - NSIS sort l'ancienne version du dossier, décompresse la nouvelle dans %TEMP%\nsXXXX.tmp\7z-out puis la copie
//     dans le dossier d'installation (étape 1, mesurée en octets vraiment écrits) ;
//   - NSIS relance Player X (étape 2) ;
//   - la nouvelle version écrit done.json avec son numéro de version, comparé à celui attendu (étape 3).
package updwatch

import "time"

// Étapes affichées (la page les coche dans cet ordre). AllDone : tout est fait.
const (
	StepClose   = 0
	StepFiles   = 1
	StepRestart = 2
	StepVerify  = 3
	AllDone     = 4
)

// Done : écrit par la nouvelle version de Player X au démarrage (ok : c'est bien la version attendue),
// puis réécrit avec Shown quand sa fenêtre a dessiné sa page.
type Done struct {
	Version string `json:"version"`
	Ok      bool   `json:"ok"`
	Shown   bool   `json:"shown"`
}

// Obs : ce que la fenêtre a vu à un instant. -1 : taille inconnue (dossier introuvable ou illisible).
type Obs struct {
	ParentAlive bool
	Extracted   int64 // octets dans 7z-out (nouvelle version décompressée par NSIS)
	Installed   int64 // octets dans le dossier d'installation
	NewApp      bool  // un Player X démarré après la fermeture
	Done        *Done
}

// Limits : délais, réglables pour les essais.
type Limits struct {
	WaitParent time.Duration // Player X toujours ouvert après ce délai : l'installation n'a pas lieu, on part sans rien montrer
	NoRelaunch time.Duration // pas de relance après la fermeture : message « Player X ne s'est pas rouvert »
	NoVerify   time.Duration // relancé mais pas de done.json : on s'efface (Player X est là de toute façon)
	ShownWait  time.Duration // done.json bon mais page pas encore dessinée : on s'efface quand même au bout de ce délai
	ErrorClose time.Duration // message d'erreur laissé à l'écran au plus ce temps
	Max        time.Duration // filet : jamais plus longtemps (hors message d'erreur)
}

// DefaultLimits : valeurs de la vraie mise à jour.
var DefaultLimits = Limits{
	WaitParent: 25 * time.Second,
	NoRelaunch: 150 * time.Second,
	NoVerify:   40 * time.Second,
	ShownWait:  3 * time.Second,
	ErrorClose: 10 * time.Minute,
	Max:        6 * time.Minute,
}

// View : ce que la fenêtre doit montrer.
type View struct {
	Show    bool   `json:"-"` // fenêtre visible
	Step    int    `json:"step"`
	Percent int    `json:"percent"`
	Written int64  `json:"written"`
	Total   int64  `json:"total"`
	Error   string `json:"error,omitempty"`
	Out     bool   `json:"out,omitempty"` // la page s'efface
	Quit    bool   `json:"-"`             // fermer la fenêtre
}

// Watch : suit l'installation d'une version. Expected : taille du dossier d'installation avant la mise à jour.
type Watch struct {
	To       string
	Expected int64
	Lim      Limits

	started    time.Time
	parentGone time.Time
	step       int
	frac       float64
	minInst    int64
	sawExtract bool
	stepAt     time.Time
	readyAt    time.Time // done.json bon (ou délai dépassé) : début de l'effacement
	outAt      time.Time
	err        string
	errAt      time.Time
}

// New : start est l'heure du lancement de la fenêtre (juste avant que Player X se ferme).
func New(to string, expected int64, lim Limits, start time.Time) *Watch {
	return &Watch{To: to, Expected: expected, Lim: lim, started: start, minInst: -1}
}

// ParentGone : heure de la fermeture de Player X (zéro tant qu'il est ouvert).
func (w *Watch) ParentGone() time.Time { return w.parentGone }

func clamp01(x float64) float64 {
	if x < 0 {
		return 0
	}
	if x > 1 {
		return 1
	}
	return x
}

// files : part des fichiers vraiment écrits. Décompression (80 %) puis copie dans le dossier vidé (20 %) ;
// sans dossier de décompression vu, la copie seule compte.
func (w *Watch) files(o Obs) float64 {
	if w.Expected <= 0 {
		return w.frac
	}
	exp := float64(w.Expected)
	if o.Installed >= 0 && (w.minInst < 0 || o.Installed < w.minInst) {
		w.minInst = o.Installed
	}
	if o.Extracted > 0 {
		w.sawExtract = true
	}
	fc := 0.0
	// La copie ne compte que si l'ancienne version est bien sortie du dossier (sinon la taille ne dit rien).
	if w.minInst >= 0 && float64(w.minInst) < 0.3*exp && o.Installed > w.minInst {
		fc = clamp01(float64(o.Installed-w.minInst) / exp)
	}
	f := fc
	if w.sawExtract {
		fx := 0.0
		if o.Extracted > 0 {
			fx = clamp01(float64(o.Extracted) / exp)
		} else {
			fx = 1 // 7z-out déjà supprimé : la décompression est finie
		}
		f = 0.8*fx + 0.2*fc
	}
	if f > 0.99 {
		f = 0.99
	}
	if f > w.frac {
		w.frac = f
	}
	return w.frac
}

func (w *Watch) percent() int {
	switch {
	case w.step >= AllDone:
		return 100
	case w.step == StepVerify:
		return 96
	case w.step == StepRestart:
		return 88
	case w.step == StepFiles:
		return 5 + int(80*w.frac)
	}
	return 0
}

func (w *Watch) view(show bool) View {
	v := View{Show: show, Step: w.step, Percent: w.percent(), Error: w.err}
	if w.step == StepFiles && w.Expected > 0 {
		v.Total = w.Expected
		v.Written = int64(w.frac * float64(w.Expected))
	}
	return v
}

// out : début de l'effacement (la page fond, puis la fenêtre se ferme).
func (w *Watch) out(now time.Time) View {
	w.outAt = now
	v := w.view(true)
	v.Out = true
	return v
}

// Next : nouvelle observation → ce qu'il faut montrer.
func (w *Watch) Next(o Obs, now time.Time) View {
	// Message d'erreur : il reste jusqu'à ce qu'on le ferme (ou au bout de ErrorClose).
	if w.err != "" {
		v := w.view(true)
		v.Quit = now.Sub(w.errAt) >= w.Lim.ErrorClose
		return v
	}
	// Effacement en cours : la fenêtre se ferme après le fondu de la page.
	if !w.outAt.IsZero() {
		v := w.view(true)
		v.Out = true
		v.Quit = now.Sub(w.outAt) >= 260*time.Millisecond
		return v
	}
	if now.Sub(w.started) >= w.Lim.Max {
		return View{Quit: true}
	}
	if w.parentGone.IsZero() {
		if o.ParentAlive {
			if now.Sub(w.started) >= w.Lim.WaitParent {
				return View{Quit: true}
			}
			return View{}
		}
		w.parentGone, w.step, w.stepAt = now, StepFiles, now
	}

	switch w.step {
	case StepFiles:
		w.files(o)
		if o.NewApp || o.Done != nil {
			w.step, w.stepAt = StepRestart, now
		} else if now.Sub(w.parentGone) >= w.Lim.NoRelaunch {
			w.err, w.errAt = "norelaunch", now
			return w.view(true)
		}
	}
	switch w.step {
	case StepRestart:
		if o.Done != nil {
			if !o.Done.Ok || o.Done.Version != w.To {
				// Ce n'est pas la version attendue : Player X le dit lui-même, la fenêtre s'efface.
				return w.out(now)
			}
			w.step, w.stepAt = StepVerify, now
		} else if now.Sub(w.stepAt) >= w.Lim.NoVerify {
			return w.out(now)
		}
	case StepVerify:
		// La vérification vient d'avoir lieu (done.json) : cochée au tour suivant.
		w.step, w.stepAt = AllDone, now
	case AllDone:
		if w.readyAt.IsZero() && ((o.Done != nil && o.Done.Shown) || now.Sub(w.stepAt) >= w.Lim.ShownWait) {
			w.readyAt = now
		}
		// « Mise à jour terminée » reste lisible un instant, puis s'efface sur la nouvelle fenêtre de Player X.
		if !w.readyAt.IsZero() && now.Sub(w.readyAt) >= 400*time.Millisecond {
			return w.out(now)
		}
	}
	return w.view(true)
}
