'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C, brl } from '@/lib/constants';
import { useToast } from '@/components/Toast';
import { FiSave, FiPrinter, FiFileText, FiX, FiCopy } from 'react-icons/fi';
import { FONTE_TITULO } from '@/lib/estiloGlobal';

const VARIAVEIS = [
  { var: '{{NOME_LOCATARIO}}',   desc: 'Nome completo do profissional' },
  { var: '{{CPF_LOCATARIO}}',    desc: 'CPF do profissional' },
  { var: '{{TELEFONE_LOCATARIO}}', desc: 'Telefone do profissional' },
  { var: '{{EMAIL_LOCATARIO}}',  desc: 'E-mail do profissional' },
  { var: '{{ESPECIALIDADE}}',    desc: 'Especialidade do profissional' },
  { var: '{{NUMERO_ESTACAO}}',   desc: 'Número / identificação da estação' },
  { var: '{{VALOR_MENSAL}}',     desc: 'Valor mensal do aluguel (ex: R$ 800,00)' },
  { var: '{{DIA_VENCIMENTO}}',   desc: 'Dia do mês para pagamento' },
  { var: '{{DATA_INICIO}}',      desc: 'Data de início do contrato' },
  { var: '{{NOME_SALAO}}',       desc: 'Nome fantasia do estabelecimento' },
  { var: '{{CNPJ_SALAO}}',       desc: 'CNPJ do estabelecimento' },
  { var: '{{ENDERECO_SALAO}}',   desc: 'Endereço completo do estabelecimento' },
  { var: '{{TELEFONE_SALAO}}',   desc: 'Telefone do estabelecimento' },
  { var: '{{CIDADE_SALAO}}',     desc: 'Cidade do estabelecimento' },
  { var: '{{DATA_HOJE}}',        desc: 'Data de hoje (para assinatura)' },
];

