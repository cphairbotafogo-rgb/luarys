'use client'

interface Props {
  /** Modo compacto: só estrela + wordmark, sem tagline nem filete, sem o scale de landing page */
  compacto?: boolean;
}

export function AnimacaoLogo({ compacto = false }: Props) {
  return (
    <>
      <style>{`
        .palco {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 2rem;
          text-align: center;
        }
        .estrela-wrap {
          position: relative;
          width: clamp(140px, 24vmin, 220px);
          aspect-ratio: 200 / 260;
          margin-bottom: clamp(2rem, 6vmin, 3.5rem);
        }
        .estrela-wrap svg {
          width: 100%; height: 100%; display: block; overflow: visible;
        }
        .traco-estrela {
          fill: none;
          stroke: url(#gradienteOuro);
          stroke-width: 4.5;
          stroke-linecap: round;
          stroke-dasharray: 760;
          stroke-dashoffset: 760;
          animation: desenhar 2.4s cubic-bezier(0.65,0,0.25,1) 0.4s forwards;
        }
        .ponto-topo {
          fill: url(#gradienteOuro);
          opacity: 0;
          transform-origin: 100px 20px;
          transform: scale(0);
          animation: surgirPonto 0.7s cubic-bezier(0.2,1.4,0.4,1) 2.5s forwards;
        }
        .halo {
          position: absolute;
          inset: 12% 8% 20% 8%;
          background: radial-gradient(circle at 50% 48%, rgba(212,175,55,0.28) 0%, transparent 62%);
          filter: blur(14px);
          opacity: 0;
          animation: respiracaoHalo 5.5s ease-in-out 3.4s infinite;
          pointer-events: none;
        }
        .faisca {
          position: absolute;
          width: 5px; height: 5px;
          background: #f0d99a;
          border-radius: 50%;
          opacity: 0;
          box-shadow: 0 0 8px 2px rgba(240,217,154,0.55);
        }
        .faisca-1 { top: 22%; left: 12%; animation: cintilar 4.8s ease-in-out 3.8s infinite; }
        .faisca-2 { top: 60%; right: 8%; animation: cintilar 5.6s ease-in-out 4.6s infinite; }
        .wordmark-anim {
          display: flex;
          justify-content: center;
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-weight: 500;
          font-size: clamp(2.6rem, 9vmin, 5.2rem);
          line-height: 1;
          color: transparent;
          background: linear-gradient(100deg, #f0d99a 0%, #d4af37 32%, #9a7420 55%, #d4af37 78%, #f0d99a 100%);
          background-size: 250% 100%;
          background-clip: text;
          -webkit-background-clip: text;
          animation: brilhoVarredura 7s ease-in-out 4.5s infinite;
        }
        .wordmark-anim span {
          display: inline-block;
          opacity: 0;
          transform: translateY(0.45em);
          filter: blur(6px);
          margin: 0 clamp(0.28rem, 1.6vmin, 0.85rem);
          animation: letraSurge 1.1s cubic-bezier(0.2,0.8,0.2,1) forwards;
        }
        .wordmark-anim span:nth-child(1) { animation-delay: 2.7s; }
        .wordmark-anim span:nth-child(2) { animation-delay: 2.85s; }
        .wordmark-anim span:nth-child(3) { animation-delay: 3.0s; }
        .wordmark-anim span:nth-child(4) { animation-delay: 3.15s; }
        .wordmark-anim span:nth-child(5) { animation-delay: 3.3s; }
        .wordmark-anim span:nth-child(6) { animation-delay: 3.45s; }
        .filete-anim {
          width: min(78vw, 560px);
          height: 1px;
          margin: clamp(1.1rem, 3vmin, 1.8rem) auto clamp(1.4rem, 3.5vmin, 2.2rem);
          background: linear-gradient(90deg, transparent, #d4af37 30%, #f0d99a 50%, #d4af37 70%, transparent);
          transform: scaleX(0);
          transform-origin: center;
          animation: abrirFilete 1.3s cubic-bezier(0.65,0,0.2,1) 3.9s forwards;
        }
        .assinatura-anim {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-style: italic;
          font-weight: 400;
          font-size: clamp(1rem, 3.2vmin, 1.45rem);
          letter-spacing: 0.04em;
          color: #d4af37;
          opacity: 0;
          transform: translateY(14px);
          animation: surgirAssinatura 1.4s cubic-bezier(0.2,0.8,0.2,1) 4.4s forwards;
        }
        /* Modo compacto — estrela menor + wordmark sem tagline */
        .estrela-wrap-compacto {
          position: relative;
          width: 88px;
          aspect-ratio: 200 / 260;
          margin-bottom: 10px;
        }
        .estrela-wrap-compacto svg {
          width: 100%; height: 100%; display: block; overflow: visible;
          filter: drop-shadow(0 0 18px rgba(212,175,55,0.55)) drop-shadow(0 6px 28px rgba(44,54,67,0.18));
        }
        .halo-compacto {
          position: absolute;
          inset: 10% 5% 15% 5%;
          background: radial-gradient(circle at 50% 48%, rgba(212,175,55,0.30) 0%, transparent 65%);
          filter: blur(12px);
          opacity: 0;
          animation: respiracaoHalo 5.5s ease-in-out 3.4s infinite;
          pointer-events: none;
        }
        .faisca-c1 { top: 18%; left: 10%; animation: cintilar 4.8s ease-in-out 3.8s infinite; }
        .faisca-c2 { top: 65%; right: 6%; animation: cintilar 5.6s ease-in-out 4.6s infinite; }
        .wordmark-compacto {
          display: flex;
          justify-content: center;
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-weight: 500;
          font-size: 22px;
          line-height: 1;
          letter-spacing: 7px;
          color: transparent;
          background: linear-gradient(100deg, #f0d99a 0%, #d4af37 32%, #9a7420 55%, #d4af37 78%, #f0d99a 100%);
          background-size: 250% 100%;
          background-clip: text;
          -webkit-background-clip: text;
          animation: brilhoVarredura 7s ease-in-out 4.5s infinite;
        }
        .wordmark-compacto span {
          display: inline-block;
          opacity: 0;
          transform: translateY(0.45em);
          filter: blur(6px);
          animation: letraSurge 1.1s cubic-bezier(0.2,0.8,0.2,1) forwards;
        }
        .wordmark-compacto span:nth-child(1) { animation-delay: 2.7s; }
        .wordmark-compacto span:nth-child(2) { animation-delay: 2.85s; }
        .wordmark-compacto span:nth-child(3) { animation-delay: 3.0s; }
        .wordmark-compacto span:nth-child(4) { animation-delay: 3.15s; }
        .wordmark-compacto span:nth-child(5) { animation-delay: 3.3s; }
        .wordmark-compacto span:nth-child(6) { animation-delay: 3.45s; }
        @keyframes desenhar { to { stroke-dashoffset: 0; } }
        @keyframes surgirPonto { to { opacity: 1; transform: scale(1); } }
        @keyframes respiracaoHalo { 0%,100% { opacity: 0.35; } 50% { opacity: 0.85; } }
        @keyframes cintilar { 0%,100% { opacity: 0; transform: scale(0.4); } 50% { opacity: 0.9; transform: scale(1); } }
        @keyframes letraSurge { to { opacity: 1; transform: translateY(0); filter: blur(0); } }
        @keyframes brilhoVarredura { 0%,100% { background-position: 0% 0; } 50% { background-position: 100% 0; } }
        @keyframes abrirFilete { to { transform: scaleX(1); } }
        @keyframes surgirAssinatura { to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) {
          .traco-estrela { animation: none; stroke-dashoffset: 0; }
          .ponto-topo { animation: none; opacity: 1; transform: scale(1); }
          .halo, .halo-compacto { animation: none; opacity: 0.5; }
          .faisca, .faisca-c1, .faisca-c2 { display: none; }
          .wordmark-anim span, .wordmark-compacto span { animation: none; opacity: 1; transform: none; filter: none; }
          .filete-anim { animation: none; transform: scaleX(1); }
          .assinatura-anim { animation: none; opacity: 1; transform: none; }
        }
      `}</style>

      {compacto ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div className="estrela-wrap-compacto">
            <div className="halo-compacto" />
            <div className="faisca faisca-c1" />
            <div className="faisca faisca-c2" />
            <svg viewBox="0 0 200 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Luarys">
              <defs>
                <linearGradient id="gradienteOuro" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%"  stopColor="#f0d99a" />
                  <stop offset="45%" stopColor="#d4af37" />
                  <stop offset="100%" stopColor="#9a7420" />
                </linearGradient>
              </defs>
              <path className="traco-estrela"
                d="M 100 32 C 97 108, 62 146, 42 150 C 62 154, 97 178, 100 232 C 103 178, 138 154, 158 150 C 138 146, 103 108, 100 32 Z" />
              <circle className="ponto-topo" cx="100" cy="20" r="6" />
            </svg>
          </div>
          <h1 className="wordmark-compacto" aria-label="LUARYS">
            <span>L</span><span>U</span><span>A</span><span>R</span><span>Y</span><span>S</span>
          </h1>
        </div>
      ) : (
        <main className="palco" style={{ transform: 'scale(0.6)', transformOrigin: 'center top', marginBottom: '-140px' }}>
          <div className="estrela-wrap">
            <div className="halo" />
            <div className="faisca faisca-1" />
            <div className="faisca faisca-2" />
            <svg viewBox="0 0 200 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Estrela Luarys">
              <defs>
                <linearGradient id="gradienteOuro" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%"  stopColor="#f0d99a" />
                  <stop offset="45%" stopColor="#d4af37" />
                  <stop offset="100%" stopColor="#9a7420" />
                </linearGradient>
              </defs>
              <path className="traco-estrela" d="M 100 32 C 97 108, 62 146, 42 150 C 62 154, 97 178, 100 232 C 103 178, 138 154, 158 150 C 138 146, 103 108, 100 32 Z" />
              <circle className="ponto-topo" cx="100" cy="20" r="6" />
            </svg>
          </div>

          <h1 className="wordmark-anim" aria-label="LUARYS">
            <span>L</span><span>U</span><span>A</span><span>R</span><span>Y</span><span>S</span>
          </h1>

          <div className="filete-anim" aria-hidden="true" />

          <p className="assinatura-anim">Onde gestão de excelência encontra resultado real.</p>
        </main>
      )}
    </>
  );
}
