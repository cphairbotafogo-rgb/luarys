export type Servico      = { id: string; nome_servico: string; descricao: string; preco_padrao: number; duracao_minutos: number; categoria: string };
export type Profissional = { id: string; nome: string; foto_url: string | null };
export type Salao        = { id: string; nome_fantasia: string; telefone: string; instagram: string; logradouro: string; numero: string; bairro: string; cidade: string; estado: string; sobre_nos: string; horarios_funcionamento: any };
export type Etapa        = 'landing' | 'servico' | 'profissional' | 'dataHora' | 'dados' | 'sucesso' | 'erro';

export const UUID_RE    = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
export const MESES      = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export function gerarSlots(duracao: number): string[] {
  const slots: string[] = [];
  let h = 8, m = 0;
  while (h < 20 || (h === 20 && m === 0)) {
    slots.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
    m += duracao;
    if (m >= 60) { m -= 60; h++; }
  }
  return slots;
}

export function formatarData(iso: string) {
  const [y, mo, d] = iso.split('-');
  return `${d}/${mo}/${y}`;
}

export function isoParaLocal(str: string) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function hoje() { return new Date().toISOString().split('T')[0]; }

export function addDias(iso: string, n: number) {
  const d = isoParaLocal(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}
