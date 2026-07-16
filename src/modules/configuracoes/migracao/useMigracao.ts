'use client'
/**
 * src/modules/configuracoes/migracao/useMigracao.ts
 *
 * Hook que concentra todo o estado e lógica de exportação/importação,
 * seguindo o mesmo padrão já usado em useFechamentoCaixa.ts (agenda/modals/hooks).
 * AbaMigracao.tsx fica só com o JSX, consumindo o que este hook retorna.
 */

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  lerArquivoTexto, parseLinha,
  mapearLinhaServico, mapearLinhaCliente, mapearLinhaProduto,
  pareceMetadadoDeRelatorio, validarColunasObrigatorias,
} from './tipos';

export function useMigracao(perfil: any) {
  const [abaAtiva, setAbaAtiva] = useState<'exportar' | 'importar' | 'duplicados'>('exportar');
  const [entidade, setEntidade] = useState('clientes');
  const [carregando, setCarregando] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });
  const [preview, setPreview] = useState<{ total: number; amostra: string[] } | null>(null);

  // ─── EXPORTAÇÃO ───────────────────────────────────────────────────────────
  async function exportarDados() {
    if (!perfil?.salao_id) return;
    setCarregando(true);
    setMensagem({ tipo: '', texto: '' });

    try {
      const { data, error } = await supabase
        .from(entidade)
        .select('*')
        .eq('salao_id', perfil.salao_id);

      if (error) throw error;
      if (!data || data.length === 0) {
        setMensagem({ tipo: 'erro', texto: 'Não há dados para exportar nesta categoria.' });
        return;
      }

      const colunasParaIgnorar = ['id', 'salao_id', 'created_at', 'codigo_servico', 'codigo_sku', 'exibir_online'];
      const dadosLimpos = data.map(linhaBanco => {
        const linhaLimpa: any = {};
        Object.keys(linhaBanco).forEach(chave => {
          if (!colunasParaIgnorar.includes(chave)) linhaLimpa[chave] = linhaBanco[chave];
        });
        return linhaLimpa;
      });

      const cabecalhos = Object.keys(dadosLimpos[0]);
      const linhasCsv = dadosLimpos.map(item =>
        cabecalhos.map(cab => {
          let valor = item[cab] === null || item[cab] === undefined ? '' : String(item[cab]);
          if (valor.includes(',') || valor.includes('\n') || valor.includes('"')) {
            valor = `"${valor.replace(/"/g, '""')}"`;
          }
          return valor;
        }).join(',')
      );

      const conteudoCsv = '\uFEFF' + [cabecalhos.join(','), ...linhasCsv].join('\n');
      const blob = new Blob([conteudoCsv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `eleva_exportacao_${entidade}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setMensagem({ tipo: 'sucesso', texto: `${data.length} registros exportados com sucesso!` });
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: 'Erro ao exportar: ' + err.message });
    } finally {
      setCarregando(false);
    }
  }

  // ─── PRÉ-VISUALIZAÇÃO DO ARQUIVO ─────────────────────────────────────────
  async function analisarArquivo(file: File) {
    setArquivo(file);
    setMensagem({ tipo: '', texto: '' });
    setPreview(null);

    try {
      const texto = await lerArquivoTexto(file);
      const linhas = texto.split(/\r?\n|\r/).filter(l => l.trim() !== '');
      const primeiraLinha = linhas[0].replace(/^\uFEFF/, '');
      const sep = primeiraLinha.includes(';') ? ';' : ',';
      const cabecalhos = parseLinha(primeiraLinha, sep).map(c =>
        c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      );
      const amostra = cabecalhos.slice(0, 6);
      setPreview({ total: linhas.length - 1, amostra });
    } catch {
      setPreview(null);
    }
  }

  // ─── IMPORTAÇÃO ───────────────────────────────────────────────────────────
  async function importarDados() {
    if (!arquivo || !perfil?.salao_id) return;
    setCarregando(true);
    setMensagem({ tipo: '', texto: '' });

    try {
      const texto = await lerArquivoTexto(arquivo);
      const linhas = texto.split(/\r?\n|\r/).filter(linha => linha.trim() !== '');

      if (linhas.length < 2) throw new Error('O arquivo está vazio ou não possui dados além do cabeçalho.');

      // BOM + detectar separador
      const primeiraLinha = linhas[0].replace(/^\uFEFF/, '');
      const separador = primeiraLinha.includes(';') ? ';' : ',';

      // Normalizar cabeçalhos: minúsculo, sem acento, sem aspas
      const cabecalhos = parseLinha(primeiraLinha, separador).map(c =>
        c.replace(/"/g, '')
         .trim()
         .toLowerCase()
         .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      );

      // Metadado de relatório (em vez de cabeçalho real) — ver tipos.ts
      if (pareceMetadadoDeRelatorio(cabecalhos)) {
        throw new Error(
          `A primeira linha do arquivo parece ser um título de relatório ("${linhas[0].slice(0, 60)}"), não o cabeçalho de colunas. ` +
          `Esse tipo de arquivo (relatório filtrado) tem um formato diferente do esperado aqui. ` +
          `Use a exportação completa do cadastro (lista crua) — baixe a planilha modelo abaixo para ver o formato certo.`
        );
      }

      const colunasFaltando = validarColunasObrigatorias(entidade, cabecalhos);
      if (colunasFaltando.length > 0) {
        throw new Error(`Colunas obrigatórias não encontradas: [ ${colunasFaltando.join(', ')} ]. Verifique se os nomes batem com o Guia abaixo.`);
      }

      // ─── PARSING DAS LINHAS ───────────────────────────────────────────
      let inseridos = 0;
      const LOTE = 100; // evita timeout em arquivos grandes

      if (entidade === 'clientes') {
        // Clientes precisa de DUAS tabelas: `clientes` (registro global) e
        // `crm_clientes` (vínculo por salão — onde vivem aceita_campanhas e
        // data_ultima_visita, que alimentam diretamente o Luarys Cresce).
        const mapeamentos: { global: any; local: any }[] = [];
        for (let i = 1; i < linhas.length; i++) {
          const valores = parseLinha(linhas[i], separador);
          if (valores.length < 2) continue;
          const mapeado = mapearLinhaCliente(cabecalhos, valores);
          if (mapeado) mapeamentos.push(mapeado);
        }

        if (mapeamentos.length === 0) {
          throw new Error('Nenhum registro válido encontrado no arquivo. Verifique se o arquivo possui dados além do cabeçalho.');
        }

        for (let i = 0; i < mapeamentos.length; i += LOTE) {
          const lote = mapeamentos.slice(i, i + LOTE);

          // 1. Inserir registros globais e recuperar os IDs gerados, na mesma ordem.
          //    salao_id é OBRIGATÓRIO aqui: sem ele o registro fica com salao_id NULL,
          //    a RLS de `clientes` bloqueia a leitura e o cliente some do CRM/busca
          //    (apesar do vínculo em crm_clientes). Fonte da regra: todo cliente
          //    vinculado ao salão pertence ao salão.
          const { data: criados, error: erroGlobal } = await supabase
            .from('clientes')
            .insert(lote.map(m => ({ salao_id: perfil.salao_id, ...m.global })))
            .select('id');
          if (erroGlobal) throw erroGlobal;

          // 2. Vincular cada cliente criado ao salão atual em crm_clientes
          const vinculos = (criados || []).map((c, idx) => ({
            cliente_id: c.id,
            salao_id: perfil.salao_id,
            ativo: true,
            ...lote[idx].local,
          }));
          const { error: erroLocal } = await supabase.from('crm_clientes').insert(vinculos);
          if (erroLocal) throw erroLocal;

          inseridos += lote.length;
        }

      } else {
        // Serviços e produtos — uma tabela só, fluxo original
        const registros: any[] = [];
        for (let i = 1; i < linhas.length; i++) {
          const valores = parseLinha(linhas[i], separador);
          if (valores.length < 2) continue;

          const dados = entidade === 'servicos'
            ? mapearLinhaServico(cabecalhos, valores)
            : mapearLinhaProduto(cabecalhos, valores);

          if (!dados) continue; // campo obrigatório ausente nessa linha — descarta
          registros.push({ salao_id: perfil.salao_id, ...dados });
        }

        if (registros.length === 0) {
          throw new Error('Nenhum registro válido encontrado no arquivo. Verifique se o arquivo possui dados além do cabeçalho.');
        }

        for (let i = 0; i < registros.length; i += LOTE) {
          const lote = registros.slice(i, i + LOTE);
          const { error } = await supabase.from(entidade).insert(lote);
          if (error) throw error;
          inseridos += lote.length;
        }
      }

      setMensagem({ tipo: 'sucesso', texto: `${inseridos} registros importados com sucesso para o Luarys!` });
      setArquivo(null);
      setPreview(null);

    } catch (err: any) {
      let msg = err.message;
      if (msg.includes('invalid input syntax for type timestamp')) {
        msg = 'Uma coluna de data contém texto inválido. Certifique-se de que colunas de data tenham apenas datas no formato DD/MM/AAAA.';
      } else if (msg.includes('duplicate key value')) {
        msg = 'O arquivo contém registros que já existem no sistema (E-mail ou CPF duplicado). Remova as linhas duplicadas e tente novamente.';
      } else if (msg.includes('violates not-null constraint')) {
        msg = 'Uma coluna obrigatória está vazia em alguma linha. Verifique o arquivo e preencha os campos em vermelho do Guia abaixo.';
      } else if (msg.includes('does not exist')) {
        msg = 'Uma coluna do arquivo não existe no sistema. Use exatamente os nomes listados no Guia abaixo.';
      }
      setMensagem({ tipo: 'erro', texto: `Falha na importação: ${msg}` });
    } finally {
      setCarregando(false);
    }
  }

  // ─── DOWNLOAD DO MODELO ───────────────────────────────────────────────────
  // Cada modelo traz MAIS DE UMA linha de exemplo de propósito — uma com todos
  // os campos opcionais preenchidos, outra deixando-os em branco — para deixar
  // claro na prática o que é obrigatório e o que pode ficar vazio sem quebrar
  // a importação.
  function baixarModelo() {
    let conteudo = '';
    if (entidade === 'clientes') {
      conteudo =
        'nome_completo,telefone_whatsapp,telefone 2,email,cpf,nascimento,data de cadastro,instagram,como nos conheceu,recebe sms,recebe e-mails,ultimo agendamento\n' +
        'João da Silva,11999999999,,joao@email.com,12345678901,20/05/1990,12/06/2026,@joaosilva,Instagram,Sim,Sim,10/06/2026\n' +
        'Maria Oliveira,,,,,,,,,,,';
    } else if (entidade === 'produtos') {
      conteudo =
        'nome_produto,codigo_sku,preco_venda,preco_custo,quantidade_estoque\n' +
        'Shampoo Reconstrutor,SHP-001,89.90,45.00,10\n' +
        'Máscara Hidratante,,69.90,,';
    } else if (entidade === 'servicos') {
      conteudo =
        'nome_servico,descricao,categoria,tempo_duracao,tipo_preco,preco_padrao,preco_promocional,custo_produto,custo_produto_prof,custo_descartaveis,custo_op_estabelecimento,custo_op_profissional\n' +
        'Corte Masculino,Corte degradê na tesoura,Cabelo,30 min,Fixo,50.00,,0,0,0,0,0\n' +
        'Manicure,,Mãos e Pés,45 min,Fixo,35.00,,,,,,';
    }

    const blob = new Blob(['\uFEFF' + conteudo], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `eleva_modelo_importacao_${entidade}.csv`;
    link.click();
  }

  return {
    abaAtiva, setAbaAtiva,
    entidade, setEntidade,
    carregando,
    arquivo, setArquivo,
    mensagem, setMensagem,
    preview, setPreview,
    exportarDados, analisarArquivo, importarDados, baixarModelo,
  };
}
