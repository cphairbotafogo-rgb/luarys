import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (list) => list.forEach(c => cookieStore.set(c)) } }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { documento_id, versao } = body;
  if (!documento_id || !versao) {
    return NextResponse.json({ erro: "documento_id e versao são obrigatórios" }, { status: 400 });
  }

  // Resolve salao_id via RPC (respeita RLS)
  const { data: salaoId } = await supabase.rpc("auth_salao_id");
  if (!salaoId) return NextResponse.json({ erro: "Salão não encontrado" }, { status: 403 });

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "desconhecido";
  const userAgent = req.headers.get("user-agent") || "";

  const { error } = await supabase.from("termos_aceites").insert({
    salao_id: salaoId,
    usuario_id: session.user.id,
    documento_id,
    versao,
    ip,
    user_agent: userAgent,
  });

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
