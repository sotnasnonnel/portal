# Formulário de Contratação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A requisição "Formulário de Contratação" abre um formulário de Formalização de Admissão (25 campos, com condicionais) que, ao enviar, cria uma requisição no fluxo de aprovação geral do gestor e grava as respostas numa tabela dedicada.

**Architecture:** Envelope em `solicitacoes_rh` (tipo `formulario_contratacao`, sem colaborador) + etapas pela cadeia geral; detalhe em nova tabela `formularios_contratacao` ligada por `solicitacao_id`. Um schema de campos único (`config/formularioContratacao.js`) dirige render, validação e payload.

**Tech Stack:** React 19, Vite 8, Supabase JS, lucide-react, Vanilla CSS. Migrations via Supabase MCP (`apply_migration`/`execute_sql`), projeto `bogsuuhrgvopzgcceoqz`.

**Notas de ambiente:**
- **Sem framework de testes** (ESLint + Vite). Verificação = `npm run lint` + `npm run build` + checagem visual `npm run dev`.
- **NÃO commitar.** Apenas working tree. Ignore passos de commit.
- Rodar comandos a partir de `C:\Users\LennonSantos\Downloads\Phd\App Dp`.
- **Migrations:** Task 1 aplica DDL no banco compartilhado. As demais tasks só funcionam após a Task 1.

**Caveat conhecido (fora de escopo):** `solicitacoes_rh.status` tem CHECK que só aceita `'pendente'`/`'concluida'`; o caminho de reprovação (`AcompanharRequisicoes.confirmarReprovar`) grava `'reprovada'` e falharia — isso é pré-existente e vale para todos os tipos, não introduzido aqui. Não corrigir sem pedido do usuário.

---

## File Structure

**Migrations (DB):** nova tabela `formularios_contratacao`; CHECK de `tipo`; `colaborador_id` nullable.

**Criar:**
- `src/config/formularioContratacao.js` — schema dos 25 campos + helpers (`estadoInicial`, `validar`, `montarPayload`).
- `src/pages/Gestor/requisicoes/FormContratacao.jsx` — formulário.

**Modificar:**
- `src/pages/Gestor/requisicoes/useRequisicaoForm.js` — extrai `resolverCadeia`; adiciona `criarFormularioContratacao`.
- `src/config/requisicoes.js` — `formulario-contratacao` vira `pronto` + `tipoDb`.
- `src/config/aprovacao.js` — `TIPO_LABEL.formulario_contratacao`.
- `src/pages/Gestor/requisicoes/NovaRequisicao.jsx` — mapeia slug → `FormContratacao`.
- `src/pages/Gestor/requisicoes/Requisicoes.css` — estilos das opções do form.
- `src/pages/Gestor/requisicoes/AcompanharRequisicoes.jsx` — "Ver respostas" para o tipo novo.

---

## Task 1: Migrations no Supabase

**Files:** nenhum (DDL no banco `bogsuuhrgvopzgcceoqz`).

- [ ] **Step 1: Aplicar a migration** via `apply_migration` (name: `formulario_contratacao`), SQL:

```sql
-- 1) Liberar o tipo no CHECK de solicitacoes_rh.tipo (nome do constraint descoberto dinamicamente)
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
  WHERE conrelid = 'public.solicitacoes_rh'::regclass AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%tipo%';
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.solicitacoes_rh DROP CONSTRAINT %I', c);
  END IF;
END $$;

ALTER TABLE public.solicitacoes_rh
  ADD CONSTRAINT solicitacoes_rh_tipo_check
  CHECK (tipo = ANY (ARRAY['desligamento'::text, 'aumento_salario'::text, 'formulario_contratacao'::text]));

-- 2) colaborador_id passa a aceitar NULL (profissional admitido ainda não é colaborador)
ALTER TABLE public.solicitacoes_rh ALTER COLUMN colaborador_id DROP NOT NULL;

-- 3) Tabela de detalhe (RLS desativado, casa com o padrão de solicitacoes_rh)
CREATE TABLE IF NOT EXISTS public.formularios_contratacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid NOT NULL REFERENCES public.solicitacoes_rh(id) ON DELETE CASCADE,
  data_preenchimento date,
  nome_profissional text,
  telefone text,
  email text,
  cidade_estado text,
  gerente_area text,
  gestor_responsavel text,
  codigo_proposta_projeto text,
  codigo_vaga text,
  cargo_nivel text,
  remuneracao text,
  ajuda_custo boolean,
  condicao_ajuda_custo text,
  motivo_ajuda_custo text,
  valor_ajuda_custo numeric,
  formato_contratacao text,
  destinacao_profissional text,
  passagem_deslocamento boolean,
  rota_viagem text,
  tipo_vaga text,
  nome_substituido text,
  softwares_extras jsonb DEFAULT '[]'::jsonb,
  epis jsonb DEFAULT '[]'::jsonb,
  beneficios jsonb DEFAULT '[]'::jsonb,
  data_disponibilidade date,
  created_at timestamptz DEFAULT now()
);
```

