'use client'
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { C, brl } from "@/lib/constants";
import { useToast } from "@/components/Toast";
import { confirmarAcaoGlobal } from '@/components/ConfirmacaoGlobal';
import { inputAdmin, cardAdmin, RAIO_MD, RAIO_LG } from '@/lib/estiloGlobal';
import { FiSearch, FiPlus, FiRefreshCw, FiPocket, FiUser } from "react-icons/fi";
import { ModalDeposito } from "./carteira/ModalDeposito";
import { TabelaExtrato } from "./carteira/TabelaExtrato";
import { avatar, sinalValor } from "./carteira/tipos";
import type { Entrada, ClienteCarteira } from "./carteira/tipos";

export function CarteiraClientes({ perfil }: any) {
  const toast = useToast();
  const [carteiras, setCarteiras]   = useState<ClienteCarteira[]>([]);
  const [busca, setBusca]           = useState("");
  const [clienteSel, setClienteSel] = useState<ClienteCarteira | null>(null);
  const [extrato, setExtrato]       = useState<Entrada[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [modal, setModal]           = useState(false);
  const [modalClienteNome, setModalClienteNome] = useState("");
  const [modalClienteId, setModalClienteId]     = useState("");

  const carregarCarteiras = useCallback(async () => {
    if (!perfil?.salao_id) return;
    setCarregando(true);
    const { data, error } = await supabase
      .from('carteira_clientes')
      .select('cliente_id, cliente_nome, tipo, valor, created_at')
      .eq('salao_id', perfil.salao_id)
      .order('created_at', { ascending: false });

    if (error) { toast.erro("Erro ao carregar carteiras: " + error.message); setCarregando(false); return; }

    const mapa: Record<string, ClienteCarteira> = {};
    for (const row of (data || [])) {
      const chave = row.cliente_id || row.cliente_nome;
      if (!mapa[chave]) {
        mapa[chave] = { cliente_id: row.cliente_id, cliente_nome: row.cliente_nome, saldo: 0, ultima_movimentacao: row.created_at };
      }
      mapa[chave].saldo += sinalValor(row.tipo) * Number(row.valor);
      if (row.created_at > mapa[chave].ultima_movimentacao) mapa[chave].ultima_movimentacao = row.created_at;
    }
    setCarteiras(Object.values(mapa).sort((a, b) => b.saldo - a.saldo));
    setCarregando(false);
  }, [perfil?.salao_id]);

  useEffect(() => { carregarCarteiras(); }, [carregarCarteiras]);

  async function carregarExtrato(c: ClienteCarteira) {
    setClienteSel(c);
    let query = supabase
      .from('carteira_clientes')
      .select('id, tipo, valor, descricao, created_at, forma_pagamento')
      .eq('salao_id', perfil.salao_id)
      .order('created_at', { ascending: false });
    if (c.cliente_id) query = query.eq('cliente_id', c.cliente_id);
    else query = query.eq('cliente_nome', c.cliente_nome);
    const { data } = await query;
    setExtrato((data || []) as Entrada[]);
  }

  async function estornarDeposito(entrada: Entrada) {
    if (!await confirmarAcaoGlobal({ titulo: `Estornar depósito de ${brl(entrada.valor)}?`, descricao: 'Esta ação lançará um estorno na carteira do cliente.', perigoso: true })) return;
    const { error } = await supabase.from('carteira_clientes').insert({
      salao_id:     perfil.salao_id,
      cliente_id:   clienteSel?.cliente_id || null,
      cliente_nome: clienteSel!.cliente_nome,
      tipo:         'estorno',
      valor:        entrada.valor,
      descricao:    `Estorno do depósito de ${new Date(entrada.created_at).toLocaleDateString('pt-BR')}`,
      criado_por:   perfil.nome || null,
    });
    if (error) return toast.erro("Erro ao estornar: " + error.message);
    toast.sucesso("Estorno registrado.");
    await carregarCarteiras();
    carregarExtrato(clienteSel!);
  }

  function abrirModalDeposito(clienteNome = "", clienteId = "") {
    setModalClienteNome(clienteNome);
    setModalClienteId(clienteId);
    setModal(true);
  }

  function aoSalvarDeposito(valor: number, clienteNome: string) {
    setModal(false);
    carregarCarteiras();
    if (clienteSel?.cliente_nome === clienteNome) {
      carregarExtrato({ ...clienteSel, saldo: clienteSel.saldo + valor });
    }
  }

  const carteirasFiltradas = carteiras.filter(c => c.cliente_nome.toLowerCase().includes(busca.toLowerCase()));
  const totalEmCarteiras = carteiras.reduce((a, c) => a + c.saldo, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {!clienteSel && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          {[
            { label: "Total em Carteiras", valor: brl(totalEmCarteiras), cor: C.sidebarBg, icon: <FiPocket size={18} /> },
            { label: "Clientes com Saldo",  valor: String(carteiras.filter(c => c.saldo > 0).length), cor: "#10B981", icon: <FiUser size={18} /> },
            { label: "Sem Saldo",           valor: String(carteiras.filter(c => c.saldo <= 0).length), cor: C.textMuted, icon: <FiUser size={18} /> },
          ].map(s => (
            <div key={s.label} style={{ ...cardAdmin, padding: "20px 24px", display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ background: `${s.cor}18`, color: s.cor, padding: 10, borderRadius: RAIO_LG }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.cor }}>{s.valor}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!clienteSel && (
        <div style={{ ...cardAdmin, overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.borderMid}`, background: C.bg, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
            <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
              <FiSearch size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textMuted, pointerEvents: "none" }} />
              <input placeholder="Buscar cliente..." value={busca} onChange={e => setBusca(e.target.value)} style={{ ...inputAdmin, paddingLeft: 36 }} />
            </div>
            <button onClick={() => abrirModalDeposito()} style={{ background: C.sidebarBg, color: "#fff", border: "none", padding: "10px 20px", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase" }}>
              <FiPlus size={15} /> Depositar
            </button>
          </div>

          {carregando ? (
            <div style={{ padding: 48, textAlign: "center", color: C.textMuted, fontSize: 13 }}>
              <FiRefreshCw className="animate-spin" size={20} style={{ marginBottom: 8 }} /> Carregando carteiras...
            </div>
          ) : carteirasFiltradas.length === 0 ? (
            <div style={{ padding: 64, textAlign: "center" }}>
              <FiPocket size={32} style={{ color: C.borderMid, marginBottom: 12 }} />
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.textMuted }}>
                {busca ? "Nenhum cliente encontrado." : "Nenhum cliente com carteira cadastrada ainda."}
              </p>
              <p style={{ margin: "8px 0 0", fontSize: 12, color: C.textLight }}>Clique em "Depositar" para registrar o primeiro saldo.</p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: C.bg }}>
                <tr>
                  <th style={{ padding: "12px 24px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase", textAlign: "left" }}>Cliente</th>
                  <th style={{ padding: "12px 16px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase", textAlign: "right" }}>Última movimentação</th>
                  <th style={{ padding: "12px 24px", fontSize: 10, fontWeight: 700, color: C.sidebarBg, textTransform: "uppercase", textAlign: "right" }}>Saldo disponível</th>
                </tr>
              </thead>
              <tbody>
                {carteirasFiltradas.map(c => (
                  <tr key={c.cliente_id || c.cliente_nome} onClick={() => carregarExtrato(c)}
                    style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer", transition: "0.15s" }} className="hover:bg-slate-50">
                    <td style={{ padding: "14px 24px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${C.sidebarBg}18`, color: C.sidebarBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, flexShrink: 0 }}>
                          {avatar(c.cliente_nome)}
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: C.textMain }}>{c.cliente_nome}</span>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right", fontSize: 12, color: C.textMuted }}>
                      {new Date(c.ultima_movimentacao).toLocaleDateString('pt-BR')}
                    </td>
                    <td style={{ padding: "14px 24px", textAlign: "right" }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: c.saldo > 0 ? "#10B981" : c.saldo < 0 ? C.danger : C.textMuted }}>
                        {brl(c.saldo)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {clienteSel && (
        <TabelaExtrato
          clienteSel={clienteSel}
          extrato={extrato}
          onVoltar={() => { setClienteSel(null); setExtrato([]); carregarCarteiras(); }}
          onDepositar={() => abrirModalDeposito(clienteSel.cliente_nome, clienteSel.cliente_id || "")}
          onEstornar={estornarDeposito}
        />
      )}

      {modal && (
        <ModalDeposito
          perfil={perfil}
          initialClienteNome={modalClienteNome}
          initialClienteId={modalClienteId}
          onClose={() => setModal(false)}
          onSalvo={aoSalvarDeposito}
        />
      )}
    </div>
  );
}
