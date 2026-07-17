'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/constants';
import { FiMapPin, FiSearch, FiArrowRight } from 'react-icons/fi';
import { FONTE_CORPO, FONTE_TITULO, fileteDourado } from './estiloPortal';
import { AnimacaoLogo } from '@/app/AnimacaoLogo';
import { RAIO_LG, RAIO_XL } from '@/lib/estiloGlobal';

const D = C.douradoEleva;

export function TelaSelecaoSalao({ onSalaoSelecionado, onIrParaCadastro }: {
  onSalaoSelecionado: (s: any) => void;
  onIrParaCadastro: () => void;
}) {
  const [busca, setBusca] = useState('');
  const [saloes, setSaloes] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [jaBuscou, setJaBuscou] = useState(false);

  useEffect(() => {
    setCarregando(true);
    supabase
      .from('saloes')
      .select('id, nome_fantasia, slug, bairro, cidade, estado, telefone, cobrar_sinal, porcentagem_sinal')
      .order('nome_fantasia', { ascending: true })
      .limit(20)
      .then(({ data, error }) => {
        if (error) setErro('Erro ao carregar salões. Tente novamente.');
        setSaloes(data || []);
        setCarregando(false);
      });
  }, []);

  async function pesquisar(e: React.FormEvent) {
    e.preventDefault();
    setJaBuscou(true);
    setCarregando(true);
    setErro('');
    const q = supabase
      .from('saloes')
      .select('id, nome_fantasia, slug, bairro, cidade, estado, telefone, cobrar_sinal, porcentagem_sinal')
      .order('nome_fantasia', { ascending: true })
      .limit(20);
    const { data, error } = busca.trim()
      ? await q.or(`slug.ilike.%${busca.trim()}%,nome_fantasia.ilike.%${busca.trim()}%`)
      : await q;
    if (error) setErro('Erro ao buscar. Tente novamente.');
    setSaloes(data || []);
    setCarregando(false);
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #FAFAF9 0%, #F2EEE4 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '20px 20px 60px',
      fontFamily: FONTE_CORPO, position: 'relative',
    }}>

      {/* Brilho dourado difuso atrás do logo */}
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 320, pointerEvents: 'none',
        background: `radial-gradient(ellipse at center top, ${D}18 0%, transparent 65%)`,
      }} />

      {/* Logo animada */}
      <div style={{ textAlign: 'center', marginBottom: 36, position: 'relative', animation: 'fadeUpPortal 0.5s ease-out both' }}>
        <AnimacaoLogo compacto />
        <div style={{ ...fileteDourado, marginTop: 14 }} />
      </div>

      {/* Card central */}
      <div style={{
        width: '100%', maxWidth: 480, background: '#FFFFFF',
        borderRadius: RAIO_XL,
        boxShadow: '0 4px 40px -8px rgba(44,54,67,0.13), 0 1px 4px rgba(44,54,67,0.06)',
        padding: '40px 32px',
        animation: 'fadeUpPortal 0.5s 0.08s ease-out both',
      }}>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: D }}>
            A sua experiência premium
          </p>
          <h1 style={{ fontFamily: FONTE_TITULO, margin: '0 0 8px', fontSize: 26, fontWeight: 900, color: C.sidebarBg, letterSpacing: '-0.5px' }}>
            Portal do Cliente
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: C.textLight }}>Escolha o seu salão para entrar</p>
        </div>

        {/* Busca */}
        <form onSubmit={pesquisar} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <FiSearch size={16} color={C.textLight} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Buscar salão pelo nome..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{
                width: '100%', padding: '13px 14px 13px 40px',
                borderRadius: RAIO_LG, border: `1.5px solid ${C.borderMid}`,
                fontSize: 14, outlineColor: D, color: C.textMain,
                backgroundColor: '#FAFAF9', boxSizing: 'border-box' as const,
                fontFamily: FONTE_CORPO,
              }}
            />
          </div>
          <button type="submit" disabled={carregando} style={{
            padding: '13px 20px', background: D, color: '#1A1008',
            border: 'none', borderRadius: RAIO_LG, fontWeight: 800, fontSize: 14,
            cursor: carregando ? 'not-allowed' : 'pointer', fontFamily: FONTE_TITULO,
            whiteSpace: 'nowrap' as const, opacity: carregando ? 0.7 : 1,
          }}>
            {carregando ? '...' : 'Buscar'}
          </button>
        </form>

        {erro && <p style={{ margin: '-4px 0 12px', color: C.danger, fontSize: 12, fontWeight: 600 }}>{erro}</p>}

        {/* Lista */}
        {carregando && saloes.length === 0 && (
          <p style={{ textAlign: 'center', fontSize: 13, color: C.textLight, padding: '20px 0', margin: 0 }}>Carregando...</p>
        )}

        {saloes.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {saloes.map((s, idx) => (
              <SalaoCard key={s.id} salao={s} idx={idx} onClick={() => onSalaoSelecionado(s)} />
            ))}
          </div>
        )}

        {saloes.length === 0 && jaBuscou && !carregando && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: C.textMain }}>Salão não encontrado</p>
            <p style={{ margin: 0, fontSize: 13, color: C.textMuted }}>Verifique o nome ou peça o link direto ao salão.</p>
          </div>
        )}

        {/* Rodapé cadastro */}
        <div style={{ marginTop: 24, borderTop: `1px solid ${C.border}`, paddingTop: 20, textAlign: 'center' }}>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: C.textMuted }}>Sou cliente nova?</p>
          <CadastroBtn onClick={onIrParaCadastro} />
        </div>
      </div>

      <p style={{ marginTop: 28, fontSize: 12, color: C.textLight, letterSpacing: '0.3px', animation: 'fadeUpPortal 0.5s 0.2s ease-out both' }}>
        Desenvolvido por <span style={{ color: D, fontWeight: 700 }}>Luarys</span>
      </p>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeUpPortal {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}