- [ ] **Step 2: Verificar** via `execute_sql`:

```sql
SELECT
  (SELECT pg_get_constraintdef(oid) FROM pg_constraint
     WHERE conrelid='public.solicitacoes_rh'::regclass AND contype='c'
       AND pg_get_constraintdef(oid) LIKE '%tipo%') AS tipo_check,
  (SELECT is_nullable FROM information_schema.columns
     WHERE table_name='solicitacoes_rh' AND column_name='colaborador_id') AS colab_nullable,
  (SELECT count(*) FROM information_schema.tables
     WHERE table_name='formularios_contratacao') AS tabela_existe;
```
Expected: `tipo_check` inclui `formulario_contratacao`; `colab_nullable = YES`; `tabela_existe = 1`.

---

## Task 2: Schema do formulário

**Files:**
- Create: `src/config/formularioContratacao.js`

- [ ] **Step 1: Criar o schema + helpers**

```js
/**
 * Schema único do Formulário de Contratação (Formalização de Admissão).
 * Dirige render, validação e payload. `mostrar(form)` controla campos condicionais.
 * tipos: 'date' | 'text' | 'number' | 'bool' (Sim/Não) | 'radio' | 'checkbox'
 */
export const CAMPOS = [
  { id: 'data_preenchimento', n: 1, label: 'Data de preenchimento do formulário', tipo: 'date', obrigatorio: true },
  { id: 'nome_profissional', n: 2, label: 'Nome do profissional selecionado', tipo: 'text', obrigatorio: true },
  { id: 'telefone', n: 3, label: 'Telefone de contato do profissional', tipo: 'text', obrigatorio: true },
  { id: 'email', n: 4, label: 'E-mail de contato do profissional', tipo: 'text', obrigatorio: true },
  { id: 'cidade_estado', n: 5, label: 'Cidade e Estado em que o profissional irá atuar', tipo: 'text', obrigatorio: true },
  { id: 'gerente_area', n: 6, label: 'Gerente da área', tipo: 'text', obrigatorio: true },
  { id: 'gestor_responsavel', n: 7, label: 'Gestor responsável pela oportunidade', tipo: 'text', obrigatorio: true },
  { id: 'codigo_proposta_projeto', n: 8, label: 'Código da(o) proposta/projeto', tipo: 'text', obrigatorio: true },
  { id: 'codigo_vaga', n: 9, label: 'Código da Vaga (solicitar ao RH)', tipo: 'text', obrigatorio: true },
  { id: 'cargo_nivel', n: 10, label: 'Cargo e Nível', tipo: 'text', obrigatorio: true },
  { id: 'remuneracao', n: 11, label: 'Remuneração da Proposta Formal ao colaborador', tipo: 'text', obrigatorio: true },
  { id: 'ajuda_custo', n: 12, label: 'Ajuda de custo', tipo: 'bool', obrigatorio: true },
  {
    id: 'condicao_ajuda_custo', n: 13, label: 'Condição da Ajuda de Custo', tipo: 'radio', obrigatorio: true,
    mostrar: (f) => f.ajuda_custo === true,
    opcoes: ['Temporária (Oferecida pelo Cliente)', 'Temporária (Oferecida pela PHD)', 'Permanente (Oferecida pela PHD)', 'Não haverá ajuda de custo'],
  },
  {
    id: 'motivo_ajuda_custo', n: 14, label: 'Motivo da Ajuda de Custo', tipo: 'radio', obrigatorio: true,
    mostrar: (f) => f.ajuda_custo === true,
    opcoes: ['Alimentação', 'Alojamento', 'Complemento de Salário | Retirada', 'Não haverá ajuda de custo'],
  },
  { id: 'valor_ajuda_custo', n: 15, label: 'Valor da ajuda de custo', tipo: 'number', obrigatorio: true, mostrar: (f) => f.ajuda_custo === true },
  {
    id: 'formato_contratacao', n: 16, label: 'Formato de Contratação', tipo: 'radio', obrigatorio: true,
    opcoes: ['PHD Assessoria (Sócio Cotista)', 'PHD Engenharia (CLT)', 'PJ (Pessoa Jurídica)', 'PHD Assessoria (CLT)'],
  },
  { id: 'destinacao_profissional', n: 17, label: 'Destinação do profissional', tipo: 'radio', obrigatorio: true, opcoes: ['Obra', 'Sede'] },
  { id: 'passagem_deslocamento', n: 18, label: 'Passagem para deslocamento', tipo: 'bool', obrigatorio: true },
  { id: 'rota_viagem', n: 19, label: 'Rota de viagem para compra da passagem', tipo: 'text', obrigatorio: true, mostrar: (f) => f.passagem_deslocamento === true },
  { id: 'tipo_vaga', n: 20, label: 'Tipo de vaga', tipo: 'radio', obrigatorio: true, opcoes: ['Nova', 'Substituição'] },
  { id: 'nome_substituido', n: 21, label: 'Nome do profissional que será substituído', tipo: 'text', obrigatorio: true, mostrar: (f) => f.tipo_vaga === 'Substituição' },
  {
    id: 'softwares_extras', n: 22, label: 'Softwares Extras Necessários', tipo: 'checkbox', obrigatorio: false,
    opcoes: ['MS Project', 'Primavera P6', 'Acrobat Reader', 'Navisworks', 'DWG True View', 'Power BI', 'Pacote Office', '2° tela', 'Outra'],
  },
  {
    id: 'epis', n: 23, label: 'EPIs', tipo: 'checkbox', obrigatorio: false,
    opcoes: ['Camisa com faixa refletiva', 'Camisa polo', 'Agasalho', 'Jaleco', 'Botina com metatarso', 'Botina sem metatarso', 'Capacete', 'Protetor Auricular', 'Protetor Solar', 'Outra'],
  },
  {
    id: 'beneficios', n: 24, label: 'Benefícios', tipo: 'checkbox', obrigatorio: false,
    opcoes: ['Vale Alimentação (VA)', 'Vale Transporte (VT)', 'Alojamento', 'Passagem para mobilização', 'Passagem para desmobilização', 'Passagem para viagens periódicas', 'Passagem para folga de campo', 'Hospedagem em hotel', 'Outra'],
  },
  { id: 'data_disponibilidade', n: 25, label: 'Data de Disponibilidade do Profissional', tipo: 'date', obrigatorio: true },
];

export const camposVisiveis = (form) => CAMPOS.filter((c) => !c.mostrar || c.mostrar(form));

export function estadoInicial() {
  const s = {};
  for (const c of CAMPOS) {
    s[c.id] = c.tipo === 'checkbox' ? [] : c.tipo === 'bool' ? null : '';
  }
  return s;
}

/** Retorna os campos obrigatórios visíveis que estão vazios. */
export function validar(form) {
  const faltando = [];
  for (const c of camposVisiveis(form)) {
    if (!c.obrigatorio) continue;
    const v = form[c.id];
    const vazio = c.tipo === 'bool'
      ? typeof v !== 'boolean'
      : c.tipo === 'checkbox'
        ? !(Array.isArray(v) && v.length)
        : v == null || String(v).trim() === '';
    if (vazio) faltando.push(c);
  }
  return faltando;
}

/** Monta o payload p/ formularios_contratacao; campos ocultos viram null/[]. */
export function montarPayload(form) {
  const out = {};
  for (const c of CAMPOS) {
    const vis = !c.mostrar || c.mostrar(form);
    if (!vis) { out[c.id] = c.tipo === 'checkbox' ? [] : null; continue; }
    const v = form[c.id];
    if (c.tipo === 'number') out[c.id] = v === '' || v == null ? null : Number(v);
    else if (c.tipo === 'checkbox') out[c.id] = Array.isArray(v) ? v : [];
    else if (c.tipo === 'bool') out[c.id] = typeof v === 'boolean' ? v : null;
    else out[c.id] = v === '' ? null : v;
  }
  return out;
}
```

