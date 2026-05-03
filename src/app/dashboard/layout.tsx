"use client";
import { useState, useEffect, useCallback } from "react";
import { DashboardNav } from "@/components/ui/Nav";
import { fetchWithRetry } from "@/lib/fetch-with-retry";
import { usePathname } from "next/navigation";
import { getUser, authHeaders } from "@/lib/auth-client";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [plan,     setPlan]     = useState<"FREE" | "PRO" | "PREMIUM">("FREE");
  const [isMobile, setIsMobile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const fetchTenant = useCallback(() => {
    const user = getUser();
    if (!user?.tenantId) return;
    fetchWithRetry(`/api/tenants/${user.tenantId}`, { headers: authHeaders() })
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
    <div style={{
      display: "flex",
      flexDirection: isMobile ? "column" : "row",
      minHeight: "100vh",
      height: isMobile ? "auto" : "100vh",
      overflow: isMobile ? "visible" : "hidden",
      background: "var(--bg)",
    }}>
      {isMobile ? (
        <>
          <div style={{
            position: "sticky", top: 0, zIndex: 100,
            background: "var(--bg2)", borderBottom: "1px solid var(--border)",
            padding: "0 16px", height: 52,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{fontFamily:"var(--serif)",fontWeight:800,fontSize:16,color:"var(--text)"}}>
              belo<span style={{color:"var(--g2)"}}>.</span>
            </span>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              style={{background:"var(--card)",border:"1px solid var(--border2)",
                borderRadius:8,padding:"6px 14px",color:"var(--text2)",
                fontSize:12,cursor:"pointer"}}>
              ☰ Menu
            </button>
          </div>

          {menuOpen && (
            <div style={{
              position: "fixed", inset: 0, top: 52,
              background: "var(--bg2)", zIndex: 200,
              padding: 20, overflowY: "auto",
            }}>
              <DashboardNav plan={plan} mobile onClose={() => setMenuOpen(false)} />
            </div>
          )}

          <div style={{flex:1, padding:"16px"}}>
            {children}
          </div>
        </>
      ) : (
        <>
          <DashboardNav plan={plan} />
          <div style={{flex:1, display:"flex", flexDirection:"column", overflow:"hidden"}}>
            <div style={{flex:1, overflowY:"auto", overflowX:"hidden"}}>
              {children}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
