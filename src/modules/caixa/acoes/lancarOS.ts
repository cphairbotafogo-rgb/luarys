import { supabase } from "@/lib/supabase";
import { formaParaFinanceiro } from "../tipos";
import type { FormLancar } from "../tipos";

interface Params {
  salaoId: string;
  formLancar: FormLancar;
  operadorNome?: string;
}

interface Resultado {
  ok: boolean;
  erro?: string;
}

export async function lancarOS({ salaoId, formLancar, operadorNome }: Params): Promise<Resultado> {
  const { data: osGerado, error: erroOs } = await supabase.rpc('gerar_numero_os', { p_salao_id: salaoId });
  if (erroOs) return { ok: false, erro: 'Erro ao gerar número de OS: ' + erroOs.message };

  const numeroOS = osGerado as string;
  const valorNum = parseFloat(formLancar.valor.replace(',', '.')) || 0;

  const payloadOS = {
    salao_id: salaoId,
    os_numero: numeroOS,
    cliente_nome: formLancar.cliente,
    valor_total: valorNum,
    forma_pagamento: formLancar.forma,
    bandeira_cartao: formLancar.forma.includes('Cartão') ? formLancar.bandeira : null,
    status: 'Concluído',
  };

  const { data: osInserida, error: erroOS } = await supabase
    .from('caixa_transacoes').insert([payloadOS]).select('id').single();
  if (erroOS) return { ok: false, erro: 'Erro ao lançar OS no caixa: ' + erroOS.message };

  const { error: erroFin } = await supabase.from('financeiro').insert([{
    salao_id: salaoId,
    os_numero: numeroOS,
    tipo: 'entrada',
    descricao: `PDV ${numeroOS} - ${formLancar.cliente}`,
    categoria: 'Receita de Serviços',
    valor: valorNum,
    forma_pagamento: formaParaFinanceiro(formLancar.forma),
    bandeira_cartao: formLancar.forma.includes('Cartão') ? formLancar.bandeira : null,
    status: 'Pago',
    data_movimentacao: new Date().toISOString(),
    cliente_nome: formLancar.cliente,
    comentario: `Lançado pela Frente de Caixa (${numeroOS})`
  }]);

  if (erroFin) {
    await supabase.from('caixa_transacoes').delete().eq('id', osInserida.id);
    return { ok: false, erro: `Erro ao registrar no financeiro. OS ${numeroOS} revertida.\n\nDetalhe: ${erroFin.message}` };
  }

  // nota fiscal — falha silenciosa intencional (nunca bloqueia o PDV)
  await supabase.from('notas_fiscais').insert([{
    salao_id: salaoId,
    cliente_nome: formLancar.cliente,
    cliente_cpf: formLancar.clienteCpf || null,
    descricao_servico: `OS ${numeroOS}`,
    valor: valorNum,
    item_lista_servico: formLancar.itemListaServico || null,
    valor_cota_salao: valorNum,
    valor_cota_profissional: 0,
    profissional_nome: null,
    status: 'Não Emitido'
  }]);

  return { ok: true };
}
