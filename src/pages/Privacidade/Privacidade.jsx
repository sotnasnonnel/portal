import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AVISO_PRIVACIDADE, ehPendente } from '../../config/privacidade';
import './Privacidade.css';

/**
 * Aviso de Privacidade do Portal PHD (LGPD, Lei 13.709/2018).
 *
 * Rota aberta, sem exigir login: o art. 41 §1º manda a empresa DIVULGAR a
 * identidade e o contato do encarregado, e o link fica também na tela de login,
 * onde ninguém está autenticado ainda.
 *
 * O texto inteiro sai de src/config/privacidade.js — a tela só monta. Assim o
 * jurídico/RH revisa um arquivo de texto, sem mexer em componente.
 *
 * O que a empresa ainda não definiu aparece MARCADO na tela (ehPendente), não
 * escondido: publicar "[DEFINIR]" é honesto; publicar um nome inventado de
 * encarregado seria informação falsa numa página que a lei obriga a manter.
 */

// Trecho pendente de definição pela empresa, destacado no meio da frase.
function Texto({ children }) {
  if (ehPendente(children)) return <span className="priv-pendente">{children}</span>;
  return children;
}

function Secao({ secao }) {
  return (
    <section className="priv-secao" id={secao.id}>
      <h2>{secao.titulo}</h2>
      {secao.paragrafos?.map((t) => <p key={t}><Texto>{t}</Texto></p>)}

      {secao.itens && (
        <ul>
          {secao.itens.map(([rotulo, texto]) => (
            <li key={rotulo}><strong>{rotulo}:</strong> <Texto>{texto}</Texto></li>
          ))}
        </ul>
      )}

      {secao.tabela && (
        <table className="priv-tabela">
          <thead>
            <tr>{secao.tabela.cabecalho.map((c) => <th key={c}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {secao.tabela.linhas.map((linha) => (
              <tr key={linha[0]}>
                {linha.map((celula) => <td key={celula}><Texto>{celula}</Texto></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {secao.fecho?.map((t) => <p key={t}><Texto>{t}</Texto></p>)}
    </section>
  );
}

export default function Privacidade() {
  const { user } = useAuth();
  const { controlador, encarregado, secoes, versao, atualizadoEm } = AVISO_PRIVACIDADE;

  return (
    <div className="priv-page">
      <div className="priv-folha">
        <Link className="priv-voltar" to={user ? '/home' : '/login'}>
          <ArrowLeft size={15} /> {user ? 'Voltar ao portal' : 'Voltar ao login'}
        </Link>

        <header className="priv-cab">
          <h1>Aviso de Privacidade</h1>
          <p>
            Como a {controlador.nomeCurto} trata os dados pessoais de quem usa o Portal PHD,
            em atendimento à Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
          </p>
          <span className="priv-versao">
            Versão {versao} · atualizado em {new Date(`${atualizadoEm}T12:00:00`).toLocaleDateString('pt-BR')}
          </span>
        </header>

        {/* Encarregado em destaque e antes do texto: é a informação que a lei
            manda divulgar e a que a pessoa procura quando vem reclamar. */}
        <div className="priv-dpo">
          <h2><ShieldCheck size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />
            Encarregado pelo tratamento de dados pessoais (DPO)
          </h2>
          <dl>
            <dt>Nome</dt>
            <dd><Texto>{encarregado.nome}</Texto></dd>
            <dt>E-mail</dt>
            <dd><Texto>{encarregado.email}</Texto></dd>
            <dt>Telefone</dt>
            <dd><Texto>{encarregado.telefone}</Texto></dd>
            <dt>Controlador</dt>
            <dd>
              <Texto>{controlador.razaoSocial}</Texto>
              {' · CNPJ '}<Texto>{controlador.cnpj}</Texto>
            </dd>
            <dt>Endereço</dt>
            <dd><Texto>{controlador.endereco}</Texto></dd>
          </dl>
        </div>

        {secoes.map((secao) => <Secao key={secao.id} secao={secao} />)}

        <p className="priv-rodape">
          Este aviso pode ser atualizado. A versão em vigor é sempre a publicada nesta página,
          com a data de atualização no topo.
        </p>
      </div>
    </div>
  );
}
