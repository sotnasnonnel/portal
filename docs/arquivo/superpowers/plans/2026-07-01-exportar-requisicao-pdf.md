# Exportar requisição em PDF — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Baixar uma requisição individual em PDF (cabeçalho com logo + campos + anexo), com botão em 4 telas.

**Architecture:** Um serviço `requisicaoPdf.js` (jsPDF, import dinâmico) gera o documento reusando `buscarRespostas`/`fmtResposta`/`DETALHE` do `ModalRespostas.jsx` para os 4 tipos por-config e montando os campos direto da `solicitacoes_rh` para os 2 tipos diretos. A lógica pura (nome do arquivo, status, campos dos tipos diretos) fica num módulo testável `requisicaoPdfHelpers.js`. Um botão `BotaoPdfRequisicao` é plugado nas 4 telas.

**Tech Stack:** React 19, jsPDF + jspdf-autotable (já instalados), lucide-react. Testes com `node --test`.

## Global Constraints

- **SEM GIT:** este projeto não usa git. NÃO commitar nada. Cada task termina deixando os arquivos no working tree e verificando com lint/build (e `node --test` na Task 1). Nada de `git add`/`git commit`.
- Import dinâmico do serviço no clique (mantém jsPDF fora do bundle principal).
- Padrão visual do `src/modules/reembolso/services/reembolsoPdf.js`: `new jsPDF({ unit:'pt', format:'a4' })`, margem 40, título azul PHD `(38,64,93)`, cabeçalho terracotta `(195,94,30)` nas tabelas, `doc.save(nome)`.
- Conteúdo: logo PHD (`src/assets/logo-phd.png`) + Colaborador/Solicitante/Data/Status + campos + anexo (imagem embute em página nova; não-imagem vira linha "Anexo: nome"). SEM cadeia de aprovação.
- 6 tipos: 4 por-config (`ajuda_custo`, `nova_vaga`, `mapeamento`, `formulario_contratacao`) via `buscarRespostas`; 2 diretos (`aumento_salario`, `desligamento`) via campos da `solicitacoes_rh`.
- Nome do arquivo: `Requisicao_{TipoCurto}_{Colaborador}_{AAAA-MM-DD}.pdf`, sanitizado (sem espaços/acentos/especiais).
- `requisicaoPdfHelpers.js` NÃO pode importar jsPDF, assets, React ou CSS (precisa rodar em `node --test`). Só `utils/formatters` e `config/aprovacao`.

---

### Task 1: Helpers puros `requisicaoPdfHelpers.js` + testes

**Files:**
- Create: `src/services/requisicaoPdfHelpers.js`
- Test: `src/services/requisicaoPdfHelpers.test.js`

**Interfaces:**
- Consumes: `formatarMoeda`, `parseDesligamento` de `../utils/formatters`; `TIPO_LABEL_CURTO` de `../config/aprovacao`.
- Produces:
  - `STATUS_LABEL` (objeto)
  - `nomeArquivoRequisicao(sol, nomeColaborador) => string`
  - `linhasDiretas(sol) => Array<[string, string]>` (para `aumento_salario`/`desligamento`)

- [ ] **Step 1: Escrever o teste que falha**

