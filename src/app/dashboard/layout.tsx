"use client";
import { useState, useEffect, useCallback } from "react";
import { DashboardNav } from "@/components/ui/Nav";
import { fetchWithRetry } from "@/lib/fetch-with-retry";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [plan,     setPlan]     = useState<"FREE" | "PRO" | "PREMIUM">("FREE");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const fetchTenant = useCallback(() => {
    const token = localStorage.getItem("belo_token");
    const user  = (() => { try { return JSON.parse(localStorage.getItem("belo_user") ?? ""); } catch { return null; } })();
    if (!token || !user?.tenantId) return;
    fetchWithRetry(`/api/tenants/${user.tenantId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.data?.plan) setPlan(d.data.plan as "FREE" | "PRO" | "PREMIUM"); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchTenant();
    window.addEventListener("tenant-updated", fetchTenant);
    return () => window.removeEventListener("tenant-updated", fetchTenant);
  }, [fetchTenant]);

  return (
    <div style={{ display:"flex", flexDirection: isMobile ? "column" : "row", minHeight:"100vh", height: isMobile ? "auto" : "100vh", overflow: isMobile ? "visible" : "hidden" }}>
      <DashboardNav plan={plan} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
