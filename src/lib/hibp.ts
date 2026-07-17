/**
 * Verifica se uma senha aparece em vazamentos via HaveIBeenPwned (k-anonymity).
 * Só os primeiros 5 chars do hash SHA-1 saem do dispositivo — a senha nunca trafega.
 * Falha aberta: se a API estiver offline, retorna false (não bloqueia o cadastro).
 */
export async function senhaVazada(senha: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const buffer  = await crypto.subtle.digest('SHA-1', encoder.encode(senha));
    const hex     = Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();

    const prefix = hex.slice(0, 5);
    const suffix = hex.slice(5);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
    });
    if (!res.ok) return false;

    const texto = await res.text();
    return texto.split('\n').some(linha => linha.trimStart().startsWith(suffix));
  } catch {
    return false;
  }
}
