/**
 * executarFechamentoConta.ts
 *
 * Núcleo do Fechamento de Conta, extraído de useFechamentoCaixa para manter o
 * hook abaixo de 400 linhas. Grava financeiro + estoque + comissões +
 * finalização via RPC atômica `fechar_conta_atomico`, emite NFS-e/NFC-e conforme
 * o tipo da venda e atualiza cliente/fidelidade.
 */
import { supabase } from "@/lib/supabase";
import { brl } from "@/lib/constants";
import { COR_POR_STATUS } from "@/lib/agendaUtils";
import { toast } from "@/components/Toast";
import { calcularItensFechamento } from "./calcularItensFechamento";
import { construirPayloadNfceBalcao } from "@/lib/nfce/payloadBalcao";
import { carregarAssinaturaCtx } from "./carregarAssinaturaCtx";

interface Ctx {
  perfil: any;
  dadosCaixa: any;
  profissionaisDb: any[];
  servicosDb: any[];
  produtosDb: any[];
  clientesDb: any[];
  dataHojeStr: string;
  setAgendamentos: (fn: any) => void;
  setModalCaixaAberto: (v: boolean) => void;
  bandeiras?: { bandeira_credito?: string; bandeira_debito?: string };
}

export async function executarFechamentoConta(ctx: Ctx): Promise<string | null> {
  const {
    perfil, dadosCaixa, profissionaisDb, servicosDb, produtosDb, clientesDb,
    dataHojeStr, setAgendamentos, setModalCaixaAberto, bandeiras,
  } = ctx;
  try {
    const pags = dadosCaixa.pagamentos;
    // Quando nada foi pago pelos 4 métodos principais (conta fiada, ou coberta por
    // sinal/assinatura), NÃO rotula como 'PIX' — usa 'Outros' (neutro no relatório
    // de Fluxo por Forma de Pagamento).
    const somaPagamentos = (pags.pix || 0) + (pags.credito || 0) + (pags.debito || 0) + (pags.dinheiro || 0);
    const formaFin = somaPagamentos <= 0 ? 'Outros'
      : pags.pix >= pags.credito && pags.pix >= pags.debito && pags.pix >= pags.dinheiro ? 'PIX'
      : pags.credito >= pags.debito && pags.credito >= pags.dinheiro ? 'Cartão Crédito'
      : pags.debito >= pags.dinheiro ? 'Cartão Débito'
      : 'DINHEIRO';

    // ── FASE 1: calcular TUDO (sem nenhum insert ainda) ─────────────────
    // Bandeiras vêm do parâmetro (estado React ainda não atualiza antes do await)
    const pagsAny = pags as any;
    const bandeiraCaixa =
      formaFin.includes('Crédito') ? (bandeiras?.bandeira_credito || pagsAny.bandeira_credito || null) :
      formaFin.includes('Débito')  ? (bandeiras?.bandeira_debito  || pagsAny.bandeira_debito  || null) :
      null;

    const idsServicos = dadosCaixa.servicos.filter((s: any) => s.tipo !== 'produto').map((s: any) => s.item_id || s.id);
    let fichasTecnicas: any[] = [];
    if (idsServicos.length > 0) {
      const { data: fichas } = await supabase
        .from('ficha_tecnica')
        .select('servico_id, produto_id, quantidade, produtos(custo_medio)')
        .in('servico_id', idsServicos);
      if (fichas) fichasTecnicas = fichas;
    }

    // Configurações de dedução de custo e taxa de operadora (regras das Configurações)
    const [resSalaoConf, resConfTaxas] = await Promise.allSettled([
      supabase.from('saloes')
        .select('config_comissao_custo_op, config_comissao_taxa_op_modo, config_comissao_taxa_op_percentual, config_fiscal')
        .eq('id', perfil.salao_id).maybeSingle(),
      supabase.from('config_taxas')
        .select('taxas_cartoes, taxa_pix')
        .eq('salao_id', perfil.salao_id).maybeSingle(),
    ]);
    const salaoConf = resSalaoConf.status === 'fulfilled' ? resSalaoConf.value.data : null;
    const confTaxas = resConfTaxas.status === 'fulfilled' ? resConfTaxas.value.data : null;
    const modoDescontoCusto: string = salaoConf?.config_comissao_custo_op || 'nao_descontar';
    const modoTaxaOp: string       = salaoConf?.config_comissao_taxa_op_modo || 'nao_descontar';
    const percTaxaOpCustom: number  = Number(salaoConf?.config_comissao_taxa_op_percentual) || 0;
    const taxasCartoes: any         = confTaxas?.taxas_cartoes || {};
    const taxaPixRate: number       = Number(confTaxas?.taxa_pix) || 0;

    // Média das taxas configuradas de um campo (ex: 'debito', 'cred_1'), usada como
    // fallback quando a bandeira do pagamento não tem taxa própria. Evita chutar
    // 'Visa' — que pode ser só crédito (o débito costuma ser outra bandeira, ex:
    // Visa Electron). Mesma lógica do useTaxasConfig.
    const mediaTaxa = (campo: string): number => {
      const vals = Object.values(taxasCartoes)
        .map((b: any) => parseFloat(b?.[campo] || '0') || 0)
        .filter((t: number) => t > 0);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    };

    // Taxa da operadora aplicável ao pagamento desta conta
    let taxaOperadoraPercent = 0;
    if (modoTaxaOp !== 'nao_descontar') {
      if (formaFin.includes('Crédito')) {
        const parcelas = (dadosCaixa.pagamentos as any).parcelas_credito || 1;
        taxaOperadoraPercent = Number(taxasCartoes[bandeiraCaixa || '']?.[`cred_${parcelas}`]) || mediaTaxa(`cred_${parcelas}`);
      } else if (formaFin.includes('Débito')) {
        taxaOperadoraPercent = Number(taxasCartoes[bandeiraCaixa || '']?.debito) || mediaTaxa('debito');
      } else if (formaFin === 'PIX') {
        taxaOperadoraPercent = taxaPixRate;
      }
    }

    // IDs de agendamentos vinculados (usado em financeiro e no update final)
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const agendamentosVinculados = dadosCaixa.servicos
      .map((s: any) => s.agendamento_id)
      .filter((id: any) => typeof id === 'string' && UUID_RE.test(id));

    const { data: osGerado } = await supabase.rpc('gerar_numero_os', { p_salao_id: perfil.salao_id });
    const osNumero: string | null = osGerado || null;

    const valorFechamento = dadosCaixa.total
      - ((dadosCaixa.pagamentos as any)?.sinalOnline || 0)
      - ((dadosCaixa.pagamentos as any)?.pontosFidelidade || 0);

    const ehFiado = !!dadosCaixa.deixarComoDivida && dadosCaixa.falta > 0;
    const valorRecebidoAgora = Math.max(0, valorFechamento - (dadosCaixa.falta || 0));
    const comentarioBase = dadosCaixa.comentario
      ? `${dadosCaixa.comentario} | Fechado por: ${perfil?.nome || 'Sistema'}`
      : `Fechado por: ${perfil?.nome || 'Sistema'} em ${new Date().toLocaleString('pt-BR')}`;
    const comentarioFiado = ehFiado
      ? `${comentarioBase} | FIADO: ${brl(dadosCaixa.falta)} em aberto${valorRecebidoAgora > 0 ? ` (${brl(valorRecebidoAgora)} já recebido)` : ''}`
      : comentarioBase;

    const totalDescontoCaixa = (dadosCaixa.servicos as any[])
      .reduce((s: number, srv: any) => s + (Number(srv.desconto) || 0), 0);

    // Assinaturas ativas do cliente → aplicar serviços inclusos do Clube.
    const assinaturaCtx = await carregarAssinaturaCtx(perfil.salao_id, dadosCaixa.clienteId || null);

    // Cálculo puro (comissões, estoque, finalizações + serviços cobertos por assinatura).
    const calc = calcularItensFechamento({
      itens: dadosCaixa.servicos as any[],
      fichasTecnicas,
      profissionaisDb,
      servicosDb,
      produtosDb,
      modoDescontoCusto,
      modoTaxaOp,
      percTaxaOpCustom,
      taxaOperadoraPercent,
      assinatura: assinaturaCtx,
    });

    // O que o cliente realmente paga: desconta os serviços cobertos pela assinatura.
    const valorAPagar = Math.max(0, valorFechamento - (calc.valorCoberto || 0));

    // Venda de balcão (PDV) só tem produtos → categoria/NF corretas para o DRE e o fiscal.
    const somenteProdutos = (dadosCaixa.servicos as any[]).length > 0
      && (dadosCaixa.servicos as any[]).every((s: any) => s.tipo === 'produto');

    // DATA DO MOVIMENTO = data do ATENDIMENTO (agendamento), não "agora". Assim, ao
    // fechar hoje uma conta de um atendimento de um mês passado (fechamento retroativo),
    // a receita conta no mês CERTO no financeiro/DRE — não no dia do fechamento.
    // Sem data de agendamento (ex.: venda de balcão pura no PDV), usa agora.
    // Meio-dia local evita virar o dia por fuso. financeiro e caixa_transacoes usam a
    // MESMA data (o dedup da Frente de Caixa casa por cliente+minuto).
    const dataMovimento = dadosCaixa.dataAgendamento
      ? new Date(`${dadosCaixa.dataAgendamento}T12:00:00`).toISOString()
      : new Date().toISOString();

    // Split REAL dos pagamentos desta venda (para o relatório detalhado por forma de
    // pagamento — igual à Trinks). Antes só existia forma_pagamento (a dominante).
    const pagamentosSplit = {
      pix:      Number(pags.pix)      || 0,
      credito:  Number(pags.credito)  || 0,
      debito:   Number(pags.debito)   || 0,
      dinheiro: Number(pags.dinheiro) || 0,
      cheque:   Number(pagsAny.cheque)   || 0,
      prePago:  Number(pagsAny.prePago)  || 0,
    };

    const financeiroRow = {
      salao_id: perfil.salao_id,
      os_numero: osNumero,
      cliente_nome: dadosCaixa.clienteNome || 'Balcão',
      descricao: `${somenteProdutos ? 'Venda de Produtos' : 'Fechamento de Conta'} - ${dadosCaixa.clienteNome || 'Balcão'}`,
      tipo: 'entrada',
      categoria: somenteProdutos ? 'Venda de Produtos' : 'Serviços Prestados',
      valor: valorAPagar,
      metodo_pagamento: formaFin,
      forma_pagamento: formaFin,
      bandeira_cartao: bandeiraCaixa,
      profissional_nome: calc.profissionalPrincipal !== 'Equipe' ? calc.profissionalPrincipal : null,
      status: ehFiado ? 'Pendente' : 'Pago',
      data_movimentacao: dataMovimento,
      agendamento_ids: agendamentosVinculados.length > 0 ? agendamentosVinculados : null,
      comentario: comentarioFiado,
      desconto: totalDescontoCaixa > 0 ? totalDescontoCaixa : null,
      pagamentos: pagamentosSplit,
    };

    // Cor do status Finalizado a partir da fonte única (sem hardcode de hex)
    const corFinalizado = COR_POR_STATUS['Finalizado'];
    const agendamentosPayload = calc.agendamentos.map(a => ({ ...a, cor: corFinalizado }));

    // ── UUID guard (regra do projeto) ────────────────────────────────────
    // Dados legados/importados podem ter ids não-uuid (ex: ficha técnica antiga com
    // produto_id "114"). Um único id inválido derruba a venda inteira no cast ::uuid
    // da RPC. Aqui filtramos/neutralizamos e avisamos qual campo veio ruim — a venda
    // fecha; o que não dá pra gravar com segurança é pulado, não trava tudo.
    const ehUuid = (v: any) => typeof v === 'string' && UUID_RE.test(v);
    const idsDescartados: any[] = [];
    const estoqueSeguro = calc.estoque.filter(e => {
      if (ehUuid(e.produto_id)) return true;
      idsDescartados.push({ campo: 'estoque.produto_id', valor: e.produto_id, motivo: e.motivo });
      return false;
    });
    const comissoesSeguras = calc.comissoes
      .filter(c => {
        if (ehUuid(c.profissional_id) && ehUuid(c.id_prof)) return true;
        idsDescartados.push({ campo: 'comissao.profissional_id', valor: c.profissional_id, servico: c.servico_nome });
        return false;
      })
      .map(c => ({ ...c, agendamento_id: ehUuid(c.agendamento_id) ? c.agendamento_id : null }));
    const agendamentosSeguros = agendamentosPayload.filter(a => {
      if (ehUuid(a.id)) return true;
      idsDescartados.push({ campo: 'agendamento.id', valor: a.id });
      return false;
    });
    if (idsDescartados.length > 0 && process.env.NODE_ENV === 'development') {
      console.warn('Fechamento: ids não-uuid descartados (dados legados) →', idsDescartados);
    }

    let idLancamentoFinanceiro: string | null = null;
    const valorTotalComissoes = calc.valorTotalComissoes;
    const profissionalPrincipal = calc.profissionalPrincipal;

    // ── FASE 2+3 ATÔMICAS: financeiro + estoque + comissões + finalização ─
    // Tudo numa única transação no Postgres. Se qualquer passo falhar, nada é
    // gravado — sem estoque órfão nem comissão sem financeiro.
    const payloadRpc = {
      salao_id: perfil.salao_id,
      financeiro: financeiroRow,
      comissoes: comissoesSeguras,
      estoque: estoqueSeguro,
      agendamentos: agendamentosSeguros,
    };
    const { data: rpcData, error: rpcError } = await supabase.rpc('fechar_conta_atomico', { p: payloadRpc });

    // Erro da RPC → propaga (a transação já reverteu; nada parcial foi gravado).
    if (rpcError) {
      // Em dev, despeja o payload EXATO + erro cru — o Postgres às vezes devolve
      // erro "vazio" (só code/hint), e sem ver o payload não dá pra achar a causa.
      if (process.env.NODE_ENV === 'development') {
        console.error('fechar_conta_atomico FALHOU. Erro cru:', rpcError);
        console.error('Payload enviado:', JSON.stringify(payloadRpc, null, 2));
      }
      const msg = rpcError.message || rpcError.details || rpcError.hint
        || (rpcError.code ? `código ${rpcError.code}` : '')
        || 'RPC fechar_conta_atomico retornou erro sem mensagem (veja o payload no console)';
      throw new Error(msg);
    }
    idLancamentoFinanceiro = (rpcData as any)?.financeiro_id || null;

    // Registra o consumo dos serviços inclusos da assinatura (best-effort, após a
    // gravação atômica — nunca bloqueia o fechamento).
    if (calc.consumos.length > 0) {
      try {
        const dc = new Date();
        const mesRefC = `${dc.getFullYear()}-${String(dc.getMonth() + 1).padStart(2, '0')}-01`;
        await supabase.from('consumos_assinatura').insert(
          calc.consumos.map(c => ({
            salao_id: perfil.salao_id,
            assinatura_id: c.assinatura_id,
            servico_id: c.servico_id,
            profissional_id: c.profissional_id,
            valor_cheio: c.valor_cheio,
            agendamento_id: c.agendamento_id,
            mes_referencia: mesRefC,
          }))
        );
      } catch (e: any) {
        if (process.env.NODE_ENV === 'development') console.warn('Fechamento: falha ao gravar consumo de assinatura (não bloqueia a venda):', e?.message || e);
      }
    }

    // ── FASE 4: nota fiscal de SERVIÇO (NFS-e) — não se aplica a venda só de produto,
    // que é NFC-e (fluxo próprio). Por isso pulamos quando somenteProdutos.
    if (!somenteProdutos) {
      const descServicos = (dadosCaixa.servicos as any[]).map((s: any) => s.nome).join(', ');
      const nbsPrincipal = (dadosCaixa.servicos as any[]).find((s: any) => s.nbs)?.nbs || null;

      // Dados fiscais do profissional principal (campo gDed na NFS-e).
      // Quando há múltiplos profissionais, prefere o parceiro_cnpj (dedução real na SEFAZ).
      // Limitação conhecida: notas com dois parceiros CNPJ gravam apenas o primeiro;
      // nesses casos o salão deve emitir notas separadas por profissional.
      const profPrincipalId =
        calc.comissoes.find(c => {
          const p = profissionaisDb.find((pd: any) => pd.id === c.profissional_id);
          return p?.tipo_parceiro === 'parceiro_cnpj';
        })?.profissional_id
        || calc.comissoes[0]?.profissional_id
        || null;
      const profPrincipalObj = profPrincipalId
        ? profissionaisDb.find((p: any) => p.id === profPrincipalId)
        : null;
      const cnpjProfissional: string | null = profPrincipalObj?.cnpj_mei || null;
      const tipoParceiro: string | null = profPrincipalObj?.tipo_parceiro || null;

      const { data: notaInserida, error: errNota } = await supabase.from('notas_fiscais').insert([{
        salao_id: perfil.salao_id,
        financeiro_id: idLancamentoFinanceiro,
        cliente_nome: dadosCaixa.clienteNome,
        cliente_cpf: dadosCaixa.clienteCpf || null,
        descricao_servico: descServicos,
        valor: dadosCaixa.total,
        item_lista_servico: nbsPrincipal,
        valor_cota_salao: Math.max(0, dadosCaixa.total - valorTotalComissoes),
        valor_cota_profissional: valorTotalComissoes,
        profissional_nome: valorTotalComissoes > 0 ? profissionalPrincipal : null,
        cnpj_profissional: cnpjProfissional,
        tipo_parceiro: tipoParceiro,
        data_movimentacao: dataMovimento,
        status: 'Não Emitido'
      }]).select('id').single();
      if (errNota && process.env.NODE_ENV === 'development') console.warn('Fechamento: falha ao gravar nota fiscal (não bloqueia a venda):', errNota.message);

      // Emissão automática — só dispara se o salão configurou "Automático" no painel fiscal
      const modoEmissao = salaoConf?.config_fiscal?.modo_emissao;
      if (modoEmissao === 'Automático' && notaInserida?.id) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            const respNFSe = await fetch('/api/nfse/emitir', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({ nota_ids: [notaInserida.id] }),
            });
            const jsonNFSe = await respNFSe.json();
            const resultado = jsonNFSe?.resultados?.[notaInserida.id];
            if (resultado?.status === 'Emitida') toast.sucesso('NFS-e emitida automaticamente!');
            else if (resultado?.status === 'Pendente') toast.aviso('NFS-e enviada — aguardando retorno da prefeitura.');
            else if (!respNFSe.ok) toast.aviso('Nota fiscal ficou como pendente — emita pelo painel fiscal.');
          }
        } catch {
          // falha silenciosa — nunca bloqueia o fechamento
        }
      }
    } else if (!ehFiado) {
      // Venda só de produto → NFC-e. Emite automaticamente se o dono configurou
      // "Automático" em NFC-e → Configuração Fiscal. Nunca bloqueia a venda.
      try {
        const { data: cfgNfce } = await supabase
          .from('configuracoes_nfce_produtos')
          .select('modo_emissao')
          .eq('salao_id', perfil.salao_id)
          .maybeSingle();
        if (cfgNfce?.modo_emissao === 'Automático') {
          const corpo = construirPayloadNfceBalcao(dadosCaixa);
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token && corpo.itens.length > 0) {
            const respNFCe = await fetch('/api/nfce/emitir', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify(corpo),
            });
            const jsonNFCe = await respNFCe.json();
            if (jsonNFCe?.status === 'autorizado') toast.sucesso('NFC-e emitida automaticamente!');
            else if (jsonNFCe?.status === 'processando') toast.aviso('NFC-e enviada — aguardando autorização da SEFAZ.');
            else toast.aviso('NFC-e ficou pendente — emita pelo painel NFC-e.');
          }
        }
      } catch {
        // falha silenciosa — nunca bloqueia a venda
      }
    }

    // ── FASE 5: PDV (caixa_transacoes) ───────────────────────────────────
    // Guarda cliente_id + itens de produto para o histórico de compras no CRM.
    const produtosVendidos = (dadosCaixa.servicos as any[])
      .filter((s: any) => s.tipo === 'produto')
      .map((s: any) => ({ nome: s.nome, qtd: Number(s.qtd) || 1, preco: Number(s.preco) || 0 }));
    const { error: errCaixa } = await supabase.from('caixa_transacoes').insert([{
      salao_id: perfil.salao_id,
      os_numero: osNumero,
      cliente_nome: dadosCaixa.clienteNome || 'Balcão',
      // UUID guard: cliente legado pode ter id não-uuid → não quebra a gravação do caixa.
      cliente_id: ehUuid(dadosCaixa.clienteId) ? dadosCaixa.clienteId : null,
      valor_total: valorAPagar,
      forma_pagamento: formaFin,
      bandeira_cartao: bandeiraCaixa || null,
      itens: produtosVendidos.length > 0 ? produtosVendidos : null,
      status: 'Concluído',
      data_hora: dataMovimento,
    }]);
    if (errCaixa && process.env.NODE_ENV === 'development') console.warn('Fechamento: falha ao gravar caixa_transacoes (não bloqueia a venda):', errCaixa.message);

    // Métricas do cliente (usa cliente_id direto quando disponível)
    const clienteIdDireto = dadosCaixa.clienteId || null;
    let cliente = clienteIdDireto
      ? clientesDb.find((c: any) => c.id === clienteIdDireto)
      : clientesDb.find((c: any) => c.nome_completo === dadosCaixa.clienteNome);
    // Venda de balcão (PDV) não carrega clientesDb em memória — quando há um cliente
    // do CRM vinculado, busca a linha direto no banco para registrar a compra no
    // histórico dele (total_gasto / última visita).
    if (!cliente && clienteIdDireto) {
      const { data: cliDb } = await supabase.from('clientes')
        .select('id, total_gasto, total_visitas').eq('id', clienteIdDireto).maybeSingle();
      if (cliDb) cliente = cliDb;
    }
    if (cliente) {
      // Soma o MESMO valor gravado no financeiro (valorAPagar) — é o que o estorno
      // subtrai depois. Antes somava dadosCaixa.total (bruto), causando drift no
      // total_gasto quando havia sinal, pontos ou serviço coberto por assinatura.
      const { error: errCli } = await supabase.from('clientes').update({
        total_gasto: (cliente.total_gasto || 0) + valorAPagar,
        total_visitas: (cliente.total_visitas || 0) + 1,
        data_ultima_visita: dataHojeStr,
      }).eq('id', cliente.id);
      if (errCli && process.env.NODE_ENV === 'development') console.warn('Fechamento: falha ao atualizar métricas do cliente (não bloqueia a venda):', errCli.message);

      // Creditar pontos de fidelidade — falha silenciosa para nunca bloquear o fechamento
      try {
        const { data: fidConf } = await supabase
          .from('fidelidade_config')
          .select('ativo, pontos_por_real')
          .eq('salao_id', perfil.salao_id)
          .maybeSingle();
        if (fidConf?.ativo && Number(fidConf.pontos_por_real) > 0 && dadosCaixa.total > 0) {
          const pontos = Math.floor(dadosCaixa.total * Number(fidConf.pontos_por_real));
          if (pontos > 0) {
            await supabase.from('fidelidade_transacoes').insert({
              salao_id: perfil.salao_id,
              cliente_id: cliente.id,
              tipo: 'ganho',
              pontos,
              descricao: `Atendimento - OS ${osNumero || new Date().toLocaleDateString('pt-BR')}`,
            });
          }
        }
      } catch (e: any) {
        if (process.env.NODE_ENV === 'development') console.warn('Fechamento: falha ao creditar fidelidade (não bloqueia a venda):', e?.message || e);
      }

      // Debitar pontos usados como desconto no fechamento
      const pontosQtd = (dadosCaixa as any).pontosFidelidadeQtd || 0;
      if (pontosQtd > 0) {
        try {
          await supabase.rpc('resgatar_credito_fidelidade', {
            p_salao_id:   perfil.salao_id,
            p_cliente_id: cliente.id,
            p_pontos:     pontosQtd,
          });
        } catch { /* silencioso — nunca bloqueia o fechamento */ }
      }
    }

    // Atualiza status no banco (evita re-abertura do caixa se a página for recarregada)
    if (agendamentosVinculados.length > 0) {
      await supabase.from('agendamentos')
        .update({ status: 'Finalizado' })
        .in('id', agendamentosVinculados);
    }
    // Reflete imediatamente na grade visual sem esperar re-fetch
    setAgendamentos((prev: any) => prev.map((ag: any) =>
      agendamentosVinculados.includes(String(ag.id)) ? { ...ag, status: 'Finalizado', cor: COR_POR_STATUS['Finalizado'] } : ag
    ));

    toast.sucesso('Conta fechada! Comissões e estoque atualizados com sucesso.');
    setModalCaixaAberto(false);
    return idLancamentoFinanceiro || null;
  } catch (error: any) {
    let textoDoErro = error?.message || error?.details || error?.hint || error?.code || '';
    if (!textoDoErro) {
      try { textoDoErro = JSON.stringify(error); } catch { textoDoErro = String(error); }
    }
    if (!textoDoErro || textoDoErro === '{}') textoDoErro = 'Erro desconhecido (objeto vazio) — veja o console';
    // Mensagem PRIMEIRO no console, para o overlay do Next não colapsar num "{}".
    if (process.env.NODE_ENV === 'development') console.error('Erro ao fechar conta →', textoDoErro, '\nErro cru:', error);
    toast.erro("Erro ao fechar conta: " + textoDoErro);
    return null;
  }
}
