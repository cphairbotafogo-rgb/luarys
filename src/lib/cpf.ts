/**
 * Validação de CPF (dígitos verificadores).
 *
 * Existe por causa de uma recusa real: 3 notas voltaram da prefeitura com
 * "NFS-e possui o CPF/CNPJ do tomador inválido" porque o CPF do cliente estava
 * errado no cadastro e ia direto pro XML sem conferência.
 *
 * CPF do tomador é opcional na NFS-e — nota sem CPF sai normalmente, como
 * consumidor não identificado. Então mandar um CPF inválido é estritamente
 * pior que não mandar nada: transforma um dado opcional ruim numa nota
 * recusada.
 */

export function limparCpf(cpf: string | null | undefined): string {
  return String(cpf ?? '').replace(/\D/g, '');
}

export function validarCpf(cpf: string | null | undefined): boolean {
  const n = limparCpf(cpf);
  if (n.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(n)) return false; // 111.111.111-11 e afins

  const digito = (base: string, pesoInicial: number) => {
    const soma = base
      .split('')
      .reduce((acc, c, i) => acc + Number(c) * (pesoInicial - i), 0);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };

  return digito(n.slice(0, 9), 10) === Number(n[9])
      && digito(n.slice(0, 10), 11) === Number(n[10]);
}

/** CPF limpo quando válido; undefined quando não — para omitir do payload. */
export function cpfParaNota(cpf: string | null | undefined): string | undefined {
  return validarCpf(cpf) ? limparCpf(cpf) : undefined;
}
