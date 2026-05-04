"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface PlanPrice { fcfa: number; eur: number; usd: number }
interface PlanPrices { monthly: PlanPrice; annual: PlanPrice }

interface PlansClientProps {
  lang:   string;
  labels: {
    monthly: string; annual: string;
    free_label: string; per_month: string; recommended: string;
    no_commitment: string;
    plans: {
      free:    { name: string; tagline: string; cta: string };
      pro:     { name: string; tagline: string; cta: string };
      premium: { name: string; tagline: string; cta: string };
    };
    feats: Record<string, string>;
  };
  initialPrices: Record<string, PlanPrices>;
}

const DEFAULT_PRICES: Record<string, PlanPrices> = {
  FREE:    { monthly:{fcfa:0,     eur:0,  usd:0  }, annual:{fcfa:0,     eur:0,  usd:0  } },
  PRO:     { monthly:{fcfa:15000, eur:23, usd:25 }, annual:{fcfa:12500, eur:19, usd:21 } },
  PREMIUM: { monthly:{fcfa:35000, eur:53, usd:58 }, annual:{fcfa:29167, eur:44, usd:48 } },
};

type Period   = "monthly" | "annual";
type Currency = "fcfa" | "eur" | "usd";

export default function PlansClient({ lang, labels, initialPrices }: PlansClientProps) {
  const [period,   setPeriod]   = useState<Period>("monthly");
  const [currency, setCurrency] = useState<Currency>("fcfa");
  const [prices,   setPrices]   = useState({ ...DEFAULT_PRICES, ...initialPrices });

  useEffect(() => {
    fetch("/api/plans")
      .then(r => r.json())
      .then(d => {
        if (!d.data?.plans) return;
        const map: Record<string, PlanPrices> = {};
        d.data.plans.forEach((p: any) => {
          map[p.plan] = {
            monthly: { fcfa: p.priceFcfa,       eur: p.priceEur,       usd: p.priceUsd },
            annual:  { fcfa: p.priceFcfaAnnual, eur: p.priceEurAnnual, usd: p.priceUsdAnnual },
          };
        });
        setPrices(prev => ({ ...prev, ...map }));
      })
      .catch(() => {});
  }, []);

  function formatPrice(plan: string): string {
    const v = prices[plan.toUpperCase()]?.[period]?.[currency] ?? 0;
    if (v === 0) return labels.free_label;
    if (currency === "fcfa") return `${v.toLocaleString("fr")} FCFA`;
    if (currency === "eur")  return `${v} €`;
    return `$${v}`;
  }

  const PLANS = [
    {
      id: "free", key: labels.plans.free, color: "border-border",
      feats: ["feat_bookings_free","feat_services_free","feat_photos_free","feat_address"],
      missing: ["feat_whatsapp_pro","feat_deposit_pro","feat_analytics_pro","feat_social"],
      ctaStyle: "border border-border2 text-text2 hover:bg-card2",
    },
    {
      id: "pro", key: labels.plans.pro, color: "border-blue/40", featured: true,
      feats: ["feat_bookings_pro","feat_services_pro","feat_photos_pro","feat_whatsapp_pro","feat_deposit_pro","feat_analytics_pro","feat_social"],
      missing: ["feat_multistaff"],
      ctaStyle: "bg-g1 text-white hover:bg-g3 shadow-green",
    },
    {
      id: "premium", key: labels.plans.premium, color: "border-purple/40",
      feats: ["feat_bookings_prem","feat_services_prem","feat_photos_prem","feat_whatsapp_prem","feat_deposit_prem","feat_analytics_prem","feat_multistaff","feat_api"],
      missing: [],
      ctaStyle: "bg-purple text-white hover:bg-purple/80",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-5 py-16 text-center">
      {/* Toggles */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-center mb-12">
        <div className="inline-flex bg-card border border-border rounded-xl p-1 gap-1">
          {(["monthly", "annual"] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-5 py-2 rounded-lg text-xs font-semibold transition-all ${period === p ? "bg-g1 text-white shadow-green" : "text-text3 hover:text-text"}`}>
              {p === "monthly" ? labels.monthly : labels.annual}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {(["fcfa", "eur", "usd"] as Currency[]).map(c => (
            <button key={c} onClick={() => setCurrency(c)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all ${currency === c ? "bg-g2/10 border-g2/30 text-g2" : "border-border2 text-text3 hover:text-text"}`}>
              {c.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="grid sm:grid-cols-3 gap-5 mb-10">
        {PLANS.map(plan => (
          <div key={plan.id}
            className={`relative bg-card border ${plan.color} rounded-2xl p-7 text-left transition-all duration-200 hover:shadow-card hover:-translate-y-0.5 ${plan.featured ? "ring-2 ring-blue/20" : ""}`}>
            {plan.featured && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-blue text-white text-[10px] font-bold px-4 py-1 rounded-full">
                {labels.recommended}
              </div>
            )}
            <div className="text-xs font-bold text-text3 uppercase tracking-widest mb-3">{plan.key.name}</div>
            <div className="font-serif text-3xl font-extrabold mb-1">{formatPrice(plan.id)}</div>
            {prices[plan.id.toUpperCase()]?.[period]?.fcfa > 0 && (
              <div className="text-text3 text-xs mb-4">{labels.per_month}</div>
            )}
            <p className="text-text2 text-xs mb-6 leading-relaxed">{plan.key.tagline}</p>
            <ul className="space-y-2.5 mb-7">
              {plan.feats.map(f => (
                <li key={f} className="flex items-start gap-2 text-xs text-text2">
                  <span className="w-4 h-4 rounded-full bg-g2/15 text-g2 flex items-center justify-center text-[9px] shrink-0 mt-0.5 font-bold">✓</span>
                  {labels.feats[f] ?? f}
                </li>
              ))}
              {plan.missing.map(f => (
                <li key={f} className="flex items-start gap-2 text-xs text-text3 opacity-50">
                  <span className="w-4 h-4 rounded-full bg-border flex items-center justify-center text-[9px] shrink-0 mt-0.5">✗</span>
                  {labels.feats[f] ?? f}
                </li>
              ))}
            </ul>
            <Link href="/login"
              className={`block w-full text-center py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${plan.ctaStyle}`}>
              {plan.key.cta}
            </Link>
          </div>
        ))}
      </div>

      <p className="text-text3 text-xs">{labels.no_commitment}</p>
    </div>
  );
}
