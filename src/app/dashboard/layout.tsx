"use client";
import { useState, useEffect, useCallback } from "react";
import { DashboardNav } from "@/components/ui/Nav";
import { fetchWithRetry } from "@/lib/fetch-with-retry";
import { usePathname, useRouter } from "next/navigation";
import { getUser, authHeaders } from "@/lib/auth-client";
import { DASHBOARD_ROLES } from "@/lib/auth-guard";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [plan,       setPlan]       = useState<"FREE" | "PRO" | "PREMIUM">("FREE");
  const [isMobile,   setIsMobile]   = useState(false);
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [authOk,     setAuthOk]     = useState(false);
  const pathname = usePathname();
  const router   = useRouter();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // Auth guard — runs once after hydration
  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.replace("/login?redirect=" + encodeURIComponent(window.location.pathname));
      return;
    }
    if (!(DASHBOARD_ROLES as readonly string[]).includes(user.role)) {
      router.replace("/");
      return;
    }
    setAuthOk(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchTenant = useCallback(() => {
    const user = getUser();
    if (!user?.tenantId) return;

    fetchWithRetry(`/api/tenants/${user.tenantId}`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.data?.plan) setPlan(d.data.plan as "FREE" | "PRO" | "PREMIUM"); })
      .catch(() => {});

    // Pending bookings count → notification badge
    fetch(`/api/bookings?tenantId=${user.tenantId}&status=PENDING&pageSize=1`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (typeof d.data?.pagination?.total === "number") setNotifCount(d.data.pagination.total); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!authOk) return;
    fetchTenant();
    window.addEventListener("tenant-updated", fetchTenant);
    return () => window.removeEventListener("tenant-updated", fetchTenant);
  }, [authOk, fetchTenant]);

  if (!authOk) return (
    <div style={{ display:"flex", height:"100vh", alignItems:"center", justifyContent:"center", background:"var(--bg)" }}>
      <div style={{ width:32, height:32, border:"3px solid var(--border2)", borderTopColor:"var(--g2)", borderRadius:"50%", animation:"spin .8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

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
                fontSize:12,cursor:"pointer",position:"relative"}}>
              ☰ Menu
              {notifCount > 0 && (
                <span style={{position:"absolute",top:-5,right:-5,width:16,height:16,borderRadius:"50%",background:"var(--red)",color:"#fff",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {notifCount > 9 ? "9+" : notifCount}
                </span>
              )}
            </button>
          </div>

          {menuOpen && (
            <div style={{
              position: "fixed", inset: 0, top: 52,
              background: "var(--bg2)", zIndex: 200,
              padding: 20, overflowY: "auto",
            }}>
              <DashboardNav plan={plan} mobile onClose={() => setMenuOpen(false)} notifCount={notifCount} />
            </div>
          )}

          <div style={{flex:1, padding:"16px"}}>
            {children}
          </div>
        </>
      ) : (
        <>
          <DashboardNav plan={plan} notifCount={notifCount} />
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
