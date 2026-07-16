'use client'
/**
 * src/modules/equipe/PainelPermissoesGranulares.tsx
 *
 * Seção adicional dentro da aba "Permissões" do cadastro de profissional,
 * exibindo o catálogo novo de permissões granulares (src/lib/permissoes.ts)
 * organizado em blocos expansíveis por categoria — inspirado no padrão de
 * mercado (Trinks) trazido pelo usuário. Inclui "Copiar permissões de outro
 * profissional" para reduzir o atrito de configurar cada colaborador do zero.
 *
 * Coexiste com o painel de permissões antigo (switches legados como
 * fazer_estorno, aplicar_desconto) já existente em AbaEquipe.tsx — este
 * componente não substitui aquele, apenas complementa com as chaves novas.
 */
import { useState } from "react";
import { C } from "@/lib/constants";
import { RAIO_MD, RAIO_LG, RAIO_XL } from "@/lib/estiloGlobal";
import { FiChevronDown, FiChevronUp, FiCopy, FiShield, FiLock } from "react-icons/fi";
import { CATALOGO_PERMISSOES, type CategoriaPermissao } from "@/lib/permissoes";

const ROTULOS_CATEGORIA: Record<CategoriaPermissao, string> = {
  agenda: 'Agenda',
  caixa: 'Caixa e Fechamento',
  comissoes: 'Comissões',
  dados: 'Segurança de Dados (LGPD)',
  fiscal: 'Fiscal',
  modulo: 'Acesso a Módulos',
  auditoria: 'Auditoria e Fiscalização',
};

const ORDEM_CATEGORIAS: CategoriaPermissao[] = ['agenda', 'caixa', 'comissoes', 'dados', 'fiscal', 'modulo', 'auditoria'];

interface Props {
  permissoes: Record<string, any>;
  onToggle: (chave: string) => void;
  outrosProfissionais: any[];
  onCopiarDe: (profissionalId: string) => void;
  /** Marca uma permissão como confidencial travada (mostra cadeado). */
  ehBloqueada?: (chave: string) => boolean;
}

export function PainelPermissoesGranulares({ permissoes, onToggle, outrosProfissionais, onCopiarDe, ehBloqueada }: Props) {
  const [categoriaExpandida, setCategoriaExpandida] = useState<CategoriaPermissao | null>('agenda');
  const [profissionalParaCopiar, setProfissionalParaCopiar] = useState('');

  const switchStyle = (ativo: boolean) => ({ position: "relative" as const, display: "inline-block", width: 40, height: 20, cursor: "pointer", backgroundColor: ativo ? C.sidebarBg : C.borderMid, transition: ".2s", borderRadius: 20, flexShrink: 0 });
  const switchCircleStyle = (ativo: boolean) => ({ position: "absolute" as const, height: 14, width: 14, left: ativo ? 22 : 3, bottom: 3, backgroundColor: C.bgCard, transition: ".2s", borderRadius: "50%" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {outrosProfissionais.length > 0 && (
        <div style={{ background: C.bg, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_LG, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <FiCopy size={16} color={C.sidebarBg} style={{ flexShrink: 0 }} />
          <select
            value={profissionalParaCopiar}
            onChange={e => setProfissionalParaCopiar(e.target.value)}
            style={{ flex: 1, padding: "8px 12px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 12, fontWeight: 600, color: C.textMain, background: C.bgCard }}
          >
            <option value="">Copiar permissões de outro profissional...</option>
            {outrosProfissionais.map((p: any) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
          <button
            disabled={!profissionalParaCopiar}
            onClick={() => { if (profissionalParaCopiar) { onCopiarDe(profissionalParaCopiar); setProfissionalParaCopiar(''); } }}
            style={{ padding: "8px 16px", borderRadius: RAIO_MD, border: "none", background: profissionalParaCopiar ? C.sidebarBg : C.borderMid, color: C.bgCard, fontSize: 12, fontWeight: 700, cursor: profissionalParaCopiar ? "pointer" : "not-allowed" }}
          >
            Copiar
          </button>
        </div>
      )}

      {ORDEM_CATEGORIAS.map(categoria => {
        const itensCategoria = CATALOGO_PERMISSOES.filter(p => p.categoria === categoria);
        if (itensCategoria.length === 0) return null;
        const expandida = categoriaExpandida === categoria;
        const qtdAtivas = itensCategoria.filter(p => !!permissoes[p.chave]).length;

        return (
          <div key={categoria} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, overflow: "hidden" }}>
            <button
              onClick={() => setCategoriaExpandida(expandida ? null : categoria)}
              style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", background: "none", border: "none", cursor: "pointer" }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {categoria === 'auditoria' && <FiShield size={14} />}
                {ROTULOS_CATEGORIA[categoria]}
                <span style={{ fontSize: 10, fontWeight: 700, color: C.textLight, background: C.bg, padding: "2px 8px", borderRadius: RAIO_LG }}>{qtdAtivas}/{itensCategoria.length}</span>
              </span>
              {expandida ? <FiChevronUp size={16} color={C.textMuted} /> : <FiChevronDown size={16} color={C.textMuted} />}
            </button>

            {expandida && (
              <div style={{ padding: "0 18px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
                {itensCategoria.map((p, i) => (
                  <div key={p.chave} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, paddingTop: i > 0 ? 12 : 0, borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}>
                    <div>
                      <h5 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.textMain, display: "flex", alignItems: "center", gap: 6 }}>
                        {p.rotulo}
                        {ehBloqueada?.(p.chave) && <FiLock size={11} color="#B45309" />}
                        {p.critica && <span style={{ marginLeft: 2, fontSize: 9, fontWeight: 700, color: C.danger, textTransform: "uppercase" }}>· Crítica</span>}
                      </h5>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: C.textLight }}>{p.descricao}</p>
                    </div>
                    <div style={switchStyle(!!permissoes[p.chave])} onClick={() => onToggle(p.chave)}>
                      <span style={switchCircleStyle(!!permissoes[p.chave])}></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
