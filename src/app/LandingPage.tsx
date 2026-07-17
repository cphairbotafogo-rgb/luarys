'use client'
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { C } from '@/lib/constants';
import { RAIO_LG, RAIO_XL, RAIO_2XL } from '@/lib/estiloGlobal';
import {
  FiTrendingUp, FiDollarSign, FiTag, FiArrowRight,
  FiCalendar, FiUsers, FiPackage, FiBarChart2,
  FiCheckCircle, FiMenu, FiX, FiInstagram, FiMail,
} from 'react-icons/fi';
import { AnimacaoLogo } from './AnimacaoLogo';

const MODULOS_DESTAQUE = [
  {
    icone: <FiCalendar size={28} color={C.douradoEleva} />,
    titulo: 'Agenda Visual',
    descricao: 'Calendário por profissional com arrastar e soltar. Confirmações automáticas, bloqueios e lista de espera integrados.',
    destaque: true,
  },
  {
    icone: <FiDollarSign size={28} color={C.douradoEleva} />,
    titulo: 'Caixa & Financeiro',
    descricao: 'Fechamento de conta por atendimento, múltiplas formas de pagamento e comissões calculadas automaticamente. Relatório do dia em segundos.',
    destaque: true,
  },
];

const MODULOS_GRID = [
  { icone: <FiTag size={22} color={C.douradoEleva} />, titulo: 'Precificação', descricao: 'Preço baseado em custo real e margem desejada.' },
  { icone: <FiUsers size={22} color={C.douradoEleva} />, titulo: 'Equipe', descricao: 'Profissionais, serviços, horários e comissões.' },
  { icone: <FiPackage size={22} color={C.douradoEleva} />, titulo: 'Estoque & PDV', descricao: 'Produtos, movimentações e venda no balcão.' },
  { icone: <FiBarChart2 size={22} color={C.douradoEleva} />, titulo: 'Relatórios', descricao: 'Performance, retenção de clientes e rankings.' },
  { icone: <FiTrendingUp size={22} color={C.douradoEleva} />, titulo: 'Crescimento', descricao: 'Clientes em risco e horários ociosos com ação direta.' },
  { icone: <FiCheckCircle size={22} color={C.douradoEleva} />, titulo: 'Portal do Cliente', descricao: 'Link próprio com agendamento online e vitrine.' },
];

const STATS = [
  { valor: '8+', label: 'módulos integrados' },
  { valor: '5 dias', label: 'grátis sem cartão' },
  { valor: '100%', label: 'dados isolados por salão' },
  { valor: '24/7', label: 'agendamento online' },
];

const ANIMACOES_CSS = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(28px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes flutuarMockup {
    0%, 100% { transform: perspective(1200px) rotateX(6deg) translateY(0px); }
    50%       { transform: perspective(1200px) rotateX(6deg) translateY(-10px); }
  }
  .hero-fadeup {
    opacity: 0;
    animation: fadeUp 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  }
  .hero-fadeup-1 { animation-delay: 4.8s; }
  .hero-fadeup-2 { animation-delay: 5.1s; }
  .hero-fadeup-3 { animation-delay: 5.4s; }
  .mockup-wrap {
    animation: flutuarMockup 5s ease-in-out infinite;
    animation-delay: 6s;
  }
  .scroll-reveal {
    opacity: 0;
    transform: translateY(32px);
    transition: opacity 0.6s ease, transform 0.6s ease;
  }
  .scroll-reveal.visivel {
    opacity: 1;
    transform: translateY(0);
  }
  .card-hover {
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .card-hover:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 32px rgba(0,0,0,0.1);
  }
  .card-escuro-hover {
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .card-escuro-hover:hover {
    transform: translateY(-4px);
    box-shadow: 0 16px 40px rgba(0,0,0,0.35);
  }
  .btn-hover {
    transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
  }
  .btn-hover:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0,0,0,0.2);
    opacity: 0.93;
  }
  @media (prefers-reduced-motion: reduce) {
    .hero-fadeup, .scroll-reveal { animation: none; opacity: 1; transform: none; }
    .mockup-wrap { animation: none; }
  }
