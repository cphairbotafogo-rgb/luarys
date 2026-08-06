'use client'
/**
 * Escolha de como a numeração de produção continua ao trocar de emissor.
 *
 * A numeração pertence ao CNPJ, não ao software: a prefeitura controla por
 * prestador + série e não sabe qual sistema enviou. O provedor só conhece o que
 * ele próprio mandou, então o contador de produção nasce em 1 mesmo para um CNPJ
 * com anos de histórico — e emitir do 1 repete documento já autorizado.
 *
 * A tela não decide. Apresenta as duas saídas, explica a consequência de cada
 * uma e grava o que o salão escolher com a contabilidade. Não há opção padrão
 * marcada de propósito: a escolha tem que ser deliberada.
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/constants';
import { RAIO_MD, RAIO_XL } from '@/lib/estiloGlobal';
import { useToast } from '@/components/Toast';
import { FiHash, FiAlertTriangle, FiCheckCircle, FiArrowRight } from 'react-icons/fi';

interface Num { TipoAmbiente: number; ModeloDocumento: number; Serie: string; Numero: number; Padrao: boolean }

export function TabNumeracao({ perfil }: { perfil: any }) {
  const toast = useToast();
  const [carregando, setCarregando] = useState(true);
  const [producao, setProducao]     = useState<Num[]>([]);
  const [erroLeitura, setErroLeitura] = useState('');

  const [modo, setModo]             = useState<'' | 'continuar' | 'nova_serie'>('');
  const [ultimoNumero, setUltimo]   = useState('');
  const [serie, setSerie]           = useState('');
  const [salvando, setSalvando]     = useState(false);

  useEffect(() => { carregar(); }, [perfil?.salao_id]);

  async function carregar() {
    setCarregando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch('/api/nfse/numeracao', { headers: { Authorization: `Bearer ${session?.access_token}` } });
      const j = await r.json();
      if (!r.ok) { setErroLeitura(j.erro || 'Não foi possível consultar a numeração.'); return; }
      setProducao(j.producao || []);
      setErroLeitura('');
    } catch (e: any) {
      setErroLeitura('Erro de conexão: ' + e.message);
    } finally { setCarregando(false); }
  }

  async function gravar() {
    const resumo = modo === 'continuar'
      ? `continuar na série ${serie || '1'}, próxima nota nº ${Number(ultimoNumero) + 1}`
      : `abrir a série ${serie}, começando na nota nº 1`;
    if (!window.confirm(`Confirma ${resumo}?\n\nEsta escolha vale para as notas de produção. Número repetido é recusado pela prefeitura por duplicidade.`)) return;

    setSalvando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch('/api/nfse/numeracao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ modo, ultimo_numero: Number(ultimoNumero), serie: serie || undefined, confirmo: true }),
      });
      const j = await r.json();
      if (!r.ok) { toast.erro(j.erro || 'Não foi possível gravar.', 10000); return; }
      toast.sucesso(`Pronto. Série ${j.serie}, próxima nota nº ${j.proximo_numero}.`);
      setModo('');
      setUltimo('');
      setSerie('');
      await carregar();
    } catch (e: any) {
      toast.erro('Erro de conexão: ' + e.message);
    } finally { setSalvando(false); }
  }

  const podeGravar = modo === 'continuar'
    ? ultimoNumero.trim() !== '' && Number(ultimoNumero) >= 0
    : modo === 'nova_serie' ? serie.trim() !== '' && serie.trim() !== '1' : false;

  const cartao = (
    id: 'continuar' | 'nova_serie',
    titulo: string,
    resumo: string,
    detalhe: string,
  ) => (
    <button
      type="button"
      onClick={() => setModo(modo === id ? '' : id)}
      style={{
        textAlign: 'left', padding: '14px 16px', borderRadius: RAIO_XL, cursor: 'pointer',
        background: modo === id ? '#F0FDF4' : C.bgCard,
        border: `1px solid ${modo === id ? '#86EFAC' : C.border}`,
        display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 260,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 800, fontSize: 13, color: modo === id ? '#15803D' : C.textMain }}>
        {modo === id && <FiCheckCircle size={14} />} {titulo}
      </span>
      <span style={{ fontSize: 12, color: C.textMuted }}>{resumo}</span>
      <span style={{ fontSize: 11, color: C.textLight, lineHeight: 1.5 }}>{detalhe}</span>
    </button>
  );

  if (carregando) return <p style={{ color: C.textLight, fontSize: 13 }}>Carregando...</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '12px 14px', borderRadius: RAIO_XL, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
        <FiAlertTriangle size={15} color="#B45309" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: '#92400E' }}>Converse com a sua contabilidade antes de escolher</p>
          <p style={{ margin: '4px 0 0', fontSize: 11.5, color: '#92400E', lineHeight: 1.55 }}>
            A numeração das notas é do seu CNPJ, não do sistema. A prefeitura controla por
            prestador e série — ela não sabe qual programa enviou. Se o seu CNPJ já emitiu
            notas por outro emissor, começar do número 1 repete documento já autorizado, e a
            prefeitura recusa por duplicidade.
          </p>
        </div>
      </div>

      {erroLeitura ? (
        <p style={{ margin: 0, fontSize: 12, color: C.danger }}>{erroLeitura}</p>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.textMuted }}>
          <FiHash size={13} />
          {producao.length === 0
            ? 'Nenhuma numeração de produção registrada ainda.'
            : producao.map(n => (
                <span key={n.Serie} style={{ padding: '3px 9px', borderRadius: 20, background: C.bg, border: `1px solid ${C.border}`, fontVariantNumeric: 'tabular-nums' }}>
                  série {n.Serie} · próxima nota nº <strong>{n.Numero}</strong>
                </span>
              ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {cartao('continuar', 'Continuar a numeração atual',
          'Mantém a mesma série e segue do último número emitido.',
          'Exige saber com certeza qual foi a última nota autorizada. Um número menor que o já usado é recusado.')}
        {cartao('nova_serie', 'Começar uma série nova',
          'Abre outra série, começando do número 1.',
          'Não colide com nada, porque a contagem é por série. É o caminho usual ao trocar de sistema.')}
      </div>

      {modo === 'continuar' && (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', padding: '14px 16px', borderRadius: RAIO_XL, background: C.bg, border: `1px solid ${C.border}` }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11.5, fontWeight: 700, color: C.textMain }}>
            Número da última nota já autorizada
            <input type="number" min={0} value={ultimoNumero} onChange={e => setUltimo(e.target.value)}
              placeholder="ex: 2386"
              style={{ width: 150, padding: '7px 10px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 13, fontVariantNumeric: 'tabular-nums' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11.5, fontWeight: 700, color: C.textMain }}>
            Série
            <input value={serie} onChange={e => setSerie(e.target.value)} placeholder="1"
              style={{ width: 90, padding: '7px 10px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 13 }} />
          </label>
          {ultimoNumero.trim() !== '' && Number(ultimoNumero) >= 0 && (
            <span style={{ fontSize: 12, color: C.textMuted, paddingBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FiArrowRight size={12} /> a próxima nota sairá com o nº <strong>{Number(ultimoNumero) + 1}</strong>
            </span>
          )}
        </div>
      )}

      {modo === 'nova_serie' && (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', padding: '14px 16px', borderRadius: RAIO_XL, background: C.bg, border: `1px solid ${C.border}` }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11.5, fontWeight: 700, color: C.textMain }}>
            Identificação da nova série
            <input value={serie} onChange={e => setSerie(e.target.value)} placeholder="ex: 2"
              style={{ width: 120, padding: '7px 10px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 13 }} />
          </label>
          <span style={{ fontSize: 12, color: C.textMuted, paddingBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <FiArrowRight size={12} /> a primeira nota desta série sairá com o nº <strong>1</strong>
          </span>
        </div>
      )}

      {modo && (
        <div>
          <button type="button" onClick={gravar} disabled={!podeGravar || salvando}
            style={{
              padding: '10px 20px', borderRadius: RAIO_MD, border: 'none', fontWeight: 800, fontSize: 13,
              background: podeGravar && !salvando ? C.sidebarBg : C.borderMid, color: '#fff',
              cursor: podeGravar && !salvando ? 'pointer' : 'not-allowed',
            }}>
            {salvando ? 'Gravando...' : 'Confirmar escolha'}
          </button>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: C.textLight }}>
            Vale para as notas de produção. A numeração de homologação é de teste e não tem efeito.
          </p>
        </div>
      )}
    </div>
  );
}
