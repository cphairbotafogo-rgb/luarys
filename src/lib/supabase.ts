import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// createBrowserClient é um substituto direto do createClient: mesma API
// (supabase.auth.signInWithPassword, .from(), .auth.onAuthStateChange, etc.)
// A diferença é que a sessão também é gravada em cookies, o que permite
// que o middleware.ts (que roda no Edge, sem acesso a localStorage) saiba
// se o usuário está autenticado.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
