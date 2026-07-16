// src/modules/agenda/AbaAgenda.tsx
// Shell da agenda — só layout e roteamento de eventos.
// Toda a lógica está em useAbaAgenda; todos os modais em AgendaModais.
'use client'
import { useState } from 'react';
import { C } from '@/lib/constants';
import { AgendaHeader }  from '@/modules/agenda/AgendaHeader';
import { AgendaSidebar } from '@/modules/agenda/AgendaSidebar';
import { AgendaGrid }    from '@/modules/agenda/AgendaGrid';
import { AgendaModais }  from '@/modules/agenda/AgendaModais';
import { useAbaAgenda }  from '@/modules/agenda/useAbaAgenda';

export function AbaAgenda({ perfil }: any) {
  const [dataAtual, setDataAtual] = useState(new Date());
  const ag = useAbaAgenda(perfil, dataAtual, setDataAtual);

  if (ag.carregando) return (
    <div style={{ padding: 28, color: C.sidebarBg, fontWeight: 800 }}>A carregar Agenda...</div>
  );

  return (
    <div
      onMouseMove={ag.aoMoverMouse} onMouseUp={ag.aoSoltarMouse} onMouseLeave={ag.aoSoltarMouse}
      style={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%', background: C.bg, overflow: 'hidden', userSelect: ag.redimensionando ? 'none' : 'auto' }}
    >
      <AgendaHeader
        dataAtual={dataAtual} setDataAtual={setDataAtual}
        sidebarAberta={ag.sidebarAberta} setSidebarAberta={ag.setSidebarAberta}
        isAdminOuRecepcao={ag.isAdminOuRecepcao}
        filtroFuncao={ag.filtroFuncao} setFiltroFuncao={ag.setFiltroFuncao}
        todasFuncoes={ag.todasFuncoes}
        onNovoAgendamento={() => { ag.setDadosIniciaisModalNovo({ data: ag.dataHojeStr }); ag.setModalNovoAberto(true); }}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <AgendaSidebar
          sidebarAberta={ag.sidebarAberta}
          tamanhoLinha={ag.tamanhoLinha} setTamanhoLinha={ag.alterarTamanhoLinha}
          tamanhoColuna={ag.tamanhoColuna} setTamanhoColuna={ag.alterarTamanhoColuna}
          mostrarFolgas={ag.mostrarFolgas} setMostrarFolgas={ag.setMostrarFolgas}
        />

        <AgendaGrid
          gridScrollRef={ag.gridScrollRef}
          diaSalaoFechado={ag.diaSalaoFechado} horariosDoDia={ag.horariosDoDia}
          profissionaisVisiveis={ag.profissionaisVisiveis} filtroFuncao={ag.filtroFuncao}
          LARGURA_COLUNA={ag.LARGURA_COLUNA} ALTURA_HORA={ag.ALTURA_HORA}
          ALTURA_MINUTO={ag.ALTURA_MINUTO} HORA_INICIO={ag.HORA_INICIO} HORA_FIM={ag.HORA_FIM}
          horasDoDia={ag.horasDoDia} agendamentos={ag.agendamentos}
          dataHojeStr={ag.dataHojeStr} clientesDb={ag.clientesDb}
          mesStr={ag.mesStr} diaStr={ag.diaStr}
          redimensionando={ag.redimensionando}
          aoMoverMouse={ag.aoMoverMouse} aoSoltarMouse={ag.aoSoltarMouse}
          perfil={perfil} dadosSalao={ag.dadosSalao}
          abrirNovoAgendamentoGrid={(profId: string, horarioStr: string) => {
            ag.setDadosIniciaisModalNovo({ profissional_id: profId, data: ag.dataHojeStr, hora: horarioStr });
            ag.setModalNovoAberto(true);
          }}
          lidarComCliqueDireito={ag.lidarComCliqueDireito}
          iniciarRedimensionamento={ag.iniciarRedimensionamento}
          onAlterarStatus={ag.alterarStatusRapido}
          onFecharConta={ag.fecharContaPeloMenu}
          onEditarCliente={ag.abrirEdicaoClientePeloMenu}
          onCancelar={(a: any) => ag.iniciarCancelamentoPeloMenu(a, 'cancelado')}
          onFaltou={(a: any) => ag.iniciarCancelamentoPeloMenu(a, 'faltou')}
          isGerenteOuDono={ag.isAdminOuRecepcao}
          aoClicarAgendamento={(a: any) => {
            if (a.status === 'Finalizado') return;
            if (a.status === 'Bloqueado') { ag.abrirEdicaoBloqueio(a); return; }
            ag.setEditandoAg({ ...a, observacao: a.observacao || '', etiquetas: a.etiquetas || [] });
            ag.setIndexTelefoneZap(0);
            ag.setMostrandoNovaEtiqueta(false);
            ag.setModalEdicaoAberto(true);
          }}
          onDuploCliqueAgendamento={(a: any) => {
            if (a.status === 'Finalizado') ag.setAgDetalhesFinalizado(a);
          }}
        />
      </div>

      <AgendaModais ag={{ ...ag, perfil }} />
    </div>
  );
}
