export const C = {
  // ─── IDENTIDADE VISUAL CONSOLIDADA (PÉROLA, ARDÓSIA E DOURADO LUARYS) ───
  logoUrl: "/logo_luarys.png", // Carga direta da nova identidade premium

  // Fundos e Textos Principais
  bg: "#F8F9FA",           // Fundo Pérola Soft (Substitui o fundo branco/gelo)
  bgCard: "#FFFFFF",       // Fundo branco puro exclusivamente para os cartões
  textMain: "#27272A",     // Texto principal (Cinza Chumbo, altamente legível)
  textMuted: "#52525B",    // Texto secundário (Descanso visual para informações menores)
  textLight: "#718096",    // Texto suave / Ícones desativados
  
  // Bordas Sutis (Para criar a separação sem pesar a tela)
  border: "#E2E8F0",       
  borderMid: "#CBD5E1",    
  
  // Sidebar (A "Personalidade Forte")
  sidebarBg: "#2C3643",    // Azul Ardósia Profundo
  sidebarText: "#E2E8F0",  // Texto base da sidebar (Cinza muito claro)
  activeMenuBg: "#94A390", // Sálvia suave para destacar a aba ativa
  
  // Elementos de Ação e Destaque
  btnPrimary: "#6B788A",   // Botões principais (Azul-acinzentado elegante)
  douradoEleva: "#D4AF37", // Destaques Premium Luarys (Logotipo e ícones VIP)
  
  // Cards da Agenda Visual (Camaleão para Estética/Salão)
  cardSage: "#8EA291",     // Verde calmante (Ideal para massagens/estética)
  cardSlate: "#727E8D",    // Ardósia médio (Ideal para consultas/cabelo)

  // ─── TOKENS DE LEGADO (Para evitar crashes no Portal antigo) ───
  douradoLuarys: "#D4AF37", // alias de douradoEleva — não remover (usado em 11 arquivos)
  violet: "#6D28D9",
  lavender: "#EDE9FE",
  charcoal: "#1E293B",
  deepPurple: "#3B0D6F",

  // ─── CORES DE STATUS (MANTIDAS PARA ALERTAS GERAIS DO SISTEMA) ───
  success: "#10B981",
  successBg: "#D1FAE5",
  successText: "#065F46",
  danger: "#EF4444",
  dangerBg: "#FEE2E2",
  dangerText: "#991B1B",
  warning: "#EAB308",
  warningBg: "#FEF9C3",
  warningText: "#854D0E",
};

