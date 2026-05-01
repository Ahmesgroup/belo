export function toCents(amount: number): number { return Math.round(amount * 100); }
export function fromCents(cents: number): number { return cents / 100; }
export function formatFCFA(cents: number): string {
  return new Intl.NumberFormat("fr-SN", { style: "decimal", minimumFractionDigits: 0 }).format(cents / 100) + " FCFA";
}
export function formatEUR(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}
