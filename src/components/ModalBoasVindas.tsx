'use client'
import { useState, useEffect } from "react";
import { C } from "@/lib/constants";
import { RAIO_MD, RAIO_LG, RAIO_XL, RAIO_2XL, overlayModal } from "@/lib/estiloGlobal";
import { FiX, FiScissors, FiUsers, FiCalendar, FiSettings, FiDollarSign, FiCheckCircle } from "react-icons/fi";

const CHAVE_STORAGE = 'luarys_boas_vindas_visto';

const PASSOS = [
  {
    icone: <FiSettings size={22} color="#D4AF37" />,
    titulo: 'Configure o Salão',
    descricao: 'Acesse Configurações e preencha o nome, endereço e horários de funcionamento do seu salão.',
    rota: '#configuracoes',
    rotaLabel: 'Ir para Configurações',
  },
  {
    icone: <FiScissors size={22} color="#3B82F6" />,
    titulo: 'Cadastre seus Serviços',
    descricao: 'Em Serviços e Preços, crie os procedimentos que seu salão oferece (corte, manicure, etc.).',
    rota: '#servicos',
    rotaLabel: 'Ir para Serviços',
  },
  {
    icone: <FiUsers size={22} color="#10B981" />,
    titulo: 'Adicione sua Equipe',
    descricao: 'Em Minha Equipe, cadastre cada profissional com nome, CPF e e-mail de acesso.',
    rota: '#equipe',
    rotaLabel: 'Ir para Equipe',
  },
  {
    icone: <FiCalendar size={22} color="#8B5CF6" />,
    titulo: 'Faça o Primeiro Agendamento',
    descricao: 'Na Agenda, clique em um horário e agende um cliente para começar a usar o sistema no dia a dia.',
    rota: '#agenda',
    rotaLabel: 'Ir para Agenda',
  },
  {
    icone: <FiDollarSign size={22} color="#EF4444" />,
    titulo: 'Feche seu Primeiro Caixa',
    descricao: 'Na Frente de Caixa, acompanhe os lançamentos do dia e feche o caixa ao final do turno.',
    rota: '#caixa',
    rotaLabel: 'Ir para Caixa',
  },
];

interface Props {
  nomeUsuario?: string;
  onNavegar?: (rota: string) => void;
}

export function ModalBoasVindas({ nomeUsuario, onNavegar }: Props) {
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    // Só mostra na primeira visita (persiste em localStorage por dispositivo)
    const visto = localStorage.getItem(CHAVE_STORAGE);
    if (!visto) setAberto(true);
  }, []);

  function fechar() {
    localStorage.setItem(CHAVE_STORAGE, '1');
    setAberto(false);
  }

  function navegar(rota: string) {
    fechar();
    onNavegar?.(rota);
    // Fallback: atualiza o hash da URL para acionar navegação interna
    window.location.hash = rota.replace('#', '');
  }

  if (!aberto) return null;

  return (
    <div style={{ ...overlayModal, zIndex: 10000, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        background: '#fff',
        borderRadius: RAIO_2XL,
        width: '100%',
        maxWidth: 560,
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
        position: 'relative',
      }}>
        {/* Cabeçalho */}
        <div style={{ background: C.sidebarBg, borderRadius: `${RAIO_2XL} ${RAIO_2XL} 0 0`, padding: '28px 32px 24px', color: '#fff', position: 'relative' }}>
          <button onClick={fechar} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: RAIO_MD, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
            <FiX size={16} />
          </button>
          <div style={{ fontSize: 28, marginBottom: 8 }}>👋</div>
          <h2 className="font-title" style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase' }}>
            Bem-vindo{nomeUsuario ? `, ${nomeUsuario}` : ''}!
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: 13, opacity: 0.8, lineHeight: 1.5 }}>
            O Luarys está pronto para transformar a gestão do seu salão. Siga os 5 passos abaixo para configurar tudo em poucos minutos.
          </p>
        </div>

        {/* Passos */}
        <div style={{ padding: '24px 32px 8px' }}>
          <p style={{ margin: '0 0 16px', fontSize: 10, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Por onde começar:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {PASSOS.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: '#F8FAFC', borderRadius: RAIO_LG, border: `1px solid ${C.border}` }}>
                <div style={{ width: 40, height: 40, borderRadius: RAIO_MD, background: '#fff', border: `1px solid ${C.borderMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {p.icone}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: C.textLight, background: C.bg, padding: '1px 6px', borderRadius: 10 }}>{i + 1}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.textMain }}>{p.titulo}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: C.textMuted, lineHeight: 1.5 }}>{p.descricao}</p>
                </div>
                <button
                  onClick={() => navegar(p.rota)}
                  style={{ flexShrink: 0, padding: '7px 12px', background: C.sidebarBg, color: '#fff', border: 'none', borderRadius: RAIO_MD, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Ir →
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Rodapé */}
        <div style={{ padding: '20px 32px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: C.textLight }}>Esta tela aparece apenas uma vez.</span>
          <button onClick={fechar}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: '#F1F5F9', color: C.textMain, border: 'none', borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            <FiCheckCircle size={14} color="#10B981" /> Entendi, vamos lá!
          </button>
        </div>
      </div>
    </div>
  );
}
