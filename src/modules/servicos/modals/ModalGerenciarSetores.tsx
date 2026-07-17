'use client'
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { verificarPinGerente } from '@/lib/verificarPinGerente';
import { C } from '@/lib/constants';
import { RAIO_MD, RAIO_2XL, SOMBRA_MODAL, overlayModal } from '@/lib/estiloGlobal';
import { useToast } from '@/components/Toast';
import { FiX, FiLock, FiPlus, FiEdit2, FiCheck } from 'react-icons/fi';

const inputSt: React.CSSProperties = {
  padding: '10px 14px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`,
  fontSize: 13, color: C.textMain, background: C.bgCard,
  width: '100%', boxSizing: 'border-box', outlineColor: C.sidebarBg,
};

export function ModalGerenciarSetores({
  perfil, onClose, onAtualizar,
}: { perfil: any; onClose: () => void; onAtualizar: () => void }) {
  const toast = useToast();
  const [fase, setFase] = useState<'pin' | 'gerenciar'>('pin');
  const [pin, setPin] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [setores, setSetores] = useState<any[]>([]);
  const [novoNome, setNovoNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editandoNome, setEditandoNome] = useState('');

  async function verificarPin() {
    if (!pin) return;
    setVerificando(true);
    const { valido, erro } = await verificarPinGerente(perfil.salao_id, pin);
    setVerificando(false);
    if (erro) { toast.aviso(erro); return; }
    if (!valido) { toast.erro('PIN incorreto.'); return; }
    setFase('gerenciar');
    carregarSetores();
  }

  async function carregarSetores() {
    const { data } = await supabase.from('setores_salao').select('*').order('nome');
    if (data) setSetores(data);
  }

  async function adicionarSetor() {
    const nome = novoNome.trim();
    if (!nome) return;
    if (setores.some(s => s.nome.toLowerCase() === nome.toLowerCase())) {
      toast.aviso('Já existe um setor com este nome.'); return;
    }
    setSalvando(true);
    const { error } = await supabase.from('setores_salao').insert({ salao_id: perfil.salao_id, nome });
    setSalvando(false);
    if (error) { toast.erro('Erro: ' + error.message); return; }
    setNovoNome('');
    await carregarSetores();
    onAtualizar();
    toast.sucesso('Setor adicionado!');
  }

  async function toggleAtivo(setor: any) {
    const { error } = await supabase
      .from('setores_salao').update({ ativo: !setor.ativo }).eq('id', setor.id);
    if (error) { toast.erro('Erro: ' + error.message); return; }
    await carregarSetores();
    onAtualizar();
  }

  async function salvarRenomear(id: string) {
    const nome = editandoNome.trim();
    if (!nome) return;
    if (setores.some(s => s.id !== id && s.nome.toLowerCase() === nome.toLowerCase())) {
      toast.aviso('Já existe um setor com este nome.'); return;
    }
    const antigo = setores.find(s => s.id === id)?.nome;
    const { error } = await supabase.from('setores_salao').update({ nome }).eq('id', id);
    if (error) { toast.erro('Erro: ' + error.message); return; }
    if (antigo && antigo !== nome) {
      await supabase.from('servicos')
        .update({ setor: nome })
        .eq('salao_id', perfil.salao_id)
        .eq('setor', antigo);
    }
    setEditandoId(null);
    await carregarSetores();
    onAtualizar();
    toast.sucesso('Setor renomeado!');
  }

  return (
    <div style={{ ...overlayModal, zIndex: 9999 }}>
      <div style={{ background: C.bgCard, borderRadius: RAIO_2XL, boxShadow: SOMBRA_MODAL, padding: 32, width: '100%', maxWidth: 440, border: `1px solid ${C.border}` }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.sidebarBg, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiLock size={15} /> Gerenciar Setores
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, display: 'flex' }}>
            <FiX size={22} />
          </button>
        </div>

        {fase === 'pin' ? (
          <div>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>
              Esta ação é restrita ao dono ou gerente. Informe o PIN para continuar.
            </p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              placeholder="PIN de gerente"
              value={pin}
              onChange={e => setPin(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && verificarPin()}
              style={inputSt}
              autoFocus
            />
            <button
              onClick={verificarPin}
              disabled={verificando || !pin}
              style={{
                width: '100%', marginTop: 12, padding: '12px 0',
                background: C.sidebarBg, color: '#fff', border: 'none',
                borderRadius: RAIO_MD, fontWeight: 700, fontSize: 13,
                cursor: !pin || verificando ? 'not-allowed' : 'pointer',
                opacity: !pin || verificando ? 0.6 : 1,
              }}
            >
              {verificando ? 'Verificando...' : 'Confirmar'}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                style={{ ...inputSt, flex: 1 }}
                placeholder="Nome do novo setor…"
                value={novoNome}
                onChange={e => setNovoNome(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && adicionarSetor()}
              />
              <button
                onClick={adicionarSetor}
                disabled={salvando || !novoNome.trim()}
                style={{
                  padding: '0 14px', background: C.sidebarBg, color: '#fff',
                  border: 'none', borderRadius: RAIO_MD, fontSize: 12,
                  fontWeight: 700, cursor: 'pointer', display: 'flex',
                  alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                }}
              >
                <FiPlus size={14} /> Adicionar
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
              {setores.length === 0 && (
                <span style={{ fontSize: 12, color: C.textLight, fontStyle: 'italic' }}>Nenhum setor cadastrado.</span>
              )}
              {setores.map(s => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 14px', borderRadius: RAIO_MD,
                    border: `1px solid ${s.ativo ? C.border : C.borderMid}`,
                    background: s.ativo ? C.bg : '#f9f9f9',
                    opacity: s.ativo ? 1 : 0.55,
                  }}
                >
                  {editandoId === s.id ? (
                    <>
                      <input
                        style={{ ...inputSt, flex: 1, padding: '6px 10px', fontSize: 12 }}
                        value={editandoNome}
                        onChange={e => setEditandoNome(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && salvarRenomear(s.id)}
                        autoFocus
                      />
                      <button
                        onClick={() => salvarRenomear(s.id)}
                        style={{ background: C.success, color: '#fff', border: 'none', borderRadius: RAIO_MD, padding: '6px 10px', cursor: 'pointer', display: 'flex' }}
                      ><FiCheck size={14} /></button>
                      <button
                        onClick={() => setEditandoId(null)}
                        style={{ background: 'none', border: 'none', color: C.textLight, cursor: 'pointer', display: 'flex' }}
                      ><FiX size={14} /></button>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: s.ativo ? C.textMain : C.textLight }}>
                        {s.nome}
                      </span>
                      <button
                        onClick={() => { setEditandoId(s.id); setEditandoNome(s.nome); }}
                        title="Renomear"
                        style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', display: 'flex', padding: 4 }}
                      ><FiEdit2 size={13} /></button>
                      <button
                        onClick={() => toggleAtivo(s)}
                        style={{
                          fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 99,
                          border: 'none', cursor: 'pointer',
                          background: s.ativo ? '#FEF3C7' : '#DCFCE7',
                          color: s.ativo ? '#92400E' : '#166534',
                        }}
                      >
                        {s.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>

            <p style={{ margin: '12px 0 0', fontSize: 11, color: C.textLight, lineHeight: 1.5 }}>
              Setores desativados não aparecem na seleção. Serviços que já usam o setor mantêm o valor salvo.
            </p>
            <button
              onClick={onClose}
              style={{ width: '100%', marginTop: 16, padding: '11px 0', background: 'transparent', color: C.textMain, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
}
