'use client'
import { FiLoader } from "react-icons/fi";
import { C } from "@/lib/constants";
import { useGuardModulo } from "@/lib/useGuardModulo";
import { BloqueioModulo } from "@/components/BloqueioModulo";

export function GavetaLembretePremium({ perfil }: any) {
  const liberado = useGuardModulo(perfil?.salao_id, 'lembrete_premium');

  if (liberado === null) return (
    <div style={{ padding: 32, color: C.textLight, display: 'flex', alignItems: 'center', gap: 10 }}>
      <FiLoader className="animate-spin" size={16} /> Verificando acesso...
    </div>
  );

  if (!liberado) return (
    <BloqueioModulo
      salaoId={perfil?.salao_id}
      moduloChave="lembrete_premium"
      nome="Lembrete Premium"
      descricao="Lembretes automáticos de agendamento por WhatsApp com confirmação de presença — reduza faltas e mantenha sua agenda cheia."
      preco={19.90}
      itens={[
        'Lembrete 24h antes por WhatsApp',
        'Botão de confirmar ou cancelar',
        'Reagendamento automático pelo cliente',
        'Múltiplos disparos configuráveis',
        'Relatório de confirmações',
      ]}
    />
  );

  return (
    <div style={{ padding: 32, color: C.textMain }}>
      <h2 style={{ marginBottom: 8, fontSize: 20, fontWeight: 800 }}>Lembrete Premium</h2>
      <p style={{ color: C.textMuted, fontSize: 14 }}>
        Módulo em configuração. Em breve você poderá personalizar o texto e o horário dos lembretes automáticos.
      </p>
    </div>
  );
}
