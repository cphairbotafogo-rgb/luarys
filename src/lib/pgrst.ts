// ÚNICO lugar permitido para montar valores dentro de filtros PostgREST (.or()).
//
// Motivo: o `.or()` do supabase-js recebe uma STRING de filtro, não parâmetros.
// Interpolar direto o que o usuário digitou permite injetar condições novas —
// a vírgula separa cláusulas dentro do or(), e parênteses abrem grupos:
//
//   .or(`nome.ilike.%${termo}%`)                 // termo = 'x,salao_id.neq.abc'
//   → or=(nome.ilike.%x%,salao_id.neq.abc)       // condição extra injetada
//
// O CLAUDE.md proíbe esse padrão explicitamente. Já houve um caso real numa rota
// pública com service_role (/api/portal/agendar-guest), onde não havia RLS para
// conter o estrago.
//
// Regra: todo valor vindo de input do usuário passa por `filtroPgrst()` antes de
// entrar num `.or()`. Filtros de coluna/operador continuam escritos à mão — o
// que é escapado é só o VALOR.

/**
 * Envolve o valor em aspas duplas e escapa o que o PostgREST trata como especial.
 * Dentro de aspas duplas a vírgula e os parênteses são literais, então a condição
 * não pode "vazar" para fora do próprio valor.
 *
 * @example
 *   .or(`nome.ilike.${filtroPgrst(`%${termo}%`)},cpf.ilike.${filtroPgrst(`%${termo}%`)}`)
 */
export function filtroPgrst(valor: string | null | undefined): string {
  const v = (valor ?? '')
    .replace(/\\/g, '\\\\')   // barra invertida primeiro, senão re-escaparia as próximas
    .replace(/"/g, '\\"');    // aspas duplas encerrariam o valor
  return `"${v}"`;
}

/** Atalho para o caso mais comum: busca parcial (ilike %termo%) já escapada. */
export function contemPgrst(termo: string | null | undefined): string {
  return filtroPgrst(`%${(termo ?? '').trim()}%`);
}
