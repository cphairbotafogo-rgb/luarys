// src/modules/crm/ModalGerenciarEtiquetas.tsx
// CRUD completo do catálogo de etiquetas (nome + cor). Etiquetas são
// armazenadas de forma desnormalizada dentro de crm_clientes.etiquetas
// (jsonb, uma cópia {id,nome,cor} por cliente) — por isso renomear/recolorir
// ou excluir aqui propaga pra todos os clientes que já usam a etiqueta,
// senão o nome/cor antigo ficaria "fantasma" na ficha deles.
'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { confirmarAcaoGlobal } from '@/components/ConfirmacaoGlobal';
import { useToast } from '@/components/Toast';
import { C } from '@/lib/constants';
import { RAIO_MD, RAIO_2XL, SOMBRA_MODAL, overlayModal } from '@/lib/estiloGlobal';
import { FiX, FiPlus, FiEdit2, FiTrash2, FiCheck, FiTag } from 'react-icons/fi';

const inputSt: React.CSSProperties = {
  padding: '10px 14px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`,
  fontSize: 13, color: C.textMain, background: C.bgCard,
  width: '100%', boxSizing: 'border-box', outlineColor: C.sidebarBg,
};

interface Props {
  perfil: any;
  onClose: () => void;
  onAtualizar: () => void; // recarrega etiquetasDb (e a ficha aberta, se houver) no chamador
}

