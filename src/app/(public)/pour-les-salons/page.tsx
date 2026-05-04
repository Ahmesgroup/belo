import { redirect } from "next/navigation";

// Permanent redirect: /pour-les-salons → /fr/for-salons
// English speakers: proxy.ts detects Accept-Language and redirects / → /en
export default function PourLesSalonsRedirect() {
  redirect("/fr/for-salons");
}
