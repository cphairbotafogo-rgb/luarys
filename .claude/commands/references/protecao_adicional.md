# Camadas adicionais de proteção

Itens que não são RLS nem autenticação básica, mas reduzem o dano em caso
de uma credencial ser comprometida, ou bloqueiam classes inteiras de
ataque no nível do navegador/HTTP.

## PIN do gerente — nunca usar valor padrão fixo como fallback

**Bug real encontrado no projeto (jun/2026):**

```ts
// src/modules/agenda/modals/fechamento/useFechamentoUI.ts
const { data } = await supabase.from('saloes').select('pin_gerente').eq('id', perfil?.salao_id).single();
const pinCorreto = data?.pin_gerente || '1234'; // nunca fazer isso
```

Se o salão nunca configurou um `pin_gerente`, o sistema aceita "1234"
como senha válida para qualquer ação protegida por esse PIN — previsível
e bem conhecido, qualquer pessoa pode tentar em qualquer salão que não
tenha configurado o próprio.

**Correção:** nunca usar um valor padrão adivinhável como fallback de
segredo. Se o PIN não estiver configurado, a ação deveria ser bloqueada
(orientar o dono a configurar primeiro), nunca um valor fixo conhecido:

```ts
const pinConfigurado = data?.pin_gerente;
if (!pinConfigurado) {
  toast.aviso('Configure um PIN de gerente em Configurações antes de usar esta função.');
  return;
}
const correto = pinDigitado === pinConfigurado;
```

Esse mesmo padrão (valor padrão hardcoded usado "se não configurado")
vale procurar em qualquer outro lugar do sistema que use PIN/senha
secundária — é fácil de introduzir sem perceber ("preciso de um valor
padrão pra não quebrar em teste") e fácil de esquecer de remover antes
de produção.

## MFA (autenticação de dois fatores) — ainda não implementado

O projeto hoje não tem MFA em nenhum fluxo de login. Para contas de alto
privilégio (dono do salão, e principalmente o painel `/admin` que acessa
todos os salões), MFA protege contra senha vazada/reaproveitada de outro
serviço — o cenário mais comum de invasão de conta na prática não é
"quebrar a senha", é a senha já ter vazado em outro lugar e ser
reaproveitada aqui.

O Supabase Auth tem suporte nativo a MFA (TOTP) — avaliar habilitar pelo
menos para o painel `/admin`, que concentra acesso a todos os salões de
uma vez (maior superfície de dano se comprometido).

## Headers de segurança HTTP (`next.config.js`)

Não verificado neste projeto (arquivo não disponível na auditoria). Ao
criar/revisar esse arquivo, considerar:

```js
// next.config.js
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' }, // evita clickjacking
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

module.exports = {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};
```

CSP (Content Security Policy) é mais poderosa mas mais trabalhosa de
configurar sem quebrar funcionalidade (scripts de terceiros, fontes) —
vale introduzir depois que o básico acima estiver validado. Uma CSP mal
configurada que quebra o site é pior, na prática, do que não ter CSP
nenhuma — testar em modo `Content-Security-Policy-Report-Only` antes de
aplicar de verdade.

## Calibrando o esforço

Nem todo item desta lista tem a mesma prioridade. MFA no painel `/admin`
e a correção do PIN fixo são as duas coisas com maior retorno imediato
sobre esforço — priorizar essas antes de CSP, que é mais trabalhosa e
tem menor probabilidade de ser o vetor de ataque real usado contra um
SaaS deste porte no curto prazo.
