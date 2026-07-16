// src/modules/agenda/AgendaModais.tsx
// Agrupador de todos os modais da agenda — sem lógica, só renderização.
// Recebe tudo via props do useAbaAgenda.
'use client'
import { ModalNovoAgendamento }  from '@/modules/agenda/modals/ModalNovoAgendamento';
import { ModalEdicao }           from '@/modules/agenda/modals/ModalEdicao';
import { ModalFichaCliente }     from '@/modules/agenda/modals/ModalFichaCliente';
import { ModalAusencia }         from '@/modules/agenda/modals/ModalAusencia';
import { ModalCancelamento }     from '@/modules/agenda/modals/ModalCancelamento';
import { ModalFechamentoCaixa }  from '@/modules/agenda/modals/ModalFechamentoCaixa';
import { GavetaCadastroCliente } from '@/modules/crm/GavetaCadastroCliente';
import { MenuContexto }                from '@/modules/agenda/modals/MenuContexto';
import { ModalDetalhesFinalizado }     from '@/modules/agenda/modals/ModalDetalhesFinalizado';
import { ModalDetalheBloqueio }        from '@/modules/agenda/modals/ModalDetalheBloqueio';

export function AgendaModais({ ag }: { ag: ReturnType<any> }) {
  return (
    <>
      {ag.modalNovoAberto && (
        <ModalNovoAgendamento
          perfil={ag.perfil}
          dadosIniciais={ag.dadosIniciaisModalNovo}
          onAbrirClienteRapido={() => ag.setModalClienteRapido(true)}
          agendamentosExistentes={ag.agendamentos}
          onClose={(foiSalvo: boolean) => { ag.setModalNovoAberto(false); if (foiSalvo) ag.carregarDadosParaAgenda(); }}
          onVerHistorico={(cliente: any) => {
            ag.setFormCliente(cliente);
            ag.setAbaAtivaCrm('historico');
            ag.setModalEdicaoCliente(true);
          }}
          onEditarCadastro={(cliente: any) => {
            ag.setFormCliente(cliente);
            ag.setAbaAtivaCrm('cadastro');
            ag.setModalEdicaoCliente(true);
          }}
          onSalvarEFaturar={async (inseridos: any[], servicosDb: any[]) => {
            ag.setModalNovoAberto(false);
            await ag.carregarDadosParaAgenda();
            if (!inseridos?.length) return;

            // Formata TODOS os agendamentos inseridos para o fechamento de caixa.
            // Passa a lista completa para evitar race condition: o state de agendamentos
            // pode ainda não refletir os novos registros quando abrirFechamentoDeCaixa roda.
            const dbServicos = ag.servicosDb ?? servicosDb ?? [];
            const todosFormatados = inseridos.map((ins: any) => {
              const srv = dbServicos.find((s: any) => s.id === ins.servico_id);
              return {
                id: ins.id,
                cliente: ins.cliente_nome,
                data: ins.data,
                id_prof: ins.profissional_id,
                profissional_id: ins.profissional_id,
                servico: srv?.nome_servico || srv?.nome || '',
                servico_id: ins.servico_id,
                valor_final: ins.valor_final,
                valor_sinal: ins.valor_sinal ?? 0,
                status: ins.status,
                inicio: ins.inicio,
                observacao: ins.observacao || '',
              };
            });

            ag.abrirFechamentoDeCaixa(todosFormatados[0], todosFormatados);
          }}
        />
      )}

      {ag.modalEdicaoAberto && (
        <ModalEdicao
          editandoAg={ag.editandoAg} setEditandoAg={ag.setEditandoAg}
          clientesDb={ag.clientesDb}
          profissionaisDb={ag.isAdminOuRecepcao ? ag.profissionaisDb : ag.profissionaisVisiveis}
          servicosDb={ag.servicosDb} etiquetasDb={ag.etiquetasDb}
          indexTelefoneZap={ag.indexTelefoneZap} setIndexTelefoneZap={ag.setIndexTelefoneZap}
          mostrandoNovaEtiqueta={ag.mostrandoNovaEtiqueta} setMostrandoNovaEtiqueta={ag.setMostrandoNovaEtiqueta}
          novaTag={ag.novaTag} setNovaTag={ag.setNovaTag}
          agendamentosExistentes={ag.agendamentos}
          onClose={() => ag.setModalEdicaoAberto(false)}
          iniciarCancelamento={() => { ag.setModalEdicaoAberto(false); ag.setModalCancelamentoAberto(true); }}
          salvarEdicao={async () => {
            try { await ag.salvarEdicaoAgendamento(); ag.setModalEdicaoAberto(false); } catch { /* toast já disparado */ }
          }}
          fecharContaComEdicao={async () => {
            try { await ag.salvarEdicaoAgendamento(); } catch { return; }
            ag.setModalEdicaoAberto(false);
            ag.abrirFechamentoDeCaixa();
          }}
          abrirCadastroCliente={() => {
            const c = ag.clientesDb.find((x: any) => x.nome_completo === ag.editandoAg.cliente);
            if (c) { ag.setFormCliente(c); ag.setAbaAtivaCrm('cadastro'); ag.setModalEdicaoCliente(true); }
          }}
          abrirHistoricoCliente={() => {
            const c = ag.clientesDb.find((x: any) => x.nome_completo === ag.editandoAg.cliente);
            if (c) { ag.setFormCliente(c); ag.setAbaAtivaCrm('historico'); ag.setModalEdicaoCliente(true); }
          }}
          abrirWhatsApp={ag.handleAbrirWhatsApp}
          abrirEmail={ag.handleAbrirEmail}
          removerEtiquetaDoAgendamento={ag.removerEtiqueta}
          adicionarEtiquetaAoAgendamento={ag.adicionarEtiqueta}
          salvarNovaEtiqueta={ag.salvarNovaEtiqueta}
          verificarAniversario={ag.verificarAniversario}
          perfil={ag.perfil}
          carregarDadosParaAgenda={ag.carregarDadosParaAgenda}
        />
      )}

      {ag.modalEdicaoCliente && (
        <ModalFichaCliente
          formCliente={ag.formCliente} setFormCliente={ag.setFormCliente}
          abaAtivaCrm={ag.abaAtivaCrm} setAbaAtivaCrm={ag.setAbaAtivaCrm}
          onClose={() => ag.setModalEdicaoCliente(false)}
          etiquetasDb={ag.etiquetasDb}
          salvarFichaCompleta={ag.salvarFichaCliente}
          perfil={ag.perfil}
        />
      )}

      {ag.modalCaixaAberto && (
        <ModalFechamentoCaixa
          perfil={ag.perfil} dadosCaixa={ag.dadosCaixa} setDadosCaixa={ag.setDadosCaixa}
          servicosDb={ag.servicosDb} profissionaisDb={ag.profissionaisAgenda}
          produtosDb={ag.produtosDb} clientesDb={ag.clientesDb}
          onClose={() => ag.setModalCaixaAberto(false)}
          onFinalizar={ag.finalizarFechamentoConta}
          adicionarItemAvulsoCaixa={ag.adicionarItemAvulsoCaixa}
        />
      )}

      {ag.modalAusenciaAberto && (
        <ModalAusencia
          formAusencia={ag.formAusencia} setFormAusencia={ag.setFormAusencia}
          profissionaisDb={ag.profissionaisAgenda}
          bloqueioEditandoId={ag.bloqueioEditandoId} setBloqueioEditandoId={ag.setBloqueioEditandoId}
          onClose={() => ag.setModalAusenciaAberto(false)}
          salvarAusencia={ag.salvarAusencia} excluirAusencia={ag.excluirAusencia}
        />
      )}

      {ag.modalClienteRapido && (
        <GavetaCadastroCliente
          perfil={ag.perfil}
          onClose={() => ag.setModalClienteRapido(false)}
          onClienteAdicionado={() => { ag.setModalClienteRapido(false); ag.carregarDadosParaAgenda(); }}
        />
      )}

      {ag.modalCancelamentoAberto && (
        <ModalCancelamento
          editandoAg={ag.editandoAg}
          dadosCancelamento={ag.dadosCancelamento} setDadosCancelamento={ag.setDadosCancelamento}
          confirmarCancelamento={ag.confirmarCancelamento}
          onClose={() => { ag.setModalCancelamentoAberto(false); ag.setModalEdicaoAberto(true); }}
        />
      )}

      <MenuContexto
        menuContexto={ag.menuContexto} setMenuContexto={ag.setMenuContexto}
        registrarAlmocoRapido={ag.registrarAlmocoRapido}
        abrirModalAusenciaPeloMenu={ag.abrirModalAusenciaPeloMenu}
        abrirNovoAgendamento={(profId: string, hora: string) => {
          ag.setDadosIniciaisModalNovo({ profissional_id: profId, data: ag.dataHojeStr, hora });
          ag.setModalNovoAberto(true);
        }}
      />

      {ag.bloqueioParaDetalhes && (
        <ModalDetalheBloqueio
          bloqueio={ag.bloqueioParaDetalhes}
          onClose={() => ag.setBloqueioParaDetalhes(null)}
          onAlterarHorario={() => ag.abrirFormEdicaoBloqueio(ag.bloqueioParaDetalhes)}
          onRemover={ag.excluirBloqueioRapido}
        />
      )}

      {ag.agDetalhesFinalizado && (
        <ModalDetalhesFinalizado
          agendamento={ag.agDetalhesFinalizado}
          perfil={ag.perfil}
          onClose={() => ag.setAgDetalhesFinalizado(null)}
          onAtualizar={ag.carregarDadosParaAgenda}
        />
      )}
    </>
  );
}
