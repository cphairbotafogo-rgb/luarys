'use client'
import { useState } from 'react';
import { C } from '@/lib/constants';
import { FiPlus, FiX, FiDownload, FiCheckCircle, FiLoader } from 'react-icons/fi';
import { S, API, FORMAS_PAG, moedaParaFloat, ptBR } from './tipos';

export function AbaEmitirNFCe({ state, dispatch, bancoProdutos, salaoId, toast }: any) {
  const [emitindo, setEmitindo] = useState(false);
  const [sucesso, setSucesso] = useState<any>(null);

  const totalProdutos = state.itens.reduce((acc: number, it: any) => acc + moedaParaFloat(it.vProd), 0);
  const desconto = moedaParaFloat(state.vDesconto);
  const totalFinal = Math.max(0, totalProdutos - desconto);
  const totalPago = state.pagamentos.reduce((acc: number, p: any) => acc + moedaParaFloat(p.vPag), 0);
  const troco = Math.max(0, totalPago - totalFinal);

  function selecionarProduto(uid: string, produtoId: string) {
    const prod = bancoProdutos.find((p: any) => p.id === produtoId);
    if (!prod) return;
    dispatch({ type: 'UPD_ITEM', uid, p: {
      produto_id: prod.id,
      cProd: prod.codigo_sku || prod.id.substring(0, 8),
      xProd: prod.nome_produto,
      NCM: prod.ncm || '33049900',
      CFOP: prod.cfop_padrao || '5102',
      CSOSN: prod.csosn_padrao || '102',
      vUnCom: ptBR(prod.preco_venda || 0),
      vProd: ptBR(prod.preco_venda || 0),
      qCom: '1',
    }});
  }

  async function emitir() {
    if (state.itens.some((it: any) => !it.xProd)) { toast('Preencha todos os itens.', 'erro'); return; }
    if (totalPago < totalFinal - 0.01) { toast('Valor pago menor que o total.', 'erro'); return; }
    setEmitindo(true);
    setSucesso(null);
    const res = await API.emitir({ itens: state.itens, consumidor: state.consumidor, pagamentos: state.pagamentos, desconto });
    setEmitindo(false);
    if (res.sucesso) {
      setSucesso(res);
      dispatch({ type: 'PATCH', p: {
        itens: [{ _uid: crypto.randomUUID(), produto_id: '', cProd: '', xProd: '', NCM: '', CFOP: '5102', uCom: 'UN', qCom: '1', vUnCom: '0,00', vProd: '0,00', orig: '0', CSOSN: '102' }],
        consumidor: { CPF: '', xNome: '', email: '' },
        pagamentos: [{ _uid: crypto.randomUUID(), tPag: '17', vPag: '' }],
        vDesconto: '0,00',
      }});
    } else {
      toast(res.erro || res.mensagem_erro || 'Erro ao emitir NFC-e.', 'erro');
    }
  }

  if (sucesso) return (
    <div style={{ ...S.card, textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
      <h3 style={{ fontFamily: 'var(--font-title)', margin: '0 0 8px', fontSize: 18, fontWeight: 900, color: C.success }}>NFC-e Emitida!</h3>
      <p style={{ color: C.textLight, fontSize: 14, margin: '0 0 4px' }}>Nota Nº {sucesso.numero_nota} · Série {state.config?.serie}</p>
      {sucesso.chave && <p style={{ color: C.textLight, fontSize: 11, wordBreak: 'break-all', margin: '0 0 24px' }}>Chave: {sucesso.chave}</p>}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        {sucesso.link_danfe && <a href={sucesso.link_danfe} target="_blank" rel="noopener noreferrer" style={{ ...S.btn(), textDecoration: 'none', fontSize: 12 }}><FiDownload size={14} /> DANFE</a>}
        {sucesso.link_xml  && <a href={sucesso.link_xml}   target="_blank" rel="noopener noreferrer" style={{ ...S.btn(C.textMuted), textDecoration: 'none', fontSize: 12 }}><FiDownload size={14} /> XML</a>}
        <button onClick={() => setSucesso(null)} style={{ ...S.btn(C.sidebarBg), fontSize: 12 }}><FiPlus size={14} /> Nova Nota</button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
      {/* COLUNA ESQUERDA: ITENS + CONSUMIDOR */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ ...S.card }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: C.sidebarBg, textTransform: 'uppercase' }}>Itens da Nota</h4>
            <button onClick={() => dispatch({ type: 'ADD_ITEM' })} style={{ ...S.btn(), fontSize: 11, padding: '8px 14px' }}><FiPlus size={13} /> Adicionar Item</button>
          </div>
          {state.itens.map((it: any, idx: number) => (
            <div key={it._uid} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 10, alignItems: 'end' }}>
              <div>
                <label style={S.label}>{idx === 0 ? 'Produto' : ''}</label>
                {bancoProdutos.length > 0 ? (
                  <select style={S.input} value={it.produto_id} onChange={e => selecionarProduto(it._uid, e.target.value)}>
                    <option value="">Selecione ou preencha abaixo</option>
                    {bancoProdutos.map((p: any) => <option key={p.id} value={p.id}>{p.nome_produto}</option>)}
                  </select>
                ) : (
                  <input style={S.input} placeholder="Descrição do produto" value={it.xProd}
                    onChange={e => dispatch({ type: 'UPD_ITEM', uid: it._uid, p: { xProd: e.target.value } })} />
                )}
              </div>
              <div>
                <label style={S.label}>{idx === 0 ? 'NCM' : ''}</label>
                <input style={S.input} placeholder="00000000" maxLength={8} value={it.NCM}
                  onChange={e => dispatch({ type: 'UPD_ITEM', uid: it._uid, p: { NCM: e.target.value } })} />
              </div>
              <div>
                <label style={S.label}>{idx === 0 ? 'Qtd' : ''}</label>
                <input type="number" min="0.01" step="0.01" style={S.input} value={it.qCom}
                  onChange={e => dispatch({ type: 'UPD_ITEM', uid: it._uid, p: { qCom: e.target.value } })} />
              </div>
              <div>
                <label style={S.label}>{idx === 0 ? 'Vlr Unit' : ''}</label>
                <input style={S.input} value={it.vUnCom}
                  onChange={e => dispatch({ type: 'UPD_ITEM', uid: it._uid, p: { vUnCom: e.target.value } })} />
              </div>
              <button
                onClick={() => dispatch({ type: 'PATCH', p: { itens: state.itens.filter((i: any) => i._uid !== it._uid) } })}
                disabled={state.itens.length === 1}
                style={{ background: 'none', border: 'none', color: C.danger, cursor: 'pointer', padding: '8px 4px', marginBottom: 1 }}>
                <FiX size={16} />
              </button>
              {it.xProd && (
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'center', paddingLeft: 4 }}>
                  <span style={{ fontSize: 11, color: C.textLight }}>Total: <strong style={{ color: C.sidebarBg }}>R$ {it.vProd}</strong></span>
                  <span style={{ fontSize: 11, color: C.textLight }}>CFOP: <strong>{it.CFOP}</strong></span>
                  <span style={{ fontSize: 11, color: C.textLight }}>CSOSN: <strong>{it.CSOSN}</strong></span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ ...S.card }}>
          <h4 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 800, color: C.sidebarBg, textTransform: 'uppercase' }}>Consumidor (Opcional)</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
            <div>
              <label style={S.label}>CPF</label>
              <input style={S.input} placeholder="000.000.000-00" maxLength={14} value={state.consumidor.CPF}
                onChange={e => dispatch({ type: 'SET', k: 'consumidor', v: { ...state.consumidor, CPF: e.target.value } })} />
            </div>
            <div>
              <label style={S.label}>Nome</label>
              <input style={S.input} placeholder="Nome do cliente" value={state.consumidor.xNome}
                onChange={e => dispatch({ type: 'SET', k: 'consumidor', v: { ...state.consumidor, xNome: e.target.value } })} />
            </div>
          </div>
        </div>
      </div>

      {/* COLUNA DIREITA: PAGAMENTO + TOTAIS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 24 }}>
        <div style={{ ...S.card }}>
          <h4 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 800, color: C.sidebarBg, textTransform: 'uppercase' }}>Pagamento</h4>
          {state.pagamentos.map((pag: any, idx: number) => (
            <div key={pag._uid} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
              <div>
                {idx === 0 && <label style={S.label}>Forma</label>}
                <select style={S.input} value={pag.tPag}
                  onChange={e => dispatch({ type: 'PATCH', p: { pagamentos: state.pagamentos.map((p: any) => p._uid === pag._uid ? { ...p, tPag: e.target.value } : p) } })}>
                  {Object.entries(FORMAS_PAG).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                {idx === 0 && <label style={S.label}>Valor</label>}
                <input style={S.input} placeholder="0,00" value={pag.vPag}
                  onChange={e => dispatch({ type: 'PATCH', p: { pagamentos: state.pagamentos.map((p: any) => p._uid === pag._uid ? { ...p, vPag: e.target.value } : p) } })} />
              </div>
              <button
                onClick={() => dispatch({ type: 'PATCH', p: { pagamentos: state.pagamentos.filter((p: any) => p._uid !== pag._uid) } })}
                disabled={state.pagamentos.length === 1}
                style={{ background: 'none', border: 'none', color: C.danger, cursor: 'pointer', padding: '8px 4px', marginBottom: 1 }}>
                <FiX size={14} />
              </button>
            </div>
          ))}
          <button
            onClick={() => dispatch({ type: 'PATCH', p: { pagamentos: [...state.pagamentos, { _uid: crypto.randomUUID(), tPag: '01', vPag: '' }] } })}
            style={{ background: 'none', border: `1px dashed ${C.borderMid}`, color: C.textLight, padding: '8px', borderRadius: 8, fontSize: 12, cursor: 'pointer', width: '100%', marginTop: 4 }}>
            + Forma de pagamento
          </button>
        </div>

        <div style={{ ...S.card, background: C.sidebarBg, color: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
            <span>Subtotal</span><span>R$ {ptBR(totalProdutos)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13 }}>Desconto</span>
            <input
              style={{ ...S.input, width: 100, textAlign: 'right', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '4px 8px' }}
              value={state.vDesconto}
              onChange={e => dispatch({ type: 'SET', k: 'vDesconto', v: e.target.value })} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 20, borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 12, marginTop: 8 }}>
            <span>Total</span><span>R$ {ptBR(totalFinal)}</span>
          </div>
          {troco > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 8, color: '#86EFAC' }}>
              <span>Troco</span><span>R$ {ptBR(troco)}</span>
            </div>
          )}
        </div>

        <button
          onClick={emitir}
          disabled={emitindo || state.itens.every((it: any) => !it.xProd)}
          style={{ ...S.btn(C.success), width: '100%', justifyContent: 'center', padding: '16px', fontSize: 14, fontWeight: 900, opacity: emitindo ? 0.7 : 1, cursor: emitindo ? 'not-allowed' : 'pointer' }}>
          {emitindo ? <><FiLoader size={16} /> Emitindo...</> : <><FiCheckCircle size={16} /> Emitir NFC-e</>}
        </button>
      </div>
    </div>
  );
}
