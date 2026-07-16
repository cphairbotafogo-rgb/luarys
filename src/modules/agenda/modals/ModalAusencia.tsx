'use client'
import { C } from "@/lib/constants";
import { inputAdmin, labelPadrao, containerModal, overlayModal, RAIO_MD } from "@/lib/estiloGlobal";
import { FiX, FiClock, FiTrash2, FiCoffee } from "react-icons/fi";

// ─── TIPOS DE BLOQUEIO/AUSÊNCIA ───
// Cada tipo carrega: rótulo exibido, cor no calendário e se desconta da
// capacidade efetiva do profissional nos relatórios de capacidade/ocupação.
// 'Liberação' não desconta: é folga concedida pelo salão, não ausência indesejada.
export const TIPOS_BLOQUEIO = [
  { valor: 'Falta',               label: 'Falta',                cor: '#DC2626', descontaCapacidade: true  },
  { valor: 'Atraso',               label: 'Atraso',                cor: '#F59E0B', descontaCapacidade: true  },
  { valor: 'Saída antecipada',     label: 'Saída antecipada',       cor: '#F59E0B', descontaCapacidade: true  },
  { valor: 'Bloqueio pessoal',     label: 'Bloqueio pessoal',       cor: '#94A3B8', descontaCapacidade: true  },
  { valor: 'Bloqueio operacional', label: 'Bloqueio operacional',   cor: '#64748B', descontaCapacidade: true  },
  { valor: 'Liberação',            label: 'Liberação excepcional',  cor: '#16A34A', descontaCapacidade: false },
] as const;

export function corDoTipoBloqueio(tipo: string) {
  return TIPOS_BLOQUEIO.find(t => t.valor === tipo)?.cor || '#94A3B8';
}

export function ModalAusencia({
  formAusencia, setFormAusencia,
  profissionaisDb,
  bloqueioEditandoId, setBloqueioEditandoId,
  onClose, salvarAusencia, excluirAusencia
}: any) {
  
  // ─── ESTILOS REFINADOS (Clean & Clinical) ───
  const inputStyle = { ...inputAdmin };
  const labelStyle = { ...labelPadrao };

  return (
    <div className="font-body" style={{ ...overlayModal, alignItems: "flex-start", paddingTop: "10vh", zIndex: 1300 }}>
      <div style={{ ...containerModal, width: 480, overflow: "hidden" }}>
        
        {/* CABEÇALHO */}
        <div style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.border}`, background: C.sidebarBg }}>
          <h3 className="font-title uppercase tracking-widest" style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
            {bloqueioEditandoId ? <><FiClock size={16}/> Editar Bloqueio</> : <><FiCoffee size={16}/> Registrar Ausência</>}
          </h3>
          <button onClick={() => { onClose(); setBloqueioEditandoId(null); }} className="transition-all hover:opacity-100" style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#fff", opacity: 0.7, display: "flex" }}><FiX size={20}/></button>
        </div>

        {/* FORMULÁRIO */}
        <div style={{ padding: "24px 24px 32px", display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <label className="font-title" style={labelStyle}>Profissional</label>
            <select style={inputStyle} value={formAusencia.profissional} onChange={e => setFormAusencia({...formAusencia, profissional: e.target.value})}>
              <option value="">Selecione o Profissional...</option>
              {profissionaisDb.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="font-title" style={labelStyle}>Período do Bloqueio</label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input type="date" style={inputStyle} value={formAusencia.dataInicio} onChange={e => setFormAusencia({...formAusencia, dataInicio: e.target.value})} />
              <input type="time" style={{...inputStyle, width: 110}} value={formAusencia.horaInicio} onChange={e => setFormAusencia({...formAusencia, horaInicio: e.target.value})} />
              <span style={{ fontSize: 12, color: C.textLight, fontWeight: 600 }}>até</span>
              <input type="time" style={{...inputStyle, width: 110}} value={formAusencia.horaFim} onChange={e => setFormAusencia({...formAusencia, horaFim: e.target.value})} />
            </div>
          </div>

          <div>
            <label className="font-title" style={labelStyle}>Tipo de bloqueio</label>
            <select style={inputStyle} value={formAusencia.tipo} onChange={e => setFormAusencia({...formAusencia, tipo: e.target.value})}>
              {TIPOS_BLOQUEIO.map(t => (
                <option key={t.valor} value={t.valor}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-title" style={labelStyle}>Motivo / Observações</label>
            <input 
              type="text"
              style={inputStyle} 
              placeholder="Ex: Horário de Almoço, Consulta Médica..."
              value={formAusencia.motivo} 
              onChange={e => setFormAusencia({...formAusencia, motivo: e.target.value})}
            />
          </div>
        </div>

        {/* RODAPÉ E AÇÕES */}
        <div style={{ padding: "16px 24px", background: C.bg, display: "flex", justifyContent: "space-between", borderTop: `1px solid ${C.border}` }}>
           {bloqueioEditandoId ? (
             <button onClick={excluirAusencia} className="transition-all hover:bg-red-50" style={{ background: "transparent", color: C.danger, border: `1px solid ${C.dangerBg}`, padding: "10px 16px", borderRadius: RAIO_MD, cursor: "pointer", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
               <FiTrash2 size={14}/> Excluir
             </button>
           ) : <div/>}

           <div style={{ display: "flex", gap: 12 }}>
             <button onClick={() => { onClose(); setBloqueioEditandoId(null); }} className="transition-all hover:bg-slate-50" style={{ padding: "10px 16px", fontSize: 12, background: C.bgCard, color: C.textMain, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, cursor: "pointer", fontWeight: 600 }}>
               Cancelar
             </button>
             <button onClick={salvarAusencia} className="transition-all hover:opacity-90" style={{ background: C.sidebarBg, color: "#fff", border: "none", padding: "10px 24px", fontSize: 12, fontWeight: 700, borderRadius: RAIO_MD, cursor: "pointer" }}>
               Salvar Bloqueio
             </button>
           </div>
        </div>
      </div>
    </div>
  );
}