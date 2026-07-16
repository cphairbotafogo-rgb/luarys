'use client'
import { C } from "@/lib/constants";
import { RAIO_LG, SOMBRA_ELEVADO } from "@/lib/estiloGlobal";
import { FiClock, FiCoffee, FiCalendar, FiPlus } from "react-icons/fi";

export function MenuContexto({ menuContexto, setMenuContexto, registrarAlmocoRapido, abrirModalAusenciaPeloMenu, abrirNovoAgendamento }: any) {
  if (!menuContexto.visivel) return null;

  return (
    <div className="font-body">
      {/* Overlay invisível para fechar ao clicar fora */}
      <div 
        style={{ position: 'fixed', inset: 0, zIndex: 9998 }} 
        onClick={() => setMenuContexto({ ...menuContexto, visivel: false })} 
        onContextMenu={(e) => { e.preventDefault(); setMenuContexto({ ...menuContexto, visivel: false }); }} 
      />
      
      {/* O Menu em Si */}
      <div style={{
        position: 'fixed', top: menuContexto.y, left: menuContexto.x, zIndex: 9999,
        background: C.bgCard, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_LG,
        boxShadow: SOMBRA_ELEVADO, width: 220, display: 'flex',
        flexDirection: 'column', overflow: 'hidden'
      }}>
        
        {/* Topo do Menu (Horário) */}
        <div style={{ background: C.sidebarBg, color: '#fff', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <FiClock size={14} style={{ opacity: 0.8 }} />
          <span className="font-title tracking-wider" style={{ fontSize: 12, fontWeight: 700 }}>{menuContexto.hora}</span>
        </div>
        
        {/* Agendar aqui — abre modal Novo Agendamento com data/hora pré-preenchidos */}
        <button
          onClick={() => {
            setMenuContexto({ ...menuContexto, visivel: false });
            abrirNovoAgendamento?.(menuContexto.profId, menuContexto.hora);
          }}
          className="transition-all"
          style={{ background: 'none', border: 'none', textAlign: 'left', padding: '12px 16px', fontSize: 12, color: C.sidebarBg, borderBottom: `1px solid ${C.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}
          onMouseOver={e => e.currentTarget.style.background = C.bg}
          onMouseOut={e => e.currentTarget.style.background = 'none'}
        >
          <FiCalendar size={14}/> Agendar aqui
        </button>
        
        {/* Título da Seção */}
        <div className="font-title uppercase tracking-widest" style={{ padding: '12px 16px 6px', fontSize: 10, color: C.textMuted, fontWeight: 700 }}>
          Bloquear Horário
        </div>
        
        {/* Ações */}
        <button 
          onClick={() => registrarAlmocoRapido(30)} 
          className="transition-all"
          style={{ background: 'none', border: 'none', textAlign: 'left', padding: '10px 16px 10px 32px', fontSize: 12, cursor: 'pointer', color: C.textMain, fontWeight: 500 }} 
          onMouseOver={e => e.currentTarget.style.background = C.bg}
          onMouseOut={e => e.currentTarget.style.background = 'none'}
        >
          Almoço (30 min)
        </button>
        
        <button 
          onClick={() => registrarAlmocoRapido(60)} 
          className="transition-all"
          style={{ background: 'none', border: 'none', textAlign: 'left', padding: '10px 16px 10px 32px', fontSize: 12, cursor: 'pointer', color: C.textMain, fontWeight: 500 }} 
          onMouseOver={e => e.currentTarget.style.background = C.bg}
          onMouseOut={e => e.currentTarget.style.background = 'none'}
        >
          Almoço (Uma hora)
        </button>
        
        <button 
          onClick={abrirModalAusenciaPeloMenu} 
          className="transition-all"
          style={{ background: 'none', border: 'none', textAlign: 'left', padding: '10px 16px 12px 32px', fontSize: 12, cursor: 'pointer', color: C.sidebarBg, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }} 
          onMouseOver={e => e.currentTarget.style.background = C.bg}
          onMouseOut={e => e.currentTarget.style.background = 'none'}
        >
          <FiPlus size={12}/> Mais Opções...
        </button>
      </div>
    </div>
  );
}