import { C } from "@/lib/constants";
import { RAIO_MD } from "@/lib/estiloGlobal";
import { FiMenu, FiChevronLeft, FiChevronRight, FiCalendar, FiPlus } from "react-icons/fi";

export function AgendaHeader({
  dataAtual, setDataAtual, sidebarAberta, setSidebarAberta,
  isAdminOuRecepcao, filtroFuncao, setFiltroFuncao, todasFuncoes, onNovoAgendamento
}: any) {
  return (
    <div className="font-body pl-16 pr-4 py-3 sm:px-8 sm:py-4" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.bgCard, borderBottom: `1px solid ${C.borderMid}`, flexShrink: 0, flexWrap: "wrap", rowGap: 8 }}>
      <div>
        <h1 className="font-title uppercase tracking-widest text-xs sm:text-base" style={{ margin: "0 0 8px", fontWeight: 700, color: C.sidebarBg }}>Agenda Diária</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", rowGap: 6 }}>
          <button onClick={() => setSidebarAberta(!sidebarAberta)} className="transition-all hover:bg-slate-100" style={{background: "none", border: "none", cursor: "pointer", color: C.sidebarBg, padding: "4px", borderRadius: "8px", display: "flex"}} title="Menu">
            <FiMenu className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <button onClick={() => { const d = new Date(dataAtual); d.setDate(d.getDate() - 1); setDataAtual(d); }} className="transition-all hover:scale-105 w-7 h-7 sm:w-9 sm:h-9" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, cursor: "pointer", color: C.sidebarBg }}>
            <FiChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <div style={{ position: "relative" }}>
            <input id="calendario-invisivel" type="date" value={`${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}-${String(dataAtual.getDate()).padStart(2, '0')}`} onChange={(e) => { if (!e.target.value) return; const [y, m, d] = e.target.value.split('-').map(Number); setDataAtual(new Date(y, m - 1, d)); }} style={{ position: "absolute", width: 0, height: 0, opacity: 0, border: "none" }} />
            <div onClick={() => (document.getElementById('calendario-invisivel') as HTMLInputElement | null)?.showPicker()} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: RAIO_MD, transition: "background 0.2s" }} onMouseOver={(e) => e.currentTarget.style.background = C.bg} onMouseOut={(e) => e.currentTarget.style.background = "transparent"}>
              <h2 className="font-title text-xs sm:text-base" style={{ margin: 0, fontWeight: 700, color: C.textMain, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>{dataAtual.toLocaleDateString('pt-BR')} <FiCalendar className="w-3 h-3 sm:w-4 sm:h-4" style={{color: C.textLight}} /></h2>
              <span className="text-[11px] sm:text-sm" style={{ color: C.textLight, textTransform: "capitalize", fontWeight: 500, whiteSpace: "nowrap" }}>· {dataAtual.toLocaleDateString('pt-BR', { weekday: 'long' })}</span>
            </div>
          </div>

          <button onClick={() => { const d = new Date(dataAtual); d.setDate(d.getDate() + 1); setDataAtual(d); }} className="transition-all hover:scale-105 w-7 h-7 sm:w-9 sm:h-9" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, cursor: "pointer", color: C.sidebarBg }}>
            <FiChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {isAdminOuRecepcao && (
            <div className="pl-2 sm:pl-4" style={{ marginLeft: 4, borderLeft: `1px solid ${C.borderMid}`, display: "flex", alignItems: "center" }}>
              <select className="font-body text-xs sm:text-sm py-1.5 px-2 sm:py-2 sm:px-3.5" value={filtroFuncao} onChange={(e) => setFiltroFuncao(e.target.value)} style={{ borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, background: C.bgCard, color: C.sidebarBg, fontWeight: 600, outline: "none", cursor: "pointer" }}>
                <option value="">Todas as Funções</option>
                {todasFuncoes.map((funcao: string) => <option key={funcao} value={funcao}>{funcao}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <span className="font-body hidden sm:flex" style={{ padding: "6px 14px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "#F4F8F5", color: "#3B4A3F", alignItems: "center", gap: 8, border: "1px solid #E8F0EA" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: C.success, animation: "pulse 2s infinite" }}></div> Sistema Online
        </span>

        <button onClick={onNovoAgendamento} className="font-body transition-all hover:scale-[1.02] text-xs sm:text-sm px-3 sm:px-5 py-2 sm:py-2.5" style={{ display: "flex", alignItems: "center", gap: 6, background: C.btnPrimary, color: "#fff", border: "none", borderRadius: RAIO_MD, fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", whiteSpace: "nowrap" }}>
          <FiPlus className="w-4 h-4 sm:w-[18px] sm:h-[18px]" /> Novo Agendamento
        </button>
      </div>
    </div>
  );
}
