'use client'
/**
 * src/modules/GavetaNFCe.tsx — orquestrador NFC-e.
 * Lógica e tipos em nfce/tipos.ts
 * Sub-componentes: nfce/AbaEmitirNFCe · nfce/PainelCertificado · nfce/AbaConfiguracoesFiscais
 */

import { useReducer, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { RAIO_MD } from "@/lib/estiloGlobal";
import { FiLoader } from "react-icons/fi";
import { useGuardModulo } from "@/lib/useGuardModulo";
import { BloqueioModulo } from "@/components/BloqueioModulo";
import { ESTADO0, reducer, API, S } from "./nfce/tipos";
import { AbaEmitirNFCe } from "./nfce/AbaEmitirNFCe";
import { AbaConfiguracoesFiscais } from "./nfce/AbaConfiguracoesFiscais";
import { PainelCertificado } from "./nfce/PainelCertificado";

export function SistemaNFCe({ perfil }: any) {
  const [state, dispatch] = useReducer(reducer, ESTADO0);
  const [bancoProdutos, setBancoProdutos] = useState<any[]>([]);
  const [tokenConfigurado, setTokenConfigurado] = useState<boolean | null>(null);
  const salaoId = perfil?.salao_id;
  const liberado = useGuardModulo(salaoId, 'nfce');

  useEffect(() => {
    if (!salaoId) return;

    // 1. Busca os Produtos do Estoque
    supabase.from("produtos").select("id, nome_produto, codigo_sku, ncm, preco_venda, cfop_padrao, csosn_padrao").eq("salao_id", salaoId)
      .then(({ data }) => data && setBancoProdutos(data));

    // 2. Busca a "Fonte da Verdade" (Matriz) para popular os campos bloqueados
    supabase.from("saloes").select("*").eq("id", salaoId).maybeSingle()
      .then(({ data }) => {
        if (data) {
          dispatch({
            type: "MATRIZ",
            p: {
              cnpj: data.cnpj || "",
              inscricao_estadual: data.inscricao_estadual || "",
              razao_social: data.razao_social || "",
              nome_fantasia: data.nome_fantasia || "",
              cep: data.cep || "",
              logradouro: data.logradouro || "",
              numero: data.numero || "",
              complemento: data.complemento || "",
              bairro: data.bairro || "",
              cidade: data.cidade || "",
              estado: data.estado || "",
              codigo_ibge: data.codigo_ibge || ""
            }
          });
          setTokenConfigurado(!!data.config_fiscal?.focus_nfe_token);
        }
      });

    // 3. Busca a Configuração Específica da NFC-e
    API.config.buscar(salaoId).then(({ data }) => {
      if (data) {
        dispatch({ type: "PATCH", p: { config: { ...ESTADO0.config, ...data }, certInfo: data.cert_info } });
      }
    });
  }, [salaoId]);

  const mostrarToast = (msg: string, tipo: string) => {
    dispatch({ type: "SET", k: "toast", v: { msg, tipo } });
    setTimeout(() => dispatch({ type: "SET", k: "toast", v: null }), 5000);
  };

  if (liberado === null) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, color: C.sidebarBg, fontWeight: 700, padding: 40 }}>
      <FiLoader className="animate-spin" size={18} /> A verificar acesso...
    </div>
  );

  if (!liberado) return (
    <BloqueioModulo
      salaoId={salaoId}
      moduloChave="pacote_fiscal"
      nome="Módulo Fiscal (NFS-e / NFC-e)"
      descricao="Emissão de notas fiscais de serviço e cupom fiscal eletrônico via provedor homologado pela SEFAZ."
      preco={79.90}
      itens={[
        'Notas Fiscais de Serviço (NFS-e) para serviços prestados',
        'Cupom Fiscal Eletrônico (NFC-e) para venda de produtos',
        'Integração com Focus NFe (homologado em todos os estados)',
        'Ambiente de homologação incluso para testes',
        'Até 500 documentos fiscais por mês',
      ]}
    />
  );

  return (
    <div className="font-body" style={{ padding: 32, background: C.bg, minHeight: "100vh", flex: 1 }}>
      
      {state.toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: state.toast.tipo === "erro" ? C.danger : C.success, color: "#fff", padding: "12px 24px", borderRadius: RAIO_MD, fontWeight: 600, fontSize: 13, zIndex: 9999, boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}>
          {state.toast.msg}
        </div>
      )}


      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h2 className="font-title uppercase tracking-widest" style={{ margin: 0, fontSize: 18, color: C.sidebarBg, fontWeight: 700 }}>Notas Fiscais de Consumidor (NFC-e)</h2>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: C.textMuted, fontWeight: 500 }}>
            Ambiente de Emissão: <span style={{ color: state.config?.ambiente === "2" ? "#D97706" : C.danger, fontWeight: 700 }}>{state.config?.ambiente === "2" ? "HOMOLOGAÇÃO (TESTES)" : "PRODUÇÃO REAL"}</span>
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, borderBottom: `1px solid ${C.borderMid}`, marginBottom: 24, overflowX: "auto" }}>
        {[
          ['emitir', 'Caixa (Nova Nota)'], 
          ['historico', 'Histórico de Cupons'], 
          ['config', 'Configuração Fiscal'], 
          ['cert', 'Certificado Digital']
        ].map(([k, l]) => (
          <button key={k} style={S.tab(state.aba === k)} onClick={() => dispatch({ type: "SET", k: "aba", v: k })}>{l}</button>
        ))}
      </div>

      {state.aba === "emitir" && (
        <AbaEmitirNFCe state={state} dispatch={dispatch} bancoProdutos={bancoProdutos} salaoId={salaoId} toast={mostrarToast} />
      )}

      {/* ─── ABA: CONFIGURAÇÕES FISCAIS (ESPELHADA E BLINDADA) ─── */}
      {state.aba === "config" && (
        <AbaConfiguracoesFiscais state={state} dispatch={dispatch} salaoId={salaoId} toast={mostrarToast} />
      )}

      {state.aba === "cert" && (
        <PainelCertificado state={state} dispatch={dispatch} salaoId={salaoId} toast={mostrarToast} />
      )}
    </div>
  );
}

