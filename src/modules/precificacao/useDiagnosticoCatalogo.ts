/**
 * src/modules/precificacao/useDiagnosticoCatalogo.ts
 *
 * Hook compartilhado: busca todos os serviços do salão, calcula preço ideal,
 * lucro real por hora (no preço já cobrado hoje), margem real e alertas
 * inteligentes para cada um. É a fonte única de dados usada tanto pela
 * AbaDiagnostico (tabela completa) quanto pelo AbaDashboardExecutivo
 * (resumo executivo) — evita duas implementações divergindo ao longo do tempo.
 */

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { type ConfigCustos, type FormCalculo, type Resultado, calcularPreco, obterHorasMesEfetivo, gerarAlertasServico, type AlertaServico } from './tipos';

export interface ServicoDiagnostico {
  id: string;
  nome_servico: string;
  categoria?: string;
  setor?: string;
  preco_padrao: number;
  duracao_minutos: number;
  custo_operacional: number;
  // Marcado explicitamente no cadastro do serviço — substitui a inferência
  // antiga por "preço muito baixo". Serviços de cortesia não entram nos
  // alertas de margem/comissão nem no contador "Abaixo do Ideal".
  eh_cortesia: boolean;
  // Tributação (NFS-e Nacional) — trazidos aqui para permitir edição rápida
  // direto no ModalComparacaoPreco, sem precisar abrir o cadastro completo.
  nbs?: string | null;
  codigo_municipio?: string | null;
  aliquota_iss?: number | null;
  precoIdeal: number;
  custoInsumos: number;
  status: 'ok' | 'atencao' | 'prejuizo' | 'cortesia';
  duracaoMin: number;
  lucroReal: number;
  lucroHoraReal: number;
  margemRealPct: number;
  alertasServico: AlertaServico[];
  // Resultado completo do cálculo de precificação (com o preço IDEAL) —
  // guardado inteiro para alimentar o modal de comparação valor atual vs.
  // recomendado, sem precisar recalcular nada na hora de exibir.
  calc: Resultado | null;
}

export function useDiagnosticoCatalogo(perfil: any, config: ConfigCustos, form: FormCalculo) {
  const [servicos, setServicos] = useState<ServicoDiagnostico[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregarDiagnostico() {
    if (!perfil?.salao_id) return;
    setCarregando(true);
    setErro(null);

    const { data: servs, error: erroServicos } = await supabase
      .from('servicos')
      .select('id, nome_servico, preco_padrao, duracao_minutos, custo_operacional, categoria, setor, nbs, codigo_municipio, aliquota_iss, eh_cortesia')
      .eq('salao_id', perfil.salao_id)
      .order('categoria');

    // IMPORTANTE: sempre marcar carregado=true antes de sair, mesmo em erro
    // — senão a tela de loading fica presa para sempre (carregando=false E
    // carregado=false não tem saída na condição usada pelos componentes).
    // Isso já aconteceu na prática: uma coluna nova (eh_cortesia) referenciada
    // aqui antes da migration rodar no banco trava a tela sem nenhum erro
    // visível, só "Calculando..." infinito.
    if (erroServicos || !servs) {
      if (process.env.NODE_ENV === 'development') console.error('[useDiagnosticoCatalogo] Falha ao carregar serviços:', erroServicos);
      setErro(erroServicos?.message || 'Não foi possível carregar os serviços.');
      setServicos([]);
      setCarregando(false);
      setCarregado(true);
      return;
    }

    const ids = servs.map(s => s.id);
    const { data: fichas, error: erroFichas } = await supabase
      .from('ficha_tecnica')
      .select('servico_id, quantidade, produtos(custo_medio)')
      .in('servico_id', ids);

    if (erroFichas) {
      if (process.env.NODE_ENV === 'development') console.error('[useDiagnosticoCatalogo] Falha ao carregar ficha técnica:', erroFichas);
      // Não é fatal — segue sem dados de insumo (custoInsumos fica só com
      // custo_operacional). Travar a tela inteira por isso seria pior.
    }

    try {
      const resultado: ServicoDiagnostico[] = servs.map(s => {
        const meusFichas    = (fichas || []).filter((f: any) => f.servico_id === s.id);
        const custoFicha    = meusFichas.reduce((acc: number, f: any) => acc + (f.quantidade * (f.produtos?.custo_medio || 0)), 0);
        const custoInsumos  = custoFicha + (s.custo_operacional || 0);
        const duracaoMin    = s.duracao_minutos || 60;
        const calc          = calcularPreco(config, { ...form, duracaoMin, custoInsumos, categoria: s.setor }, false);
        const precoAtual    = s.preco_padrao || 0;
        const precoIdeal    = calc?.precoIdeal || 0;
        const ehCortesia    = !!s.eh_cortesia;

        // Cortesia conta sempre como "ok" (Preço Saudável) — não é comparada
        // com o preço ideal, porque não foi pensada para cobrir custo algum.
        const status: 'ok' | 'atencao' | 'prejuizo' | 'cortesia' =
          ehCortesia               ? 'cortesia'
          : precoIdeal === 0         ? 'ok'
          : precoAtual >= precoIdeal ? 'ok'
          : precoAtual >= precoIdeal * 0.85 ? 'atencao'
          : 'prejuizo';

        // Rentabilidade REAL: quanto esse serviço lucra de fato no preço que o
        // salão já cobra hoje (não no preço ideal hipotético).
        const horasMesEfetivo   = obterHorasMesEfetivo(config, s.setor);
        const custoFixoHora     = horasMesEfetivo > 0 ? config.custoFixoMensal / horasMesEfetivo : 0;
        const custoFixoServico = (duracaoMin / 60) * custoFixoHora;
        const totalDeducoesPct = (form.percentComissao + config.aliquotaImposto + config.taxaCartao + config.depreciacao) / 100;
        const lucroReal      = precoAtual - custoInsumos - custoFixoServico - (precoAtual * totalDeducoesPct);
        const horasServico   = duracaoMin / 60;
        const lucroHoraReal  = horasServico > 0 ? lucroReal / horasServico : 0;
        const margemRealPct  = precoAtual > 0 ? (lucroReal / precoAtual) * 100 : 0;

        // Alertas: geramos mesmo para preço 0 (ex: cortesia "R$ 0,00" que
        // toma tempo de agenda) — gerarAlertasServico já filtra internamente
        // pela flag ehCortesia para não gerar alerta de margem/comissão.
        const alertasServico = gerarAlertasServico({
          servicoId: s.id,
          nomeServico: s.nome_servico,
          precoAtual,
          margemDesejadaSalao: form.margemDesejada,
          margemRealPct,
          lucroHoraReal,
          duracaoMin,
          percentComissao: form.percentComissao,
          ehCortesia,
        });

        return { ...s, eh_cortesia: ehCortesia, precoIdeal, custoInsumos, status, duracaoMin, lucroReal, lucroHoraReal, margemRealPct, alertasServico, calc };
      });

      setServicos(resultado);
    } catch (e: any) {
      // Mesma proteção: se algum cálculo lançar exceção inesperada no meio
      // do processamento, ainda assim saímos do loading em vez de travar
      // a tela para sempre sem nenhum erro visível ao usuário.
      if (process.env.NODE_ENV === 'development') console.error('[useDiagnosticoCatalogo] Falha ao processar diagnóstico:', e);
      setErro(e?.message || 'Erro ao processar os dados do diagnóstico.');
      setServicos([]);
    }

    setCarregando(false);
    setCarregado(true);
  }

  return { servicos, carregando, carregado, erro, carregarDiagnostico };
}