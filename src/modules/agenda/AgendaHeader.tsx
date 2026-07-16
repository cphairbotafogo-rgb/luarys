import { C } from "@/lib/constants";
import { RAIO_MD } from "@/lib/estiloGlobal";
import { FiMenu, FiChevronLeft, FiChevronRight, FiCalendar, FiPlus } from "react-icons/fi";

export function AgendaHeader({
  dataAtual, setDataAtual, sidebarAberta, setSidebarAberta,
  isAdminOuRecepcao, filtroFuncao, setFiltroFuncao, todasFuncoes, onNovoAgendamento
}: any) {
  return (
    <div className="font-body" style={{ padding: "16px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", background: C.bgCard, borderBottom: `1px solid ${C.borderMid}`, flexShrink: 0 }}>
      <div>
        <h1 className="font-title uppercase tracking-widest" style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700, color: C.sidebarBg }}>Agenda Diária</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={() => setSidebarAberta(!sidebarAberta)} className="transition-all hover:bg-slate-100" style={{background: "none", border: "none", cursor: "pointer", color: C.sidebarBg, padding: "6px", borderRadius: "8px", display: "flex"}} title="Menu">
            <FiMenu size={20} />
          </button>
          
          <button onClick={() => { const d = new Date(dataAtual); d.setDate(d.getDate() - 1); setDataAtual(d); }} className="transition-all hover:scale-105" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, width: 36, height: 36, cursor: "pointer", color: C.sidebarBg }}>
            <FiChevronLeft size={20} />
          </button>
          
          <div style={{ position: "relative" }}>
            <input id="calendario-invisivel" type="date" value={`${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}-${String(dataAtual.getDate()).padStart(2, '0')}`} onChange={(e) => { if (!e.target.value) return; const [y, m, d] = e.target.value.split('-').map(Number); setDataAtual(new Date(y, m - 1, d)); }} style={{ position: "absolute", width: 0, height: 0, opacity: 0, border: "none" }} />
            <div onClick={() => (document.getElementById('calendario-invisivel') as HTMLInputElement | null)?.showPicker()} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: RAIO_MD, transition: "background 0.2s" }} onMouseOver={(e) => e.currentTarget.style.background = C.bg} onMouseOut={(e) => e.currentTarget.style.background = "transparent"}>
              <h2 className="font-title" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.textMain, display: "flex", alignItems: "center", gap: 8 }}>{dataAtual.toLocaleDateString('pt-BR')} <FiCalendar size={16} style={{color: C.textLight}} /></h2>
              <span style={{ fontSize: 13, color: C.textLight, textTransform: "capitalize", fontWeight: 500 }}>· {dataAtual.toLocaleDateString('pt-BR', { weekday: 'long' })}</span>
            </div>
          </div>
          
          <button onClick={() => { const d = new Date(dataAtual); d.setDate(d.getDate() + 1); setDataAtual(d); }} className="transition-all hover:scale-105" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, width: 36, height: 36, cursor: "pointer", color: C.sidebarBg }}>
            <FiChevronRight size={20} />
          </button>
          
          {isAdminOuRecepcao && (
            <div style={{ marginLeft: 8, paddingLeft: 16, borderLeft: `1px solid ${C.borderMid}`, display: "flex", alignItems: "center" }}>
              <select className="font-body" value={filtroFuncao} onChange={(e) => setFiltroFuncao(e.target.value)} style={{ padding: "8px 14px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, background: C.bgCard, color: C.sidebarBg, fontWeight: 600, fontSize: 13, outline: "none", cursor: "pointer" }}>
                <option value="">Todas as Funções</option>
                {todasFuncoes.map((funcao: string) => <option key={funcao} value={funcao}>{funcao}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <span className="font-body" style={{ padding: "6px 14px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "#F4F8F5", color: "#3B4A3F", display: "flex", alignItems: "center", gap: 8, border: "1px solid #E8F0EA" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: C.success, animation: "pulse 2s infinite" }}></div> Sistema Online
        </span>
        
        <button onClick={onNovoAgendamento} className="font-body transition-all hover:scale-[1.02]" style={{ display: "flex", alignItems: "center", gap: 8, background: C.btnPrimary, color: "#fff", border: "none", padding: "10px 20px", borderRadius: RAIO_MD, fontWeight: 600, fontSize: 14, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <FiPlus size={18} /> Novo Agendamento
        </button>
      </div>
    </div>
  );
}