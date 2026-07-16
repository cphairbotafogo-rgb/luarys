'use client'
/**
 * src/modules/equipe/modal/ModalColaborador.tsx
 *
 * Shell do modal completo de cadastro/edição de colaborador. Orquestra as
 * 6 abas (Dados Gerais, Folha, Serviços, Horários, Contrato, Permissões),
 * cada uma extraída como componente próprio. Extraído de AbaEquipe.tsx
 * (que passou de 700 linhas) seguindo o padrão de divisão de arquivos do Luarys.
 */
import { FiX, FiCamera, FiClock, FiTrash2 } from "react-icons/fi";
import { C } from "@/lib/constants";
import { overlayModal, containerModal, RAIO_MD, RAIO_LG, RAIO_XL, botaoPrimario } from "@/lib/estiloGlobal";
import { tabButtonStyle } from "./estilosCompartilhados";
import { AbaDadosGerais } from "./AbaDadosGerais";
import { AbaFolhaBeneficios } from "./AbaFolhaBeneficios";
import { AbaServicosColaborador } from "./AbaServicosColaborador";
import { AbaHorarios } from "./AbaHorarios";
import { AbaContrato } from "./AbaContrato";
import { AbaPermissoesColaborador } from "./AbaPermissoesColaborador";

export function ModalColaborador({
  form, setForm, editandoId, abaModal, setAbaModal,
  fileInputRef, handleUploadFoto, subindoFoto,
  servicosDb, novaArea, setNovaArea, handleAddArea, removerArea, toggleServico, atualizarComissao,
  atualizarHorario,
  listaFuncoes, setModalFuncoesAberto,
  alterarPerfilAcessoGeral, togglePermissaoIndividual, profissionaisReais, copiarPermissoesDe,
  salvarProfissional, handleDeletar, onClose, pinDono,
}: any) {
  return (
    <div style={{ ...overlayModal, zIndex: 990 }}>
      <div style={{ ...containerModal, padding: 32, width: "100%", maxWidth: 800, maxHeight: "90vh", overflowY: "auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <input type="file" ref={fileInputRef} onChange={handleUploadFoto} accept="image/*" style={{ display: "none" }} />
            <div onClick={() => fileInputRef.current?.click()} style={{ width: 56, height: 56, borderRadius: RAIO_XL, background: C.bg, border: `1px dashed ${C.borderMid}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative", overflow: "hidden" }} title="Alterar Imagem">
              {form.foto_url ? <img src={form.foto_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="Avatar" /> : <span style={{ color: C.textLight }}>{subindoFoto ? <FiClock className="animate-spin" size={20} /> : <FiCamera size={20} />}</span>}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.sidebarBg, textTransform: "uppercase" }}>{editandoId ? form.nome : "Novo Colaborador"}</h3>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: C.textMuted, fontWeight: 500 }}>Gestão avançada de ficha técnica corporativa e acessos.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight, display: "flex" }}><FiX size={24} /></button>
        </div>

        <div style={{ display: "flex", gap: 6, background: C.bg, padding: 6, borderRadius: RAIO_LG, marginBottom: 24, overflowX: "auto" }}>
          <button type="button" style={tabButtonStyle(abaModal === "pessoais")} onClick={() => setAbaModal("pessoais")}>Dados Gerais</button>
          <button type="button" style={tabButtonStyle(abaModal === "folha")} onClick={() => setAbaModal("folha")}>Folha & Benefícios</button>
          <button type="button" style={tabButtonStyle(abaModal === "servicos")} onClick={() => setAbaModal("servicos")}>Serviços</button>
          <button type="button" style={tabButtonStyle(abaModal === "horarios")} onClick={() => setAbaModal("horarios")}>Horários</button>
          <button type="button" style={tabButtonStyle(abaModal === "contrato")} onClick={() => setAbaModal("contrato")}>Contrato</button>
          <button type="button" style={tabButtonStyle(abaModal === "permissoes")} onClick={() => setAbaModal("permissoes")}>Permissões</button>
        </div>

        {/* Banner de orientação — só aparece na criação, na primeira aba */}
        {!editandoId && abaModal === "pessoais" && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: RAIO_MD, padding: "12px 16px", marginBottom: 16 }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>💡</span>
            <div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#1E40AF" }}>Para começar, preencha apenas os campos obrigatórios</p>
              <p style={{ margin: "3px 0 0", fontSize: 11, color: "#3B82F6", lineHeight: 1.5 }}>
                <strong>Nome Completo, CPF, E-mail e Senha</strong> são suficientes para salvar. As demais abas (Folha, Serviços, Horários…) podem ser preenchidas depois.
              </p>
            </div>
          </div>
        )}

        <div style={{ minHeight: 400 }}>
          {abaModal === "pessoais" && <AbaDadosGerais form={form} setForm={setForm} editandoId={editandoId} />}
          {abaModal === "folha" && <AbaFolhaBeneficios form={form} setForm={setForm} />}
          {abaModal === "servicos" && (
            <AbaServicosColaborador
              form={form} servicosDb={servicosDb} novaArea={novaArea} setNovaArea={setNovaArea}
              handleAddArea={handleAddArea} removerArea={removerArea} toggleServico={toggleServico} atualizarComissao={atualizarComissao}
            />
          )}
          {abaModal === "horarios" && <AbaHorarios form={form} atualizarHorario={atualizarHorario} />}
          {abaModal === "contrato" && (
            <AbaContrato form={form} setForm={setForm} listaFuncoes={listaFuncoes} setModalFuncoesAberto={setModalFuncoesAberto} />
          )}
          {abaModal === "permissoes" && (
            <AbaPermissoesColaborador
              form={form} alterarPerfilAcessoGeral={alterarPerfilAcessoGeral} togglePermissaoIndividual={togglePermissaoIndividual}
              profissionaisReais={profissionaisReais} editandoId={editandoId} copiarPermissoesDe={copiarPermissoesDe}
              pinDono={pinDono}
            />
          )}
        </div>

        <div style={{ marginTop: 32, paddingTop: 24, borderTop: `1px solid ${C.border}` }}>
          <p style={{ margin: "0 0 12px", fontSize: 10, color: C.textLight }}>
            <span style={{ color: '#EF4444', fontWeight: 900 }}>*</span> Campos obrigatórios — encontrados na aba <strong>Dados Gerais</strong>
          </p>
        <div style={{ display: "flex", gap: 12 }}>
          <button type="submit" onClick={salvarProfissional} style={{ ...botaoPrimario, flex: 2, padding: "14px 0", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>{editandoId ? "Salvar Alterações da Ficha" : "Cadastrar Colaborador"}</button>
          {editandoId && <button type="button" onClick={handleDeletar} style={{ flex: 1, padding: "14px 0", fontSize: 12, background: "transparent", color: C.danger, border: `1px solid #FECACA`, borderRadius: RAIO_MD, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, textTransform: "uppercase" }}><FiTrash2 size={14}/> Eliminar</button>}
          <button type="button" onClick={onClose} style={{ flex: 1, padding: "14px 0", fontSize: 13, background: "transparent", color: C.textMain, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
        </div>
        </div>

      </div>
    </div>
  );
}
