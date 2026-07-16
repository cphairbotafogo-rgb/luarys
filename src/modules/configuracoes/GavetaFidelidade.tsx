'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/constants';
import { ConfigFidelidade } from '@/modules/fidelidade/ConfigFidelidade';
import { BloqueioModulo } from '@/components/BloqueioModulo';

export function GavetaFidelidade({ perfil }: any) {
  const [moduloAtivo, setModuloAtivo] = useState<boolean | null>(null);
  const [preco, setPreco] = useState(0);

  useEffect(() => {
    if (!perfil?.salao_id) return;
    Promise.all([
      supabase.from('salao_modulos')
        .select('ativo')
        .eq('salao_id', perfil.salao_id)
        .eq('modulo_chave', 'fidelidade')
        .maybeSingle(),
      supabase.from('modulos_catalogo')
        .select('preco_mensal')
        .eq('chave', 'fidelidade')
        .maybeSingle(),
      supabase.from('saloes')
        .select('acesso_total')
        .eq('id', perfil.salao_id)
        .maybeSingle(),
    ]).then(([resModulo, resCatalogo, resSalao]) => {
      const temAcesso = !!resModulo.data?.ativo || !!resSalao.data?.acesso_total;
      setModuloAtivo(temAcesso);
      setPreco(Number(resCatalogo.data?.preco_mensal ?? 0));
    });
  }, [perfil?.salao_id]);

  if (moduloAtivo === null) {
    return <p style={{ color: C.textLight, padding: 32 }}>Carregando...</p>;
  }

  if (!moduloAtivo) {
    return (
      <BloqueioModulo
        salaoId={perfil.salao_id}
        moduloChave="fidelidade"
        nome="Programa de Fidelidade"
        descricao="Fidelize seus clientes com pontos, prêmios e benefícios exclusivos. O sistema credita os pontos automaticamente ao finalizar cada atendimento."
        preco={preco}
        itens={[
          'Pontos creditados automaticamente ao finalizar atendimento',
          'Taxa de conversão personalizável (R$ → pontos)',
          'Catálogo de prêmios resgatáveis pelo cliente',
          'Saldo e extrato individual por cliente',
          'Resgate gera agendamento automático na agenda',
        ]}
      />
    );
  }

  return <ConfigFidelidade perfil={perfil} />;
}
