// src/modules/crm/ModalCliente.tsx
// Modal de cadastro/edição de cliente com 4 abas:
// Informações | Histórico | Anamnese | Regras
'use client'
import { C, brl } from '@/lib/constants';
import { overlayModal, containerModal, RAIO_MD, RAIO_LG, RAIO_XL } from '@/lib/estiloGlobal';
import { Badge } from '@/components/ui';
import {
  FiUser, FiCalendar, FiFileText, FiSettings, FiCheck,
  FiAlertTriangle, FiCamera, FiClock, FiPlus, FiX, FiShoppingBag, FiStar,
} from 'react-icons/fi';
import { DDIS } from '@/lib/ddis';
import { AbaAssinaturaCliente } from './assinatura/AbaAssinaturaCliente';

const inputStyle = { padding: '12px 14px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, width: '100%', boxSizing: 'border-box' as const, outlineColor: C.sidebarBg, fontSize: 13, color: C.textMain, backgroundColor: C.bgCard, fontWeight: 500, fontFamily: 'var(--font-body)' };
const labelStyle = { margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: C.textMuted, display: 'block', textTransform: 'uppercase' as const, letterSpacing: '0.5px' };
const tabStyle   = (ativa: boolean) => ({ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: ativa ? C.sidebarBg : 'transparent', color: ativa ? '#fff' : C.textMuted, border: 'none', borderRadius: RAIO_MD, fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'var(--font-body)' });

const formatarData = (d: string) => !d ? '--/--/----' : d.split('T')[0].split('-').reverse().join('/');

interface Props {
  crm: ReturnType<any>; // retorno completo de useAbaCRM
  perfil?: any;
}

export function ModalCliente({ crm, perfil }: Props) {
  if (!crm.modalAberto) return null;
  const { form, setForm, editandoIdGlobal, abaModal, setAbaModal, subindoFoto, fileInputRef } = crm;

  return (
    <div style={{ ...overlayModal }}>

      {/* Conflito de cliente */}
      {crm.clienteConflito ? (
        <div style={{ ...containerModal, padding: 32, width: 450 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <FiAlertTriangle size={28} color={C.warningText} />
            <h3 className="font-title" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.warningText }}>Cliente já vinculado</h3>
          </div>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: C.textMain, lineHeight: 1.5, fontWeight: 500 }}>
            O cliente abaixo já está cadastrado nesta unidade:
          </p>
          <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: RAIO_MD, padding: 16, marginBottom: 24 }}>
            <p className="font-title" style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 15, color: C.sidebarBg }}>{crm.clienteConflito.nome_completo}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={() => { crm.setClienteConflito(null); crm.abrirEdicao(crm.clienteConflito); }}
              style={{ padding: '12px 0', fontSize: 13, fontWeight: 600, background: C.sidebarBg, color: '#fff', border: 'none', borderRadius: RAIO_MD, cursor: 'pointer' }}>
              Editar a ficha existente
            </button>
            <button onClick={() => crm.setClienteConflito(null)}
              style={{ padding: '10px 0', fontSize: 13, fontWeight: 500, background: 'transparent', color: C.textMuted, border: 'none', cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div style={{ ...containerModal, padding: 32, width: '100%', maxWidth: 750, maxHeight: '90vh', overflowY: 'auto' }}>

          {/* Cabeçalho */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <input type="file" ref={fileInputRef} onChange={crm.handleUploadFoto} accept="image/*" style={{ display: 'none' }} />
              <div onClick={() => fileInputRef.current?.click()}
                style={{ width: 60, height: 60, borderRadius: RAIO_XL, background: C.bg, border: `1px dashed ${C.borderMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', filter: !form.ativo ? 'grayscale(100%)' : 'none' }}>
                {form.foto_url
                  ? <img src={form.foto_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Avatar" />
                  : <span style={{ color: C.textLight }}>{subindoFoto ? <FiClock size={20} /> : <FiCamera size={20} />}</span>}
              </div>
              <h3 className="font-title" style={{ margin: 0, fontSize: 18, fontWeight: 700, color: !form.ativo ? C.textMuted : C.sidebarBg }}>
                {editandoIdGlobal ? form.nome : <><FiPlus size={18} /> Novo Cliente</>}
              </h3>
            </div>
            <button onClick={() => crm.setModalAberto(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLight }}>
              <FiX size={24} />
            </button>
          </div>

          {/* Abas */}
          <div style={{ display: 'flex', gap: 8, background: C.bg, padding: 6, borderRadius: RAIO_LG, marginBottom: 24, overflowX: 'auto' }}>
            {([['dados', 'Informações', FiUser], ['historico', 'Histórico', FiCalendar], ['assinatura', 'Assinatura', FiStar], ['anamnese', 'Anamnese', FiFileText], ['config', 'Regras', FiSettings]] as const).map(([id, label, Icon]) => (
              <button key={id} type="button" style={tabStyle(abaModal === id)} onClick={() => setAbaModal(id)}>
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>

          {/* Conteúdo */}
          <div style={{ minHeight: 350 }}>

            {abaModal === 'dados' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Nome Completo *</label>
                    <input style={inputStyle} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} disabled={!form.ativo} />
                  </div>
                  <div>
                    <label style={labelStyle}>WhatsApp *</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select
                        value={form.ddi}
                        onChange={e => setForm({ ...form, ddi: e.target.value })}
                        disabled={!form.ativo}
                        title="Código do país (DDI)"
                        style={{ ...inputStyle, width: '110px', padding: '12px 6px', cursor: 'pointer', flexShrink: 0 }}
                      >
                        {DDIS.map(d => (
                          <option key={d.code} value={d.code}>{d.code} {d.emoji} {d.nome}</option>
                        ))}
                      </select>
                      <input
                        style={{ ...inputStyle, flex: 1 }}
                        placeholder="(11) 99999-9999"
                        value={form.telefone}
                        onChange={e => setForm({ ...form, telefone: e.target.value })}
                        disabled={!form.ativo}
                      />
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: 10, color: C.textLight, fontWeight: 500 }}>
                      {form.ddi} {form.telefone ? `→ wa.me/${(form.ddi + form.telefone).replace(/\D/g, '')}` : ''}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  <div><label style={labelStyle}>CPF</label><input style={inputStyle} value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} disabled={!form.ativo} /></div>
                  <div><label style={labelStyle}>Nascimento</label><input type="date" style={inputStyle} value={form.nascimento} onChange={e => setForm({ ...form, nascimento: e.target.value })} disabled={!form.ativo} /></div>
                  <div>
                    <label style={labelStyle}>Gênero</label>
                    <select style={inputStyle} value={form.genero} onChange={e => setForm({ ...form, genero: e.target.value })} disabled={!form.ativo}>
                      <option value="">Não informado</option><option value="Feminino">Feminino</option><option value="Masculino">Masculino</option><option value="Outro">Outro</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  <div><label style={labelStyle}>E-mail</label><input type="email" style={inputStyle} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} disabled={!form.ativo} /></div>
                  <div><label style={labelStyle}>Instagram</label><input style={inputStyle} placeholder="@usuario" value={form.instagram} onChange={e => setForm({ ...form, instagram: e.target.value })} disabled={!form.ativo} /></div>
                  <div>
                    <label style={labelStyle}>Origem</label>
                    <select style={inputStyle} value={form.como_conheceu} onChange={e => setForm({ ...form, como_conheceu: e.target.value })} disabled={!form.ativo}>
                      <option value="">Selecione...</option>
                      <option value="Instagram">Instagram</option>
                      <option value="Indicação">Indicação</option>
                      <option value="Passou na frente">Passou na frente</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Observações desta Unidade</label>
                  <textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} disabled={!form.ativo} style={{ ...inputStyle, height: 80, resize: 'none' } as any} />
                </div>

                {/* Preferência de marketing definida pelo próprio cliente no portal */}
                {crm.sel?.aceita_marketing === false && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: RAIO_MD, background: '#FEF3C7', border: '1px solid #FDE68A' }}>
                    <FiAlertTriangle size={14} color="#B45309" style={{ flexShrink: 0 }} />
                    <p style={{ margin: 0, fontSize: 12, color: '#92400E', fontWeight: 600 }}>
                      Este cliente optou por <strong>não receber marketing</strong>. Exclua-o dos disparos em massa. Lembretes de agendamento podem ser enviados normalmente.
                    </p>
                  </div>
                )}
              </div>
            )}

            {abaModal === 'historico' && (() => {
              // Total gasto e ticket médio calculados dos registros REAIS desta unidade
              // (serviços finalizados + compras de produtos) — reflete produtos e não
              // depende do contador denormalizado do CRM.
              const servicosFin = crm.historicoAgendamentos.filter((a: any) => a.status === 'Finalizado');
              const gastoServicos = servicosFin.reduce((s: number, a: any) => s + (Number(a.valor_final) || 0), 0);
              const gastoProdutos = crm.comprasProdutos.reduce((s: number, c: any) => s + (Number(c.valor_total) || 0), 0);
              const totalGastoReal = gastoServicos + gastoProdutos;
              const nAtendimentos = servicosFin.length + crm.comprasProdutos.length;
              const ticketMedio = nAtendimentos > 0 ? totalGastoReal / nAtendimentos : 0;
              return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {crm.carregandoHistorico ? (
                  <p style={{ color: C.textMuted, textAlign: 'center', padding: 20, fontWeight: 500 }}>A buscar o histórico...</p>
                ) : (crm.historicoAgendamentos.length === 0 && crm.comprasProdutos.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: 60, color: C.textLight }}>
                    <FiCalendar size={40} color={C.borderMid} style={{ marginBottom: 16 }} />
                    <h3 className="font-title" style={{ color: C.textMain, margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Nenhum registro nesta unidade</h3>
                  </div>
                ) : (
                  <>
                    {/* Resumo real (serviços + produtos) */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 4 }}>
                      {[
                        { label: 'Total Gasto', val: brl(totalGastoReal) },
                        { label: 'Ticket Médio', val: brl(ticketMedio) },
                        { label: 'Atendimentos', val: String(nAtendimentos) },
                      ].map(({ label, val }) => (
                        <div key={label} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: RAIO_LG, padding: '12px 14px', textAlign: 'center' }}>
                          <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 800, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
                          <p className="font-title" style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.sidebarBg }}>{val}</p>
                        </div>
                      ))}
                    </div>
                    {crm.historicoAgendamentos.length > 0 && (
                      <>
                        <p className="font-title uppercase" style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 800, color: C.textLight, letterSpacing: '0.5px' }}>Serviços</p>
                        {crm.historicoAgendamentos.map((ag: any) => (
                          <div key={ag.id} style={{ padding: 16, border: `1px solid ${C.border}`, borderRadius: RAIO_LG, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.bg }}>
                            <div>
                              <p className="font-title" style={{ margin: '0 0 4px', fontWeight: 700, color: C.sidebarBg, fontSize: 14 }}>{ag.servicos?.nome_servico || 'Serviço Personalizado'}</p>
                              <p style={{ margin: 0, fontSize: 12, color: C.textLight, fontWeight: 500 }}>{formatarData(ag.data)} às {ag.inicio}</p>
                            </div>
                            <Badge label={ag.status} style={{ bg: ag.status === 'Finalizado' ? '#F4F8F5' : '#F1F5F9', color: ag.status === 'Finalizado' ? '#3B4A3F' : C.textMuted }} />
                          </div>
                        ))}
                      </>
                    )}

                    {crm.comprasProdutos.length > 0 && (
                      <>
                        <p className="font-title uppercase" style={{ margin: '12px 0 2px', fontSize: 10, fontWeight: 800, color: C.textLight, letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <FiShoppingBag size={12} /> Compras de Produtos
                        </p>
                        {crm.comprasProdutos.map((compra: any) => (
                          <div key={compra.id} style={{ padding: 16, border: `1px solid ${C.border}`, borderRadius: RAIO_LG, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: C.bg, gap: 12 }}>
                            <div style={{ flex: 1 }}>
                              <p className="font-title" style={{ margin: '0 0 4px', fontWeight: 700, color: C.sidebarBg, fontSize: 13, lineHeight: 1.4 }}>
                                {(compra.itens || []).map((it: any) => `${it.nome}${it.qtd > 1 ? ` ×${it.qtd}` : ''}`).join(', ') || 'Produtos'}
                              </p>
                              <p style={{ margin: 0, fontSize: 12, color: C.textLight, fontWeight: 500 }}>{formatarData(compra.data_hora)} · {compra.forma_pagamento || '—'}</p>
                            </div>
                            <span className="font-title" style={{ fontWeight: 700, color: C.success, fontSize: 14, whiteSpace: 'nowrap' }}>{brl(compra.valor_total || 0)}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
              );
            })()}

            {abaModal === 'assinatura' && (
              <AbaAssinaturaCliente perfil={perfil} clienteId={editandoIdGlobal} clienteNome={form.nome} />
            )}

            {abaModal === 'anamnese' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: C.bg, padding: 16, borderRadius: RAIO_MD, border: `1px solid ${C.border}` }}>
                  <p style={{ margin: 0, fontSize: 12, color: C.textMain, fontWeight: 600 }}>Anamnese exclusiva para esta unidade.</p>
                </div>
                <textarea placeholder="Ex: Fio processado com descoloração há 3 meses..." value={form.anamnese} onChange={e => setForm({ ...form, anamnese: e.target.value })} disabled={!form.ativo} style={{ ...inputStyle, height: 240, resize: 'none' } as any} />
              </div>
            )}

            {abaModal === 'config' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ background: C.bg, padding: 24, borderRadius: RAIO_XL, border: `1px solid ${C.border}` }}>
                  <h4 className="font-title" style={{ margin: '0 0 16px', fontSize: 12, color: C.textMain, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Preferências Locais</h4>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: C.textMain, cursor: 'pointer', fontWeight: 500 }}>
                    <input type="checkbox" disabled={!form.ativo} checked={!!form.notificacoes} onChange={e => setForm({ ...form, notificacoes: e.target.checked })} style={{ accentColor: C.sidebarBg, width: 16, height: 16 }} />
                    Lembretes Automáticos
                  </label>
                </div>
                <div style={{ background: form.ativo ? '#FEF2F2' : '#F4F8F5', padding: 24, borderRadius: RAIO_XL, border: form.ativo ? '1px solid #FECACA' : '1px solid #E8F0EA' }}>
                  <h4 className="font-title" style={{ margin: '0 0 8px', fontSize: 12, color: form.ativo ? C.dangerText : '#3B4A3F', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Status nesta Unidade</h4>
                  <p style={{ margin: '0 0 16px', fontSize: 12, color: form.ativo ? C.danger : '#6B7280', fontWeight: 500 }}>{form.ativo ? 'Pode ser agendado.' : 'Arquivado nesta unidade.'}</p>
                </div>
              </div>
            )}
          </div>

          {/* Rodapé */}
          <div style={{ display: 'flex', gap: 12, marginTop: 24, paddingTop: 24, borderTop: `1px solid ${C.border}` }}>
            <button onClick={crm.salvarCliente} disabled={!form.ativo}
              style={{ flex: 2, padding: '12px 0', fontSize: 13, fontWeight: 600, background: C.sidebarBg, color: '#fff', border: 'none', borderRadius: RAIO_MD, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: form.ativo ? 'pointer' : 'not-allowed', opacity: form.ativo ? 1 : 0.5 }}>
              <FiCheck size={18} /> {editandoIdGlobal ? 'Salvar Ficha' : 'Cadastrar Cliente'}
            </button>
            {editandoIdGlobal && (
              <button onClick={crm.handleAlternarStatusCliente}
                style={{ flex: 1.5, padding: '12px 0', fontSize: 13, fontWeight: 600, background: form.ativo ? C.dangerBg : '#E8F0EA', color: form.ativo ? C.dangerText : '#3B4A3F', border: 'none', borderRadius: RAIO_MD, cursor: 'pointer' }}>
                {form.ativo ? 'Arquivar nesta Unidade' : 'Reativar nesta Unidade'}
              </button>
            )}
            <button onClick={() => crm.setModalAberto(false)}
              style={{ flex: 1, padding: '12px 0', fontSize: 13, fontWeight: 500, background: 'transparent', color: C.textMuted, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
