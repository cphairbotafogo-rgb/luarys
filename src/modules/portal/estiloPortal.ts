/**
 * estiloPortal.ts — tokens visuais do Portal do Cliente.
 *
 * Importa os tokens compartilhados de estiloGlobal.ts e os re-exporta
 * para que as telas do Portal não precisem importar de dois lugares.
 * Acrescenta apenas o que é exclusivo do Portal (logo, gradiente, filete).
 */
import { C } from "@/lib/constants";
import {
  FONTE_TITULO, FONTE_CORPO,
  RAIO_2XL, RAIO_3XL,
  SOMBRA_CARD, SOMBRA_SUAVE,
  botaoPrimario, botaoSecundario,
  inputPadrao, labelPadrao,
  cardAdminDestaque,
  containerModal, containerModalPerigo,
  overlayModal, badgeStatus,
} from "@/lib/estiloGlobal";

// Re-exporta tokens globais para que as telas do Portal importem só daqui
export {
  FONTE_TITULO, FONTE_CORPO,
  SOMBRA_CARD, SOMBRA_SUAVE,
  botaoPrimario, botaoSecundario,
  inputPadrao, labelPadrao,
  containerModal, containerModalPerigo,
  overlayModal, badgeStatus,
};
// cardAdminDestaque vira "cardDestaque" no vocabulário do Portal
export { cardAdminDestaque as cardDestaque };

// ─── EXCLUSIVOS DO PORTAL ─────────────────────────────────────────────────────

/** Tamanho da logo nas telas de autenticação em tela cheia */
export const LOGO_ALTURA = 124;

/** Tamanho da logo no cabeçalho fixo do dashboard */
export const LOGO_ALTURA_HEADER = 48;

/** Gradiente ardósia premium — hero do dashboard e telas de auth */
export const GRADIENTE_SLATE = `linear-gradient(135deg, ${C.sidebarBg} 0%, #1E252F 100%)`;

/** Cartão "flutuante" das telas de autenticação (seleção de salão, login, cadastro) */
export const cardPremium = {
  background: C.bgCard,
  borderRadius: RAIO_3XL,
  border: `1px solid ${C.border}`,
  boxShadow: SOMBRA_CARD,
};

/** Cartão de conteúdo interno do dashboard */
export const cardConteudo = {
  background: C.bgCard,
  borderRadius: RAIO_2XL,
  border: `1px solid ${C.border}`,
  boxShadow: SOMBRA_SUAVE,
};

/** Eyebrow: rótulo dourado em caixa alta acima dos títulos */
export const eyebrow = {
  fontFamily: FONTE_TITULO,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "1.6px",
  textTransform: "uppercase" as const,
  color: C.douradoEleva,
};

/** Filete dourado decorativo sob a logo */
export const fileteDourado = {
  width: 56,
  height: 3,
  margin: "20px auto 0",
  borderRadius: 3,
  background: `linear-gradient(90deg, transparent, ${C.douradoEleva}, transparent)`,
};

/** h1 das telas de autenticação */
export const tituloSecao = {
  fontFamily: FONTE_TITULO,
  margin: "10px 0 6px",
  fontSize: 24,
  fontWeight: 800,
  color: C.sidebarBg,
  letterSpacing: "-0.5px",
  textAlign: "center" as const,
};
