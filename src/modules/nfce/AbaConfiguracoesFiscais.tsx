'use client'
import { C } from '@/lib/constants';
import { cardAdmin, RAIO_XL, RAIO_MD } from '@/lib/estiloGlobal';
import { FiLock } from 'react-icons/fi';
import { S, CRT_OPCOES, API, getAuthToken } from './tipos';

export function AbaConfiguracoesFiscais({ state, dispatch, salaoId, toast }: any) {
  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ marginBottom: 24 }}>
        <h3 className="font-title uppercase tracking-widest" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.sidebarBg }}>
          Parâmetros de Emissão (NFC-e)
        </h3>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: C.textMuted }}>
          Configurações obrigatórias exigidas pela SEFAZ para venda de produtos.
        </p>
      </div>

      <form
        onSubmit={async e => {
          e.preventDefault();
          // O CSC nao e gravado no nosso banco: vai do navegador direto para a
          // Brasil NFe, que e quem assina o QR Code do DANFE. Mesma regra do
          // certificado A1 — credencial de cliente nao mora aqui. Guardamos so
          // o ID, que e um numero de sequencia e nao e segredo.
          const { csc_homologacao, csc_producao, ...semSegredo } = state.config ?? {};
          await API.config.salvar(salaoId, semSegredo);

          if (String(csc_homologacao ?? '').trim() || String(csc_producao ?? '').trim()) {
            const r = await fetch('/api/nfce/csc', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getAuthToken()}` },
              body: JSON.stringify({
                csc_id_homologacao: state.config?.csc_id_homologacao,
                csc_homologacao,
                csc_id_producao: state.config?.csc_id_producao,
                csc_producao,
              }),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) { toast(j?.erro || 'Não foi possível enviar o CSC.', 'erro'); return; }
            // Limpa da tela depois de enviado — nao fica em memoria nem em tela.
            dispatch({ type: 'CFG', p: { csc_homologacao: '', csc_producao: '' } });
            toast('CSC enviado ao provedor. Parâmetros salvos.', 'sucesso');
            return;
          }
          toast('Parâmetros fiscais atualizados com sucesso!', 'sucesso');
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* 1. DADOS TRIBUTÁRIOS */}
        <div style={{ ...cardAdmin, padding: 24 }}>
          <h4 style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 800, color: C.textLight, textTransform: 'uppercase' }}>
            1. Identificação e Tributação
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 16, marginBottom: 16 }}>
            <div>
              <label style={S.label}>Ambiente da Sefaz *</label>
              <select style={S.input} value={state.config?.ambiente || '2'} onChange={e => dispatch({ type: 'CFG', p: { ambiente: e.target.value } })}>
                <option value="2">Homologação (Testes sem validade jurídica)</option>
                <option value="1">Produção (Notas com valor fiscal real)</option>
              </select>
            </div>
            <div>
              <label style={S.label}>Regime Tributário (CRT) *</label>
              <select style={S.input} value={state.config?.crt || '1'} onChange={e => dispatch({ type: 'CFG', p: { crt: e.target.value } })}>
                {CRT_OPCOES.map(op => <option key={op.cod} value={op.cod}>{op.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 16, marginBottom: 16 }}>
            <div>
              <label style={S.label}>Nome Fantasia</label>
              <input style={S.inputBloqueado} value={state.dadosMatriz?.nome_fantasia || 'Não preenchido'} disabled />
            </div>
            <div>
              <label style={S.label}>Razão Social</label>
              <input style={S.inputBloqueado} value={state.dadosMatriz?.razao_social || 'Não preenchido'} disabled />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 16 }}>
            <div>
              <label style={S.label}>CNPJ da Empresa</label>
              <input style={S.inputBloqueado} value={state.dadosMatriz?.cnpj || 'Não preenchido'} disabled />
            </div>
            <div>
              <label style={S.label}>Inscrição Estadual (IE)</label>
              <input style={S.inputBloqueado} value={state.dadosMatriz?.inscricao_estadual || 'Não preenchido'} disabled />
            </div>
            <div>
              <label style={S.label}>Série de Emissão Padrão *</label>
              <input style={S.input} value={state.config?.serie || ''} onChange={e => dispatch({ type: 'CFG', p: { serie: e.target.value } })} />
            </div>
          </div>
          <p style={{ margin: '12px 0 0', fontSize: 10, color: C.textLight, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            <FiLock size={12} /> Dados fiscais unificados. Para alterações, acesse &quot;Configurações &gt; Dados da Empresa&quot;.
          </p>
        </div>

        {/* 1b. MODO DE EMISSÃO */}
        <div style={{ ...cardAdmin, padding: 24 }}>
          <h4 style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 800, color: C.textLight, textTransform: 'uppercase' }}>
            Modo de Emissão
          </h4>
          <p style={{ margin: '0 0 16px', fontSize: 11, color: C.textMuted }}>
            Define se a NFC-e é emitida sozinha ao finalizar a venda de produtos no Caixa, ou se fica em rascunho para você aprovar em lote.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
            {(['Automático', 'Lote Manual'] as const).map(val => (
              <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '12px 16px', borderRadius: RAIO_MD, border: `1px solid ${(state.config?.modo_emissao || 'Lote Manual') === val ? C.sidebarBg : C.borderMid}`, background: (state.config?.modo_emissao || 'Lote Manual') === val ? C.bg : 'transparent' }}>
                <input type="radio" name="modo_emissao_nfce" value={val} checked={(state.config?.modo_emissao || 'Lote Manual') === val} onChange={() => dispatch({ type: 'CFG', p: { modo_emissao: val } })} style={{ accentColor: C.sidebarBg }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.textMain }}>{val}</div>
                  <div style={{ fontSize: 11, fontWeight: 400, color: C.textLight }}>
                    {val === 'Automático' ? 'Emite ao finalizar a venda no Caixa' : 'Requer aprovação em Emitir Notas'}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* 2. CREDENCIAIS CSC */}
        <div style={{ background: C.bg, padding: 24, borderRadius: RAIO_XL, border: `1px solid ${C.borderMid}`, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <h4 style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 800, color: C.sidebarBg, textTransform: 'uppercase' }}>
            2. Credenciais NFC-e (Token CSC)
          </h4>
          <p style={{ margin: '0 0 6px', fontSize: 11, color: C.textMuted, lineHeight: 1.6 }}>
            O Código de Segurança do Contribuinte (CSC) é gerado no portal da SEFAZ do seu estado
            e assina o QR Code do DANFE — sem ele a NFC-e não é autorizada. A SEFAZ entrega um par
            por ambiente: cada <strong>ID</strong> vai com o código da <strong>mesma linha</strong>.
          </p>
          <p style={{ margin: '0 0 16px', fontSize: 11, color: C.textLight, lineHeight: 1.6 }}>
            O código é enviado direto ao provedor que emite a nota e <strong>não fica guardado no
            Luarys</strong> — some da tela assim que você salva. Para trocar, basta colar o novo.
          </p>

          {[
            { rot: 'Homologação (teste)', idK: 'csc_id_homologacao', tokK: 'csc_homologacao' },
            { rot: 'Produção',            idK: 'csc_id_producao',    tokK: 'csc_producao'    },
          ].map(a => (
            <div key={a.idK} style={{ marginBottom: 14 }}>
              <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 800, color: C.textMain }}>{a.rot}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 12 }}>
                <div>
                  <label style={S.label}>ID</label>
                  <input style={S.input} placeholder="000001" maxLength={6}
                    value={state.config?.[a.idK] || ''}
                    onChange={e => dispatch({ type: 'CFG', p: { [a.idK]: e.target.value.replace(/\D/g, '').slice(0, 6) } })} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={S.label}>Código</label>
                  <input style={S.input} type="password" autoComplete="off"
                    placeholder="Cole o código da SEFAZ"
                    value={state.config?.[a.tokK] || ''}
                    onChange={e => dispatch({ type: 'CFG', p: { [a.tokK]: e.target.value.trim() } })} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 3. ENDEREÇO ESPELHADO */}
        <div style={{ ...cardAdmin, padding: 24 }}>
          <h4 style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 800, color: C.textLight, textTransform: 'uppercase' }}>
            3. Localização Fiscal
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 16, marginBottom: 16 }}>
            <div>
              <label style={S.label}>CEP</label>
              <input style={S.inputBloqueado} value={state.dadosMatriz?.cep || 'Não preenchido'} disabled />
            </div>
            <div>
              <label style={S.label}>Logradouro</label>
              <input style={S.inputBloqueado} value={state.dadosMatriz?.logradouro || 'Não preenchido'} disabled />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 16, marginBottom: 16 }}>
            <div>
              <label style={S.label}>Número</label>
              <input style={S.inputBloqueado} value={state.dadosMatriz?.numero || 'S/N'} disabled />
            </div>
            <div>
              <label style={S.label}>Complemento</label>
              <input style={S.inputBloqueado} value={state.dadosMatriz?.complemento || 'Não preenchido'} disabled />
            </div>
            <div>
              <label style={S.label}>Bairro</label>
              <input style={S.inputBloqueado} value={state.dadosMatriz?.bairro || 'Não preenchido'} disabled />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 16 }}>
            <div>
              <label style={S.label}>UF</label>
              <input style={S.inputBloqueado} value={state.dadosMatriz?.estado || 'Não preenchido'} disabled />
            </div>
            <div>
              <label style={S.label}>Município / Cidade</label>
              <input style={S.inputBloqueado} value={state.dadosMatriz?.cidade || 'Não preenchido'} disabled />
            </div>
            <div>
              <label style={S.label}>Código IBGE</label>
              <input style={S.inputBloqueado} value={state.dadosMatriz?.codigo_ibge || 'Não preenchido'} disabled />
            </div>
          </div>
          <p style={{ margin: '12px 0 0', fontSize: 10, color: C.textLight, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            <FiLock size={12} /> Endereço unificado. Para alterações, acesse &quot;Configurações &gt; Dados da Empresa&quot;.
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button
            type="submit" disabled={state.loading}
            className="transition-all hover:opacity-90 shadow-sm"
            style={{ padding: '14px 40px', fontSize: 13, background: C.sidebarBg, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: state.loading ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {state.loading ? 'A salvar...' : 'Salvar Configuração Fiscal'}
          </button>
        </div>
      </form>
    </div>
  );
}