Create `src/services/requisicaoPdfHelpers.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATUS_LABEL, nomeArquivoRequisicao, linhasDiretas } from './requisicaoPdfHelpers.js';

test('STATUS_LABEL mapeia os status conhecidos', () => {
  assert.equal(STATUS_LABEL.pendente, 'Em andamento');
  assert.equal(STATUS_LABEL.concluida, 'Concluída');
  assert.equal(STATUS_LABEL.reprovada, 'Reprovada');
});

test('nomeArquivoRequisicao sanitiza nome e usa a data (AAAA-MM-DD)', () => {
  const nome = nomeArquivoRequisicao(
    { tipo: 'ajuda_custo', created_at: '2026-07-01T12:00:00+00:00' },
    'João da Silva',
  );
  assert.match(nome, /^Requisicao_.+_JoaodaSilva_2026-07-01\.pdf$/);
  assert.ok(!/[ /à-ÿ]/.test(nome), 'sem espaços/acentos/barras');
});

test('nomeArquivoRequisicao tem defaults quando faltam dados', () => {
  const nome = nomeArquivoRequisicao({}, '');
  assert.match(nome, /^Requisicao_.+_Colaborador_0000-00-00\.pdf$/);
});

test('linhasDiretas monta as linhas de aumento_salario (só preenchidos)', () => {
  const linhas = linhasDiretas({
    tipo: 'aumento_salario',
    salario_proposto: 9500,
    funcao_proposta: 'ANALISTA',
    cargo_proposto: null,
    justificativa: 'merecimento',
    colaborador: { salario: 8000 },
  });
  const mapa = Object.fromEntries(linhas);
  assert.ok('Valor atual' in mapa);
  assert.ok('Valor proposto' in mapa);
  assert.equal(mapa['Função proposta'], 'ANALISTA');
  assert.ok(!('Cargo proposto' in mapa));
  assert.equal(mapa['Justificativa'], 'merecimento');
});

test('linhasDiretas monta as linhas de desligamento a partir da justificativa', () => {
  const just = 'Data solicitada para desligamento: 10/07/2026\n\nJustificativa: reestruturação';
  const linhas = linhasDiretas({ tipo: 'desligamento', justificativa: just });
  const mapa = Object.fromEntries(linhas);
  assert.equal(mapa['Data sugerida para desligamento'], '10/07/2026');
  assert.equal(mapa['Justificativa'], 'reestruturação');
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node --test "src/services/requisicaoPdfHelpers.test.js"`
Expected: FAIL — `Cannot find module './requisicaoPdfHelpers.js'`.

- [ ] **Step 3: Implementar os helpers**

Create `src/services/requisicaoPdfHelpers.js`:

```js
// Helpers puros do PDF de requisição. SEM jsPDF/asset/React/CSS — roda em `node --test`.
import { formatarMoeda, parseDesligamento } from '../utils/formatters';
import { TIPO_LABEL_CURTO } from '../config/aprovacao';

export const STATUS_LABEL = {
  pendente: 'Em andamento',
  concluida: 'Concluída',
  reprovada: 'Reprovada',
};

const sanitizar = (s) => String(s ?? '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')   // remove acentos
  .replace(/[^a-zA-Z0-9]+/g, '');    // remove espaços e especiais

/** Requisicao_{TipoCurto}_{Colaborador}_{AAAA-MM-DD}.pdf */
export function nomeArquivoRequisicao(sol, nomeColaborador) {
  const tipo = sanitizar(TIPO_LABEL_CURTO[sol?.tipo] || sol?.tipo || 'Requisicao');
  const nome = sanitizar(nomeColaborador || 'Colaborador') || 'Colaborador';
  const data = (sol?.created_at ? String(sol.created_at).slice(0, 10) : '') || '0000-00-00';
  return `Requisicao_${tipo}_${nome}_${data}.pdf`;
}

/** Linhas [label, valor] para os tipos que não têm DETALHE (config). */
export function linhasDiretas(sol) {
  if (sol?.tipo === 'desligamento') {
    const { data, texto } = parseDesligamento(sol.justificativa);
    const linhas = [];
    if (data) linhas.push(['Data sugerida para desligamento', data]);
    if (texto) linhas.push(['Justificativa', texto]);
    return linhas;
  }
  // aumento_salario (Alteração de Cargo / Função)
  const linhas = [];
  if (sol?.colaborador?.salario != null) linhas.push(['Valor atual', formatarMoeda(sol.colaborador.salario)]);
  if (sol?.salario_proposto != null) linhas.push(['Valor proposto', formatarMoeda(sol.salario_proposto)]);
  if (sol?.funcao_proposta) linhas.push(['Função proposta', String(sol.funcao_proposta)]);
  if (sol?.cargo_proposto) linhas.push(['Cargo proposto', String(sol.cargo_proposto)]);
  if (sol?.justificativa) linhas.push(['Justificativa', String(sol.justificativa)]);
  return linhas;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `node --test "src/services/requisicaoPdfHelpers.test.js"`
Expected: PASS — `# pass 5`, `# fail 0`.
(Se o import de `../config/aprovacao` falhar em Node por importar algo de browser, reportar como BLOCKED — nesse caso movemos `TIPO_LABEL_CURTO` para uso via parâmetro. Não deve acontecer: é um módulo de config/objetos.)

- [ ] **Step 5: Sanidade da suíte**

Run: `npm test`
Expected: os testes de `requisicaoPdfHelpers`, `currencyMask` e `organograma` passam. (Sem commit.)

---

### Task 2: Serviço `requisicaoPdf.js` + botão + export de `fmtResposta`

