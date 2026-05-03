"use client";

import { useEffect } from "react";

/**
 * Reads the persisted theme preference from localStorage and applies it as
 * data-theme on <html> — runs only in the browser after hydration so it
 * never causes a server/client mismatch.
 *
 * Default falls back to "light" which matches the :root CSS variables,
 * so there is no flash for first-time visitors.
 */
export default function ThemeInit() {
  useEffect(() => {
    const theme = localStorage.getItem("belo_theme") || "light";
    document.documentElement.setAttribute("data-theme", theme);
  }, []);

  return null;
}
