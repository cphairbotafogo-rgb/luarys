'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/constants';
import { Card } from '@/components/ui';

export function GavetaDocumentos() {
  const [regras, setRegras] = useState<{ titulo: string; conteudo: string; versao: number } | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    supabase
      .from('plataforma_documentos')
      .select('titulo, conteudo, versao')
      .eq('tipo', 'regras')
      .eq('ativo', true)
      .maybeSingle()
      .then(({ data }) => { setRegras(data); setCarregando(false); });
  }, []);

  if (carregando) return <p style={{ color: C.textLight, padding: 16 }}>Carregando...</p>;
  if (!regras) return (
    <Card style={{ padding: 32, textAlign: 'center' }}>
      <p style={{ color: C.textMuted, fontStyle: 'italic' }}>Nenhum documento de regras publicado pela plataforma ainda.</p>
    </Card>
  );

  return (
    <Card style={{ padding: 32 }}>
      <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.sidebarBg }}>{regras.titulo}</h3>
        <span style={{ fontSize: 11, color: C.textLight }}>Versão {regras.versao}</span>
      </div>
      <div style={{ fontSize: 13, color: C.textMain, lineHeight: 1.8, whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif' }}>
        {regras.conteudo}
      </div>
    </Card>
  );
}
