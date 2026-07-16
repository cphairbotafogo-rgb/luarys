'use client'
/**
 * src/modules/precificacao/componentes.tsx
 *
 * Componentes React reutilizados pelas abas do Luarys Precifica:
 * Tooltip, Alerta, BarraComposicao, HorasAssistente.
 */

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/constants';
import { FiAlertTriangle, FiCheckCircle, FiAlertCircle, FiInfo } from 'react-icons/fi';
import { RAIO_MD, RAIO_SM, RAIO_XL, RAIO_LG, cardAdmin, SOMBRA_SUAVE } from '@/lib/estiloGlobal';
import { type Resultado, type FormCalculo, CORES, LEGENDA, brl, pct, classificarLucroHora } from './tipos';
import { calcularCapacidadeProfissionalPura } from '@/modules/relatorios/hooks/useCapacidadeProfissional';

// ─── TOOLTIP ──────────────────────────────────────────────────────────────────

export function Tooltip({ texto }: { texto: string }) {
  const [vis, setVis] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }}>
      <FiInfo
        size={13}
        color={C.textLight}
        style={{ cursor: 'pointer', marginLeft: 4 }}
        onMouseEnter={() => setVis(true)}
        onMouseLeave={() => setVis(false)}
      />
      {vis && (
        <span style={{
          position: 'absolute', bottom: '120%', left: '50%', transform: 'translateX(-50%)',
          background: C.sidebarBg, color: '#fff', fontSize: 11, borderRadius: RAIO_MD,
          padding: '8px 12px', whiteSpace: 'normal', zIndex: 10,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)', maxWidth: 220, width: 'max-content',
          lineHeight: 1.5, textTransform: 'none', fontWeight: 400, letterSpacing: 'normal',
          textAlign: 'left',
        }}>
          {texto}
        </span>
      )}
    </span>
  );
}

// ─── ALERTA ───────────────────────────────────────────────────────────────────

export function Alerta({ tipo, texto }: { tipo: 'aviso' | 'erro' | 'ok'; texto: string }) {
  const cores = {
    aviso: { bg: '#FFFBEB', border: '#FCD34D', text: '#92400E', icon: <FiAlertTriangle size={14} /> },
    erro:  { bg: C.dangerBg, border: '#FCA5A5', text: C.dangerText, icon: <FiAlertCircle size={14} /> },
    ok:    { bg: C.successBg, border: '#6EE7B7', text: C.successText, icon: <FiCheckCircle size={14} /> },
  };
  const c = cores[tipo];
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: c.bg, border: `1px solid ${c.border}`, borderRadius: RAIO_MD, padding: '10px 14px', fontSize: 12, color: c.text }}>
      <span style={{ flexShrink: 0, marginTop: 1 }}>{c.icon}</span>
      <span>{texto}</span>
    </div>
  );
}

// ─── BARRA DE COMPOSIÇÃO ──────────────────────────────────────────────────────

