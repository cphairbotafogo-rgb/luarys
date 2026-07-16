'use client'
import { useSearchParams } from 'next/navigation';
import { PortalCliente } from './PortalCliente';

export function PortalClienteWrapper() {
  const params = useSearchParams();
  const salaoParam = params.get('salao');
  return <PortalCliente salaoParam={salaoParam} />;
}
