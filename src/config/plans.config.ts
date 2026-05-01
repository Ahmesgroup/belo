export const PLAN_LIMITS = {
  FREE: {
    bookingsPerMonth: 20, services: 1, photosPerService: 1,
    whatsappAuto: false, deposit: false, analytics: false,
    socialLinks: false, multiStaff: false, apiWebhook: false,
    listingPosition: "BOTTOM", beloBackge: true, customPage: false,
  },
  PRO: {
    bookingsPerMonth: 500, services: 20, photosPerService: 10,
    whatsappAuto: true, deposit: true, analytics: "BASIC" as const,
    socialLinks: true, multiStaff: false, apiWebhook: false,
    listingPosition: "MIDDLE", beloBackge: false, customPage: false,
  },
  PREMIUM: {
    bookingsPerMonth: Infinity, services: Infinity, photosPerService: 50,
    whatsappAuto: true, smsAuto: true, emailAuto: true,
    deposit: true, autoRefund: true, analytics: "ADVANCED" as const,
    socialLinks: true, multiStaff: true, apiWebhook: true,
    listingPosition: "TOP", beloBackge: false, customPage: true, prioritySupport: true,
  },
} as const;

export const PLAN_PRICES = {
  FREE:    { fcfa: 0,     eur: 0,  usd: 0  },
  PRO:     { fcfa: 15000, eur: 23, usd: 25 },
  PREMIUM: { fcfa: 35000, eur: 53, usd: 58 },
} as const;
