-- M3: Converter views SECURITY DEFINER para SECURITY INVOKER
-- PROBLEMA: views saloes_publico, servicos_publico e profissionais_publico
-- são SECURITY DEFINER — rodam com permissão do criador e ignoram RLS do
-- chamador. O linter do Supabase classifica isso como nível ERROR.
-- SOLUÇÃO: security_invoker = true faz a view respeitar o RLS do role que consulta.

ALTER VIEW IF EXISTS public.saloes_publico SET (security_invoker = true);
ALTER VIEW IF EXISTS public.servicos_publico SET (security_invoker = true);
ALTER VIEW IF EXISTS public.profissionais_publico SET (security_invoker = true);
