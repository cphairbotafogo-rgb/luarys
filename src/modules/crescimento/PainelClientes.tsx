'use client'
/**
 * src/modules/crescimento/PainelClientes.tsx
 *
 * Cards clicáveis que filtram a lista de clientes abaixo.
 * Botão WhatsApp ao lado de cada nome + edição inline do texto da mensagem.
 */

import { useState, useEffect } from 'react';
import { C } from '@/lib/constants';
import { RAIO_SM, RAIO_LG, RAIO_MD, RAIO_XL } from '@/lib/estiloGlobal';
import { FiAlertTriangle, FiUserX, FiTarget, FiUsers, FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import { type ClienteRisco, MENSAGEM_RECUPERACAO_PADRAO, montarMensagem, gerarLinkWhatsapp } from './tipos';
import { CardMetrica, BotaoWhatsappIcone } from './componentes';

type AbaCliente = 'fieis' | 'risco' | 'perdidos' | 'novos';

interface Props {
  fieis: ClienteRisco[];
  emRisco: ClienteRisco[];
  perdidos: ClienteRisco[];
  novos: ClienteRisco[];
  taxaRetencao: number;
  mensagemTemplate?: string;
}

export function PainelClientes({ fieis, emRisco, perdidos, novos, taxaRetencao, mensagemTemplate }: Props) {
  const [enviados, setEnviados] = useState<Set<string>>(new Set());
  const [aba, setAba] = useState<AbaCliente>('risco');
  const [templateLocal, setTemplateLocal] = useState(mensagemTemplate || MENSAGEM_RECUPERACAO_PADRAO);
  const [editandoMsg, setEditandoMsg] = useState(false);
  const [rascunho, setRascunho] = useState(templateLocal);

  // Sincroniza quando o prop muda (ex: automação salva em Configurações)
  useEffect(() => {
    if (mensagemTemplate) { setTemplateLocal(mensagemTemplate); setRascunho(mensagemTemplate); }
  }, [mensagemTemplate]);

  function enviarMensagem(cliente: ClienteRisco) {
    const mensagem = montarMensagem(templateLocal, cliente.nome);
    window.open(gerarLinkWhatsapp(cliente.telefone || '', mensagem), '_blank');
    setEnviados(prev => new Set(prev).add(cliente.id));
  }

  function salvarRascunho() {
    setTemplateLocal(rascunho);
    setEditandoMsg(false);
  }

  function cancelarEdicao() {
    setRascunho(templateLocal);
    setEditandoMsg(false);
  }

  const configAbas: Record<AbaCliente, { lista: ClienteRisco[]; label: string; corDias: string; vazio: string }> = {
    fieis:   { lista: fieis,    label: 'Fiéis',     corDias: '#16A34A', vazio: 'Nenhum cliente fiel ainda.' },
    risco:   { lista: emRisco,  label: 'Em Risco',  corDias: '#D97706', vazio: 'Nenhum cliente em risco. 🎉' },
    perdidos:{ lista: perdidos, label: 'Perdidos',  corDias: '#EF4444', vazio: 'Nenhum cliente perdido. 🎉' },
    novos:   { lista: novos,    label: 'Novos',     corDias: '#3B82F6', vazio: 'Nenhum cliente novo no período.' },
  };

  const { lista, corDias, vazio } = configAbas[aba];

  return (
    <div style={{ background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <FiTarget size={16} color={C.sidebarBg} />
        <span style={{ fontSize: 13, fontWeight: 700, color: C.textMain }}>Quem está deixando de voltar</span>
      </div>

      {/* Cards de resumo — clicáveis */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        <CardMetrica
          valor={fieis.length} label="Fiéis" sublabel="≤ 45 dias"
          bg="#F0FDF4" cor="#16A34A" icone={<FiUsers size={16} color="#16A34A" />}
          ativo={aba === 'fieis'} onClick={() => setAba('fieis')}
        />
        <CardMetrica
          valor={emRisco.length} label="Em Risco" sublabel="46–90 dias"
          bg={emRisco.length > 0 ? "#FFFBEB" : "#F8FAFC"}
          cor={emRisco.length > 0 ? "#D97706" : "#64748B"}
          icone={<FiAlertTriangle size={16} color={emRisco.length > 0 ? "#D97706" : "#64748B"} />}
          ativo={aba === 'risco'} onClick={() => setAba('risco')}
        />
        <CardMetrica
          valor={perdidos.length} label="Perdidos" sublabel="+90 dias"
          bg="#FEF2F2" cor="#EF4444" icone={<FiUserX size={16} color="#EF4444" />}
          ativo={aba === 'perdidos'} onClick={() => setAba('perdidos')}
        />
        <CardMetrica
          valor={novos.length} label="Novos" sublabel="1ª visita"
          bg="#EFF6FF" cor="#3B82F6" icone={<FiTarget size={16} color="#3B82F6" />}
          ativo={aba === 'novos'} onClick={() => setAba('novos')}
        />
      </div>

      {/* Taxa de retenção */}
      <div style={{ background: C.sidebarBg, borderRadius: RAIO_LG, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
        <div>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Taxa de Retenção</p>
          <p style={{ margin: '2px 0 0', fontSize: 30, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{taxaRetencao}%</p>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ height: 7, background: 'rgba(255,255,255,0.1)', borderRadius: RAIO_MD, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: RAIO_MD, width: `${taxaRetencao}%`, background: taxaRetencao >= 70 ? C.success : taxaRetencao >= 50 ? C.douradoEleva : C.danger }} />
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
            Meta: 70% de clientes fiéis
          </p>
        </div>
      </div>

      {/* Mensagem WhatsApp — editável */}
      <div style={{ marginBottom: 16, border: `1px solid ${C.border}`, borderRadius: RAIO_LG, overflow: 'hidden' }}>
        <div style={{ padding: '8px 14px', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: C.textLight, textTransform: 'uppercase' }}>
            Mensagem enviada pelo WhatsApp
          </span>
          {!editandoMsg ? (
            <button
              onClick={() => { setRascunho(templateLocal); setEditandoMsg(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: C.textMuted, padding: '2px 6px', borderRadius: RAIO_SM }}
            >
              <FiEdit2 size={11} /> Editar
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={salvarRascunho}
                style={{ display: 'flex', alignItems: 'center', gap: 3, background: C.sidebarBg, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#fff', padding: '3px 10px', borderRadius: RAIO_SM }}
              >
                <FiCheck size={11} /> Salvar
              </button>
              <button
                onClick={cancelarEdicao}
                style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: `1px solid ${C.border}`, cursor: 'pointer', fontSize: 11, fontWeight: 700, color: C.textMuted, padding: '3px 8px', borderRadius: RAIO_SM }}
              >
                <FiX size={11} />
              </button>
            </div>
          )}
        </div>
        {editandoMsg ? (
          <textarea
            value={rascunho}
            onChange={e => setRascunho(e.target.value)}
            rows={3}
            placeholder="Use {nome_do_cliente} para personalizar"
            style={{
              width: '100%', padding: '10px 14px', fontSize: 12, color: C.textMain,
              background: C.bgCard, border: 'none', resize: 'vertical', outline: 'none',
              fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box',
            }}
          />
        ) : (
          <p style={{ margin: 0, padding: '10px 14px', fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
            {templateLocal}
          </p>
        )}
        {editandoMsg && (
          <p style={{ margin: 0, padding: '4px 14px 8px', fontSize: 10, color: C.textLight }}>
            Use <code style={{ background: C.border, padding: '1px 4px', borderRadius: 3 }}>{'{nome_do_cliente}'}</code> para inserir o primeiro nome automaticamente.
          </p>
        )}
      </div>

      {/* Lista da aba selecionada */}
      {lista.length === 0 ? (
        <p style={{ fontSize: 12, color: C.textLight, fontStyle: 'italic', textAlign: 'center', padding: 24 }}>
          {vazio}
        </p>
      ) : (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: RAIO_LG, overflow: 'hidden' }}>
          <div style={{ padding: '8px 14px', background: C.bg, borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: C.textLight, textTransform: 'uppercase' }}>
              {configAbas[aba].label} · {lista.length} clientes
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                {['Cliente', 'Dias', 'Visitas'].map(h => (
                  <th key={h} style={{ padding: '8px 14px', fontSize: 10, fontWeight: 800, color: C.textLight, textTransform: 'uppercase', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.slice(0, 20).map(c => (
                <tr key={c.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.textMain }}>{c.nome}</span>
                      <BotaoWhatsappIcone
                        aceitaCampanhas={c.aceitaCampanhas}
                        aceitaMarketing={c.aceitaMarketing}
                        onEnviar={() => enviarMensagem(c)}
                        enviado={enviados.has(c.id)}
                      />
                    </div>
                    {c.telefone && (
                      <span style={{ fontSize: 10, color: C.textLight }}>{c.telefone}</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: corDias, whiteSpace: 'nowrap' }}>
                    {aba === 'novos' ? '1ª visita' : `${c.dias}d`}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: C.textMuted }}>{c.visitas}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {lista.length > 20 && (
            <div style={{ padding: '10px 14px', fontSize: 11, color: C.textLight, textAlign: 'center', borderTop: `1px solid ${C.border}` }}>
              + {lista.length - 20} clientes não exibidos
            </div>
          )}
        </div>
      )}
    </div>
  );
}
