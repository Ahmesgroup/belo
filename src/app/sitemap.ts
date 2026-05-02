import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://belo-khaki.vercel.app",        changeFrequency: "daily",   priority: 1 },
    { url: "https://belo-khaki.vercel.app/salons",  changeFrequency: "hourly",  priority: 0.9 },
    { url: "https://belo-khaki.vercel.app/plans",   changeFrequency: "weekly",  priority: 0.8 },
    { url: "https://belo-khaki.vercel.app/login",   changeFrequency: "monthly", priority: 0.5 },
  ];
}
