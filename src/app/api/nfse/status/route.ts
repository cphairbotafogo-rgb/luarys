import { NextResponse } from 'next/server';

// Mantido apenas para compatibilidade — o token agora é configurado por salão
// via Configurações → Nota Fiscal e armazenado em saloes.config_fiscal.focus_nfe_token
export async function GET() {
  return NextResponse.json({
    configurado: !!(process.env.FOCUS_NFE_TOKEN?.trim()),
    ambiente: process.env.FOCUS_NFE_AMBIENTE || 'sandbox',
    nota: 'Token por salão gerenciado via banco de dados.',
  });
}
