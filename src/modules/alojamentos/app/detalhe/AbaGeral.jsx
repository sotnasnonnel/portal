import { useState } from 'react';
import {
  Building2, CheckCircle2, FileText, MessageSquare, Pencil, Phone, Plus, Trash2, Users, X, Zap,
} from 'lucide-react';
import {
  fdate, money, num, plural, vagas,
} from '../../lib/regras';
import {
  Copiar, Nil, Pill,
} from '../components/Ui';

function Kv({ rotulo, sub, children }) {
  const vazio = children === undefined || children === null || children === false || children === '';
  return (
    <>
      <dt>{rotulo}</dt>
      <dd>
        {vazio ? <Nil /> : children}
        {sub && <span className="sub">{sub}</span>}
      </dd>
    </>
  );
}

function Contato({ nome, telefone, email }) {
  if (!nome && !telefone && !email) return null;
  return (
    <>
      {nome && <span>{nome}</span>}
      {telefone && <span className="aloj-chip"><Phone size={12} /> {telefone} <Copiar texto={telefone} /></span>}
      {email && <span className="aloj-chip">{email} <Copiar texto={email} /></span>}
    </>
  );
}

const juntar = (...partes) => partes.filter(Boolean).join(' · ');
const temContato = (...v) => v.some(Boolean);

function Pendencias({ a, acoes }) {
  const [texto, setTexto] = useState('');
  const pend = a.pendencias || [];
  const adicionar = (ev) => {
    ev.preventDefault();
    const t = texto.trim();
    if (!t) return;
    setTexto('');
    acoes.adicionarPendencia(a, t);
  };
  return (
    <div className="aloj-card">
      <div className="aloj-card-h">
        <h3><CheckCircle2 size={15} /> Pendências</h3>
        <span className="aloj-muted aloj-pequeno">{pend.filter((p) => !p.feito).length} em aberto</span>
      </div>
      <div className="aloj-card-b">
        {pend.length ? pend.map((p) => (
          <label key={p.id} className={`aloj-check${p.feito ? ' feito' : ''}`}>
            <input type="checkbox" checked={p.feito} onChange={(e) => acoes.alternarPendencia(p, e.target.checked)} />
            <span>{p.texto}</span>
            <button
              type="button"
              className="aloj-mini"
              title="Remover"
              aria-label="Remover pendência"
              onClick={(e) => { e.preventDefault(); acoes.removerPendencia(p); }}
            >
              <X size={14} />
            </button>
          </label>
        )) : <p className="aloj-muted aloj-m0">Nenhuma pendência registrada.</p>}
        <form className="aloj-addlinha" onSubmit={adicionar}>
          <input
            placeholder="Nova pendência (ex.: vistoria de saída, devolução da caução)"
            aria-label="Nova pendência"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <button type="submit" className="aloj-btn pequeno"><Plus size={14} /> Adicionar</button>
        </form>
      </div>
    </div>
  );
}

