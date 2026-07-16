import { useState } from "react";
import { brl } from "@/lib/constants";
import { executarFechamentoConta } from "./fechamento/executarFechamentoConta";

export function useFechamentoCaixa({
  perfil,
  agendamentos,
  setAgendamentos,
  clientesDb,
  servicosDb,
  profissionaisDb,
  produtosDb,
  dataHojeStr,
  editandoAg,
  setModalEdicaoAberto
}: any) {

  const [modalCaixaAberto, setModalCaixaAberto] = useState(false);
  const [dadosCaixa, setDadosCaixa] = useState<any>({
    agendamentoId: null, clienteId: null, clienteCpf: null,
    clienteNome: '', servicos: [], total: 0, recebido: 0, falta: 0,
    pagamentos: { pix: 0, credito: 0, debito: 0, dinheiro: 0 },
    deixarComoDivida: false, deixarComoGorjeta: false, comentario: ''
  });

  function adicionarItemAvulsoCaixa(tipo: any) {
    const titulos: any = {
      'servico': 'Serviço Adicional',
      'produto': 'Produto (Venda)',
      'pacote': 'Pacote Promocional',
      'vale': 'Vale Presente'
    };
    const novoItem: any = {
      id: Date.now(), nome: '', profissional: "Equipe", profissional_id: null,
      preco: 0, desconto: 0, tipo: tipo, produto_id: null, item_id: null,
      qtd: 1, custo: 0, _tipoLabel: titulos[tipo] || 'Item Avulso'
    };
    setDadosCaixa((prev: any) => ({ ...prev, servicos: [...prev.servicos, novoItem] as never[] }));
  }

  // agsOverride: lista completa de agendamentos já conhecidos (evita race condition
  // quando chamado logo após um insert, antes do state de agendamentos ser atualizado).
  function abrirFechamentoDeCaixa(agOverride?: any, agsOverride?: any[]) {
    const agBase = agOverride || editandoAg;

    const agsDoCliente: any[] = agsOverride
      ? [...agsOverride]
      : agendamentos.filter((ag: any) =>
          ag.cliente === agBase.cliente &&
          ag.data === agBase.data &&
          ag.status !== 'Finalizado' &&
          ag.status !== 'Cancelado' &&
          ag.cliente !== "AUSÊNCIA" && ag.cliente !== "LIBERAÇÃO"
        );

    if (!agsDoCliente.find((a: any) => a.id === agBase.id)) {
      agsDoCliente.push(agBase);
    }

    let totalGeralBruto = 0;
    let totalSinalPago = 0;

    const servicosMapeados = agsDoCliente.map((ag: any) => {
      let sinalPago = ag.valor_sinal || 0;
      if (sinalPago === 0 && ag.observacao && ag.observacao.includes("Taxa cobrada:")) {
        const match = ag.observacao.match(/R\$\s?(\d+(?:[,.]\d+)?)/);
        if (match) sinalPago = parseFloat(match[1].replace(',', '.'));
      }

      // FIX: usar ag.servico_id (já disponível no estado local desde useAgendaDados)
      // para encontrar o serviço com certeza — busca por nome falha quando o
      // serviço foi renomeado ou tem caracteres especiais diferentes.
      const servicoRef = servicosDb.find((s: any) =>
        (ag.servico_id && s.id === ag.servico_id) ||
        s.nome_servico === ag.servico || s.nome === ag.servico
      );
      const precoItem = ag.valor_final ?? ag.totalBruto ?? servicoRef?.preco_padrao ?? 0;

      totalGeralBruto += precoItem;
      totalSinalPago += sinalPago;

      return {
        id: ag.id || `${servicoRef?.id || 'item'}-${Date.now()}-${Math.random()}`,
        id_linha: `linha-${ag.id || Date.now()}-${Math.random().toString(36).slice(2)}`,
        agendamento_id: ag.id,
        profissional_id: ag.id_prof,
        nome: ag.servico,
        item_id: ag.servico_id || servicoRef?.id || null,
        nbs: servicoRef?.nbs || '',
        profissional: profissionaisDb.find((p: any) => p.id === ag.id_prof)?.nome || "Equipe",
        preco: precoItem,
        desconto: 0,
        tipo: 'servico',
        produto_id: null,
        qtd: 1,
        custo: 0
      };
    });

    const totalComAbatimento = totalGeralBruto - totalSinalPago;
    const clienteRef = clientesDb.find((c: any) => c.nome_completo === agBase.cliente);

    setDadosCaixa({
      clienteNome: agBase.cliente,
      clienteTelefone: clienteRef?.telefone_whatsapp || null,
      clienteId: clienteRef?.id || null,
      clienteCpf: clienteRef?.cpf || null,
      horaInicio: agsDoCliente[0]?.inicio?.slice(0, 5) || '',
      dataAgendamento: agsDoCliente[0]?.data || agBase.data || '',
      servicos: servicosMapeados,
      total: totalComAbatimento,
      recebido: 0,
      falta: Math.max(0, totalComAbatimento),
      pagamentos: { pix: 0, credito: 0, debito: 0, dinheiro: 0, cheque: 0, prePago: 0, sinalOnline: totalSinalPago },
      deixarComoDivida: false,
      deixarComoGorjeta: false,
      comentario: totalSinalPago > 0 ? `Sinal total de ${brl(totalSinalPago)} abatido. ` : ''
    } as any);

    setModalEdicaoAberto(false);
    setModalCaixaAberto(true);
  }

  // Núcleo do fechamento (financeiro, estoque, comissões, NF) vive em
  // fechamento/executarFechamentoConta.ts para manter este hook enxuto.
  function finalizarFechamentoConta(bandeiras?: { bandeira_credito?: string; bandeira_debito?: string }) {
    return executarFechamentoConta({
      perfil, dadosCaixa, profissionaisDb, servicosDb, produtosDb, clientesDb,
      dataHojeStr, setAgendamentos, setModalCaixaAberto, bandeiras,
    });
  }

  return {
    modalCaixaAberto,
    setModalCaixaAberto,
    dadosCaixa,
    setDadosCaixa,
    abrirFechamentoDeCaixa,
    adicionarItemAvulsoCaixa,
    finalizarFechamentoConta
  };
}
