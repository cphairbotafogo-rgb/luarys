'use client'
/**
 * src/modules/precificacao/ModalComparacaoPreco.tsx
 *
 * Modal sobreposto, aberto a partir de um alerta no Diagnóstico da Tabela.
 * Mostra o preço ATUAL do serviço ao lado do preço RECOMENDADO pelo motor
 * de precificação, com o porquê (margem, lucro/hora, comissão), e permite
 * ajustar o preço ali mesmo — sem precisar abrir o cadastro completo do
 * serviço. Quem quiser editar outros campos (categoria, setor, insumos
 * etc.) tem um botão "Editar tudo" que leva ao cadastro completo.
 */
import { useState, useMemo } from 'react';
import { C } from '@/lib/constants';
import { overlayModal, containerModal, RAIO_SM, RAIO_MD, RAIO_XL, labelPadrao, inputAdmin } from '@/lib/estiloGlobal';
import { FiX, FiArrowRight, FiEdit3, FiShield, FiPercent } from 'react-icons/fi';
import { brl, pct, classificarLucroHora, calcularPreco, obterHorasMesEfetivo, type Resultado, type ConfigCustos, type FormCalculo } from './tipos';
import type { ServicoDiagnostico } from './useDiagnosticoCatalogo';

// Mesmo mapeamento usado no cadastro completo (ModalServicos.tsx) — mantido
// em sincronia manual aqui porque é uma lista curta e estável (categorias
// fiscais do NFS-e Nacional para salão de beleza não mudam com frequência).
const TABELA_TRIBUTACAO_SALAO = [
  { id: 1, label: 'Cabelereiros e Barbeiros', nbs: '126021000', mun: '06.01' },
  { id: 2, label: 'Manicure e Pedicure', nbs: '126022000', mun: '06.01' },
  { id: 3, label: 'Estética, Bem-estar e Depilação', nbs: '126023000', mun: '06.02' },
  { id: 4, label: 'Maquiagem e Outros', nbs: '126029000', mun: '06.02' },
];

interface Props {
  servico: ServicoDiagnostico;
  config: ConfigCustos;
  form: FormCalculo;
  onClose: () => void;
  onSalvarPreco: (novoPreco: number) => void;
  onSalvarDetalhes: (detalhes: { duracao_minutos: number; nbs: string; codigo_municipio: string; aliquota_iss: number; eh_cortesia: boolean }) => void;
  onEditarTudo: () => void;
}

const labelMiniStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.4px',
};

const inputMiniStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 13, color: C.textMain,
};

