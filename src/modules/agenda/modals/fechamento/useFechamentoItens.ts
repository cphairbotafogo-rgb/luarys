/**
 * src/modules/agenda/modals/fechamento/useFechamentoItens.ts
 *
 * Operações de itens (serviços/produtos) no Fechamento de Caixa:
 * selecionar, atualizar, remover e criar agendamentos avulsos.
 */
import { supabase } from "@/lib/supabase";

function recalcularCaixa(prev: any, novaListaServicos: any[]) {
  const novoTotal = novaListaServicos.reduce(
    (acc, s) => acc + ((s.preco * (s.qtd || 1)) - (s.desconto || 0)), 0
  );
  const pags = prev.pagamentos;
  const recebidoAtual =
    (pags.pix || 0) + (pags.credito || 0) + (pags.debito || 0) +
    (pags.dinheiro || 0) + (pags.cheque || 0) + (pags.prePago || 0) +
    (pags.sinalOnline || 0) + (pags.pontosFidelidade || 0);
  const falta = Math.max(0, novoTotal - recebidoAtual);
  return { ...prev, servicos: novaListaServicos, total: novoTotal, falta };
}

export function useFechamentoItens({
  perfil,
  dadosCaixa,
  setDadosCaixa,
  servicosDb,
  setBuscas,
  setDropdownAtivo,
  descontoLiberado,
  precoLiberado,
  toast,
}: any) {
  const atualizarItem = (idLinha: any, campo: string, valor: any) => {
    setDadosCaixa((prev: any) => {
      const novaLista = prev.servicos.map((s: any) =>
        (s.id_linha || s.id) === idLinha ? { ...s, [campo]: valor } : s
      );
      return recalcularCaixa(prev, novaLista);
    });
  };

  const atualizarPrecoOuDesconto = (idLinha: any, campo: string, valorStr: string) => {
    let valorNum = parseFloat(valorStr.replace(',', '.'));
    if (isNaN(valorNum)) valorNum = 0;
    if (campo === 'preco' && !precoLiberado) return;
    if (campo === 'desconto' && valorNum > 0) {
      const itemAtual = dadosCaixa.servicos.find((s: any) => (s.id_linha || s.id) === idLinha);
      if (itemAtual?.isPromocional) {
        toast.aviso('Este serviço já está com preço promocional e não pode receber desconto adicional.');
        return;
      }
      if (!descontoLiberado) {
        toast.aviso('Apenas gerente ou proprietário pode aplicar descontos.');
        return;
      }
    }
    atualizarItem(idLinha, campo, valorNum);
  };

  async function criarAgendamentoParaItemAvulso(
    idLinha: any,
    servicoId: string | null,
    nomeItem: string,
    profissionalId: string,
    isProduto: boolean,
  ) {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!perfil?.salao_id || !dadosCaixa.clienteNome) return;
    // profissional_id inválido quebraria a FK — aborta silenciosamente
    if (!UUID_RE.test(String(profissionalId))) return;

    // Usa a data do agendamento sendo fechado, não hoje — fechamentos retroativos devem
    // registrar no dia correto.
    const dataAg = dadosCaixa.dataAgendamento
      || new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
    if (!dataAg) return;

    const hora = dadosCaixa.horaInicio || '09:00';
    const servicoRef = !isProduto && servicoId
      ? (servicosDb || []).find((s: any) => s.id === servicoId)
      : null;

    // new Date pode retornar Invalid Date se hora ou dataAg estiver mal-formado
    const dtObj = new Date(`${dataAg}T${hora}:00`);
    const dataHoraInicio = isNaN(dtObj.getTime()) ? new Date().toISOString() : dtObj.toISOString();

    const payload: any = {
      salao_id: perfil.salao_id,
      cliente_id: dadosCaixa.clienteId || null,
      cliente_nome: dadosCaixa.clienteNome,
      profissional_id: profissionalId,
      servico_id: isProduto ? null : (servicoId || null),
      data: dataAg,
      inicio: hora,
      duracao_min: servicoRef?.duracao_minutos || 30,
      valor_final: null,
      status: 'Agendado',
      cor: '#1E293B',
      observacao: isProduto ? `Venda: ${nomeItem}` : null,
      data_hora_inicio: dataHoraInicio,
      eh_encaixe: true,
    };

    // .maybeSingle() per padrão do projeto (CLAUDE.md); .single() falha com
    // PGRST116 quando RLS bloqueia o select de retorno após o insert.
    const { data: agInserido, error } = await supabase
      .from('agendamentos').insert(payload).select('id').maybeSingle();
    if (error) {
      // 23505 = colisão com a unique de slot. É um ENCAIXE (eh_encaixe: true) no mesmo
      // horário de outro agendamento — esperado até a unique virar parcial (excluir
      // encaixes). NÃO bloqueia a venda: o item avulso continua sendo cobrado, só não
      // vira um agendamento próprio na grade. Por isso é warn, não error.
      if (process.env.NODE_ENV === 'development') {
        console.warn('[useFechamentoItens] encaixe avulso não virou agendamento na grade (não bloqueia a venda):', error.message, '| code:', error.code);
      }
      return;
    }
    if (!agInserido) return;

    setDadosCaixa((prev: any) => ({
      ...prev,
      servicos: prev.servicos.map((s: any) =>
        (s.id_linha || s.id) === idLinha ? { ...s, agendamento_id: agInserido.id } : s
      ),
    }));
  }

  const selecionarItem = (idItem: any, opcao: any, isProduto: boolean) => {
    const nomeExibido = isProduto ? (opcao.nome_produto || opcao.nome) : (opcao.nome_servico || opcao.nome);
    const isPromocional = !isProduto && Number(opcao.preco_promocional) > 0;
    const preco = isProduto
      ? (opcao.preco_venda || 0)
      : (isPromocional ? opcao.preco_promocional : (opcao.preco_padrao || opcao.preco || 0));

    const itemAtual = dadosCaixa.servicos.find((s: any) => (s.id_linha || s.id) === idItem);
    const isAvulso = !itemAtual?.agendamento_id;
    const jaTemProfissional = !!itemAtual?.profissional_id;

    setDadosCaixa((prev: any) => {
      const novaLista = prev.servicos.map((s: any) => {
        if ((s.id_linha || s.id) !== idItem) return s;
        return {
          ...s,
          nome: nomeExibido,
          preco,
          desconto: isPromocional ? 0 : (s.desconto || 0),
          isPromocional,
          produto_id: isProduto ? opcao.id : null,
          item_id: opcao.id,
          fiscal: isProduto ? {
            cprod: opcao.codigo_sku || String(opcao.id).substring(0, 8),
            xprod: opcao.nome_produto,
            ncm: opcao.ncm || '',
            cfop: opcao.cfop_padrao || '5102',
            csosn: opcao.csosn_padrao || '102',
            origem: opcao.origem || '0',
            unidade: opcao.unidade_medida || 'UN'
          } : {
            nbs: opcao.nbs || '126021000',
            codigo_municipio: opcao.codigo_municipio || '06.01',
            aliquota_iss: parseFloat(opcao.aliquota_iss) || 0,
            cfop: '5933',
            csosn: '102'
          }
        };
      });
      return recalcularCaixa(prev, novaLista);
    });

    if (isAvulso && jaTemProfissional) {
      criarAgendamentoParaItemAvulso(
        idItem, isProduto ? null : opcao.id,
        nomeExibido, itemAtual.profissional_id, isProduto
      );
    }

    setBuscas((prev: any) => ({ ...prev, [idItem]: { ...prev[idItem], item: '' } }));
    setDropdownAtivo(null);
  };

  const selecionarProfissional = (idItem: any, prof: any) => {
    const itemAtual = dadosCaixa.servicos.find((s: any) => (s.id_linha || s.id) === idItem);
    const isAvulso = !itemAtual?.agendamento_id;
    const jaTemItem = !!itemAtual?.item_id;
    const isProduto = itemAtual?.tipo === 'produto';

    setDadosCaixa((prev: any) => {
      const novaLista = prev.servicos.map((s: any) => {
        if ((s.id_linha || s.id) !== idItem) return s;
        return { ...s, profissional: prof.nome, profissional_id: prof.id };
      });
      return recalcularCaixa(prev, novaLista);
    });

    if (isAvulso && jaTemItem) {
      criarAgendamentoParaItemAvulso(
        idItem, isProduto ? null : itemAtual.item_id,
        itemAtual.nome, prof.id, isProduto
      );
    }

    setBuscas((prev: any) => ({ ...prev, [idItem]: { ...prev[idItem], prof: '' } }));
    setDropdownAtivo(null);
  };

  const removerItem = (idLinha: any) => {
    setDadosCaixa((prev: any) => {
      const novaLista = prev.servicos.filter((s: any) => (s.id_linha || s.id) !== idLinha);
      return recalcularCaixa(prev, novaLista);
    });
    setBuscas((prev: any) => { const novo = { ...prev }; delete novo[idLinha]; return novo; });
  };

  return { atualizarItem, atualizarPrecoOuDesconto, selecionarItem, selecionarProfissional, removerItem };
}