export function initials(nome: string) {
  if (!nome) return '';
  const partes = nome.trim().split(' ');
  if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export function brl(valor: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
}

// ─── DADOS MOCK (PRESERVADOS) ──────────────────────────────────────────────────
export const TRANSACOES = [
  { id: 1, descricao: "Coloração - Mariana Costa", tipo: "entrada", valor: 320, data: "2026-05-14", categoria: "Serviço" },
  { id: 2, descricao: "Corte + Escova - Ana Beatriz", tipo: "entrada", valor: 180, data: "2026-05-14", categoria: "Serviço" },
  { id: 3, descricao: "Manicure - Patrícia Souza", tipo: "entrada", valor: 90, data: "2026-05-14", categoria: "Serviço" },
  { id: 4, descricao: "Fornecedor - Produtos L'Oréal", tipo: "saida", valor: 850, data: "2026-05-13", categoria: "Insumos" },
  { id: 5, descricao: "Escova Progressiva - Débora", tipo: "entrada", valor: 450, data: "2026-05-13", categoria: "Serviço" },
  { id: 6, descricao: "Aluguel do Espaço", tipo: "saida", valor: 3200, data: "2026-05-12", categoria: "Fixo" },
  { id: 7, descricao: "Limpeza de Pele - Renata", tipo: "entrada", valor: 200, data: "2026-05-12", categoria: "Serviço" },
  { id: 8, descricao: "Hidratação - Fernanda", tipo: "entrada", valor: 150, data: "2026-05-11", categoria: "Serviço" },
];

export const AGENDAMENTOS = [
  { id: 1, cliente: "Ana Beatriz", servico: "Corte + Escova", profissional: "Carla", horario: "09:00", data: "2026-05-14", status: "Confirmado", valor: 180 },
  { id: 2, cliente: "Mariana Costa", servico: "Coloração", profissional: "Juliana", horario: "10:30", data: "2026-05-14", status: "Confirmado", valor: 320 },
  { id: 3, cliente: "Fernanda Lima", servico: "Hidratação", profissional: "Carla", horario: "13:00", data: "2026-05-14", status: "Pendente", valor: 150 },
  { id: 4, cliente: "Patrícia Souza", servico: "Manicure", profissional: "Bianca", horario: "14:00", data: "2026-05-14", status: "Confirmado", valor: 90 },
  { id: 5, cliente: "Renata Alves", servico: "Limpeza de Pele", profissional: "Juliana", horario: "15:30", data: "2026-05-14", status: "Concluído", valor: 200 },
  { id: 6, cliente: "Camila Rocha", servico: "Corte", profissional: "Carla", horario: "16:00", data: "2026-05-15", status: "Confirmado", valor: 120 },
  { id: 7, cliente: "Débora Martins", servico: "Escova Progressiva", profissional: "Juliana", horario: "09:00", data: "2026-05-15", status: "Confirmado", valor: 450 },
  { id: 8, cliente: "Larissa Nunes", servico: "Manicure + Pedicure", profissional: "Bianca", horario: "11:00", data: "2026-05-16", status: "Pendente", valor: 140 },
];

export const CLIENTES = [
  { id: 1, nome: "Ana Beatriz", telefone: "21999990001", email: "ana@email.com", ultimaVisita: "2026-05-14", totalGasto: 1240, visitas: 8, tags: ["VIP", "Coloração"] },
  { id: 2, nome: "Mariana Costa", telefone: "21999990002", email: "mari@email.com", ultimaVisita: "2026-05-14", totalGasto: 2100, visitas: 12, tags: ["Frequente"] },
  { id: 3, nome: "Fernanda Lima", telefone: "21999990003", email: "fer@email.com", ultimaVisita: "2026-04-10", totalGasto: 680, visitas: 4, tags: ["Risco Churn"] },
  { id: 4, nome: "Patrícia Souza", telefone: "21999990004", email: "pati@email.com", ultimaVisita: "2026-05-14", totalGasto: 560, visitas: 7, tags: ["Frequente"] },
  { id: 5, nome: "Renata Alves", telefone: "21999990005", email: "renata@email.com", ultimaVisita: "2026-05-14", totalGasto: 980, visitas: 6, tags: ["VIP"] },
  { id: 6, nome: "Camila Rocha", telefone: "21999990006", email: "camila@email.com", ultimaVisita: "2026-03-20", totalGasto: 340, visitas: 3, tags: ["Risco Churn"] },
];

export const SERVICOS = [
  { id: 1, nome: "Corte Feminino", duracao: 60, preco: 120, categoria: "Cabelo" },
  { id: 2, nome: "Escova", duracao: 45, preco: 80, categoria: "Cabelo" },
  { id: 3, nome: "Coloração", duracao: 120, preco: 280, categoria: "Cabelo" },
  { id: 4, nome: "Escova Progressiva", duracao: 180, preco: 450, categoria: "Química" },
  { id: 5, nome: "Hidratação", duracao: 60, preco: 150, categoria: "Tratamento" },
  { id: 6, nome: "Manicure", duracao: 60, preco: 60, categoria: "Unhas" },
  { id: 7, nome: "Pedicure", duracao: 60, preco: 80, categoria: "Unhas" },
  { id: 8, nome: "Limpeza de Pele", duracao: 90, preco: 200, categoria: "Estética" },
];

export const EQUIPE = [
  { id: 1, nome: "Carla Mendes", cargo: "Cabeleireira Sênior", especialidades: ["Corte", "Escova", "Coloração"], agendamentosHoje: 3, faturamentoMes: 4200 },
  { id: 2, nome: "Juliana Freitas", cargo: "Colorista", especialidades: ["Coloração", "Progressiva", "Hidratação"], agendamentosHoje: 2, faturamentoMes: 5800 },
  { id: 3, nome: "Bianca Oliveira", cargo: "Manicure", especialidades: ["Manicure", "Pedicure", "Nail Art"], agendamentosHoje: 2, faturamentoMes: 2100 },
];

export const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
export const DAYS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

// ─── REFINAMENTO DE CARD MAPPING ─────────────────────────────────────────────
export function statusStyle(s: string) {
  if (s === "Confirmado") return { bg: "#E8F0EA", color: "#3B4A3F" }; // Sálvia sutil, texto escuro
  if (s === "Pendente") return { bg: "#FDF8E7", color: "#856404" };   // Areia suave
  if (s === "Concluído") return { bg: "#E2E8F0", color: "#2C3643" };  // Cinza ardósia claro
  if (s === "Cancelado") return { bg: C.dangerBg, color: C.dangerText }; 
  return { bg: C.bgCard, color: C.textMain };
}

export function tagStyle(t: string) {
  if (t === "VIP") return { bg: "#FDF8E7", color: "#9A7B2C" };        // Ouro/Champanhe de alta costura
  if (t === "Frequente") return { bg: "#E8F0EA", color: "#3B4A3F" };  // Sálvia clínico
  if (t === "Risco Churn") return { bg: C.dangerBg, color: C.dangerText }; 
  return { bg: C.border, color: C.textMuted };
}

export function getDataHojeLocal() {
  const d = new Date();
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}