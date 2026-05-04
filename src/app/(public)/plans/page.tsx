import { redirect } from "next/navigation";

// Permanent redirect: /plans → /fr/plans
export default function PlansRedirect() {
  redirect("/fr/plans");
}