`;

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('visivel'); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function MockupAgenda() {
  return (
    <div style={{ position: 'relative', maxWidth: 480, margin: '0 auto', borderRadius: RAIO_2XL, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <img src="/mockup-agenda.png" alt="Sistema Luarys" style={{ width: '100%', display: 'block' }} />
      {/* Blur sobre o nome do proprietário no header */}
      <div style={{ position: 'absolute', top: 0, right: 0, width: '45%', height: 48, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', background: 'rgba(28,35,43,0.4)' }} />
    </div>
  );
}

export function LandingPage() {
  const router = useRouter();
  const [menuAberto, setMenuAberto] = useState(false);

  const refNumeros    = useScrollReveal();
  const refDestaque   = useScrollReveal();
  const refGrid       = useScrollReveal();
  const refCta        = useScrollReveal();

  function ir(path: string) { router.push(path); setMenuAberto(false); }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
      <style>{ANIMACOES_CSS}</style>

      {/* ─── NAVBAR ─── */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 5%', height: 64, borderBottom: `1px solid ${C.border}`, background: '#fff', position: 'sticky', top: 0, zIndex: 100 }}>
        <img src={C.logoUrl} alt="Luarys" style={{ height: 44 }} />

        {/* Desktop links */}
        <div className="nav-desktop" style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <a href="#funcionalidades" style={{ fontSize: 13, fontWeight: 600, color: C.textMuted, textDecoration: 'none' }}>Funcionalidades</a>
          <a href="#numeros" style={{ fontSize: 13, fontWeight: 600, color: C.textMuted, textDecoration: 'none' }}>Por que Luarys</a>
          <button onClick={() => ir('/login')} style={{ padding: '8px 18px', borderRadius: RAIO_LG, border: `1px solid ${C.border}`, background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: C.textMain }}>Entrar</button>
          <button onClick={() => ir('/cadastro')} style={{ padding: '8px 18px', borderRadius: RAIO_LG, border: 'none', background: C.sidebarBg, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
            Começar grátis <FiArrowRight size={13} />
          </button>
        </div>

        {/* Mobile botão */}
        <button onClick={() => setMenuAberto(v => !v)} style={{ display: 'none' }} className="nav-mobile-btn">
          {menuAberto ? <FiX size={22} color={C.textMain} /> : <FiMenu size={22} color={C.textMain} />}
        </button>
      </nav>

      {/* Menu mobile */}
      {menuAberto && (
        <div style={{ position: 'fixed', top: 64, left: 0, right: 0, background: '#fff', borderBottom: `1px solid ${C.border}`, padding: '16px 5%', zIndex: 99, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <a href="#funcionalidades" onClick={() => setMenuAberto(false)} style={{ fontSize: 15, fontWeight: 600, color: C.textMain, textDecoration: 'none' }}>Funcionalidades</a>
          <a href="#numeros" onClick={() => setMenuAberto(false)} style={{ fontSize: 15, fontWeight: 600, color: C.textMain, textDecoration: 'none' }}>Por que Luarys</a>
          <button onClick={() => ir('/login')} style={{ padding: '12px', borderRadius: RAIO_LG, border: `1px solid ${C.border}`, background: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: C.textMain }}>Entrar</button>
          <button onClick={() => ir('/cadastro')} style={{ padding: '12px', borderRadius: RAIO_LG, border: 'none', background: C.sidebarBg, cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#fff' }}>Começar grátis</button>
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          .nav-desktop { display: none !important; }
          .nav-mobile-btn { display: flex !important; background: none; border: none; cursor: pointer; padding: 4px; }
        }
      `}</style>

      {/* ─── HERO ─── */}
      <section style={{ background: `radial-gradient(ellipse 120% 90% at 50% 38%, #2c3643 0%, #1c232b 70%)`, padding: '40px 5% 0', textAlign: 'center' }}>
        <AnimacaoLogo />

        <div style={{ marginTop: -16, paddingBottom: 0 }}>
          <div className="hero-fadeup hero-fadeup-1" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(212,175,55,0.15)', border: `1px solid rgba(212,175,55,0.3)`, borderRadius: 99, padding: '6px 16px', marginBottom: 20 }}>
            <FiCheckCircle size={13} color={C.douradoEleva} />
            <span style={{ fontSize: 12, fontWeight: 700, color: C.douradoEleva }}>5 dias grátis · Sem cartão de crédito</span>
          </div>
          <p className="hero-fadeup hero-fadeup-2" style={{ fontSize: 16, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, maxWidth: 480, margin: '0 auto 28px' }}>
            Agenda, caixa, equipe, estoque e relatórios num único lugar. Feito para salões que querem crescer de verdade.
          </p>
          <div className="hero-fadeup hero-fadeup-3" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 48 }}>
            <button onClick={() => ir('/cadastro')} className="btn-hover" style={{ padding: '14px 32px', borderRadius: RAIO_XL, border: 'none', background: C.douradoEleva, cursor: 'pointer', fontSize: 15, fontWeight: 800, color: C.sidebarBg, display: 'flex', alignItems: 'center', gap: 8 }}>
              Começar grátis <FiArrowRight size={15} />
            </button>
            <button onClick={() => ir('/login')} className="btn-hover" style={{ padding: '14px 32px', borderRadius: RAIO_XL, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', cursor: 'pointer', fontSize: 15, fontWeight: 700, color: '#fff' }}>
              Já tenho conta
            </button>
          </div>
        </div>

        {/* Mockup produto */}
        <div className="mockup-wrap" style={{ maxWidth: 520, margin: '0 auto', transform: 'perspective(1200px) rotateX(6deg)', transformOrigin: 'center top' }}>
          <MockupAgenda />
        </div>

        <div style={{ height: 80, background: 'linear-gradient(to bottom, transparent, #f8f9fb)', marginTop: -20 }} />
      </section>

      {/* ─── NÚMEROS ─── */}
      <section id="numeros" style={{ background: '#f8f9fb', padding: '52px 5%' }}>
        <div ref={refNumeros} className="scroll-reveal" style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 32, textAlign: 'center' }}>
          {STATS.map((s, i) => (
            <div key={i} className="card-hover" style={{ padding: '24px 16px', background: '#fff', borderRadius: RAIO_2XL, border: `1px solid ${C.border}` }}>
              <p style={{ fontSize: 38, fontWeight: 900, color: C.sidebarBg, margin: '0 0 6px' }}>{s.valor}</p>
              <p style={{ fontSize: 12, color: C.textLight, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FUNCIONALIDADES ─── */}
      <section id="funcionalidades" style={{ padding: '72px 5%', background: '#fff' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(22px, 3vw, 34px)', fontWeight: 800, color: C.textMain, marginBottom: 10 }}>
            Tudo o que seu salão precisa
          </h2>
          <p style={{ textAlign: 'center', fontSize: 15, color: C.textLight, marginBottom: 48 }}>
            Cada módulo foi pensado para o dia a dia de quem trabalha com beleza.
          </p>

          {/* Cards em destaque */}
          <div ref={refDestaque} className="scroll-reveal" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 20 }}>
            {MODULOS_DESTAQUE.map((m, i) => (
              <div key={i} className="card-escuro-hover" style={{ background: `linear-gradient(135deg, ${C.sidebarBg} 0%, #1E252F 100%)`, borderRadius: RAIO_2XL, padding: '32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ width: 56, height: 56, borderRadius: RAIO_XL, background: 'rgba(212,175,55,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {m.icone}
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0 }}>{m.titulo}</h3>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, margin: 0 }}>{m.descricao}</p>
              </div>
            ))}
          </div>

          {/* Grade de módulos secundários */}
          <div ref={refGrid} className="scroll-reveal" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {MODULOS_GRID.map((m, i) => (
              <div key={i} className="card-hover" style={{ background: C.bg, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, padding: '20px 22px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ width: 40, height: 40, borderRadius: RAIO_LG, background: 'rgba(212,175,55,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {m.icone}
                </div>
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 800, color: C.textMain, margin: '0 0 4px' }}>{m.titulo}</h4>
                  <p style={{ fontSize: 12, color: C.textLight, lineHeight: 1.6, margin: 0 }}>{m.descricao}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA FINAL ─── */}
      <section ref={refCta} className="scroll-reveal" style={{ background: 'linear-gradient(to bottom, #fff 0%, #1c232b 120px)', padding: '72px 5%', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(22px, 3vw, 36px)', fontWeight: 900, color: '#fff', marginBottom: 14 }}>
          Pronto para transformar seu salão?
        </h2>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', marginBottom: 36 }}>
          Comece hoje. 5 dias grátis, sem cartão de crédito.
        </p>
        <button onClick={() => ir('/cadastro')} className="btn-hover" style={{ padding: '16px 40px', borderRadius: RAIO_XL, border: 'none', background: C.douradoEleva, cursor: 'pointer', fontSize: 16, fontWeight: 800, color: C.sidebarBg, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          Começar grátis <FiArrowRight size={16} />
        </button>
      </section>

      {/* ─── FOOTER ─── */}
      <footer style={{ background: '#1c232b', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '40px 5% 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 32, marginBottom: 32 }}>
            <div>
              <img src={C.logoUrl} alt="Luarys" style={{ height: 36, marginBottom: 12 }} />
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7, margin: 0 }}>
                Sistema de gestão para salões de beleza. Simples, completo e seguro.
              </p>
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Sistema</p>
              {['Funcionalidades', 'Preços', 'Cadastro', 'Login'].map(l => (
                <a key={l} href={l === 'Cadastro' ? '/cadastro' : l === 'Login' ? '/login' : '#funcionalidades'} style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.5)', textDecoration: 'none', marginBottom: 8 }}>{l}</a>
              ))}
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Legal</p>
              {['Privacidade', 'Termos', 'DPA'].map(l => (
                <a key={l} href={`/${l.toLowerCase()}`} style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.5)', textDecoration: 'none', marginBottom: 8 }}>{l}</a>
              ))}
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Contato</p>
              <a href="mailto:contato@luarys.com.br" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.5)', textDecoration: 'none', marginBottom: 12 }}>
                <FiMail size={14} /> contato@luarys.com.br
              </a>
              <a href="https://instagram.com/luarys" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>
                <FiInstagram size={14} /> @luarys
              </a>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 20, textAlign: 'center' }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', margin: 0 }}>© {new Date().getFullYear()} Luarys · Todos os direitos reservados</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
