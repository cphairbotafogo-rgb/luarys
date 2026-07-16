'use client'
/**
 * src/modules/precificacao/ValidacaoMercado.tsx
 *
 * Bloco opcional "Validação com o Mercado":
 * — campo de preço de mercado
 * — calculadora reversa (margem ao preço de mercado)
 * — diagnóstico do maior custo e como resolver
 */

import { useState } from 'react';
import { C } from '@/lib/constants';
import { RAIO_MD, RAIO_LG, RAIO_XL } from '@/lib/estiloGlobal';
import { type ConfigCustos, type FormCalculo, type Resultado, CORES, brl, pct } from './tipos';
import { Tooltip } from './componentes';

interface Props {
  resultado: Resultado;
  config: ConfigCustos;
  form: FormCalculo;
  modoParceiro: boolean;
}

export function ValidacaoMercado({ resultado, config, form, modoParceiro }: Props) {
  const [precoMercado, setPrecoMercado] = useState<number | ''>('');

  const inputStyle: React.CSSProperties = {
    padding: '9px 12px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`,
    fontSize: 13, color: C.textMain, background: C.bgCard,
    boxSizing: 'border-box', fontFamily: 'inherit',
  };

  return (
    <div style={{ background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, padding: 20, marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.textMain, marginBottom: 4 }}>
        Validação com o mercado
        <Tooltip texto="Opcional. Preencha com o preço que os salões do seu bairro cobram por este serviço. A ferramenta mostra se o seu preço ideal é viável e o que está pesando mais." />
      </div>
      <p style={{ fontSize: 12, color: C.textMuted, margin: '0 0 12px' }}>Quanto os salões do seu bairro cobram por este serviço?</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute', left: 10, fontSize: 11, color: C.textLight, fontWeight: 700 }}>R$</span>
          <input
            type="number" min={0} step={1} placeholder="ex: 150"
            value={precoMercado}
            onChange={e => setPrecoMercado(e.target.value === '' ? '' : Number(e.target.value))}
            style={{ ...inputStyle, width: 120, paddingLeft: 30 }}
          />
        </div>
        {precoMercado !== '' && (
          <button onClick={() => setPrecoMercado('')} style={{ fontSize: 11, color: C.textLight, background: 'none', border: 'none', cursor: 'pointer' }}>
            Limpar
          </button>
        )}
      </div>

      {precoMercado !== '' && precoMercado > 0 && (
        <AnaliseViabilidade
          pm={Number(precoMercado)}
          resultado={resultado}
          config={config}
          form={form}
          modoParceiro={modoParceiro}
        />
      )}
    </div>
  );
}

// ─── SUB-COMPONENTE: ANÁLISE DE VIABILIDADE ──────────────────────────────────

