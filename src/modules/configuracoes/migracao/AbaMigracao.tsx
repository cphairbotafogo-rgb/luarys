'use client'
/**
 * src/modules/configuracoes/migracao/AbaMigracao.tsx  (shell, ~190 linhas)
 *
 * Antes: 1 arquivo de 709 linhas. Dividido seguindo a skill eleva-padroes:
 *   tipos.ts        — lerArquivoTexto, parseLinha, parseDuracao, parsePreco, dicionário
 *   componentes.tsx — PreviaPlanilha (prévia visual estilo Excel)
 *   useMigracao.ts  — hook com todo o estado e exportarDados/importarDados/baixarModelo
 *   AbaMigracao.tsx — este arquivo: só JSX, consumindo o hook
 */

import { C } from '@/lib/constants';
import { RAIO_MD, RAIO_2XL } from '@/lib/estiloGlobal';
import { FiDownloadCloud, FiUploadCloud, FiFileText, FiCheckCircle, FiAlertCircle, FiDatabase, FiInfo, FiSearch } from 'react-icons/fi';
import { DICIONARIO_COLUNAS } from './tipos';
import { PreviaPlanilha } from './componentes';
import { useMigracao } from './useMigracao';
import { AbaDuplicados } from '../duplicados/AbaDuplicados';

