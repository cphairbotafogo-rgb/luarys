'use client'
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/constants';
import { RAIO_MD, RAIO_SM, RAIO_XL } from '@/lib/estiloGlobal';
import { FiSave, FiUsers } from 'react-icons/fi';
import { ModalGerenciarSetores } from './modals/ModalGerenciarSetores';

interface Props {
  perfil: any;
  setorLote: any[];
  setSetorLote: (fn: (prev: any[]) => any[]) => void;
  salvandoSetores: boolean;
  salvarTodosSetores: () => void;
}

export function AbaSetorLote({ perfil, setorLote, setSetorLote, salvandoSetores, salvarTodosSetores }: Props) {
  const [setores, setSetores] = useState<any[]>([]);
  const [setorAplicar, setSetorAplicar] = useState<Record<string, string>>({});
  const [modalSetoresAberto, setModalSetoresAberto] = useState(false);

  async function carregarSetores() {
    const { data } = await supabase.from('setores_salao').select('id, nome').eq('ativo', true).order('nome');
    if (data) setSetores(data);
  }

  useEffect(() => { carregarSetores(); }, []);

  function alterarSetor(id: string, valor: string) {
    setSetorLote(prev => prev.map(s => s.id === id ? { ...s, setor: valor } : s));
  }

  function aplicarSetorNaCategoria(categoria: string, novoSetor: string) {
    if (!novoSetor.trim()) return;
    setSetorLote(prev => prev.map(s => s.categoria === categoria ? { ...s, setor: novoSetor } : s));
    setSetorAplicar(prev => ({ ...prev, [categoria]: '' }));
  }

  const porCategoria = setorLote.reduce((acc: any, s: any) => {
    const cat = s.categoria || 'Sem Categoria';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});
  const categorias = Object.keys(porCategoria).sort();

  const inputSt: React.CSSProperties = {
    padding: '8px 10px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`,
    fontSize: 12, color: C.textMain, background: C.bgCard, width: '100%',
    boxSizing: 'border-box', outlineColor: C.sidebarBg, cursor: 'pointer',
  };

  const optionVazia = <option value="">— Selecionar —</option>;

  return (
    <>
    <div style={{ animation: 'fadeIn 0.2s ease-out', background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, overflow: 'hidden' }}>

      <div style={{ padding: '24px 32px', borderBottom: `1px solid ${C.borderMid}`, background: C.bg, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.sidebarBg, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiUsers size={20} /> Edição de Setor em Lote
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: C.textMuted }}>
            Defina qual profissional é responsável por cada serviço. Use "Aplicar" para preencher uma categoria inteira de uma vez.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setModalSetoresAberto(true)}
            style={{ background: 'transparent', color: C.sidebarBg, border: `1px solid ${C.sidebarBg}`, padding: '8px 16px', borderRadius: RAIO_MD, fontSize: 11, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px' }}
          >
            Gerenciar Setores
          </button>
          <button
            onClick={salvarTodosSetores}
            disabled={salvandoSetores}
            style={{ background: C.success, color: '#fff', border: 'none', padding: '12px 24px', borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: salvandoSetores ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <FiSave size={16} /> {salvandoSetores ? 'Salvando...' : 'Salvar Todos'}
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto', maxHeight: '60vh' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 600 }}>
          <thead style={{ position: 'sticky', top: 0, background: C.bgCard, zIndex: 1, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <tr>
              <th style={{ padding: '14px 24px', fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: 'uppercase' }}>Serviço</th>
              <th style={{ padding: '14px 24px', fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', width: '40%' }}>Setor (Profissional Responsável)</th>
            </tr>
          </thead>
          <tbody>
            {categorias.map(categoria => {
              const servicos = porCategoria[categoria];
              const semSetor = servicos.filter((s: any) => !s.setor).length;
              const aplicarVal = setorAplicar[categoria] ?? '';
              return (
                <React.Fragment key={`cat-${categoria}`}>
                  <tr style={{ background: '#EFF3F8', borderTop: `2px solid ${C.sidebarBg}` }}>
                    <td style={{ padding: '10px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: C.sidebarBg, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{categoria}</span>
                        <span style={{ background: C.sidebarBg, color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10 }}>{servicos.length}</span>
                        {semSetor > 0 && <span style={{ fontSize: 10, color: '#B45309', fontWeight: 700 }}>{semSetor} sem setor</span>}
                      </div>
                    </td>
                    <td style={{ padding: '8px 24px' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <select
                          value={aplicarVal}
                          onChange={e => setSetorAplicar(prev => ({ ...prev, [categoria]: e.target.value }))}
                          style={{ ...inputSt, background: aplicarVal ? '#EFF6FF' : C.bg, maxWidth: 300 }}
                        >
                          {optionVazia}
                          {setores.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
                        </select>
                        <button
                          onClick={() => aplicarSetorNaCategoria(categoria, aplicarVal)}
                          disabled={!aplicarVal.trim()}
                          style={{
                            background: aplicarVal.trim() ? C.sidebarBg : C.borderMid,
                            color: '#fff', border: 'none', borderRadius: RAIO_SM,
                            padding: '7px 16px', cursor: aplicarVal.trim() ? 'pointer' : 'not-allowed',
                            fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                          }}
                        >
                          Aplicar à categoria
                        </button>
                      </div>
                    </td>
                  </tr>

                  {servicos.map((s: any, idx: number) => {
                    const setorLegado = s.setor && !setores.some((st: any) => st.nome === s.setor);
                    return (
                      <tr key={s.id} style={{ borderBottom: `1px solid ${C.border}`, background: idx % 2 === 0 ? C.bg : C.bgCard }}>
                        <td style={{ padding: '12px 24px 12px 36px' }}>
                          <strong style={{ fontSize: 13, color: C.textMain }}>{s.nome_servico}</strong>
                        </td>
                        <td style={{ padding: '12px 24px' }}>
                          <select
                            value={s.setor}
                            onChange={e => alterarSetor(s.id, e.target.value)}
                            style={{ ...inputSt, maxWidth: 320, borderColor: s.setor ? undefined : C.borderMid }}
                          >
                            {optionVazia}
                            {setores.map(st => <option key={st.id} value={st.nome}>{st.nome}</option>)}
                            {setorLegado && <option value={s.setor}>{s.setor} (legado)</option>}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>

    {modalSetoresAberto && (
      <ModalGerenciarSetores
        perfil={perfil}
        onClose={() => setModalSetoresAberto(false)}
        onAtualizar={carregarSetores}
      />
    )}
    </>
  );
}
