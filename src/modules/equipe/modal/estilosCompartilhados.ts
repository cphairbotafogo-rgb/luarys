/**
 * src/modules/equipe/modal/estilosCompartilhados.ts
 *
 * Estilos reaproveitados por todas as abas do Modal de Colaborador
 * (Dados Gerais, Folha, Serviços, Horários, Contrato, Permissões).
 * Extraído de AbaEquipe.tsx na divisão para manter cada arquivo abaixo
 * de ~500 linhas, conforme o padrão de divisão de arquivos do Luarys.
 */
import { C } from "@/lib/constants";
import { RAIO_MD } from "@/lib/estiloGlobal";

export const inputStyle = { padding:"12px 14px", borderRadius:RAIO_MD, border:`1px solid ${C.borderMid}`, width:"100%", boxSizing:"border-box" as const, outlineColor:C.sidebarBg, fontSize: 13, color: C.textMain, backgroundColor: C.bgCard };
export const labelStyle = { margin:"0 0 6px", fontSize:11, fontWeight:700, color:C.textMuted, display:"block", textTransform: "uppercase" as const, letterSpacing: "0.5px" };
export const tabButtonStyle = (ativa: any) => ({ padding: "12px 18px", background: ativa ? C.sidebarBg : "transparent", color: ativa ? C.bgCard : C.textLight, border: "none", borderRadius: RAIO_MD, fontWeight: 700, fontSize: 11, cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap" as const, textTransform: "uppercase" as const });
export const switchStyle = (ativo: any) => ({ position: "relative" as const, display: "inline-block", width: 44, height: 22, cursor: "pointer", backgroundColor: ativo ? C.sidebarBg : C.borderMid, transition: ".3s", borderRadius: 20 });
export const switchCircleStyle = (ativo: any) => ({ position: "absolute" as const, height: 16, width: 16, left: ativo ? 25 : 3, bottom: 3, backgroundColor: C.bgCard, transition: ".3s", borderRadius: "50%" });
