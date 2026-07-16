# Skill: luarys-abas-persistentes

**Última verificação:** 03/07/2026

## Propósito

Manter abas pesadas montadas em background com `display: none` em vez de desmontá-las ao trocar de aba. Isso preserva estado (filtros, scroll, dados carregados) e evita re-fetches ao voltar para a aba.

---

## Abas persistentes definidas

```typescript
// src/app/page.tsx
const ABAS_PERSISTENTES = ['agenda', 'crm', 'caixa', 'financeiro', 'relatorios'];
```

Critério para incluir: aba faz fetch pesado ao montar e o usuário frequentemente vai e volta dela.  
Critério para excluir: aba leve ou raramente revisitada (dashboard, configuracoes, equipe, estoque).

---

## Padrão de implementação em `page.tsx`

```tsx
// Estado que rastreia quais abas pesadas já foram visitadas
const [abasVisitadas, setAbasVisitadas] = useState<Set<string>>(() => new Set([aba]));

useEffect(() => {
  if (!ABAS_PERSISTENTES.includes(aba)) return;
  setAbasVisitadas(prev => {
    if (prev.has(aba)) return prev; // evita re-render desnecessário
    const next = new Set(prev);
    next.add(aba);
    return next;
  });
}, [aba]);

// Render da aba persistente (com checagem de permissão)
function renderAbaConteudo(id: string) {
  switch (id) {
    case 'agenda':    return <AbaAgenda perfil={perfil} />;
    case 'crm':       return <AbaCRM perfil={perfil} />;
    case 'caixa':     return <AbaCaixa perfil={perfil} setAba={setAba} />;
    case 'financeiro':
      if (!temPermissao(perfil, 'modulo.financeiro') && !perfil.permissoes?.ver_financeiro)
        return <TelaBloqueada />;
      if (!perfil.moduloFinanceiroLiberado)
        return <TelaModuloPago nome="Módulo Financeiro" />;
      return <AbaFinanceiro perfil={perfil} />;
    case 'relatorios':
      if (!temPermissao(perfil, 'modulo.relatorios') && !perfil.permissoes?.ver_dashboard)
        return <TelaBloqueada />;
      if (!perfil.moduloRelatoriosLiberado)
        return <TelaModuloPago nome="Módulo Relatórios" />;
      return <AbaRelatorios perfil={perfil} />;
    default: return null;
  }
}

// Container no return do ElevaApp
<div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
  {/* Abas persistentes: montadas uma vez, visíveis/invisíveis via display */}
  {ABAS_PERSISTENTES.map(id =>
    abasVisitadas.has(id) ? (
      <div key={id} style={{
        position: 'absolute', inset: 0, overflowY: 'auto',
        display: aba === id ? 'block' : 'none',
      }}>
        {renderAbaConteudo(id)}
      </div>
    ) : null
  )}
  {/* Abas não-persistentes: comportamento anterior (desmonta ao sair) */}
  {!ABAS_PERSISTENTES.includes(aba) && (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}>
      {renderAba()}
    </div>
  )}
</div>
```

---

## Comportamento esperado

| Cenário | Antes | Depois |
|---|---|---|
| Financeiro → Agenda → Financeiro | 2 fetches financeiro | 1 fetch total |
| Filtro de mês no Financeiro, volta → Agenda, volta | Filtro perdido | Filtro preservado |
| Primeiro acesso à aba | Normal | Normal (monta ao visitar) |
| Aba nunca visitada | Não existe | Não monta (lazy) |

---

## Cuidados

- **Dados desatualizados**: componentes persistentes não refazem fetch quando o usuário volta. Para dados críticos (ex: agendamentos do dia), o componente deve ter um mecanismo de revalidação por tempo ou evento (ex: `window` focus event).
- **Memória**: componentes montados consomem RAM. Em dispositivos com <4GB RAM (celular antigo), considerar reduzir o conjunto de abas persistentes.
- **Scroll**: cada aba persistente tem seu próprio `overflowY: auto`, então o scroll é independente por aba.
