# Upload de arquivos

## Bug real encontrado no projeto (jun/2026) — usar como exemplo do que não fazer

```ts
// src/modules/crm/AbaCRM.tsx — handleUploadFoto
async function handleUploadFoto(e: any) {
  const file = e.target.files?.[0];
  if (!file || !perfil?.salao_id) return;
  toast.aviso('Foto muito grande. Máximo 2MB.'); // dispara sempre, sem checar nada!

  setSubindoFoto(true);
  const ext  = file.name.split('.').pop();
  const path = `avatares/${perfil.salao_id}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('clientes-fotos').upload(path, file, { upsert: true });
  // ...
}
```

O aviso de "máximo 2MB" aparece sempre (mesmo para um arquivo de 10KB),
porque não existe nenhum `if (file.size > LIMITE)` de verdade — e mais
importante: não há limite real aplicado. Qualquer arquivo, de qualquer
tamanho e tipo, pode ser enviado.

## Checklist para qualquer upload novo (ou ao corrigir um existente)

### 1. Validar tamanho de verdade, no client E no bucket

```ts
const TAMANHO_MAXIMO_MB = 2;
const TAMANHO_MAXIMO_BYTES = TAMANHO_MAXIMO_MB * 1024 * 1024;

async function handleUploadFoto(e: any) {
  const file = e.target.files?.[0];
  if (!file || !perfil?.salao_id) return;

  if (file.size > TAMANHO_MAXIMO_BYTES) {
    toast.aviso(`Foto muito grande. Máximo ${TAMANHO_MAXIMO_MB}MB.`);
    return; // PARA aqui — não prossegue para o upload
  }
  // ...
}
```

Validação no client é conveniência de UX, não segurança — alguém pode
contornar o client e chamar a API direto. O Supabase Storage permite
configurar limite de tamanho por bucket nas configurações do projeto;
confirmar que os buckets usados (`clientes-fotos`, `avatars` etc.) têm
limite configurado lá também, não só no frontend.

### 2. Validar tipo de arquivo pelo conteúdo, não só pela extensão do nome

```ts
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];

if (!TIPOS_PERMITIDOS.includes(file.type)) {
  toast.aviso('Envie apenas imagens JPG, PNG ou WebP.');
  return;
}
```

`file.type` já é mais confiável que olhar só a extensão do nome, mas
ainda pode ser forjado por um client malicioso chamando a API direto
(ex: interceptando a requisição com uma ferramenta de proxy e trocando o
header antes de enviar). Para uploads críticos (documentos fiscais,
comprovantes), validar pelo conteúdo real do arquivo no servidor — os
primeiros bytes de um arquivo identificam o formato real independente do
que o nome/MIME type declara ("magic bytes"). No Node.js, a biblioteca
`file-type` (`npm install file-type`) faz essa leitura:

```ts
import { fileTypeFromBuffer } from 'file-type';

const buffer = await file.arrayBuffer();
const tipoReal = await fileTypeFromBuffer(Buffer.from(buffer));

if (!tipoReal || !['jpg', 'png', 'webp'].includes(tipoReal.ext)) {
  return NextResponse.json({ erro: 'Arquivo inválido.' }, { status: 400 });
}
```

Isso é mais relevante para uploads que vão para um bucket onde o arquivo
pode ser executado/interpretado de alguma forma (ex: servido como HTML),
do que para uma foto de perfil simples — calibrar o esforço pelo risco
real de cada upload, não aplicar magic bytes em tudo por padrão.

### 3. Nome do arquivo no Storage nunca usa o nome original do usuário direto

```ts
// Já correto no projeto — usa salao_id + timestamp, não o nome original
const path = `avatares/${perfil.salao_id}/${Date.now()}.${ext}`;
```

Isso evita colisão de nomes e um usuário malicioso tentando manipular o
path (ex: nome de arquivo tipo `../../outro-salao/foto.jpg`, "path
traversal"). Manter esse padrão em uploads novos.

### 4. Bucket público vs privado

`getPublicUrl()` só faz sentido para buckets públicos. Para arquivo que
não deveria ser acessível por qualquer um com o link (documento fiscal,
comprovante com dado sensível), usar bucket privado + `createSignedUrl()`
(URL temporária, expira) em vez de URL pública permanente.

Para qualquer bucket que aceite tipos de arquivo além de imagem (ex: PDF
de comprovante), configurar o bucket para servir com header
`Content-Disposition: attachment` em vez de exibir inline no navegador —
isso evita que um arquivo malicioso disfarçado (ex: HTML com script,
renomeado para parecer outra coisa) seja executado/interpretado pelo
navegador ao ser aberto direto pela URL, em vez de baixado.

### 5. Limite de quantidade/frequência

Mesmo com limite de tamanho por arquivo, nada impede hoje alguém de
enviar centenas de arquivos em sequência. Para upload exposto a usuário
final, considerar limite de quantidade por usuário/dia.
