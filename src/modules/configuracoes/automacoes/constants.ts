import { FiGift, FiUserX } from "react-icons/fi";

export const ROTULOS_GATILHO: Record<string, { label: string; icone: any; cor: string }> = {
  aniversario: { label: "Aniversário do Cliente", icone: FiGift, cor: "#D946EF" },
  cliente_inativo: { label: "Cliente Inativo", icone: FiUserX, cor: "#F59E0B" },
};

export const MSG_CONFIRMACAO_PADRAO =
`{nome_do_cliente}, seu horário está confirmado.
📅 {data} às {horario}
✂️ {servico} · {profissional}
{nome_salao}`;

// Três templates fixos classificados como Utility pela Meta
// (sem oferta, sem promoção, sem linguagem de marketing → menor custo de cobrança)
export const TEMPLATES_CONFIRMACAO: { id: string; titulo: string; descricao: string; texto: string }[] = [
  {
    id: 'compacta',
    titulo: 'Compacta',
    descricao: 'Dados em lista, emoji discreto. Leitura rápida no celular.',
    texto:
`{nome_do_cliente}, seu horário está confirmado.
📅 {data} às {horario}
✂️ {servico} · {profissional}
{nome_salao}`,
  },
  {
    id: 'corrida',
    titulo: 'Linha única',
    descricao: 'Uma frase só — mínimo de texto, máximo de clareza.',
    texto:
`Olá {nome_do_cliente}! Agendamento confirmado: {data} às {horario}, {servico} com {profissional}. — {nome_salao}`,
  },
  {
    id: 'formal',
    titulo: 'Formal',
    descricao: 'Formato tabular sem emoji. Ideal para salões mais tradicionais.',
    texto:
`{nome_do_cliente}, confirmação de agendamento:
Data: {data}
Horário: {horario}
Serviço: {servico}
Profissional: {profissional}
{nome_salao}`,
  },
];

export const DICA_PLACEHOLDERS = [
  { var: '{nome_do_cliente}', desc: 'Nome do cliente' },
  { var: '{data}',            desc: 'Data do agendamento' },
  { var: '{horario}',         desc: 'Horário (ex: 12:00 – 12:30)' },
  { var: '{servico}',         desc: 'Serviço agendado' },
  { var: '{profissional}',    desc: 'Nome do profissional (linha removida se não houver)' },
  { var: '{nome_salao}',      desc: 'Nome fantasia do salão' },
];

export const PLACEHOLDERS_POR_GATILHO: Record<string, { var: string; desc: string }[]> = {
  confirmacao_agendamento: DICA_PLACEHOLDERS,
  aniversario: [
    { var: '{nome_do_cliente}', desc: 'Nome do cliente' },
    { var: '{nome_salao}',      desc: 'Nome fantasia do salão' },
  ],
  cliente_inativo: [
    { var: '{nome_do_cliente}', desc: 'Nome do cliente' },
    { var: '{nome_salao}',      desc: 'Nome fantasia do salão' },
    { var: '{dias_ausente}',    desc: 'Quantos dias sem visitar (ex: 45)' },
    { var: '{ultimo_servico}',  desc: 'Último serviço realizado' },
  ],
};

export function gerarLinkWhatsapp(telefone: string, mensagem: string) {
  let numero = (telefone || '').replace(/\D/g, '');
  if (numero.length > 0 && numero.length <= 11) numero = '55' + numero;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}
