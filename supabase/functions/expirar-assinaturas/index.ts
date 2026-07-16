import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async () => {
  const inicio = new Date().toISOString();

  const [resModulos, resPlanos] = await Promise.all([
    supabase.rpc('expirar_modulos_vencidos'),
    supabase.rpc('expirar_planos_vencidos'),
  ]);

  const modulosExpirados: number = resModulos.data ?? 0;
  const planosExpirados: number  = resPlanos.data ?? 0;

  const erros: string[] = [];
  if (resModulos.error) erros.push('módulos: ' + resModulos.error.message);
  if (resPlanos.error)  erros.push('planos: '  + resPlanos.error.message);

  const corpo = {
    executado_em:      inicio,
    modulos_expirados: modulosExpirados,
    planos_expirados:  planosExpirados,
    erros:             erros.length > 0 ? erros : null,
  };

  console.log('[expirar-assinaturas]', JSON.stringify(corpo));

  return new Response(JSON.stringify(corpo), {
    status: erros.length > 0 ? 500 : 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
