# LGPD e dados pessoais

O Luarys processa dado de três categorias de titular: donos de salão,
profissionais (CPF, dados que afetam cálculo de comissão), e clientes
finais dos salões (CPF, telefone, e-mail, histórico de atendimento,
possivelmente dado de saúde se a ficha de anamnese registrar alergias ou
condições). Isto não é aconselhamento jurídico — para a parte contratual
(Termos de Uso, Política de Privacidade, DPA com os salões), consultar
advogado especializado. Esta referência cobre o lado técnico: como o
código deve se comportar para não tornar pior um problema jurídico.

## Dado sensível na ficha de anamnese

Se houver campo de alergias, condições de saúde, ou histórico médico em
qualquer ficha de cliente, isso é dado sensível pela LGPD (Art. 5º, II) —
exige tratamento mais cuidadoso que dado comum:
- Nunca incluir esse campo em qualquer view/policy de acesso público
  (`anon`) — nem por engano, nem "temporariamente para testar"
- Se algum relatório/exportação (PDF, planilha) inclui ficha de cliente,
  conferir se esses campos sensíveis realmente precisam estar lá
- Logs de aplicação (`console.log`, `console.error`) nunca devem incluir
  o conteúdo desses campos

## CPF e outros identificadores diretos

Hoje armazenado em texto puro no banco (`clientes.cpf`, e CPF do
profissional). Comum na indústria — depende da criptografia em repouso do
Supabase/Postgres — mas alguns cuidados adicionais valem a pena:
- Nunca logar CPF em `console.log`
- Nunca incluir CPF em URL (query string) — fica em logs de servidor,
  histórico do navegador. Usar corpo de requisição (POST) ou ID interno
  no path, não CPF diretamente
- Ao exibir CPF na tela, considerar mascarar parcialmente quando não for
  estritamente necessário mostrar completo (ex: 123.***.***-00)

## Direito de exclusão e portabilidade

A LGPD garante ao titular o direito de pedir exclusão dos próprios dados
e de exportá-los. Tecnicamente, isso significa que o sistema precisa ter
(mesmo que hoje seja um processo manual, via suporte):
- Um jeito de localizar todos os registros de um titular específico
  espalhados pelas tabelas (`clientes`, `agendamentos`, `financeiro`,
  `comissoes` se também for profissional, etc.)
- Uma decisão clara sobre exclusão de verdade vs. anonimização — apagar
  um cliente que já gerou registros financeiros pode quebrar relatórios
  contábeis/fiscais do salão; entender com o advogado se a LGPD permite
  reter o registro financeiro anonimizado (sem nome/CPF) em vez de
  excluir por completo, dada a obrigação fiscal paralela

## Logs de acesso (Marco Civil da Internet, Lei 12.965/2014, Art. 15)

Provedores de aplicação são obrigados a manter registro de acesso (IP,
data/hora) pelo prazo mínimo de 6 meses, sob sigilo. A infraestrutura
(Vercel para o app, Supabase para o banco/auth) já gera parte desse log
de acesso por padrão, como característica da plataforma de hospedagem —
mas vale confirmar com a documentação de cada serviço qual é exatamente
o prazo de retenção do plano contratado, porque planos de entrada
costumam reter logs por bem menos que 6 meses. Primeiro confirmar o que
a infraestrutura já cobre antes de decidir se é preciso uma tabela
própria de auditoria adicional (o projeto já tem `auditoria_log` para
ações dentro do sistema — isso é diferente de log de acesso de rede).

## Consentimento para dado sensível (ficha de anamnese)

Se a ficha de anamnese coleta dado de saúde (alergia, condição médica),
o consentimento para isso não deveria estar genérico dentro dos "Termos
de Uso" — a LGPD trata consentimento para dado sensível com exigência
maior de destaque e especificidade. Na prática técnica, isso sugere um
checkbox/aceite separado, específico para esse campo, no momento em que
ele é preenchido (não só um aceite geral no cadastro inicial) — e
registrar quando esse consentimento específico foi dado (data, versão do
texto apresentado), não só "o cliente aceitou os termos" de forma
genérica. Confirmar o desenho exato com o advogado antes de implementar —
esta nota é só o sinalizador técnico do que pode ser necessário guardar.

## Dado de menores de idade

Se o salão atende menores e a ficha de cliente captura idade/data de
nascimento, isso pode exigir tratamento ainda mais cuidadoso (proteção
reforçada na LGPD para dado de criança/adolescente). Avaliar com o
advogado antes de capturar esse campo, se ainda não captura.

## Operador (Luarys) vs Controlador (cada salão)

Do ponto de vista técnico: o Luarys (a plataforma) não deveria, por
padrão, usar dado de cliente final de um salão para nenhuma finalidade
que não seja operar o sistema para aquele salão — nada de usar a base
consolidada de clientes de todos os salões para finalidade própria
(marketing, analytics agregado vendido a terceiro) sem isso estar muito
claro no contrato com os salões e, provavelmente, sem consentimento
adicional dos titulares.

## Checklist rápido ao adicionar um campo novo de dado pessoal

1. Esse campo é sensível (saúde, biometria, origem racial/étnica,
   convicção religiosa/política, orientação sexual, dado de criança)? Se
   sim, redobrar cuidado com onde ele aparece (telas, exports, logs,
   APIs públicas).
2. Esse campo precisa mesmo ser coletado, ou o caso de uso funciona sem
   ele? (minimização — não coletar "para garantir", só o que tem uso
   real definido)
3. Esse campo vai aparecer em alguma tela/relatório/export que outras
   pessoas além do dono do salão podem ver? Isso está dentro do esperado
   pelo titular?
4. Se esse campo vazasse amanhã, qual o dano real para a pessoa?
   Calibrar o nível de proteção proporcionalmente a essa resposta.
