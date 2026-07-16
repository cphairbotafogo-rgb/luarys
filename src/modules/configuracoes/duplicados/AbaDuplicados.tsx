'use client'
/**
 * src/modules/configuracoes/duplicados/AbaDuplicados.tsx
 *
 * Tela "Verificar Duplicados" — escaneia clientes/serviços/produtos já
 * cadastrados e agrupa candidatos a duplicata, com ação de mesclar/ignorar
 * por par e também "Mesclar todos" em lote.
 */

import { C } from '@/lib/constants';
import { RAIO_SM, RAIO_MD, RAIO_LG } from '@/lib/estiloGlobal';
import { FiSearch, FiCheckCircle, FiAlertCircle, FiUsers, FiScissors, FiBox, FiZap, FiAlertTriangle } from 'react-icons/fi';
import { useDuplicados } from './useDuplicados';
import { CardGrupoCliente, CardGrupoItem, BarraProgressoMesclagem } from './componentes';

export function AbaDuplicados({ perfil }: any) {
  const {
    aba, setAba,
    carregando, executando, mensagem,
    jaEscaneado, escanear,
    gruposClientes, gruposServicos, gruposProdutos,
    mesclarClientes, mesclarServicosPar, mesclarProdutosPar,
    ignorarGrupoCliente, ignorarGrupoServico, ignorarGrupoProduto,
    mesclarTodos, mesclandoTudo, totalGruposPendentes, progresso,
    confirmacaoPendente, setConfirmacaoPendente,
  } = useDuplicados(perfil);

  if (!jaEscaneado) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <FiSearch size={32} color={C.textLight} style={{ marginBottom: 16, opacity: 0.5 }} />
        <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 20, maxWidth: 420, margin: '0 auto 20px' }}>
          Escaneia clientes, serviços e produtos já cadastrados e agrupa candidatos a duplicata — como o "mesclar contatos" do celular.
        </p>
        <button
          onClick={escanear}
          disabled={carregando}
          style={{ padding: '12px 28px', borderRadius: RAIO_LG, border: 'none', background: C.sidebarBg, color: '#fff', fontSize: 13, fontWeight: 700, cursor: carregando ? 'not-allowed' : 'pointer' }}
        >
          {carregando ? 'Escaneando...' : 'Escanear minha base'}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <span style={{ fontSize: 12, color: C.textMuted }}>
          {totalGruposPendentes === 0 ? 'Nenhuma duplicata encontrada. 🎉' : `${totalGruposPendentes} grupo(s) de possível duplicata encontrados.`}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          {totalGruposPendentes > 0 && !confirmacaoPendente && (
            <button onClick={() => setConfirmacaoPendente(true)} disabled={mesclandoTudo}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#fff', background: C.douradoEleva, border: 'none', borderRadius: RAIO_SM, padding: '7px 14px', cursor: 'pointer', fontWeight: 700 }}>
              <FiZap size={12} /> Mesclar todos
            </button>
          )}
          <button onClick={escanear} disabled={carregando || mesclandoTudo}
            style={{ fontSize: 11, color: C.sidebarBg, background: 'none', border: `1px solid ${C.borderMid}`, borderRadius: RAIO_SM, padding: '7px 12px', cursor: 'pointer', fontWeight: 700 }}>
            {carregando ? 'Escaneando...' : 'Reescanear'}
          </button>
        </div>
      </div>

      {/* Confirmação do "Mesclar todos" — ação irreversível, então pede 1 clique extra */}
      {confirmacaoPendente && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: RAIO_LG, padding: 16, marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <FiAlertTriangle size={18} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: '#92400E' }}>
              Isso vai mesclar {totalGruposPendentes} grupo(s) automaticamente — ação irreversível.
            </p>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: '#92400E' }}>
              Em cada grupo, o registro com mais histórico de uso é mantido; os outros são mesclados nele (histórico, comissões e estoque transferidos) e depois removidos.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={mesclarTodos} disabled={mesclandoTudo}
                style={{ padding: '8px 16px', borderRadius: RAIO_SM, border: 'none', background: C.danger, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {mesclandoTudo ? 'Mesclando...' : 'Sim, mesclar tudo agora'}
              </button>
              <button onClick={() => setConfirmacaoPendente(false)} disabled={mesclandoTudo}
                style={{ padding: '8px 16px', borderRadius: RAIO_SM, border: `1px solid ${C.borderMid}`, background: C.bgCard, color: C.textMuted, fontSize: 12, cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {mesclandoTudo && (
        <BarraProgressoMesclagem atual={progresso.atual} total={progresso.total} nomeAtual={progresso.nomeAtual} />
      )}

      {mensagem.texto && (
        <div style={{ padding: 12, borderRadius: RAIO_MD, marginBottom: 16, background: mensagem.tipo === 'sucesso' ? '#ECFDF5' : '#FEF2F2', border: `1px solid ${mensagem.tipo === 'sucesso' ? C.success : C.danger}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          {mensagem.tipo === 'sucesso' ? <FiCheckCircle color={C.success} size={16} /> : <FiAlertCircle color={C.danger} size={16} />}
          <span style={{ fontSize: 12, fontWeight: 600, color: mensagem.tipo === 'sucesso' ? C.success : C.danger }}>{mensagem.texto}</span>
        </div>
      )}

      {/* Sub-abas por tipo de entidade */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {([
          ['clientes', 'Clientes', gruposClientes.length, FiUsers],
          ['servicos', 'Serviços', gruposServicos.length, FiScissors],
          ['produtos', 'Produtos', gruposProdutos.length, FiBox],
        ] as const).map(([id, label, qtd, Icone]) => (
          <button key={id} onClick={() => setAba(id)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: RAIO_MD, border: `1px solid ${aba === id ? C.sidebarBg : C.borderMid}`,
              background: aba === id ? C.sidebarBg : '#fff', color: aba === id ? '#fff' : C.textMuted, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            <Icone size={13} /> {label} {qtd > 0 && `(${qtd})`}
          </button>
        ))}
      </div>

      {aba === 'clientes' && (
        gruposClientes.length === 0
          ? <p style={{ fontSize: 12, color: C.textLight, fontStyle: 'italic', textAlign: 'center', padding: 24 }}>Nenhuma duplicata de cliente encontrada.</p>
          : gruposClientes.map((g, idx) => (
              <CardGrupoCliente key={idx} motivo={g.motivo} confianca={g.confianca} registros={g.registros} executando={executando}
                onMesclar={mesclarClientes} onIgnorar={() => ignorarGrupoCliente(idx)} />
            ))
      )}

      {aba === 'servicos' && (
        gruposServicos.length === 0
          ? <p style={{ fontSize: 12, color: C.textLight, fontStyle: 'italic', textAlign: 'center', padding: 24 }}>Nenhuma duplicata de serviço encontrada.</p>
          : gruposServicos.map((g, idx) => (
              <CardGrupoItem key={idx} motivo={g.motivo} confianca={g.confianca} registros={g.registros} executando={executando}
                onMesclar={mesclarServicosPar} onIgnorar={() => ignorarGrupoServico(idx)} />
            ))
      )}

      {aba === 'produtos' && (
        gruposProdutos.length === 0
          ? <p style={{ fontSize: 12, color: C.textLight, fontStyle: 'italic', textAlign: 'center', padding: 24 }}>Nenhuma duplicata de produto encontrada.</p>
          : gruposProdutos.map((g, idx) => (
              <CardGrupoItem key={idx} motivo={g.motivo} confianca={g.confianca} registros={g.registros} executando={executando}
                onMesclar={mesclarProdutosPar} onIgnorar={() => ignorarGrupoProduto(idx)} />
            ))
      )}
    </div>
  );
}
