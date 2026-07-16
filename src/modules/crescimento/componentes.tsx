'use client'
/**
 * src/modules/crescimento/componentes.tsx
 *
 * Componentes pequenos reutilizados pelos painéis do Luarys Cresce.
 */

import { useState } from 'react';
import { C } from '@/lib/constants';
import { RAIO_SM, RAIO_MD, RAIO_XL } from '@/lib/estiloGlobal';
import { FiSend, FiLock } from 'react-icons/fi';

// ─── CARD DE MÉTRICA (clicável) ───────────────────────────────────────────────

export function CardMetrica({ valor, label, sublabel, bg, cor, icone, ativo, onClick }: {
  valor: number | string; label: string; sublabel?: string;
  bg: string; cor: string; icone: React.ReactNode;
  ativo?: boolean; onClick?: () => void;
}) {
  const ehBotao = !!onClick;
  return (
    <div
      onClick={onClick}
      role={ehBotao ? 'button' : undefined}
      style={{
        background: ehBotao && ativo ? cor : bg,
        borderRadius: RAIO_XL,
        padding: '16px 18px',
        border: `2px solid ${ehBotao && ativo ? cor : C.border}`,
        display: 'flex', flexDirection: 'column', gap: 4,
        cursor: ehBotao ? 'pointer' : 'default',
        transition: 'all 0.15s',
        transform: ehBotao && ativo ? 'translateY(-1px)' : 'none',
        boxShadow: ehBotao && ativo ? `0 4px 12px ${cor}33` : 'none',
      }}
    >
      <span style={{ color: ehBotao && ativo ? '#fff' : cor, opacity: ehBotao && ativo ? 1 : 0.85 }}>{icone}</span>
      <p style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 800, color: ehBotao && ativo ? '#fff' : cor, lineHeight: 1 }}>{valor}</p>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: ehBotao && ativo ? 'rgba(255,255,255,0.9)' : cor }}>{label}</p>
      {sublabel && <p style={{ margin: 0, fontSize: 10, color: ehBotao && ativo ? 'rgba(255,255,255,0.7)' : cor, opacity: 0.7 }}>{sublabel}</p>}
    </div>
  );
}

// ─── BOTÃO WHATSAPP COMPACTO (ao lado do nome) ────────────────────────────────

export function BotaoWhatsappIcone({ aceitaCampanhas, aceitaMarketing = true, onEnviar, enviado }: {
  aceitaCampanhas: boolean; aceitaMarketing?: boolean; onEnviar: () => void; enviado?: boolean;
}) {
  if (enviado) {
    return <span style={{ fontSize: 10, color: C.success, fontWeight: 700, whiteSpace: 'nowrap' }}>✓ Enviado</span>;
  }
  // Opt-out do próprio cliente — bloqueio LGPD, não pode enviar marketing
  if (!aceitaMarketing) {
    return (
      <span
        title="Cliente optou por não receber marketing (LGPD)"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 26, height: 26, borderRadius: '50%', border: '1px solid #FECACA',
          background: '#FEF2F2', color: '#EF4444', flexShrink: 0, cursor: 'default',
        }}
      >
        <FiSend size={12} />
      </span>
    );
  }
  if (!aceitaCampanhas) {
    return (
      <button
        onClick={e => { e.stopPropagation(); onEnviar(); }}
        title="Não optou por campanhas — clique para enviar mesmo assim"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 26, height: 26, borderRadius: '50%', border: '1px solid #D1D5DB',
          background: '#F9FAFB', color: '#9CA3AF', cursor: 'pointer', flexShrink: 0,
        }}
      >
        <FiSend size={12} />
      </button>
    );
  }
  return (
    <button
      onClick={e => { e.stopPropagation(); onEnviar(); }}
      title="Enviar mensagem pelo WhatsApp"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 26, height: 26, borderRadius: '50%', border: 'none',
        background: '#25D366', color: '#fff', cursor: 'pointer', flexShrink: 0,
      }}
    >
      <FiSend size={12} />
    </button>
  );
}

// ─── BOTÃO DE AÇÃO — ENVIAR WHATSAPP (versão full, mantido por compatibilidade) ─

export function BotaoAcaoWhatsapp({ aceitaCampanhas, onEnviar }: { aceitaCampanhas: boolean; onEnviar: () => void }) {
  if (!aceitaCampanhas) {
    return (
      <span
        title="Cliente não optou por receber campanhas (LGPD) — ação bloqueada"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.textLight, fontWeight: 600, cursor: 'not-allowed' }}
      >
        <FiLock size={12} /> Sem consentimento
      </span>
    );
  }
  return (
    <button
      onClick={onEnviar}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: RAIO_SM, border: 'none', background: '#25D366', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
    >
      <FiSend size={12} /> Enviar mensagem
    </button>
  );
}

// ─── BARRA DE PROGRESSO RELATIVA ──────────────────────────────────────────────

export function BarraRelativa({ percent, cor }: { percent: number; cor: string }) {
  const largura = Math.min(100, Math.max(2, percent));
  return (
    <div style={{ height: 6, background: C.border, borderRadius: RAIO_SM, overflow: 'hidden', width: 120 }}>
      <div style={{ height: '100%', width: `${largura}%`, background: cor, borderRadius: RAIO_SM, transition: 'width 0.4s ease' }} />
    </div>
  );
}

// ─── SELETOR DE PERÍODO (30 / 60 / 90 / Personalizado) ───────────────────────

export function SeletorPeriodo({ valor, onChange }: { valor: number; onChange: (v: number) => void }) {
  const fixos = [30, 60, 90];
  const isCustom = !fixos.includes(valor);
  const [inputCustom, setInputCustom] = useState(isCustom ? String(valor) : '');

  function aplicarCustom() {
    const n = parseInt(inputCustom, 10);
    if (n >= 1 && n <= 365) onChange(n);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', background: C.bg, borderRadius: RAIO_MD, padding: 3 }}>
        {fixos.map(v => (
          <button key={v} onClick={() => { onChange(v); setInputCustom(''); }}
            style={{
              padding: '6px 14px', borderRadius: RAIO_SM, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              background: valor === v ? '#fff' : 'transparent',
              color: valor === v ? C.sidebarBg : C.textMuted,
              boxShadow: valor === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}>
            {v} dias
          </button>
        ))}
        <button onClick={() => { setInputCustom(isCustom ? String(valor) : ''); if (!isCustom) onChange(0); }}
          style={{
            padding: '6px 14px', borderRadius: RAIO_SM, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer',
            background: isCustom ? '#fff' : 'transparent',
            color: isCustom ? C.sidebarBg : C.textMuted,
            boxShadow: isCustom ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}>
          Personalizado
        </button>
      </div>

      {(isCustom || inputCustom !== '') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="number" min={1} max={365}
            value={inputCustom}
            onChange={e => setInputCustom(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && aplicarCustom()}
            placeholder="dias"
            style={{
              width: 64, padding: '5px 8px', borderRadius: RAIO_SM,
              border: `1px solid ${C.borderMid}`, fontSize: 12, color: C.textMain,
              background: C.bgCard, outline: 'none',
            }}
          />
          <button onClick={aplicarCustom}
            style={{ padding: '5px 10px', borderRadius: RAIO_SM, border: 'none', background: C.sidebarBg, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            OK
          </button>
        </div>
      )}
    </div>
  );
}
