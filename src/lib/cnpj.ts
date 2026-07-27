// ÚNICO lugar permitido para limpar/validar CNPJ no Luarys.
//
// Motivo: desde 01/07/2026 a Receita emite CNPJs ALFANUMÉRICOS
// (IN RFB 2.229/2024 — letras maiúsculas nas 12 primeiras posições).
// O padrão antigo `cnpj.replace(/\D/g, '')` REMOVE as letras e produz,
// silenciosamente, um CNPJ de outra empresa — hoje existem ~18 pontos do
// código com esse padrão, que devem migrar gradualmente para este helper.
//
// Regras:
//  - Limpar   → limparCnpj()  (mantém [A-Z0-9], remove só máscara)
//  - Validar  → validarCnpj() (dígito verificador charCode−48, retrocompatível
//               com CNPJs 100% numéricos)
//  - NUNCA converter CNPJ ou chave de acesso para número (parseInt, BIGINT).
//  - Se um gateway externo rejeitar CNPJ com letra, tratar o erro do gateway —
//    não "consertar" removendo a letra.

/** Remove apenas a máscara (pontos, traços, barras, espaços) e normaliza para maiúsculas. */
export function limparCnpj(cnpj: string | null | undefined): string {
  return (cnpj ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** True se, depois de limpo, tem exatamente 14 caracteres [A-Z0-9]. */
export function cnpjCompleto(cnpj: string | null | undefined): boolean {
  return limparCnpj(cnpj).length === 14;
}

/**
 * Valida o dígito verificador do CNPJ (numérico ou alfanumérico).
 * IN RFB 2.229/2024: valor de cada caractere = charCode ASCII − 48
 * ('0'→0 … '9'→9, 'A'→17 … 'Z'→42). Módulo 11 tradicional.
 */
export function validarCnpj(cnpj: string | null | undefined): boolean {
  const n = limparCnpj(cnpj);
  if (n.length !== 14) return false;
  if (/^(.)\1+$/.test(n)) return false; // todos os caracteres iguais

  const val = (c: string) => c.charCodeAt(0) - 48;

  const calc = (base: string, pesos: number[]) => {
    const soma = base.split('').reduce((acc, c, i) => acc + val(c) * pesos[i], 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };

  const d1 = calc(n.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(n.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  // Dígitos verificadores são sempre numéricos, mesmo no CNPJ alfanumérico.
  return val(n[12]) === d1 && val(n[13]) === d2;
}

/** Formata para exibição: XX.XXX.XXX/XXXX-XX (aceita alfanumérico). */
export function formatarCnpj(cnpj: string | null | undefined): string {
  const n = limparCnpj(cnpj);
  if (n.length !== 14) return cnpj ?? '';
  return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-${n.slice(12)}`;
}