export function ModalGerenciarEtiquetas({ perfil, onClose, onAtualizar }: Props) {
  const toast = useToast();
  const [etiquetas, setEtiquetas] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [novoNome, setNovoNome] = useState('');
  const [novaCor, setNovaCor] = useState('#8B5CF6');
  const [salvando, setSalvando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editCor, setEditCor] = useState('#8B5CF6');

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase.from('etiquetas').select('*').eq('salao_id', perfil.salao_id).order('nome');
    setEtiquetas(data || []);
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, [perfil?.salao_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Propaga uma mudança (renomear/recolorir = novoValor; excluir = null) pra
  // todo cliente que já tem essa etiqueta marcada, dentro do mesmo salão.
  // `etiquetas` é `json` (não `jsonb`) — .contains()/@> não funciona nessa
  // coluna, então busca todo mundo do salão e filtra em JS (mesma pegadinha
  // já documentada pra `profissionais.servicos_comissoes`).
  async function propagarParaClientes(tagId: string, novoValor: { nome: string; cor: string } | null) {
    const { data: linhas, error } = await supabase
      .from('crm_clientes').select('id, etiquetas')
      .eq('salao_id', perfil.salao_id);
    if (error || !linhas?.length) return;
    const afetadas = linhas.filter((l: any) => Array.isArray(l.etiquetas) && l.etiquetas.some((e: any) => e.id === tagId));
    await Promise.all(afetadas.map((l: any) => {
      const novasEtiquetas = novoValor
        ? l.etiquetas.map((e: any) => e.id === tagId ? { ...e, ...novoValor } : e)
        : l.etiquetas.filter((e: any) => e.id !== tagId);
      return supabase.from('crm_clientes').update({ etiquetas: novasEtiquetas }).eq('id', l.id);
    }));
  }

  async function adicionar() {
    const nome = novoNome.trim();
    if (!nome) return;
    if (etiquetas.some(e => e.nome.toLowerCase() === nome.toLowerCase())) {
      toast.aviso('Já existe uma etiqueta com este nome.'); return;
    }
    setSalvando(true);
    const { error } = await supabase.from('etiquetas').insert({ salao_id: perfil.salao_id, nome, cor: novaCor });
    setSalvando(false);
    if (error) { toast.erro('Erro: ' + error.message); return; }
    setNovoNome(''); setNovaCor('#8B5CF6');
    await carregar();
    onAtualizar();
    toast.sucesso('Etiqueta criada!');
  }

  async function salvarEdicao(id: string) {
    const nome = editNome.trim();
    if (!nome) return;
    if (etiquetas.some(e => e.id !== id && e.nome.toLowerCase() === nome.toLowerCase())) {
      toast.aviso('Já existe uma etiqueta com este nome.'); return;
    }
    const { error } = await supabase.from('etiquetas').update({ nome, cor: editCor }).eq('id', id);
    if (error) { toast.erro('Erro: ' + error.message); return; }
    await propagarParaClientes(id, { nome, cor: editCor });
    setEditandoId(null);
    await carregar();
    onAtualizar();
    toast.sucesso('Etiqueta atualizada em todos os clientes que a usam!');
  }

  async function excluir(tag: any) {
    const ok = await confirmarAcaoGlobal({
      titulo: `Excluir a etiqueta "${tag.nome}"?`,
      descricao: 'Ela será removida de todos os clientes que a usam nesta unidade. Essa ação não pode ser desfeita.',
      rotuloCta: 'Excluir', perigoso: true,
    });
    if (!ok) return;
    await propagarParaClientes(tag.id, null);
    const { error } = await supabase.from('etiquetas').delete().eq('id', tag.id);
    if (error) { toast.erro('Erro: ' + error.message); return; }
    await carregar();
    onAtualizar();
    toast.sucesso('Etiqueta excluída.');
  }

  return (
    <div style={{ ...overlayModal, zIndex: 10000 }}>
      <div style={{ background: C.bgCard, borderRadius: RAIO_2XL, boxShadow: SOMBRA_MODAL, padding: 32, width: '100%', maxWidth: 460, border: `1px solid ${C.border}` }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.sidebarBg, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiTag size={15} /> Gerenciar Etiquetas
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, display: 'flex' }}>
            <FiX size={22} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            style={{ ...inputSt, flex: 1 }}
            placeholder="Nome da nova etiqueta…"
            value={novoNome}
            onChange={e => setNovoNome(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && adicionar()}
          />
          <input type="color" value={novaCor} onChange={e => setNovaCor(e.target.value)}
            style={{ width: 40, height: 40, padding: 0, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, cursor: 'pointer', flexShrink: 0 }} />
          <button
            onClick={adicionar}
            disabled={salvando || !novoNome.trim()}
            style={{ padding: '0 14px', background: C.sidebarBg, color: '#fff', border: 'none', borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: salvando || !novoNome.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', opacity: salvando || !novoNome.trim() ? 0.6 : 1 }}
          >
            <FiPlus size={14} /> Adicionar
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}>
          {carregando && <span style={{ fontSize: 12, color: C.textLight }}>Carregando...</span>}
          {!carregando && etiquetas.length === 0 && (
            <span style={{ fontSize: 12, color: C.textLight, fontStyle: 'italic' }}>Nenhuma etiqueta cadastrada.</span>
          )}
          {etiquetas.map(tag => (
            <div key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: RAIO_MD, border: `1px solid ${C.border}`, background: C.bg }}>
              {editandoId === tag.id ? (
                <>
                  <input type="color" value={editCor} onChange={e => setEditCor(e.target.value)}
                    style={{ width: 32, height: 32, padding: 0, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, cursor: 'pointer', flexShrink: 0 }} />
                  <input
                    style={{ ...inputSt, flex: 1, padding: '6px 10px', fontSize: 12 }}
                    value={editNome}
                    onChange={e => setEditNome(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && salvarEdicao(tag.id)}
                    autoFocus
                  />
                  <button onClick={() => salvarEdicao(tag.id)} style={{ background: C.success, color: '#fff', border: 'none', borderRadius: RAIO_MD, padding: '6px 10px', cursor: 'pointer', display: 'flex' }}><FiCheck size={14} /></button>
                  <button onClick={() => setEditandoId(null)} style={{ background: 'none', border: 'none', color: C.textLight, cursor: 'pointer', display: 'flex' }}><FiX size={14} /></button>
                </>
              ) : (
                <>
                  <span style={{ width: 14, height: 14, borderRadius: '50%', background: tag.cor, flexShrink: 0, border: `1px solid ${C.border}` }} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.textMain }}>{tag.nome}</span>
                  <button onClick={() => { setEditandoId(tag.id); setEditNome(tag.nome); setEditCor(tag.cor); }} title="Editar" style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', display: 'flex', padding: 4 }}><FiEdit2 size={13} /></button>
                  <button onClick={() => excluir(tag)} title="Excluir" style={{ background: 'none', border: 'none', color: C.danger, cursor: 'pointer', display: 'flex', padding: 4 }}><FiTrash2 size={13} /></button>
                </>
              )}
            </div>
          ))}
        </div>

        <p style={{ margin: '12px 0 0', fontSize: 11, color: C.textLight, lineHeight: 1.5 }}>
          Renomear/recolorir ou excluir atualiza automaticamente todos os clientes que já usam a etiqueta.
        </p>
        <button onClick={onClose} style={{ width: '100%', marginTop: 16, padding: '11px 0', background: 'transparent', color: C.textMain, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          Fechar
        </button>
      </div>
    </div>
  );
}
