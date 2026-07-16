'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/constants';
import { RAIO_MD, RAIO_LG, RAIO_XL, overlayModal, containerModal } from '@/lib/estiloGlobal';
import { FiX, FiSave, FiUser, FiPhone, FiHeart, FiMapPin, FiFileText, FiGift, FiLock } from 'react-icons/fi';
import { ExtratoCliente } from '@/modules/fidelidade/ExtratoCliente';
import { BloqueioModulo } from '@/components/BloqueioModulo';
import { AbaIdentidade } from './fichaCliente/AbaIdentidade';
import { AbaContatos } from './fichaCliente/AbaContatos';
import { AbaPreferencias } from './fichaCliente/AbaPreferencias';
import { AbaEndereco } from './fichaCliente/AbaEndereco';
import { AbaAnamnese } from './fichaCliente/AbaAnamnese';

type Aba = 'identidade' | 'contatos' | 'preferencias' | 'endereco' | 'anamnese' | 'fidelidade';

const ABAS: { id: Aba; label: string; icon: any }[] = [
  { id: 'identidade',   label: 'Identidade',   icon: FiUser     },
  { id: 'contatos',     label: 'Contatos',      icon: FiPhone    },
  { id: 'preferencias', label: 'Preferências',  icon: FiHeart    },
  { id: 'endereco',     label: 'Endereço',      icon: FiMapPin   },
  { id: 'anamnese',     label: 'Anamnese',      icon: FiFileText },
  { id: 'fidelidade',   label: 'Fidelidade',    icon: FiGift     },
];

