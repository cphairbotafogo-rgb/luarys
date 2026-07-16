'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { RAIO_MD, RAIO_2XL } from "@/lib/estiloGlobal";
import { FiX, FiMessageCircle } from "react-icons/fi";
import { useToast } from "@/components/Toast";

export function ModalPacoteWpp({ salao, pacoteAtual, onClose, onSaved }: {
  salao: any;
  pacoteAtual: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [tipo, setTipo] = useState<'mensal' | 'credito'>(pacoteAtual?.tipo ?? 'mensal');
  const [limiteMes, setLimiteMes] = useState<string>(String(pacoteAtual?.limite_mes ?? 100));
  const [creditos, setCreditos] = useState<string>(String(pacoteAtual?.creditos_saldo ?? 100));
  const [salvando, setSalvando] = useState(false);
  const [usoMes, setUsoMes] = useState<number>(0);

  useEffect(() => {
    async function carregarUso() {
      const mesRef = new Date();
      mesRef.setDate(1); mesRef.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from('whatsapp_uso')
        .select('enviadas')
        .eq('salao_id', salao.id)
        .eq('mes_ref', mesRef.toISOString().split('T')[0])
        .maybeSingle();
      setUsoMes(data?.enviadas ?? 0);
    }
    carregarUso();
  }, [salao.id]);

  async function salvar() {
    setSalvando(true);
    try {
      const payload: any = {
        salao_id: salao.id,
        tipo,
        ativo: true,
        limite_mes: tipo === 'mensal' ? (parseInt(limiteMes) || 100) : null,
        creditos_saldo: tipo === 'credito' ? (parseInt(creditos) || 0) : null,
        contratado_em: new Date().toISOString(),
      };
      const { error } = await supabase
        .from('salao_whatsapp_pacote')
        .upsert(payload, { onConflict: 'salao_id' });
      if (error) throw error;
      toast.sucesso('Pacote WhatsApp salvo!');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.erro('Erro: ' + e.message);
    } finally {
      setSalvando(false);
    }
  }

  async function cancelarPacote() {
    setSalvando(true);
    try {
      const { error } = await supabase
        .from('salao_whatsapp_pacote')
        .update({ ativo: false })
        .eq('salao_id', salao.id);
      if (error) throw error;
      toast.sucesso('Pacote cancelado.');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.erro('Erro: ' + e.message);
    } finally {
      setSalvando(false);
    }
  }

  const labelSt: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 };
  const inputSt: React.CSSProperties = { padding: '10px 12px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, width: '100%', boxSizing: 'border-box', fontSize: 13, color: C.textMain };
  const tipoBtnSt = (ativo: boolean): React.CSSProperties => ({
    flex: 1, padding: '10px 16px', borderRadius: RAIO_MD, border: `2px solid ${ativo ? C.sidebarBg : C.borderMid}`,
    background: ativo ? C.sidebarBg : '#fff', color: ativo ? '#fff' : C.textMuted,
    fontWeight: 700, fontSize: 13, cursor: 'pointer',
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: C.bgCard, borderRadius: RAIO_2XL, width: '100%', maxWidth: 480, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>

        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: C.textMain, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FiMessageCircle size={16} color={C.sidebarBg} />
              Pacote WhatsApp
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{salao.nome_fantasia || salao.razao_social}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLight }}><FiX size={20} /></button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {pacoteAtual?.ativo && (
            <div style={{ background: usoMes >= (pacoteAtual.limite_mes ?? 999999) ? '#FEF2F2' : '#F0FDF4', borderRadius: RAIO_MD, padding: '12px 16px', fontSize: 13 }}>
              <strong>Uso este mês:</strong> {usoMes} conversa{usoMes !== 1 ? 's' : ''}
              {pacoteAtual.tipo === 'mensal' && ` de ${pacoteAtual.limite_mes ?? '?'}`}
              {pacoteAtual.tipo === 'credito' && ` — saldo: ${pacoteAtual.creditos_saldo ?? 0} créditos restantes`}
            </div>
          )}

          <div>
            <label style={labelSt}>Tipo de pacote</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={tipoBtnSt(tipo === 'mensal')} onClick={() => setTipo('mensal')}>Mensal</button>
              <button style={tipoBtnSt(tipo === 'credito')} onClick={() => setTipo('credito')}>Crédito avulso</button>
            </div>
          </div>

          {tipo === 'mensal' ? (
            <div>
              <label style={labelSt}>Conversas por mês</label>
              <select style={inputSt} value={limiteMes} onChange={e => setLimiteMes(e.target.value)}>
                <option value="100">100 conversas/mês</option>
                <option value="200">200 conversas/mês</option>
                <option value="500">500 conversas/mês</option>
                <option value="1000">1.000 conversas/mês</option>
              </select>
              <p style={{ margin: '8px 0 0', fontSize: 11, color: C.textLight }}>
                Zera automaticamente todo dia 1º. Cada número único = 1 conversa (janela de 24h, igual à Meta).
              </p>
            </div>
          ) : (
            <div>
              <label style={labelSt}>Quantidade de créditos</label>
              <input
                type="number" min={1} style={inputSt}
                value={creditos} onChange={e => setCreditos(e.target.value)}
                placeholder="Ex: 300"
              />
              <p style={{ margin: '8px 0 0', fontSize: 11, color: C.textLight }}>
                Não expira por mês. O saldo vai diminuindo conforme conversas são abertas.
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
            {pacoteAtual?.ativo && (
              <button
                onClick={cancelarPacote}
                disabled={salvando}
                style={{ padding: '10px 16px', background: 'none', border: `1px solid ${C.danger}`, borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: salvando ? 'not-allowed' : 'pointer', color: C.danger }}
              >
                Cancelar pacote
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button onClick={onClose} style={{ padding: '10px 16px', background: 'none', border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: 'pointer', color: C.textMuted }}>
              Fechar
            </button>
            <button
              onClick={salvar}
              disabled={salvando}
              style={{ padding: '10px 24px', background: salvando ? C.borderMid : C.success, color: '#fff', border: 'none', borderRadius: RAIO_MD, fontSize: 12, fontWeight: 800, cursor: salvando ? 'not-allowed' : 'pointer' }}
            >
              {salvando ? 'Salvando...' : pacoteAtual?.ativo ? 'Atualizar' : 'Ativar pacote'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
