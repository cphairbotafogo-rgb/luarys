'use client'
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/constants';
import { RAIO_XS, RAIO_MD } from '@/lib/estiloGlobal';
import { FiAlertCircle, FiArrowLeft, FiArrowRight, FiCheckCircle, FiLoader } from 'react-icons/fi';
import { type Passo, TITULOS, SUBTITULOS, slugify, limpaCNPJ, validarCNPJ, validarCPF } from './helpers';
import { senhaVazada } from '@/lib/hibp';
import { PainelLateral } from './PainelLateral';
import { FormPasso1 } from './FormPasso1';
import { FormPasso2 } from './FormPasso2';
import { FormPasso3 } from './FormPasso3';
import { FormPasso4 } from './FormPasso4';

const TOTAL_PASSOS = 3;

export default function PaginaCadastro() {
  const router = useRouter();

  const [passo, setPasso]       = useState<Passo>(1);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro]         = useState('');

  // Passo 1
  const [email, setEmail]       = useState('');
  const [senha, setSenha]       = useState('');
  const [confirma, setConfirma] = useState('');

  // Passo 2
  const [nomeSalao, setNomeSalao]     = useState('');
  const [slugCustom, setSlugCustom]   = useState('');
  const [slugEditado, setSlugEditado] = useState(false);
  const [telefone, setTelefone]       = useState('');
  const [cidade, setCidade]           = useState('');
  const [estado, setEstado]           = useState('');

  // Passo 3
  const [cnpj, setCnpj]                         = useState('');
  const [razaoSocial, setRazaoSocial]           = useState('');
  const [responsavelNome, setResponsavelNome]   = useState('');
  const [responsavelCpf, setResponsavelCpf]     = useState('');

  const slugPreview = slugEditado ? slugCustom : slugify(nomeSalao);

  function handleNomeSalaoChange(v: string) {
    setNomeSalao(v);
    if (!slugEditado) setSlugCustom(slugify(v));
  }

  function handleSlugChange(val: string) {
    setSlugEditado(true);
    setSlugCustom(val);
  }

  function validarPasso1(): string {
    if (!email || !senha || !confirma) return 'Preencha todos os campos.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'E-mail inválido.';
    if (senha.length < 6) return 'A senha deve ter pelo menos 6 caracteres.';
    if (senha !== confirma) return 'As senhas não coincidem.';
    return '';
  }

  function validarPasso2(): string {
    if (!nomeSalao.trim()) return 'Informe o nome do salão.';
    if (!slugPreview || slugPreview.length < 3) return 'O link do salão deve ter pelo menos 3 caracteres.';
    if (!/^[a-z0-9-]{3,40}$/.test(slugPreview)) return 'Link inválido. Use apenas letras minúsculas, números e hífens.';
    return '';
  }

  function validarPasso3(): string {
    if (!cnpj.trim()) return 'CNPJ é obrigatório.';
    if (!validarCNPJ(cnpj)) return 'CNPJ inválido. Verifique o número digitado.';
    if (!razaoSocial.trim()) return 'Razão Social é obrigatória.';
    if (!responsavelNome.trim()) return 'Informe o nome completo do responsável.';
    if (!responsavelCpf.trim() || !validarCPF(responsavelCpf))
      return 'CPF do responsável inválido. Verifique o número digitado.';
    return '';
  }

  async function avancar() {
    setErro('');
    if (passo === 1) {
      const erroValidacao = validarPasso1();
      if (erroValidacao) { setErro(erroValidacao); return; }
      setSalvando(true);
      const vazada = await senhaVazada(senha);
      setSalvando(false);
      if (vazada) {
        setErro('Esta senha foi encontrada em vazamentos de dados. Escolha uma senha diferente e mais segura.');
        return;
      }
      setPasso(2);
      return;
    }
    let erroValidacao = '';
    if (passo === 2) erroValidacao = validarPasso2();
    if (passo === 3) erroValidacao = validarPasso3();
    if (erroValidacao) { setErro(erroValidacao); return; }
    if (passo === 3) finalizarCadastro();
    else setPasso((p) => (p + 1) as Passo);
  }

  async function finalizarCadastro() {
    setSalvando(true);
    setErro('');
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, senha,
          nomeSalao, telefone, cidade, estado, slug: slugPreview,
          cnpj: limpaCNPJ(cnpj),
          razaoSocial: razaoSocial.trim(),
          responsavelNome: responsavelNome.trim(),
          responsavelCpf: responsavelCpf.replace(/\D/g, ''),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.erro) {
        setErro(data.erro || 'Erro ao criar conta. Tente novamente.');
        setSalvando(false);
        return;
      }

      setPasso(4);
      const { error: loginErro } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (loginErro) setTimeout(() => router.push('/login'), 2000);
      else setTimeout(() => router.push('/#dashboard'), 1500);
    } catch {
      setErro('Erro de conexão. Verifique sua internet e tente novamente.');
      setSalvando(false);
    }
  }

  const erroStyle: React.CSSProperties = {
    background: C.dangerBg, border: `1px solid #FECACA`,
    borderRadius: RAIO_MD, padding: '12px 16px',
    color: C.dangerText, fontSize: 13, fontWeight: 600,
    display: 'flex', alignItems: 'center', gap: 8,
  };

  return (
    <div className="font-body" style={{ minHeight: '100vh', display: 'flex', background: C.bg }}>

      <PainelLateral passo={passo} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: 32, background: C.bgCard }}>
        <div style={{ width: '100%', maxWidth: 440 }}>

          {passo < 4 && (
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Passo {passo} de {TOTAL_PASSOS}
                </span>
                <span style={{ fontSize: 11, color: C.textLight }}>{Math.round((passo / TOTAL_PASSOS) * 100)}%</span>
              </div>
              <div style={{ height: 4, background: C.border, borderRadius: RAIO_XS, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: RAIO_XS, width: `${(passo / TOTAL_PASSOS) * 100}%`, background: C.douradoEleva, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          )}

          <div style={{ marginBottom: 32 }}>
            <h2 className="font-title" style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: C.sidebarBg }}>
              {TITULOS[passo]}
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: C.textMuted, fontWeight: 500 }}>
              {SUBTITULOS[passo]}
            </p>
          </div>

          {erro && (
            <div style={{ ...erroStyle, marginBottom: 20 }}>
              <FiAlertCircle size={16} /> {erro}
            </div>
          )}

          {passo === 1 && (
            <FormPasso1
              email={email} setEmail={setEmail}
              senha={senha} setSenha={setSenha}
              confirma={confirma} setConfirma={setConfirma}
              onEnter={avancar}
            />
          )}
          {passo === 2 && (
            <FormPasso2
              nomeSalao={nomeSalao} setNomeSalao={handleNomeSalaoChange}
              slugPreview={slugPreview} onSlugChange={handleSlugChange}
              telefone={telefone} setTelefone={setTelefone}
              cidade={cidade} setCidade={setCidade}
              estado={estado} setEstado={setEstado}
            />
          )}
          {passo === 3 && (
            <FormPasso3
              cnpj={cnpj} setCnpj={setCnpj}
              razaoSocial={razaoSocial} setRazaoSocial={setRazaoSocial}
              responsavelNome={responsavelNome} setResponsavelNome={setResponsavelNome}
              responsavelCpf={responsavelCpf} setResponsavelCpf={setResponsavelCpf}
              email={email} nomeSalao={nomeSalao} cidade={cidade} estado={estado}
            />
          )}
          {passo === 4 && <FormPasso4 responsavelNome={responsavelNome} />}

          {passo < 4 && (
            <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
              {passo > 1 && (
                <button
                  onClick={() => { setErro(''); setPasso((p) => (p - 1) as Passo); }}
                  style={{ flex: 1, padding: '14px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, background: 'transparent', color: C.textMuted, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <FiArrowLeft size={16} /> Voltar
                </button>
              )}
              <button
                onClick={avancar} disabled={salvando} suppressHydrationWarning
                style={{ flex: 2, padding: '14px', borderRadius: RAIO_MD, border: 'none', background: salvando ? C.borderMid : C.sidebarBg, color: '#fff', fontSize: 14, fontWeight: 700, cursor: salvando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s' }}
              >
                {salvando
                  ? <><FiLoader className="animate-spin" size={16} /> Criando conta...</>
                  : passo === 3
                    ? <><FiCheckCircle size={16} /> Criar minha conta e começar trial</>
                    : <>Continuar <FiArrowRight size={16} /></>
                }
              </button>
            </div>
          )}

          {passo === 1 && (
            <p style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: C.textMuted }}>
              Já tem conta?{' '}
              <a href="/login" style={{ color: C.sidebarBg, fontWeight: 700, textDecoration: 'none' }}>Fazer login</a>
            </p>
          )}

          {passo < 4 && (
            <p style={{ marginTop: 16, textAlign: 'center', fontSize: 11, color: C.textLight }}>
              <span style={{ color: '#EF4444', fontWeight: 900 }}>*</span> Campos obrigatórios
            </p>
          )}

        </div>
      </div>
    </div>
  );
}
