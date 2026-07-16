// src/middleware.ts
//
// FIX: este arquivo nunca existia no projeto. O cliente Supabase usado em
// toda a aplicação (src/lib/supabase.js) é criado com createBrowserClient
// do pacote @supabase/ssr — esse client grava a sessão em COOKIES, não só
// em localStorage. A documentação oficial do Supabase é explícita: esse
// modelo de sessão via cookies EXIGE um middleware para renovar o token de
// autenticação automaticamente a cada navegação ("Since Server Components
// can't write cookies, you need middleware to refresh expired Auth
// tokens").
//
// Sem este arquivo, o token criado no login (ex: no Portal do Cliente, via
// supabase.auth.signInWithPassword) eventualmente fica desatualizado —
// chamadas subsequentes ao Supabase passam a ser tratadas como anônimas
// pela RLS. Isso não gera erro: políticas de RLS baseadas em
// auth.role() = 'authenticated' simplesmente retornam lista VAZIA quando
// o usuário não está realmente autenticado no momento da chamada — o que
// explica o sintoma observado (servicos retornando [] mesmo com a tela
// mostrando "Olá, {nome}!").
//
// O painel do dono provavelmente "funcionava por sorte" até agora — sessões
// mais recentes/curtas, ou navegação que não expôs o problema. O Portal do
// Cliente, com fluxos mais longos (escolher salão → login → navegar entre
// passos do agendamento), expôs a falta do middleware de forma mais visível.

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() (não getSession()) é o método seguro de validar o token no
  // servidor — ele revalida a assinatura do JWT contra o Supabase a cada
  // chamada, em vez de confiar ciegamente no cookie local. É também essa
  // chamada que efetivamente RENOVA o token quando ele está perto de
  // expirar, escrevendo o novo token de volta nos cookies da resposta.
  await supabase.auth.getUser();

  return response;
}

// Roda em todas as rotas de PÁGINA (inclui /portal e o painel do dono em
// /) exceto assets estáticos e rotas de API. Rotas em /api/* (webhooks de
// pagamento, criação de profissional, etc.) são chamadas por serviços
// externos ou por fetch direto do frontend — não dependem do cookie de
// sessão renovado aqui, e não devem pagar o custo extra de uma chamada
// auth.getUser() a cada requisição.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};