- [ ] **Step 2: Lint** — `npm run lint` (sem erros no arquivo novo).

---

## Task 3: Hook — `criarFormularioContratacao`

**Files:**
- Modify: `src/pages/Gestor/requisicoes/useRequisicaoForm.js`

- [ ] **Step 1: Extrair `resolverCadeia` e refatorar `criarComFluxo`**

Substituir o `criarComFluxo` atual (todo o `const criarComFluxo = useCallback(...)`) por:

```js
  // Resolve a cadeia geral do gestor: ids ordenados + nomes (snapshot do papel).
  const resolverCadeia = useCallback(async () => {
    const { fluxo, erro } = await buscarFluxoGeral(supabase, user.id);
    if (erro) throw new Error('Erro ao consultar o fluxo de aprovação. Tente novamente.');
    if (!fluxo) throw new Error('SEM_FLUXO');
    const ids = (Array.isArray(fluxo.aprovadores) ? fluxo.aprovadores : [])
      .map((x) => (x || '').trim()).filter(Boolean);
    let nomePorId = {};
    if (ids.length) {
      const { data: cols, error: e } = await supabase
        .from('colaboradores').select('id, nome').in('id', ids);
      if (e) throw e;
      nomePorId = Object.fromEntries((cols || []).map((c) => [c.id, c.nome]));
    }
    return { ids, nomePorId };
  }, [user]);

  const criarComFluxo = useCallback(async (tipo, iniciativa, dadosSolicitacao) => {
    // O fluxo é o geral do gestor; tipo/iniciativa seguem só no registro da solicitação.
    const { ids, nomePorId } = await resolverCadeia();

    const { data: sol, error: eSol } = await supabase
      .from('solicitacoes_rh').insert([dadosSolicitacao]).select('id').single();
    if (eSol) throw eSol;

    try {
      const linhas = montarEtapasDeConfig(sol.id, ids, user.id, nomePorId);
      const { error: eEt } = await supabase.from('solicitacoes_rh_etapas').insert(linhas);
      if (eEt) throw eEt;
    } catch (err) {
      await supabase.from('solicitacoes_rh').delete().eq('id', sol.id);
      throw err;
    }
    window.dispatchEvent(new Event('solicitacoes_rh_atualizadas'));
    return sol.id;
  }, [resolverCadeia, user]);

  // Cria a requisição do Formulário de Contratação: envelope + etapas + detalhe (atômico).
  const criarFormularioContratacao = useCallback(async (respostas) => {
    const { ids, nomePorId } = await resolverCadeia();

    const resumo = `Formalização de admissão: ${respostas.nome_profissional || '—'}`
      + (respostas.cargo_nivel ? ` — ${respostas.cargo_nivel}` : '');

    const { data: sol, error: eSol } = await supabase
      .from('solicitacoes_rh').insert([{
        tipo: 'formulario_contratacao',
        gestor_id: user.id,
        colaborador_id: null,
        justificativa: resumo,
        status: 'pendente',
      }]).select('id').single();
    if (eSol) throw eSol;

    try {
      const linhas = montarEtapasDeConfig(sol.id, ids, user.id, nomePorId);
      const { error: eEt } = await supabase.from('solicitacoes_rh_etapas').insert(linhas);
      if (eEt) throw eEt;
    } catch (err) {
      await supabase.from('solicitacoes_rh').delete().eq('id', sol.id);
      throw err;
    }

    const { error: eDet } = await supabase
      .from('formularios_contratacao').insert([{ ...respostas, solicitacao_id: sol.id }]);
    if (eDet) {
      // Desfaz envelope + etapas para não deixar órfão.
      await supabase.from('solicitacoes_rh_etapas').delete().eq('solicitacao_id', sol.id);
      await supabase.from('solicitacoes_rh').delete().eq('id', sol.id);
      throw eDet;
    }

    window.dispatchEvent(new Event('solicitacoes_rh_atualizadas'));
    return sol.id;
  }, [resolverCadeia, user]);
```

