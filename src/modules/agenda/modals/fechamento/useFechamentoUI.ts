/**
 * src/modules/agenda/modals/fechamento/useFechamentoUI.ts
 *
 * Estado de UI e handlers do Fechamento de Caixa (bandeiras, desconto,
 * impressão, finalização). Operações de itens estão em useFechamentoItens.ts.
 */
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { gerarDetalhamentoParcelas, gerarHtmlCupom } from "./tipos";
import { temPermissao } from "@/lib/permissoes";
import { useFechamentoItens } from "./useFechamentoItens";
import { verificarPinGerente } from "@/lib/verificarPinGerente";

export function useFechamentoUI({
  perfil,
  dadosCaixa,
  setDadosCaixa,
  clientesDb,
  servicosDb,
  produtosDb,
  onFinalizar,
}: any) {
  const toast = useToast();
  const [salvando, setSalvando] = useState(false);
  const [senhaDesconto, setSenhaDesconto] = useState("");
  const [descontoLiberado, setDescontoLiberado] = useState(temPermissao(perfil, 'caixa.aplicar_desconto'));

  useEffect(() => {
    setDescontoLiberado(temPermissao(perfil, 'caixa.aplicar_desconto'));
  }, [perfil]);

  const _permsProf = perfil?.permissoes || {};
  const [precoLiberado, setPrecoLiberado] = useState(
    perfil?.isDono || typeof _permsProf['caixa.alterar_preco'] !== 'boolean' || _permsProf['caixa.alterar_preco']
  );

  // FIX: precoLiberado era calculado só na montagem (useState inicial). Se o
  // modal abrisse antes do perfil terminar de carregar, o valor ficava travado.
  useEffect(() => {
    const perms = perfil?.permissoes || {};
    const liberado = !!perfil?.isDono || typeof perms['caixa.alterar_preco'] !== 'boolean' || perms['caixa.alterar_preco'];
    setPrecoLiberado(liberado);
  }, [perfil]);

  const [imprimirAoFechar, setImprimirAoFechamentoInterno] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const s = localStorage.getItem('luarys_imprimir_fechamento');
    return s === null ? true : s === 'true';
  });
  function setImprimirAoFechar(v: boolean) {
    setImprimirAoFechamentoInterno(v);
    try { localStorage.setItem('luarys_imprimir_fechamento', String(v)); } catch {}
  }

  const [bandeiraCredito, setBandeiraCredito] = useState("");
  const [bandeiraDebito, setBandeiraDebito] = useState("");
  const [maxParcelas, setMaxParcelas] = useState<number>(12);
  const [taxasCartoes, setTaxasCartoes] = useState<Record<string, any>>({});
  const [dadosSalao, setDadosSalao] = useState<any>(null);

  const [buscas, setBuscas] = useState<Record<string, { item: string; prof: string }>>({});
  const [dropdownAtivo, setDropdownAtivo] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function buscarConfiguracoes() {
      if (!perfil?.salao_id) return;
      try {
        const { data: taxas } = await supabase
          .from('config_taxas').select('max_parcelas, taxas_cartoes')
          .eq('salao_id', perfil.salao_id).maybeSingle();
        if (taxas?.max_parcelas) setMaxParcelas(taxas.max_parcelas);
        if (taxas?.taxas_cartoes) setTaxasCartoes(taxas.taxas_cartoes);

        const { data: salao } = await supabase
          .from('saloes').select('nome_fantasia, razao_social, cnpj, telefone')
          .eq('id', perfil.salao_id).maybeSingle();
        if (salao) setDadosSalao(salao);
      } catch {}
    }
    buscarConfiguracoes();
  }, [perfil?.salao_id]);

  useEffect(() => {
    async function checarSinalPortal() {
      if (!dadosCaixa.agendamentoId) return;
      try {
        const { data } = await supabase
          .from('agendamentos').select('valor_sinal')
          .eq('id', dadosCaixa.agendamentoId).maybeSingle();

        if (data && data.valor_sinal > 0) {
          setDadosCaixa((prev: any) => {
            if (prev.pagamentos?.sinalOnline === data.valor_sinal) return prev;
            const novaLista = prev.servicos.map((s: any) =>
              s.desconto === data.valor_sinal ? { ...s, desconto: 0 } : s
            );
            const p = { ...prev.pagamentos, sinalOnline: data.valor_sinal };
            const novoTotal = novaLista.reduce((acc: number, s: any) =>
              acc + ((s.preco * (s.qtd || 1)) - (s.desconto || 0)), 0
            );
            const recebido = (p.pix||0) + (p.credito||0) + (p.debito||0) + (p.dinheiro||0) +
              (p.cheque||0) + (p.prePago||0) + p.sinalOnline + (p.pontosFidelidade||0);
            return {
              ...prev,
              servicos: novaLista,
              pagamentos: p,
              total: novoTotal,
              recebido,
              falta: Math.max(0, novoTotal - recebido),
              comentario: (prev.comentario || '').replace(/Sinal de R\$.*?abatido\.\s?/g, '')
            };
          });
        }
      } catch {}
    }
    checarSinalPortal();
  }, [dadosCaixa.agendamentoId]);

  useEffect(() => {
    setBuscas(prev => {
      const novo = { ...prev };
      dadosCaixa.servicos.forEach((item: any) => {
        if (!novo[item.id_linha || item.id]) novo[item.id_linha || item.id] = { item: '', prof: '' };
      });
      return novo;
    });
  }, [dadosCaixa.servicos.length]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownAtivo(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const clienteReal = clientesDb.find((c: any) => c.nome_completo === dadosCaixa.clienteNome);

  const itens = useFechamentoItens({
    perfil, dadosCaixa, setDadosCaixa, servicosDb,
    setBuscas, setDropdownAtivo, descontoLiberado, precoLiberado, toast,
  });

  const handlePagamento = (campo: string, valorStr: string) => {
    let valorNum = parseFloat(valorStr.replace(',', '.'));
    if (isNaN(valorNum)) valorNum = 0;
    setDadosCaixa((prev: any) => {
      const novosPags = { ...prev.pagamentos, [campo]: valorNum };
      if (campo === 'credito') {
        novosPags.detalhe_parcelas = gerarDetalhamentoParcelas(valorNum, novosPags.parcelas_credito || 1);
      }
      const recebido =
        (novosPags.pix||0) + (novosPags.credito||0) + (novosPags.debito||0) +
        (novosPags.dinheiro||0) + (novosPags.cheque||0) + (novosPags.prePago||0) +
        (novosPags.sinalOnline||0) + (novosPags.pontosFidelidade||0);
      return { ...prev, pagamentos: novosPags, recebido, falta: Math.max(0, prev.total - recebido) };
    });
  };

  // Preenche o campo clicado com o que falta receber, adicionando de volta
  // o valor que o próprio campo já tinha contribuído.
  const preencherComFalta = (campo: string) => {
    const valorJaNoCampo = Number(dadosCaixa.pagamentos?.[campo]) || 0;
    const valorAPreencher = dadosCaixa.falta + valorJaNoCampo;
    if (valorAPreencher <= 0) return;
    handlePagamento(campo, String(valorAPreencher));
  };

  const handleParcelasChange = (num: number) => {
    setDadosCaixa((prev: any) => ({
      ...prev,
      pagamentos: {
        ...prev.pagamentos,
        parcelas_credito: num,
        detalhe_parcelas: gerarDetalhamentoParcelas(prev.pagamentos.credito || 0, num)
      }
    }));
  };

  const handleDataParcelaChange = (index: number, novaData: string) => {
    setDadosCaixa((prev: any) => {
      const novasParcelas = [...(prev.pagamentos.detalhe_parcelas || [])];
      if (novasParcelas[index]) novasParcelas[index].data = novaData;
      return { ...prev, pagamentos: { ...prev.pagamentos, detalhe_parcelas: novasParcelas } };
    });
  };

  const validarSenha = async () => {
    const { valido, erro } = await verificarPinGerente(perfil?.salao_id, senhaDesconto);
    if (erro) { toast.erro(erro); return; }
    if (valido) {
      setDescontoLiberado(true);
      setPrecoLiberado(true);
      toast.sucesso('Descontos e alteração de preço liberados por este atendimento.');
    } else {
      toast.erro('PIN incorreto. Tente novamente.');
    }
  };

  const imprimirCupom = (subtotal: number, totalDescontos: number, troco: number) => {
    const htmlCupom = gerarHtmlCupom({
      dadosCaixa, dadosSalao, clienteReal, bandeiraCredito, bandeiraDebito,
      subtotal, totalDescontos, troco
    });
    const janelaImpressao = window.open('', '_blank', 'width=420,height=650');
    if (janelaImpressao) {
      janelaImpressao.document.write(htmlCupom);
      janelaImpressao.document.close();
      janelaImpressao.focus();
      setTimeout(() => { janelaImpressao.print(); }, 400);
    }
  };

  const troco = dadosCaixa.recebido > dadosCaixa.total ? dadosCaixa.recebido - dadosCaixa.total : 0;
  const podeFinalizar = dadosCaixa.recebido >= dadosCaixa.total || dadosCaixa.deixarComoDivida;
  const totalIssRetido = dadosCaixa.servicos.reduce((acc: number, s: any) => {
    if (!s.produto_id && s.fiscal?.aliquota_iss > 0) {
      return acc + (((s.preco * (s.qtd || 1)) - (s.desconto || 0)) * (s.fiscal.aliquota_iss / 100));
    }
    return acc;
  }, 0);
  const subtotal = dadosCaixa.servicos.reduce((acc: number, s: any) => acc + (s.preco * (s.qtd || 1)), 0);
  const totalDescontos = dadosCaixa.servicos.reduce((acc: number, s: any) => acc + (s.desconto || 0), 0);

  const processarFechamento = async () => {
    if (dadosCaixa.falta > 0 && !dadosCaixa.deixarComoDivida) {
      toast.aviso("O valor recebido é menor que o total. Marque \"Deixar como fiado\" se necessário.");
      return;
    }
    if (dadosCaixa.pagamentos?.credito > 0 && !bandeiraCredito) {
      toast.aviso('Selecione a bandeira do Cartão de Crédito para continuar.');
      return;
    }
    if (dadosCaixa.pagamentos?.debito > 0 && !bandeiraDebito) {
      toast.aviso('Selecione a bandeira do Cartão de Débito para continuar.');
      return;
    }

    setSalvando(true);
    try {
      const idFinanceiro = await onFinalizar({
        bandeira_credito: bandeiraCredito,
        bandeira_debito:  bandeiraDebito,
      });
      if (imprimirAoFechar) {
        if (idFinanceiro) {
          window.open(`/recibo/${idFinanceiro}`, '_blank');
        } else {
          imprimirCupom(subtotal, totalDescontos, troco);
        }
      }
    } catch (error: any) {
      if (process.env.NODE_ENV === 'development') console.error(error);
      toast.erro('Erro ao processar o fechamento: ' + error.message);
    } finally {
      setSalvando(false);
    }
  };

  return {
    salvando, senhaDesconto, setSenhaDesconto, descontoLiberado, precoLiberado,
    imprimirAoFechar, setImprimirAoFechar,
    bandeiraCredito, setBandeiraCredito, bandeiraDebito, setBandeiraDebito,
    maxParcelas, taxasCartoes,
    buscas, setBuscas, dropdownAtivo, setDropdownAtivo, dropdownRef,
    clienteReal,
    ...itens,
    handlePagamento, preencherComFalta, handleParcelasChange, handleDataParcelaChange,
    validarSenha,
    troco, podeFinalizar, totalIssRetido, subtotal, totalDescontos,
    processarFechamento,
  };
}