export function ModalComparacaoPreco({ servico, config, form, onClose, onSalvarPreco, onSalvarDetalhes, onEditarTudo }: Props) {
  // Sempre começa com o preço ATUAL — o dono só muda para o recomendado se
  // clicar em "Usar recomendado". Antes pré-selecionava o recomendado
  // automaticamente, o que fazia o dono "salvar" um preço novo sem ter
  // decidido isso conscientemente.
  const [novoPreco, setNovoPreco] = useState(String(servico.preco_padrao));
  const [salvando, setSalvando] = useState(false);

  // Duração e tributação — editáveis aqui mesmo, sem precisar abrir o
  // cadastro completo. Mudar a duração não recalcula o preço recomendado
  // ao vivo (isso exigiria duplicar o motor de cálculo aqui); o valor novo
  // aparece após salvar, quando o diagnóstico recarrega — igual já acontece
  // hoje com o preço.
  const [duracaoMin, setDuracaoMin] = useState(String(servico.duracaoMin || servico.duracao_minutos || 60));
  const [nbs, setNbs] = useState(servico.nbs || '');
  const [codigoMunicipio, setCodigoMunicipio] = useState(servico.codigo_municipio || '');
  const [aliquotaIss, setAliquotaIss] = useState(servico.aliquota_iss != null ? String(servico.aliquota_iss) : '0.00');
  const [ehCortesia, setEhCortesia] = useState(!!servico.eh_cortesia);

  // Evita que a rolagem do mouse altere o valor do campo por acidente —
  // comportamento padrão (e perigoso) de <input type="number"> em todos os
  // navegadores quando o campo está em foco e a página é rolada sobre ele.
  // Como o modal inteiro tem scroll, isso acontecia com frequência.
  function bloquearScrollNoCampo(e: React.WheelEvent<HTMLInputElement>) {
    e.currentTarget.blur();
  }

  const calc: Resultado | null = servico.calc;
  const precoRecomendado = servico.precoIdeal;

  // Recalcula margem real, lucro/hora e custos ao vivo, usando o preço e a
  // duração que o empresário está digitando agora — não os valores salvos.
  // É a MESMA fórmula usada em useDiagnosticoCatalogo.ts (preço atual menos
  // insumos, custo fixo/hora e os percentuais de comissão/imposto/cartão/
  // depreciação), só que aplicada ao valor em edição, para ele ver o efeito
  // do ajuste antes de confirmar.
  const previa = useMemo(() => {
    const precoDigitado = parseFloat(novoPreco.replace(',', '.'));
    const duracaoDigitada = parseInt(duracaoMin, 10);
    if (isNaN(precoDigitado) || precoDigitado <= 0 || isNaN(duracaoDigitada) || duracaoDigitada <= 0) {
      return null;
    }

    const horasMesEfetivo = obterHorasMesEfetivo(config, servico.setor);
    const custoFixoHora = horasMesEfetivo > 0 ? config.custoFixoMensal / horasMesEfetivo : 0;
    const custoFixoServico = (duracaoDigitada / 60) * custoFixoHora;
    const custoDireto = servico.custoInsumos + custoFixoServico;

    const totalDeducoesPct = (form.percentComissao + config.aliquotaImposto + config.taxaCartao + config.depreciacao) / 100;
    const lucro = precoDigitado - custoDireto - (precoDigitado * totalDeducoesPct);
    const horasServico = duracaoDigitada / 60;
    const lucroHora = horasServico > 0 ? lucro / horasServico : 0;
    const margemPct = precoDigitado > 0 ? (lucro / precoDigitado) * 100 : 0;
    const comissaoValor = precoDigitado * form.percentComissao / 100;

    // Recalcula também o preço recomendado para a duração digitada — se o
    // empresário aumentar a duração, o custo de estrutura por serviço sobe,
    // então o preço ideal também muda (e não fica mais comparável ao
    // precoRecomendado original, calculado para a duração antiga).
    const calcRecomendado = calcularPreco(config, { ...form, duracaoMin: duracaoDigitada, custoInsumos: servico.custoInsumos, categoria: servico.setor }, false);

    return {
      margemRealPct: margemPct,
      lucroHoraReal: lucroHora,
      custoDireto,
      custoFixoServico,
      comissaoValor,
      precoRecomendado: calcRecomendado?.precoIdeal ?? precoRecomendado,
    };
  }, [novoPreco, duracaoMin, config, form, servico.custoInsumos, servico.setor, precoRecomendado]);

  // Enquanto os campos têm um valor válido, mostra a prévia ao vivo;
  // se ficaram vazios/inválidos, volta a mostrar os dados salvos (servico.*)
  // em vez de quebrar a tela.
  const margemExibida = previa ? previa.margemRealPct : servico.margemRealPct;
  const lucroHoraExibido = previa ? previa.lucroHoraReal : servico.lucroHoraReal;
  const custoDiretoExibido = previa ? previa.custoDireto + previa.custoFixoServico : (calc ? calc.custoDireto + calc.custoFixoServico : 0);
  const comissaoExibida = previa ? previa.comissaoValor : (calc ? calc.comissaoValor : 0);
  const precoRecomendadoExibido = previa ? previa.precoRecomendado : precoRecomendado;
  const precoAtual = servico.preco_padrao;
  const diferenca = precoRecomendadoExibido - precoAtual;
  const statusHora = classificarLucroHora(lucroHoraExibido);

  // Um único botão salva tudo: preço, duração, tributação e a marcação de
  // cortesia juntos. Cortesia é a única situação em que preço 0 é válido —
  // fora dela, preço 0 normalmente é um cadastro incompleto, não uma
  // intenção real, então continuamos bloqueando.
  async function confirmar() {
    const valor = parseFloat(novoPreco.replace(',', '.'));
    if (isNaN(valor) || (valor <= 0 && !ehCortesia)) return;
    const duracao = parseInt(duracaoMin, 10);
    if (isNaN(duracao) || duracao <= 0) return;

    setSalvando(true);
    await onSalvarPreco(ehCortesia ? 0 : valor);
    await onSalvarDetalhes({
      duracao_minutos: duracao,
      nbs: nbs,
      codigo_municipio: codigoMunicipio,
      aliquota_iss: parseFloat(String(aliquotaIss).replace(',', '.')) || 0,
      eh_cortesia: ehCortesia,
    });
    setSalvando(false);
  }

  return (
    <div
      onClick={onClose}
      style={{ ...overlayModal, zIndex: 1000 }}
    >
      <style>{`
        .modal-comparacao-scroll::-webkit-scrollbar { width: 6px; }
        .modal-comparacao-scroll::-webkit-scrollbar-track { background: transparent; }
        .modal-comparacao-scroll::-webkit-scrollbar-thumb { background: ${C.borderMid}; border-radius: 10px; }
        .modal-comparacao-scroll { scrollbar-width: thin; scrollbar-color: ${C.borderMid} transparent; }
      `}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-comparacao-scroll"
        style={{ ...containerModal, maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px', borderBottom: `1px solid ${C.border}` }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.textMain }}>{servico.nome_servico}</h3>
            <span style={{ fontSize: 12, color: C.textLight }}>{servico.setor || servico.categoria || 'Sem setor definido'}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, padding: 4 }}>
            <FiX size={20} />
          </button>
        </div>

        <div style={{ padding: 24 }}>
          {/* Comparação visual: atual vs recomendado */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div style={{ flex: 1, textAlign: 'center', background: C.bg, borderRadius: RAIO_MD, padding: '16px 12px', border: `1px solid ${C.border}` }}>
              <div style={labelMiniStyle}>Preço Atual</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: C.textMain, marginTop: 4 }}>{brl(precoAtual)}</div>
            </div>
            <FiArrowRight size={20} color={C.textLight} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, textAlign: 'center', background: diferenca > 0 ? '#F0FDF4' : '#FFFBEB', borderRadius: RAIO_XL, padding: '16px 12px', border: `1px solid ${diferenca > 0 ? '#BBF7D0' : '#FCD34D'}` }}>
              <div style={labelMiniStyle}>Recomendado</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: diferenca > 0 ? '#15803D' : '#92400E', marginTop: 4 }}>{brl(precoRecomendadoExibido)}</div>
            </div>
          </div>

          {diferenca !== 0 && (
            <div style={{ textAlign: 'center', fontSize: 12, color: C.textMuted, marginBottom: 20 }}>
              {diferenca > 0
                ? `Sugestão: subir ${brl(diferenca)} para cobrir seus custos com a margem que você definiu.`
                : `Seu preço atual já está ${brl(Math.abs(diferenca))} acima do mínimo recomendado.`}
            </div>
          )}

          {/* Por quê — detalhamento do que está errado hoje */}
          <div style={{ background: C.bg, borderRadius: RAIO_MD, padding: 16, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={labelMiniStyle}>Por que esse ajuste é sugerido</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: C.textMuted }}>Margem real hoje</span>
              {ehCortesia ? (
                <strong style={{ color: C.textMuted, fontStyle: 'italic' }}>Preço simbólico</strong>
              ) : (
                <strong style={{ color: margemExibida < 20 ? C.dangerText : C.textMain }}>{pct(margemExibida)}</strong>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: C.textMuted }}>Lucro por hora ocupada</span>
              <strong style={{ color: statusHora === 'prejuizo' ? C.dangerText : statusHora === 'fraco' ? '#92400E' : '#15803D' }}>
                {brl(lucroHoraExibido)}/h {statusHora === 'prejuizo' ? '(prejuízo)' : statusHora === 'fraco' ? '(fraco)' : statusHora === 'bom' ? '(bom)' : '(ótimo)'}
              </strong>
            </div>
            {(previa || calc) && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: C.textMuted }}>Custo direto (insumos + estrutura/hora)</span>
                  <strong style={{ color: C.textMain }}>{brl(custoDiretoExibido)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: C.textMuted }}>Comissão/cota-parte sobre o preço sugerido</span>
                  <strong style={{ color: C.textMain }}>{brl(comissaoExibida)}</strong>
                </div>
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: C.textMuted }}>Duração do serviço</span>
              <strong style={{ color: C.textMain }}>{duracaoMin || servico.duracaoMin} min</strong>
            </div>
          </div>

          {/* Ajuste do preço */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ ...labelMiniStyle, display: 'block', marginBottom: 6 }}>Novo preço (R$)</label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="number" step="0.01" min="0"
                disabled={ehCortesia}
                value={ehCortesia ? '0' : novoPreco}
                onChange={e => setNovoPreco(e.target.value)}
                onWheel={bloquearScrollNoCampo}
                style={{ flex: 1, padding: '10px 14px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 16, fontWeight: 700, color: C.textMain, opacity: ehCortesia ? 0.5 : 1, cursor: ehCortesia ? 'not-allowed' : 'text' }}
              />
              {!ehCortesia && precoRecomendadoExibido > 0 && Number(novoPreco) !== Number(precoRecomendadoExibido.toFixed(2)) && (
                <button
                  onClick={() => setNovoPreco(precoRecomendadoExibido.toFixed(2))}
                  style={{ fontSize: 11, fontWeight: 700, color: C.sidebarBg, background: 'none', border: `1px dashed ${C.sidebarBg}`, borderRadius: RAIO_SM, padding: '8px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Usar recomendado
                </button>
              )}
            </div>
          </div>

          {/* Marcar como cortesia — direto aqui, sem precisar ir ao cadastro
              completo. Trava o preço em R$ 0,00 e tira o serviço dos
              alertas de margem/comissão, mantendo só o alerta de tempo
              ocupado na agenda. */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: C.textMain, fontWeight: 500, marginBottom: 20 }}>
            <input
              type="checkbox"
              checked={ehCortesia}
              onChange={e => { setEhCortesia(e.target.checked); if (e.target.checked) setNovoPreco('0'); }}
              style={{ accentColor: C.sidebarBg, width: 15, height: 15 }}
            />
            Este é um serviço de cortesia / não cobrado (ex: retoque grátis)
          </label>


          {/* Duração do serviço */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ ...labelMiniStyle, display: 'block', marginBottom: 6 }}>Duração do serviço (minutos)</label>
            <input
              type="number" min="1" step="5"
              value={duracaoMin}
              onChange={e => setDuracaoMin(e.target.value)}
              onWheel={bloquearScrollNoCampo}
              style={{ ...inputMiniStyle, maxWidth: 160, fontWeight: 700 }}
            />
          </div>

          {/* Tributação (NFS-e Nacional) */}
          <div style={{ background: C.bg, borderRadius: RAIO_MD, padding: 16, marginBottom: 20, border: `1px solid ${C.borderMid}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              <FiShield size={14} color={C.sidebarBg} />
              <span style={{ ...labelMiniStyle, color: C.sidebarBg }}>Tributação de Serviço (NFS-e Nacional)</span>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ ...labelMiniStyle, display: 'block', marginBottom: 6 }}>Seleção Inteligente de Tributação</label>
              <select
                style={{ ...inputMiniStyle, cursor: 'pointer', border: `1px solid ${C.sidebarBg}`, color: C.sidebarBg, fontWeight: 700 }}
                onChange={(e) => {
                  const selecionado = TABELA_TRIBUTACAO_SALAO.find(t => t.nbs === e.target.value);
                  if (selecionado) { setNbs(selecionado.nbs); setCodigoMunicipio(selecionado.mun); }
                }}
              >
                <option value="">-- Selecione o tipo de serviço para auto-preencher --</option>
                {TABELA_TRIBUTACAO_SALAO.map(t => <option key={t.id} value={t.nbs}>{t.label}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ ...labelMiniStyle, display: 'block', marginBottom: 6 }}>Código Federal (NBS) *</label>
                <input style={inputMiniStyle} value={nbs} onChange={e => setNbs(e.target.value.replace(/\D/g, ''))} placeholder="Ex: 126021000" maxLength={9} />
              </div>
              <div>
                <label style={{ ...labelMiniStyle, display: 'block', marginBottom: 6 }}>Código Municipal</label>
                <input style={inputMiniStyle} value={codigoMunicipio} onChange={e => setCodigoMunicipio(e.target.value)} placeholder="Ex: 06.01" />
              </div>
              <div>
                <label style={{ ...labelMiniStyle, display: 'block', marginBottom: 6 }}>Alíquota ISS (%) *</label>
                <div style={{ position: 'relative' }}>
                  <input type="number" step="0.01" style={{ ...inputMiniStyle, paddingRight: 28 }} value={aliquotaIss} onChange={e => setAliquotaIss(e.target.value)} onWheel={bloquearScrollNoCampo} placeholder="Ex: 2.00" />
                  <FiPercent size={12} color={C.textLight} style={{ position: 'absolute', right: 10, top: 11 }} />
                </div>
              </div>
            </div>
          </div>

          {/* Ações */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={confirmar}
              disabled={salvando}
              style={{ flex: 1, minWidth: 160, padding: '12px 16px', borderRadius: RAIO_MD, border: 'none', background: C.sidebarBg, color: '#fff', fontSize: 13, fontWeight: 700, cursor: salvando ? 'wait' : 'pointer', opacity: salvando ? 0.7 : 1 }}
            >
              {salvando ? 'Salvando...' : ehCortesia ? 'Salvar como cortesia (R$ 0,00)' : `Salvar novo preço (${brl(Number(novoPreco) || 0)})`}
            </button>
            <button
              onClick={onEditarTudo}
              style={{ padding: '12px 16px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, background: C.bgCard, color: C.textMuted, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <FiEdit3 size={14} /> Editar tudo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}