const inp = { width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.borderMid}`, fontSize: 13, color: C.textMain, background: '#fff', boxSizing: 'border-box' as const };
const lbl = { fontFamily: FONTE_TITULO, fontSize: 10, fontWeight: 700, color: C.textMuted, display: 'block' as const, marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: '0.5px' };

function formatarData(iso: string) {
  if (!iso) return '';
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
}

export function ModeloContrato({ perfil }: { perfil: any }) {
  const toast = useToast();
  const [conteudo, setConteudo] = useState('');
  const [nome, setNome] = useState('Contrato Padrão');
  const [salvando, setSalvando] = useState(false);
  const [locatarios, setLocatarios] = useState<any[]>([]);
  const [contratos, setContratos] = useState<any[]>([]);
  const [salaoData, setSalaoData] = useState<any>(null);
  const [locatarioPreview, setLocatarioPreview] = useState('');
  const [modalPreview, setModalPreview] = useState(false);
  const [textoGerado, setTextoGerado] = useState('');

  useEffect(() => { carregar(); }, [perfil?.salao_id]);

  async function carregar() {
    if (!perfil?.salao_id) return;
    const [{ data: modelo }, { data: locs }, { data: conts }, { data: salao }] = await Promise.all([
      supabase.from('modelos_contrato_aluguel').select('*').eq('salao_id', perfil.salao_id).maybeSingle(),
      supabase.from('locatarios').select('*').eq('salao_id', perfil.salao_id).eq('ativo', true).order('nome'),
      supabase.from('contratos_aluguel').select('*').eq('salao_id', perfil.salao_id).eq('ativo', true),
      supabase.from('saloes').select('nome_fantasia, cnpj, endereco, bairro, cidade, estado, telefone').eq('id', perfil.salao_id).maybeSingle(),
    ]);
    if (modelo) { setConteudo(modelo.conteudo); setNome(modelo.nome); }
    setLocatarios(locs || []);
    setContratos(conts || []);
    setSalaoData(salao);
  }

  async function salvar() {
    if (!perfil?.salao_id) return;
    setSalvando(true);
    const { error } = await supabase.from('modelos_contrato_aluguel').upsert(
      { salao_id: perfil.salao_id, nome, conteudo, atualizado_em: new Date().toISOString() },
      { onConflict: 'salao_id' }
    );
    if (error) toast.erro('Erro ao salvar: ' + error.message);
    else toast.sucesso('Modelo salvo!');
    setSalvando(false);
  }

  function gerarContrato() {
    if (!locatarioPreview) { toast.erro('Selecione um profissional.'); return; }
    const loc = locatarios.find(l => l.id === locatarioPreview);
    const cont = contratos.find(c => c.locatario_id === locatarioPreview);
    if (!loc) return;

    const enderecoSalao = [salaoData?.endereco, salaoData?.bairro, salaoData?.cidade, salaoData?.estado].filter(Boolean).join(', ');

    let texto = conteudo;
    const subs: Record<string, string> = {
      '{{NOME_LOCATARIO}}':   loc.nome || '',
      '{{CPF_LOCATARIO}}':    loc.cpf || '',
      '{{TELEFONE_LOCATARIO}}': loc.telefone || '',
      '{{EMAIL_LOCATARIO}}':  loc.email || '',
      '{{ESPECIALIDADE}}':    loc.especialidade || '',
      '{{NUMERO_ESTACAO}}':   cont?.numero_estacao || '',
      '{{VALOR_MENSAL}}':     cont ? brl(Number(cont.valor_mensal)) : '',
      '{{DIA_VENCIMENTO}}':   cont ? String(cont.dia_vencimento) : '',
      '{{DATA_INICIO}}':      cont ? formatarData(cont.data_inicio) : '',
      '{{NOME_SALAO}}':       salaoData?.nome_fantasia || '',
      '{{CNPJ_SALAO}}':       salaoData?.cnpj || '',
      '{{ENDERECO_SALAO}}':   enderecoSalao,
      '{{TELEFONE_SALAO}}':   salaoData?.telefone || '',
      '{{CIDADE_SALAO}}':     salaoData?.cidade || '',
      '{{DATA_HOJE}}':        new Date().toLocaleDateString('pt-BR'),
    };
    Object.entries(subs).forEach(([key, val]) => { texto = texto.replaceAll(key, val); });
    setTextoGerado(texto);
    setModalPreview(true);
  }

  function imprimir() {
    const janela = window.open('', '_blank');
    if (!janela) return;
    janela.document.write(`
      <!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>${nome}</title>
      <style>
        body { font-family: 'Times New Roman', serif; font-size: 14px; line-height: 1.8; color: #000; max-width: 800px; margin: 40px auto; padding: 0 40px; }
        @media print { body { margin: 20mm; padding: 0; } }
      </style>
      </head><body>
      <pre style="white-space: pre-wrap; font-family: inherit; font-size: 14px;">${textoGerado}</pre>
      <script>window.onload = function() { window.print(); }</script>
      </body></html>
    `);
    janela.document.close();
  }

  function copiarVariavel(v: string) {
    navigator.clipboard.writeText(v).then(() => toast.sucesso(`${v} copiado!`));
  }

  return (
    <div style={{ display: 'flex', gap: 20 }}>

      {/* Editor */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontFamily: FONTE_TITULO, fontSize: 13, fontWeight: 800, color: C.textMain, margin: 0 }}>Modelo de Contrato</h3>
            <button onClick={salvar} disabled={salvando} style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.sidebarBg, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONTE_TITULO }}>
              <FiSave size={13} /> {salvando ? 'Salvando...' : 'Salvar Modelo'}
            </button>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Nome do Modelo</label>
            <input style={inp} value={nome} onChange={e => setNome(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Texto do Contrato</label>
            <p style={{ fontSize: 11, color: C.textLight, margin: '0 0 8px' }}>Cole aqui o contrato fornecido pelo seu advogado. Substitua os dados variáveis pelas chaves da lista ao lado (ex: <code style={{ background: C.bg, padding: '1px 4px', borderRadius: 4 }}>{'{{NOME_LOCATARIO}}'}</code>).</p>
            <textarea
              style={{ ...inp, minHeight: 420, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }}
              value={conteudo}
              onChange={e => setConteudo(e.target.value)}
              placeholder={`CONTRATO DE LOCAÇÃO DE ESTAÇÃO\n\nPelo presente instrumento particular, de um lado {{NOME_SALAO}}, CNPJ {{CNPJ_SALAO}}, com sede em {{ENDERECO_SALAO}}, doravante denominado LOCADOR;\n\nE de outro lado {{NOME_LOCATARIO}}, CPF {{CPF_LOCATARIO}}, telefone {{TELEFONE_LOCATARIO}}, doravante denominado LOCATÁRIO;\n\nTêm entre si justo e contratado o seguinte:\n\n1. O LOCADOR cede ao LOCATÁRIO o uso da estação nº {{NUMERO_ESTACAO}} pelo valor mensal de {{VALOR_MENSAL}}, com vencimento no dia {{DIA_VENCIMENTO}} de cada mês, a partir de {{DATA_INICIO}}.\n\n...\n\n{{CIDADE_SALAO}}, {{DATA_HOJE}}.`}
            />
          </div>
        </div>

        {/* Gerador */}
        <div style={{ background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, padding: 20 }}>
          <h3 style={{ fontFamily: FONTE_TITULO, fontSize: 13, fontWeight: 800, color: C.textMain, margin: '0 0 14px' }}>Gerar Contrato para um Profissional</h3>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Selecione o Profissional</label>
              <select style={inp} value={locatarioPreview} onChange={e => setLocatarioPreview(e.target.value)}>
                <option value="">Selecionar...</option>
                {locatarios.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button onClick={gerarContrato} style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.douradoLuarys, color: '#000', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONTE_TITULO }}>
                <FiFileText size={14} /> Gerar e Visualizar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar de variáveis */}
      <div style={{ width: 260, flexShrink: 0 }}>
        <div style={{ background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16, position: 'sticky', top: 0 }}>
          <p style={{ fontFamily: FONTE_TITULO, fontSize: 11, fontWeight: 700, color: C.textMain, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px' }}>Variáveis Disponíveis</p>
          <p style={{ fontSize: 11, color: C.textLight, margin: '0 0 12px' }}>Clique para copiar e cole no contrato.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {VARIAVEIS.map(v => (
              <button key={v.var} onClick={() => copiarVariavel(v.var)} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', cursor: 'pointer', textAlign: 'left' }}>
                <FiCopy size={12} style={{ color: C.textLight, marginTop: 2, flexShrink: 0 }} />
                <div>
                  <p style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, color: C.sidebarBg, margin: '0 0 1px' }}>{v.var}</p>
                  <p style={{ fontSize: 10, color: C.textLight, margin: 0 }}>{v.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Modal de preview */}
      {modalPreview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 720, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: `1px solid ${C.border}` }}>
              <h3 style={{ fontFamily: FONTE_TITULO, fontSize: 15, fontWeight: 800, color: C.textMain, margin: 0 }}>Visualizar Contrato</h3>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={imprimir} style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.sidebarBg, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONTE_TITULO }}>
                  <FiPrinter size={14} /> Imprimir / PDF
                </button>
                <button onClick={() => setModalPreview(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLight }}><FiX size={20} /></button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
              <pre style={{ fontFamily: '"Times New Roman", serif', fontSize: 13, lineHeight: 1.8, color: '#000', whiteSpace: 'pre-wrap', margin: 0 }}>{textoGerado}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
