/**
 * POST /api/assinatura/contratar-com-cartao-salvo
 *
 * Contrata plano ou módulo usando o cartão que o salão já cadastrou, sem passar
 * pelo checkout de novo.
 *
 * Só existe porque o Asaas não compartilha cartão entre assinaturas do mesmo
 * cliente: sem isto, o salão que já paga o plano precisa digitar o cartão outra
 * vez para cada módulo. O `creditCardToken` resolve — e não é dado de cartão,
 * é referência opaca, então o número continua só com eles.
 *
 * Exige `confirmo: true` E a senha de quem está logado, conferida AQUI no
 * servidor. Confirmação só no navegador não vale para autorizar cobrança —
 * cliente modificado pula a checagem, e o que sobra é uma cobrança sem aceite
 * demonstrável. A senha nunca é gravada nem registrada em log.
 *
 * Só dono, admin e gerente podem contratar: é dinheiro da empresa, e quem
 * atende no balcão não deveria conseguir assinar módulo.
 *
 * Body: { modulo_chave, periodo?, confirmo: true, senha: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { autenticarRota } from '@/lib/apiAuth';
import { cartaoSalvoDoSalao, ehPlanoBase, registrarPagamentoAssinatura } from '@/lib/assinaturas';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { user, perfil, erro } = await autenticarRota(req, 'POST /api/assinatura/contratar-com-cartao-salvo');
  if (erro) return erro;

  const { modulo_chave, periodo = 'mensal', confirmo, senha, cartao_ultimos4 } = await req.json().catch(() => ({}));
  if (!modulo_chave) return NextResponse.json({ erro: 'modulo_chave obrigatório.' }, { status: 400 });
  if (confirmo !== true) {
    return NextResponse.json({ erro: 'Confirme a cobrança antes de prosseguir.' }, { status: 428 });
  }
  if (!senha || typeof senha !== 'string') {
    return NextResponse.json({ erro: 'Digite sua senha para autorizar a cobrança.' }, { status: 401 });
  }

  const salaoId = perfil!.salao_id;

  // ── Só quem responde pela conta ────────────────────────────────────────────
  // O cargo é lido AQUI, não de `perfil`: autenticarRota seleciona apenas
  // `salao_id` (ver o comentário dele sobre a coluna `role` inexistente). Ler
  // o cargo de lá devolvia sempre undefined e reprovava todo mundo — inclusive
  // o dono. Os dois campos existem na tabela e valem: `regra` guarda 'dono',
  // `nivel_acesso` guarda 'admin'.
  const NIVEIS = ['dono', 'admin', 'gerente'];
  const { data: cargo } = await supabaseAdmin
    .from('perfis_usuarios')
    .select('regra, nivel_acesso')
    .eq('id', user!.id)
    .maybeSingle();
  const ehGestao = NIVEIS.includes(String(cargo?.nivel_acesso ?? '').toLowerCase())
                || NIVEIS.includes(String(cargo?.regra ?? '').toLowerCase());
  if (!ehGestao) {
    return NextResponse.json({
      erro: 'Apenas o dono ou o gerente pode contratar módulos.',
    }, { status: 403 });
  }

  // ── Senha conferida no servidor ────────────────────────────────────────────
  // signInWithPassword com a chave anônima valida a credencial sem tocar na
  // sessão em uso: o token que volta é descartado aqui mesmo. O e-mail vem do
  // usuário autenticado, nunca do corpo — senão daria para validar a senha de
  // uma conta e cobrar na de outra.
  if (!user?.email) {
    return NextResponse.json({ erro: 'Sessão sem e-mail. Entre novamente.' }, { status: 401 });
  }

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error: erroSenha } = await anon.auth.signInWithPassword({
    email: user.email,
    password: senha,
  });
  // signInWithPassword emite um refresh token de verdade. Sem encerrar, cada
  // compra deixava uma sessao viva no Supabase para sempre — so para conferir
  // uma senha.
  //
  // `scope: 'local'` NAO e detalhe: o padrao do signOut e 'global', que revoga
  // TODAS as sessoes do usuario. Sem o escopo, conferir a senha aqui derrubava
  // o login do proprio dono no navegador, e a compra seguinte voltava "Sessao
  // invalida". Aqui so a sessao recem-criada precisa morrer.
  await anon.auth.signOut({ scope: 'local' }).catch(() => {});
  if (erroSenha) {
    console.warn(`[cartao-salvo] senha incorreta ao contratar ${modulo_chave} — salão ${salaoId}`);
    return NextResponse.json({ erro: 'Senha incorreta. Nada foi cobrado.' }, { status: 401 });
  }
  const ehPlano = await ehPlanoBase(modulo_chave);
  const tabela = ehPlano ? 'saloes' : 'salao_modulos';
  const filtro = ehPlano ? { id: salaoId } : { salao_id: salaoId, modulo_chave };

  // Mesma trava do checkout normal: sem isto, clique duplo cria duas
  // subscriptions e a antiga cobra para sempre sem ninguém conseguir cancelar,
  // porque só guardamos um id.
  const { data: existente } = await supabaseAdmin
    .from(tabela).select('asaas_subscription_id').match(filtro).maybeSingle();
  if (existente?.asaas_subscription_id) {
    return NextResponse.json({ erro: 'Já existe assinatura ativa para este item.' }, { status: 409 });
  }

  const cartao = await cartaoSalvoDoSalao(salaoId);
  if (!cartao) {
    return NextResponse.json({ erro: 'Nenhum cartão salvo. Use o fluxo normal de contratação.' }, { status: 409 });
  }

  // O aceite foi dado para UM cartao — o que apareceu na caixa de confirmacao.
  // Com mais de um cartao no salao, uma assinatura cancelada noutra aba entre a
  // abertura da caixa e o "confirmar" mudaria qual vem primeiro, e a cobranca
  // sairia num cartao que o dono nao autorizou.
  if (cartao_ultimos4 && String(cartao_ultimos4) !== cartao.ultimos4) {
    return NextResponse.json({
      erro: 'O cartão mudou desde que você abriu a confirmação. Feche e tente de novo para conferir qual será cobrado.',
    }, { status: 409 });
  }

  // Preço vem do catálogo, nunca do cliente: aceitar valor do corpo deixaria
  // qualquer um assinar o que quisesse pelo preço que quisesse.
  const { data: item } = await supabaseAdmin
    .from(ehPlano ? 'planos' : 'modulos_catalogo')
    .select('nome, preco_mensal, preco_anual')
    .eq('chave', modulo_chave).maybeSingle();
  const valor = periodo === 'anual' ? item?.preco_anual : item?.preco_mensal;
  if (!item || !valor || Number(valor) <= 0) {
    return NextResponse.json({ erro: 'Item sem preço configurado.' }, { status: 422 });
  }

  const { data: conta } = await supabaseAdmin
    .from('plataforma_contas_recebimento')
    .select('asaas_api_key, asaas_environment').eq('ativa', true).maybeSingle();
  const chaveApi = conta?.asaas_api_key || process.env.ASAAS_API_KEY;
  if (!chaveApi) return NextResponse.json({ erro: 'Gateway não configurado.' }, { status: 500 });

  const base = (conta?.asaas_environment || process.env.ASAAS_ENVIRONMENT || 'production') === 'sandbox'
    ? 'https://sandbox.asaas.com/api/v3'
    : 'https://api.asaas.com/v3';
  const cab = { access_token: chaveApi, 'Content-Type': 'application/json' };

  const { data: salao } = await supabaseAdmin
    .from('saloes').select('email_contato, cnpj').eq('id', salaoId).maybeSingle();

  // Sem e-mail NÃO se pesquisa. `?email=` vazio faz o Asaas ignorar o filtro e
  // devolver a lista inteira de clientes — o `data[0]` seria outro salão, e a
  // cobrança sairia na conta dele. Confirmado contra a API em 07/08/2026. O
  // criar-checkout já tinha essa guarda; esta rota tinha nascido sem.
  const emailSalao = String(salao?.email_contato ?? '').trim();
  if (!emailSalao) {
    return NextResponse.json({
      erro: 'O salão está sem e-mail de contato cadastrado. Preencha em Configurações antes de contratar.',
    }, { status: 409 });
  }

  const busca = await fetch(`${base}/customers?email=${encodeURIComponent(emailSalao)}`, { headers: cab });
  const achados = (await busca.json().catch(() => ({})))?.data ?? [];

  // Confere que o cliente devolvido é mesmo deste salão. O filtro por e-mail é
  // do lado deles: se mudar de comportamento, ou se dois salões dividirem um
  // e-mail, o CNPJ desempata em vez de a cobrança cair no primeiro da lista.
  const soDigitos = (v: any) => String(v ?? '').replace(/\D/g, '');
  const cnpjSalao = soDigitos(salao?.cnpj);
  const cliente = achados.find((c: any) =>
    String(c?.email ?? '').trim().toLowerCase() === emailSalao.toLowerCase()
    && (!cnpjSalao || !c?.cpfCnpj || soDigitos(c.cpfCnpj) === cnpjSalao));
  const clienteId = cliente?.id;
  if (!clienteId) {
    return NextResponse.json({
      erro: 'Cliente não encontrado no gateway com o e-mail e o CNPJ deste salão. Use o fluxo normal de contratação.',
    }, { status: 409 });
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const referencia = `${salaoId}::${modulo_chave}::${periodo}`;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0';

  const respSub = await fetch(`${base}/subscriptions`, {
    method: 'POST', headers: cab,
    body: JSON.stringify({
      customer: clienteId,
      billingType: 'CREDIT_CARD',
      cycle: periodo === 'anual' ? 'YEARLY' : 'MONTHLY',
      value: Math.round(Number(valor) * 100) / 100,
      nextDueDate: hoje,
      description: item.nome,
      externalReference: referencia,
      creditCardToken: cartao.token,
      remoteIp: ip,
    }),
  });
  const sub = await respSub.json().catch(() => ({}));
  if (!respSub.ok || !sub?.id) {
    return NextResponse.json({ erro: 'Falha ao criar a assinatura: ' + (sub?.errors?.[0]?.description || 'erro desconhecido') }, { status: 502 });
  }

  /**
   * Desfaz o que der para desfazer — e nunca afirma "nada foi cobrado" sem
   * antes perguntar ao Asaas.
   *
   * Cancelar a assinatura NÃO estorna cobrança já confirmada. A versão anterior
   * só fazia o DELETE e devolvia "nada foi cobrado": se a cobrança tivesse
   * passado e a resposta viesse ilegível ou fora de tempo, o salão pagava e
   * lia que não tinha pago. Agora, cobrança confirmada é estornada de verdade,
   * e se o estorno falhar a mensagem diz a verdade em vez de tranquilizar.
   */
  const desfazer = async (faturaId?: string): Promise<{ estornado: boolean; cobrancaPresa: boolean }> => {
    let estornado = false;
    let cobrancaPresa = false;

    if (faturaId) {
      try {
        const atual = await (await fetch(`${base}/payments/${faturaId}`, { headers: cab })).json();
        if (['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(String(atual?.status))) {
          const r = await fetch(`${base}/payments/${faturaId}/refund`, {
            method: 'POST', headers: cab,
            body: JSON.stringify({ description: 'Contratacao nao concluida' }),
          });
          const j = await r.json().catch(() => ({}));
          estornado = r.ok && String(j?.status) === 'REFUNDED';
          cobrancaPresa = !estornado;
          if (!estornado) {
            console.error(`[cartao-salvo] COBRANCA CONFIRMADA SEM ESTORNO — salão ${salaoId} · fatura ${faturaId} · ${j?.errors?.[0]?.description ?? r.status}`);
          }
        }
      } catch (e: any) {
        // Não sabemos o estado: tratar como presa é o lado seguro do erro.
        cobrancaPresa = true;
        console.error(`[cartao-salvo] falha ao conferir/estornar fatura ${faturaId} — salão ${salaoId}: ${e?.message}`);
      }
    }

    await fetch(`${base}/subscriptions/${sub.id}`, { method: 'DELETE', headers: cab }).catch(() => {});
    return { estornado, cobrancaPresa };
  };

  const faturas = await (await fetch(`${base}/payments?subscription=${sub.id}`, { headers: cab })).json().catch(() => ({}));
  const faturaId = faturas?.data?.[0]?.id;
  if (!faturaId) {
    await desfazer();
    return NextResponse.json({ erro: 'A assinatura não gerou cobrança. Nada foi alterado.' }, { status: 502 });
  }

  // Segunda trava de duplicidade, agora do lado do Asaas. A primeira olha o
  // nosso banco, e entre ela e este ponto cabe um clique duplo: as duas
  // requisicoes leriam "sem assinatura" e criariam duas. O externalReference e
  // o mesmo para o par salao+modulo+periodo, entao serve de chave de
  // idempotencia — se ja existe outra, a nossa e a sobrando e volta atras.
  const irmas = await (await fetch(
    `${base}/subscriptions?externalReference=${encodeURIComponent(referencia)}`, { headers: cab },
  )).json().catch(() => ({}));
  const outras = (irmas?.data ?? []).filter((x: any) => x?.id && x.id !== sub.id
    && String(x?.status ?? '').toUpperCase() !== 'INACTIVE');
  if (outras.length) {
    const r = await desfazer(faturaId);
    console.warn(`[cartao-salvo] assinatura duplicada evitada — salão ${salaoId} · ${modulo_chave} · ja existia ${outras[0].id}`);
    return NextResponse.json({
      erro: r.cobrancaPresa
        ? 'Já existe assinatura para este item e a cobrança desta tentativa não pôde ser estornada automaticamente. Fale com o suporte.'
        : 'Já existe assinatura ativa para este item. Nada foi cobrado.',
    }, { status: 409 });
  }

  // Cobrar na hora, mas SÓ se ainda não estiver cobrada.
  //
  // Criar a assinatura com `creditCardToken` e vencimento hoje faz o Asaas
  // cobrar sozinho — a fatura já nasce CONFIRMED. Chamar payWithCreditCard em
  // cima disso devolve "Cobrança já confirmada", que a versão anterior lia como
  // cartão recusado e usava para cancelar a assinatura. Ou seja: o salão era
  // cobrado, perdia a assinatura e via "nada foi cobrado" na tela. Descoberto
  // no teste em sandbox, antes de ir para produção.
  const statusInicial = String(faturas?.data?.[0]?.status ?? '');
  const jaCobrada = ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(statusInicial);

  const pago = jaCobrada
    ? faturas.data[0]
    : await (await fetch(`${base}/payments/${faturaId}/payWithCreditCard`, {
        method: 'POST', headers: cab,
        body: JSON.stringify({ creditCardToken: cartao.token, remoteIp: ip }),
      })).json().catch(() => ({}));

  if (!['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(String(pago?.status))) {
    // Cartao recusado — ou resposta que nao deu para ler. `desfazer` confere o
    // estado real da fatura antes de qualquer afirmacao: se tiver sido cobrada,
    // estorna; se nem isso der certo, a mensagem diz que o dinheiro saiu, em vez
    // de dizer que nao saiu.
    const r = await desfazer(faturaId);
    if (r.cobrancaPresa) {
      return NextResponse.json({
        erro: 'A cobrança foi feita mas a contratação não se completou, e o estorno automático falhou. Fale com o suporte — o pagamento está registrado.',
      }, { status: 502 });
    }
    return NextResponse.json({
      erro: (pago?.errors?.[0]?.description || 'O cartão não autorizou a cobrança.')
        + (r.estornado ? ' O valor cobrado foi estornado.' : ' Nada foi cobrado.'),
    }, { status: 402 });
  }

  // A partir daqui o dinheiro JA SAIU. Se a ativacao falhar, nao se devolve erro
  // ao salao — ele pagou, e ver "falhou" o faria tentar de novo e pagar duas
  // vezes. Registra alto no log e devolve sucesso com aviso, para o suporte
  // ativar a mao.
  let ativado = true;
  try {
    await registrarPagamentoAssinatura({
      salaoId,
      moduloChave: modulo_chave,
      valor: Number(valor),
      status: 'approved',
      gateway: 'asaas',
      pagamentoExternoId: faturaId,
      periodo,
      asaasSubscriptionId: sub.id,
    });
  } catch (e: any) {
    ativado = false;
    console.error(`[cartao-salvo] PAGO MAS NAO ATIVADO — salão ${salaoId} · ${modulo_chave} · fatura ${faturaId} · assinatura ${sub.id} · ${e?.message}`);
  }

  console.warn(`[cartao-salvo] salão ${salaoId} contratou ${modulo_chave} (${periodo}) no cartão •${cartao.ultimos4} — R$ ${valor}`);

  return NextResponse.json({
    sucesso: true,
    ativado,
    aviso: ativado ? undefined : 'O pagamento foi aprovado, mas a liberação automática falhou. Nosso suporte já foi avisado — não pague de novo.',
    item: item.nome,
    valor: Number(valor),
    cartao: `${cartao.bandeira} •${cartao.ultimos4}`,
  });
}
