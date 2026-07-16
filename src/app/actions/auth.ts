'use server'
import { createClient } from '@supabase/supabase-js'

export async function criarContaAdmin(email: string, senha: string, nome: string, cpf: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { sucesso: false, erro: "Chaves de administrador não encontradas no servidor." };
  }

  // Conecta ao banco de dados com os poderes máximos (Service Role)
  const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

  // Cria o utilizador forçando a auto-confirmação (Ignora limites de spam)
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: email,
    password: senha,
    email_confirm: true, // ✨ A MÁGICA: Confirma a conta na hora, sem enviar e-mail!
    user_metadata: { nome_completo: nome, cpf: cpf, tipo_usuario: 'admin' }
  });

  if (error) {
    return { sucesso: false, erro: error.message };
  }

  return { sucesso: true, userId: data.user.id };
}