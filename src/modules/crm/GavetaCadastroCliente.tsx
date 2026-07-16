'use client'
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/constants';
import { inputAdmin, labelPadrao, containerModal, overlayModal, RAIO_MD, RAIO_LG } from '@/lib/estiloGlobal';
import { FiX, FiCheck } from 'react-icons/fi';
import { useToast } from '@/components/Toast';
import { IconeAjuda } from '@/components/IconeAjuda';

const DDIS = ['+55', '+1', '+54', '+56', '+44', '+34'];

const ORIGENS = [
  'Instagram', 'Indicação de cliente', 'Passou na frente',
  'Google', 'Facebook', 'TikTok', 'Evento', 'Outro',
];

const formVazio = {
  nome: '', ddi: '+55', telefone: '', email: '', genero: '',
  cpf: '', nascimento: '', instagram: '', como_conheceu: '',
  observacoes: '', anamnese: '',
};

type Props = {
  perfil: any;
  onClose: () => void;
  onClienteAdicionado?: (cliente: { id: string; nome_completo: string }) => void;
  nomeInicial?: string;
};

export function GavetaCadastroCliente({ perfil, onClose, onClienteAdicionado, nomeInicial }: Props) {
  const toast = useToast();
  const [form, setForm] = useState({ ...formVazio, nome: nomeInicial || '' });
  const [salvando, setSalvando] = useState(false);

  const set = (campo: string, valor: string) => setForm(f => ({ ...f, [campo]: valor }));

  const inputStyle = inputAdmin;
  const labelStyle = { ...labelPadrao, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 };
  const Obrig = () => <span style={{ color: '#EF4444', fontWeight: 900, fontSize: 11 }}>*</span>;

  async function salvar() {
    if (!form.nome.trim()) { toast.aviso('Nome é obrigatório.'); return; }
    if (!form.telefone.trim()) { toast.aviso('WhatsApp é obrigatório.'); return; }

    setSalvando(true);
    const telefoneCompleto = `${form.ddi} ${form.telefone.trim()}`;
    const cpfLimpo = form.cpf.replace(/\D/g, '');

    try {
      // Verificar duplicata por CPF, email ou telefone
      let qDup = supabase.from('clientes').select('id, nome_completo');
      if (cpfLimpo && form.email)  qDup = qDup.or(`cpf.eq.${cpfLimpo},email.eq.${form.email}`);
      else if (cpfLimpo)           qDup = qDup.eq('cpf', cpfLimpo);
      else if (form.email)         qDup = qDup.eq('email', form.email);
      else                         qDup = qDup.eq('telefone_whatsapp', telefoneCompleto);
      const { data: existente } = await qDup.maybeSingle();

      let clienteId: string;

      if (existente) {
        // Já existe globalmente — vincular a este salão se ainda não vinculado
        const { data: vinculo } = await supabase
          .from('crm_clientes').select('id')
          .eq('cliente_id', existente.id).eq('salao_id', perfil.salao_id)
          .maybeSingle();

        if (vinculo) {
          toast.aviso(`Esse cliente (${existente.nome_completo}) já está cadastrado nesta unidade.`);
          setSalvando(false);
          return;
        }
        await supabase.from('crm_clientes').insert([{
          cliente_id: existente.id, salao_id: perfil.salao_id,
          observacoes: form.observacoes || null, anamnese: form.anamnese || null,
          aceita_notificacoes: true, aceita_campanhas: true, ativo: true,
        }]);
        clienteId = existente.id;
        toast.sucesso(`${existente.nome_completo} vinculado a esta unidade!`);
        onClienteAdicionado?.({ id: clienteId, nome_completo: existente.nome_completo });
        onClose();
        return;
      }

      // Criar registro global
      const nomeCompleto = form.nome.trim();
      const { data: novo, error } = await supabase.from('clientes').insert([{
        salao_id: perfil.salao_id,
        nome_completo:    nomeCompleto,
        telefone_whatsapp: telefoneCompleto,
        email:            form.email     || null,
        cpf:              cpfLimpo       || null,
        genero:           form.genero    || null,
        nascimento:       form.nascimento || null,
        instagram:        form.instagram  || null,
        como_conheceu:    form.como_conheceu || null,
      }]).select('id').single();
      if (error) throw error;

      await supabase.from('crm_clientes').insert([{
        cliente_id: novo.id, salao_id: perfil.salao_id,
        observacoes: form.observacoes || null, anamnese: form.anamnese || null,
        aceita_notificacoes: true, aceita_campanhas: true, ativo: true,
      }]);
      clienteId = novo.id;
      toast.sucesso('Cliente cadastrado com sucesso!');
      onClienteAdicionado?.({ id: clienteId, nome_completo: nomeCompleto });
      onClose();
    } catch (e: any) {
      toast.erro('Erro ao cadastrar: ' + e.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div style={{ ...overlayModal, zIndex: 9999 }}>
      <div style={{ ...containerModal, padding: 32, width: '100%', maxWidth: 720, maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.sidebarBg }}>Novo Cliente</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLight }}>
            <FiX size={24} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Nome + WhatsApp */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>Nome Completo <Obrig /></label>
              <input
                style={inputStyle} autoFocus
                value={form.nome} onChange={e => set('nome', e.target.value)}
                placeholder="Ex: Maria Silva"
              />
            </div>
            <div>
              <label style={labelStyle}>
                WhatsApp <Obrig />
                <IconeAjuda texto={"Número usado para envio de confirmações e lembretes automáticos.\nFormato: (21) 99999-9999"} posicao="baixo" />
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  value={form.ddi} onChange={e => set('ddi', e.target.value)}
                  style={{ ...inputStyle, width: 80, padding: '12px 6px', textAlign: 'center' }}
                >
                  {DDIS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder="(21) 99999-9999"
                  value={form.telefone} onChange={e => set('telefone', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* CPF + Nascimento + Gênero */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>CPF</label>
              <input style={inputStyle} placeholder="000.000.000-00" value={form.cpf} onChange={e => set('cpf', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Nascimento</label>
              <input type="date" style={inputStyle} value={form.nascimento} onChange={e => set('nascimento', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Gênero</label>
              <select style={inputStyle} value={form.genero} onChange={e => set('genero', e.target.value)}>
                <option value="">Não informado</option>
                <option value="Feminino">Feminino</option>
                <option value="Masculino">Masculino</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
          </div>

          {/* E-mail + Instagram + Origem */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>E-mail</label>
              <input type="email" style={inputStyle} value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Instagram</label>
              <input style={inputStyle} placeholder="@usuario" value={form.instagram} onChange={e => set('instagram', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Origem</label>
              <select style={inputStyle} value={form.como_conheceu} onChange={e => set('como_conheceu', e.target.value)}>
                <option value="">Selecione...</option>
                {ORIGENS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {/* Observações */}
          <div>
            <label style={labelStyle}>Observações desta Unidade</label>
            <textarea
              value={form.observacoes} onChange={e => set('observacoes', e.target.value)}
              style={{ ...inputStyle, height: 80, resize: 'none' }}
              placeholder="Preferências, histórico interno, notas..."
            />
          </div>

        </div>

        {/* Rodapé */}
        <div style={{ display: 'flex', gap: 12, marginTop: 28, paddingTop: 24, borderTop: `1px solid ${C.border}` }}>
          <button
            onClick={salvar} disabled={salvando}
            style={{ flex: 2, padding: '13px 0', background: C.sidebarBg, color: '#fff', border: 'none', borderRadius: RAIO_MD, fontSize: 13, fontWeight: 600, cursor: salvando ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: salvando ? 0.7 : 1 }}
          >
            <FiCheck size={18} /> {salvando ? 'Salvando...' : 'Cadastrar Cliente'}
          </button>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '13px 0', background: 'transparent', color: C.textMuted, border: `1px solid ${C.border}`, borderRadius: RAIO_MD, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
          >
            Cancelar
          </button>
        </div>
        <p style={{ margin: '12px 0 0', fontSize: 10, color: C.textLight, textAlign: 'center' }}>
          <span style={{ color: '#EF4444', fontWeight: 900 }}>*</span> Campos obrigatórios
        </p>

      </div>
    </div>
  );
}
