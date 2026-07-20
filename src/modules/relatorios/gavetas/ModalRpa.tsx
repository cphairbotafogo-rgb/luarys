'use client'

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { C, brl } from '@/lib/constants';
import { RAIO_MD, RAIO_XL } from '@/lib/estiloGlobal';
import { FiPrinter, FiX } from 'react-icons/fi';

const INSS_PERC = 0.11;
const MESES_EXT = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

function fmtCnpj(v: string) {
  const d = v.replace(/\D/g, '');
  if (d.length !== 14) return v;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}
function fmtCpf(v: string) {
  const d = v.replace(/\D/g, '');
  if (d.length !== 11) return v;
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
}

interface Props {
  profissionalNome: string;
  valorBruto: number;
  mes: number;
  ano: number;
  salaoId: string;
  onFechar: () => void;
}

export function ModalRpa({ profissionalNome, valorBruto, mes, ano, salaoId, onFechar }: Props) {
  const [cpfProf, setCpfProf]     = useState('');
  const [salaoNome, setSalaoNome] = useState('');
  const [salaoCnpj, setSalaoCnpj] = useState('');
  const [salaoEndereco, setSalaoEndereco] = useState('');
  const docRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function carregar() {
      const [resSalao, resProf] = await Promise.all([
        supabase.from('saloes')
          .select('nome_salao, cnpj, endereco')
          .eq('id', salaoId)
          .maybeSingle(),
        supabase.from('profissionais')
          .select('perfil_avancado')
          .eq('salao_id', salaoId)
          .eq('nome', profissionalNome.trim())
          .maybeSingle(),
      ]);
      if (resSalao.data) {
        setSalaoNome(resSalao.data.nome_salao || '');
        setSalaoCnpj(resSalao.data.cnpj || '');
        const end = resSalao.data.endereco;
        if (end) {
          const partes = [end.logradouro, end.numero, end.bairro, end.cidade, end.uf].filter(Boolean);
          setSalaoEndereco(partes.join(', '));
        }
      }
      if (resProf.data?.perfil_avancado?.cpf) {
        setCpfProf(resProf.data.perfil_avancado.cpf);
      }
    }
    carregar();
  }, [salaoId, profissionalNome]);

  const inssRetido   = Math.round(valorBruto * INSS_PERC * 100) / 100;
  const liquidoPagar = Math.round((valorBruto - inssRetido) * 100) / 100;
  const periodoExt   = `${MESES_EXT[mes - 1]} de ${ano}`;
  const dataHoje     = new Date().toLocaleDateString('pt-BR');

  function imprimir() {
    const conteudo = docRef.current?.innerHTML;
    if (!conteudo) return;
    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>RPA — ${profissionalNome}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 40px; }
          h1 { font-size: 17px; text-align: center; margin-bottom: 4px; }
          h2 { font-size: 13px; font-weight: 700; margin: 16px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
          p  { margin: 3px 0; line-height: 1.6; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          td, th { padding: 6px 8px; border: 1px solid #ddd; font-size: 13px; }
          th { background: #f5f5f5; font-weight: 700; text-align: left; }
          .total { font-size: 15px; font-weight: 800; }
          .assinaturas { display: flex; justify-content: space-between; margin-top: 60px; }
          .linha-ass { border-top: 1px solid #333; width: 240px; padding-top: 6px; text-align: center; font-size: 12px; }
          .subtitulo { font-size: 11px; text-align: center; color: #555; margin-bottom: 20px; }
          @media print { body { padding: 20mm; } }
        </style>
      </head>
      <body>${conteudo}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
  };

  return (
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onFechar(); }}>
      <div style={{ background: C.bgCard, borderRadius: RAIO_XL, width: 720, maxHeight: '90vh',
        overflow: 'auto', padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Cabeçalho do modal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.textMain }}>
            Gerar RPA — {profissionalNome}
          </h2>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted }}>
            <FiX size={20} />
          </button>
        </div>

        {/* Campo CPF editável */}
        <div style={{ background: C.bg, borderRadius: RAIO_MD, padding: '12px 16px', border: `1px solid ${C.border}` }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, display: 'block', marginBottom: 6 }}>
            CPF do profissional (edite se necessário)
          </label>
          <input value={cpfProf} onChange={e => setCpfProf(e.target.value)} placeholder="000.000.000-00"
            style={{ border: `1px solid ${C.border}`, borderRadius: RAIO_MD, padding: '8px 12px',
              fontSize: 14, color: C.textMain, background: C.bgCard, width: '100%' }} />
        </div>

        {/* Documento RPA */}
        <div ref={docRef} style={{ border: `1px solid ${C.border}`, borderRadius: RAIO_MD, padding: 28, background: '#fff', color: '#111' }}>

          <h1 style={{ fontSize: 17, textAlign: 'center', marginBottom: 4 }}>
            RECIBO DE PAGAMENTO A AUTÔNOMO
          </h1>
          <p style={{ textAlign: 'center', fontSize: 11, color: '#555', marginBottom: 20 }}>
            Competência: {periodoExt}
          </p>

          <h2 style={{ fontSize: 12, fontWeight: 700, borderBottom: '1px solid #ccc', paddingBottom: 4, marginBottom: 8, marginTop: 16 }}>
            CONTRATANTE (SALÃO)
          </h2>
          <p><strong>Razão Social / Nome:</strong> {salaoNome || '___________________________'}</p>
          <p><strong>CNPJ:</strong> {salaoCnpj ? fmtCnpj(salaoCnpj) : '___________________________'}</p>
          {salaoEndereco && <p><strong>Endereço:</strong> {salaoEndereco}</p>}

          <h2 style={{ fontSize: 12, fontWeight: 700, borderBottom: '1px solid #ccc', paddingBottom: 4, marginBottom: 8, marginTop: 16 }}>
            AUTÔNOMO (PROFISSIONAL PARCEIRO)
          </h2>
          <p><strong>Nome:</strong> {profissionalNome}</p>
          <p><strong>CPF:</strong> {cpfProf ? fmtCpf(cpfProf) : '___________________________'}</p>

          <h2 style={{ fontSize: 12, fontWeight: 700, borderBottom: '1px solid #ccc', paddingBottom: 4, marginBottom: 8, marginTop: 16 }}>
            DISCRIMINAÇÃO
          </h2>
          <p>
            Cota-parte referente a serviços prestados como profissional parceiro de salão de beleza
            nos termos da Lei 13.352/2016 — competência {periodoExt}.
          </p>

          <h2 style={{ fontSize: 12, fontWeight: 700, borderBottom: '1px solid #ccc', paddingBottom: 4, marginBottom: 8, marginTop: 16 }}>
            VALORES
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              <tr>
                <td style={{ padding: '6px 8px', border: '1px solid #ddd' }}>Valor Bruto da Cota-Parte</td>
                <td style={{ padding: '6px 8px', border: '1px solid #ddd', textAlign: 'right', fontWeight: 600 }}>{brl(valorBruto)}</td>
              </tr>
              <tr>
                <td style={{ padding: '6px 8px', border: '1px solid #ddd', color: '#B45309' }}>
                  (−) INSS Retido — 11% — GPS Código 2100
                </td>
                <td style={{ padding: '6px 8px', border: '1px solid #ddd', textAlign: 'right', color: '#B45309', fontWeight: 600 }}>
                  ({brl(inssRetido)})
                </td>
              </tr>
              <tr style={{ background: '#F0FDF4' }}>
                <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 700, fontSize: 14 }}>
                  Valor Líquido a Receber
                </td>
                <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right', fontWeight: 800, fontSize: 15, color: '#166534' }}>
                  {brl(liquidoPagar)}
                </td>
              </tr>
            </tbody>
          </table>

          <p style={{ fontSize: 11, color: '#666', marginTop: 10, lineHeight: 1.5 }}>
            O INSS retido ({brl(inssRetido)}) será recolhido pelo salão via GPS (Guia da Previdência Social)
            — código de pagamento 2100, vencimento dia 15 do mês seguinte à competência.
          </p>

          <h2 style={{ fontSize: 12, fontWeight: 700, borderBottom: '1px solid #ccc', paddingBottom: 4, marginBottom: 8, marginTop: 16 }}>
            DECLARAÇÃO
          </h2>
          <p style={{ fontSize: 12, lineHeight: 1.7 }}>
            Declaro que recebi do contratante acima a importância líquida de <strong>{brl(liquidoPagar)}</strong>,
            correspondente ao pagamento da minha cota-parte como profissional parceiro de salão de beleza
            na competência {periodoExt}, conforme Lei 13.352/2016.
          </p>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 60 }}>
            <div style={{ borderTop: '1px solid #333', width: 240, paddingTop: 6, textAlign: 'center', fontSize: 12 }}>
              {salaoNome || 'Salão'}<br />Contratante
            </div>
            <div style={{ textAlign: 'right', fontSize: 12, color: '#555' }}>
              Data: {dataHoje}
            </div>
            <div style={{ borderTop: '1px solid #333', width: 240, paddingTop: 6, textAlign: 'center', fontSize: 12 }}>
              {profissionalNome}<br />Profissional Autônomo
            </div>
          </div>
        </div>

        {/* Botão imprimir */}
        <button onClick={imprimir}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '12px 24px', borderRadius: RAIO_MD, background: C.sidebarBg,
            color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          <FiPrinter size={16} /> Imprimir / Salvar PDF
        </button>
      </div>
    </div>
  );
}
