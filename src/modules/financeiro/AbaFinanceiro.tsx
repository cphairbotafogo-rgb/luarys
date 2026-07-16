// src/modules/financeiro/AbaFinanceiro.tsx
// Shell principal do módulo financeiro.
// Navegação entre abas, filtros de período e roteamento para sub-componentes.
'use client'
import React from 'react';
import { C } from '@/lib/constants';
import { RAIO_MD } from '@/lib/estiloGlobal';
import { InputData } from '@/components/InputData';
import { FiLayout, FiList, FiTrendingDown, FiCreditCard, FiPlus, FiLoader, FiPocket, FiHome, FiDownload } from 'react-icons/fi';
import { ExportacaoContabil }      from '@/modules/configuracoes/ExportacaoContabil';
import { ModalNovaDespesa }        from './modals/ModalNovaDespesa';
import { ModalDetalhesTransacao }  from './modals/ModalDetalhesTransacao';
import { CarteiraClientes }        from './CarteiraClientes';
import { AbaAluguel }              from './aluguel/AbaAluguel';
import { useAbaFinanceiro }        from './useAbaFinanceiro';
import { abaAtivaFromHash, AbaFinanceiroId } from './tipos';
import { AbaPainel }               from './AbaPainel';
import { AbaLancamentos }          from './AbaLancamentos';
import { AbaDespesas }             from './AbaDespesas';
import { AbaConciliacao }          from './AbaConciliacao';
import { ModalNovaTransacao }      from './ModalNovaTransacao';

// Componente de aba de navegação
function NavTab({ id, label, icon, abaAtiva, setAbaAtiva }: { id: string; label: string; icon: React.ReactNode; abaAtiva: string; setAbaAtiva: (id: AbaFinanceiroId) => void }) {
  return (
    <a
      href={`#financeiro?aba=${id}`}
      onClick={e => {
        if (!e.ctrlKey && !e.metaKey && e.button === 0) {
          e.preventDefault();
          setAbaAtiva(id as AbaFinanceiroId);
          window.history.pushState(null, '', `#financeiro?aba=${id}`);
        }
      }}
      className="font-title uppercase tracking-widest"
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '16px 20px', border: 'none', background: 'transparent',
        color: abaAtiva === id ? C.sidebarBg : C.textLight,
        borderBottom: abaAtiva === id ? `2px solid ${C.sidebarBg}` : '2px solid transparent',
        fontWeight: 700, fontSize: 11, cursor: 'pointer', transition: '0.2s', whiteSpace: 'nowrap',
        textDecoration: 'none',
      }}
    >
      <span style={{ fontSize: 14, display: 'flex' }}>{icon}</span> {label}
    </a>
  );
}