**Files:**
- Modify: `src/pages/Gestor/requisicoes/ModalRespostas.jsx` (exportar `fmtResposta`)
- Create: `src/services/requisicaoPdf.js`
- Create: `src/components/BotaoPdfRequisicao.jsx`

**Interfaces:**
- Consumes (Task 1): `STATUS_LABEL`, `nomeArquivoRequisicao`, `linhasDiretas` de `./requisicaoPdfHelpers`.
- Consumes: `buscarRespostas`, `fmtResposta` de `../pages/Gestor/requisicoes/ModalRespostas`; `TIPO_LABEL` de `../config/aprovacao`; `formatarData` de `../utils/formatters`; logo `../assets/logo-phd.png`.
- Produces:
  - `gerarRequisicaoPdf(sol, { nomeColaborador, nomeSolicitante }) => Promise<void>`
  - `BotaoPdfRequisicao` (default export): props `{ sol, nomeColaborador, nomeSolicitante, className?, label? }`.

- [ ] **Step 1: Exportar `fmtResposta` do ModalRespostas**

Modify `src/pages/Gestor/requisicoes/ModalRespostas.jsx` — trocar:

```jsx
const fmtResposta = (c, v) => {
```

por:

```jsx
export const fmtResposta = (c, v) => {
```

(Nada mais muda; a função continua usada internamente.)

- [ ] **Step 2: Criar o serviço de PDF**

Create `src/services/requisicaoPdf.js`:

```js
// Gera o PDF de uma requisição: cabeçalho (logo + dados) + tabela de campos +
// anexo (imagem em página nova; não-imagem vira linha). Carregado por import
// dinâmico. Espelha o padrão de src/modules/reembolso/services/reembolsoPdf.js.
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import logoPhd from '../assets/logo-phd.png';
import { TIPO_LABEL } from '../config/aprovacao';
import { formatarData } from '../utils/formatters';
import { buscarRespostas, fmtResposta } from '../pages/Gestor/requisicoes/ModalRespostas';
import { STATUS_LABEL, nomeArquivoRequisicao, linhasDiretas } from './requisicaoPdfHelpers';

async function urlParaDataUrl(url) {
  const resp = await fetch(url);
  const blob = await resp.blob();
  const dataUrl = await new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });
  return { dataUrl, type: blob.type };
}

export async function gerarRequisicaoPdf(sol, { nomeColaborador, nomeSolicitante } = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;

  // Logo (não bloqueia se falhar)
  try {
    const { dataUrl } = await urlParaDataUrl(logoPhd);
    const props = doc.getImageProperties(dataUrl);
    const h = 32;
    const w = props.width * (h / props.height);
    doc.addImage(dataUrl, props.fileType || 'PNG', margin, 30, w, h);
  } catch { /* segue sem logo */ }

  // Título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(38, 64, 93);
  doc.text(`Requisição — ${TIPO_LABEL[sol.tipo] || sol.tipo}`, pageW - margin, 52, { align: 'right' });

  doc.setDrawColor(224, 224, 224);
  doc.setLineWidth(0.8);
  doc.line(margin, 78, pageW - margin, 78);

  // Cabeçalho em duas colunas
  const half = (pageW - margin * 2) / 2;
  const col1 = margin;
  const col2 = margin + half;
  const lineH = 18;
  function field(label, value, x, yy) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(130, 130, 130);
    const lbl = `${label}: `;
    doc.text(lbl, x, yy);
    const lw = doc.getTextWidth(lbl);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.text(String(value ?? '—'), x + lw, yy);
  }

  let y = 100;
  field('Colaborador', nomeColaborador || sol.colaborador?.nome || '—', col1, y);
  field('Status', STATUS_LABEL[sol.status] || sol.status || '—', col2, y);
  y += lineH;
  field('Solicitante', nomeSolicitante || sol.gestor?.nome || '—', col1, y);
  field('Data', formatarData(sol.created_at), col2, y);
  y += lineH + 8;

  // Campos
  const r = await buscarRespostas(sol); // null para os tipos diretos
  let anexoUrl = null;
  let anexoNome = null;
  let linhas;
  if (r) {
    linhas = r.campos.map((c) => [c.label, fmtResposta(c, r.dados[c.id])]);
    anexoUrl = r.anexoUrl;
    anexoNome = r.dados.anexo_nome || null;
  } else {
    linhas = linhasDiretas(sol);
  }
  if (linhas.length === 0) linhas = [['—', 'Sem campos preenchidos']];

  autoTable(doc, {
    startY: y,
    head: [['Campo', 'Resposta']],
    body: linhas,
    styles: { fontSize: 9, cellPadding: 5, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [195, 94, 30] },
    columnStyles: { 0: { cellWidth: 190, fontStyle: 'bold' } },
    margin: { left: margin, right: margin },
  });
  y = doc.lastAutoTable.finalY + 16;

  // Anexo
  if (anexoUrl) {
    try {
      const { dataUrl, type } = await urlParaDataUrl(anexoUrl);
      if (type.startsWith('image/')) {
        doc.addPage();
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(38, 64, 93);
        doc.text(`Anexo: ${anexoNome || ''}`, margin, 40);
        const props = doc.getImageProperties(dataUrl);
        const maxW = pageW - margin * 2;
        const maxH = pageH - 70 - margin;
        const ratio = Math.min(maxW / props.width, maxH / props.height);
        const w = props.width * ratio;
        const h = props.height * ratio;
        doc.addImage(dataUrl, props.fileType || 'JPEG', margin + (maxW - w) / 2, 55, w, h);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);
        doc.text(`Anexo: ${anexoNome || 'arquivo'}`, margin, y);
      }
    } catch { /* ignora anexo que não carregou */ }
  }

  doc.save(nomeArquivoRequisicao(sol, nomeColaborador || sol.colaborador?.nome));
}
```

