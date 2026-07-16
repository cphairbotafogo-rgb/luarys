# Tokens e padrões de código — Design do Portal do Cliente

Conteúdo real de `src/modules/portal/estiloPortal.ts` (a fonte única de verdade) e exemplos de como cada token é usado nas telas já migradas. Use isto como referência rápida em vez de reabrir cada tela para conferir um valor.

## 1. `estiloPortal.ts` — o que existe lá

```ts
import { C } from "@/lib/constants";

// Tamanho padrão da logo
export const LOGO_ALTURA = 124;        // telas de autenticação (tela cheia)
export const LOGO_ALTURA_HEADER = 48;  // cabeçalho fixo do dashboard

// Tipografia oficial (Montserrat + DM Sans via layout.tsx)
export const FONTE_TITULO = "var(--font-title)";
export const FONTE_CORPO = "var(--font-body)";

// Gradiente ardósia premium (idêntico ao painel da tela de login do lojista)
export const GRADIENTE_SLATE = `linear-gradient(135deg, ${C.sidebarBg} 0%, #1E252F 100%)`;

// Sombras
export const SOMBRA_CARD = "0 18px 50px -22px rgba(44, 54, 67, 0.32)";
export const SOMBRA_SUAVE = "0 4px 14px rgba(44, 54, 67, 0.06)";

// Cartão premium base (telas de auth — "flutuante")
export const cardPremium = {
  background: C.bgCard,
  borderRadius: 18,
  border: `1px solid ${C.border}`,
  boxShadow: SOMBRA_CARD,
};

// Cartão de conteúdo (blocos internos do dashboard)
export const cardConteudo = {
  background: C.bgCard,
  borderRadius: 16,
  border: `1px solid ${C.border}`,
  boxShadow: SOMBRA_SUAVE,
};

// Eyebrow: rótulo pequeno em caixa alta acima dos títulos
export const eyebrow = {
  fontFamily: FONTE_TITULO,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "1.6px",
  textTransform: "uppercase" as const,
  color: C.douradoLuarys,
};

// Filete dourado decorativo (assinatura premium sob a logo)
export const fileteDourado = {
  width: 56,
  height: 3,
  margin: "20px auto 0",
  borderRadius: 3,
  background: `linear-gradient(90deg, transparent, ${C.douradoLuarys}, transparent)`,
};

// Título de seção (h1 das telas de auth)
export const tituloSecao = {
  fontFamily: FONTE_TITULO,
  margin: "10px 0 6px",
  fontSize: 24,
  fontWeight: 800,
  color: C.sidebarBg,
  letterSpacing: "-0.5px",
  textAlign: "center" as const,
};

// Botão primário ardósia
export const botaoPrimario = {
  fontFamily: FONTE_TITULO,
  width: "100%",
  padding: "14px 20px",
  background: C.sidebarBg,
  color: "#fff",
  border: "none",
  borderRadius: 10,
  fontWeight: 700,
  fontSize: 14,
  letterSpacing: "0.3px",
  cursor: "pointer",
};

// Input padrão
export const inputPadrao = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: `1px solid ${C.borderMid}`,
  fontSize: 13,
  outlineColor: C.sidebarBg,
  boxSizing: "border-box" as const,
  color: C.textMain,
  fontWeight: 500,
  backgroundColor: C.bgCard,
  fontFamily: FONTE_CORPO,
};

