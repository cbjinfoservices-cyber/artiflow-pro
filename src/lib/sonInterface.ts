/**
 * Petits sons d'interface générés à la volée (Web Audio), sans dépendre d'un fichier audio
 * externe. Le contexte est créé paresseusement puis réutilisé. Toute indisponibilité (navigateur
 * sans Web Audio, contexte bloqué par la politique de lecture) est ignorée silencieusement pour
 * ne jamais gêner l'action en cours.
 */

import { lireSonActif } from "@/lib/sonPrefsMemoire";

let contexte: AudioContext | null = null;

/** Récupère (ou crée) le contexte audio partagé, en le réactivant s'il est en pause. */
function obtenirContexte(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!contexte) contexte = new Ctor();
    if (contexte.state === "suspended") void contexte.resume();
    return contexte;
  } catch {
    return null;
  }
}

/**
 * Joue un petit « ding » discret et doux pour confirmer qu'un raccourci vient d'être épinglé
 * dans « Derniers partagés ». Volume volontairement bas pour rester non intrusif.
 */
export function jouerSonEpingle(): void {
  // L'utilisateur a coupé le son de confirmation : on ne joue rien.
  if (!lireSonActif()) return;
  const ctx = obtenirContexte();
  if (!ctx) return;
  try {
    const t0 = ctx.currentTime;
    // Deux notes courtes et aiguës (la → mi) formant un léger « pop » cristallin.
    const notes = [
      { freq: 880, debut: 0, duree: 0.09 },
      { freq: 1318.5, debut: 0.07, duree: 0.13 },
    ];
    notes.forEach(({ freq, debut, duree }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t0 + debut);
      gain.gain.setValueAtTime(0.0001, t0 + debut);
      gain.gain.exponentialRampToValueAtTime(0.045, t0 + debut + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + debut + duree);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0 + debut);
      osc.stop(t0 + debut + duree + 0.02);
    });
  } catch {
    /* audio indisponible : on ignore silencieusement */
  }
}