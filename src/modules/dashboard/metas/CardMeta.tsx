'use client'
import { FiAward, FiCheckCircle, FiTarget, FiZap } from 'react-icons/fi';
import { C, brl } from '@/lib/constants';
import { Card } from '@/components/ui';
import { BarraProgresso } from './BarraProgresso';

interface Props {
  titulo: string;
  icone: any;
  corIcone: string;
  bgIcone: string;
  realizado: number;
  meta: number;
  superMeta: number;
  corMeta: string;
  corSuper: string;
}

export function CardMeta({ titulo, icone: Icone, corIcone, bgIcone, realizado, meta, superMeta, corMeta, corSuper }: Props) {
  const pctMeta  = meta > 0      ? (realizado / meta)      * 100 : 0;
  const pctSuper = superMeta > 0 ? (realizado / superMeta) * 100 : 0;
  const bateuMeta  = meta > 0      && realizado >= meta;
  const bateuSuper = superMeta > 0 && realizado >= superMeta;
  const faltaMeta  = Math.max(0, meta - realizado);
  const faltaSuper = Math.max(0, superMeta - realizado);

  return (
    <Card className="p-6 bg-white rounded-xl shadow-sm border transition-transform hover:scale-[1.01]"
      style={{ borderColor: C.border }}>

      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="m-0 font-title text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>
            {titulo}
          </p>
          <h3 className="m-0 mt-2 text-2xl font-title font-bold"
            style={{ color: realizado < 0 ? '#EF4444' : bateuSuper ? corSuper : bateuMeta ? corMeta : C.textMain }}>
            {brl(realizado)}
          </h3>
        </div>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: bgIcone, color: corIcone }}>
          {bateuSuper ? <FiAward size={18} /> : bateuMeta ? <FiCheckCircle size={18} /> : <Icone size={18} />}
        </div>
      </div>

      {(bateuMeta || bateuSuper) && (
        <div className="mb-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-title text-[10px] font-bold uppercase tracking-wide"
          style={{ background: bateuSuper ? `${corSuper}18` : `${corMeta}18`, color: bateuSuper ? corSuper : corMeta }}>
          {bateuSuper ? <><FiAward size={10} /> Super Meta atingida!</> : <><FiCheckCircle size={10} /> Meta atingida!</>}
        </div>
      )}

      {meta > 0 && (
        <div className="mb-4">
          <div className="flex justify-between mb-1.5">
            <span className="font-title text-[10px] font-bold uppercase tracking-wider flex items-center gap-1" style={{ color: C.textMuted }}>
              <FiTarget size={10} /> Meta {brl(meta)}
            </span>
            <span className="font-title text-[10px] font-bold" style={{ color: bateuMeta ? corMeta : C.textLight }}>
              {bateuMeta ? '100%' : `${Math.round(pctMeta)}% · falta ${brl(faltaMeta)}`}
            </span>
          </div>
          <BarraProgresso pct={pctMeta} cor={corMeta} />
        </div>
      )}

      {superMeta > 0 && (
        <div>
          <div className="flex justify-between mb-1.5">
            <span className="font-title text-[10px] font-bold uppercase tracking-wider flex items-center gap-1" style={{ color: C.textMuted }}>
              <FiZap size={10} /> Super Meta {brl(superMeta)}
            </span>
            <span className="font-title text-[10px] font-bold" style={{ color: bateuSuper ? corSuper : C.textLight }}>
              {bateuSuper ? '100%' : `${Math.round(pctSuper)}% · falta ${brl(faltaSuper)}`}
            </span>
          </div>
          <BarraProgresso pct={pctSuper} cor={corSuper} />
        </div>
      )}

      {meta === 0 && superMeta === 0 && (
        <p className="m-0 text-xs italic" style={{ color: C.textLight }}>
          Nenhuma meta configurada para este mês.
        </p>
      )}
    </Card>
  );
}