export default function AbaGeral({ a, acoes }) {
  const contas = a.contas || [];
  const qtdQuartos = (a.quartos || []).length;
  return (
    <div className="aloj-g2">
      <div className="aloj-card">
        <div className="aloj-card-h"><h3><FileText size={15} /> Contrato e locação</h3></div>
        <div className="aloj-card-b">
          <dl className="aloj-kv">
            <Kv rotulo="Locatário (CNPJ)">{a.cnpj_locacao}</Kv>
            <Kv rotulo="Proprietário / locador">
              {temContato(a.proprietario_nome, a.proprietario_telefone, a.proprietario_email)
                && <Contato nome={a.proprietario_nome} telefone={a.proprietario_telefone} email={a.proprietario_email} />}
            </Kv>
            <Kv rotulo="Imobiliária">
              {temContato(a.imobiliaria_nome, a.imobiliaria_telefone, a.imobiliaria_email)
                && <Contato nome={a.imobiliaria_nome} telefone={a.imobiliaria_telefone} email={a.imobiliaria_email} />}
            </Kv>
            <Kv
              rotulo="Valor do aluguel"
              sub={juntar(a.aluguel_vencimento && `Vencimento dia ${a.aluguel_vencimento}`, a.aluguel_cobranca)}
            >
              {num(a.aluguel_valor) !== null && <b>{money(a.aluguel_valor)}</b>}
            </Kv>
            <Kv rotulo="IPTU">{money(a.iptu)}</Kv>
            <Kv rotulo="Caução">{money(a.caucao)}</Kv>
            <Kv rotulo="Início do contrato">{fdate(a.contrato_inicio)}</Kv>
            <Kv rotulo="Fim do contrato" sub={a.contrato_renovacao_automatica ? 'Prorrogação automática' : ''}>{fdate(a.contrato_fim)}</Kv>
            <Kv rotulo="Prazo">{a.contrato_prazo}</Kv>
            {a.contrato_observacao && <Kv rotulo="Cláusulas / observação"><span className="aloj-pre">{a.contrato_observacao}</span></Kv>}
            {a.status === 'desmobilizacao' && <Kv rotulo="Entrega prevista">{fdate(a.encerramento_previsto)}</Kv>}
            {a.status === 'inativo' && <Kv rotulo="Devolução do imóvel" sub={a.devolucao_obs}>{fdate(a.devolucao_data)}</Kv>}
          </dl>
        </div>
      </div>

      <div className="aloj-pilha">
        <div className="aloj-card">
          <div className="aloj-card-h"><h3><Building2 size={15} /> Imóvel</h3></div>
          <div className="aloj-card-b">
            <dl className="aloj-kv">
              <Kv
                rotulo="Endereço"
                sub={juntar(a.cidade && `${a.cidade}${a.uf ? `/${a.uf}` : ''}`, a.cep && `CEP ${a.cep}`)}
              >
                {a.endereco}
              </Kv>
              <Kv rotulo="Composição">{a.composicao}</Kv>
              <Kv rotulo="Quartos / vagas">{qtdQuartos > 0 && `${qtdQuartos} quartos · ${vagas(a)} vagas`}</Kv>
              <Kv rotulo="Garagem" sub={a.garagem_usuarios}>{num(a.garagem_vagas) !== null && plural(+a.garagem_vagas, 'vaga')}</Kv>
              <Kv rotulo="Centro de custo">{a.centro_custo}</Kv>
              <Kv rotulo="Gerente responsável">{a.gerente}</Kv>
              <Kv rotulo="Contrato / projeto">{a.projeto}</Kv>
            </dl>
          </div>
        </div>
        <div className="aloj-card">
          <div className="aloj-card-h"><h3><Users size={15} /> Condomínio e serviços</h3></div>
          <div className="aloj-card-b">
            <dl className="aloj-kv">
              <Kv rotulo="Condomínio" sub={a.condominio_cobranca}>
                {(a.condominio_nome || num(a.condominio_valor) !== null) && (
                  <>
                    {a.condominio_nome && <span>{a.condominio_nome}</span>}
                    {num(a.condominio_valor) !== null && <b>{money(a.condominio_valor)}</b>}
                  </>
                )}
              </Kv>
              <Kv rotulo="Síndico">
                {temContato(a.sindico_nome, a.sindico_telefone) && <Contato nome={a.sindico_nome} telefone={a.sindico_telefone} />}
              </Kv>
              <Kv
                rotulo="Diarista / limpeza"
                sub={juntar(num(a.diarista_valor) !== null && money(a.diarista_valor), a.diarista_intervalo)}
              >
                {temContato(a.diarista_nome, a.diarista_telefone) && <Contato nome={a.diarista_nome} telefone={a.diarista_telefone} />}
              </Kv>
            </dl>
          </div>
        </div>
      </div>

      <div className="aloj-card cheio">
        <div className="aloj-card-h">
          <h3><Zap size={15} /> Contas de consumo</h3>
          <button type="button" className="aloj-btn pequeno" onClick={() => acoes.novaConta(a)}><Plus size={14} /> Adicionar conta</button>
        </div>
        <div className="aloj-card-b">
          {contas.length ? (
            <div className="aloj-tab-scroll">
              <table className="aloj-tab">
                <thead>
                  <tr><th>Conta</th><th>Fornecedor</th><th>UC / cód. cliente</th><th>Como recebe a cobrança</th><th>Venc.</th><th>Situação</th><th className="acao" /></tr>
                </thead>
                <tbody>
                  {contas.map((c) => (
                    <tr key={c.id}>
                      <td><b>{c.tipo}</b></td>
                      <td>{c.fornecedor || <Nil />}</td>
                      <td>{c.codigo ? <>{c.codigo} <Copiar texto={c.codigo} /></> : <Nil />}</td>
                      <td>{c.cobranca || <Nil />}{c.obs && <small>{c.obs}</small>}</td>
                      <td>{c.vencimento ? `dia ${c.vencimento}` : <Nil />}</td>
                      <td>{c.status === 'cancelada' ? <Pill>Cancelada</Pill> : <Pill c="good">Ativa</Pill>}</td>
                      <td className="acao">
                        <button type="button" className="aloj-mini" title="Editar" aria-label="Editar conta" onClick={() => acoes.editarConta(a, c)}><Pencil size={14} /></button>
                        <button type="button" className="aloj-mini" title="Remover" aria-label="Remover conta" onClick={() => acoes.excluirConta(a, c)}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="aloj-muted aloj-m0">Nenhuma conta de consumo cadastrada.</p>}
          <p className="aloj-muted aloj-pequeno aloj-mt">
            Contas controladas no quadro de pagamentos: <b>{(a.contas_controladas || []).join(', ') || 'nenhuma'}</b>.
          </p>
        </div>
      </div>

      <Pendencias a={a} acoes={acoes} />

      <div className="aloj-card">
        <div className="aloj-card-h"><h3><MessageSquare size={15} /> Observações</h3></div>
        <div className="aloj-card-b">
          {a.observacoes
            ? <p className="aloj-pre aloj-m0">{a.observacoes}</p>
            : <p className="aloj-muted aloj-m0">Sem observações.</p>}
          {a.origem && <p className="aloj-muted aloj-pequeno aloj-mt">Origem: {a.origem}</p>}
        </div>
      </div>
    </div>
  );
}
