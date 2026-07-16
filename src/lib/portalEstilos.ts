import type { CSSProperties } from "react";
import { C } from "./constants";
import { RAIO_MD, RAIO_XL } from "./estiloGlobal";

export const inputStyle: CSSProperties = {
  padding: "10px 14px",
  borderRadius: RAIO_MD,
  border: `1px solid ${C.borderMid}`,
  width: "100%",
  boxSizing: "border-box",
  outlineColor: C.sidebarBg,
  fontSize: 13,
  color: C.textMain,
  backgroundColor: C.bgCard,
  fontWeight: 500,
};

export const botaoPrimarioStyle: CSSProperties = {
  width: "100%",
  padding: "13px 20px",
  background: C.sidebarBg,
  color: "#fff",
  border: "none",
  borderRadius: RAIO_MD,
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};

export const botaoSecundarioStyle: CSSProperties = {
  width: "100%",
  padding: "12px 20px",
  background: "none",
  color: C.textMuted,
  border: `1px solid ${C.borderMid}`,
  borderRadius: RAIO_MD,
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};

export const cardStyle: CSSProperties = {
  background: C.bgCard,
  borderRadius: RAIO_XL,
  border: `1px solid ${C.border}`,
};

export const labelStyle: CSSProperties = {
  margin: "0 0 6px",
  fontSize: 10,
  fontWeight: 700,
  color: C.textMuted,
  display: "block",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};