- [ ] **Step 3: Criar o botão**

Create `src/components/BotaoPdfRequisicao.jsx`:

```jsx
import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';

/** Botão "Baixar PDF" de uma requisição. Carrega o serviço por import dinâmico. */
export default function BotaoPdfRequisicao({ sol, nomeColaborador, nomeSolicitante, className = 'btn btn-outline btn-sm', label = 'Baixar PDF' }) {
  const [gerando, setGerando] = useState(false);
  const baixar = async () => {
    setGerando(true);
    try {
      const { gerarRequisicaoPdf } = await import('../services/requisicaoPdf');
      await gerarRequisicaoPdf(sol, { nomeColaborador, nomeSolicitante });
    } catch (err) {
      console.error(err);
      alert('Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setGerando(false);
    }
  };
  return (
    <button type="button" className={className} disabled={gerando} onClick={baixar}>
      {gerando ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} {label}
    </button>
  );
}
```

- [ ] **Step 4: Lint + Build**

Run: `npm run lint` → sem erros novos vindos dos 3 arquivos.
Run: `npm run build` → conclui sem erro (o import dinâmico de `requisicaoPdf` gera um chunk separado; imports resolvem).

*(Nada de commit — deixar no working tree.)*

---

### Task 3: Plugar o botão nas 4 telas

**Files:**
- Modify: `src/pages/Gestor/requisicoes/AcompanharRequisicoes.jsx`
- Modify: `src/pages/Gestor/requisicoes/RequisicoesRh.jsx`
- Modify: `src/pages/Admin/AdminSolicitacoes.jsx`
- Modify: `src/pages/Gestor/requisicoes/ModalRespostas.jsx`

**Interfaces:**
- Consumes (Task 2): `BotaoPdfRequisicao` (default export de `src/components/BotaoPdfRequisicao`).

- [ ] **Step 1: Acompanhar — botão no card + passar `sol` ao modal**

Modify `src/pages/Gestor/requisicoes/AcompanharRequisicoes.jsx`:

(a) Import no topo:

```jsx
import BotaoPdfRequisicao from '../../../components/BotaoPdfRequisicao';
```

(b) Guardar o `sol` do modal aberto. Trocar:

```jsx
  const [verRespostas, setVerRespostas] = useState(null);

  const abrirRespostas = async (sol) => setVerRespostas(await buscarRespostas(sol));
```

por:

```jsx
  const [verRespostas, setVerRespostas] = useState(null);
  const [solRespostas, setSolRespostas] = useState(null);

  const abrirRespostas = async (sol) => { setSolRespostas(sol); setVerRespostas(await buscarRespostas(sol)); };
```

(c) Fazer o bloco de ações aparecer sempre (com o PDF). Trocar:

```jsx
                  {(podeAprovar || DETALHE[s.tipo]) && (
                    <div className="sol-card-actions">
                      {DETALHE[s.tipo] && (
                        <button className="btn btn-outline btn-sm" onClick={() => abrirRespostas(s)}>
                          <FileText size={14} /> Ver respostas
                        </button>
                      )}
```

