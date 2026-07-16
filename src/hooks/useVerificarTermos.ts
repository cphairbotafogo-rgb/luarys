'use client'
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type ContratoAtivo = {
  id: string;
  titulo: string;
  conteudo: string;
  versao: number;
};

export function useVerificarTermos() {
  const [contrato, setContrato]           = useState<ContratoAtivo | null>(null);
  const [precisaAceitar, setPrecisaAceitar] = useState(false);
  const [verificando, setVerificando]     = useState(true);
  const [aceitando, setAceitando]         = useState(false);

  useEffect(() => { verificar(); }, []);

  async function verificar() {
    setVerificando(true);
    try {
      // Busca contrato ativo
      const { data: doc } = await supabase
        .from("plataforma_documentos")
        .select("id, titulo, conteudo, versao")
        .eq("tipo", "contrato")
        .eq("ativo", true)
        .maybeSingle();

      if (!doc) { setVerificando(false); return; } // sem contrato publicado = não bloqueia

      // Verifica se o salão já aceitou esta versão
      const { data: aceite } = await supabase
        .from("termos_aceites")
        .select("id")
        .eq("documento_id", doc.id)
        .eq("versao", doc.versao)
        .maybeSingle();

      setContrato(doc);
      setPrecisaAceitar(!aceite);
    } catch {
      // Em caso de erro, não bloqueia
    } finally {
      setVerificando(false);
    }
  }

  async function aceitar(): Promise<boolean> {
    if (!contrato) return true;
    setAceitando(true);
    try {
      const res = await fetch("/api/termos/aceitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documento_id: contrato.id, versao: contrato.versao }),
      });
      if (!res.ok) return false;
      setPrecisaAceitar(false);
      return true;
    } finally {
      setAceitando(false);
    }
  }

  return { contrato, precisaAceitar, verificando, aceitando, aceitar };
}
