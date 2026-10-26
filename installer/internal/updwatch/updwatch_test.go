package updwatch

import (
	"testing"
	"time"
)

var t0 = time.Date(2026, 10, 26, 1, 0, 0, 0, time.UTC)

func at(ms int) time.Time { return t0.Add(time.Duration(ms) * time.Millisecond) }

const mb = int64(1 << 20)

func TestRienAvantLaFermeture(t *testing.T) {
	w := New("0.9.5-beta.4", 300*mb, DefaultLimits, t0)
	v := w.Next(Obs{ParentAlive: true, Installed: 300 * mb}, at(500))
	if v.Show || v.Quit {
		t.Fatalf("fenêtre montrée ou fermée avant la fermeture de Player X : %+v", v)
	}
	// Player X ne se ferme jamais (installation annulée) : on part sans rien montrer.
	v = w.Next(Obs{ParentAlive: true}, at(25_000))
	if v.Show || !v.Quit {
		t.Fatalf("attendu : départ discret, obtenu %+v", v)
	}
}

func TestParcoursComplet(t *testing.T) {
	w := New("0.9.5-beta.4", 300*mb, DefaultLimits, t0)
	w.Next(Obs{ParentAlive: true, Installed: 300 * mb, Extracted: -1}, at(100))
	v := w.Next(Obs{Installed: 300 * mb, Extracted: -1}, at(1000))
	if !v.Show || v.Step != StepFiles || v.Percent != 5 {
		t.Fatalf("après la fermeture : %+v", v)
	}
	// Ancienne version sortie, décompression à moitié.
	v = w.Next(Obs{Installed: 0, Extracted: 150 * mb}, at(2000))
	if v.Percent != 5+int(80*0.4) || v.Written != int64(0.4*float64(300*mb)) || v.Total != 300*mb {
		t.Fatalf("décompression : %+v", v)
	}
	// Décompression finie, copie à moitié.
	v = w.Next(Obs{Installed: 150 * mb, Extracted: 300 * mb}, at(3000))
	if v.Percent != 5+int(80*0.9) {
		t.Fatalf("copie : %+v", v)
	}
	// Une taille qui recule ne fait jamais reculer la barre.
	v = w.Next(Obs{Installed: 10 * mb, Extracted: 0}, at(3200))
	if v.Percent != 5+int(80*0.9) {
		t.Fatalf("recul : %+v", v)
	}
	v = w.Next(Obs{Installed: 300 * mb, Extracted: -1, NewApp: true}, at(4000))
	if v.Step != StepRestart || v.Percent != 88 {
		t.Fatalf("relance : %+v", v)
	}
	d := &Done{Version: "0.9.5-beta.4", Ok: true}
	v = w.Next(Obs{NewApp: true, Done: d}, at(5000))
	if v.Step != StepVerify {
		t.Fatalf("vérification : %+v", v)
	}
	v = w.Next(Obs{NewApp: true, Done: d}, at(5250))
	if v.Step != AllDone || v.Percent != 100 || v.Out {
		t.Fatalf("terminé : %+v", v)
	}
	d2 := &Done{Version: "0.9.5-beta.4", Ok: true, Shown: true}
	v = w.Next(Obs{NewApp: true, Done: d2}, at(5500))
	if v.Out || v.Quit {
		t.Fatalf("« terminée » doit rester lisible un instant : %+v", v)
	}
	v = w.Next(Obs{NewApp: true, Done: d2}, at(5900))
	if !v.Out || v.Quit {
		t.Fatalf("effacement : %+v", v)
	}
	v = w.Next(Obs{NewApp: true, Done: d2}, at(6200))
	if !v.Quit {
		t.Fatalf("fermeture : %+v", v)
	}
}

func TestSansDossierDeDecompression(t *testing.T) {
	w := New("1.0.0", 100*mb, DefaultLimits, t0)
	w.Next(Obs{Installed: 100 * mb, Extracted: -1}, at(100))
	v := w.Next(Obs{Installed: 0, Extracted: -1}, at(500))
	v = w.Next(Obs{Installed: 50 * mb, Extracted: -1}, at(900))
	if v.Percent != 5+40 {
		t.Fatalf("copie seule : %+v", v)
	}
	// Dossier jamais vidé (copie par-dessus) : la taille ne dit rien, la barre attend la relance.
	w2 := New("1.0.0", 100*mb, DefaultLimits, t0)
	w2.Next(Obs{Installed: 100 * mb, Extracted: -1}, at(100))
	v = w2.Next(Obs{Installed: 100 * mb, Extracted: -1}, at(900))
	if v.Percent != 5 {
		t.Fatalf("taille sans signification : %+v", v)
	}
}

func TestPasDeRelance(t *testing.T) {
	lim := DefaultLimits
	w := New("1.0.0", 100*mb, lim, t0)
	w.Next(Obs{}, at(100))
	v := w.Next(Obs{}, at(100+int(lim.NoRelaunch/time.Millisecond)))
	if v.Error != "norelaunch" || !v.Show || v.Quit {
		t.Fatalf("message attendu : %+v", v)
	}
	v = w.Next(Obs{NewApp: true}, at(200_000))
	if v.Error != "norelaunch" || v.Quit {
		t.Fatalf("le message reste : %+v", v)
	}
	v = w.Next(Obs{}, at(100+int((lim.NoRelaunch+lim.ErrorClose)/time.Millisecond)))
	if !v.Quit {
		t.Fatalf("fermé au bout de ErrorClose : %+v", v)
	}
}

func TestMauvaiseVersion(t *testing.T) {
	w := New("1.0.0", 100*mb, DefaultLimits, t0)
	w.Next(Obs{}, at(100))
	w.Next(Obs{NewApp: true}, at(300))
	v := w.Next(Obs{NewApp: true, Done: &Done{Version: "0.9.0", Ok: false}}, at(600))
	if !v.Out || v.Step == AllDone {
		t.Fatalf("mauvaise version : la fenêtre s'efface sans dire « terminée » : %+v", v)
	}
}

func TestDoneSansProcessusVu(t *testing.T) {
	// Relance ratée par la détection des processus : done.json suffit.
	w := New("1.0.0", 100*mb, DefaultLimits, t0)
	w.Next(Obs{}, at(100))
	v := w.Next(Obs{Done: &Done{Version: "1.0.0", Ok: true}}, at(400))
	if v.Step != StepVerify {
		t.Fatalf("%+v", v)
	}
}

func TestRelanceSansDone(t *testing.T) {
	w := New("1.0.0", 100*mb, DefaultLimits, t0)
	w.Next(Obs{}, at(100))
	w.Next(Obs{NewApp: true}, at(300))
	v := w.Next(Obs{NewApp: true}, at(300+int(DefaultLimits.NoVerify/time.Millisecond)))
	if !v.Out {
		t.Fatalf("%+v", v)
	}
}