export function BarraComposicao({ resultado, modoParceiro }: { resultado: Resultado; modoParceiro: boolean }) {
  const total = resultado.precoIdeal;
  if (total <= 0) return null;

  const segmentos = [
    { chave: 'insumos',     valor: resultado.custoDireto - resultado.custoFixoServico },
    { chave: 'estrutura',   valor: resultado.custoFixoServico },
    { chave: modoParceiro ? 'parceiro' : 'comissao', valor: resultado.comissaoValor },
    { chave: 'imposto',     valor: resultado.impostoValor },
    { chave: 'cartao',      valor: resultado.cartaoValor },
    { chave: 'depreciacao', valor: resultado.depreciacaoValor },
    { chave: 'lucro',       valor: resultado.lucroValor },
  ].filter(s => s.valor > 0);

  return (
    <div>
      <div style={{ display: 'flex', height: 28, borderRadius: RAIO_SM, overflow: 'hidden', gap: 1 }}>
        {segmentos.map(s => (
          <div
            key={s.chave}
            title={`${LEGENDA.find(l => l.chave === s.chave)?.label}: ${brl(s.valor)} (${pct(s.valor / total * 100)})`}
            style={{ width: `${s.valor / total * 100}%`, background: CORES[s.chave], transition: 'width 0.4s ease' }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: 10 }}>
        {segmentos.map(s => {
          const info = LEGENDA.find(l => l.chave === s.chave)!;
          return (
            <div key={s.chave} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.textMuted }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: CORES[s.chave], flexShrink: 0 }} />
              <span>{info.label}:</span>
              <strong style={{ color: C.textMain }}>{brl(s.valor)}</strong>
              <span style={{ color: C.textLight }}>({pct(s.valor / total * 100)})</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── CARTÃO "QUANTO SOBRA POR HORA" ───────────────────────────────────────────
// Pensado para leitura instantânea pelo PROPRIETÁRIO, sem jargão técnico:
// não fala em "margem de contribuição" ou "CMV" na tela — só mostra, em
// reais e numa frase, se aquela hora de cadeira/maca ocupada vale a pena.

const TEXTO_LUCRO_HORA: Record<string, { titulo: string; cor: string; bg: string; borda: string }> = {
  otimo:    { titulo: 'Ótimo uso do tempo da equipe',      cor: '#065F46', bg: '#ECFDF5', borda: '#6EE7B7' },
  bom:      { titulo: 'Bom uso do tempo da equipe',        cor: '#1E40AF', bg: '#EFF6FF', borda: '#BFDBFE' },
  fraco:    { titulo: 'Esse serviço usa muito tempo para pouco lucro', cor: '#92400E', bg: '#FFFBEB', borda: '#FCD34D' },
  prejuizo: { titulo: 'Esse serviço está dando prejuízo',  cor: '#991B1B', bg: '#FEF2F2', borda: '#FCA5A5' },
};

export function CardLucroHora({ lucroHora, duracaoMin }: { lucroHora: number; duracaoMin: number }) {
  const status = classificarLucroHora(lucroHora);
  const t = TEXTO_LUCRO_HORA[status];
  const horas = duracaoMin / 60;

  return (
    <div style={{ background: t.bg, border: `1px solid ${t.borda}`, borderRadius: RAIO_XL, padding: '16px 20px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: t.cor, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
        {t.titulo}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 30, fontWeight: 900, color: t.cor }}>{brl(lucroHora)}</span>
        <span style={{ fontSize: 13, color: t.cor, opacity: 0.85 }}>de lucro por hora ocupada</span>
      </div>
      <p style={{ fontSize: 12, color: t.cor, opacity: 0.85, margin: '6px 0 0' }}>
        Esse serviço leva {horas === 1 ? '1 hora' : horas < 1 ? `${duracaoMin} minutos` : `${horas.toFixed(1)} horas`} da agenda.
        {status === 'prejuizo' && ' Cada vez que ele é vendido, o salão perde dinheiro.'}
        {status === 'fraco' && ' Vale considerar aumentar o preço ou reduzir o tempo de execução.'}
      </p>
    </div>
  );
}

// ─── ASSISTENTE DE CÁLCULO DE HORAS ──────────────────────────────────────────
// Puxa os horários reais dos profissionais cadastrados e cruza com bloqueios
// e atendimentos da Agenda (via useCapacidadeProfissional) para calcular o
// total de horas faturáveis/mês — contratada ou efetiva, à escolha do dono.

interface DetalheProf {
  id: string;
  nome: string;
  categoria: string;
  capacidadeContratadaMin: number;
  capacidadeEfetivaMin: number;
}

/**
 * Assistente de cálculo de horas/mês — agora baseado no mesmo motor usado
 * nos Relatórios (useCapacidadeProfissional), em vez de uma semana-padrão
 * hipotética. Isso significa:
 *  - O período é um mês de calendário real (ex: 1 a 30 de junho), não mais
 *    "semana típica × 4,33".
 *  - O dono escolhe entre capacidade CONTRATADA (só a escala, sem descontar
 *    nada) e EFETIVA (escala menos faltas/atrasos/bloqueios reais do mês).
 *  - O resultado pode ser aplicado tanto no modo "simples" (um número só)
 *    quanto distribuído por categoria, alimentando ConfigCustos.horasMesPorCategoria.
 */
export function HorasAssistente({
  salaoId, onCalcular, onCalcularPorCategoria
}: {
  salaoId: string;
  onCalcular: (horas: number) => void;
  onCalcularPorCategoria?: (horasPorCategoria: Record<string, number>) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [detalhes, setDetalhes] = useState<DetalheProf[]>([]);
  const [excluidos, setExcluidos] = useState<string[]>([]);
  const [modo, setModo] = useState<'efetiva' | 'contratada'>('efetiva');
  const [mesReferencia, setMesReferencia] = useState(() => new Date().toISOString().slice(0, 7)); // 'YYYY-MM'
  const [erro, setErro] = useState('');

  function minutosDoModo(d: DetalheProf) {
    return modo === 'efetiva' ? d.capacidadeEfetivaMin : d.capacidadeContratadaMin;
  }

  const totalHoras = Math.round(detalhes.reduce((acc, d) => acc + minutosDoModo(d), 0) / 60);

  const horasPorCategoria = (() => {
    const mapa: Record<string, number> = {};
    detalhes.forEach(d => { mapa[d.categoria] = (mapa[d.categoria] || 0) + minutosDoModo(d) / 60; });
    Object.keys(mapa).forEach(k => { mapa[k] = Math.round(mapa[k]); });
    return mapa;
  })();

  async function calcular() {
    setCarregando(true);
    setErro('');

    const [ano, mes] = mesReferencia.split('-').map(Number);
    const dataInicio = `${mesReferencia}-01`;
    const dataFim = new Date(ano, mes, 0).toISOString().split('T')[0]; // último dia do mês

    const { data: profsData, error: errProfs } = await supabase
      .from('profissionais')
      .select('id, nome, ativo, produtivo, perfil_avancado')
      .eq('salao_id', salaoId)
      .eq('ativo', true);

    if (errProfs || !profsData) {
      setErro('Não foi possível carregar os profissionais.');
      setCarregando(false);
      return;
    }

    const administrativos = profsData.filter(p => p.produtivo === false).map(p => p.nome || 'Sem nome');
    const produtivos = profsData.filter(p => p.produtivo !== false);

    if (produtivos.length === 0) {
      setErro('Nenhum profissional produtivo cadastrado. Configure a equipe em "Minha Equipe".');
      setDetalhes([]);
      setExcluidos(administrativos);
      setCarregando(false);
      setAberto(true);
      return;
    }

    const { data: agsData } = await supabase
      .from('agendamentos')
      .select('id, profissional_id, data, status, duracao_min, observacao')
      .eq('salao_id', salaoId)
      .in('status', ['Bloqueado', 'Finalizado'])
      .gte('data', dataInicio)
      .lte('data', dataFim);

    const resultados = calcularCapacidadeProfissionalPura({
      profissionais: produtivos,
      agendamentos: agsData || [],
      dataInicio,
      dataFim,
    });

    const detalhesCalculados: DetalheProf[] = resultados
      .map(r => {
        const prof = produtivos.find(p => p.id === r.profissionalId);
        const categoria = prof?.perfil_avancado?.contrato?.funcao || 'Geral';
        return {
          id: r.profissionalId,
          nome: r.nome,
          categoria,
          capacidadeContratadaMin: r.capacidadeContratadaMin,
          capacidadeEfetivaMin: r.capacidadeEfetivaMin,
        };
      })
      .filter(d => d.capacidadeContratadaMin > 0);

    if (detalhesCalculados.length === 0) {
      setErro('Nenhum profissional com horários configurados. Configure os horários em "Minha Equipe".');
    }

    setDetalhes(detalhesCalculados);
    setExcluidos(administrativos);
    setCarregando(false);
    setAberto(true);
  }

  if (!aberto) {
    return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={calcular}
          disabled={carregando}
          style={{ fontSize: 11, color: C.sidebarBg, background: 'none', border: `1px dashed ${C.borderMid}`, borderRadius: RAIO_SM, padding: '4px 10px', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}
        >
          {carregando ? 'Carregando equipe...' : '⚡ Calcular da equipe cadastrada →'}
        </button>
        {erro && <span style={{ fontSize: 11, color: C.dangerText }}>{erro}</span>}
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: RAIO_LG, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.textMain }}>Horas calculadas da equipe cadastrada</span>
        <button onClick={() => { setAberto(false); setDetalhes([]); setExcluidos([]); }}
          style={{ fontSize: 11, color: C.textLight, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
      </div>

      {/* Mês de referência + toggle Efetiva/Contratada */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase' as const, display: 'block', marginBottom: 4 }}>Mês de referência</label>
          <input type="month" value={mesReferencia} onChange={e => setMesReferencia(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: RAIO_SM, border: `1px solid ${C.borderMid}`, fontSize: 12 }} />
        </div>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase' as const, display: 'block', marginBottom: 4 }}>Base de cálculo</label>
          <div style={{ display: 'flex', borderRadius: RAIO_SM, border: `1px solid ${C.borderMid}`, overflow: 'hidden' }}>
            <button onClick={() => setModo('efetiva')}
              style={{ padding: '6px 12px', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', background: modo === 'efetiva' ? C.sidebarBg : C.bgCard, color: modo === 'efetiva' ? '#fff' : C.textMuted }}>
              Efetiva
            </button>
            <button onClick={() => setModo('contratada')}
              style={{ padding: '6px 12px', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', background: modo === 'contratada' ? C.sidebarBg : C.bgCard, color: modo === 'contratada' ? '#fff' : C.textMuted }}>
              Contratada
            </button>
          </div>
        </div>
        <button onClick={calcular} disabled={carregando}
          style={{ alignSelf: 'flex-end', fontSize: 11, color: C.sidebarBg, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}>
          {carregando ? 'Recalculando...' : 'Recalcular'}
        </button>
      </div>
      <p style={{ fontSize: 11, color: C.textLight, margin: '0 0 12px' }}>
        {modo === 'efetiva'
          ? 'Capacidade efetiva: escala da equipe menos faltas, atrasos e bloqueios já registrados na Agenda neste mês.'
          : 'Capacidade contratada: apenas a escala cadastrada em "Minha Equipe", sem descontar nenhuma ausência.'}
      </p>

      {/* Detalhes por profissional */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {detalhes.map((d) => (
          <div key={d.id} style={{ ...cardAdmin, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', fontSize: 12 }}>
            <div>
              <span style={{ fontWeight: 700, color: C.textMain }}>{d.nome}</span>
              <span style={{ marginLeft: 8, fontSize: 10, color: C.textLight }}>{d.categoria}</span>
            </div>
            <span style={{ fontWeight: 700, color: C.sidebarBg }}>{(minutosDoModo(d) / 60).toFixed(1)}h/mês</span>
          </div>
        ))}
        {detalhes.length === 0 && !erro && (
          <p style={{ fontSize: 12, color: C.textLight, fontStyle: 'italic', margin: 0 }}>
            Nenhum profissional com horários cadastrados. Configure em "Minha Equipe".
          </p>
        )}
        {erro && <p style={{ fontSize: 12, color: C.dangerText, margin: 0 }}>{erro}</p>}
      </div>

      {/* Administrativos excluídos do cálculo — não geram atendimento faturável */}
      {excluidos.length > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: RAIO_MD, padding: '8px 12px', fontSize: 11, color: '#92400E', marginBottom: 12 }}>
          <strong>{excluidos.length} administrativo{excluidos.length > 1 ? 's' : ''} não incluído{excluidos.length > 1 ? 's' : ''}</strong> ({excluidos.join(', ')}) — marcados como "não-produtivo" (sem agenda própria), então não entram na divisão de horas.
          <br />
          Lembre-se de lançar o salário dele{excluidos.length > 1 ? 's' : ''} como Despesa Fixa no Financeiro, para que entre no Custo Fixo Mensal acima.
        </div>
      )}

      {/* Resultado total */}
      <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: RAIO_MD, padding: '10px 14px', fontSize: 12, color: '#1E40AF', marginBottom: 12 }}>
        <strong>Total: {totalHoras}h/mês</strong>
        {Object.keys(horasPorCategoria).length > 1 && (
          <span style={{ color: '#3B82F6' }}>
            {' '}({Object.entries(horasPorCategoria).map(([cat, h]) => `${cat}: ${h}h`).join(' + ')})
          </span>
        )}
        <br />
        <span style={{ color: '#3B82F6' }}>Seus custos fixos são rateados entre essas {totalHoras}h de atendimento coletivo.</span>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => { onCalcular(totalHoras); setAberto(false); }}
          disabled={totalHoras === 0}
          style={{ padding: '7px 16px', borderRadius: RAIO_SM, border: 'none', background: totalHoras > 0 ? C.sidebarBg : C.borderMid, color: '#fff', fontSize: 12, fontWeight: 700, cursor: totalHoras > 0 ? 'pointer' : 'not-allowed' }}
        >
          Usar {totalHoras}h/mês (total único)
        </button>
        {onCalcularPorCategoria && Object.keys(horasPorCategoria).length > 1 && (
          <button
            onClick={() => { onCalcularPorCategoria(horasPorCategoria); setAberto(false); }}
            style={{ padding: '7px 16px', borderRadius: RAIO_SM, border: `1px solid ${C.sidebarBg}`, background: C.bgCard, color: C.sidebarBg, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            Usar valores por categoria
          </button>
        )}
        <button onClick={() => { setAberto(false); setDetalhes([]); setExcluidos([]); }}
          style={{ padding: '7px 12px', borderRadius: RAIO_SM, border: `1px solid ${C.borderMid}`, background: C.bgCard, color: C.textMuted, fontSize: 12, cursor: 'pointer' }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}