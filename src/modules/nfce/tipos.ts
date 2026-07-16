'use client'
/**
 * src/modules/nfce/tipos.ts
 * Constantes, tipos, reducer e API do sistema NFC-e.
 */

import { supabase } from '@/lib/supabase';
import { C } from '@/lib/constants';
import { cardAdmin, RAIO_MD, RAIO_XL } from '@/lib/estiloGlobal';

// ─── ENUMS SEFAZ ──────────────────────────────────────────────────────────────

export const ST = Object.freeze({
  RASCUNHO:     'RASCUNHO',
  PENDENTE:     'PENDENTE',
  PROCESSANDO:  'PROCESSANDO',
  AUTORIZADA:   'AUTORIZADA',
  REJEITADA:    'REJEITADA',
  DENEGADA:     'DENEGADA',
  CANCELADA:    'CANCELADA',
  INUTILIZADA:  'INUTILIZADA',
  CONTINGENCIA: 'CONTINGENCIA',
});

export const CRT_OPCOES = [
  { cod: '1', label: '1 – Simples Nacional' },
  { cod: '4', label: '4 – MEI – Simples Nacional' },
  { cod: '3', label: '3 – Regime Normal (Lucro Real/Presumido)' },
];

export const FORMAS_PAG: Record<string, string> = {
  '01': 'Dinheiro', '03': 'Cartão Crédito', '04': 'Cartão Débito',
  '17': 'PIX', '99': 'Outros',
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

export const ptBR = (n: number | string, dec = 2) =>
  Number(n).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

export const moedaParaFloat = (v: string | number) =>
  parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0;

export async function getAuthToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || '';
}

// ─── ESTADO INICIAL ───────────────────────────────────────────────────────────

export const novoItem = () => ({
  _uid: crypto.randomUUID(),
  produto_id: '', cProd: '', xProd: '', NCM: '', CFOP: '5102',
  uCom: 'UN', qCom: '1', vUnCom: '0,00', vProd: '0,00', orig: '0', CSOSN: '102',
});

export const novoPag = () => ({ _uid: crypto.randomUUID(), tPag: '17', vPag: '' });

export const ESTADO0 = {
  aba: 'config',
  loading: false,
  toast: null as any,
  modal: null as any,
  dadosMatriz: {
    cnpj: '', inscricao_estadual: '', razao_social: '', nome_fantasia: '',
    cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', codigo_ibge: '',
  },
  config: {
    crt: '1', serie: '001', ambiente: '2', csc_token: '', csc_id: '',
    modo_emissao: 'Lote Manual',
  },
  itens: [novoItem()],
  consumidor: { CPF: '', xNome: '', email: '' },
  pagamentos: [novoPag()],
  vDesconto: '0,00',
  certArquivo: null as any, certNome: '', certSenha: '', certInfo: null as any,
};

// ─── REDUCER ──────────────────────────────────────────────────────────────────

export function reducer(state: typeof ESTADO0, action: any) {
  switch (action.type) {
    case 'SET':       return { ...state, [action.k]: action.v };
    case 'PATCH':     return { ...state, ...action.p };
    case 'MATRIZ':    return { ...state, dadosMatriz: { ...(state.dadosMatriz || {}), ...action.p } };
    case 'CFG':       return { ...state, config: { ...(state.config || {}), ...action.p } };
    case 'UPD_ITEM': {
      const itens = state.itens.map(it => {
        if (it._uid !== action.uid) return it;
        const upd = { ...it, ...action.p };
        const q = parseFloat(upd.qCom) || 0;
        const v = moedaParaFloat(upd.vUnCom);
        upd.vProd = ptBR(q * v);
        return upd;
      });
      return { ...state, itens };
    }
    case 'ADD_ITEM':  return { ...state, itens: [...state.itens, novoItem()] };
    case 'MODAL':     return { ...state, modal: action.p };
    default: return state;
  }
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const API = {
  emitir: async (body: any) => {
    const t = await getAuthToken();
    return fetch('/api/nfce/emitir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify(body),
    }).then(r => r.json());
  },
  config: {
    buscar: (salaoId: string) =>
      supabase.from('configuracoes_nfce_produtos').select('*').eq('salao_id', salaoId).maybeSingle(),
    salvar: (salaoId: string, dados: any) =>
      supabase.from('configuracoes_nfce_produtos').upsert({ salao_id: salaoId, ...dados }),
    uploadCertificado: async (arquivo: File, senha: string) => {
      const t = await getAuthToken();
      const fd = new FormData();
      fd.append('arquivo', arquivo);
      fd.append('senha', senha);
      return fetch('/api/nfce/upload-certificado', {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}` },
        body: fd,
      }).then(r => r.json());
    },
  },
};

// ─── ESTILOS COMPARTILHADOS ───────────────────────────────────────────────────

export const S = {
  card: { ...cardAdmin, padding: 24 },
  input: {
    padding: '12px 14px', border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD,
    fontSize: 13, width: '100%', boxSizing: 'border-box' as const, color: C.textMain,
    outlineColor: C.sidebarBg, background: C.bgCard,
    fontFamily: 'var(--font-body)', fontWeight: 500,
  },
  inputBloqueado: {
    padding: '12px 14px', border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD,
    fontSize: 13, width: '100%', boxSizing: 'border-box' as const, color: C.textLight,
    background: C.bg, cursor: 'not-allowed', fontFamily: 'var(--font-body)', fontWeight: 500,
  },
  label: {
    fontSize: 10, fontWeight: 700, color: C.textMuted, marginBottom: 6,
    display: 'flex', alignItems: 'center', gap: 4,
    textTransform: 'uppercase' as const, letterSpacing: '0.5px',
  },
  btn: (color = C.sidebarBg) => ({
    padding: '12px 20px', background: color, color: '#fff', border: 'none',
    borderRadius: RAIO_MD, fontWeight: 600, fontSize: 13, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-body)',
  }),
  tab: (ativa: boolean) => ({
    padding: '14px 20px', border: 'none', background: 'transparent',
    color: ativa ? C.sidebarBg : C.textLight,
    borderBottom: ativa ? `2px solid ${C.sidebarBg}` : '2px solid transparent',
    fontWeight: 700, fontSize: 11, cursor: 'pointer',
    fontFamily: 'var(--font-title)', textTransform: 'uppercase' as const, letterSpacing: '0.5px',
  }),
};