por:

```jsx
                  {(
                    <div className="sol-card-actions">
                      <BotaoPdfRequisicao sol={s} nomeColaborador={nomeColab} nomeSolicitante={nomeSolic} />
                      {DETALHE[s.tipo] && (
                        <button className="btn btn-outline btn-sm" onClick={() => abrirRespostas(s)}>
                          <FileText size={14} /> Ver respostas
                        </button>
                      )}
```

(o restante do bloco — `{podeAprovar && (...)}` e o fechamento `</div> )}` — permanece igual).

(d) Passar `sol`/nomes ao modal. Trocar:

```jsx
      <ModalRespostas respostas={verRespostas} onClose={() => setVerRespostas(null)} />
```

por:

```jsx
      <ModalRespostas
        respostas={verRespostas}
        sol={solRespostas}
        nomeColaborador={solRespostas ? (nomes[solRespostas.colaborador_id] || solRespostas.colaborador?.nome) : undefined}
        nomeSolicitante={solRespostas ? (nomes[solRespostas.gestor_id] || solRespostas.gestor?.nome) : undefined}
        onClose={() => { setVerRespostas(null); setSolRespostas(null); }}
      />
```

- [ ] **Step 2: RequisicoesRh — botão no modal de detalhe + passar `sol` ao ModalRespostas**

Modify `src/pages/Gestor/requisicoes/RequisicoesRh.jsx`:

(a) Import no topo:

```jsx
import BotaoPdfRequisicao from '../../../components/BotaoPdfRequisicao';
```

(b) Guardar o `sol` do modal de respostas. Trocar:

```jsx
  const [verRespostas, setVerRespostas] = useState(null);

  const abrirRespostas = async (sol) => setVerRespostas(await buscarRespostas(sol));
```

por:

```jsx
  const [verRespostas, setVerRespostas] = useState(null);
  const [solRespostas, setSolRespostas] = useState(null);

  const abrirRespostas = async (sol) => { setSolRespostas(sol); setVerRespostas(await buscarRespostas(sol)); };
```

(c) No modal de detalhe da linha, sempre mostrar as ações com o PDF. Trocar:

```jsx
                {DETALHE[s.tipo] ? (
                  <div className="sol-card-actions" style={{ marginTop: 'var(--space-md)' }}>
                    <button className="btn btn-outline btn-sm" onClick={() => abrirRespostas(s)}>
                      <FileText size={14} /> Ver respostas
                    </button>
                  </div>
                ) : null}
```

por:

```jsx
                <div className="sol-card-actions" style={{ marginTop: 'var(--space-md)' }}>
                  <BotaoPdfRequisicao sol={s} nomeColaborador={nomeColab(s)} nomeSolicitante={nomeSolic(s)} />
                  {DETALHE[s.tipo] && (
                    <button className="btn btn-outline btn-sm" onClick={() => abrirRespostas(s)}>
                      <FileText size={14} /> Ver respostas
                    </button>
                  )}
                </div>
```

(d) Passar `sol`/nomes ao ModalRespostas. Trocar:

```jsx
      <ModalRespostas respostas={verRespostas} onClose={() => setVerRespostas(null)} />
```

por:

```jsx
      <ModalRespostas
        respostas={verRespostas}
        sol={solRespostas}
        nomeColaborador={solRespostas ? nomeColab(solRespostas) : undefined}
        nomeSolicitante={solRespostas ? nomeSolic(solRespostas) : undefined}
        onClose={() => { setVerRespostas(null); setSolRespostas(null); }}
      />
```

- [ ] **Step 3: Admin — botão no card + passar `sol` ao ModalRespostas**

Modify `src/pages/Admin/AdminSolicitacoes.jsx`:

(a) Import no topo:

```jsx
import BotaoPdfRequisicao from '../../components/BotaoPdfRequisicao';
```

(b) No `sol-card-actions` do card (o `<div className="sol-card-actions">` que hoje começa com o botão "Ver respostas"), inserir o PDF como PRIMEIRO filho. Trocar:

```jsx
                  <div className="sol-card-actions">
                    {DETALHE[s.tipo] && (
                      <button className="btn btn-outline btn-sm" disabled={acaoId === s.id}
                        onClick={async () => setVerRespostas(await buscarRespostas(s))}>
                        <FileText size={14} /> Ver respostas
                      </button>
                    )}
```