export function ModalFichaCliente({
  formCliente, setFormCliente,
  abaAtivaCrm, setAbaAtivaCrm,
  onClose, salvarFichaCompleta,
  etiquetasDb = [],
  perfil,
}: any) {

  const [abaAtiva, setAbaAtiva] = useState<Aba>(abaAtivaCrm === 'anamnese' ? 'anamnese' : 'identidade');
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [fidelidadeAtiva, setFidelidadeAtiva] = useState(false);
  const [precoFidelidade, setPrecoFidelidade] = useState(0);

  useEffect(() => {
    if (!perfil?.salao_id) return;
    Promise.all([
      supabase.from('salao_modulos').select('ativo').eq('salao_id', perfil.salao_id).eq('modulo_chave', 'fidelidade').maybeSingle(),
      supabase.from('modulos_catalogo').select('preco_mensal').eq('chave', 'fidelidade').maybeSingle(),
      supabase.from('saloes').select('acesso_total').eq('id', perfil.salao_id).maybeSingle(),
    ]).then(([resM, resC, resS]) => {
      setFidelidadeAtiva(!!resM.data?.ativo || !!resS.data?.acesso_total);
      setPrecoFidelidade(Number(resC.data?.preco_mensal ?? 0));
    });
  }, [perfil?.salao_id]);

  const set = (campo: string, valor: any) =>
    setFormCliente({ ...formCliente, [campo]: valor });

  const setAnamnese = (campo: string, valor: string) =>
    setFormCliente({ ...formCliente, anamnese: { ...(formCliente.anamnese || {}), [campo]: valor } });

  function toggleEtiqueta(tag: any) {
    const etiquetasCliente: any[] = formCliente.etiquetas || [];
    const existe = etiquetasCliente.find((t: any) => t.id === tag.id);
    const novas  = existe
      ? etiquetasCliente.filter((t: any) => t.id !== tag.id)
      : [...etiquetasCliente, tag];
    set('etiquetas', novas);
  }

  async function buscarCep(cep: string) {
    const limpo = cep.replace(/\D/g, '');
    if (limpo.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setFormCliente({
          ...formCliente, cep: limpo,
          logradouro: data.logradouro || '',
          bairro:     data.bairro     || '',
          cidade:     data.localidade || '',
          estado:     data.uf         || '',
        });
      }
    } catch {}
    setBuscandoCep(false);
  }

  const dataCadastro = formCliente.created_at
    ? new Date(formCliente.created_at).toLocaleDateString('pt-BR')
    : null;

  return (
    <div className="font-body" style={{ ...overlayModal, zIndex: 1100 }}>
      <div style={{
        ...containerModal, width: '100%',
        maxWidth: 700, maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* CABEÇALHO */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 28px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: RAIO_LG, background: C.sidebarBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: C.douradoEleva, fontWeight: 800, fontSize: 16, overflow: 'hidden',
            }}>
              {formCliente.foto_url
                ? <img src={formCliente.foto_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                : (formCliente.nome_completo || 'CL').substring(0, 2).toUpperCase()
              }
            </div>
            <div>
              <h3 className="font-title" style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.sidebarBg }}>
                {formCliente.nome_completo || 'Novo Cliente'}
              </h3>
              {dataCadastro && <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textLight }}>Cliente desde {dataCadastro}</p>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLight }}><FiX size={22} /></button>
        </div>

        {/* ABAS */}
        <div style={{ display: 'flex', padding: '16px 28px 0', borderBottom: `1px solid ${C.border}`, overflowX: 'auto' }}>
          {ABAS.map(({ id, label, icon: Icon }) => {
            const bloqueada = id === 'fidelidade' && !fidelidadeAtiva;
            const ativa = abaAtiva === id;
            return (
              <button key={id} onClick={() => setAbaAtiva(id)} className="font-title"
                title={bloqueada ? 'Módulo não contratado — clique para contratar' : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '10px 14px', background: 'none', border: 'none',
                  borderBottom: ativa ? `2px solid ${C.sidebarBg}` : '2px solid transparent',
                  color: bloqueada ? C.textLight : (ativa ? C.sidebarBg : C.textLight),
                  fontWeight: ativa ? 700 : 500, fontSize: 11, cursor: 'pointer', opacity: bloqueada ? 0.55 : 1,
                  textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap', transition: '0.2s',
                }}
              >
                {bloqueada ? <FiLock size={13} /> : <Icon size={13} />} {label}
              </button>
            );
          })}
        </div>

        {/* CONTEÚDO */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '24px 28px' }}>
          {abaAtiva === 'identidade'   && <AbaIdentidade formCliente={formCliente} set={set} />}
          {abaAtiva === 'contatos'     && <AbaContatos formCliente={formCliente} set={set} />}
          {abaAtiva === 'preferencias' && <AbaPreferencias formCliente={formCliente} set={set} etiquetasDb={etiquetasDb} toggleEtiqueta={toggleEtiqueta} />}
          {abaAtiva === 'endereco'     && <AbaEndereco formCliente={formCliente} set={set} buscarCep={buscarCep} buscandoCep={buscandoCep} />}
          {abaAtiva === 'anamnese'     && <AbaAnamnese formCliente={formCliente} setAnamnese={setAnamnese} />}

          {abaAtiva === 'fidelidade' && !fidelidadeAtiva && (
            <BloqueioModulo
              salaoId={perfil?.salao_id} moduloChave="fidelidade"
              nome="Programa de Fidelidade"
              descricao="Fidelize seus clientes com pontos automáticos, prêmios e benefícios exclusivos."
              preco={precoFidelidade}
              itens={['Pontos creditados ao finalizar atendimento','Taxa de conversão personalizável (R$ → pontos)','Catálogo de prêmios resgatáveis','Extrato individual por cliente']}
            />
          )}
          {abaAtiva === 'fidelidade' && fidelidadeAtiva && perfil?.salao_id && formCliente.id && (
            <ExtratoCliente perfil={perfil} clienteId={formCliente.id} />
          )}
          {abaAtiva === 'fidelidade' && fidelidadeAtiva && (!perfil?.salao_id || !formCliente.id) && (
            <p style={{ color: C.textLight, fontSize: 13, fontStyle: 'italic', padding: 16 }}>Salve a ficha do cliente antes de ver o programa de fidelidade.</p>
          )}
        </div>

        {/* RODAPÉ */}
        <div style={{ display: 'flex', gap: 10, padding: '16px 28px', borderTop: `1px solid ${C.border}`, alignItems: 'center' }}>
          {dataCadastro && <span style={{ fontSize: 11, color: C.textLight, flex: 1 }}>Cadastrado em {dataCadastro}</span>}
          <button onClick={onClose}
            style={{ padding: '12px 20px', fontSize: 13, fontWeight: 500, background: 'transparent', color: C.textMuted, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={salvarFichaCompleta} className="transition-all hover:opacity-90"
            style={{ padding: '12px 24px', fontSize: 13, fontWeight: 700, background: C.sidebarBg, color: '#fff', border: 'none', borderRadius: RAIO_MD, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiSave size={16} /> Salvar Ficha
          </button>
        </div>
      </div>
    </div>
  );
}
