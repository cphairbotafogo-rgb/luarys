'use client'
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/constants';
import { RAIO_MD, RAIO_XL, RAIO_2XL } from '@/lib/estiloGlobal';
import { useToast } from '@/components/Toast';
import { FiLock, FiCheckCircle, FiArrowRight, FiLoader } from 'react-icons/fi';

interface Props {
  salaoId: string;
  moduloChave: string;
  nome: string;
  descricao: string;
  preco: number;
  itens: string[];
}

export function BloqueioModulo({ salaoId, moduloChave, nome, descricao, preco, itens }: Props) {
  const [processando, setProcessando] = useState(false);
  const toast = useToast();

  async function contratar() {
    setProcessando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch('/api/assinatura/criar-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ salao_id: salaoId, modulo_chave: moduloChave }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.sucesso) throw new Error(data.erro || 'Erro ao gerar checkout.');
      window.location.href = data.checkoutUrl;
    } catch (e: any) {
      toast.erro(e.message);
      setProcessando(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
      <div style={{ maxWidth: 480, width: '100%', background: C.bgCard, borderRadius: RAIO_2XL, border: `1px solid ${C.border}`, overflow: 'hidden' }}>

        {/* Header escuro */}
        <div style={{ background: 'linear-gradient(135deg, #1e2d3d 0%, #2C3643 100%)', padding: '28px 32px' }}>
          <div style={{ width: 48, height: 48, borderRadius: RAIO_XL, background: 'rgba(212,175,55,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <FiLock size={22} color="#D4AF37" />
          </div>
          <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#fff' }}>{nome}</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>{descricao}</p>
        </div>

        {/* Body */}
        <div style={{ padding: '28px 32px' }}>
          <p style={{ margin: '0 0 14px', fontSize: 10, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            O que está incluído
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
            {itens.map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <FiCheckCircle size={15} color="#10B981" style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 13, color: C.textMain, lineHeight: 1.4 }}>{item}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 20 }}>
            <span style={{ fontSize: 30, fontWeight: 800, color: C.sidebarBg }}>
              R$ {preco.toFixed(2).replace('.', ',')}
            </span>
            <span style={{ fontSize: 13, color: C.textMuted }}>/mês</span>
          </div>

          <button
            onClick={contratar}
            disabled={processando}
            style={{
              width: '100%', padding: '14px 0', borderRadius: RAIO_MD, border: 'none',
              background: processando ? C.borderMid : C.sidebarBg,
              color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: processando ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              textTransform: 'uppercase', letterSpacing: '0.5px',
              transition: 'all 0.2s',
            }}
          >
            {processando
              ? <><FiLoader className="animate-spin" size={15} /> Aguarde...</>
              : <>Contratar Agora <FiArrowRight size={15} /></>
            }
          </button>

          <p style={{ margin: '12px 0 0', fontSize: 11, color: C.textLight, textAlign: 'center' }}>
            Cancele a qualquer momento. Sem fidelidade mínima.
          </p>
        </div>
      </div>
    </div>
  );
}
