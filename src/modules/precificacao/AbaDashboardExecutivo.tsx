'use client'
/**
 * src/modules/precificacao/AbaDashboardExecutivo.tsx
 *
 * Visão executiva: o que o dono do salão vê primeiro ao abrir o Luarys
 * Precifica. Resume em poucos números o que a Calculadora e o Diagnóstico
 * mostram em detalhe — pensado para ser entendido em segundos, sem jargão.
 *
 * Usa useDiagnosticoCatalogo.ts (mesma fonte de dados do Diagnóstico).
 */

import { useEffect, useState } from 'react';
import { C } from '@/lib/constants';
import { FiTrendingUp, FiTrendingDown, FiAlertTriangle, FiBarChart2 } from 'react-icons/fi';
import { RAIO_MD, RAIO_XL, cardAdmin, FONTE_TITULO } from '@/lib/estiloGlobal';
import { type ConfigCustos, type FormCalculo, brl, pct, classificarLucroHora } from './tipos';
import { useDiagnosticoCatalogo } from './useDiagnosticoCatalogo';

interface Props {
  perfil: any;
  config: ConfigCustos;
  form: FormCalculo;
  configCarregada: boolean;
}

export function AbaDashboardExecutivo({ perfil, config, form, configCarregada }: Props) {
  const { servicos, carregando, carregado, erro, carregarDiagnostico } = useDiagnosticoCatalogo(perfil, config, form);
  const [alertasExpandido, setAlertasExpandido] = useState(false);

  // Carrega automaticamente ao abrir — é a tela de entrada, o dono não deveria
  // precisar clicar em nada para ver o panorama. Só dispara depois que a
  // configuração salva no localStorage terminou de carregar, senão calcula
  // com custo fixo zerado por um instante e mostra números errados.
  useEffect(() => {
    if (configCarregada && !carregado && !carregando && perfil?.salao_id) carregarDiagnostico();
  }, [perfil?.salao_id, configCarregada]); // eslint-disable-line react-hooks/exhaustive-deps

  // Simplificado: só mostra "Calculando..." enquanto a config ainda não
  // carregou OU a busca está de fato em andamento. Antes também esperava
  // por "!carregado && !carregando" — mas se carregarDiagnostico saísse
  // sem nunca marcar carregado=true (ex: erro silencioso de rede ou de
  // query), a tela ficava presa para sempre, sem nenhum erro visível.
  if (!configCarregada || carregando) {
    return <div style={{ textAlign: 'center', padding: 60, color: C.textMuted, fontSize: 13 }}>Calculando o panorama do seu salão...</div>;
  }

  if (erro) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <FiAlertTriangle size={32} color={C.dangerText} style={{ marginBottom: 16, opacity: 0.7 }} />
        <p style={{ fontSize: 13, color: C.dangerText, margin: '0 0 4px', fontWeight: 700 }}>Não foi possível carregar o panorama.</p>
        <p style={{ fontSize: 12, color: C.textLight, margin: '0 0 16px' }}>{erro}</p>
        <button
          onClick={carregarDiagnostico}
          style={{ padding: '10px 24px', borderRadius: RAIO_MD, border: 'none', background: C.sidebarBg, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  // Serviços de preço simbólico (ex: retoque cortesia a R$ 0,01) continuam
  // contando para "mais/menos lucrativos por hora" — isso é informação
  // real sobre tempo de agenda. Mas são excluídos da MARGEM MÉDIA do
  // salão: um percentual de -117878% (prejuízo de poucos reais dividido
  // por um preço quase zero) distorce a média geral sem refletir a saúde
  // financeira real do negócio.
  const elegiveis = servicos.filter(s => s.preco_padrao > 0 && s.duracao_minutos > 0);
  // Margem: exclui cortesias e outliers extremos (margemRealPct < -500%)
  // causados por serviços com preço simbólico (R$0,01) que distorcem a média.
  const elegiveisParaMargem = elegiveis.filter(s => !s.eh_cortesia && s.margemRealPct > -500);

  if (elegiveis.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <FiBarChart2 size={32} color={C.textLight} style={{ marginBottom: 16, opacity: 0.5 }} />
        <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>
          Cadastre preço e duração nos seus serviços para ver o panorama de lucratividade do salão.
        </p>
      </div>
    );
  }

  const lucroMedioHora = elegiveis.reduce((acc, s) => acc + s.lucroHoraReal, 0) / elegiveis.length;
  const margemMedia    = elegiveisParaMargem.length > 0
    ? elegiveisParaMargem.reduce((acc, s) => acc + s.margemRealPct, 0) / elegiveisParaMargem.length
    : 0;

  const maisLucrativos  = [...elegiveis].sort((a, b) => b.lucroHoraReal - a.lucroHoraReal).slice(0, 5);
  const menosLucrativos = [...elegiveis].sort((a, b) => a.lucroHoraReal - b.lucroHoraReal).slice(0, 5);

  const todosAlertas    = servicos.flatMap(s => s.alertasServico || []);
  const alertasCriticos = todosAlertas.filter(a => a.nivel === 'critico');
  const alertasAtencao  = todosAlertas.filter(a => a.nivel === 'atencao');
  // Mesma lógica do Diagnóstico: preço atual abaixo do mínimo calculado.
  const abaixoDoIdeal   = servicos.filter(s => s.status === 'prejuizo');

  const statusLucroMedio = classificarLucroHora(lucroMedioHora);
  const corLucroMedio =
    statusLucroMedio === 'prejuizo' ? C.dangerText :
    statusLucroMedio === 'fraco'    ? '#92400E' :
    statusLucroMedio === 'bom'      ? '#1E40AF' : C.successText;
  const bgLucroMedio =
    statusLucroMedio === 'prejuizo' ? C.dangerBg :
    statusLucroMedio === 'fraco'    ? '#FFFBEB' :
    statusLucroMedio === 'bom'      ? '#EFF6FF' : C.successBg;

  return (
    <div>
      {/* NÚMEROS PRINCIPAIS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        <div style={{ background: bgLucroMedio, borderRadius: RAIO_XL, padding: '20px 22px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: corLucroMedio, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
            Lucro médio por hora
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, color: corLucroMedio }}>{brl(lucroMedioHora)}/h</div>
          <p style={{ fontSize: 11, color: corLucroMedio, opacity: 0.8, margin: '6px 0 0' }}>
            Média de todos os serviços com preço e tempo cadastrados.
          </p>
        </div>

        <div style={{ ...cardAdmin, padding: '20px 22px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
            Margem média do salão
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, color: C.textMain }}>{pct(margemMedia)}</div>
          <p style={{ fontSize: 11, color: C.textLight, margin: '6px 0 0' }}>
            Sua meta configurada é {pct(form.margemDesejada)}.
          </p>
        </div>

        <div style={{ ...cardAdmin, padding: '20px 22px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
            Serviços abaixo do ideal
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, color: abaixoDoIdeal.length > 0 ? '#92400E' : C.success }}>{abaixoDoIdeal.length}</div>
          <p style={{ fontSize: 11, color: C.textLight, margin: '6px 0 0' }}>
            de {servicos.length} serviços analisados.
          </p>
        </div>
      </div>

      {/* ALERTAS — resumo compacto, expansível */}
      {(alertasCriticos.length > 0 || alertasAtencao.length > 0) && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <FiAlertTriangle size={14} color={C.textMuted} />
            <span style={{ fontSize: 12, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pontos de atenção</span>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
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
                <div key={`c-${i}`} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: C.dangerBg, border: '1px solid #FCA5A5', borderRadius: RAIO_MD, padding: '10px 14px', fontSize: 12, color: C.dangerText }}>
                  <span style={{ flexShrink: 0 }}>🔴</span><span>{a.texto}</span>
                </div>
              ))}
              {alertasAtencao.map((a, i) => (
                <div key={`a-${i}`} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: RAIO_MD, padding: '10px 14px', fontSize: 12, color: '#92400E' }}>
                  <span style={{ flexShrink: 0 }}>🟡</span><span>{a.texto}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TOP 5 MAIS / MENOS LUCRATIVOS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 12 }}>
        <div style={{ ...cardAdmin, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: C.successBg, borderBottom: `1px solid ${C.border}` }}>
            <FiTrendingUp size={14} color={C.successText} />
            <span style={{ fontSize: 12, fontWeight: 800, color: C.successText, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top 5 mais lucrativos</span>
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
            <span style={{ fontSize: 12, fontWeight: 800, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top 5 menos lucrativos</span>
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

      <p style={{ fontSize: 11, color: C.textLight, marginTop: 16, fontStyle: 'italic' }}>
        * Profissional mais rentável: em breve, quando a análise por profissional estiver disponível.
      </p>
    </div>
  );
}
