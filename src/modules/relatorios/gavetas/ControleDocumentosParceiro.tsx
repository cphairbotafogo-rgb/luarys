'use client'
/**
 * Controle mensal dos documentos do profissional-parceiro.
 *
 * O salão exclui a cota-parte da receita bruta (dedução no PGDAS-D e gDed na
 * NFS-e). O que sustenta essa exclusão é a nota fiscal que o parceiro emite ao
 * salão — antes disso, a exclusão está sem lastro. O DAS comprova a
 * regularidade fiscal que o próprio contrato de parceria exige
 * (art. 1º-A, § 10, VII).
 *
 * Até agora o sistema só ORIENTAVA por texto que essa nota deveria existir.
 * Aqui ela vira registro: quem conferiu, quando, e qual documento.
 *
 * Desde 2026 o cruzamento NFS-e Nacional x PGDAS é imediato — exclusão sem
 * documento é o que descaracteriza a parceria numa fiscalização.
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C, brl } from '@/lib/constants';
import { RAIO_MD } from '@/lib/estiloGlobal';
import { useToast } from '@/components/Toast';
import { FiFileText, FiCheckCircle, FiAlertTriangle, FiLoader } from 'react-icons/fi';

interface Props {
  salaoId: string;
  profissionalId: string | null;
  profissionalNome: string;
  /** Cota-parte apurada no mês — referência para conferir o valor da nota. */
  totalCota: number;
  mes: number;
  ano: number;
}

interface Registro {
  id?: string;
  nota_recebida: boolean;
  nota_numero: string;
  nota_valor: string;
  das_comprovado: boolean;
}

const VAZIO: Registro = { nota_recebida: false, nota_numero: '', nota_valor: '', das_comprovado: false };

