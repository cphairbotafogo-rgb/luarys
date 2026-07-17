'use client'
/**
 * src/modules/crescimento/AbaCrescimento.tsx  (shell)
 *
 * Luarys Cresce — une em um só lugar o que antes vivia espalhado:
 *   - Relatórios → Retenção        (clientes em risco/perdidos)
 *   - Relatórios → Termômetro      (invertido: horários ociosos)
 *   - Relatórios → Performance     (invertido: base do ranking)
 *   - Configurações → Automações   (ação de WhatsApp, agora ao lado do insight)
 *
 * Cada painel mantém a MESMA regra de cálculo já validada nos relatórios
 * originais — este módulo não inventa novos números, só os organiza em
 * torno da pergunta do dono: "o que eu faço a respeito disso agora?"
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/constants';
import { RAIO_LG } from '@/lib/estiloGlobal';
import { FiTrendingUp } from 'react-icons/fi';

import {
  classificarClientes, calcularHorariosOciosos, calcularDesempenhoProfissionais,
  type DiaFuncionamento,
} from './tipos';
import { SeletorPeriodo } from './componentes';
import { PainelClientes } from './PainelClientes';
import { PainelHorarios } from './PainelHorarios';
import { PainelEquipe } from './PainelEquipe';

export function AbaCrescimento({ perfil }: any) {
  const [periodo, setPeriodo] = useState(90); // janela para horários/equipe; clientes sempre usa regra fixa 45/90
  const [carregando, setCarregando] = useState(true);
  const [dados, setDados] = useState<{
    agendamentos: any[]; clientes: any[]; crmClientes: any[];
    profissionais: any[]; servicos: any[]; horariosFuncionamento: DiaFuncionamento[];
    mensagemTemplate?: string;
  }>({ agendamentos: [], clientes: [], crmClientes: [], profissionais: [], servicos: [], horariosFuncionamento: [] });

  useEffect(() => {
    if (perfil?.salao_id) carregarDados();
  }, [perfil?.salao_id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function carregarDados() {
    setCarregando(true);
    const salaoId = perfil.salao_id;

    const [resAg, resCli, resCrm, resProf, resServ, resSalao, resAuto] = await Promise.all([
      supabase.from('agendamentos').select('*').eq('salao_id', salaoId),
      supabase.from('clientes').select('id, nome_completo, telefone_whatsapp').eq('salao_id', salaoId),
      supabase.from('crm_clientes').select('cliente_id, aceita_campanhas, data_ultima_visita').eq('salao_id', salaoId),
      supabase.from('profissionais').select('id, nome, ativo, produtivo').eq('salao_id', salaoId),
      supabase.from('servicos').select('id, preco_padrao').eq('salao_id', salaoId),
      supabase.from('saloes').select('horarios_funcionamento').eq('id', salaoId).maybeSingle(),
      supabase.from('automacoes').select('mensagem_template').eq('salao_id', salaoId).eq('gatilho', 'cliente_inativo').eq('ativo', true).maybeSingle(),
    ]);

    let horariosFuncionamento: DiaFuncionamento[] = [];
    const raw = resSalao.data?.horarios_funcionamento;
    if (raw) {
      try { horariosFuncionamento = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { horariosFuncionamento = []; }
    }

    setDados({
      agendamentos: resAg.data || [],
      clientes: resCli.data || [],
      crmClientes: resCrm.data || [],
      profissionais: resProf.data || [],
      servicos: resServ.data || [],
      horariosFuncionamento,
      mensagemTemplate: resAuto.data?.mensagem_template,
    });
    setCarregando(false);
  }

  if (carregando) {
    return <div style={{ textAlign: 'center', padding: 60, color: C.textMuted, fontSize: 13 }}>Carregando indicadores...</div>;
  }

  const { fieis, emRisco, perdidos, novos, taxaRetencao, limFiel, limRisco } = classificarClientes(dados.agendamentos, dados.clientes, dados.crmClientes, periodo);
  const celulasHorario = calcularHorariosOciosos(dados.agendamentos, dados.horariosFuncionamento, periodo);
  const desempenhoEquipe = calcularDesempenhoProfissionais(dados.agendamentos, dados.profissionais, dados.servicos, periodo);

  return (
    <div style={{ padding: '24px 32px', maxWidth: 860, margin: '0 auto' }}>

      {/* CABEÇALHO */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: RAIO_LG, background: `linear-gradient(135deg, ${C.douradoEleva}, #B8960C)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiTrendingUp size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.textMain }}>Luarys Cresce</h1>
            <p style={{ margin: 0, fontSize: 12, color: C.textMuted }}>Mais faturamento, menos faltas, clientes que voltam — tudo num só lugar, com ação direta.</p>
          </div>
        </div>
        <SeletorPeriodo valor={periodo} onChange={setPeriodo} />
      </div>

      <PainelClientes
        fieis={fieis}
        emRisco={emRisco}
        perdidos={perdidos}
        novos={novos}
        taxaRetencao={taxaRetencao}
        mensagemTemplate={dados.mensagemTemplate}
        limFiel={limFiel}
        limRisco={limRisco}
      />

      <PainelHorarios celulas={celulasHorario} />

      <PainelEquipe profissionais={desempenhoEquipe} />
    </div>
  );
}
