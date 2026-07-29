'use client'
import { C } from "@/lib/constants";
// Se o seu componente <Btn /> interno tiver conflitos com o Tailwind, 
// o uso da tag <button> direta aqui garante a precisão do design.

export function Header({ title, onNovoAgendamento }: any) {
  return (
    <header
      className="flex items-center justify-between gap-2 pl-16 pr-4 sm:px-8 shrink-0 bg-white shadow-sm"
      style={{ height: "74px", borderBottom: `1px solid ${C.border}` }}
    >
      {/* TÍTULO (Imponente e Limpo) — pl-16 no celular abre espaço pro botão de menu (☰) da Sidebar */}
      <h1
        className="m-0 font-title font-bold uppercase tracking-widest text-sm sm:text-lg truncate min-w-0"
        style={{ color: C.sidebarBg }}
      >
        {title}
      </h1>

      <div className="flex items-center gap-2 sm:gap-5 shrink-0">

        {/* BADGE DE SISTEMA (Sutil e elegante) — some no celular, não cabe */}
        <span
          className="hidden sm:flex px-3 py-1.5 rounded-full text-[11px] font-bold font-body shadow-sm items-center gap-2"
          style={{ background: "#F4F8F5", color: "#3B4A3F", border: "1px solid #E8F0EA" }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.success }}></span>
          Sistema Online
        </span>

        {/* BOTÃO PRINCIPAL (Adeus, laranja!) */}
        <button
          onClick={onNovoAgendamento}
          className="font-body font-semibold text-xs sm:text-sm px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg transition-all shadow-sm cursor-pointer hover:scale-[1.02] whitespace-nowrap"
          style={{ background: C.btnPrimary, color: "#fff", border: "none" }}
        >
          Novo Agendamento
        </button>

      </div>
    </header>
  );
}