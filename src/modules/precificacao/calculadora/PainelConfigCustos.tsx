'use client'
import { useState } from 'react';
import { C } from '@/lib/constants';
import { FiDatabase, FiRefreshCw, FiLoader, FiCheck, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { RAIO_SM, RAIO_MD, RAIO_XL, cardAdmin, inputAdmin, labelPadrao } from '@/lib/estiloGlobal';
import { brl } from '../tipos';
import { Tooltip, HorasAssistente } from '../componentes';

export function PainelConfigCustos({ calc, perfil }: any) {
  const [configAberta, setConfigAberta] = useState(true);
  const { config, salvarConfig, puxarCustosDoFinanceiro, puxandoCustos, configCarregada, salvandoConfig, setores } = calc;

  return (
    <div style={{ ...cardAdmin, marginBottom: 20 }}>
      <button onClick={() => setConfigAberta(!configAberta)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: RAIO_XL }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FiDatabase size={15} color={C.sidebarBg} />
          <span style={{ fontSize: 13, fontWeight: 700, color: C.sidebarBg }}>Configuração dos Custos do Salão</span>
          <span style={{ fontSize: 11, color: C.textLight, fontStyle: 'italic' }}>— configure uma vez, use sempre</span>
          {salvandoConfig && (
            <span style={{ fontSize: 11, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
              <FiLoader size={11} className="animate-spin" /> Salvando...
            </span>
          )}
          {!salvandoConfig && configCarregada && (
            <span style={{ fontSize: 11, color: '#10B981', display: 'flex', alignItems: 'center', gap: 4 }}>
              <FiCheck size={11} /> Salvo na nuvem
            </span>
          )}
        </div>
        {configAberta ? <FiChevronUp size={16} color={C.textLight} /> : <FiChevronDown size={16} color={C.textLight} />}
      </button>

      {configAberta && (
        <div style={{ padding: '0 20px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>

          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelPadrao}>
                Custo Fixo Mensal (R$)
                <Tooltip texto="Aluguel + energia + água + salários fixos + contador + marketing. NÃO inclua produtos de serviço." />
              </label>
              <input type="number" min={0} style={inputAdmin} value={config.custoFixoMensal}
                onChange={e => salvarConfig({ ...config, custoFixoMensal: Number(e.target.value) })} placeholder="ex: 8000" />
            </div>
            <button onClick={puxarCustosDoFinanceiro} disabled={puxandoCustos}
              style={{ whiteSpace: 'nowrap', padding: '9px 14px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, background: C.bg, color: C.textMuted, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <FiRefreshCw size={12} /> Puxar do Financeiro
            </button>
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
              <label style={{ ...labelPadrao, margin: 0 }}>
                Horas de atendimento/mês
                <Tooltip texto="Base para ratear o custo fixo entre os serviços. No modo simples, soma TODOS os profissionais. No modo por categoria, cada setor usa apenas as horas dos seus profissionais." />
              </label>
              <div style={{ display: 'flex', background: C.bg, borderRadius: RAIO_MD, padding: 3 }}>
                {([['simples', 'Simples'], ['categoria', 'Por categoria']] as const).map(([val, label]) => (
                  <button key={val} onClick={() => salvarConfig({ ...config, modoHoras: val })}
                    style={{ padding: '5px 12px', borderRadius: RAIO_SM, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      background: (config.modoHoras || 'simples') === val ? C.bgCard : 'transparent',
                      color: (config.modoHoras || 'simples') === val ? C.sidebarBg : C.textMuted,
                      boxShadow: (config.modoHoras || 'simples') === val ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {(config.modoHoras || 'simples') === 'simples' ? (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <input type="number" min={1} style={{ ...inputAdmin, width: 120, flex: 'none' }}
                  value={config.horasMes}
                  onChange={e => salvarConfig({ ...config, horasMes: Number(e.target.value) })} placeholder="ex: 300" />
                <div style={{ flex: 1, minWidth: 260 }}>
                  <p style={{ margin: '0 0 6px', fontSize: 11, color: C.textLight }}>Não sabe o total? Use o assistente:</p>
                  <HorasAssistente salaoId={perfil?.salao_id} onCalcular={(h: number) => salvarConfig({ ...config, horasMes: h })} />
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                  {setores.map((s: any) => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.textMain, width: 140, flex: 'none' }}>{s.nome}</span>
                      <input type="number" min={0} style={{ ...inputAdmin, width: 120, flex: 'none' }}
                        value={config.horasMesPorCategoria?.[s.nome] ?? ''}
                        onChange={e => salvarConfig({ ...config, horasMesPorCategoria: { ...config.horasMesPorCategoria, [s.nome]: Number(e.target.value) } })}
                        placeholder="ex: 150" />
                      <span style={{ fontSize: 11, color: C.textLight }}>h/mês</span>
                    </div>
                  ))}
                  {setores.length === 0 && (
                    <p style={{ fontSize: 12, color: C.textLight, fontStyle: 'italic', margin: 0 }}>
                      Cadastre as funções da equipe em "Minha Equipe" para configurar as horas de cada setor.
                    </p>
                  )}
                </div>
                <p style={{ margin: '0 0 6px', fontSize: 11, color: C.textLight }}>Não sabe os totais? Use o assistente:</p>
                <HorasAssistente
                  salaoId={perfil?.salao_id}
                  onCalcular={(h: number) => salvarConfig({ ...config, horasMes: h })}
                  onCalcularPorCategoria={(mapa: any) => salvarConfig({ ...config, horasMesPorCategoria: { ...config.horasMesPorCategoria, ...mapa } })}
                />
              </div>
            )}
          </div>

          <div>
            <label style={labelPadrao}>Imposto (%)<Tooltip texto="Simples Nacional: de 6% a 19.5%. Confirme com seu contador." /></label>
            <input type="number" min={0} max={50} step={0.5} style={inputAdmin} value={config.aliquotaImposto}
              onChange={e => salvarConfig({ ...config, aliquotaImposto: Number(e.target.value) })} />
          </div>
          <div>
            <label style={labelPadrao}>Taxa cartão (%)<Tooltip texto="Média ponderada das taxas de débito, crédito e Pix." /></label>
            <input type="number" min={0} max={20} step={0.1} style={inputAdmin} value={config.taxaCartao}
              onChange={e => salvarConfig({ ...config, taxaCartao: Number(e.target.value) })} />
          </div>
          <div>
            <label style={labelPadrao}>Depreciação (%)<Tooltip texto="Reserve 2-5% para troca de equipamentos (secadores, cadeiras, esmaltes)." /></label>
            <input type="number" min={0} max={10} step={0.5} style={inputAdmin} value={config.depreciacao}
              onChange={e => salvarConfig({ ...config, depreciacao: Number(e.target.value) })} />
          </div>

          {config.custoFixoMensal > 0 && (config.modoHoras || 'simples') === 'simples' && config.horasMes > 0 && (() => {
            const ch = config.custoFixoMensal / config.horasMes;
            const alerta = ch > 80;
            return (
              <div style={{ gridColumn: '1 / -1', background: alerta ? '#FFFBEB' : '#F0F9FF', border: `1px solid ${alerta ? '#FCD34D' : '#BAE6FD'}`, borderRadius: RAIO_MD, padding: '10px 14px', fontSize: 12, color: alerta ? '#92400E' : '#075985' }}>
                <strong>Custo fixo por hora de atendimento: {brl(ch)}</strong>
                {alerta
                  ? ' ⚠️ Valor alto. Some as horas de TODOS os profissionais no campo acima.'
                  : ' — distribuído proporcionalmente entre todos os serviços pelo tempo de cada um.'}
              </div>
            );
          })()}
          {config.custoFixoMensal > 0 && config.modoHoras === 'categoria' && (() => {
            const categoriasComHoras = Object.entries(config.horasMesPorCategoria || {}) as [string, number][];
            const comHorasPositivas = categoriasComHoras.filter(([, h]) => h > 0);
            if (comHorasPositivas.length === 0) return null;
            return (
              <div style={{ gridColumn: '1 / -1', background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: RAIO_MD, padding: '10px 14px', fontSize: 12, color: '#075985' }}>
                <strong>Custo fixo por hora, por categoria:</strong>{' '}
                {comHorasPositivas.map(([cat, h]) => `${cat}: ${brl(config.custoFixoMensal / h)}`).join(' · ')}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
