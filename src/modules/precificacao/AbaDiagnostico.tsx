'use client'
/**
 * src/modules/precificacao/AbaDiagnostico.tsx
 *
 * Aba "Diagnóstico da Tabela": varre todos os serviços do salão,
 * calcula o preço ideal de cada um, exibe semáforo verde/amarelo/vermelho,
 * e classifica por rentabilidade real (lucro por hora no preço já cobrado).
 *
 * Lógica de cálculo centralizada em useDiagnosticoCatalogo.ts (compartilhada
 * com o Dashboard Executivo).
 */

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/constants';
import { FiSearch, FiTrendingUp, FiTrendingDown } from 'react-icons/fi';
import { RAIO_MD, RAIO_XL, RAIO_LG, RAIO_SM, cardAdmin } from '@/lib/estiloGlobal';
import { type ConfigCustos, type FormCalculo, brl, classificarLucroHora, type AlertaServico } from './tipos';
import { Alerta } from './componentes';
import { ModalComparacaoPreco } from './ModalComparacaoPreco';
import { useDiagnosticoCatalogo } from './useDiagnosticoCatalogo';

interface Props {
  perfil: any;
  config: ConfigCustos;
  form: FormCalculo;
}

export function AbaDiagnostico({ perfil, config, form }: Props) {
  const { servicos, carregando, carregado, erro, carregarDiagnostico } = useDiagnosticoCatalogo(perfil, config, form);
  const [alertasExpandido, setAlertasExpandido] = useState(false);
  const [abaixoIdealExpandido, setAbaixoIdealExpandido] = useState(false);
  const [servicoIdComparando, setServicoIdComparando] = useState<string | null>(null);

  const servicoComparando = servicoIdComparando ? servicos.find(s => s.id === servicoIdComparando) : null;

  async function salvarNovoPreco(servicoId: string, novoPreco: number) {
    await supabase.from('servicos').update({ preco_padrao: novoPreco }).eq('id', servicoId);
    setServicoIdComparando(null);
    carregarDiagnostico(); // recarrega para refletir o novo preço no diagnóstico
  }

  async function salvarDetalhesServico(
    servicoId: string,
    detalhes: { duracao_minutos: number; nbs: string; codigo_municipio: string; aliquota_iss: number; eh_cortesia: boolean }
  ) {
    await supabase.from('servicos').update({
      duracao_minutos: detalhes.duracao_minutos,
      nbs: detalhes.nbs || null,
      codigo_municipio: detalhes.codigo_municipio || null,
      aliquota_iss: detalhes.aliquota_iss,
      eh_cortesia: detalhes.eh_cortesia,
    }).eq('id', servicoId);
    // Não fecha o modal — o dono pode querer ajustar o preço em seguida
    // depois de mudar a duração. Só recarrega o diagnóstico para refletir
    // o novo preço ideal (a duração afeta o cálculo de custo/hora).
    carregarDiagnostico();
  }

  // Estado inicial — ainda não rodou
  if (!carregado && !carregando) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <FiSearch size={32} color={C.textLight} style={{ marginBottom: 16, opacity: 0.5 }} />
        <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 20 }}>
          Analisa todos os serviços cadastrados e compara o preço atual com o ideal calculado.
        </p>
        <button
          onClick={carregarDiagnostico}
          style={{ padding: '12px 28px', borderRadius: RAIO_LG, border: 'none', background: C.sidebarBg, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          Analisar meu catálogo
        </button>
        <p style={{ fontSize: 11, color: C.textLight, marginTop: 12 }}>
          Usa a configuração de custos da aba Calculadora (comissão {form.percentComissao}%, margem {form.margemDesejada}%, imposto {config.aliquotaImposto}%)
        </p>
      </div>
    );
  }

  if (carregando) {
    return <div style={{ textAlign: 'center', padding: 60, color: C.textMuted, fontSize: 13 }}>Analisando serviços...</div>;
  }

  // Cortesia conta como "Preço saudável" — é uma escolha deliberada do
  // dono (ex: retoque grátis), não um problema de precificação a corrigir.
  const ok       = servicos.filter(s => s.status === 'ok' || s.status === 'cortesia').length;
  const atencao  = servicos.filter(s => s.status === 'atencao').length;
  const prejuizo = servicos.filter(s => s.status === 'prejuizo').length;

  // Agrega todos os alertas de todos os serviços, críticos primeiro
  const todosAlertas: AlertaServico[] = servicos.flatMap(s => s.alertasServico || []);
  const alertasCriticos = todosAlertas.filter(a => a.nivel === 'critico');
  const alertasAtencao  = todosAlertas.filter(a => a.nivel === 'atencao');

  // "Abaixo do Ideal" — preço atual pelo menos 15% menor que o preço ideal
  // calculado (ver status 'prejuizo' em useDiagnosticoCatalogo.ts). NÃO é
  // o mesmo que os alertas críticos: aqui pode haver serviço que ainda dá
  // lucro real, só está abaixo do potencial. Listado à parte para o dono
  // poder revisar e ajustar um por um, sem confundir com os alertas de
  // rentabilidade (que são sobre margem/prejuízo de fato).
  const abaixoDoIdeal = servicos.filter(s => s.status === 'prejuizo');

  // Ranking: só entram serviços com duração e preço cadastrados (senão o
  // número não significa nada e só confunde o dono).
  const elegiveisRanking = servicos.filter(s => s.preco_padrao > 0 && s.duracao_minutos > 0);
  const maisLucrativos   = [...elegiveisRanking].sort((a, b) => b.lucroHoraReal - a.lucroHoraReal).slice(0, 5);
  const menosLucrativos  = [...elegiveisRanking].sort((a, b) => a.lucroHoraReal - b.lucroHoraReal).slice(0, 5);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button
          onClick={carregarDiagnostico}
          style={{ fontSize: 11, color: C.sidebarBg, background: 'none', border: `1px solid ${C.borderMid}`, borderRadius: RAIO_SM, padding: '5px 12px', cursor: 'pointer', fontWeight: 700 }}
        >
          Reanalisar
        </button>
      </div>

      {/* Cards de resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Preço saudável', count: ok,       cor: C.success, bg: C.successBg },
          { label: 'Margem apertada', count: atencao,  cor: '#D97706', bg: '#FFFBEB' },
          { label: 'Abaixo do Ideal', count: prejuizo, cor: C.danger,  bg: C.dangerBg },
        ].map(item => (
          <div key={item.label} style={{ background: item.bg, borderRadius: RAIO_LG, padding: '16px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: item.cor }}>{item.count}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: item.cor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.label}</div>
          </div>
        ))}
      </div>

      {config.custoFixoMensal === 0 && (
        <Alerta tipo="aviso" texto="Custo Fixo Mensal está zerado — o diagnóstico não considera estrutura. Preencha na aba Calculadora para análise precisa." />
      )}

      {erro ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <FiSearch size={28} color={C.dangerText} style={{ marginBottom: 12, opacity: 0.7 }} />
          <p style={{ fontSize: 13, color: C.dangerText, margin: '0 0 4px', fontWeight: 700 }}>Não foi possível analisar o catálogo.</p>
          <p style={{ fontSize: 12, color: C.textLight, margin: '0 0 16px' }}>{erro}</p>
          <button
            onClick={carregarDiagnostico}
            style={{ padding: '10px 24px', borderRadius: RAIO_MD, border: 'none', background: C.sidebarBg, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            Tentar novamente
          </button>
        </div>
      ) : servicos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>
          <p style={{ fontSize: 13, margin: 0 }}>Nenhum serviço encontrado no catálogo.</p>
          <p style={{ fontSize: 12, color: C.textLight, margin: '4px 0 0' }}>Cadastre serviços em "Serviços e Preços" para ver o diagnóstico.</p>
        </div>
      ) : (
        <>
      {/* ALERTAS INTELIGENTES — resumo compacto, expansível, para não poluir a tela com muitos serviços */}
      {(alertasCriticos.length > 0 || alertasAtencao.length > 0) && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: alertasExpandido ? 10 : 0 }}>
            {alertasCriticos.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.dangerBg, border: '1px solid #FCA5A5', borderRadius: RAIO_MD, padding: '8px 14px', fontSize: 12, fontWeight: 700, color: C.dangerText }}>
                🔴 {alertasCriticos.length} {alertasCriticos.length === 1 ? 'alerta crítico' : 'alertas críticos'}
              </div>
            )}
            {alertasAtencao.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: RAIO_MD, padding: '8px 14px', fontSize: 12, fontWeight: 700, color: '#92400E' }}>
                🟡 {alertasAtencao.length} {alertasAtencao.length === 1 ? 'ponto de atenção' : 'pontos de atenção'}
              </div>
            )}
            <button
              onClick={() => setAlertasExpandido(!alertasExpandido)}
              style={{ fontSize: 12, color: C.sidebarBg, background: 'none', border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, padding: '8px 14px', cursor: 'pointer', fontWeight: 700 }}
            >
              {alertasExpandido ? 'Ocultar detalhes' : 'Ver detalhes'}
            </button>
          </div>

          {alertasExpandido && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              {alertasCriticos.map((a, i) => (
                <div
                  key={`c-${i}`}
                  onClick={() => setServicoIdComparando(a.servicoId)}
                  title="Clique para ver o preço recomendado e ajustar"
                  style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: C.dangerBg, border: '1px solid #FCA5A5', borderRadius: RAIO_MD, padding: '10px 14px', fontSize: 12, color: C.dangerText, cursor: 'pointer' }}
                >
                  <span style={{ flexShrink: 0 }}>🔴</span>
                  <span style={{ flex: 1 }}>{a.texto}</span>
                  <span style={{ flexShrink: 0, fontSize: 11, textDecoration: 'underline', whiteSpace: 'nowrap' }}>Ver e ajustar →</span>
                </div>
              ))}
              {alertasAtencao.map((a, i) => (
                <div
                  key={`a-${i}`}
                  onClick={() => setServicoIdComparando(a.servicoId)}
                  title="Clique para ver o preço recomendado e ajustar"
                  style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: RAIO_MD, padding: '10px 14px', fontSize: 12, color: '#92400E', cursor: 'pointer' }}
                >
                  <span style={{ flexShrink: 0 }}>🟡</span>
                  <span style={{ flex: 1 }}>{a.texto}</span>
                  <span style={{ flexShrink: 0, fontSize: 11, textDecoration: 'underline', whiteSpace: 'nowrap' }}>Ver e ajustar →</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ABAIXO DO IDEAL — preço atual defasado em relação ao ideal calculado,
          mesmo padrão visual e de interação dos alertas acima, mas separado
          porque mede outra coisa (defasagem de preço, não rentabilidade real). */}
      {abaixoDoIdeal.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: abaixoIdealExpandido ? 10 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.dangerBg, border: '1px solid #FCA5A5', borderRadius: RAIO_MD, padding: '8px 14px', fontSize: 12, fontWeight: 700, color: C.dangerText }}>
              🔻 {abaixoDoIdeal.length} {abaixoDoIdeal.length === 1 ? 'serviço abaixo do ideal' : 'serviços abaixo do ideal'}
            </div>
            <button
              onClick={() => setAbaixoIdealExpandido(!abaixoIdealExpandido)}
              style={{ fontSize: 12, color: C.sidebarBg, background: 'none', border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, padding: '8px 14px', cursor: 'pointer', fontWeight: 700 }}
            >
              {abaixoIdealExpandido ? 'Ocultar lista' : 'Ver lista'}
            </button>
          </div>

          {abaixoIdealExpandido && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10, maxHeight: 400, overflowY: 'auto' }}>
              {abaixoDoIdeal.map(s => (
                <div
                  key={s.id}
                  onClick={() => setServicoIdComparando(s.id)}
                  title="Clique para ver o preço recomendado e ajustar"
                  style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: C.dangerBg, border: '1px solid #FCA5A5', borderRadius: RAIO_MD, padding: '10px 14px', fontSize: 12, color: C.dangerText, cursor: 'pointer' }}
                >
                  <span style={{ flexShrink: 0 }}>🔻</span>
                  <span style={{ flex: 1 }}>
                    {s.nome_servico}: cobra {brl(s.preco_padrao)} hoje, ideal calculado é {brl(s.precoIdeal)}.
                  </span>
                  <span style={{ flexShrink: 0, fontSize: 11, textDecoration: 'underline', whiteSpace: 'nowrap' }}>Ver e ajustar →</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* RANKING DE RENTABILIDADE — quanto cada serviço deixa de lucro por hora, no preço que já é cobrado hoje */}
          {elegiveisRanking.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div style={{ ...cardAdmin, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: C.successBg, borderBottom: `1px solid ${C.border}` }}>
                  <FiTrendingUp size={14} color={C.successText} />
                  <span style={{ fontSize: 12, fontWeight: 800, color: C.successText, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mais lucrativos por hora</span>
                </div>
                <div>
                  {maisLucrativos.map((s, i) => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: i < maisLucrativos.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                      <span style={{ fontSize: 13, color: C.textMain, fontWeight: 600 }}>{s.nome_servico}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: C.successText }}>{brl(s.lucroHoraReal)}/h</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ ...cardAdmin, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#FFFBEB', borderBottom: `1px solid ${C.border}` }}>
                  <FiTrendingDown size={14} color="#92400E" />
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Menos lucrativos por hora</span>
                </div>
                <div>
                  {menosLucrativos.map((s, i) => {
                    const cor = classificarLucroHora(s.lucroHoraReal) === 'prejuizo' ? C.dangerText : '#92400E';
                    return (
                      <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: i < menosLucrativos.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                        <span style={{ fontSize: 13, color: C.textMain, fontWeight: 600 }}>{s.nome_servico}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: cor }}>{brl(s.lucroHoraReal)}/h</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div style={{ ...cardAdmin, overflow: 'hidden', marginTop: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                  {['', 'Serviço', 'Preço atual', 'Preço ideal', 'Diferença', 'Lucro/hora hoje'].map((h, i) => (
                    <th key={i} style={{ padding: '12px 16px', fontSize: 10, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase', textAlign: i === 0 ? 'center' : i > 1 ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {servicos.map(s => {
                  const diff     = (s.preco_padrao || 0) - s.precoIdeal;
                  const semaforo = ({ ok: '🟢', atencao: '🟡', prejuizo: '🔴', cortesia: '🎁' } as const)[s.status];
                  const temLucroHora = s.preco_padrao > 0 && s.duracao_minutos > 0;
                  const corLucroHora = classificarLucroHora(s.lucroHoraReal) === 'prejuizo' ? C.dangerText
                    : classificarLucroHora(s.lucroHoraReal) === 'fraco' ? '#92400E' : C.textMain;
                  return (
                    <tr key={s.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 16 }}>{semaforo}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: C.textMain, fontWeight: 600 }}>
                        {s.nome_servico}
                        {s.categoria && <div style={{ fontSize: 10, color: C.textLight, fontWeight: 400 }}>{s.categoria}</div>}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: C.textMain }}>{brl(s.preco_padrao || 0)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: s.precoIdeal > 0 ? C.textMain : C.textLight }}>
                        {s.precoIdeal > 0 ? brl(s.precoIdeal) : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: diff >= 0 ? C.success : C.danger }}>
                        {s.precoIdeal > 0 ? (diff >= 0 ? `+${brl(diff)}` : brl(diff)) : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: corLucroHora }}>
                        {temLucroHora ? `${brl(s.lucroHoraReal)}/h` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 11, color: C.textLight, marginTop: 12, fontStyle: 'italic' }}>
            * Preço ideal calculado com: comissão {form.percentComissao}%, margem {form.margemDesejada}%, imposto {config.aliquotaImposto}%, cartão {config.taxaCartao}%. Lucro/hora calculado sobre o preço que já é cobrado hoje.
          </p>
        </>
      )}

      {servicoComparando && (
        <ModalComparacaoPreco
          servico={servicoComparando}
          config={config}
          form={form}
          onClose={() => setServicoIdComparando(null)}
          onSalvarPreco={(novoPreco) => salvarNovoPreco(servicoComparando.id, novoPreco)}
          onSalvarDetalhes={(detalhes) => salvarDetalhesServico(servicoComparando.id, detalhes)}
          onEditarTudo={() => { window.location.hash = `servicos?editar=${servicoComparando.id}`; }}
        />
      )}
    </>
  );
}