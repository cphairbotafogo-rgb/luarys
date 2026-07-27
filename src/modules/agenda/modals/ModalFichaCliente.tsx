'use client'
// Ficha única de cliente — usada pela Agenda ("Editar cadastro") e pelo CRM
// ("Abrir Ficha" / "Novo Cliente"). Antes eram dois modais com modelos de
// dados diferentes (ModalCliente do CRM vs este); ver useFichaCliente.ts
// pra como a unificação funciona por baixo.
import { useState, useRef, useEffect } from 'react';
import { C } from '@/lib/constants';
import { RAIO_MD, RAIO_LG, RAIO_XL, overlayModal, containerModal } from '@/lib/estiloGlobal';
import { FiX, FiSave, FiUser, FiPhone, FiHeart, FiMapPin, FiFileText, FiGift, FiLock, FiClock, FiCamera, FiStar, FiAlertTriangle, FiArchive } from 'react-icons/fi';
import { ExtratoCliente } from '@/modules/fidelidade/ExtratoCliente';
import { BloqueioModulo } from '@/components/BloqueioModulo';
import { AbaAssinaturaCliente } from '@/modules/crm/assinatura/AbaAssinaturaCliente';
import { AbaIdentidade } from './fichaCliente/AbaIdentidade';
import { AbaContatos } from './fichaCliente/AbaContatos';
import { AbaPreferencias } from './fichaCliente/AbaPreferencias';
import { AbaEndereco } from './fichaCliente/AbaEndereco';
import { AbaAnamnese } from './fichaCliente/AbaAnamnese';
import { AbaHistorico } from './fichaCliente/AbaHistorico';
import { useFichaCliente } from './fichaCliente/useFichaCliente';
import { supabase } from '@/lib/supabase';

type Aba = 'identidade' | 'contatos' | 'preferencias' | 'endereco' | 'anamnese' | 'historico' | 'assinatura' | 'fidelidade';

const ABAS: { id: Aba; label: string; icon: any }[] = [
  { id: 'identidade',   label: 'Identidade',   icon: FiUser     },
  { id: 'contatos',     label: 'Contatos',     icon: FiPhone    },
  { id: 'preferencias', label: 'Preferências', icon: FiHeart    },
  { id: 'endereco',     label: 'Endereço',     icon: FiMapPin   },
  { id: 'anamnese',     label: 'Anamnese',     icon: FiFileText },
  { id: 'historico',    label: 'Histórico',    icon: FiClock    },
  { id: 'assinatura',   label: 'Assinatura',   icon: FiStar     },
  { id: 'fidelidade',   label: 'Fidelidade',   icon: FiGift     },
];

interface Props {
  clienteId: string | null; // null = cadastro de cliente novo
  perfil: any;
  onClose: () => void;
  onSalvo?: () => void;
  abaInicial?: Aba;
}