function AnaliseViabilidade({ pm, resultado, config, form, modoParceiro }: {
  pm: number;
  resultado: Resultado;
  config: ConfigCustos;
  form: FormCalculo;
  modoParceiro: boolean;
}) {
  const pi      = resultado.precoIdeal;
  const diff    = pi - pm;
  const diffPct = (diff / pm) * 100;
  const viavel  = pi <= pm;

  const cotaParceiroFrac = modoParceiro ? form.cotaParteParceiro / 100 : form.percentComissao / 100;
  const cotaParteFrac    = 1 - cotaParceiroFrac;
  const impostoBase      = modoParceiro
    ? pm * cotaParteFrac * (config.aliquotaImposto / 100)
    : pm * config.aliquotaImposto / 100;

  const margemReal    = pm - resultado.custoDireto - pm * cotaParceiroFrac - impostoBase - pm * config.taxaCartao / 100 - pm * config.depreciacao / 100;
  const margemRealPct = (margemReal / pm) * 100;

  const drivers = [
    { nome: 'custo de estrutura (aluguel/energia/etc)', valor: resultado.custoFixoServico },
    { nome: 'custo de insumos (produtos)', valor: resultado.custoDireto - resultado.custoFixoServico },
    { nome: modoParceiro ? 'cota-parte do parceiro' : 'comissão do profissional', valor: resultado.comissaoValor },
    { nome: 'imposto', valor: resultado.impostoValor },
  ].sort((a, b) => b.valor - a.valor);
  const maiorDriver = drivers[0];

  const margemDesejadaValor   = pm * form.margemDesejada / 100;
  const disponivelParaEstrutura = pm - (resultado.custoDireto - resultado.custoFixoServico) - pm * cotaParceiroFrac - impostoBase - pm * config.taxaCartao / 100 - pm * config.depreciacao / 100 - margemDesejadaValor;
  const horasNecessarias = disponivelParaEstrutura > 0
    ? config.custoFixoMensal / (disponivelParaEstrutura / (form.duracaoMin / 60))
    : null;

  return (
    <div style={{ marginTop: 16 }}>
      {/* Status geral */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: RAIO_LG, marginBottom: 14,
        background: viavel ? C.successBg : diffPct > 50 ? C.dangerBg : '#FFFBEB',
        border: `1px solid ${viavel ? '#6EE7B7' : diffPct > 50 ? '#FCA5A5' : '#FCD34D'}`,
      }}>
        <span style={{ fontSize: 24 }}>{viavel ? '✅' : diffPct > 50 ? '🔴' : '🟡'}</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 13, color: viavel ? C.successText : diffPct > 50 ? C.dangerText : '#92400E' }}>
            {viavel
              ? `Viável! Seu preço ideal (${brl(pi)}) está dentro do mercado.`
              : `Preço ideal (${brl(pi)}) está ${pct(Math.abs(diffPct))} acima do mercado (${brl(pm)}).`}
          </div>
          <div style={{ fontSize: 12, marginTop: 2, color: viavel ? C.successText : diffPct > 50 ? C.dangerText : '#92400E' }}>
            {viavel
              ? `Ao cobrar ${brl(pm)}, sua margem será de ${pct(margemRealPct)} — ${margemRealPct >= form.margemDesejada ? 'acima' : 'abaixo'} da meta de ${pct(form.margemDesejada)}.`
              : `Você precisaria cobrar ${brl(diff)} a mais do que o mercado pratica para atingir sua meta de lucro.`}
          </div>
        </div>
      </div>

      {/* Calculadora reversa */}
      <div style={{ background: C.bg, borderRadius: RAIO_LG, padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
          Calculadora reversa — ao cobrar {brl(pm)}:
        </div>
        {[
          { label: `Cota do profissional (${modoParceiro ? form.cotaParteParceiro : form.percentComissao}%)`, valor: -pm * cotaParceiroFrac, cor: modoParceiro ? CORES.parceiro : CORES.comissao },
          { label: modoParceiro ? `Imposto (${config.aliquotaImposto}% × sua cota)` : `Imposto (${config.aliquotaImposto}%)`, valor: -impostoBase, cor: CORES.imposto },
          { label: `Taxa cartão (${config.taxaCartao}%)`, valor: -pm * config.taxaCartao / 100, cor: CORES.cartao },
          { label: `Depreciação (${config.depreciacao}%)`, valor: -pm * config.depreciacao / 100, cor: CORES.depreciacao },
          { label: 'Insumos (produtos)', valor: -(resultado.custoDireto - resultado.custoFixoServico), cor: CORES.insumos },
          { label: 'Estrutura (custo fixo alocado)', valor: -resultado.custoFixoServico, cor: CORES.estrutura },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.textMuted }}>
              <div style={{ width: 7, height: 7, borderRadius: 2, background: item.cor, flexShrink: 0 }} />
              {item.label}
            </span>
            <span style={{ color: C.dangerText, fontWeight: 700 }}>{brl(item.valor)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', fontSize: 14, fontWeight: 800 }}>
          <span style={{ color: C.textMain }}>Lucro ao cobrar {brl(pm)}</span>
          <span style={{ color: margemReal >= 0 ? C.success : C.danger }}>
            {brl(margemReal)} ({pct(margemRealPct)})
          </span>
        </div>
      </div>

      {/* Diagnóstico do que pesa mais */}
      {!viavel && (
        <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: RAIO_LG, padding: '12px 16px' }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: '#9A3412', marginBottom: 8 }}>
            💡 O que está pesando mais e como resolver:
          </div>
          <div style={{ fontSize: 12, color: '#9A3412', marginBottom: 6 }}>
            Maior custo: <strong>{maiorDriver.nome}</strong> ({brl(maiorDriver.valor)} por serviço)
          </div>
          {horasNecessarias && horasNecessarias > 0 && (
            <div style={{ fontSize: 12, color: '#9A3412', marginBottom: 4 }}>
              → Para chegar ao preço de mercado com {pct(form.margemDesejada)} de margem, você precisaria ter <strong>{Math.round(horasNecessarias)} horas faturadas/mês</strong> (hoje: {config.horasMes}h). Lembre: some as horas de todos os profissionais.
            </div>
          )}
          {margemReal > 0 && margemReal < pm * form.margemDesejada / 100 && (
            <div style={{ fontSize: 12, color: '#9A3412', marginBottom: 4 }}>
              → Ao preço de mercado ({brl(pm)}), você ainda <strong>tem lucro</strong> ({brl(margemReal)}), mas abaixo da sua meta. Considere se essa margem é aceitável.
            </div>
          )}
          {margemReal < 0 && (
            <div style={{ fontSize: 12, color: C.dangerText, marginBottom: 4 }}>
              → Ao preço de mercado, o serviço está no <strong>prejuízo</strong>. Revise custos fixos, comissão ou insumos para viabilizar.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
