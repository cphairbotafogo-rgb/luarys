'use client'
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { RAIO_MD } from "@/lib/estiloGlobal";
import { FiInfo, FiTrash2, FiX } from "react-icons/fi";

export function BannerAmbienteDemo({ perfil, onLimpo }: any) {
  const [limpando, setLimpando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [oculto, setOculto] = useState(false);

  if (oculto) return null;

  async function limparDadosDemo() {
    if (!perfil?.salao_id) return;
    setLimpando(true);

    try {
      await Promise.all([
        supabase.from('agendamentos').delete().eq('salao_id', perfil.salao_id).eq('is_demo', true),
        supabase.from('profissionais').delete().eq('salao_id', perfil.salao_id).eq('is_demo', true),
        supabase.from('servicos').delete().eq('salao_id', perfil.salao_id).eq('is_demo', true),
      ]);

      await supabase.from('saloes').update({ ambiente_demo: false }).eq('id', perfil.salao_id);

      if (onLimpo) onLimpo();
    } catch (e) {
      // Mesmo se algo falhar, esconde o banner — não é uma operação crítica
    } finally {
      setLimpando(false);
      setConfirmando(false);
      setOculto(true);
    }
  }

  return (
    <div style={{
      background: "#FFFBEB",
      borderBottom: `1px solid #FDE68A`,
      padding: "12px 24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
      flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <FiInfo size={18} color="#B45309" style={{ flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: 13, color: "#92400E", fontWeight: 500 }}>
          Este é o seu ambiente com <strong>dados de exemplo</strong> — explore a agenda, o caixa e os relatórios. Quando estiver pronto, limpe os exemplos e cadastre os dados reais do seu salão.
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {!confirmando ? (
          <>
            <button
              onClick={() => setConfirmando(true)}
              style={{ background: "#B45309", color: "#fff", border: "none", padding: "8px 16px", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              <FiTrash2 size={14} /> Limpar exemplos e começar
            </button>
            <button
              onClick={() => setOculto(true)}
              title="Esconder este aviso (os dados de exemplo continuam aqui)"
              style={{ background: "transparent", border: "none", color: "#B45309", cursor: "pointer", padding: 4, display: "flex" }}
            >
              <FiX size={18} />
            </button>
          </>
        ) : (
          <>
            <span style={{ fontSize: 12, color: "#92400E", fontWeight: 700 }}>Remover serviços, profissionais e agendamentos de exemplo?</span>
            <button
              onClick={limparDadosDemo}
              disabled={limpando}
              style={{ background: C.danger, color: "#fff", border: "none", padding: "8px 16px", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: limpando ? "not-allowed" : "pointer", opacity: limpando ? 0.7 : 1 }}
            >
              {limpando ? "Limpando..." : "Sim, limpar"}
            </button>
            <button
              onClick={() => setConfirmando(false)}
              disabled={limpando}
              style={{ background: "transparent", border: `1px solid #B45309`, color: "#B45309", padding: "8px 16px", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Cancelar
            </button>
          </>
        )}
      </div>
    </div>
  );
}