// Label de campo
export const labelPadrao = {
  fontFamily: FONTE_TITULO,
  fontSize: 10,
  fontWeight: 700,
  color: C.textMuted,
  display: "block" as const,
  marginBottom: 6,
  textTransform: "uppercase" as const,
  letterSpacing: "0.6px",
};
```

Se precisar do conteúdo exato e completo, abra `src/modules/portal/estiloPortal.ts` diretamente — o resumo acima é só pra você saber o que está disponível sem precisar abrir o arquivo toda vez.

## 2. Tokens de cor relevantes em `src/lib/constants.ts`

```ts
C.bg          // "#F8F9FA"  — fundo da página
C.bgCard      // "#FFFFFF"  — fundo de cartão/modal
C.sidebarBg   // "#2C3643"  — ardósia premium (botões, cabeçalho, destaques)
C.douradoLuarys // "#D4AF37" — dourado (só como detalhe fino)
C.border      // tom suave de borda
C.borderMid   // tom médio de borda (inputs)
C.textMain    // texto principal
C.textLight   // texto secundário
C.textMuted   // texto fraco (labels, placeholders)
C.danger      // vermelho de erro
C.dangerBg    // fundo de erro (usado com C.dangerText)
C.dangerText  // texto de erro
C.success     // "#10B981" — verde de sucesso
C.successBg   // "#D1FAE5" — fundo de sucesso
C.successText // "#065F46" — texto de sucesso
C.logoUrl     // "/logo_luarys_vertical.svg" — nunca hardcode o src
```

## 3. Receita de uma tela de autenticação em tela cheia

Usada em: seleção de salão, `PortalLogin`, `PortalCadastro` (incluindo a tela de sucesso pós-cadastro).

```tsx
import { C } from "@/lib/constants";
import {
  LOGO_ALTURA, FONTE_CORPO, cardPremium, eyebrow,
  fileteDourado, tituloSecao, botaoPrimario, inputPadrao, labelPadrao,
} from "./estiloPortal";

<div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: FONTE_CORPO }}>

  {/* Branding: logo + filete dourado, sempre juntos */}
  <div style={{ textAlign: "center", marginBottom: 32 }}>
    <img src={C.logoUrl} alt="Luarys" style={{ height: LOGO_ALTURA, objectFit: "contain", display: "block", margin: "0 auto" }} />
    <div style={fileteDourado} />
  </div>

  {/* Cartão premium */}
  <div style={{ ...cardPremium, width: "100%", maxWidth: 440, padding: "40px 32px" }}>
    <p style={{ ...eyebrow, textAlign: "center", margin: 0 }}>Rótulo curto aqui</p>
    <h1 style={tituloSecao}>Título da Tela</h1>
    <p style={{ margin: "0 0 28px", fontSize: 13, color: C.textLight, textAlign: "center" }}>Subtítulo explicativo</p>

    {/* form com inputPadrao / labelPadrao em cada campo */}

    <button className="transition-all hover:opacity-95 shadow-sm" style={botaoPrimario}>Ação Principal</button>
  </div>

  <p style={{ marginTop: 24, fontSize: 12, color: C.textLight, letterSpacing: "0.3px" }}>
    Desenvolvido por <span style={{ color: C.douradoLuarys, fontWeight: 700 }}>Luarys</span>
  </p>
</div>
```

**Importante:** sempre `src={C.logoUrl}`, nunca `src="/logo_luarys_vertical.svg"` hardcoded — `C.logoUrl` é o token central em `src/lib/constants.ts` e é o que permite trocar a logo do sistema inteiro num único lugar.

## 4. Receita do cabeçalho do dashboard

```tsx
import { LOGO_ALTURA_HEADER, SOMBRA_SUAVE } from "./estiloPortal";

