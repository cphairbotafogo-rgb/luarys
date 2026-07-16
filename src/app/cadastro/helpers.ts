import { C } from '@/lib/constants';
import { RAIO_MD } from '@/lib/estiloGlobal';

export type Passo = 1 | 2 | 3 | 4;

export const TITULOS: Record<Passo, string> = {
  1: 'Criar sua conta',
  2: 'Dados do seu salão',
  3: 'Dados da empresa',
  4: 'Tudo certo! 🎉',
};

export const SUBTITULOS: Record<Passo, string> = {
  1: 'O e-mail e senha serão usados para entrar no sistema.',
  2: 'Estas informações aparecem para os seus clientes.',
  3: 'Necessário para emissão de notas fiscais e contrato.',
  4: 'Sua conta foi criada. Entrando no sistema...',
};

export function slugify(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 40);
}

export function mascaraCNPJ(v: string): string {
  const n = v.replace(/\D/g, '').substring(0, 14);
  return n
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function mascaraCPF(v: string): string {
  const n = v.replace(/\D/g, '').substring(0, 11);
  return n
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export function limpaCNPJ(cnpj: string): string {
  return cnpj.replace(/[.\-\/\s]/g, '').toUpperCase();
}

export function validarCNPJ(cnpj: string): boolean {
  const n = limpaCNPJ(cnpj);
  if (n.length !== 14 || /^(.)\1+$/.test(n)) return false;
  // IN RFB 2.229/2024: dígito verificador usa charCode-48
  const val = (c: string) => c.charCodeAt(0) - 48;
  const calc = (base: string, pesos: number[]) => {
    const soma = base.split('').reduce((acc, c, i) => acc + val(c) * pesos[i], 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(n.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2]);
  const d2 = calc(n.slice(0, 13), [6,5,4,3,2,9,8,7,6,5,4,3,2]);
  return val(n[12]) === d1 && val(n[13]) === d2;
}

export const inputStyle: React.CSSProperties = {
  width: '100%', padding: '13px 16px', borderRadius: RAIO_MD,
  border: `1px solid ${C.borderMid}`, outlineColor: C.sidebarBg,
  boxSizing: 'border-box', fontSize: 14,
  color: C.textMain, backgroundColor: '#fff',
  fontFamily: 'var(--font-body)', fontWeight: 500,
};

export const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: C.textMuted,
  textTransform: 'uppercase', letterSpacing: '0.5px',
  display: 'block', marginBottom: 6,
};
