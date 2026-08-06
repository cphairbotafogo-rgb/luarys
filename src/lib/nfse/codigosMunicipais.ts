/**
 * Aprendizado de código de tributação municipal, por município.
 *
 * O cTribNac é nacional; o cTribMun é o desdobro que cada prefeitura criou, e
 * não existe fonte consultável para ele — a API de parâmetros do Ambiente
 * Nacional exige certificado ICP-Brasil (que não guardamos) e a Brasil NFe não
 * expõe equivalente. A única fonte que temos é o que a prefeitura aceitou.
 *
 * Cada emissão alimenta a tabela; o cadastro de serviço consulta. O que um salão
 * de Curitiba descobre passa a servir para o próximo salão de Curitiba.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TABELA = 'codigos_municipais_aceitos';

/**
 * Registra o resultado de uma emissão. Falha aqui nunca derruba a emissão — é
 * conhecimento acessório, não parte do documento fiscal.
 */
export async function registrarResultadoCodigo(args: {
  codigoIbge?: string | null;
  ctribNac?: string | null;
  ctribMun?: string | null;
  ambiente: 1 | 2;
  aceito: boolean;
  erro?: string | null;
}): Promise<void> {
  const { codigoIbge, ctribNac, ctribMun, ambiente, aceito, erro } = args;
  if (!codigoIbge || !ctribNac || !ctribMun) return;

  try {
    const chave = { codigo_ibge: String(codigoIbge), ctrib_nac: String(ctribNac), ctrib_mun: String(ctribMun), ambiente };
    const { data: atual } = await supabaseAdmin
      .from(TABELA).select('aceitos, recusados')
      .match(chave).maybeSingle();

    await supabaseAdmin.from(TABELA).upsert({
      ...chave,
      aceitos:   (atual?.aceitos   ?? 0) + (aceito ? 1 : 0),
      recusados: (atual?.recusados ?? 0) + (aceito ? 0 : 1),
      ultimo_erro: aceito ? null : (erro ?? null)?.slice(0, 300),
      atualizado_em: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error('[codigosMunicipais] falha ao registrar (não bloqueia a emissão):', e?.message || e);
  }
}

export interface SugestaoCodigo {
  ctrib_mun: string;
  aceitos: number;
  recusados: number;
  ambiente: number;
}

/**
 * O que já funcionou naquele município para aquele código nacional.
 *
 * Sugere quando há aceite E os aceites superam as recusas. Não basta "zero
 * recusas": a rota de emissão registra como recusa qualquer erro, inclusive
 * falha de rede — e uma queda de conexão apagaria para sempre um código com
 * centenas de notas aceitas. Do outro lado, código genuinamente errado acumula
 * recusa sem nenhum aceite e nunca aparece.
 */
export async function sugerirCodigoMunicipal(
  codigoIbge: string,
  ctribNac: string,
): Promise<SugestaoCodigo[]> {
  const { data, error } = await supabaseAdmin
    .from(TABELA)
    .select('ctrib_mun, aceitos, recusados, ambiente')
    .eq('codigo_ibge', codigoIbge)
    .eq('ctrib_nac', ctribNac)
    .gt('aceitos', 0);

  if (error || !data) return [];

  // Produção antes de homologação, e mais aceites antes de menos: aceite numa
  // nota real vale mais que num teste.
  return data
    .filter(r => (r.aceitos ?? 0) > (r.recusados ?? 0))
    .sort((a, b) => (a.ambiente === b.ambiente ? b.aceitos - a.aceitos : a.ambiente - b.ambiente));
}
