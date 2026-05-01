"use client";
import { useState, useEffect } from "react";

interface AuthStore {
  user: { id:string; name:string; phone:string; role:string; tenantId?:string } | null;
  accessToken: string | null;
  login: (phone:string, otp:string) => Promise<boolean>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
}

export function useAuth(): AuthStore {
  const [user, setUser]               = useState<AuthStore["user"]>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("belo_user");
    const token  = localStorage.getItem("belo_token");
    if (stored && token) { setUser(JSON.parse(stored)); setAccessToken(token); }
  }, []);

  async function login(phone: string, otp: string) {
    const res  = await fetch("/api/auth?action=verify-otp", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ phone, otp }) });
    const data = await res.json();
    if (!res.ok) return false;
    setUser(data.data.user);
    setAccessToken(data.data.accessToken);
    localStorage.setItem("belo_user",  JSON.stringify(data.data.user));
    localStorage.setItem("belo_token", data.data.accessToken);
    return true;
  }

  async function logout() {
    await fetch("/api/auth?action=logout", { method:"POST" });
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem("belo_user");
    localStorage.removeItem("belo_token");
  }

  async function refresh() {
    const res  = await fetch("/api/auth?action=refresh", { method:"POST" });
    const data = await res.json();
    if (!res.ok) return false;
    setAccessToken(data.data.accessToken);
    localStorage.setItem("belo_token", data.data.accessToken);
    return true;
  }

  return { user, accessToken, login, logout, refresh };
}
