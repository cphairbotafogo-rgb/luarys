'use client'
import { C } from "@/lib/constants";
import { inputAdmin, labelPadrao, RAIO_3XL, overlayModal, SOMBRA_MODAL } from "@/lib/estiloGlobal";
import { Btn } from "@/components/ui";
import { FiArrowDownCircle, FiArrowUpCircle } from "react-icons/fi";

interface Props {
  produto: any;
  formMov: { tipo: string; quantidade: string; motivo: string };
  onCampoChange: (campo: string, valor: any) => void;
  onSubmit: (e: any) => void;
  onClose: () => void;
  salvando: boolean;
}

export function ModalMovimentoEstoque({ produto, formMov, onCampoChange, onSubmit, onClose, salvando }: Props) {
  const isEntrada = formMov.tipo === 'Entrada';

  return (
    <div style={{ ...overlayModal, zIndex: 999 }}>
      <div style={{ background: C.bgCard, padding: 32, borderRadius: RAIO_3XL, width: 400, boxShadow: SOMBRA_MODAL }}>
        <h3 style={{ margin: "0 0 8px", color: isEntrada ? C.success : C.danger, fontWeight: 900, display: "flex", alignItems: "center", gap: 8 }}>
          {isEntrada ? <FiArrowDownCircle size={20} /> : <FiArrowUpCircle size={20} />}
          {isEntrada ? "Nova Entrada" : "Baixa de Estoque"}
        </h3>
        <p style={{ margin: "0 0 20px", color: C.textMain, fontWeight: 700 }}>
          {produto.nome_produto} <span style={{ color: C.textMuted }}>(Atual: {produto.quantidade_atual})</span>
        </p>
        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelPadrao}>Quantidade ({produto.unidade_medida}):</label>
            <input type="number" min="0.01" step="0.01" style={inputAdmin} value={formMov.quantidade}
              onChange={e => onCampoChange('quantidade', e.target.value)} required />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelPadrao}>Motivo:</label>
            <select style={inputAdmin} value={formMov.motivo} onChange={e => onCampoChange('motivo', e.target.value)}>
              {isEntrada ? (
                <>
                  <option value="Compra de Fornecedor">Compra de Fornecedor</option>
                  <option value="Ajuste de Inventário">Ajuste de Inventário</option>
                </>
              ) : (
                <>
                  <option value="Uso em Serviço">Uso em Serviço</option>
                  <option value="Venda no Balcão">Venda no Balcão</option>
                  <option value="Validade / Danificado">Perda / Danificado</option>
                </>
              )}
            </select>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            <Btn type="submit" disabled={salvando} style={{ flex: 1, background: isEntrada ? C.success : C.danger, border: "none" }}>
              Confirmar {formMov.tipo}
            </Btn>
            <Btn type="button" onClick={onClose} style={{ background: C.bg, color: C.textMuted, border: "none" }}>
              Cancelar
            </Btn>
          </div>
        </form>
      </div>
    </div>
  );
}
