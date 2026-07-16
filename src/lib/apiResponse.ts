/**
 * src/lib/apiResponse.ts
 *
 * Helpers para respostas padronizadas nas rotas de API do Luarys.
 *
 * Uso:
 *   import { apiOk, apiErro } from '@/lib/apiResponse';
 *   return apiErro('Não autorizado', 401);
 *   return apiOk({ resultados });
 */

import { NextResponse } from 'next/server';

/**
 * Retorna uma resposta de erro no formato padrão { erro: string }.
 * @param msg  Mensagem de erro em Português do Brasil.
 * @param status Código HTTP (padrão 400).
 */
export function apiErro(msg: string, status = 400): NextResponse {
  return NextResponse.json({ erro: msg }, { status });
}

/**
 * Retorna uma resposta de sucesso com os dados fornecidos.
 * @param data Objeto a serializar como JSON (status 200).
 */
export function apiOk(data: unknown): NextResponse {
  return NextResponse.json(data);
}
