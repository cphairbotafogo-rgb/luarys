'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/constants';
import { FiSliders, FiLoader } from 'react-icons/fi';
import { RAIO_LG } from '@/lib/estiloGlobal';
import { useGuardModulo } from '@/lib/useGuardModulo';
import { BloqueioModulo } from '@/components/BloqueioModulo';
import { type ConfigCustos, type FormCalculo, CONFIG_DEFAULT, FORM_DEFAULT, calcularPreco, brl } from './tipos';
import { AbaDashboardExecutivo } from './AbaDashboardExecutivo';
import { AbaDiagnostico } from './AbaDiagnostico';
import { PainelConfigCustos } from './calculadora/PainelConfigCustos';
import { PainelServico } from './calculadora/PainelServico';
import { PainelResultado } from './calculadora/PainelResultado';

export function AbaPrecificacao({ perfil }: any) {
  const liberado = useGuardModulo(perfil?.salao_id, 'precificacao');
  const [aba, setAba] = useState<'dashboard' | 'calculadora' | 'diagnostico'>('dashboard');
  const [modoServico, setModoServico] = useState(false);
  const [modoParceiro, setModoParceiro] = useState(false);
  const [config, setConfig] = useState<ConfigCustos>(CONFIG_DEFAULT);
  const [form, setForm] = useState<FormCalculo>(FORM_DEFAULT);

  const [servicos, setServicos] = useState<any[]>([]);
  const [setores, setSetores] = useState<any[]>([]);
  const [buscaServico, setBuscaServico] = useState('');
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const [servicoId, setServicoId] = useState('');
  const [servicoSelecionado, setServicoSelecionado] = useState<any>(null);
  const [carregandoServicos, setCarregandoServicos] = useState(false);
  const [puxandoCustos, setPuxandoCustos] = useState(false);
  const [configCarregada, setConfigCarregada] = useState(false);
  const [salvandoConfig, setSalvandoConfig] = useState(false);

  useEffect(() => {
    if (!perfil?.salao_id) return;
    carregarConfig();
    carregarServicos();
    carregarSetores();
  }, [perfil?.salao_id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function carregarConfig() {
    const { data } = await supabase.from('precificacao_config').select('config').eq('salao_id', perfil.salao_id).maybeSingle();
    if (data?.config) {
      try { setConfig({ ...CONFIG_DEFAULT, ...data.config }); } catch {}
    } else {
      const STORAGE_KEY = `luarys_precificacao_config_${perfil.salao_id}`;
      const salvo = localStorage.getItem(STORAGE_KEY);
      if (salvo) {
        try {
          const configLocal = JSON.parse(salvo);
          setConfig({ ...CONFIG_DEFAULT, ...configLocal });
          await supabase.from('precificacao_config').upsert({ salao_id: perfil.salao_id, config: configLocal, atualizado_em: new Date().toISOString() }, { onConflict: 'salao_id' });
          localStorage.removeItem(STORAGE_KEY);
        } catch {}
      }
    }
    setConfigCarregada(true);
  }

  async function carregarSetores() {
    const { data } = await supabase.from('funcoes').select('*').order('nome', { ascending: true });
    if (data) setSetores(data);
  }

  async function salvarConfig(nova: ConfigCustos) {
    setConfig(nova);
    setSalvandoConfig(true);
    try {
      await supabase.from('precificacao_config').upsert({ salao_id: perfil.salao_id, config: nova, atualizado_em: new Date().toISOString() }, { onConflict: 'salao_id' });
    } catch (e) {
      if (process.env.NODE_ENV === 'development') console.error('Precifica: erro ao salvar config', e);
    } finally {
      setSalvandoConfig(false);
    }
  }

  async function carregarServicos() {
    const { data: { session } } = await supabase.auth.getSession();
    const salaoId = perfil?.salao_id;
    if (!session || !salaoId) return;
    setCarregandoServicos(true);
    const { data } = await supabase.from('servicos').select('id, nome_servico, preco_padrao, duracao_minutos, custo_operacional, categoria, setor').eq('salao_id', salaoId).order('categoria').order('nome_servico');
    if (data) setServicos(data);
    setCarregandoServicos(false);
  }

  function ativarModoServico(ativo: boolean) {
    setModoServico(ativo);
    if (ativo && servicos.length === 0 && perfil?.salao_id) carregarServicos();
    if (!ativo) { setServicoId(''); setServicoSelecionado(null); setBuscaServico(''); setDropdownAberto(false); }
  }

  async function selecionarServico(s: any) {
    setServicoId(s.id);
    setBuscaServico(s.nome_servico);
    setDropdownAberto(false);

    const { data: fichas } = await supabase.from('ficha_tecnica').select('quantidade, produtos(custo_medio)').eq('servico_id', s.id);
    const custoFicha = (fichas || []).reduce((acc: number, f: any) => acc + (f.quantidade * (f.produtos?.custo_medio || 0)), 0);
    const custo = custoFicha + (s?.custo_operacional || 0);

    const { data: profs } = await supabase.from('profissionais').select('nome, servicos_comissoes').eq('salao_id', perfil.salao_id).eq('ativo', true);
    const taxasDoServico = (profs || []).map(p => ({ nome: p.nome, taxa: p.servicos_comissoes?.[s.id] })).filter(p => p.taxa !== undefined && p.taxa !== null);
    const comissaoMedia = taxasDoServico.length > 0 ? taxasDoServico.reduce((acc, p) => acc + Number(p.taxa), 0) / taxasDoServico.length : null;

    setServicoSelecionado({ ...s, custoFicha, custo, taxasDoServico, comissaoMedia });
    setForm(prev => ({
      ...prev,
      duracaoMin: s?.duracao_minutos || 60,
      custoInsumos: custo,
      categoria: s?.setor || 'Geral',
      percentComissao: comissaoMedia !== null ? Math.round(comissaoMedia) : prev.percentComissao,
    }));
  }

  async function puxarCustosDoFinanceiro() {
    setPuxandoCustos(true);
    const hoje = new Date();
    const tres = new Date(hoje);
    tres.setMonth(hoje.getMonth() - 3);
    const { data } = await supabase.from('despesas').select('valor, categoria').eq('salao_id', perfil.salao_id)
      .gte('data_vencimento', tres.toISOString().split('T')[0])
      .lte('data_vencimento', hoje.toISOString().split('T')[0])
      .neq('categoria', 'Marketing — Fidelidade');
    if (data && data.length > 0) {
      const media = Math.round(data.reduce((a, d) => a + Number(d.valor), 0) / 3);
      salvarConfig({ ...config, custoFixoMensal: media });
    }
    setPuxandoCustos(false);
  }

  const resultado = calcularPreco(config, form, modoParceiro);

  const alertas: { tipo: 'aviso' | 'erro' | 'ok'; texto: string }[] = [];
  if (!modoParceiro && form.percentComissao >= 50)
    alertas.push({ tipo: 'aviso', texto: `Comissão de ${form.percentComissao}% sobre o bruto é arriscado. Considere reduzir ou migrar para o modelo Parceiro (Lei 13.352).` });
  if (resultado && resultado.divisor < 0.15)
    alertas.push({ tipo: 'erro', texto: 'A soma de deduções ultrapassa o limite seguro — revise as porcentagens.' });
  if (resultado && form.custoInsumos > resultado.precoIdeal * 0.4)
    alertas.push({ tipo: 'aviso', texto: 'Custo de insumos acima de 40% do preço. Verifique o fracionamento na ficha técnica.' });
  if (config.custoFixoMensal === 0)
    alertas.push({ tipo: 'aviso', texto: 'Custo Fixo Mensal zerado — o preço não considera estrutura. Preencha acima ou use "Puxar do Financeiro".' });
  if (modoParceiro && resultado?.economiaTributaria && resultado.economiaTributaria > 0)
    alertas.push({ tipo: 'ok', texto: `Economia tributária do modelo Parceiro: ${brl(resultado.economiaTributaria)} por serviço.` });

  const calc = {
    config, salvarConfig, salvandoConfig, configCarregada,
    puxarCustosDoFinanceiro, puxandoCustos, setores,
    form, setForm,
    modoServico, modoParceiro, setModoParceiro,
    ativarModoServico, selecionarServico, carregarServicos,
    servicos, buscaServico, setBuscaServico,
    dropdownAberto, setDropdownAberto,
    servicoId, setServicoId, servicoSelecionado, setServicoSelecionado,
    carregandoServicos, resultado, alertas,
  };

  if (liberado === null) return <div style={{ padding: 32, color: C.textLight, display: 'flex', alignItems: 'center', gap: 10 }}><FiLoader className="animate-spin" size={16} /> Verificando acesso...</div>;
  if (!liberado) return <BloqueioModulo salaoId={perfil?.salao_id} moduloChave="precificacao" nome="Luarys Precifica" descricao="Calcule o preço certo para cada serviço com base nos seus custos reais, comissões e margem desejada." preco={29.90} itens={['Calculadora de precificação por serviço', 'Dashboard executivo de custos', 'Diagnóstico da tabela de preços', 'Integração com custos do Financeiro', 'Suporte ao modelo Parceiro (Lei 13.352)']} />;

  return (
    <div style={{ padding: '24px 32px', maxWidth: 860, margin: '0 auto' }}>

      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: RAIO_LG, background: `linear-gradient(135deg, ${C.douradoLuarys}, #B8960C)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FiSliders size={20} color="#fff" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.textMain }}>Luarys Precifica</h1>
          <p style={{ margin: 0, fontSize: 12, color: C.textMuted }}>Descubra o preço certo — baseado nos seus custos reais, não no preço do vizinho.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: `1px solid ${C.border}` }}>
        {([['dashboard', 'Visão Geral'], ['calculadora', 'Calculadora'], ['diagnostico', 'Diagnóstico da Tabela']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setAba(id)}
            style={{ padding: '10px 18px', border: 'none', borderRadius: '8px 8px 0 0', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              background: aba === id ? '#fff' : 'transparent',
              color: aba === id ? C.douradoLuarys : C.textMuted,
              borderBottom: aba === id ? `3px solid ${C.douradoLuarys}` : '3px solid transparent',
              marginBottom: -1 }}
          >
            {label}
          </button>
        ))}
      </div>

      {aba === 'dashboard' && (
        <AbaDashboardExecutivo perfil={perfil} config={config} form={form} configCarregada={configCarregada} />
      )}
      {aba === 'diagnostico' && (
        <AbaDiagnostico perfil={perfil} config={config} form={form} />
      )}
      {aba === 'calculadora' && (
        <>
          <PainelConfigCustos calc={calc} perfil={perfil} />
          <PainelServico calc={calc} />
          <PainelResultado calc={calc} />
        </>
      )}
    </div>
  );
}
