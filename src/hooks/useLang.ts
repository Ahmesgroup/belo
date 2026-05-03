// Backward-compatible re-export — all existing imports keep working without changes.
// The actual implementation lives in LangProvider (src/lib/lang-context.tsx),
// which is a single React Context wrapping the entire app.
export { useLang } from "@/lib/lang-context";