export function ModalFichaCliente({ clienteId, perfil, onClose, onSalvo, abaInicial }: Props) {
  const [abaAtiva, setAbaAtiva] = useState<Aba>(abaInicial || 'identidade');
  const [fidelidadeAtiva, setFidelidadeAtiva] = useState(false);
  const [precoFidelidade, setPrecoFidelidade] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fc = useFichaCliente(clienteId, perfil, onSalvo, onClose);
  const { formCliente, set, setAnamnese, toggleEtiqueta, criarEtiqueta, etiquetasDb, carregando, salvando, buscarCep, buscandoCep } = fc;

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

  const dataCadastro = formCliente.created_at
    ? new Date(formCliente.created_at).toLocaleDateString('pt-BR')
    : null;

  // ─── Conflito: cliente já existe nesta unidade ───────────────────────────
  if (fc.clienteConflito) {
    return (
      <div style={{ ...overlayModal, zIndex: 10000 }}>
        <div style={{ ...containerModal, padding: 32, width: 450 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <FiAlertTriangle size={28} color={C.warningText} />
            <h3 className="font-title" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.warningText }}>Cliente já cadastrado</h3>
          </div>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: C.textMain, lineHeight: 1.5, fontWeight: 500 }}>
            Já existe um cliente com esses dados nesta unidade:
          </p>
          <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: RAIO_MD, padding: 16, marginBottom: 24 }}>
            <p className="font-title" style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 15, color: C.sidebarBg }}>{fc.clienteConflito.nome_completo}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={() => fc.editarClienteConflito(fc.clienteConflito)}
              style={{ padding: '12px 0', fontSize: 13, fontWeight: 600, background: C.sidebarBg, color: '#fff', border: 'none', borderRadius: RAIO_MD, cursor: 'pointer' }}>
              Editar a ficha existente
            </button>
            <button onClick={() => fc.setClienteConflito(null)}
              style={{ padding: '10px 0', fontSize: 13, fontWeight: 500, background: 'transparent', color: C.textMuted, border: 'none', cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="font-body" style={{ ...overlayModal, zIndex: 10000 }}>
      <div style={{
        ...containerModal, width: '100%',
        maxWidth: 720, maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* CABEÇALHO */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 28px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <input type="file" ref={fileInputRef} onChange={fc.handleUploadFoto} accept="image/*" style={{ display: 'none' }} />
            <div onClick={() => fileInputRef.current?.click()} title="Alterar foto" style={{
              width: 44, height: 44, borderRadius: RAIO_LG, background: C.sidebarBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: C.douradoEleva, fontWeight: 800, fontSize: 16, overflow: 'hidden', cursor: 'pointer',
              opacity: formCliente.ativo === false ? 0.5 : 1,
            }}>
              {formCliente.foto_url
                ? <img src={formCliente.foto_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                : <FiCamera size={18} />
              }
            </div>
            <div>
              <h3 className="font-title" style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.sidebarBg, display: 'flex', alignItems: 'center', gap: 8 }}>
                {formCliente.nome_completo || 'Novo Cliente'}
                {formCliente.ativo === false && (
                  <span style={{ fontSize: 9, background: C.dangerBg, color: C.dangerText, padding: '3px 6px', borderRadius: 4 }}>ARQUIVADO</span>
                )}
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
            const desabilitada = !formCliente.id && (id === 'historico' || id === 'assinatura' || id === 'fidelidade');
            const ativa = abaAtiva === id;
            return (
              <button key={id} onClick={() => !desabilitada && setAbaAtiva(id)} className="font-title"
                title={desabilitada ? 'Salve a ficha primeiro' : (bloqueada ? 'Módulo não contratado — clique para contratar' : undefined)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '10px 14px', background: 'none', border: 'none',
                  borderBottom: ativa ? `2px solid ${C.sidebarBg}` : '2px solid transparent',
                  color: desabilitada ? C.borderMid : (bloqueada ? C.textLight : (ativa ? C.sidebarBg : C.textLight)),
                  fontWeight: ativa ? 700 : 500, fontSize: 11, cursor: desabilitada ? 'not-allowed' : 'pointer', opacity: bloqueada ? 0.55 : 1,
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
          {carregando ? (
            <p style={{ textAlign: 'center', color: C.textMuted, padding: 40 }}>Carregando ficha...</p>
          ) : (
            <>
              {abaAtiva === 'identidade'   && <AbaIdentidade formCliente={formCliente} set={set} />}
              {abaAtiva === 'contatos'     && <AbaContatos formCliente={formCliente} set={set} />}
              {abaAtiva === 'preferencias' && <AbaPreferencias formCliente={formCliente} set={set} etiquetasDb={etiquetasDb} toggleEtiqueta={toggleEtiqueta} criarEtiqueta={criarEtiqueta} />}
              {abaAtiva === 'endereco'     && <AbaEndereco formCliente={formCliente} set={set} buscarCep={buscarCep} buscandoCep={buscandoCep} />}
              {abaAtiva === 'anamnese'     && <AbaAnamnese formCliente={formCliente} setAnamnese={setAnamnese} />}
              {abaAtiva === 'historico'    && <AbaHistorico carregando={fc.carregandoHistorico} historicoAgendamentos={fc.historicoAgendamentos} comprasProdutos={fc.comprasProdutos} />}
              {abaAtiva === 'assinatura' && formCliente.id && (
                <AbaAssinaturaCliente perfil={perfil} clienteId={formCliente.id} />
              )}

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
            </>
          )}
        </div>

        {/* RODAPÉ */}
        <div style={{ display: 'flex', gap: 10, padding: '16px 28px', borderTop: `1px solid ${C.border}`, alignItems: 'center' }}>
          {dataCadastro && <span style={{ fontSize: 11, color: C.textLight, flex: 1 }}>Cadastrado em {dataCadastro}</span>}
          {!dataCadastro && <span style={{ flex: 1 }} />}
          {formCliente.id && (
            <button onClick={fc.alternarArquivado}
              style={{ padding: '12px 18px', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, background: formCliente.ativo !== false ? C.dangerBg : '#E8F0EA', color: formCliente.ativo !== false ? C.dangerText : '#3B4A3F', border: 'none', borderRadius: RAIO_MD, cursor: 'pointer' }}>
              <FiArchive size={14} /> {formCliente.ativo !== false ? 'Arquivar nesta Unidade' : 'Reativar nesta Unidade'}
            </button>
          )}
          <button onClick={onClose}
            style={{ padding: '12px 20px', fontSize: 13, fontWeight: 500, background: 'transparent', color: C.textMuted, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={fc.salvar} disabled={salvando} className="transition-all hover:opacity-90"
            style={{ padding: '12px 24px', fontSize: 13, fontWeight: 700, background: C.sidebarBg, color: '#fff', border: 'none', borderRadius: RAIO_MD, cursor: salvando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: salvando ? 0.7 : 1 }}>
            <FiSave size={16} /> {salvando ? 'Salvando...' : 'Salvar Ficha'}
          </button>
        </div>
      </div>
    </div>
  );
}
