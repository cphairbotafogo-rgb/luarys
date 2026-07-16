export function mesAtualStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function diaAtual() { return new Date().getDate(); }

const DIAS_FUNC_NOME = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

export function calcularDiasUteis(horarios: any[]): { total: number; ateHoje: number; restantes: number } {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const diaHojeNum = hoje.getDate();
  const totalDias = new Date(ano, mes + 1, 0).getDate();

  if (!horarios || horarios.length === 0) {
    return { total: totalDias, ateHoje: diaHojeNum, restantes: totalDias - diaHojeNum };
  }

  const funcPorDia: Record<string, boolean> = {};
  horarios.forEach((h: any) => { funcPorDia[h.dia] = !!h.ativo; });

  let total = 0, ateHoje = 0, restantes = 0;
  for (let d = 1; d <= totalDias; d++) {
    const data = new Date(ano, mes, d);
    const nomeDia = DIAS_FUNC_NOME[data.getDay()];
    if (funcPorDia[nomeDia]) {
      total++;
      if (d <= diaHojeNum) ateHoje++;
      else restantes++;
    }
  }
  return { total, ateHoje, restantes };
}
