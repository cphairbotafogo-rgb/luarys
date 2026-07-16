'use client';

import { useState } from 'react';
import { C, brl } from '@/lib/constants';
import { RAIO_MD, RAIO_XL } from '@/lib/estiloGlobal';
import { useToast } from '@/components/Toast';
import { FiMessageCircle, FiSend, FiAlertTriangle, FiPlus, FiX } from 'react-icons/fi';
import { useCarteiraWhatsapp } from './useCarteiraWhatsapp';
import type { MeioPagamento, PacoteWhatsapp, NivelSaldo } from './tipos';

function CardSaldo({
  titulo, icone, saldo, nivel,
}: {
  titulo: string;
  icone: React.ReactNode;
  saldo: number;
  nivel: NivelSaldo | null;
}) {
  const cor = nivel === 'zerado' ? '#B94A48' : nivel === 'baixo' ? '#C97B3D' : C.textMain;

  return (
    <div style={{ background: '#fff', borderRadius: RAIO_XL, padding: '16px 20px', border: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        {icone}
        <span style={{ fontSize: 11, color: C.textLight, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{titulo}</span>
      </div>
      <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: cor }}>{saldo.toLocaleString('pt-BR')}</p>
      {nivel === 'zerado' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <FiAlertTriangle size={12} color="#B94A48" />
          <span style={{ fontSize: 11, color: '#B94A48', fontWeight: 700 }}>Saldo esgotado</span>
        </div>
      )}
      {nivel === 'baixo' && (
        <span style={{ fontSize: 11, color: '#C97B3D', marginTop: 6, display: 'block' }}>Saldo baixo — considere recarregar</span>
      )}
    </div>
  );
}

/**
 * Painel de carteira de créditos WhatsApp (Plano A — Turnkey Pré-pago).
 * Exibir apenas quando whatsapp_config_plano.plano = 'turnkey_prepago'.
 */
export function PainelCarteiraWhatsapp() {
  const toast = useToast();
  const {
    saldo, pacotes, nivelAtendimento, nivelCampanha,
    carregando, comprando, erro, comprarPacote,
  } = useCarteiraWhatsapp();

  const [pacoteSelecionado, setPacoteSelecionado] = useState<PacoteWhatsapp | null>(null);
  const [mostrarLoja, setMostrarLoja] = useState(false);

  const pacotesAtendimento = pacotes.filter(p => p.tipo === 'atendimento');
  const pacotesCampanha    = pacotes.filter(p => p.tipo === 'campanha');

  async function confirmarCompra(meio: MeioPagamento) {
    if (!pacoteSelecionado) return;
    // TODO: GATEWAY DE PAGAMENTO NÃO CONECTADO
    // Esta função credita saldo direto na RPC sem confirmar pagamento real.
    // Antes de colocar no ar (produção/internet), integrar um gateway (ex: Mercado Pago, Stripe)
    // que confirme o PIX/cartão via webhook ANTES de chamar comprarPacote().
    // O banner amarelo abaixo avisa o usuário enquanto isso não estiver pronto.
    const ok = await comprarPacote(pacoteSelecionado.id, meio);
    if (ok) {
      setPacoteSelecionado(null);
      setMostrarLoja(false);
      toast.sucesso('Créditos adicionados com sucesso!');
    } else {
      toast.erro('Erro ao processar a compra. Tente novamente.');
    }
  }

  const labelSt: React.CSSProperties = {
    fontSize: 10, fontWeight: 800, color: C.textLight,
    textTransform: 'uppercase', letterSpacing: '0.5px',
    display: 'block', marginBottom: 8,
  };
  const btnSt = (cor: string, disabled?: boolean): React.CSSProperties => ({
    flex: 1, padding: '10px', borderRadius: RAIO_MD, border: 'none',
    background: disabled ? C.borderMid : cor, color: '#fff',
    fontSize: 12, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
  });

  if (carregando) {
    return (
      <div style={{ padding: 24, background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}` }}>
        <p style={{ color: C.textLight, fontSize: 13 }}>Carregando carteira...</p>
      </div>
    );
  }

  return (
    <div style={{ background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, padding: 24 }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FiMessageCircle size={18} color={C.sidebarBg} />
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.sidebarBg, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Créditos de WhatsApp
          </h3>
        </div>
        <button
          onClick={() => setMostrarLoja(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: mostrarLoja ? C.borderMid : C.sidebarBg, color: '#fff', border: 'none', borderRadius: RAIO_MD, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
        >
          {mostrarLoja ? <><FiX size={12} /> Fechar</> : <><FiPlus size={12} /> Comprar créditos</>}
        </button>
      </div>

      {/* Aviso: gateway de pagamento não configurado para produção */}
      <div style={{
        background: '#FEF9C3', border: '1px solid #CA8A04', borderRadius: RAIO_MD,
        padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-start',
      }}>
        <FiAlertTriangle size={14} color="#CA8A04" style={{ marginTop: 2, flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: 12, color: '#78350F', lineHeight: 1.5 }}>
          <strong>Ambiente de teste:</strong> compras ainda não estão conectadas a um gateway de pagamento real.
          Antes de colocar no ar, integre Mercado Pago ou Stripe para confirmar PIX/cartão via webhook.
        </p>
      </div>

      {erro && (
        <p style={{ fontSize: 12, color: '#B94A48', marginBottom: 12 }}>{erro}</p>
      )}

      {/* Saldos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <CardSaldo
          titulo="Atendimento (24h)"
          icone={<FiMessageCircle size={13} color={C.textMuted} />}
          saldo={saldo?.saldoAtendimento ?? 0}
          nivel={nivelAtendimento}
        />
        <CardSaldo
          titulo="Campanhas"
          icone={<FiSend size={13} color="#D4AF37" />}
          saldo={saldo?.saldoCampanha ?? 0}
          nivel={nivelCampanha}
        />
      </div>

      <p style={{ margin: '0 0 4px', fontSize: 11, color: C.textLight, lineHeight: 1.6 }}>
        Cada mensagem dentro da janela de 24h usa 1 crédito de atendimento. Campanhas usam créditos de campanha. Sem mensalidade — recarregue quando precisar.
      </p>

      {/* Loja de pacotes */}
      {mostrarLoja && (
        <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${C.borderMid}` }}>

          <label style={labelSt}>Pacotes de Atendimento</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
            {pacotesAtendimento.map(p => (
              <button
                key={p.id}
                onClick={() => setPacoteSelecionado(p)}
                style={{
                  padding: '12px', borderRadius: RAIO_MD, cursor: 'pointer', textAlign: 'left',
                  background: '#fff',
                  border: pacoteSelecionado?.id === p.id ? `2px solid ${C.sidebarBg}` : `1px solid ${C.borderMid}`,
                }}
              >
                <p style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 800, color: C.sidebarBg }}>{p.quantidade.toLocaleString('pt-BR')}</p>
                <p style={{ margin: 0, fontSize: 11, color: C.textMuted }}>{brl(p.preco)}</p>
              </button>
            ))}
          </div>

          <label style={labelSt}>Pacotes de Campanha</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
            {pacotesCampanha.map(p => (
              <button
                key={p.id}
                onClick={() => setPacoteSelecionado(p)}
                style={{
                  padding: '12px', borderRadius: RAIO_MD, cursor: 'pointer', textAlign: 'left',
                  background: '#fff',
                  border: pacoteSelecionado?.id === p.id ? `2px solid ${C.sidebarBg}` : `1px solid ${C.borderMid}`,
                }}
              >
                <p style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 800, color: C.sidebarBg }}>{p.quantidade.toLocaleString('pt-BR')}</p>
                <p style={{ margin: 0, fontSize: 11, color: C.textMuted }}>{brl(p.preco)}</p>
              </button>
            ))}
          </div>

          {pacoteSelecionado && (
            <div style={{ background: C.bg, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_XL, padding: 16 }}>
              <p style={{ margin: '0 0 10px', fontSize: 12, color: C.textMuted }}>
                Pagar <strong style={{ color: C.textMain }}>{brl(pacoteSelecionado.preco)}</strong> via:
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button disabled={comprando} onClick={() => confirmarCompra('pix')} style={btnSt('#15803D', comprando)}>
                  PIX
                </button>
                <button disabled={comprando} onClick={() => confirmarCompra('cartao_credito')} style={btnSt(C.sidebarBg, comprando)}>
                  Cartão de crédito
                </button>
              </div>
              {comprando && <p style={{ margin: '8px 0 0', fontSize: 11, color: C.textLight }}>Processando...</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
