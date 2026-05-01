import { ZodError } from "zod";

export interface FieldErrors { [field: string]: string; }
export function formatZodError(error: ZodError) {
  const fields: FieldErrors = {};
  const MSGS: Record<string, string> = {
    phone: "Numéro de téléphone invalide",
    email: "Email invalide",
    slotId: "Créneau invalide",
    serviceId: "Service invalide",
    name: "Nom trop court ou trop long",
    priceCents: "Prix invalide",
  };
  for (const issue of error.issues) {
    const k = issue.path.join(".");
    if (k && !fields[k]) fields[k] = MSGS[k] ?? issue.message;
  }
  const count = Object.keys(fields).length;
  return { error: { code: "VALIDATION_ERROR", message: count === 1 ? "Un champ est invalide." : `${count} champs invalides.`, fields } };
}

export { formatZodError as zodErrorResponse };
