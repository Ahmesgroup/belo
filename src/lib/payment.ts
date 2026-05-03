/**
 * Payment eligibility rules — one place, no duplication.
 *
 * FREE plan: payment UI is never shown (no deposit, no payment methods).
 * PRO / PREMIUM: shown only when the tenant has explicitly enabled deposits.
 */

export interface PaymentTenant {
  plan: string;
  depositEnabled: boolean;
}

/**
 * Returns true when the booking flow should show payment / deposit UI.
 *
 * Rules (in order of precedence):
 *  1. FREE plan → always false
 *  2. depositEnabled must be true
 *  3. (add further checks here as the product evolves)
 */
export function canUsePayment(tenant: PaymentTenant | null | undefined): boolean {
  if (!tenant) return false;
  if (tenant.plan === "FREE") return false;
  if (!tenant.depositEnabled) return false;
  return true;
}
