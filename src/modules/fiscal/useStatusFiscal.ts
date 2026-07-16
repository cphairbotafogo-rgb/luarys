'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { StatusFiscal } from './tipos_fiscal';

interface UseStatusFiscalRetorno {
  status: StatusFiscal | null;
  carregando: boolean;
  erro: string | null;
  recarregar: () => Promise<void>;
}

/**
 * Busca o status fiscal (NFS-e/NFC-e, certificado, ambiente) do salão
 * autenticado. RLS garante que só retorna dados do próprio salão.
 */
export function useStatusFiscal(): UseStatusFiscalRetorno {
  const [status, setStatus]     = useState<StatusFiscal | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro]         = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    const { data, error } = await supabase.rpc('obter_status_fiscal');

    if (error) {
      setErro(error.message);
      setCarregando(false);
      return;
    }

    const linha = Array.isArray(data) ? data[0] : data;

    setStatus(linha ? {
      cnpj:                linha.cnpj,
      ambiente:            linha.ambiente,
      nfseAtivo:           linha.nfse_ativo,
      nfseFaturamento:     linha.nfse_faturamento,
      nfceAtivo:           linha.nfce_ativo,
      nfceFaturamento:     linha.nfce_faturamento,
      certificadoStatus:   linha.certificado_status,
      certificadoValidade: linha.certificado_validade,
    } : null);

    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  return { status, carregando, erro, recarregar: carregar };
}