function SalaoCard({ salao: s, idx, onClick }: { salao: any; idx: number; onClick: () => void }) {
  const D = C.douradoEleva;
  const [hover, setHover] = useState(false);
  const inicial = s.nome_fantasia?.charAt(0).toUpperCase() || '?';

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%', padding: '14px 16px', background: '#FFFFFF',
        border: `1.5px solid ${hover ? D : C.border}`,
        borderLeft: `${hover ? 3 : 1.5}px solid ${hover ? D : C.border}`,
        borderRadius: RAIO_LG, cursor: 'pointer', textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: 14,
        transform: hover ? 'translateY(-2px)' : 'none',
        boxShadow: hover ? '0 8px 24px -6px rgba(44,54,67,0.14)' : 'none',
        transition: 'all 0.18s ease',
        animation: `fadeUpPortal 0.4s ${0.04 * idx}s ease-out both`,
      }}
    >
      {/* Avatar dourado */}
      <div style={{
        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
        background: `linear-gradient(135deg, ${D}20 0%, ${D}40 100%)`,
        border: `1.5px solid ${D}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'system-ui', fontSize: 17, fontWeight: 900, color: D,
      }}>
        {inicial}
      </div>

      {/* Nome e cidade */}
      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: C.textMain, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {s.nome_fantasia}
        </p>
        {s.cidade && (
          <p style={{ margin: '3px 0 0', fontSize: 12, color: C.textLight, display: 'flex', alignItems: 'center', gap: 4 }}>
            <FiMapPin size={11} /> {s.bairro ? `${s.bairro} · ` : ''}{s.cidade}
          </p>
        )}
      </div>

      <FiArrowRight size={16} color={hover ? D : C.textLight} style={{ flexShrink: 0, transition: 'color 0.18s' }} />
    </button>
  );
}

function CadastroBtn({ onClick }: { onClick: () => void }) {
  const D = C.douradoEleva;
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%', padding: '12px 20px', background: hover ? `${D}12` : 'transparent',
        border: `1.5px solid ${D}`, borderRadius: RAIO_LG,
        color: D, fontWeight: 800, fontSize: 14,
        cursor: 'pointer', fontFamily: FONTE_TITULO, transition: 'all 0.18s',
      }}
    >
      Criar minha conta
    </button>
  );
}
