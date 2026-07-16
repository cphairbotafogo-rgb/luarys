// src/modules/agenda/AgendaSidebar.tsx
import { C } from "@/lib/constants";
import { RAIO_MD } from "@/lib/estiloGlobal";
import { COR_POR_STATUS } from "@/lib/agendaUtils";

// Lista de status visíveis na legenda da sidebar
const STATUS_LEGENDA = [
  { nome: 'Agendado',             status: 'Agendado'             },
  { nome: 'Confirmado',           status: 'Confirmado'           },
  { nome: 'Aguardando',           status: 'Aguardando'           },
  { nome: 'Em Atendimento',       status: 'Em Atendimento'       },
  { nome: 'Finalizado',           status: 'Finalizado'           },
  { nome: 'Faltou',               status: 'Faltou'               },
  { nome: 'Cancelado',            status: 'Cancelado'            },
  { nome: 'Aguardando Pagamento', status: 'Aguardando Pagamento' },
];

export function AgendaSidebar({
  sidebarAberta,
  tamanhoLinha,
  setTamanhoLinha,
  tamanhoColuna,
  setTamanhoColuna
}: any) {
  return (
    <div className="font-body" style={{ width: sidebarAberta ? 260 : 0, opacity: sidebarAberta ? 1 : 0, transition: "all 0.3s ease", background: C.bgCard, borderRight: sidebarAberta ? `1px solid ${C.borderMid}` : 'none', overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ width: 260 }}>

        {/* Legenda de status */}
        <div style={{ padding: "24px 20px", borderBottom: `1px solid ${C.borderMid}` }}>
          <h4 className="font-title uppercase tracking-widest" style={{ margin: "0 0 16px", fontSize: 11, color: C.textMuted, fontWeight: 700 }}>Status do Agendamento</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {STATUS_LEGENDA.map(({ nome, status }) => (
              <div key={status} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 12, height: 12, borderRadius: "50%",
                  background: COR_POR_STATUS[status],
                  boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                  // Faltou tem borda tracejada; Aguardando Pagamento tem pontilhada âmbar
                  outline: status === 'Faltou' ? `2px dashed ${COR_POR_STATUS[status]}` : status === 'Aguardando Pagamento' ? `2px dotted ${COR_POR_STATUS[status]}` : undefined,
                  outlineOffset: (status === 'Faltou' || status === 'Aguardando Pagamento') ? '2px' : undefined,
                }} />
                <span style={{ fontSize: 13, color: C.textMain, fontWeight: 500 }}>{nome}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tamanho da grade */}
        <div style={{ padding: "24px 20px", borderBottom: `1px solid ${C.borderMid}` }}>
          <h4 className="font-title uppercase tracking-widest" style={{ margin: "0 0 16px", fontSize: 11, color: C.textMuted, fontWeight: 700 }}>Tamanho da grade</h4>
          <div style={{ marginBottom: 20 }}>
            <span style={{ fontSize: 12, color: C.textLight, fontWeight: 600, marginBottom: 10, display: "block" }}>Linha (Altura):</span>
            <div style={{ display: "flex", gap: 12 }}>
              {['PP', 'P', 'M', 'G'].map(tam => (
                <label key={`l-${tam}`} style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: C.textMain, fontWeight: 500 }}>
                  <input type="radio" name="linha" checked={tamanhoLinha === tam} onChange={() => setTamanhoLinha(tam)} style={{ accentColor: C.sidebarBg }} /> {tam}
                </label>
              ))}
            </div>
          </div>
          <div>
            <span style={{ fontSize: 12, color: C.textLight, fontWeight: 600, marginBottom: 10, display: "block" }}>Coluna (Largura):</span>
            <div style={{ display: "flex", gap: 12 }}>
              {['PP', 'P', 'M', 'G'].map(tam => (
                <label key={`c-${tam}`} style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: C.textMain, fontWeight: 500 }}>
                  <input type="radio" name="coluna" checked={tamanhoColuna === tam} onChange={() => setTamanhoColuna(tam)} style={{ accentColor: C.sidebarBg }} /> {tam}
                </label>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
