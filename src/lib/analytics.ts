/**
 * BELO ANALYTICS
 * Funnel tracking — events SEO obligatoires pour mesurer acquisition.
 *
 * Implémentation : console.log en dev, compatible avec tout provider
 * (PostHog, Mixpanel, GA4) via remplacement du driver ci-dessous.
 */

type TrackEvent =
  | "seo_page_view"
  | "seo_salon_click"
  | "seo_booking_start"
  | "seo_booking_success"
  | "seo_drop"
  | "seo_zero_results";

type TrackProperties = Record<string, string | number | boolean | undefined>;

function sendEvent(event: TrackEvent, props: TrackProperties): void {
  if (typeof window === "undefined") return;

  // Dev : log structuré
  if (process.env.NODE_ENV === "development") {
    console.info(`[BELO:track] ${event}`, props);
    return;
  }

  // Production : brancher ici PostHog / GA4 / Segment
  // Exemple PostHog :
  //   window.posthog?.capture(event, props);
  // Exemple GA4 :
  //   window.gtag?.("event", event, props);
  //
  // Pour l'instant : pas de tracking tiers par défaut (RGPD)
}

export function track(event: TrackEvent, props: TrackProperties = {}): void {
  sendEvent(event, { ...props, timestamp: Date.now() });
}
