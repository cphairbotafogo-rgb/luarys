'use client'
/**
 * src/app/recibo/[id]/page.tsx
 *
 * Rota dedicada para impressão do recibo de fechamento.
 * Acessível via: /recibo/[id-do-lançamento-financeiro]
 *
 * Vantagem vs window.open():
 *   - Não é bloqueado por bloqueadores de pop-up
 *   - URL permanente — pode ser salva, reenviada, arquivada
 *   - Abre numa aba normal do browser
 *   - CSS @media print controla o layout de impressão
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/constants';

function brl(v: number) {
  return v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? 'R$ 0,00';
}

export default function PaginaRecibo() {
  const params   = useParams();
  const id       = params?.id as string;
  const [dados,  setDados]    = useState<any>(null);
  const [salao,  setSalao]    = useState<any>(null);
  const [erro,   setErro]     = useState('');
  const [pronto, setPronto]   = useState(false);

  useEffect(() => {
    if (!id) return;
    async function carregar() {
      // Buscar o lançamento financeiro
      const { data: fin, error } = await supabase
        .from('financeiro')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !fin) {
        setErro('Recibo não encontrado ou sem permissão de acesso.');
        return;
      }

      setDados(fin);

      // Buscar dados do salão
      const { data: sl } = await supabase
        .from('saloes')
        .select('nome_fantasia, razao_social, cnpj, telefone, logradouro, numero, bairro, cidade, estado, cep, logo_url, site, instagram')
        .eq('id', fin.salao_id)
        .single();

      setSalao(sl);
      setPronto(true);
    }
    carregar();
  }, [id]);

  // Auto-print assim que carregar
  useEffect(() => {
    if (!pronto) return;
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, [pronto]);

  if (erro) return (
    <div style={{ fontFamily: 'sans-serif', textAlign: 'center', padding: 60, color: '#EF4444' }}>
      <h2>❌ {erro}</h2>
      <p>Verifique se você está logado e tem acesso a este salão.</p>
    </div>
  );

  if (!pronto) return (
    <div style={{ fontFamily: 'sans-serif', textAlign: 'center', padding: 60, color: '#64748B' }}>
      <p>Carregando recibo...</p>
    </div>
  );

  const dataFmt = dados.data_movimentacao
    ? new Date(dados.data_movimentacao).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

  const enderecoSalao = [
    salao?.logradouro,
    salao?.numero,
    salao?.bairro,
    salao?.cidade,
    salao?.estado,
  ].filter(Boolean).join(', ');

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', Courier, monospace; background: #fff; color: #000; }

        .recibo {
          max-width: 80mm;
          margin: 0 auto;
          padding: 16px 12px;
        }

        .center { text-align: center; }
        .bold   { font-weight: bold; }
        .small  { font-size: 10px; }
        .medium { font-size: 12px; }
        .large  { font-size: 16px; }

        .divider {
          border: none;
          border-top: 1px dashed #999;
          margin: 10px 0;
        }

        .row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 4px;
          font-size: 12px;
        }

        .row-bold {
          display: flex;
          justify-content: space-between;
          font-weight: bold;
          font-size: 14px;
          margin: 6px 0;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }
        th {
          border-bottom: 1px dashed #999;
          padding: 4px 0;
          text-align: left;
          font-size: 10px;
          text-transform: uppercase;
        }
        td { padding: 4px 0; vertical-align: top; }
        .right { text-align: right; }

        .logo-img {
          width: 60px;
          height: 60px;
          object-fit: contain;
          margin-bottom: 8px;
        }

        .badge-nao-fiscal {
          display: inline-block;
          border: 1px solid #000;
          padding: 3px 10px;
          font-size: 10px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 8px 0;
        }

        /* Tela — mostrar botão de imprimir */
        .btn-imprimir {
          display: block;
          margin: 24px auto;
          padding: 12px 32px;
          background: #1E293B;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
          font-family: sans-serif;
        }

        /* Impressão — esconder botão e ajustar margens */
        @media print {
          .btn-imprimir { display: none !important; }
          body { margin: 0; padding: 0; }
          .recibo { padding: 0; margin: 0; }
          @page { margin: 8mm; size: 80mm auto; }
        }
      `}</style>

      {/* Botão visível apenas na tela (some ao imprimir) */}
      <div className="center" style={{ fontFamily: 'sans-serif', padding: '16px 0', background: C.bg, borderBottom: '1px solid #E2E8F0' }}>
        <button className="btn-imprimir" onClick={() => window.print()}>
          🖨️ Imprimir Recibo
        </button>
      </div>

      <div className="recibo">

        {/* CABEÇALHO DO SALÃO */}
        <div className="center">
          {salao?.logo_url && (
            <img src={salao.logo_url} alt="Logo" className="logo-img" />
          )}
          <p className="bold large">{salao?.nome_fantasia || 'Salão'}</p>
          {salao?.razao_social && salao.razao_social !== salao.nome_fantasia && (
            <p className="small">{salao.razao_social}</p>
          )}
          {enderecoSalao && <p className="small">{enderecoSalao}</p>}
          {salao?.cep && <p className="small">CEP: {salao.cep}</p>}
          {salao?.cnpj && <p className="small">CNPJ: {salao.cnpj}</p>}
          {salao?.telefone && <p className="small">Tel: {salao.telefone}</p>}
          {salao?.site && <p className="small">{salao.site}</p>}
        </div>

        <hr className="divider" />

        <div className="center">
          <span className="badge-nao-fiscal">ESTE NÃO É UM CUPOM FISCAL</span>
        </div>

        <hr className="divider" />

        {/* DADOS DO ATENDIMENTO */}
        <p className="small bold">Data do atendimento:</p>
        <p className="small" style={{ marginBottom: 8 }}>{dataFmt}</p>

        <p className="small bold">Cliente:</p>
        <p className="small" style={{ marginBottom: 8 }}>{dados.cliente_nome || '—'}</p>

        {dados.profissional_nome && (
          <>
            <p className="small bold">Profissional:</p>
            <p className="small" style={{ marginBottom: 8 }}>{dados.profissional_nome}</p>
          </>
        )}

        <hr className="divider" />

        {/* SERVIÇOS/ITENS */}
        <table>
          <thead>
            <tr>
              <th>Descrição</th>
              <th className="right">Valor R$</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{dados.descricao?.replace('Fechamento de Conta - ', '') || dados.descricao}</td>
              <td className="right">{brl(dados.valor)}</td>
            </tr>
          </tbody>
        </table>

        <hr className="divider" />

        <div className="row-bold">
          <span>TOTAL R$</span>
          <span>{brl(dados.valor)}</span>
        </div>

        <hr className="divider" />

        {/* FORMAS DE PAGAMENTO */}
        <p className="small bold" style={{ marginBottom: 6 }}>Valores recebidos</p>

        <div className="row">
          <span>
            {dados.forma_pagamento || dados.metodo_pagamento || 'Não informado'}
            {dados.bandeira_cartao ? ` - ${dados.bandeira_cartao}` : ''}
          </span>
          <span>{brl(dados.valor)}</span>
        </div>

        <hr className="divider" />

        <div className="row">
          <span>Troco</span>
          <span>{brl(0)}</span>
        </div>

        <hr className="divider" />

        {/* RODAPÉ */}
        <div className="center small" style={{ marginTop: 20, lineHeight: 1.8 }}>
          <p className="bold">Obrigado pela preferência!</p>
          <p>Volte sempre.</p>
          <br />
          <p>—</p>
          <p>Gerado por <strong>Luarys</strong></p>
          {salao?.instagram && <p>📸 {salao.instagram}</p>}
        </div>

      </div>
    </>
  );
}