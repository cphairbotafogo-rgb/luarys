'use client'
/**
 * src/components/TelaTrialExpirado.tsx
 * Overlay de bloqueio total quando o trial expirou sem plano ativo.
 * Mostra os planos disponíveis e permite contratar diretamente.
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C, brl } from '@/lib/constants';
import { RAIO_MD, RAIO_XL, RAIO_2XL } from '@/lib/estiloGlobal';
import { FiCheckCircle, FiLoader, FiUsers, FiLock, FiLogOut } from 'react-icons/fi';
import { useToast } from '@/components/Toast';

interface Props {
  perfil: any;
}

export function TelaTrialExpirado({ perfil }: Props) {
  const toast = useToast();
  const [planos, setPlanos]         = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('planos')
      .select('chave, nome, descricao, limite_profissionais, preco_mensal, ordem')
      .eq('ativo', true)
      .order('ordem')
      .then(({ data }) => {
        if (data) setPlanos(data);
        setCarregando(false);
      });
  }, []);

  async function contratar(chave: string) {
    setProcessando(chave);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch('/api/assinatura/criar-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ salao_id: perfil.salao_id, modulo_chave: chave }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.sucesso) throw new Error(data.erro || 'Erro ao gerar checkout.');
      window.location.href = data.checkoutUrl;
    } catch (e: any) {
      toast.erro(e.message);
      setProcessando(null);
    }
  }

  async function sair() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(15, 23, 42, 0.97)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, overflowY: 'auto',
    }}>
      <div style={{ width: '100%', maxWidth: 720, margin: 'auto' }}>

        {/* Cabeçalho */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <FiLock size={28} color="#EF4444" />
          </div>
          <h1 style={{ margin: '0 0 12px', fontSize: 24, fontWeight: 800, color: '#fff' }}>
            Seu período de avaliação encerrou
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, maxWidth: 480, marginInline: 'auto' }}>
            Obrigado por experimentar o Luarys! Para continuar usando o sistema, escolha o plano que melhor combina com o seu negócio.
          </p>
        </div>

        {/* Planos */}
        {carregando ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', padding: 40 }}>
            <FiLoader className="animate-spin" size={24} style={{ marginBottom: 12 }} />
            <p style={{ margin: 0 }}>Carregando planos...</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(planos.length, 3)}, 1fr)`,
            gap: 16, marginBottom: 32,
          }}>
            {planos.map((plano, idx) => {
              const destaque = idx === 1 && planos.length >= 2; // destaque no plano do meio
              return (
                <div key={plano.chave} style={{
                  background: destaque ? C.sidebarBg : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${destaque ? C.douradoEleva : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: RAIO_XL, padding: 24,
                  display: 'flex', flexDirection: 'column', gap: 16,
                  position: 'relative',
                }}>
                  {destaque && (
                    <div style={{
                      position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                      background: C.douradoEleva, color: C.sidebarBg,
                      fontSize: 10, fontWeight: 800, padding: '3px 12px',
                      borderRadius: 99, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap',
                    }}>
                      Mais popular
                    </div>
                  )}

                  <div>
                    <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: '#fff' }}>
                      {plano.nome}
                    </h3>
                    {plano.descricao && (
                      <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                        {plano.descricao}
                      </p>
                    )}
                  </div>

                  <div>
                    <span style={{ fontSize: 28, fontWeight: 900, color: destaque ? C.douradoEleva : '#fff' }}>
                      {brl(plano.preco_mensal ?? 0)}
                    </span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginLeft: 4 }}>/mês</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
                    <FiUsers size={14} />
                    <span>
                      {plano.limite_profissionais
                        ? `Até ${plano.limite_profissionais} profissionais`
                        : 'Profissionais ilimitados'}
                    </span>
                  </div>

                  <button
                    onClick={() => contratar(plano.chave)}
                    disabled={!!processando}
                    style={{
                      marginTop: 'auto',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '13px 0', width: '100%',
                      background: destaque ? C.douradoEleva : 'rgba(255,255,255,0.1)',
                      color: destaque ? C.sidebarBg : '#fff',
                      border: 'none', borderRadius: RAIO_MD,
                      fontSize: 13, fontWeight: 700,
                      cursor: processando ? 'wait' : 'pointer',
                      opacity: processando && processando !== plano.chave ? 0.5 : 1,
                      transition: 'all 0.2s',
                    }}
                  >
                    {processando === plano.chave
                      ? <><FiLoader className="animate-spin" size={14} /> Aguarde...</>
                      : <><FiCheckCircle size={14} /> Contratar este plano</>
                    }
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Rodapé */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: '0 0 16px', fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
            Seus dados estão preservados e serão restaurados assim que você contratar um plano.
          </p>
          <button
            onClick={sair}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'none', border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.4)', borderRadius: RAIO_MD,
              padding: '8px 16px', fontSize: 12, cursor: 'pointer',
            }}
          >
            <FiLogOut size={13} /> Sair da conta
          </button>
        </div>

      </div>
    </div>
  );
}
