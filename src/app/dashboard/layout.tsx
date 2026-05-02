"use client";
import { useState, useEffect } from "react";
import { DashboardNav } from "@/components/ui/Nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [plan, setPlan] = useState<"FREE" | "PRO" | "PREMIUM">("FREE");

  useEffect(() => {
    const token = localStorage.getItem("belo_token");
    const user  = (() => { try { return JSON.parse(localStorage.getItem("belo_user") ?? ""); } catch { return null; } })();
    if (!token || !user?.tenantId) return;
    fetch(`/api/tenants/${user.tenantId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.data?.plan) setPlan(d.data.plan as "FREE" | "PRO" | "PREMIUM"); })
      .catch(() => {});
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <DashboardNav plan={plan} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
