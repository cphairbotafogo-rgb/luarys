'use client'
/**
 * src/modules/configuracoes/migracao/componentes.tsx
 *
 * Prévia visual da planilha (imita Excel/CSV) — mostra como o arquivo
 * deveria ficar para cada módulo, complementando o Guia de Colunas em texto.
 */

import { C } from '@/lib/constants';
import { RAIO_2XL } from '@/lib/estiloGlobal';
import { FiFileText } from 'react-icons/fi';

const DADOS_PREVIA: Record<string, { colunas: string[]; linhas: string[][] }> = {
  clientes: {
    colunas: ['nome_completo', 'telefone_whatsapp', 'email', 'ultimo agendamento'],
    linhas: [
      ['João da Silva', '11999999999', 'joao@email.com', '10/06/2026'],
      ['Maria Oliveira', '21988887777', '', ''],
      ['Ana Souza', '21977776666', 'ana@email.com', '02/05/2026'],
    ],
  },
  servicos: {
    colunas: ['nome_servico', 'categoria', 'preco_padrao', 'duracao_minutos'],
    linhas: [
      ['Corte Masculino', 'Cabelo', '50.00', '30'],
      ['Manicure', 'Mãos e Pés', '35.00', '45'],
      ['Coloração', 'Cabelo', '120.00', '90'],
    ],
  },
  produtos: {
    colunas: ['nome_produto', 'codigo_sku', 'preco_venda', 'quantidade_estoque'],
    linhas: [
      ['Shampoo Reconstrutor', 'SHP-001', '89.90', '10'],
      ['Máscara Hidratante', '', '69.90', ''],
      ['Óleo Finalizador', 'OL-014', '54.90', '22'],
    ],
  },
};

export function PreviaPlanilha({ entidade }: { entidade: string }) {
  const dados = DADOS_PREVIA[entidade] || DADOS_PREVIA.clientes;
  const letrasColuna = ['A', 'B', 'C', 'D', 'E'];

  const tituloPorEntidade: Record<string, string> = {
    clientes: 'Base de Clientes',
    servicos: 'Catálogo de Serviços',
    produtos: 'Estoque de Produtos',
  };

  return (
    <div style={{ background: C.bgCard, borderRadius: RAIO_2XL, border: `1px solid ${C.border}`, overflow: 'hidden', flex: '1 1 360px', minWidth: 320, maxWidth: 420, alignSelf: 'flex-start' }}>
      <div style={{ padding: '14px 16px', background: C.bg, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <FiFileText size={16} color={C.textMuted} />
        <span style={{ fontSize: 12, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Como deve ficar — {tituloPorEntidade[entidade] || ''}
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          {/* Linha de letras de coluna, estilo Excel */}
          <thead>
            <tr>
              <th style={{ background: '#E2E8F0', border: `1px solid ${C.borderMid}`, padding: '4px 6px', width: 24, color: C.textLight, fontWeight: 600 }}></th>
              {dados.colunas.map((_, i) => (
                <th key={i} style={{ background: '#E2E8F0', border: `1px solid ${C.borderMid}`, padding: '4px 8px', color: C.textLight, fontWeight: 600, textAlign: 'center' }}>
                  {letrasColuna[i] || ''}
                </th>
              ))}
            </tr>
            {/* Linha 1 — nomes reais das colunas, como ficaria a primeira linha do CSV */}
            <tr>
              <th style={{ background: '#E2E8F0', border: `1px solid ${C.borderMid}`, padding: '4px 6px', color: C.textLight, fontWeight: 600, textAlign: 'center' }}>1</th>
              {dados.colunas.map((col, i) => (
                <th key={i} style={{ background: '#FFFBEB', border: `1px solid ${C.borderMid}`, padding: '6px 8px', color: '#92400E', fontWeight: 800, textAlign: 'left', whiteSpace: 'nowrap' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dados.linhas.map((linha, li) => (
              <tr key={li}>
                <td style={{ background: '#E2E8F0', border: `1px solid ${C.borderMid}`, padding: '4px 6px', color: C.textLight, fontWeight: 600, textAlign: 'center' }}>{li + 2}</td>
                {linha.map((valor, ci) => (
                  <td key={ci} style={{ background: li % 2 === 0 ? '#fff' : '#F8FAFC', border: `1px solid ${C.border}`, padding: '6px 8px', color: valor ? C.textMain : C.textLight, fontStyle: valor ? 'normal' : 'italic', whiteSpace: 'nowrap' }}>
                    {valor || 'vazio'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ padding: '10px 16px', fontSize: 11, color: C.textLight, lineHeight: 1.5 }}>
        A <strong>linha 1</strong> (em amarelo) é o cabeçalho — os nomes exatos das colunas. As demais linhas são os dados, um cliente/serviço/produto por linha. Células em branco (itálico "vazio" aqui) podem ficar realmente vazias no seu arquivo.
      </div>
    </div>
  );
}
