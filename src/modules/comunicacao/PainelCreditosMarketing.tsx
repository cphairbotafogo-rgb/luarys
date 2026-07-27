'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { C, brl } from '@/lib/constants';
import { RAIO_MD, RAIO_XL } from '@/lib/estiloGlobal';
import { useToast } from '@/components/Toast';
import { FiSend, FiAlertTriangle, FiLock, FiPlus, FiX, FiLoader } from 'react-icons/fi';

const PACOTES = [
  { quantidade: 100,  preco: 55.00  },
  { quantidade: 200,  preco: 110.00 },
  { quantidade: 300,  preco: 165.00 },
  { quantidade: 500,  preco: 275.00 },
] as const;

type Pacote = typeof PACOTES[number];

interface Props {
  saldo: number | null;
  onCompraFinalizada: () => void;
}

export function PainelCreditosMarketing({ saldo, onCompraFinalizada }: Props) {
  const toast = useToast();

  // Mapeia quantidade → id do registro em whatsapp_pacotes (carregado uma vez)
  const [pacotesDb, setPacotesDb] = useState<Record<number, string>>({});
  const [selecionado, setSelecionado] = useState<Pacote | null>(null);
  const [mostrarLoja, setMostrarLoja] = useState(false);
  const [comprando, setComprando] = useState(false);
  const [tipoCompra, setTipoCompra] = useState<'unico' | 'assinatura'>('unico');

  useEffect(() => {
    supabase
      .from('whatsapp_pacotes')
      .select('id, quantidade')
      .eq('tipo', 'campanha')
      .eq('ativo', true)
      .then(({ data }) => {
        if (!data) return;
        const mapa: Record<number, string> = {};
        data.forEach((p: any) => { mapa[Number(p.quantidade)] = p.id; });
        setPacotesDb(mapa);
      });
  }, []);

  // Pagamento acontece em outra aba (checkout abre com window.open) — ao
  // voltar para esta, recarrega o saldo pra refletir a ativação feita pelo
  // webhook do Asaas.
  const onCompraFinalizadaRef = useRef(onCompraFinalizada);
  onCompraFinalizadaRef.current = onCompraFinalizada;
  useEffect(() => {
    function aoFocar() { onCompraFinalizadaRef.current(); }
    window.addEventListener('focus', aoFocar);
    return () => window.removeEventListener('focus', aoFocar);
  }, []);

  async function comprar(meio: 'pix' | 'cartao_credito') {
    if (!selecionado) return;
    const pacoteId = pacotesDb[selecionado.quantidade];
    if (!pacoteId) {
      toast.aviso('Pacote não encontrado no banco. Execute a migration SQL dos pacotes de marketing no Supabase.');
      return;
    }
    setComprando(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setComprando(false);
      toast.erro('Sessão expirada. Faça login novamente.');
      return;
    }
    const res = await fetch('/api/whatsapp/comprar-creditos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ pacoteId, meioPagamento: meio, tipoCompra }),
    });
    const json = await res.json().catch(() => ({}));
    setComprando(false);
    if (!res.ok || !json.checkoutUrl) { toast.erro(json.erro || 'Erro ao processar a compra.'); return; }
    window.open(json.checkoutUrl, '_blank');
    toast.sucesso(tipoCompra === 'assinatura'
      ? 'Assinatura aberta em uma nova aba — cadastre o cartão para ativar a recorrência mensal.'
      : 'Pagamento aberto em uma nova aba. Depois de concluir, volte para esta aba — o saldo é atualizado automaticamente.');
    setSelecionado(null);
    setMostrarLoja(false);
  }

  const zerado = saldo !== null && saldo <= 0;
  const baixo  = saldo !== null && saldo > 0 && saldo <= 50;

  return (
    <div style={{
      background: C.bgCard, borderRadius: RAIO_XL, padding: 20,
      border: `1px solid ${zerado ? '#FECACA' : C.border}`,
    }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {zerado
            ? <FiLock size={15} color="#EF4444" />
            : <FiSend size={15} color={C.sidebarBg} />}
          <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: zerado ? '#EF4444' : C.sidebarBg }}>
            Créditos de Marketing
          </span>
        </div>
        <button
          onClick={() => { setMostrarLoja(v => !v); setSelecionado(null); }}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: mostrarLoja ? C.borderMid : C.sidebarBg, color: '#fff', border: 'none', borderRadius: RAIO_MD, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
        >
          {mostrarLoja ? <><FiX size={11} /> Fechar</> : <><FiPlus size={11} /> Recarregar</>}
        </button>
      </div>

      {/* Saldo atual */}
      <div style={{ background: zerado ? '#FEF2F2' : C.bg, borderRadius: RAIO_MD, padding: '12px 16px', marginBottom: 12 }}>
        <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Saldo disponível
        </p>
        <p style={{ margin: 0, fontSize: 28, fontWeight: 900, lineHeight: 1.1, color: zerado ? '#EF4444' : baixo ? '#C97B3D' : C.textMain }}>
          {saldo === null ? '—' : saldo.toLocaleString('pt-BR')}
          <span style={{ fontSize: 12, fontWeight: 600, color: C.textLight, marginLeft: 4 }}>mensagens</span>
        </p>
        {zerado && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
            <FiAlertTriangle size={11} color="#EF4444" />
            <span style={{ fontSize: 11, color: '#EF4444', fontWeight: 700 }}>Saldo esgotado — disparos bloqueados</span>
          </div>
        )}
        {baixo && (
          <span style={{ display: 'block', marginTop: 6, fontSize: 11, color: '#C97B3D', fontWeight: 600 }}>
            Saldo baixo — considere recarregar
          </span>
        )}
      </div>

      {/* Loja de pacotes */}
      {mostrarLoja && (
        <>
          <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 800, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Escolha um pacote — R$ 0,55 / mensagem
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            {PACOTES.map(p => {
              const ativo = selecionado?.quantidade === p.quantidade;
              return (
                <button
                  key={p.quantidade}
                  onClick={() => setSelecionado(p)}
                  style={{
                    padding: '12px 10px', borderRadius: RAIO_MD, cursor: 'pointer', textAlign: 'left',
                    background: ativo ? C.sidebarBg : '#fff',
                    border: ativo ? `2px solid ${C.sidebarBg}` : `1px solid ${C.borderMid}`,
                    transition: 'all 0.15s',
                  }}
                >
                  <p style={{ margin: '0 0 2px', fontSize: 17, fontWeight: 900, color: ativo ? '#fff' : C.textMain }}>
                    {p.quantidade}
                    <span style={{ fontSize: 11, fontWeight: 600, marginLeft: 3, color: ativo ? 'rgba(255,255,255,0.65)' : C.textLight }}>msn</span>
                  </p>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: ativo ? C.douradoEleva : C.sidebarBg }}>
                    {brl(p.preco)}
                  </p>
                </button>
              );
            })}
          </div>

          {selecionado && (
            <div style={{ background: C.bg, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, padding: 12 }}>
              {/* Único x Assinatura mensal */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {([
                  { valor: 'unico' as const, label: 'Pagamento único' },
                  { valor: 'assinatura' as const, label: 'Assinatura mensal' },
                ]).map(op => (
                  <button
                    key={op.valor}
                    onClick={() => setTipoCompra(op.valor)}
                    style={{
                      flex: 1, padding: '7px 4px', borderRadius: RAIO_MD, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      background: tipoCompra === op.valor ? C.sidebarBg : '#fff',
                      color: tipoCompra === op.valor ? '#fff' : C.textMuted,
                      border: `1px solid ${tipoCompra === op.valor ? C.sidebarBg : C.borderMid}`,
                    }}
                  >
                    {op.label}
                  </button>
                ))}
              </div>
              {tipoCompra === 'assinatura' && (
                <p style={{ margin: '0 0 8px', fontSize: 10, color: C.textLight, lineHeight: 1.4 }}>
                  Cobrado todo mês no cartão, com os créditos renovando automaticamente. Cancele quando quiser.
                </p>
              )}

              <p style={{ margin: '0 0 8px', fontSize: 12, color: C.textMuted }}>
                Pagar <strong style={{ color: C.textMain }}>{brl(selecionado.preco)}</strong>{tipoCompra === 'assinatura' ? '/mês' : ''} via:
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                {tipoCompra === 'unico' && (
                  <button
                    disabled={comprando}
                    onClick={() => comprar('pix')}
                    style={{ flex: 1, padding: '10px', borderRadius: RAIO_MD, border: 'none', background: comprando ? C.borderMid : '#15803D', color: '#fff', fontSize: 12, fontWeight: 700, cursor: comprando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    {comprando ? <FiLoader className="animate-spin" size={12} /> : 'PIX'}
                  </button>
                )}
                <button
                  disabled={comprando}
                  onClick={() => comprar('cartao_credito')}
                  style={{ flex: 1, padding: '10px', borderRadius: RAIO_MD, border: 'none', background: comprando ? C.borderMid : C.sidebarBg, color: '#fff', fontSize: 12, fontWeight: 700, cursor: comprando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  {comprando ? <FiLoader className="animate-spin" size={12} /> : 'Cartão'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
