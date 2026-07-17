import { supabase } from '@/lib/supabase';

interface Resultado {
  valido: boolean;
  erro?: string;
}

/** Valida o PIN do gerente server-side. Nunca expõe o PIN no cliente. */
export async function verificarPinGerente(salaoId: string, pin: string): Promise<Resultado> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return { valido: false, erro: 'Sessão inválida.' };

  const res = await fetch('/api/auth/verificar-pin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ salao_id: salaoId, pin }),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) return { valido: false, erro: json.erro || 'Erro ao verificar PIN.' };
  if (json.semPin) return { valido: false, erro: 'PIN de gerente não configurado. Acesse Configurações → Segurança.' };
  return { valido: !!json.valido };
}
