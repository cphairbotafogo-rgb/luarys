/**
 * src/app/admin/shared.tsx
 *
 * Componentes e estilos reutilizados pelas abas do painel /admin.
 * Mantidos aqui para não duplicar em cada aba.
 */
import { C } from "@/lib/constants";
import { RAIO_MD } from "@/lib/estiloGlobal";

export const thStyle = { padding: "14px 20px", fontSize: 10, fontWeight: 800, color: C.textLight, textTransform: "uppercase" as const, letterSpacing: "0.5px" };
export const tdStyle = { padding: "14px 20px", fontSize: 13, color: C.textMain };

export function TelaCentral({ children }: any) {
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.bg, fontFamily: "'Poppins','Segoe UI',system-ui,sans-serif", textAlign: "center", padding: 24 }}>
      {children}
    </div>
  );
}

export function ToggleBtn({ ativo, carregando, onClick }: { ativo: boolean; carregando: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={carregando}
      style={{
        padding: "8px 16px",
        borderRadius: 20,
        border: "none",
        cursor: carregando ? "wait" : "pointer",
        fontWeight: 800,
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        background: ativo ? C.success : "#F1F5F9",
        color: ativo ? "#fff" : C.textMuted,
        opacity: carregando ? 0.6 : 1,
        minWidth: 84,
      }}
    >
      {carregando ? '...' : (ativo ? 'Liberado' : 'Bloqueado')}
    </button>
  );
}

export function PrecoInput({ valor, carregando, onSalvar }: { valor: number; carregando: boolean; onSalvar: (valor: string) => void }) {
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: C.textLight, fontWeight: 700, pointerEvents: "none" }}>R$</span>
      <input
        type="number"
        step="0.01"
        min="0"
        defaultValue={valor}
        onBlur={(e) => onSalvar(e.target.value)}
        disabled={carregando}
        style={{
          width: 100,
          padding: "8px 10px 8px 30px",
          borderRadius: RAIO_MD,
          border: `1px solid ${C.borderMid}`,
          fontSize: 12,
          textAlign: "right",
          fontWeight: 700,
          color: C.textMain,
          opacity: carregando ? 0.6 : 1,
        }}
      />
    </div>
  );
}

export function DescricaoInput({ valor, carregando, onSalvar }: { valor: string | null; carregando: boolean; onSalvar: (valor: string) => void }) {
  return (
    <textarea
      defaultValue={valor || ''}
      onBlur={(e) => onSalvar(e.target.value)}
      disabled={carregando}
      rows={2}
      style={{
        width: "100%",
        minWidth: 220,
        padding: "8px 10px",
        borderRadius: RAIO_MD,
        border: `1px solid ${C.borderMid}`,
        fontSize: 12,
        color: C.textMuted,
        fontFamily: "inherit",
        resize: "vertical",
        opacity: carregando ? 0.6 : 1,
        boxSizing: "border-box",
      }}
    />
  );
}

export function NomeInput({ valor, carregando, onSalvar }: { valor: string; carregando: boolean; onSalvar: (valor: string) => void }) {
  return (
    <input
      type="text"
      defaultValue={valor || ''}
      onBlur={(e) => { if (e.target.value.trim()) onSalvar(e.target.value.trim()); }}
      disabled={carregando}
      style={{
        width: "100%",
        padding: "5px 8px",
        borderRadius: RAIO_MD,
        border: `1px solid ${C.borderMid}`,
        fontSize: 13,
        fontWeight: 700,
        color: C.textMain,
        fontFamily: "inherit",
        opacity: carregando ? 0.6 : 1,
        boxSizing: "border-box",
      }}
    />
  );
}