import { C } from '@/lib/constants';
import { RAIO_SM, RAIO_MD, RAIO_XL, SOMBRA_SUAVE } from '@/lib/estiloGlobal';

export const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];

export function fmtData(d: string) {
  if (!d) return '';
  return d.split('T')[0].split('-').reverse().join('/');
}

export function fmtNum(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function gerarCSV(cabecalho: string[], linhas: (string | number)[][], nomeArquivo: string) {
  const bom = '﻿';
  const linhasCsv = [
    cabecalho.join(';'),
    ...linhas.map(l => l.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'))
  ];
  const blob = new Blob([bom + linhasCsv.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const estiloCard = {
  background: C.bgCard,
  borderRadius: RAIO_XL,
  border: `1px solid ${C.border}`,
  padding: 24,
  boxShadow: SOMBRA_SUAVE,
};

export const estiloMetrica = (cor: string) => ({
  background: C.bgCard,
  border: `1px solid ${C.border}`,
  borderLeft: `4px solid ${cor}`,
  borderRadius: RAIO_MD,
  padding: '16px 20px',
});

export const estiloBtnCSV = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: RAIO_SM, border: `1px solid ${C.borderMid}`,
  background: C.bgCard, color: C.textMain, fontSize: 12, fontWeight: 600,
  cursor: 'pointer', transition: 'all 0.2s',
};

export const estiloBtnPDF = (loading: boolean) => ({
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: RAIO_SM, border: 'none',
  background: loading ? C.borderMid : C.sidebarBg,
  color: '#fff', fontSize: 12, fontWeight: 600,
  cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
});
