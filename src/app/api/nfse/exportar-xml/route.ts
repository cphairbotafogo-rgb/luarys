/**
 * GET /api/nfse/exportar-xml?mes=8&ano=2026
 *
 * Baixa num único .zip os XMLs de todas as NFS-e emitidas no mês — é o que o
 * contador pede toda virada de mês.
 *
 * Antes só existia download de uma nota por vez (/api/nfse/arquivo/[notaId]).
 * Com 260 notas no mês isso é inviável na prática: o salão simplesmente não
 * mandaria os arquivos, ou mandaria pela metade.
 *
 * O XML é o documento que vale para escrituração — o PDF é só a representação
 * visual. Por isso o zip leva XML, não DANFSe.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { zipSync, strToU8 } from 'fflate';
import { autenticarRota } from '@/lib/apiAuth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/** Teto de segurança: cada XML tem poucos KB, mas o zip é montado em memória. */
const MAX_NOTAS = 1000;

export async function GET(req: NextRequest) {
  const { perfil, erro } = await autenticarRota(req, 'GET /api/nfse/exportar-xml');
  if (erro) return erro;

  const { searchParams } = new URL(req.url);
  const mes = Number(searchParams.get('mes'));
  const ano = Number(searchParams.get('ano'));
  if (!Number.isInteger(mes) || mes < 1 || mes > 12 || !Number.isInteger(ano) || ano < 2020) {
    return NextResponse.json({ erro: 'Informe mês (1-12) e ano válidos.' }, { status: 400 });
  }

  const inicio = new Date(Date.UTC(ano, mes - 1, 1)).toISOString();
  const fim = new Date(Date.UTC(ano, mes, 1)).toISOString(); // 1º do mês seguinte, exclusivo

  // Só nota que virou documento fiscal. Inclui os status legados da migração,
  // senão o mês em que o salão migrou sairia incompleto para o contador.
  const { data: notas, error } = await supabaseAdmin
    .from('notas_fiscais')
    .select('id, numero_nota, cliente_nome, data_emissao, storage_path_xml')
    .eq('salao_id', perfil.salao_id)
    .in('status', ['Emitida', 'Emitido', 'AUTORIZADA'])
    .gte('data_emissao', inicio)
    .lt('data_emissao', fim)
    .order('numero_nota', { ascending: true })
    .limit(MAX_NOTAS);

  if (error) {
    console.error('[nfse/exportar-xml] falha ao listar notas:', error.message);
    return NextResponse.json({ erro: 'Não foi possível listar as notas: ' + error.message }, { status: 500 });
  }
  if (!notas?.length) {
    return NextResponse.json({ erro: 'Nenhuma nota emitida neste mês.' }, { status: 404 });
  }

  const arquivos: Record<string, Uint8Array> = {};
  const semArquivo: string[] = [];

  for (const nota of notas) {
    if (!nota.storage_path_xml) {
      // Nota emitida antes de guardarmos o XML, ou migrada de outro sistema.
      // Registrada no relatório dentro do zip em vez de sumir em silêncio: o
      // contador precisa saber que aquele número existe e falta o arquivo.
      semArquivo.push(`nº ${nota.numero_nota ?? '?'} — ${nota.cliente_nome ?? ''}`);
      continue;
    }
    const { data: arquivo, error: erroDown } = await supabaseAdmin
      .storage.from('notas-fiscais').download(nota.storage_path_xml);

    if (erroDown || !arquivo) {
      semArquivo.push(`nº ${nota.numero_nota ?? '?'} — ${nota.cliente_nome ?? ''} (falha ao ler)`);
      continue;
    }
    const nome = `NFSe-${String(nota.numero_nota ?? nota.id).padStart(6, '0')}.xml`;
    arquivos[nome] = new Uint8Array(await arquivo.arrayBuffer());
  }

  if (semArquivo.length > 0) {
    arquivos['_notas-sem-xml.txt'] = strToU8(
      'Notas emitidas neste mês cujo XML não está disponível no sistema:\n\n' +
      semArquivo.join('\n') +
      '\n\nEsses documentos existem na prefeitura; o arquivo é que não foi guardado aqui ' +
      '(nota anterior ao armazenamento de XML, ou migrada de outro sistema).\n',
    );
  }

  if (Object.keys(arquivos).length === 0) {
    return NextResponse.json({ erro: 'Nenhum XML disponível para este mês.' }, { status: 404 });
  }

  const zip = zipSync(arquivos, { level: 6 });
  const nomeZip = `NFSe-${ano}-${String(mes).padStart(2, '0')}.zip`;

  return new NextResponse(Buffer.from(zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${nomeZip}"`,
      'Cache-Control': 'no-store',
    },
  });
}
