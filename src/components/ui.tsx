import React from "react";
import { C } from "@/lib/constants";
import { RAIO_SM, RAIO_MD, RAIO_2XL } from "@/lib/estiloGlobal";

export const Btn = ({ children, variant = 'primary', style, ...props }: any) => {
  const baseStyle = { padding: "10px 16px", borderRadius: RAIO_MD, fontWeight: 800, cursor: "pointer", transition: "0.2s", border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 14 };
  const variants: any = {
    primary: { background: C.violet, color: "#fff" },
    secondary: { background: C.lavender, color: C.violet },
    danger: { background: "#FEF2F2", color: "#EF4444" },
    ghost: { background: "transparent", color: C.textMuted, border: `1px solid ${C.borderMid}` }
  };
  return <button style={{ ...baseStyle, ...(variants[variant] || variants.primary), ...style }} {...props}>{children}</button>;
};

export const Card = ({ children, style, ...props }: any) => (
  <div style={{ background: C.bgCard, borderRadius: RAIO_2XL, border: `1px solid ${C.borderMid}`, padding: 24, boxShadow: "0 4px 6px rgba(0,0,0,0.02)", ...style }} {...props}>{children}</div>
);

export const Badge = ({ label, style }: any) => (
  <span style={{ padding: "4px 8px", borderRadius: RAIO_SM, fontSize: 11, fontWeight: 800, background: style?.bg || C.bg, color: style?.color || C.textMuted, ...style }}>{label}</span>
);

export const Avatar = ({ name, size = 40, style }: any) => {
  const initials = name ? name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'US';
  return <div style={{ width: size, height: size, borderRadius: "50%", background: C.lavender, color: C.violet, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: size * 0.4, flexShrink: 0, ...style }}>{initials}</div>;
};