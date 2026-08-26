import { useState } from 'react';
import { ExternalLink, Pencil, X } from 'lucide-react';
import {
  CATEGORIA_LABEL, ELEGIBILIDADE_LABEL, SITUACAO_LABEL, STATUS_ALAVANCA_LABEL, corDoSetor,
} from '../../../../config/programas';
import { COR_FORMA } from '../../lib/paleta';
import EditarIdeia from './EditarIdeia';

/**
 * Popup de detalhe, aberto ao clicar num cartão ou numa linha do mapa.
 *
 * Existe porque o cartão do kanban e a linha da tabela mostram o mínimo — sem
 * ele, ler o problema que a ideia resolve ou o histórico de uma indicação
 * obrigaria a abrir o banco. Um componente só para os dois programas: a casca
 * (cabeçalho, corpo rolável, fechar no Esc/backdrop) é idêntica, e duplicá-la
 * garantiria que uma das duas ficasse para trás na primeira correção.
 *
 * Campo vazio não aparece: uma lista de "—" empurra o que importa para fora da
 * tela e faz o registro parecer mal preenchido quando o campo só não se aplica
 * àquela forma.
 */

const data = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : null);
const dataHora = (iso) => (iso
  ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  : null);
const dinheiro = (n) => (n == null || n === ''
  ? null
  : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

function Campos({ itens }) {
  const visiveis = itens.filter(([, valor]) => valor !== null && valor !== undefined && valor !== '');
  if (!visiveis.length) return null;
  return (
    <dl className="pg-det-campos">
      {visiveis.map(([rot, valor]) => (
        <div key={rot}>
          <dt>{rot}</dt>
          <dd>{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

function Casca({ titulo, etiquetas, children, onFechar, acoes }) {
  return (
    <div className="pg-modal-overlay" onClick={onFechar}>
      <div
        className="pg-modal" onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label={titulo}
      >
        <div className="pg-modal-cab">
          <h2>{titulo}</h2>
          <button type="button" className="pg-modal-x" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="pg-modal-corpo">
          {etiquetas ? <div className="pg-det-etiquetas">{etiquetas}</div> : null}
          {children}
        </div>
        <div className="pg-modal-pe">
          {acoes ?? (
            <button type="button" className="pg-btn pg-btn-ghost" onClick={onFechar}>Fechar</button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Detalhe de uma ideia ou iniciativa.
 *
 * `podeEditar` vem de fora (autor ou admin do módulo) e só controla a UI — quem
 * de fato barra a edição é a RLS, e lib/ideias.js trata o UPDATE sem retorno
 * como recusa. O botão some para quem não pode, em vez de aparecer e falhar.
 */
export function DetalheIdeia({ registro, podeEditar = false, onFechar, onSalvar }) {
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  if (!registro) return null;
  const ehIniciativa = registro.tipo === 'iniciativa';

  const fechar = () => {
    setEditando(false);
    setErro('');
    onFechar();
  };

  const salvar = async (valores) => {
    setSalvando(true);
    setErro('');
    try {
      await onSalvar(registro, valores);
      setEditando(false);
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  if (editando) {
    return (
      <Casca
        titulo={`Editar #${registro.numero}`}
        onFechar={fechar}
        acoes={<span className="pg-editar-dica">Use os botões no fim do formulário.</span>}
      >
        <EditarIdeia
          registro={registro}
          salvando={salvando}
          erro={erro}
          onCancelar={() => { setEditando(false); setErro(''); }}
          onSalvar={salvar}
        />
      </Casca>
    );
  }

  return (
    <Casca
      titulo={`#${registro.numero} — ${registro.titulo}`}
      onFechar={fechar}
      acoes={(
        <>
          {podeEditar && (
            <button type="button" className="pg-btn pg-btn-primary" onClick={() => setEditando(true)}>
              <Pencil size={15} /> Editar
            </button>
          )}
          <button type="button" className="pg-btn pg-btn-ghost" onClick={fechar}>Fechar</button>
        </>
      )}
      etiquetas={(
        <>
          <span
            className="pg-cartao-forma"
            style={{ color: COR_FORMA[registro.tipo], borderColor: COR_FORMA[registro.tipo] }}
          >
            {ehIniciativa ? 'Iniciativa' : 'Ideia'}
          </span>
          <span className="pg-cartao-setor">
            <i style={{ background: corDoSetor(registro.setor) }} />
            {registro.setor}
          </span>
          <span className={`pg-badge tom-${registro.situacao}`}>
            {SITUACAO_LABEL[registro.situacao]}
          </span>
        </>
      )}
    >
      <Campos itens={[
        ['Tipo', CATEGORIA_LABEL[registro.categoria]],
        ['Autor', registro.autorNome],
        ['Registrado em', data(registro.criado_em)],
        ['Início da criação', data(registro.data_inicio)],
      ]}
      />

      {/* Os textos longos vêm depois dos campos curtos e um por bloco: são o
          conteúdo da ideia, não metadado. */}
      <Texto titulo="Descrição" valor={registro.descricao} />
      <Texto titulo="Problema que resolve" valor={registro.problema} />
      <Texto titulo="Benefícios esperados" valor={registro.beneficios} />
      <Texto titulo="Finalidade" valor={registro.finalidade} />
      <Texto titulo="Retorno esperado" valor={registro.retorno} />
      <Texto titulo="Observações" valor={registro.observacoes} />

      {registro.ferramentas?.length > 0 && (
        <div className="pg-det-bloco">
          <h3>Ferramentas</h3>
          <div className="pg-chips">
            {registro.ferramentas.map((f) => (
              <span key={f} className="pg-chip is-on">{f}</span>
            ))}
          </div>
        </div>
      )}

      {registro.link && (
        <div className="pg-det-bloco">
          <h3>Arquivo / pasta</h3>
          <a className="pg-link" href={registro.link} target="_blank" rel="noreferrer">
            {registro.link} <ExternalLink size={13} style={{ verticalAlign: -2 }} />
          </a>
        </div>
      )}
    </Casca>
  );
}

/** Detalhe de uma indicação da Alavanca. */
export function DetalheIndicacao({ indicacao, onFechar }) {
  if (!indicacao) return null;

  return (
    <Casca
      titulo={`#${indicacao.numero} — ${indicacao.oportunidade}`}
      onFechar={onFechar}
      etiquetas={(
        <>
          <span className={`pg-badge tom-${indicacao.status}`}>
            {STATUS_ALAVANCA_LABEL[indicacao.status]}
          </span>
          <span className={`pg-badge tom-${indicacao.elegibilidade}`}>
            {ELEGIBILIDADE_LABEL[indicacao.elegibilidade]}
          </span>
        </>
      )}
    >
      <Campos itens={[
        ['Empresa', indicacao.empresa],
        ['Indicado por', indicacao.indicadorNome],
        ['Enviada em', data(indicacao.criado_em)],
        ['Contato', indicacao.contato_nome],
        ['Cargo', indicacao.contato_cargo],
        ['Telefone', indicacao.contato_telefone],
        ['E-mail', indicacao.contato_email],
      ]}
      />

      <Texto titulo="Descrição da oportunidade" valor={indicacao.descricao} />
      <Texto titulo="O que já foi tratado" valor={indicacao.tratativas} />
      <Texto titulo="Por que esta elegibilidade" valor={indicacao.elegibilidade_motivo} />
      <Texto titulo="Comentário do comercial" valor={indicacao.comentario} />

      {/* Só existe depois da conclusão; antes disso a seção inteira some, em vez
          de aparecer com três traços. */}
      {indicacao.status === 'concluida' && (
        <div className="pg-det-bloco">
          <h3>Premiação</h3>
          <Campos itens={[
            ['Valor do contrato', dinheiro(indicacao.valor_contrato)],
            ['Premiação', dinheiro(indicacao.valor_premio)],
            ['Concluída em', dataHora(indicacao.concluida_em)],
            ['Pagamento', indicacao.pago_em ? data(indicacao.pago_em) : 'A pagar'],
          ]}
          />
        </div>
      )}
    </Casca>
  );
}

function Texto({ titulo, valor }) {
  if (!valor) return null;
  return (
    <div className="pg-det-bloco">
      <h3>{titulo}</h3>
      <p className="pg-det-texto">{valor}</p>
    </div>
  );
}
