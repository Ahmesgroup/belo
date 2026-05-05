/**
 * src/lib/scroll/scrollLock.ts — Gestion du scroll lock.
 *
 * Supporte les overlays imbriqués via un compteur de références.
 * lockScroll() multiple → scroll verrouillé une seule fois.
 * unlockScroll() : déverrouille seulement quand lockCount === 0.
 *
 * Client-only — vérifier typeof window avant d'appeler.
 */

let lockCount = 0;
let savedScrollY = 0;

export function lockScroll(): void {
  if (typeof document === "undefined") return;

  lockCount++;

  if (lockCount === 1) {
    savedScrollY = window.scrollY;
    document.body.style.overflow   = "hidden";
    // Compensate for scrollbar width to prevent layout shift
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }
}

export function unlockScroll(): void {
  if (typeof document === "undefined") return;

  lockCount = Math.max(0, lockCount - 1);

  if (lockCount === 0) {
    document.body.style.overflow     = "";
    document.body.style.paddingRight = "";
    // Restaurer la position de scroll
    window.scrollTo(0, savedScrollY);
  }
}

/** Pour les tests — remet le compteur à zéro. */
export function resetScrollLock(): void {
  lockCount = 0;
  if (typeof document !== "undefined") {
    document.body.style.overflow     = "";
    document.body.style.paddingRight = "";
  }
}
