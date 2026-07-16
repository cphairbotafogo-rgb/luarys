import { useState, useEffect, useMemo, useRef } from "react";

const ALTURAS_LINHA: Record<string, number> = { P: 48, M: 64, G: 80, GG: 96 };
const LARGURAS_COLUNA: Record<string, number> = { P: 140, M: 180, G: 220, GG: 260 };

export function useAgendaLayout(dadosSalao: any, dataAtual: Date, setAgendamentos: any) {
  const [tamanhoLinha, setTamanhoLinha] = useState('M');
  const [tamanhoColuna, setTamanhoColuna] = useState('M');
  const [mostrarFolgas, setMostrarFolgas] = useState(true);
  const [sidebarAberta, setSidebarAberta] = useState(true);
  const [redimensionando, setRedimensionando] = useState<any>(null);
  
  const gridScrollRef = useRef<HTMLDivElement>(null);

  // Recupera o tamanho da grade salvo no navegador do usuário
  useEffect(() => {
    const salvaLinha = localStorage.getItem('@eleva:tamanhoLinha');
    const salvaColuna = localStorage.getItem('@eleva:tamanhoColuna');
    if (salvaLinha) setTamanhoLinha(salvaLinha);
    if (salvaColuna) setTamanhoColuna(salvaColuna);
  }, []);

  const alterarTamanhoLinha = (val: string) => {
    setTamanhoLinha(val);
    localStorage.setItem('@eleva:tamanhoLinha', val);
  };
  const alterarTamanhoColuna = (val: string) => {
    setTamanhoColuna(val);
    localStorage.setItem('@eleva:tamanhoColuna', val);
  };

  const ALTURA_HORA = ALTURAS_LINHA[tamanhoLinha] ?? 64;
  const ALTURA_MINUTO = ALTURA_HORA / 60;
  const LARGURA_COLUNA = LARGURAS_COLUNA[tamanhoColuna] ?? 180;

  const HORA_INICIO: number = useMemo(() => {
    const h = dadosSalao?.hora_abertura;
    return h ? parseInt(h.split(':')[0], 10) : 8;
  }, [dadosSalao]);

  const HORA_FIM: number = useMemo(() => {
    const h = dadosSalao?.hora_fechamento;
    return h ? parseInt(h.split(':')[0], 10) : 20;
  }, [dadosSalao]);

  const horasDoDia: number[] = useMemo(() => {
    const horas: number[] = [];
    for (let h = HORA_INICIO; h <= HORA_FIM; h++) horas.push(h);
    return horas;
  }, [HORA_INICIO, HORA_FIM]);

  const horariosDoDia: string[] = useMemo(() => {
    const slots: string[] = [];
    for (let h = HORA_INICIO; h < HORA_FIM; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`);
      slots.push(`${String(h).padStart(2, '0')}:30`);
    }
    return slots;
  }, [HORA_INICIO, HORA_FIM]);

  const diaSalaoFechado: boolean = useMemo(() => {
    if (!dadosSalao?.dias_funcionamento) return false;
    const diaSemana = dataAtual.getDay(); 
    const diasAbertos: number[] = dadosSalao.dias_funcionamento;
    return !diasAbertos.includes(diaSemana);
  }, [dadosSalao, dataAtual]);

  // Scroll automático para o início do dia
  useEffect(() => {
    if (!gridScrollRef.current || diaSalaoFechado) return;
    setTimeout(() => {
      gridScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 80);
  }, [dataAtual, diaSalaoFechado]);

  // Lógica de arrastar e soltar (Redimensionamento de horário)
  const iniciarRedimensionamento = (e: any, ag: any) => {
    e.stopPropagation();
    setRedimensionando({ id: ag.id, startY: e.clientY, startDuracao: ag.duracaoMin });
  };

  const aoMoverMouse = (e: any) => {
    if (!redimensionando) return;
    const deltaMinutos = Math.round((e.clientY - redimensionando.startY) / ALTURA_MINUTO);
    setAgendamentos((prev: any) => prev.map((ag: any) =>
      ag.id === redimensionando.id
        ? { ...ag, duracaoMin: Math.max(5, redimensionando.startDuracao + deltaMinutos) }
        : ag
    ));
  };

  const aoSoltarMouse = () => { if (redimensionando) setRedimensionando(null); };

  return {
    tamanhoLinha, alterarTamanhoLinha,
    tamanhoColuna, alterarTamanhoColuna,
    mostrarFolgas, setMostrarFolgas,
    sidebarAberta, setSidebarAberta,
    redimensionando, setRedimensionando,
    gridScrollRef,
    ALTURA_HORA, ALTURA_MINUTO, LARGURA_COLUNA,
    HORA_INICIO, HORA_FIM, horasDoDia, horariosDoDia,
    diaSalaoFechado,
    iniciarRedimensionamento, aoMoverMouse, aoSoltarMouse
  };
}