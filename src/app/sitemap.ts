import { MetadataRoute } from "next";

const BASE = "https://belo-khaki.vercel.app";
const LANGS = ["fr", "en"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    { path: "",        priority: 1.0,  changeFrequency: "daily"   as const },
    { path: "/salons", priority: 0.9,  changeFrequency: "hourly"  as const },
    { path: "/plans",  priority: 0.7,  changeFrequency: "weekly"  as const },
    { path: "/login",  priority: 0.4,  changeFrequency: "monthly" as const },
  ];

  const localised = LANGS.flatMap(lang =>
    routes.map(r => ({
      url:              `${BASE}/${lang}${r.path}`,
      changeFrequency:  r.changeFrequency,
      priority:         r.priority,
      alternates: {
        languages: Object.fromEntries(
          LANGS.map(l => [l, `${BASE}/${l}${r.path}`])
        ),
      },
    }))
  );

  // Keep legacy non-lang routes so existing links keep working
  const legacy = [
    { url: `${BASE}`,         changeFrequency: "daily"   as const, priority: 0.8 },
    { url: `${BASE}/salons`,  changeFrequency: "hourly"  as const, priority: 0.8 },
    { url: `${BASE}/plans`,   changeFrequency: "weekly"  as const, priority: 0.6 },
  ];

  return [...localised, ...legacy];
}