por:

```jsx
                  <div className="sol-card-actions">
                    <BotaoPdfRequisicao sol={s} nomeColaborador={s.colaborador?.nome} nomeSolicitante={s.gestor?.nome} />
                    {DETALHE[s.tipo] && (
                      <button className="btn btn-outline btn-sm" disabled={acaoId === s.id}
                        onClick={async () => { setSolRespostas(s); setVerRespostas(await buscarRespostas(s)); }}>
                        <FileText size={14} /> Ver respostas
                      </button>
                    )}
```

(c) Adicionar o estado `solRespostas` junto dos outros `useState` do componente (perto de onde `verRespostas` é declarado):

```jsx
  const [solRespostas, setSolRespostas] = useState(null);
```

(d) Passar `sol`/nomes ao `<ModalRespostas .../>` (localizar a renderização do `ModalRespostas` no final do componente). Trocar:

```jsx
      <ModalRespostas respostas={verRespostas} onClose={() => setVerRespostas(null)} />
```

por:

```jsx
      <ModalRespostas
        respostas={verRespostas}
        sol={solRespostas}
        nomeColaborador={solRespostas?.colaborador?.nome}
        nomeSolicitante={solRespostas?.gestor?.nome}
        onClose={() => { setVerRespostas(null); setSolRespostas(null); }}
      />
```

(Se o `onClose` atual do ModalRespostas no Admin tiver outra forma, apenas acrescentar `setSolRespostas(null)` junto do `setVerRespostas(null)` e adicionar as props `sol`/`nomeColaborador`/`nomeSolicitante`.)

- [ ] **Step 4: ModalRespostas — aceitar `sol` e mostrar o botão no rodapé**

Modify `src/pages/Gestor/requisicoes/ModalRespostas.jsx`:

(a) Import no topo:

```jsx
import BotaoPdfRequisicao from '../../../components/BotaoPdfRequisicao';
```

(b) Aceitar as novas props. Trocar:

```jsx
export default function ModalRespostas({ respostas, onClose }) {
```

por:

```jsx
export default function ModalRespostas({ respostas, onClose, sol, nomeColaborador, nomeSolicitante }) {
```

(c) No rodapé, mostrar o botão quando houver `sol`. Trocar:

```jsx
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Fechar</button>
        </div>
```

por:

```jsx
        <div className="modal-footer">
          {sol && <BotaoPdfRequisicao sol={sol} nomeColaborador={nomeColaborador} nomeSolicitante={nomeSolicitante} />}
          <button className="btn btn-outline" onClick={onClose}>Fechar</button>
        </div>
```

- [ ] **Step 5: Lint + Build**

Run: `npm run lint` → sem erros novos vindos dos 4 arquivos.
Run: `npm run build` → conclui sem erro.

- [ ] **Step 6: Smoke manual (checklist para o controller/usuário)**

Run: `npm run dev`. Para cada ponto, baixar o PDF de requisições de tipos diferentes:
1. **Acompanhar** (gestor): botão "Baixar PDF" aparece em todo card; baixa o PDF com logo, cabeçalho (Colaborador/Solicitante/Data/Status) e a tabela de campos.
2. **RH/DP**: abrir uma requisição na tabela → botão no modal de detalhe.
3. **Admin**: botão no card expandido.
4. **Modal "Ver respostas"**: abrir respostas (tipo por-config) → botão no rodapé; o PDF traz os campos e, se houver, o anexo (imagem embutida em página nova; PDF/Word como "Anexo: nome").
5. Conferir um `aumento_salario` (valor atual→proposto, função, cargo) e um `desligamento` (data + justificativa).
6. Conferir o nome do arquivo: `Requisicao_{Tipo}_{Colaborador}_{AAAA-MM-DD}.pdf`.

*(Sem commit — deixar tudo no working tree para o deploy manual.)*

---

## Notas de execução

- **SEM GIT** em nenhuma task. Verificação = lint + build + `node --test` (Task 1) + smoke manual.
- Import dinâmico: `BotaoPdfRequisicao` faz `await import('../services/requisicaoPdf')`; o serviço importa jsPDF, então vira um chunk separado no build — confirmar que o build gera sem erro.
- `requisicaoPdfHelpers.js` deve ficar livre de jsPDF/asset/React/CSS para rodar no `node --test`.
