'use client';

/**
 * PainelWhatsapp — ponto de entrada do módulo WhatsApp no painel do salão.
 * Detecta o plano ativo e exibe a tela correta:
 *   - Sem plano → seleção Plano A (bloqueado) vs Plano B
 *   - Plano B ativo → ConfigurarWhatsappPlanoB
 *   - Plano A ativo → PainelCarteiraWhatsapp
 *
 * Exibir na aba "Central de Comunicação" do painel do salão.
 */

import { useEffect, useState } from 'react';
import { C } from '@/lib/constants';
import { RAIO_MD, RAIO_XL } from '@/lib/estiloGlobal';
import { FiMessageSquare, FiLock, FiZap } from 'react-icons/fi';
import { supabase } from '@/lib/supabase';
import { ConfigurarWhatsappPlanoB } from './ConfigurarWhatsappPlanoB';
import { PainelCarteiraWhatsapp } from './PainelCarteiraWhatsapp';

type PlanoAtivo = 'gestao_meta' | 'turnkey_prepago' | null;

function CardPlano({
  titulo, descricao, preco, bloqueado, onEscolher, icon,
}: {
  titulo: string; descricao: string; preco: string;
  bloqueado?: boolean; onEscolher?: () => void; icon: React.ReactNode;
}) {
  return (
    <div style={{
      background: C.bgCard, borderRadius: RAIO_XL,
      border: `1px solid ${bloqueado ? C.border : C.sidebarBg}`,
      padding: 20, flex: 1, minWidth: 220,
      opacity: bloqueado ? 0.65 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ color: C.sidebarBg }}>{icon}</span>
        <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: C.textMain }}>{titulo}</h4>
        {bloqueado && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#FEF3C7', color: '#B45309', marginLeft: 'auto' }}>
            Aguardando Meta
          </span>
        )}
      </div>
      <p style={{ margin: '0 0 10px', fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>{descricao}</p>
      <p style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 800, color: C.sidebarBg }}>{preco}</p>
      <button
        onClick={onEscolher}
        disabled={bloqueado}
        style={{
          width: '100%', padding: '9px 0', borderRadius: RAIO_MD, border: 'none',
          background: bloqueado ? C.borderMid : C.sidebarBg,
          color: '#fff', fontSize: 12, fontWeight: 700,
          cursor: bloqueado ? 'not-allowed' : 'pointer',
        }}
      >
        {bloqueado ? <><FiLock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Indisponível</>
                   : 'Ativar este plano'}
      </button>
      {bloqueado && (
        <p style={{ margin: '8px 0 0', fontSize: 11, color: C.textLight, textAlign: 'center' }}>
          Requer aprovação da Luarys como Solution Partner Meta.
        </p>
      )}
    </div>
  );
}

export function PainelWhatsapp() {
  const [planoAtivo, setPlanoAtivo] = useState<PlanoAtivo | undefined>(undefined);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function detectar() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setPlanoAtivo(null); return; }

        const res = await fetch('/api/whatsapp/config-plano-b', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const config = await res.json();
          setPlanoAtivo(config?.plano ?? null);
        } else {
          setPlanoAtivo(null);
        }
      } catch {
        setPlanoAtivo(null);
      } finally {
        setCarregando(false);
      }
    }
    detectar();
  }, []);

  if (carregando) return (
    <div style={{ padding: 32, color: C.textLight, fontSize: 13 }}>Carregando...</div>
  );

  // ── Plano B ativo ──────────────────────────────────────────────────────────
  if (planoAtivo === 'gestao_meta') {
    return <ConfigurarWhatsappPlanoB />;
  }

  // ── Plano A ativo ──────────────────────────────────────────────────────────
  if (planoAtivo === 'turnkey_prepago') {
    return <PainelCarteiraWhatsapp />;
  }

  // ── Sem plano: tela de escolha ─────────────────────────────────────────────
  return (
    <div style={{ padding: 24, maxWidth: 680 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <FiMessageSquare size={18} color={C.sidebarBg} />
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.sidebarBg, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Ativar WhatsApp Business
        </h3>
      </div>
      <p style={{ margin: '0 0 24px', fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>
        Escolha como quer usar o WhatsApp no Luarys. Os dois planos são mutuamente exclusivos — escolha um para começar. Trocar de plano exige cancelar o atual primeiro.
      </p>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <CardPlano
          icon={<FiLock size={16} />}
          titulo="Plano A — Turnkey Pré-pago"
          descricao="Luarys gerencia a conta WhatsApp e você compra créditos antecipados (atendimento + campanha separados). Faturamento Meta consolidado na Luarys."
          preco="A partir de R$ 35,00 / pacote"
          bloqueado
        />

        <CardPlano
          icon={<FiZap size={16} />}
          titulo="Plano B — Gestão Meta"
          descricao="Você usa sua própria conta WhatsApp Business. A Meta te cobra diretamente. O Luarys cobra só a mensalidade de gestão (~R$ 29–49/mês)."
          preco="R$ 29–49 / mês"
          onEscolher={() => setPlanoAtivo('gestao_meta')}
        />
      </div>

      <p style={{ margin: '20px 0 0', fontSize: 11, color: C.textLight, lineHeight: 1.6 }}>
        <strong>Plano A</strong> está aguardando aprovação da Luarys como Solution Partner da Meta — processo burocrático com prazo indefinido.<br />
        <strong>Plano B</strong> funciona agora: você cria a conta na Meta e cola o token aqui.
      </p>
    </div>
  );
}