- [ ] **Step 2: Expor o novo método no retorno do hook**

Trocar a linha de retorno:
```js
  return { user, equipe, loadingEquipe, fluxoOk, submitting, setSubmitting, criarComFluxo, refetchFluxo };
```
por:
```js
  return { user, equipe, loadingEquipe, fluxoOk, submitting, setSubmitting, criarComFluxo, criarFormularioContratacao, refetchFluxo };
```

- [ ] **Step 3: Lint** — `npm run lint` (sem erros novos; sem violação de react-hooks/exhaustive-deps).

---

## Task 4: `FormContratacao.jsx`

**Files:**
- Create: `src/pages/Gestor/requisicoes/FormContratacao.jsx`

- [ ] **Step 1: Criar o componente**

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Loader2, Check, ArrowRight, AlertTriangle } from 'lucide-react';
import { useRequisicaoForm } from './useRequisicaoForm';
import { CAMPOS, camposVisiveis, estadoInicial, validar, montarPayload } from '../../../config/formularioContratacao';
import '../../../components/UI/Components.css';
import '../Gestor.css';
import './Requisicoes.css';

export default function FormContratacao() {
  const navigate = useNavigate();
  const { fluxoOk, submitting, setSubmitting, criarFormularioContratacao, refetchFluxo } = useRequisicaoForm();
  const [form, setForm] = useState(estadoInicial);
  const [faltando, setFaltando] = useState([]);
  const [sucesso, setSucesso] = useState(null);

  const semFluxo = fluxoOk === false;
  const set = (id, valor) => setForm((p) => ({ ...p, [id]: valor }));
  const toggleCheck = (id, opt) => setForm((p) => {
    const arr = Array.isArray(p[id]) ? p[id] : [];
    return { ...p, [id]: arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt] };
  });

  const onSubmit = async (e) => {
    e.preventDefault();
    const falta = validar(form);
    setFaltando(falta.map((c) => c.id));
    if (falta.length) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    setSubmitting(true);
    try {
      const novoId = await criarFormularioContratacao(montarPayload(form));
      setForm(estadoInicial());
      setFaltando([]);
      setSucesso({ texto: 'Formulário de contratação enviado com sucesso!', id: novoId });
      refetchFluxo();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error(err);
      if (err.message === 'SEM_FLUXO') {
        alert('O administrador ainda não configurou o fluxo de aprovação para você. Solicite a configuração ao DP.');
      } else {
        alert(err.message || 'Erro ao enviar o formulário. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderCampo = (c) => {
    const val = form[c.id];
    if (c.tipo === 'date' || c.tipo === 'text' || c.tipo === 'number') {
      return (
        <input
          className="form-input"
          type={c.tipo === 'number' ? 'number' : c.tipo === 'date' ? 'date' : 'text'}
          value={val}
          onChange={(e) => set(c.id, e.target.value)}
        />
      );
    }
    if (c.tipo === 'bool') {
      return (
        <div className="contratacao-opcoes">
          {[['Sim', true], ['Não', false]].map(([lab, v]) => (
            <label key={lab} className={`contratacao-opcao ${val === v ? 'active' : ''}`}>
              <input type="radio" name={c.id} checked={val === v} onChange={() => set(c.id, v)} />
              <span>{lab}</span>
            </label>
          ))}
        </div>
      );
    }
    if (c.tipo === 'radio') {
      return (
        <div className="contratacao-opcoes contratacao-opcoes-col">
          {c.opcoes.map((opt) => (
            <label key={opt} className={`contratacao-opcao ${val === opt ? 'active' : ''}`}>
              <input type="radio" name={c.id} checked={val === opt} onChange={() => set(c.id, opt)} />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      );
    }
    return (
      <div className="contratacao-opcoes contratacao-opcoes-col">
        {c.opcoes.map((opt) => {
          const checked = Array.isArray(val) && val.includes(opt);
          return (
            <label key={opt} className={`contratacao-opcao ${checked ? 'active' : ''}`}>
              <input type="checkbox" checked={checked} onChange={() => toggleCheck(c.id, opt)} />
              <span>{opt}</span>
            </label>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {sucesso && (
        <div className="success-msg" style={{ marginBottom: 'var(--space-lg)' }}>
          <Check size={16} /> {sucesso.texto}
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', color: 'inherit' }}
            onClick={() => navigate('/gestor/solicitacoes/acompanhar')}>
            Ver andamento <ArrowRight size={14} />
          </button>
        </div>
      )}

      <div className="table-container">
        <div className="table-header">
          <div className="table-header-title"><FileText size={18} /> Formulário para admissão</div>
          {semFluxo && (
            <span className="badge inativo" title="Fluxo de aprovação não configurado">
              <AlertTriangle size={13} /> Fluxo não configurado
            </span>
          )}
        </div>

        <form onSubmit={onSubmit} style={{ padding: 'var(--space-xl)' }}>
          {faltando.length > 0 && (
            <div className="sol-card-resumo tom-reprovada" style={{ marginBottom: 'var(--space-lg)' }}>
              Preencha os campos obrigatórios destacados ({faltando.length}).
            </div>
          )}

          {camposVisiveis(form).map((c) => (
            <div key={c.id} className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
              <label className="form-label">
                {c.n}. {c.label}{c.obrigatorio && <span className="required"> *</span>}
              </label>
              {renderCampo(c)}
              {faltando.includes(c.id) && <span className="contratacao-erro">Obrigatório</span>}
            </div>
          ))}

          {semFluxo && (
            <div className="sol-card-resumo tom-reprovada" style={{ marginBottom: 'var(--space-md)' }}>
              O administrador ainda não configurou o fluxo de aprovação para você. Solicite a configuração ao DP.
            </div>
          )}
          <button className="btn btn-primary" type="submit" disabled={submitting || semFluxo} style={{ width: '100%' }}>
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
            {submitting ? 'Enviando...' : 'Enviar'}
          </button>
        </form>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Lint** — `npm run lint` (sem erros novos).

---

## Task 5: Registrar o card + label + rota

**Files:**
- Modify: `src/config/requisicoes.js`
- Modify: `src/config/aprovacao.js`
- Modify: `src/pages/Gestor/requisicoes/NovaRequisicao.jsx`

- [ ] **Step 1: `requisicoes.js` — card vira `pronto`**

Trocar:
```js
  { slug: 'formulario-contratacao', label: 'Formulário de Contratação', icon: FileText, status: 'em_breve' },
```
por:
```js
  { slug: 'formulario-contratacao', label: 'Formulário de Contratação', icon: FileText, status: 'pronto', tipoDb: 'formulario_contratacao' },
```

- [ ] **Step 2: `aprovacao.js` — label do tipo**

Trocar o objeto `TIPO_LABEL`:
```js
export const TIPO_LABEL = {
  aumento_salario: 'Alteração de Retirada de dividendo, cargo e função',
  desligamento: 'Desligamento',
};
```
por:
```js
export const TIPO_LABEL = {
  aumento_salario: 'Alteração de Retirada de dividendo, cargo e função',
  desligamento: 'Desligamento',
  formulario_contratacao: 'Formulário de Contratação',
};
```

- [ ] **Step 3: `NovaRequisicao.jsx` — mapear o form**

Trocar o import:
```js
import FormDesligamento from './FormDesligamento';
import FormAlteracao from './FormAlteracao';
import EmConstrucao from './EmConstrucao';
```
por:
```js
import FormDesligamento from './FormDesligamento';
import FormAlteracao from './FormAlteracao';
import FormContratacao from './FormContratacao';
import EmConstrucao from './EmConstrucao';
```
e trocar o mapa `FORMS`:
```js
const FORMS = {
  desligamento: FormDesligamento,
  alteracao: FormAlteracao,
};
```
por:
```js
const FORMS = {
  desligamento: FormDesligamento,
  alteracao: FormAlteracao,
  'formulario-contratacao': FormContratacao,
};
```

- [ ] **Step 4: Lint** — `npm run lint`.

---

## Task 6: CSS das opções

**Files:**
- Modify: `src/pages/Gestor/requisicoes/Requisicoes.css`

- [ ] **Step 1: Anexar ao fim do arquivo**

```css
.contratacao-opcoes {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.contratacao-opcoes-col {
  flex-direction: column;
}

.contratacao-opcao {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 13px;
  color: var(--color-text-secondary);
  transition: all var(--transition-normal);
}

.contratacao-opcao input {
  accent-color: var(--color-primary, #1d4ed8);
}

.contratacao-opcao.active {
  border-color: var(--color-primary, #1d4ed8);
  background: var(--color-bg-subtle);
  color: var(--color-text-primary, var(--color-text-secondary));
  font-weight: 600;
}

.contratacao-erro {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-danger);
}
```

- [ ] **Step 2: Build** — `npm run build` (CSS compila).

---

## Task 7: "Ver respostas" no Acompanhar

**Files:**
- Modify: `src/pages/Gestor/requisicoes/AcompanharRequisicoes.jsx`

- [ ] **Step 1: Imports — adicionar `FileText` e o schema**

Trocar:
```js
import { Check, X, Loader2, ClipboardCheck } from 'lucide-react';
```
por:
```js
import { Check, X, Loader2, ClipboardCheck, FileText } from 'lucide-react';
```
e adicionar, após os imports de `aprovacao`:
```js
import { CAMPOS } from '../../../config/formularioContratacao';
```

- [ ] **Step 2: Estado + loader das respostas**

Logo após `const [reprovarTexto, setReprovarTexto] = useState('');` adicionar:
```js
  const [verRespostas, setVerRespostas] = useState(null);

  const abrirRespostas = async (sol) => {
    const { data } = await supabase
      .from('formularios_contratacao').select('*').eq('solicitacao_id', sol.id).maybeSingle();
    setVerRespostas(data || {});
  };

  const fmtResposta = (c, v) => {
    if (v == null || v === '') return '—';
    if (c.tipo === 'bool') return v ? 'Sim' : 'Não';
    if (c.tipo === 'checkbox') return Array.isArray(v) && v.length ? v.join('; ') : '—';
    return String(v);
  };
```

- [ ] **Step 3: Botão "Ver respostas" no card do tipo novo**

Trocar o bloco de ações:
```jsx
                  {podeAprovar && (
                    <div className="sol-card-actions">
                      <button className="btn btn-success btn-sm" disabled={acaoId === s.id} onClick={() => aprovar(s)}>
                        {acaoId === s.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Aprovar
                      </button>
                      <button className="btn btn-danger btn-sm" disabled={acaoId === s.id} onClick={() => { setReprovarSol(s); setReprovarTexto(''); }}>
                        <X size={14} /> Reprovar
                      </button>
                    </div>
                  )}
```
por:
```jsx
                  {(podeAprovar || s.tipo === 'formulario_contratacao') && (
                    <div className="sol-card-actions">
                      {s.tipo === 'formulario_contratacao' && (
                        <button className="btn btn-outline btn-sm" onClick={() => abrirRespostas(s)}>
                          <FileText size={14} /> Ver respostas
                        </button>
                      )}
                      {podeAprovar && (
                        <>
                          <button className="btn btn-success btn-sm" disabled={acaoId === s.id} onClick={() => aprovar(s)}>
                            {acaoId === s.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Aprovar
                          </button>
                          <button className="btn btn-danger btn-sm" disabled={acaoId === s.id} onClick={() => { setReprovarSol(s); setReprovarTexto(''); }}>
                            <X size={14} /> Reprovar
                          </button>
                        </>
                      )}
                    </div>
                  )}
```

- [ ] **Step 4: Modal de respostas**

Logo antes do fechamento `</div>` final do componente (depois do bloco `{reprovarSol && (...)}`), adicionar:
```jsx
      {verRespostas && (
        <div className="modal-overlay" onClick={() => setVerRespostas(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <span className="modal-title">Formulário de Contratação</span>
              <button className="modal-close" onClick={() => setVerRespostas(null)}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {CAMPOS.map((c) => (
                <div key={c.id} style={{ marginBottom: 'var(--space-md)' }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{c.n}. {c.label}</div>
                  <div style={{ fontSize: 14, color: 'var(--color-text-primary, var(--color-text-secondary))' }}>{fmtResposta(c, verRespostas[c.id])}</div>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setVerRespostas(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 5: Lint** — `npm run lint`.

---

## Task 8: Verificação final

**Files:** nenhum.

- [ ] **Step 1: Lint e build**

Run: `npm run lint` → sem erros NOVOS (pré-existentes em Layout.jsx/Sidebar.jsx/OnboardingModal.jsx/AuthContext.jsx/GestorAprovacoes.jsx/UsuarioDashboard.jsx/seed.js permanecem).
Run: `npm run build` → conclui sem erro de resolução de import.

- [ ] **Step 2: Validação visual (`npm run dev`, como gestor)**

- Hub → card "Formulário de Contratação" agora clicável (sem selo "Em breve") → abre o form.
- Condicionais: Ajuda de custo = Não oculta Q13–15; = Sim mostra; Tipo de vaga = Substituição mostra Q21; Passagem = Não oculta Q19.
- Tentar enviar vazio → destaca obrigatórios e não envia.
- Preencher e enviar (gestor COM cadeia geral) → sucesso; aparece em "Aprovar/Acompanhar" com o resumo; "Ver respostas" abre o modal com as 25 respostas.
- Conferir no banco: 1 linha em `solicitacoes_rh` (tipo `formulario_contratacao`, colaborador_id nulo) + 1 em `formularios_contratacao` ligada por `solicitacao_id`, e etapas geradas.

(Sem commit.)