export function AbaMigracao({ perfil }: any) {
  const {
    abaAtiva, setAbaAtiva,
    entidade, setEntidade,
    carregando,
    arquivo, setArquivo,
    mensagem, setMensagem,
    preview, setPreview,
    exportarDados, analisarArquivo, importarDados, baixarModelo,
  } = useMigracao(perfil);

  // ─── ESTILOS ──────────────────────────────────────────────────────────────
  const tabBtnStyle = (ativa: boolean) => ({
    flex: 1, padding: '16px',
    background: ativa ? '#fff' : 'transparent',
    color: ativa ? C.sidebarBg : C.textLight,
    border: 'none',
    borderBottom: ativa ? `2px solid ${C.sidebarBg}` : `1px solid ${C.borderMid}`,
    fontSize: 14, fontWeight: 800, cursor: 'pointer', transition: '0.2s',
    textTransform: 'uppercase' as const, letterSpacing: '1px',
    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12
  });
  const selectStyle = {
    padding: '12px 16px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`,
    width: '100%', outlineColor: C.sidebarBg, fontSize: 14,
    color: C.textMain, fontWeight: 600, cursor: 'pointer', background: C.bgCard
  };

  return (
    <div style={{ padding: 32, overflowY: 'auto', flex: 1, background: C.bg }}>

      <div style={{ marginBottom: 32 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.sidebarBg, display: 'flex', alignItems: 'center', gap: 12, textTransform: 'uppercase', letterSpacing: '1px' }}>
          <FiDatabase size={24} /> Migração de Dados
        </h2>
        <p style={{ margin: '8px 0 0', fontSize: 14, color: C.textMuted }}>
          Importe planilhas de sistemas antigos (Trinks, Avec) ou exporte o seu banco de dados atual.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        <div style={{ background: C.bgCard, borderRadius: RAIO_2XL, border: `1px solid ${C.border}`, overflow: 'hidden', maxWidth: 800, flex: '1 1 600px' }}>

          {/* ABAS */}
          <div style={{ display: 'flex', background: C.bg }}>
            <button style={tabBtnStyle(abaAtiva === 'exportar')} onClick={() => { setAbaAtiva('exportar'); setMensagem({ tipo: '', texto: '' }); setPreview(null); }}>
              <FiDownloadCloud size={18} /> Exportar (Backup)
            </button>
            <button style={tabBtnStyle(abaAtiva === 'importar')} onClick={() => { setAbaAtiva('importar'); setMensagem({ tipo: '', texto: '' }); setPreview(null); }}>
              <FiUploadCloud size={18} /> Importar (Entrada)
            </button>
            <button style={tabBtnStyle(abaAtiva === 'duplicados')} onClick={() => { setAbaAtiva('duplicados'); setMensagem({ tipo: '', texto: '' }); setPreview(null); }}>
              <FiSearch size={18} /> Duplicados
            </button>
          </div>

          <div style={{ padding: 32 }}>

            {abaAtiva === 'duplicados' ? (
              <AbaDuplicados perfil={perfil} />
            ) : (
              <>

            {/* MENSAGEM DE FEEDBACK */}
            {mensagem.texto && (
              <div style={{ padding: 16, borderRadius: RAIO_MD, marginBottom: 24, background: mensagem.tipo === 'sucesso' ? '#ECFDF5' : '#FEF2F2', border: `1px solid ${mensagem.tipo === 'sucesso' ? C.success : C.danger}`, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                {mensagem.tipo === 'sucesso'
                  ? <FiCheckCircle color={C.success} size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                  : <FiAlertCircle color={C.danger} size={20} style={{ flexShrink: 0, marginTop: 2 }} />}
                <span style={{ fontSize: 13, fontWeight: 600, color: mensagem.tipo === 'sucesso' ? C.success : C.danger, lineHeight: 1.5 }}>
                  {mensagem.texto}
                </span>
              </div>
            )}

            {/* SELETOR DE MÓDULO */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 800, color: C.textLight, textTransform: 'uppercase' }}>
                Selecione o Módulo:
              </label>
              <select style={selectStyle} value={entidade} onChange={e => { setEntidade(e.target.value); setMensagem({ tipo: '', texto: '' }); setArquivo(null); setPreview(null); }}>
                <option value="clientes">Base de Clientes</option>
                <option value="servicos">Catálogo de Serviços</option>
                <option value="produtos">Estoque de Produtos</option>
              </select>
            </div>

            {/* ── EXPORTAR ── */}
            {abaAtiva === 'exportar' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ background: C.bg, padding: 20, borderRadius: RAIO_MD, border: `1px dashed ${C.borderMid}` }}>
                  <p style={{ margin: 0, fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>
                    Fará o download de todos os registros de <strong>{entidade.toUpperCase()}</strong> em formato <strong>.CSV</strong>, pronto para abrir no Excel ou Google Sheets. As colunas técnicas do sistema são omitidas automaticamente.
                  </p>
                </div>
                <button
                  onClick={exportarDados}
                  disabled={carregando}
                  className="hover:opacity-90"
                  style={{ padding: '16px', background: C.sidebarBg, color: '#fff', border: 'none', borderRadius: RAIO_MD, fontSize: 14, fontWeight: 800, cursor: carregando ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, transition: '0.2s' }}
                >
                  {carregando ? 'Gerando planilha...' : <><FiDownloadCloud size={20} /> Gerar e Baixar Planilha</>}
                </button>
              </div>
            )}

            {/* ── IMPORTAR ── */}
            {abaAtiva === 'importar' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                {/* Aviso modelo */}
                <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: 16, borderRadius: RAIO_MD, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <FiAlertCircle color="#D97706" size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                  <p style={{ margin: 0, fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>
                    O arquivo precisa estar em formato <strong>CSV</strong>. Os nomes das colunas devem bater com o Guia abaixo.{' '}
                    <button onClick={baixarModelo} style={{ background: 'none', border: 'none', color: '#D97706', fontWeight: 800, textDecoration: 'underline', cursor: 'pointer', padding: '0 2px' }}>
                      Baixe a planilha modelo aqui
                    </button>
                    .
                  </p>
                </div>

                {/* Aviso: relatório filtrado vs exportação bruta */}
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: 16, borderRadius: RAIO_MD, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <FiAlertCircle color={C.danger} size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                  <p style={{ margin: 0, fontSize: 12, color: C.dangerText, lineHeight: 1.5 }}>
                    <strong>Erro comum:</strong> não use relatórios filtrados do seu sistema antigo (ex: "Clientes que não retornaram", "Profissional filtrado: Todos") — eles têm título no topo e colunas diferentes das esperadas aqui. Use sempre a <strong>exportação completa do cadastro</strong> (a lista crua, com todos os clientes/serviços/produtos), baixando a planilha modelo acima como referência do formato certo.
                  </p>
                </div>

                {/* Guia de colunas */}
                <div style={{ background: C.bg, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, padding: 16 }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 800, color: C.sidebarBg, display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase' }}>
                    <FiInfo size={16} /> Guia de Colunas ({entidade})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: C.danger, textTransform: 'uppercase', marginRight: 8 }}>Obrigatórias:</span>
                      <span style={{ fontSize: 12, color: C.textMain, fontWeight: 600 }}>{DICIONARIO_COLUNAS[entidade].obrigatorias.join(', ')}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: C.textLight, textTransform: 'uppercase', marginRight: 8 }}>Opcionais Aceitas:</span>
                      <span style={{ fontSize: 12, color: C.textMuted }}>{DICIONARIO_COLUNAS[entidade].opcionais.join(', ')}</span>
                    </div>
                    {entidade === 'servicos' && (
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: C.textLight, fontStyle: 'italic' }}>
                        * Aceita exportações diretas do Avec/Trinks — colunas com acentos ("Preço Padrão", "tempo_duracao") são normalizadas automaticamente.
                      </p>
                    )}
                    {entidade === 'clientes' && (
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: C.textLight, fontStyle: 'italic' }}>
                        * Também captura: segundo telefone, Instagram, como conheceu, preferência de SMS/e-mail e <strong>último agendamento</strong> (essencial para o Luarys Cresce já reconhecer clientes em risco logo após a migração).
                      </p>
                    )}
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: C.textLight, fontStyle: 'italic' }}>
                      * Nomes de coluna com acentos ou maiúsculas são aceitos. O sistema normaliza automaticamente.
                    </p>
                  </div>
                </div>

                {/* Input arquivo */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: C.textLight, textTransform: 'uppercase' }}>
                    Anexar Arquivo CSV:
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={e => analisarArquivo(e.target.files![0])}
                    style={{ flex: 1, padding: '10px', border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, fontSize: 13, background: C.bg }}
                  />
                </div>

                {/* Preview do arquivo selecionado */}
                {preview && (
                  <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: RAIO_MD, padding: 14, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <FiFileText color="#16A34A" size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: '#15803D' }}>
                        {preview.total} registros encontrados
                      </p>
                      <p style={{ margin: 0, fontSize: 12, color: '#166534' }}>
                        Colunas detectadas: <strong>{preview.amostra.join(', ')}{preview.amostra.length < 6 ? '' : '...'}</strong>
                      </p>
                    </div>
                  </div>
                )}

                {/* Botão importar */}
                <button
                  onClick={importarDados}
                  disabled={carregando || !arquivo}
                  className="hover:opacity-90"
                  style={{ padding: '16px', background: !arquivo || carregando ? C.borderMid : C.success, color: '#fff', border: 'none', borderRadius: RAIO_MD, fontSize: 14, fontWeight: 800, cursor: !arquivo || carregando ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, transition: '0.2s' }}
                >
                  {carregando ? 'Processando planilha...' : <><FiUploadCloud size={20} /> Importar e Salvar no Banco</>}
                </button>

              </div>
            )}

            </>
            )}

          </div>
        </div>

        {abaAtiva !== 'duplicados' && <PreviaPlanilha entidade={entidade} />}

      </div>
    </div>
  );
}
