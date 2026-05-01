"use client";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: (string | undefined | null | boolean)[]) {
  return twMerge(clsx(inputs));
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "green" | "ghost" | "purple" | "red" | "amber";
  size?: "xs" | "sm" | "md" | "lg";
  loading?: boolean;
}

export function Button({ variant="green", size="md", loading, className, children, disabled, ...props }: ButtonProps) {
  const base = "inline-flex items-center justify-center gap-2 font-semibold rounded-[10px] transition-all cursor-pointer border-none";
  const variants = {
    green:  "bg-[var(--g)] text-white hover:bg-[var(--g3)]",
    ghost:  "bg-transparent border border-[var(--border2)] text-[var(--text2)] hover:border-[rgba(34,211,138,.4)] hover:text-[var(--g2)]",
    purple: "bg-[var(--purple2)] text-white hover:opacity-90",
    red:    "bg-[rgba(239,68,68,.12)] text-[var(--red)] hover:bg-[rgba(239,68,68,.22)]",
    amber:  "bg-[rgba(245,166,35,.12)] text-[var(--amber)] hover:bg-[rgba(245,166,35,.22)]",
  };
  const sizes = { xs:"px-2.5 py-1 text-[11px]", sm:"px-3.5 py-1.5 text-[12px]", md:"px-5 py-2.5 text-[13px]", lg:"px-7 py-3 text-[15px]" };
  return (
    <button className={cn(base, variants[variant], sizes[size], (loading||disabled) && "opacity-60 cursor-not-allowed", className)} disabled={loading||disabled} {...props}>
      {loading ? <span style={{width:14,height:14,border:"2px solid currentColor",borderTopColor:"transparent",borderRadius:"50%",display:"inline-block",animation:"spin .6s linear infinite"}} /> : null}
      {children}
    </button>
  );
}

interface BadgeProps { variant?: "green"|"amber"|"red"|"purple"|"blue"|"gray"; children: React.ReactNode; className?: string; }
export function Badge({ variant="green", children, className }: BadgeProps) {
  const v = {
    green:  "bg-[rgba(34,211,138,.12)] text-[var(--g2)] border border-[rgba(34,211,138,.2)]",
    amber:  "bg-[rgba(245,166,35,.12)] text-[var(--amber)] border border-[rgba(245,166,35,.2)]",
    red:    "bg-[rgba(239,68,68,.12)] text-[var(--red)] border border-[rgba(239,68,68,.2)]",
    purple: "bg-[rgba(144,96,232,.12)] text-[var(--purple)] border border-[rgba(144,96,232,.2)]",
    blue:   "bg-[rgba(59,126,246,.12)] text-[var(--blue)] border border-[rgba(59,126,246,.2)]",
    gray:   "bg-[rgba(255,255,255,.08)] text-[var(--text3)] border border-[var(--border2)]",
  };
  return <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold", v[variant], className)}>{children}</span>;
}

export function Card({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("bg-[var(--card)] border border-[var(--border)] rounded-[var(--r2)] p-5", className)} {...props}>{children}</div>;
}

export function Spinner({ size=16 }: { size?: number }) {
  return <span style={{width:size,height:size,border:"2px solid var(--border2)",borderTopColor:"var(--g2)",borderRadius:"50%",display:"inline-block",animation:"spin .6s linear infinite"}} />;
}

interface ToastProps { message: string; type?: "green"|"amber"|"red"; onClose?: () => void; }
export function Toast({ message, type="green", onClose }: ToastProps) {
  const icons = { green:"✅", amber:"⚠️", red:"❌" };
  const borders = { green:"rgba(34,211,138,.3)", amber:"rgba(245,166,35,.3)", red:"rgba(239,68,68,.3)" };
  return (
    <div style={{background:"var(--card)",border:`1px solid ${borders[type]}`,borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",gap:10,fontSize:13,minWidth:240,maxWidth:320,boxShadow:"0 8px 24px rgba(0,0,0,.4)",animation:"slideIn .3s ease"}}>
      <span>{icons[type]}</span>
      <span style={{flex:1,color:"var(--text)"}}>{message}</span>
      {onClose && <button onClick={onClose} style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:16}}>×</button>}
    </div>
  );
}