export function ControleDocumentosParceiro({ salaoId, profissionalId, profissionalNome, totalCota, mes, ano }: Props) {
  const toast = useToast();
  const [reg, setReg] = useState<Registro>(VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Competência sempre no dia 1 — é o que o UNIQUE e o CHECK da tabela esperam.
  const competencia = `${ano}-${String(mes).padStart(2, '0')}-01`;

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      if (!profissionalId) { setCarregando(false); return; }
      setCarregando(true);
      const { data } = await supabase
        .from('parceiro_documentos_mensais')
        .select('id, nota_recebida, nota_numero, nota_valor, das_comprovado')
        .eq('salao_id', salaoId)
        .eq('profissional_id', profissionalId)
        .eq('competencia', competencia)
        .maybeSingle();
      if (!ativo) return;
      setReg(data
        ? {
            id: data.id,
            nota_recebida: !!data.nota_recebida,
            nota_numero: data.nota_numero ?? '',
            nota_valor: data.nota_valor != null ? String(data.nota_valor) : '',
            das_comprovado: !!data.das_comprovado,
          }
        : VAZIO);
      setCarregando(false);
    }
    carregar();
    return () => { ativo = false; };
  }, [salaoId, profissionalId, competencia]);

  async function salvar(parcial: Partial<Registro>) {
    if (!profissionalId) {
      toast.aviso('Profissional não encontrado no cadastro — não é possível registrar o documento.');
      return;
    }
    const novo = { ...reg, ...parcial };
    setReg(novo);
    setSalvando(true);

    const valorNota = novo.nota_valor.trim() === '' ? null : Number(String(novo.nota_valor).replace(',', '.'));

    // upsert pela chave natural (salao + profissional + competencia): se duas
    // pessoas conferirem o mesmo repasse, a segunda atualiza em vez de duplicar.
    const { data, error } = await supabase
      .from('parceiro_documentos_mensais')
      .upsert({
        salao_id: salaoId,
        profissional_id: profissionalId,
        competencia,
        nota_recebida: novo.nota_recebida,
        nota_numero: novo.nota_numero.trim() || null,
        nota_valor: Number.isFinite(valorNota as number) ? valorNota : null,
        das_comprovado: novo.das_comprovado,
      }, { onConflict: 'salao_id,profissional_id,competencia' })
      .select('id')
      .single();

    setSalvando(false);
    if (error) { toast.erro('Erro ao registrar: ' + error.message); return; }
    if (data?.id && !novo.id) setReg(r => ({ ...r, id: data.id }));
  }

  if (carregando) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.textMuted, padding: '10px 14px' }}>
        <FiLoader size={13} /> Carregando documentos...
      </div>
    );
  }

  if (!profissionalId) {
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#FEF3C7',
        border: '1px solid #F59E0B', borderRadius: RAIO_MD, padding: '10px 14px' }}>
        <FiAlertTriangle size={14} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 12, color: '#92400E', lineHeight: 1.6 }}>
          Não encontrei <strong>{profissionalNome}</strong> no cadastro da equipe, então não dá para registrar
          os documentos deste mês. As notas antigas guardam o nome como texto — se o profissional foi renomeado
          ou removido, o vínculo se perde.
        </div>
      </div>
    );
  }

  // Divergência entre a nota informada e a cota apurada: é exatamente o tipo de
  // diferença que o cruzamento com o PGDAS aponta.
  const valorInformado = Number(String(reg.nota_valor).replace(',', '.'));
  const divergente = reg.nota_recebida && Number.isFinite(valorInformado) && reg.nota_valor.trim() !== ''
    && Math.abs(valorInformado - totalCota) > 0.01;

  const completo = reg.nota_recebida && reg.das_comprovado;

  return (
    <div style={{
      background: completo ? '#F0FDF4' : '#FFFBEB',
      border: `1px solid ${completo ? '#BBF7D0' : '#FDE68A'}`,
      borderRadius: RAIO_MD, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {completo
          ? <FiCheckCircle size={14} color="#16A34A" />
          : <FiFileText size={14} color="#D97706" />}
        <span style={{ fontSize: 12, fontWeight: 700, color: completo ? '#166534' : '#92400E' }}>
          Documentos de {String(mes).padStart(2, '0')}/{ano}
          {completo ? ' — completos' : ' — pendentes'}
        </span>
        {salvando && <FiLoader size={12} color={C.textMuted} />}
      </div>

      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: C.textMain, cursor: 'pointer' }}>
        <input type="checkbox" checked={reg.nota_recebida} style={{ accentColor: '#16A34A' }}
          onChange={e => salvar({ nota_recebida: e.target.checked })} />
        <span>Recebi a nota fiscal do parceiro pela cota-parte ({brl(totalCota)})</span>
      </label>

      {reg.nota_recebida && (
        <div style={{ display: 'flex', gap: 10, paddingLeft: 24, flexWrap: 'wrap' }}>
          <input placeholder="Nº da nota" value={reg.nota_numero}
            onChange={e => setReg(r => ({ ...r, nota_numero: e.target.value }))}
            onBlur={() => salvar({})}
            style={{ padding: '6px 10px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 12, width: 130 }} />
          <input placeholder="Valor da nota" value={reg.nota_valor}
            onChange={e => setReg(r => ({ ...r, nota_valor: e.target.value }))}
            onBlur={() => salvar({})}
            style={{ padding: '6px 10px', borderRadius: RAIO_MD, border: `1px solid ${divergente ? '#EF4444' : C.borderMid}`, fontSize: 12, width: 130 }} />
        </div>
      )}

      {divergente && (
        <div style={{ fontSize: 11, color: '#B91C1C', paddingLeft: 24, lineHeight: 1.6 }}>
          A nota informada ({brl(valorInformado)}) diverge da cota apurada ({brl(totalCota)}).
          É esse tipo de diferença que o cruzamento com o PGDAS aponta — confira antes de fechar a competência.
        </div>
      )}

      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: C.textMain, cursor: 'pointer' }}>
        <input type="checkbox" checked={reg.das_comprovado} style={{ accentColor: '#16A34A' }}
          onChange={e => salvar({ das_comprovado: e.target.checked })} />
        <span>Recebi o comprovante do DAS do parceiro</span>
      </label>

      {!completo && (
        <div style={{ fontSize: 11, color: '#92400E', lineHeight: 1.6 }}>
          Enquanto faltar a nota, a exclusão da cota-parte da receita bruta fica sem lastro documental.
        </div>
      )}
    </div>
  );
}
