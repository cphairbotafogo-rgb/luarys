'use client'
/**
 * Cofre de Segurança — confirmação por senha antes de uma ação sensível.
 *
 * Estava embutido em AbaConfiguracoes e virou componente quando a contratação
 * por cartão salvo passou a exigir o mesmo aceite. Duplicar significaria duas
 * telas de senha divergindo com o tempo, e é justamente aqui que divergência
 * vira brecha.
 *
 * IMPORTANTE: este componente só coleta e devolve a senha. A validação é de
 * quem chama, e para autorizar cobrança tem que ser NO SERVIDOR — conferir no
 * navegador não vale como aceite, porque um cliente modificado pula a checagem.
 */
import { useState } from 'react';
import { C } from '@/lib/constants';
import { RAIO_MD, overlayModal, containerModal, inputAdmin } from '@/lib/estiloGlobal';
import { FiLock } from 'react-icons/fi';

interface Props {
  titulo?: string;
  descricao: string;
  /** Bloco livre acima do campo — use para mostrar o que está sendo autorizado. */
  detalhe?: React.ReactNode;
  rotuloConfirmar?: string;
  processando?: boolean;
  onConfirmar: (senha: string) => void;
  onCancelar: () => void;
}

export function CofreSeguranca({
  titulo = 'Cofre de Segurança',
  descricao,
  detalhe,
  rotuloConfirmar = 'Confirmar',
  processando = false,
  onConfirmar,
  onCancelar,
}: Props) {
  const [senha, setSenha] = useState('');

  function confirmar() {
    if (!senha || processando) return;
    const informada = senha;
    // Limpa antes de devolver: a caixa continua aberta quando a acao falha, e
    // deixar a senha no campo a expoe a quem passar pela recepcao — alem de
    // fazer o proximo item herdar o que foi digitado para o anterior.
    setSenha('');
    onConfirmar(informada);
  }

  return (
    <div style={{ ...overlayModal, zIndex: 9999 }}>
      <div style={{ ...containerModal, padding: 32, width: '100%', maxWidth: 420 }}>
        <h3 className="font-title uppercase tracking-widest"
          style={{ margin: '0 0 8px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, color: C.sidebarBg, fontWeight: 700 }}>
          <FiLock size={16} /> {titulo}
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 12, color: C.textMuted, textAlign: 'center', fontWeight: 500, lineHeight: 1.6 }}>
          {descricao}
        </p>

        {detalhe}

        <input
          type="password"
          style={{ ...inputAdmin, padding: '14px', marginBottom: 20 }}
          placeholder="••••••••"
          value={senha}
          onChange={e => setSenha(e.target.value)}
          autoFocus
          autoComplete="current-password"
          onKeyDown={e => { if (e.key === 'Enter') confirmar(); }}
        />

        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={confirmar} disabled={processando || !senha}
            className="font-title uppercase tracking-wider transition-all hover:opacity-90"
            style={{ flex: 2, padding: '12px 0', background: C.sidebarBg, color: '#fff', border: 'none', borderRadius: RAIO_MD, fontSize: 11, fontWeight: 700, cursor: (processando || !senha) ? 'not-allowed' : 'pointer', opacity: (processando || !senha) ? 0.7 : 1 }}>
            {processando ? 'A validar...' : rotuloConfirmar}
          </button>
          <button onClick={onCancelar} disabled={processando}
            className="transition-all hover:bg-slate-50"
            style={{ flex: 1, padding: '12px 0', background: 'transparent', color: C.textMain, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, fontWeight: 600, fontSize: 13, cursor: processando ? 'not-allowed' : 'pointer' }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
