import { AlertTriangle, FileCheck2 } from 'lucide-react';
import {
  CONF, compLong, confSt, fdate, fdateTs, money, num,
} from '../../lib/regras';
import { ArquivoLinha } from './Anexos';
import { Nil, Pill } from './Ui';

/** Quem conferiu e quando, numa linha: "Lennon · 05/11/2026". */
const carimboConferencia = (p) => [p.conferido_por_nome, fdateTs(p.conferido_em)].filter(Boolean).join(' · ');

/** Situação da conferência para as tabelas: o selo, o carimbo e a observação. */
export function CelulaConferencia({ p }) {
  const cs = confSt(p);
  return (
    <>
      <Pill c={CONF[cs].c}>{CONF[cs].l}</Pill>
      {cs !== 'pendente' && carimboConferencia(p) && <small>{carimboConferencia(p)}</small>}
      {p.conferencia_obs && <small className={cs === 'divergencia' ? 't-bad' : ''}>{p.conferencia_obs}</small>}
    </>
  );
}

/** Aviso no topo do formulário de edição de um lançamento já conferido. */
export function NotaConferencia({ p }) {
  const cs = confSt(p);
  return (
    <div className={`aloj-nota${cs === 'divergencia' ? ' tom-warn' : ''}`}>
      <FileCheck2 size={14} />
      <p>
        {CONF[cs].l}{carimboConferencia(p) ? ` por ${carimboConferencia(p)}` : ''}{p.conferencia_obs ? `: ${p.conferencia_obs}` : ''}.
        {' '}Alterar valor, vencimento ou anexos devolve o lançamento para “A conferir”.
      </p>
    </div>
  );
}

const Linha = ({ rotulo, children }) => (
  <>
    <dt>{rotulo}</dt>
    <dd>{children || <Nil />}</dd>
  </>
);

/** O que o Contas a Pagar confere: o lançamento à esquerda, as faturas à direita. */
export function ResumoConferencia({ p, a, onErro }) {
  const fs = p.anexos || [];
  return (
    <>
      {confSt(p) === 'pendente' && p.conferencia_obs && (
        <div className="aloj-nota tom-warn"><AlertTriangle size={14} /><p>{p.conferencia_obs}</p></div>
      )}
      <div className="aloj-conf-sum">
        <dl className="aloj-kv">
          <Linha rotulo="Alojamento">
            {a?.nome}
            {a?.centro_custo && <span className="aloj-chip">CC <b>{a.centro_custo}</b></span>}
          </Linha>
          <Linha rotulo="Conta">
            {p.conta}
            {p.fornecedor && <span className="sub">{p.fornecedor}</span>}
          </Linha>
          <Linha rotulo="Competência">{compLong(p.competencia)}</Linha>
          <Linha rotulo="Vencimento">{fdate(p.vencimento)}</Linha>
          <Linha rotulo="Valor lançado">{num(p.valor) !== null && <b>{money(p.valor)}</b>}</Linha>
          <Linha rotulo="Nº documento">{p.documento}</Linha>
          {p.obs && <Linha rotulo="Observação">{p.obs}</Linha>}
        </dl>
        <div>
          <span className="aloj-campo-l">Faturas anexadas</span>
          <div className="aloj-files aloj-mt">
            {fs.length
              ? fs.map((f) => <ArquivoLinha key={f.path} arquivo={f} onErro={onErro} />)
              : (
                <div className="aloj-nota tom-warn">
                  <AlertTriangle size={14} />
                  <p>Nenhuma fatura anexada a este lançamento. Registre como divergência ou peça o anexo ao Administrativo.</p>
                </div>
              )}
          </div>
        </div>
      </div>
    </>
  );
}
