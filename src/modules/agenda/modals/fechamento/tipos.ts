/**
 * src/modules/agenda/modals/fechamento/tipos.ts
 *
 * Constantes e funções puras do fluxo de Fechamento de Caixa — sem JSX,
 * sem 'use client'. Extraído de ModalFechamentoCaixa.tsx (que passou de
 * 900 linhas) seguindo o padrão de divisão de arquivos do Luarys.
 */
import { brl } from "@/lib/constants";

// Bandeiras por modalidade — lista definida pelo usuário (Luarys)
export const BANDEIRAS_CREDITO = [
  'American Express',
  'Elo Crédito',
  'Mastercard',
  'Visa',
];

export const BANDEIRAS_DEBITO = [
  'Elo Débito',
  'Maestro/Redeshop',
  'Visa Electron',
];

// Motor de cálculo de parcelas (projeta 30, 60, 90 dias...)
export const gerarDetalhamentoParcelas = (valorTotal: number, numParcelas: number) => {
  if (numParcelas <= 1 || valorTotal <= 0) return [];
  const parcelas = [];
  const valorBase = Math.floor((valorTotal / numParcelas) * 100) / 100;
  const resto = Number((valorTotal - (valorBase * numParcelas)).toFixed(2));

  let dataAtual = new Date();
  for (let i = 1; i <= numParcelas; i++) {
    const dataParcela = new Date(dataAtual);
    dataParcela.setMonth(dataParcela.getMonth() + i);
    if (dataParcela.getDate() !== dataAtual.getDate()) {
      dataParcela.setDate(0);
    }
    const valor = i === 1 ? valorBase + resto : valorBase;
    parcelas.push({
      parcela: i,
      valor: Number(valor.toFixed(2)),
      data: dataParcela.toISOString().split('T')[0]
    });
  }
  return parcelas;
};

/**
 * Gera o HTML do cupom não-fiscal para impressão via janela pop-up.
 * Lógica pura de montagem de string — sem React.
 */
export function gerarHtmlCupom(params: {
  dadosCaixa: any;
  dadosSalao: any;
  clienteReal: any;
  bandeiraCredito: string;
  bandeiraDebito: string;
  subtotal: number;
  totalDescontos: number;
  troco: number;
}) {
  const { dadosCaixa, dadosSalao, clienteReal, bandeiraCredito, bandeiraDebito, subtotal, totalDescontos, troco } = params;

  const telOriginal = dadosCaixa.clienteTelefone || clienteReal?.telefone_whatsapp || "";
  const telMascarado = telOriginal.length > 4 ? telOriginal.slice(0, -4) + "****" : telOriginal;

  const nomeEmpresa = dadosSalao?.nome_fantasia || dadosSalao?.razao_social || "NOSSO SALÃO";
  const razaoHtml = (dadosSalao?.razao_social && dadosSalao?.nome_fantasia) ? `<div style="font-size: 10px; margin-bottom: 4px;">${dadosSalao.razao_social}</div>` : '';
  const cnpjHtml = dadosSalao?.cnpj ? `<div>CNPJ: ${dadosSalao.cnpj}</div>` : '';
  const telEmpresaHtml = dadosSalao?.telefone ? `<div>Tel: ${dadosSalao.telefone}</div>` : '';

  return `
    <html>
      <head>
        <title>Recibo - ${nomeEmpresa}</title>
        <style>
          body { font-family: 'Courier New', Courier, monospace; margin: 0 auto; padding: 10px; font-size: 12px; color: #000; max-width: 80mm; }
          .center { text-align: center; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .flex-between { display: flex; justify-content: space-between; }
          table { width: 100%; border-collapse: collapse; }
          th, td { text-align: left; padding: 4px 0; }
          th { border-bottom: 1px dashed #000; }
          .right { text-align: right; }
        </style>
      </head>
      <body>
        <div class="center">
          <h2 style="margin: 0 0 4px;">${nomeEmpresa}</h2>
          ${razaoHtml}
          ${cnpjHtml}
          ${telEmpresaHtml}
          <br/>
          <strong>RECIBO NÃO FISCAL</strong><br/>
          <div>${new Date().toLocaleString('pt-BR')}</div>
        </div>

        <div class="divider"></div>
        <div>
          <strong>Cliente:</strong> ${dadosCaixa.clienteNome}<br/>
          ${telMascarado ? `<strong>Telefone:</strong> ${telMascarado}` : ''}
        </div>
        <div class="divider"></div>

        <table>
          <thead>
            <tr>
              <th style="width: 15%">Qtd</th>
              <th style="width: 55%">Desc</th>
              <th style="width: 30%" class="right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${dadosCaixa.servicos.map((s: any) => `
              <tr>
                <td valign="top">${s.qtd || 1}x</td>
                <td>${s.nome}</td>
                <td class="right">${brl(s.preco * (s.qtd || 1))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="divider"></div>

        <div class="flex-between"><span>Subtotal:</span><span>${brl(subtotal)}</span></div>
        ${totalDescontos > 0 ? `<div class="flex-between"><span>Descontos:</span><span>- ${brl(totalDescontos)}</span></div>` : ''}
        <div class="flex-between" style="font-weight: bold; font-size: 16px; margin-top: 8px;">
          <span>TOTAL PAGO:</span><span>${brl(dadosCaixa.total)}</span>
        </div>

        <div class="divider"></div>

        <strong style="display:block; margin-bottom: 6px;">Formas de Pagamento:</strong>
        ${dadosCaixa.pagamentos?.pix > 0 ? `<div class="flex-between"><span>PIX:</span><span>${brl(dadosCaixa.pagamentos.pix)}</span></div>` : ''}
        ${dadosCaixa.pagamentos?.credito > 0 ? `<div class="flex-between"><span>Crédito (${dadosCaixa.pagamentos.parcelas_credito || 1}x) - ${bandeiraCredito}:</span><span>${brl(dadosCaixa.pagamentos.credito)}</span></div>` : ''}
        ${dadosCaixa.pagamentos?.debito > 0 ? `<div class="flex-between"><span>Débito - ${bandeiraDebito}:</span><span>${brl(dadosCaixa.pagamentos.debito)}</span></div>` : ''}
        ${dadosCaixa.pagamentos?.dinheiro > 0 ? `<div class="flex-between"><span>Dinheiro:</span><span>${brl(dadosCaixa.pagamentos.dinheiro)}</span></div>` : ''}
        ${dadosCaixa.pagamentos?.cheque > 0 ? `<div class="flex-between"><span>Cheque:</span><span>${brl(dadosCaixa.pagamentos.cheque)}</span></div>` : ''}
        ${dadosCaixa.pagamentos?.prePago > 0 ? `<div class="flex-between"><span>Pré-Pago:</span><span>${brl(dadosCaixa.pagamentos.prePago)}</span></div>` : ''}
        ${dadosCaixa.pagamentos?.sinalOnline > 0 ? `<div class="flex-between"><span>Sinal Antecipado:</span><span>${brl(dadosCaixa.pagamentos.sinalOnline)}</span></div>` : ''}
        ${troco > 0 ? `<div class="flex-between" style="margin-top: 4px;"><span>Troco Devolvido:</span><span>${brl(troco)}</span></div>` : ''}

        <div class="divider"></div>
        <div class="center" style="margin-top: 24px; font-size: 11px;">
          <strong>Obrigado pela preferência!</strong><br/>
          Volte sempre.<br/><br/>
          --<br/>
          <em>Gerado por Luarys App</em>
        </div>
      </body>
    </html>
  `;
}
