// Fonte única de códigos DDI — usada no ModalCliente (CRM) e AbaContatos (agenda).
// Ordenada: América do Sul primeiro (clientela mais comum do salão), depois resto.
export interface DDI {
  code:  string; // ex: "+55"
  nome:  string; // ex: "Brasil"
  emoji: string; // ex: "🇧🇷"
}

export const DDIS: DDI[] = [
  // ─── América do Sul ───────────────────────────────────────────────────────
  { code: '+55',  nome: 'Brasil',          emoji: '🇧🇷' },
  { code: '+54',  nome: 'Argentina',       emoji: '🇦🇷' },
  { code: '+591', nome: 'Bolívia',         emoji: '🇧🇴' },
  { code: '+56',  nome: 'Chile',           emoji: '🇨🇱' },
  { code: '+57',  nome: 'Colômbia',        emoji: '🇨🇴' },
  { code: '+593', nome: 'Equador',         emoji: '🇪🇨' },
  { code: '+592', nome: 'Guiana',          emoji: '🇬🇾' },
  { code: '+595', nome: 'Paraguai',        emoji: '🇵🇾' },
  { code: '+51',  nome: 'Peru',            emoji: '🇵🇪' },
  { code: '+597', nome: 'Suriname',        emoji: '🇸🇷' },
  { code: '+598', nome: 'Uruguai',         emoji: '🇺🇾' },
  { code: '+58',  nome: 'Venezuela',       emoji: '🇻🇪' },
  // ─── América do Norte e Central ───────────────────────────────────────────
  { code: '+1',   nome: 'EUA / Canadá',    emoji: '🇺🇸' },
  { code: '+52',  nome: 'México',          emoji: '🇲🇽' },
  { code: '+53',  nome: 'Cuba',            emoji: '🇨🇺' },
  { code: '+502', nome: 'Guatemala',       emoji: '🇬🇹' },
  { code: '+503', nome: 'El Salvador',     emoji: '🇸🇻' },
  { code: '+504', nome: 'Honduras',        emoji: '🇭🇳' },
  { code: '+505', nome: 'Nicarágua',       emoji: '🇳🇮' },
  { code: '+506', nome: 'Costa Rica',      emoji: '🇨🇷' },
  { code: '+507', nome: 'Panamá',          emoji: '🇵🇦' },
  // ─── Europa ───────────────────────────────────────────────────────────────
  { code: '+351', nome: 'Portugal',        emoji: '🇵🇹' },
  { code: '+34',  nome: 'Espanha',         emoji: '🇪🇸' },
  { code: '+44',  nome: 'Reino Unido',     emoji: '🇬🇧' },
  { code: '+33',  nome: 'França',          emoji: '🇫🇷' },
  { code: '+49',  nome: 'Alemanha',        emoji: '🇩🇪' },
  { code: '+39',  nome: 'Itália',          emoji: '🇮🇹' },
  { code: '+31',  nome: 'Países Baixos',   emoji: '🇳🇱' },
  { code: '+32',  nome: 'Bélgica',         emoji: '🇧🇪' },
  { code: '+41',  nome: 'Suíça',           emoji: '🇨🇭' },
  { code: '+43',  nome: 'Áustria',         emoji: '🇦🇹' },
  { code: '+46',  nome: 'Suécia',          emoji: '🇸🇪' },
  { code: '+47',  nome: 'Noruega',         emoji: '🇳🇴' },
  { code: '+45',  nome: 'Dinamarca',       emoji: '🇩🇰' },
  { code: '+358', nome: 'Finlândia',       emoji: '🇫🇮' },
  { code: '+353', nome: 'Irlanda',         emoji: '🇮🇪' },
  { code: '+30',  nome: 'Grécia',          emoji: '🇬🇷' },
  { code: '+48',  nome: 'Polônia',         emoji: '🇵🇱' },
  { code: '+7',   nome: 'Rússia',          emoji: '🇷🇺' },
  { code: '+380', nome: 'Ucrânia',         emoji: '🇺🇦' },
  { code: '+90',  nome: 'Turquia',         emoji: '🇹🇷' },
  // ─── África ───────────────────────────────────────────────────────────────
  { code: '+27',  nome: 'África do Sul',   emoji: '🇿🇦' },
  { code: '+244', nome: 'Angola',          emoji: '🇦🇴' },
  { code: '+258', nome: 'Moçambique',      emoji: '🇲🇿' },
  { code: '+238', nome: 'Cabo Verde',      emoji: '🇨🇻' },
  { code: '+239', nome: 'São Tomé',        emoji: '🇸🇹' },
  { code: '+245', nome: 'Guiné-Bissau',    emoji: '🇬🇼' },
  // ─── Oriente Médio ────────────────────────────────────────────────────────
  { code: '+972', nome: 'Israel',          emoji: '🇮🇱' },
  { code: '+971', nome: 'Emirados Árabes', emoji: '🇦🇪' },
  { code: '+966', nome: 'Arábia Saudita',  emoji: '🇸🇦' },
  // ─── Ásia e Oceania ───────────────────────────────────────────────────────
  { code: '+81',  nome: 'Japão',           emoji: '🇯🇵' },
  { code: '+86',  nome: 'China',           emoji: '🇨🇳' },
  { code: '+91',  nome: 'Índia',           emoji: '🇮🇳' },
  { code: '+82',  nome: 'Coreia do Sul',   emoji: '🇰🇷' },
  { code: '+65',  nome: 'Cingapura',       emoji: '🇸🇬' },
  { code: '+61',  nome: 'Austrália',       emoji: '🇦🇺' },
  { code: '+64',  nome: 'Nova Zelândia',   emoji: '🇳🇿' },
];

// Formato curto para select: "+55 🇧🇷"
export function labelDDI(d: DDI) {
  return `${d.code} ${d.emoji}`;
}

// Formato longo para opção expandida: "+55 🇧🇷 Brasil"
export function optionDDI(d: DDI) {
  return `${d.code} ${d.emoji} ${d.nome}`;
}
