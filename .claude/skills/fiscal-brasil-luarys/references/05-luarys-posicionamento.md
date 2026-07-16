# Luarys como integrador técnico — posicionamento (não responsável fiscal)

**Última verificação:** 01/07/2026
**Base:** síntese das referências 01-04 aplicada ao contexto contratual do Luarys. Este arquivo é apoio para redação de termos/contrato — não é parecer jurídico. Qualquer cláusula final deve passar por advogado antes de ir para produção.

## A distinção que sustenta o posicionamento

Existem três papéis distintos numa emissão de nota fiscal, e é importante que o contrato do Luarys deixe claro em qual deles o Luarys está:

1. **Emitente/responsável fiscal**: o salão (dono do CNPJ), que presta o serviço e tem a obrigação legal de emitir a nota e recolher o tributo.
2. **Provedor de emissão (Focus NFe / Brasil NFe)**: a empresa que efetivamente transmite os dados à SEFIN/SEFAZ via API e devolve o documento autorizado.
3. **Integrador técnico (Luarys)**: o sistema que coleta os dados da operação (agendamento, venda no PDV, dados do cliente) e os repassa ao provedor de emissão, sem ele mesmo transmitir para o Fisco nem deter a responsabilidade fiscal do CNPJ.

O Luarys se encaixa no papel 3. Essa distinção já é reconhecida na própria legislação: a NT sobre o **intermediário na NFS-e** trata justamente do fato de que uma "terceira parte" pode participar da operação sem ser quem presta o serviço — mas atenção: **intermediário, no sentido fiscal do termo, pode responder solidariamente pelo ISS em certas configurações**. Por isso a linguagem do contrato do Luarys precisa deixar claro que ele atua como **fornecedor de software/tecnologia**, não como intermediário da operação de prestação de serviço em si.

## Pontos que a cláusula de posicionamento deveria cobrir

1. **O Luarys não é emitente**: não detém a inscrição municipal/estadual do salão, não assina digitalmente a nota, não é parte na relação tributária entre salão e Fisco.
2. **O Luarys não calcula tributo**: no novo modelo (calculadora centralizada da RTC para IBS/CBS, cálculo de ISS pela regra municipal), o papel do sistema é enviar dados corretos — o cálculo em si é feito por infraestrutura oficial ou pelo provedor de emissão contratado pelo salão.
3. **Responsabilidade por dados cadastrais é do salão**: se o salão cadastra errado o CNAE, o código de serviço (NBS) ou a alíquota do Simples Nacional, e isso gera nota rejeitada ou autuação, a responsabilidade pela informação de origem é de quem cadastrou — o Luarys fornece a interface, não audita a veracidade fiscal do cadastro.
4. **Escolha e contratação do provedor de emissão é do salão** (ou intermediada pelo Luarys, mas com contrato direto entre salão e provedor) — evita que o Luarys vire parte na cadeia de responsabilidade solidária.
5. **Disponibilidade vs. responsabilidade fiscal são coisas diferentes**: o Luarys pode assumir SLA de disponibilidade do sistema (uptime, tempo de resposta), mas isso é uma obrigação de serviço de tecnologia — não uma garantia de conformidade fiscal do resultado.

## Por que isso importa mais agora do que antes

A Reforma Tributária trouxe mais atores para dentro da própria nota fiscal — o **Destinatário da Operação** e o **intermediário** ganharam blocos próprios no DANFSe v2.0, exatamente porque a lógica do IBS/CBS distingue papéis que antes podiam ficar implícitos. Isso significa que, tecnicamente, fica mais fácil provar quem fez o quê numa cadeia de emissão — o que é bom para o Luarys, desde que o contrato e a arquitetura de dados deixem esse papel de integrador tecnicamente visível (ex: logs de quem enviou qual payload, timestamp de cada etapa).

## Sugestão de estrutura de cláusula (rascunho para revisão jurídica)

⚠️ **O texto abaixo é rascunho de referência, não uma cláusula pronta para uso.** Antes de qualquer sessão gerar isso para um contrato real, deixe explícito que precisa passar por advogado tributarista — especialmente à luz de jurisprudência recente sobre responsabilidade solidária de plataformas de tecnologia em cadeias fiscais.

> "A CONTRATADA [Luarys] fornece plataforma de gestão que permite à CONTRATANTE [salão] estruturar e transmitir dados de suas operações a provedores terceiros de emissão de documentos fiscais eletrônicos, previamente contratados pela CONTRATANTE. A CONTRATADA não emite, autoriza, calcula tributos ou assume responsabilidade fiscal sobre os documentos gerados, atuando exclusivamente como fornecedora de tecnologia de integração. A responsabilidade pela exatidão dos dados cadastrais, pela contratação do provedor de emissão e pelo cumprimento das obrigações fiscais permanece integralmente com a CONTRATANTE."
