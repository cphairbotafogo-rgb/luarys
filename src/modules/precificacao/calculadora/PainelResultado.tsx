'use client'
import { C } from '@/lib/constants';
import { RAIO_LG, RAIO_MD, cardAdmin } from '@/lib/estiloGlobal';
import { brl, pct, CORES, obterHorasMesEfetivo } from '../tipos';
import { BarraComposicao, Alerta, CardLucroHora } from '../componentes';
import { ValidacaoMercado } from '../ValidacaoMercado';

export function PainelResultado({ calc }: any) {
  const { resultado, form, config, modoParceiro, modoServico, servicoSelecionado, alertas } = calc;

  if (!resultado) return (
    <div style={{ background: C.dangerBg, borderRadius: RAIO_LG, padding: 16, fontSize: 13, color: C.dangerText, marginBottom: 20 }}>
      A soma das porcentagens ultrapassa 100% — ajuste comissão, imposto, cartão, depreciação e margem.
    </div>
  );

  return (
    <>
      <div style={{ ...cardAdmin, border: `2px solid ${C.douradoLuarys}22`, padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Preço ideal calculado</span>
            <div style={{ fontSize: 42, fontWeight: 900, color: C.douradoLuarys, lineHeight: 1.1, letterSpacing: '-1px' }}>{brl(resultado.precoIdeal)}</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
              Custo direto: <strong>{brl(resultado.custoDireto)}</strong>
              {' · '}Lucro esperado: <strong style={{ color: C.success }}>{brl(resultado.lucroValor)}</strong>
            </div>
          </div>

          {modoServico && servicoSelecionado?.preco_padrao > 0 && (() => {
            const atual = servicoSelecionado.preco_padrao;
            const diff = atual - resultado.precoIdeal;
            const ok = diff >= 0;
            return (
              <div style={{ textAlign: 'right', background: ok ? C.successBg : C.dangerBg, borderRadius: RAIO_LG, padding: '12px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: ok ? C.successText : C.dangerText, textTransform: 'uppercase' }}>Preço atual</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: ok ? C.successText : C.dangerText }}>{brl(atual)}</div>
                <div style={{ fontSize: 11, color: ok ? C.successText : C.dangerText }}>
                  {ok ? `+${pct((diff / resultado.precoIdeal) * 100)} acima ✓` : `${pct((diff / resultado.precoIdeal) * 100)} abaixo ⚠`}
                </div>
              </div>
            );
          })()}
        </div>

        <BarraComposicao resultado={resultado} modoParceiro={modoParceiro} />

        <div style={{ marginTop: 16 }}>
          <CardLucroHora lucroHora={resultado.lucroHora} duracaoMin={form.duracaoMin} />
        </div>

        <div style={{ marginTop: 20, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Composição do preço</div>
          {([
            ['Insumos (produtos)', resultado.custoDireto - resultado.custoFixoServico, CORES.insumos],
            [`Estrutura (${form.duracaoMin}min × ${brl(config.custoFixoMensal / obterHorasMesEfetivo(config, form.categoria))}/h)`, resultado.custoFixoServico, CORES.estrutura],
            [modoParceiro ? `Cota-parte do parceiro MEI (${form.cotaParteParceiro}%)` : `Comissão (${form.percentComissao}%)`, resultado.comissaoValor, modoParceiro ? CORES.parceiro : CORES.comissao],
            [modoParceiro ? `Imposto (${config.aliquotaImposto}% × cota ${pct(100 - form.cotaParteParceiro)})` : `Imposto (${config.aliquotaImposto}%)`, resultado.impostoValor, CORES.imposto],
            [`Taxa cartão (${config.taxaCartao}%)`, resultado.cartaoValor, CORES.cartao],
            [`Depreciação (${config.depreciacao}%)`, resultado.depreciacaoValor, CORES.depreciacao],
            [`Lucro do salão (${form.margemDesejada}%)`, resultado.lucroValor, CORES.lucro],
          ] as [string, number, string][]).map(([label, valor, cor], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < 6 ? `1px solid ${C.border}` : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.textMuted }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: cor, flexShrink: 0 }} />
                {label}
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                <span style={{ color: C.textLight }}>{pct(valor / resultado.precoIdeal * 100)}</span>
                <strong style={{ color: C.textMain, minWidth: 70, textAlign: 'right' }}>{brl(valor)}</strong>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', fontSize: 14, fontWeight: 800, color: C.textMain }}>
            <span>Total cobrado do cliente</span>
            <span style={{ color: C.douradoLuarys }}>{brl(resultado.precoIdeal)}</span>
          </div>
          {modoParceiro && resultado.economiaTributaria && resultado.economiaTributaria > 0 && (
            <div style={{ marginTop: 12, background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: RAIO_MD, padding: '10px 14px', fontSize: 12, color: '#7C3AED' }}>
              ⚡ <strong>Vantagem Parceiro:</strong> imposto sobre {brl(resultado.cotaParteSalaoValor || 0)} (não sobre tudo) · Economia: <strong style={{ color: C.successText }}>{brl(resultado.economiaTributaria)}</strong>/serviço
            </div>
          )}
        </div>
      </div>

      <ValidacaoMercado resultado={resultado} config={config} form={form} modoParceiro={modoParceiro} />

      {alertas.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alertas.map((a: any, i: number) => <Alerta key={i} tipo={a.tipo} texto={a.texto} />)}
        </div>
      )}
    </>
  );
}
