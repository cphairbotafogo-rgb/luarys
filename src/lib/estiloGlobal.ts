/**
 * estiloGlobal.ts — fonte única de verdade para tokens de design do Luarys.
 *
 * Regras:
 *  - Portal do Cliente importa daqui via estiloPortal.ts (não importa daqui diretamente)
 *  - Admin (lojista) importa daqui para novos componentes
 *  - Nunca declare um valor de cor, raio ou sombra inline — adicione aqui e importe
 */

import { C } from "@/lib/constants";

// ─── TIPOGRAFIA ───────────────────────────────────────────────────────────────
export const FONTE_TITULO = "var(--font-title)"; // Montserrat — títulos, labels, eyebrows
export const FONTE_CORPO  = "var(--font-body)";  // DM Sans — corpo de texto, inputs

// ─── BORDER RADIUS ────────────────────────────────────────────────────────────
// Use sempre estes nomes em vez de um número solto.
export const RAIO_XS  = 4;   // badges, chips, tags
export const RAIO_SM  = 6;   // botões pequenos, itens de lista
export const RAIO_MD  = 8;   // botões padrão, inputs do admin
export const RAIO_LG  = 10;  // botões e inputs do portal
export const RAIO_XL  = 12;  // cards do admin
export const RAIO_2XL = 16;  // cards de conteúdo do portal, modais
export const RAIO_3XL = 18;  // cards premium do portal (telas de auth)

// ─── SOMBRAS ─────────────────────────────────────────────────────────────────
export const SOMBRA_SUAVE   = "0 4px 14px rgba(44, 54, 67, 0.06)";
export const SOMBRA_CARD    = "0 18px 50px -22px rgba(44, 54, 67, 0.32)";
export const SOMBRA_MODAL   = "0 25px 50px -12px rgba(0, 0, 0, 0.25)";
export const SOMBRA_ELEVADO = "0 10px 25px rgba(0, 0, 0, 0.10)";

// ─── BOTÕES ───────────────────────────────────────────────────────────────────

/** Botão primário ardósia — portal e admin */
export const botaoPrimario = {
  fontFamily: FONTE_TITULO,
  width: "100%",
  padding: "14px 20px",
  background: C.sidebarBg,
  color: "#fff",
  border: "none",
  borderRadius: RAIO_LG,
  fontWeight: 700,
  fontSize: 14,
  letterSpacing: "0.3px",
  cursor: "pointer",
} as const;

/** Botão secundário (outline ardósia) */
export const botaoSecundario = {
  fontFamily: FONTE_TITULO,
  width: "100%",
  padding: "12px 20px",
  background: "none",
  color: C.sidebarBg,
  border: `1px solid ${C.sidebarBg}`,
  borderRadius: RAIO_LG,
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
} as const;

/** Botão de perigo (exclusão, cancelamento) */
export const botaoPerigo = {
  fontFamily: FONTE_TITULO,
  width: "100%",
  padding: "12px 20px",
  background: C.danger,
  color: "#fff",
  border: "none",
  borderRadius: RAIO_LG,
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
} as const;

// ─── INPUTS ───────────────────────────────────────────────────────────────────

/** Input padrão do portal (raio LG) */
export const inputPadrao = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: RAIO_LG,
  border: `1px solid ${C.borderMid}`,
  fontSize: 13,
  outlineColor: C.sidebarBg,
  boxSizing: "border-box" as const,
  color: C.textMain,
  fontWeight: 500,
  backgroundColor: C.bgCard,
  fontFamily: FONTE_CORPO,
} as const;

/** Input do admin (raio MD — levemente mais compacto) */
export const inputAdmin = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: RAIO_MD,
  border: `1px solid ${C.borderMid}`,
  fontSize: 13,
  outlineColor: C.sidebarBg,
  boxSizing: "border-box" as const,
  color: C.textMain,
  fontWeight: 500,
  backgroundColor: C.bgCard,
  fontFamily: FONTE_CORPO,
} as const;

// ─── LABELS ───────────────────────────────────────────────────────────────────

/** Label de campo (uppercase pequeno) */
export const labelPadrao = {
  fontFamily: FONTE_TITULO,
  fontSize: 10,
  fontWeight: 700,
  color: C.textMuted,
  display: "block" as const,
  marginBottom: 6,
  textTransform: "uppercase" as const,
  letterSpacing: "0.6px",
} as const;

// ─── CARDS ────────────────────────────────────────────────────────────────────

/** Card do admin: raio médio, sombra suave */
export const cardAdmin = {
  background: C.bgCard,
  borderRadius: RAIO_XL,
  border: `1px solid ${C.border}`,
  boxShadow: SOMBRA_SUAVE,
} as const;

/** Card do admin com destaque dourado no topo (modais, painéis importantes) */
export const cardAdminDestaque = {
  background: C.bgCard,
  borderRadius: RAIO_XL,
  border: `1px solid ${C.border}`,
  boxShadow: SOMBRA_SUAVE,
  borderTop: `3px solid ${C.douradoEleva}`,
} as const;

/** Card de alerta/perigo */
export const cardPerigo = {
  background: C.dangerBg,
  borderRadius: RAIO_XL,
  border: `1px solid ${C.danger}`,
} as const;

/** Card de sucesso */
export const cardSucesso = {
  background: C.successBg,
  borderRadius: RAIO_XL,
  border: `1px solid ${C.success}`,
} as const;

// ─── MODAIS ───────────────────────────────────────────────────────────────────

/** Container interno de modal (compartilhado admin + portal) */
export const containerModal = {
  background: C.bgCard,
  borderRadius: RAIO_2XL,
  boxShadow: SOMBRA_MODAL,
  border: `1px solid ${C.border}`,
  borderTop: `4px solid ${C.douradoEleva}`,
} as const;

/** Container de modal destrutivo (cancelamento, exclusão) */
export const containerModalPerigo = {
  background: C.bgCard,
  borderRadius: RAIO_2XL,
  boxShadow: SOMBRA_MODAL,
  border: `1px solid ${C.border}`,
  borderTop: `4px solid ${C.danger}`,
} as const;

// ─── OVERLAY DE MODAL ─────────────────────────────────────────────────────────
export const overlayModal = {
  position: "fixed" as const,
  inset: 0,
  background: "rgba(15, 23, 42, 0.5)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 999,
  padding: 24,
} as const;

// ─── ESTADOS VISUAIS (feedback ao usuário) ───────────────────────────────────

/** Badge/pill de status */
export function badgeStatus(cor: 'sucesso' | 'perigo' | 'aviso' | 'info' | 'neutro') {
  const map = {
    sucesso: { background: C.successBg,  color: C.successText, border: `1px solid ${C.success}` },
    perigo:  { background: C.dangerBg,   color: C.dangerText,  border: `1px solid ${C.danger}` },
    aviso:   { background: "#FFFBEB",    color: "#92400E",     border: "1px solid #FCD34D" },
    info:    { background: "#EFF6FF",    color: "#1D4ED8",     border: "1px solid #BFDBFE" },
    neutro:  { background: C.bg,         color: C.textMuted,   border: `1px solid ${C.border}` },
  };
  return {
    ...map[cor],
    fontFamily: FONTE_TITULO,
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 8px",
    borderRadius: RAIO_SM,
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    textTransform: "uppercase" as const,
    letterSpacing: "0.4px",
  };
}
