// Root "/" page — redirects to /fr (proxy also handles this, but this
// server-side redirect ensures backward-compatible navigation without a
// round-trip to the edge proxy on direct hits.
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/fr");
}