export function AbaFinanceiro({ perfil }: any) {
  const [abaAtiva, setAbaAtiva] = React.useState<AbaFinanceiroId>(abaAtivaFromHash());
  const fin = useAbaFinanceiro(perfil);

  if (fin.carregando && fin.transacoes.length === 0) return (
    <div className="flex h-full w-full items-center justify-center font-title uppercase tracking-widest font-bold text-sm" style={{ color: C.textLight, gap: 12 }}>
      <FiLoader className="animate-spin" size={18} /> A carregar cofres...
    </div>
  );

  const navProps = { abaAtiva, setAbaAtiva };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Cabeçalho com filtros de período e botão novo lançamento ───────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 32px 0', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <InputData value={fin.dataInicio} onChange={fin.setDataInicio}
            style={{ padding: '8px 12px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 13, color: C.textMain, background: C.bgCard }} />
          <span style={{ fontSize: 12, color: C.textMuted }}>até</span>
          <InputData value={fin.dataFim} min={fin.dataInicio} onChange={fin.setDataFim}
            style={{ padding: '8px 12px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 13, color: C.textMain, background: C.bgCard }} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => fin.setModalDespesaAberto(true)}
            style={{ background: C.bgCard, color: C.textMuted, border: `1px solid ${C.borderMid}`, padding: '10px 18px', borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase' }}>
            <FiPlus size={16} /> Nova Despesa
          </button>
          <button onClick={() => fin.setModalNovaTransacao(true)}
            style={{ background: C.sidebarBg, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase' }}>
            <FiPlus size={16} /> Novo Lançamento
          </button>
        </div>
      </div>

      {/* ── Barra de navegação entre abas ──────────────────────────────────── */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, overflowX: 'auto', padding: '0 32px' }}>
        <NavTab id="painel"       label="Dashboard"                icon={<FiLayout />}      {...navProps} />
        <NavTab id="lancamentos"  label="Livro Caixa (Auditoria)"  icon={<FiList />}        {...navProps} />
        <NavTab id="despesas"     label="Despesas (Fixas x Variáveis)" icon={<FiTrendingDown />} {...navProps} />
        <NavTab id="conciliacao"  label="Conciliação de Cartões"   icon={<FiCreditCard />}  {...navProps} />
        <NavTab id="carteiras"    label="Carteiras de Clientes"    icon={<FiPocket />}      {...navProps} />
        <NavTab id="aluguel"      label="Aluguel de Estações"      icon={<FiHome />}        {...navProps} />
        <NavTab id="exportacao"   label="Exportação Contábil"      icon={<FiDownload />}    {...navProps} />
      </div>

      {/* ── Conteúdo da aba ────────────────────────────────────────────────── */}
      <div style={{ padding: 32, flex: 1, overflowY: 'auto' }}>

        {abaAtiva === 'carteiras' && <CarteiraClientes perfil={perfil} />}
        {abaAtiva === 'aluguel'   && <AbaAluguel perfil={perfil} />}

        {abaAtiva === 'painel' && (
          <AbaPainel
            entradas={fin.entradas}
            saidas={fin.saidas}
            totalEntradas={fin.totalEntradas}
            totalSaidas={fin.totalSaidas}
            totalSaidasPagas={fin.totalSaidasPagas}
            totalSaidasPendentes={fin.totalSaidasPendentes}
            saldo={fin.saldo}
            totaisPix={fin.totaisPix}
            totaisCartao={fin.totaisCartao}
            totaisDinheiro={fin.totaisDinheiro}
            despesasPorCategoria={fin.despesasPorCategoria}
            expandirReceitas={fin.expandirReceitas}
            setExpandirReceitas={fin.setExpandirReceitas}
            expandirDespesas={fin.expandirDespesas}
            setExpandirDespesas={fin.setExpandirDespesas}
            onSelecionarTransacao={fin.setTransacaoSelecionada}
          />
        )}

        {abaAtiva === 'lancamentos' && (
          <AbaLancamentos
            transacoes={fin.transacoes}
            onSelecionarTransacao={fin.setTransacaoSelecionada}
          />
        )}

        {abaAtiva === 'despesas' && (
          <AbaDespesas
            saidas={fin.saidas}
            onSelecionarTransacao={fin.setTransacaoSelecionada}
          />
        )}

        {abaAtiva === 'conciliacao' && (
          <AbaConciliacao transacoes={fin.transacoes} perfil={perfil} />
        )}

        {abaAtiva === 'exportacao' && (
          <ExportacaoContabil perfil={perfil} />
        )}
      </div>

      {/* ── Modais ─────────────────────────────────────────────────────────── */}
      {fin.transacaoSelecionada && (
        <ModalDetalhesTransacao
          transacao={fin.transacaoSelecionada}
          perfil={perfil}
          onClose={() => fin.setTransacaoSelecionada(null)}
          aoAtualizar={() => { fin.carregarFinanceiro(); fin.setTransacaoSelecionada(null); }}
        />
      )}

      {fin.modalDespesaAberto && (
        <ModalNovaDespesa
          perfil={perfil}
          onClose={() => fin.setModalDespesaAberto(false)}
          aoSalvar={() => fin.carregarFinanceiro()}
        />
      )}

      {fin.modalNovaTransacao && (
        <ModalNovaTransacao
          form={fin.form}
          setForm={fin.setForm}
          profissionais={fin.profissionais}
          fornecedores={fin.fornecedores}
          onSubmit={fin.salvarTransacao}
          onFechar={() => fin.setModalNovaTransacao(false)}
          sugerirTipoCusto={fin.sugerirTipoCusto}
        />
      )}
    </div>
  );
}