<div style={{ background: C.bgCard, padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.border}`, borderTop: `3px solid ${C.douradoLuarys}`, position: "sticky", top: 0, zIndex: 50, boxShadow: SOMBRA_SUAVE }}>
  <img src={C.logoUrl} alt="Luarys" style={{ height: LOGO_ALTURA_HEADER, objectFit: "contain" }} />
  {/* ... resto do cabeçalho (nome do salão, trocar unidade, sair) ... */}
</div>
```

A borda superior dourada de 3px é o que dá o toque premium ao cabeçalho sem precisar de cor de fundo diferente.

## 5. Receita do hero principal (bloco de destaque do dashboard)

Usa o gradiente ardósia + geometrias sutis + eyebrow dourado. Este é o ÚNICO lugar do Portal (fora das telas de auth) que deve usar `GRADIENTE_SLATE` em área grande:

```tsx
import { GRADIENTE_SLATE, FONTE_TITULO } from "./estiloPortal";

<div style={{ position: "relative", background: GRADIENTE_SLATE, borderRadius: 18, padding: 28, color: "#fff", overflow: "hidden", boxShadow: "0 18px 50px -22px rgba(44, 54, 67, 0.55)" }}>
  {/* Geometrias premium sutis — círculos translúcidos */}
  <div style={{ position: "absolute", top: "-40%", right: "-12%", width: 240, height: 240, background: "rgba(255,255,255,0.04)", borderRadius: "50%" }} />
  <div style={{ position: "absolute", bottom: "-55%", left: "-10%", width: 280, height: 280, background: "rgba(212,175,55,0.06)", borderRadius: "50%" }} />
  <div style={{ position: "relative", zIndex: 1 }}>
    <p style={{ fontFamily: FONTE_TITULO, margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "1.6px", textTransform: "uppercase", color: C.douradoLuarys }}>Eyebrow Dourado</p>
    <h2 style={{ fontFamily: FONTE_TITULO, margin: "0 0 8px", fontSize: 22, fontWeight: 800 }}>Título do Hero</h2>
    <p style={{ margin: 0, fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>Texto de apoio</p>
    {/* botão branco sobre o gradiente escuro, nunca botão ardósia aqui (perderia contraste) */}
  </div>
</div>
```

## 6. Receita de modal

Todo modal do Portal (`ModalPerfil`, `ModalHistorico`, `ModalAnamnese`, `ModalCancelamento`) segue:

```tsx
<div style={{ background: "#fff", width: "100%", maxWidth: 500, borderRadius: 16, padding: 32, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", border: `1px solid ${C.border}`, borderTop: `4px solid ${C.douradoLuarys}` }}>
  {/* cabeçalho, formulário/conteúdo, fontFamily sempre var(--font-body) ou var(--font-title) */}
</div>
```

`ModalCancelamento` é exceção proposital: usa `borderTop: 4px solid ${C.danger}` (vermelho) em vez de dourado, porque é uma ação destrutiva — manter essa diferenciação semântica de cor.

## 7. Cartões de conteúdo com hover

```tsx
import { cardConteudo } from "./estiloPortal";

<div className="transition-all hover:-translate-y-0.5 hover:shadow-md" style={{ ...cardConteudo, padding: 20, cursor: "pointer" }}>
  {/* ícone num círculo suave, título font-title, descrição pequena */}
</div>
```

## 8. Checklist rápido ao migrar/criar uma tela do Portal

- [ ] Importa de `./estiloPortal` (ou `@/modules/portal/estiloPortal` se fora da pasta) em vez de redeclarar tokens
- [ ] Logo usa `C.logoUrl` + `LOGO_ALTURA` ou `LOGO_ALTURA_HEADER` (nunca um número solto)
- [ ] Nenhum `'Poppins', 'Segoe UI', system-ui, sans-serif` sobrevivendo — trocar por `FONTE_TITULO`/`FONTE_CORPO`
- [ ] Dourado (`C.douradoLuarys`) só como detalhe (filete, borda fina, eyebrow), nunca em área grande
- [ ] Gradiente ardósia (`GRADIENTE_SLATE`) só no hero principal e nas telas de auth
- [ ] Cantos de 16-18px em cartões/modais, sombra suave (`SOMBRA_SUAVE`) em vez de borda grossa
- [ ] Cores de estado (sucesso, erro) usam `C.success`/`C.successBg`/`C.successText` e `C.danger`/`C.dangerBg`/`C.dangerText` — nunca hex hardcoded
- [ ] Nenhuma lógica (handler, query, state, prop) foi tocada — só `style`/`className`/imports visuais
