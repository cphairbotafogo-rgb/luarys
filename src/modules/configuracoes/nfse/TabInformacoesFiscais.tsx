'use client'
import { C } from '@/lib/constants';
import { RAIO_MD, RAIO_XL } from '@/lib/estiloGlobal';
import { FiExternalLink } from 'react-icons/fi';
import { NBS_BELEZA, LC116_BELEZA } from './tipos';

export function TabInformacoesFiscais({ perfil }: { perfil: any }) {
  const lbl: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: C.textLight,
    textTransform: 'uppercase', letterSpacing: '0.4px',
  };

  const Tabela = ({ dados, colunaA, colunaB }: { dados: { [k: string]: string }[]; colunaA: string; colunaB: string }) => (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ background: C.bg }}>
          <th style={{ padding: '10px 16px', textAlign: 'left', ...lbl, borderBottom: `1px solid ${C.border}` }}>{colunaA}</th>
          <th style={{ padding: '10px 16px', textAlign: 'left', ...lbl, borderBottom: `1px solid ${C.border}` }}>{colunaB}</th>
        </tr>
      </thead>
      <tbody>
        {dados.map((row, i) => {
          const [chave, valor] = Object.values(row);
          return (
            <tr key={chave} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.bgCard : C.bg }}>
              <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: C.sidebarBg, whiteSpace: 'nowrap' }}>{chave}</td>
              <td style={{ padding: '12px 16px', fontSize: 13, color: C.textMain }}>{valor}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 780 }}>

      {/* NBS */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.sidebarBg }}>Códigos NBS — Nomenclatura Brasileira de Serviços</h3>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
              A NBS identifica o tipo de serviço na nota fiscal de exportação. Associe o código correto a cada serviço do seu catálogo.
            </p>
          </div>
          <button
            onClick={() => { window.location.hash = 'servicos'; }}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: C.sidebarBg, color: '#fff', border: 'none', borderRadius: RAIO_MD, fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            <FiExternalLink size={14} /> Preencher nos Serviços
          </button>
        </div>
        <Tabela
          dados={NBS_BELEZA.map(n => ({ codigo: n.codigo, descricao: n.descricao }))}
          colunaA="Código NBS"
          colunaB="Descrição do Serviço"
        />
      </div>

      {/* LC 116 */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 24 }}>
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.sidebarBg }}>Itens da Lista LC 116/2003 — ISS</h3>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
            O item da lista LC 116/2003 é exigido pela prefeitura para identificar o serviço tributado pelo ISS. Configure o item principal em <strong>Configurações da Nota</strong>.
          </p>
        </div>
        <Tabela
          dados={LC116_BELEZA.map(l => ({ item: l.item, descricao: l.descricao }))}
          colunaA="Item LC 116"
          colunaB="Descrição"
        />
      </div>

      {/* NOTA INFORMATIVA */}
      <div style={{ background: C.bg, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_XL, padding: '16px 20px' }}>
        <p style={{ margin: 0, fontSize: 12, color: C.textMuted, lineHeight: 1.7 }}>
          <strong style={{ color: C.textMain }}>Como associar o código NBS aos seus serviços:</strong> Acesse o catálogo de serviços → edite um serviço → preencha o campo <em>Código NBS</em>. O código será incluído automaticamente em cada nota emitida para aquele serviço.
        </p>
      </div>

    </div>
  );
}
