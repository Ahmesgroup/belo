import { DashboardNav } from "@/components/ui/Nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <DashboardNav plan="FREE" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
