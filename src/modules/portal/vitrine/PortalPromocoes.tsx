'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C, brl } from "@/lib/constants";
import { FiTag } from "react-icons/fi";
import { FONTE_TITULO, FONTE_CORPO, RAIO_MD } from "@/lib/estiloGlobal";
import { cardConteudo, eyebrow } from "../estiloPortal";

interface Props {
  salaoId: string;
  telefone?: string;
}

interface Promocao {
  id: string;
  titulo: string;
  descricao: string | null;
  imagem_url: string | null;
  preco_original: number | null;
  preco_promo: number | null;
  validade_ate: string | null;
}

export function PortalPromocoes({ salaoId, telefone }: Props) {
  const [promocoes, setPromocoes] = useState<Promocao[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!salaoId) return;
    const hoje = new Date().toISOString().split('T')[0];
    supabase
      .from('vitrine_promocoes')
      .select('id, titulo, descricao, imagem_url, preco_original, preco_promo, validade_ate')
      .eq('salao_id', salaoId)
      .eq('ativo', true)
      .or(`validade_ate.is.null,validade_ate.gte.${hoje}`)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setPromocoes(data || []);
        setCarregando(false);
      });
  }, [salaoId]);

  if (carregando || promocoes.length === 0) return null;

  const wppNumero = (telefone || '').replace(/\D/g, '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <FiTag size={14} color={C.sidebarBg} />
        <p style={{ ...eyebrow, margin: 0, color: C.sidebarBg }}>Promoções</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {promocoes.map(p => (
          <div key={p.id} style={{ ...cardConteudo, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {p.imagem_url && (
              <div style={{ height: 140, overflow: 'hidden', background: C.bg }}>
                <img
                  src={p.imagem_url}
                  alt={p.titulo}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                />
              </div>
            )}
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <h4 style={{ fontFamily: FONTE_TITULO, margin: 0, fontSize: 14, fontWeight: 800, color: C.sidebarBg }}>{p.titulo}</h4>
              {p.descricao && (
                <p style={{ margin: 0, fontSize: 13, color: C.textMuted, lineHeight: 1.5, fontFamily: FONTE_CORPO }}>{p.descricao}</p>
              )}
              {(p.preco_original != null || p.preco_promo != null) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                  {p.preco_original != null && (
                    <span style={{ fontSize: 12, color: C.textLight, textDecoration: 'line-through' }}>{brl(p.preco_original)}</span>
                  )}
                  {p.preco_promo != null && (
                    <span style={{ fontFamily: FONTE_TITULO, fontSize: 16, fontWeight: 800, color: '#16A34A' }}>{brl(p.preco_promo)}</span>
                  )}
                </div>
              )}
              {p.validade_ate && (
                <p style={{ margin: 0, fontSize: 11, color: C.textLight }}>
                  Válida até {new Date(p.validade_ate + 'T12:00').toLocaleDateString('pt-BR')}
                </p>
              )}
              {wppNumero && (
                <a
                  href={`https://wa.me/${wppNumero}?text=${encodeURIComponent(`Olá! Vi a promoção "${p.titulo}" e gostaria de saber mais.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: RAIO_MD, background: '#25D366', color: '#fff', textDecoration: 'none', fontSize: 12, fontWeight: 800, fontFamily: FONTE_TITULO }}
                >
                  Fale pelo WhatsApp
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
