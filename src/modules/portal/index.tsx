'use client'
import React from "react";
import { PortalDashboard } from "./PortalDashboard";
import { PortalLogin } from "./PortalLogin";

// Componente que decide se mostra o Login ou o Dashboard do Portal
export function PortalIndex() {
  const [sessao, setSessao] = React.useState<any>(null);

  if (!sessao) {
    return <PortalLogin onLoginSucesso={setSessao} />;
  }

  return <PortalDashboard sessao={sessao} />;
}