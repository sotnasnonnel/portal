import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle, Calculator, CheckCircle2, Lightbulb, Loader2, Wrench,
} from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  CATEGORIA_LABEL, SITUACOES, ehAdminProgramas,
} from '../../../../config/programas';
import {
  listarIdeias, atualizarSituacao, atualizarIdeia, excluirIdeia,
} from '../../lib/ideias';
import { PRAZO_RELATORIO, listarFichas, situacaoFicha } from '../../lib/roi';
import { DetalheIdeia } from '../components/Detalhe';
import RegrasInovacao from './RegrasInovacao';

/**
 * Campo de Ideias — a tela de QUEM PARTICIPA, gêmea de "Alavanca PHD":
 * os botões de registrar no topo e, abaixo, o que essa pessoa registrou.
 *
 * A separação entre esta tela e o Painel da Inovação é a mesma do outro programa:
 *   aqui   -> eu registro e acompanho o MEU
 *   painel -> os números do programa inteiro, de todo mundo
 * Juntar as duas faz a tela de leitura virar também a de escrita, e aí ninguém
 * sabe se o painel é onde se olha ou onde se cadastra.
 *
 * A consulta é a mesma do painel — o Campo de Ideias é aberto, e a RLS
 * devolve tudo. O recorte "meus" é feito aqui, porque a pergunta desta tela é
 * "o que EU registrei".
 */

const data = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

export default function CampoDeIdeias() {
  const { user, modules } = useAuth();
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState('');
  // Confirmação que a ficha de ROI manda ao salvar e voltar para cá. Limpa o
  // state da rota para o aviso não reaparecer num F5.
  const location = useLocation();
  const navigate = useNavigate();
  const [aviso] = useState(location.state?.aviso || '');
  useEffect(() => {
    if (location.state?.aviso) navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);
  const [detalhe, setDetalhe] = useState(null);
  // Ficha de ROI por registro. `null` = não deu para carregar: a coluna some e
  // o resto da tela segue — a ficha não pode derrubar o Campo de Ideias.
  const [fichas, setFichas] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const [ideias, roi] = await Promise.all([
        listarIdeias(),
        listarFichas().catch(() => null),
      ]);
      setLinhas(ideias);
      setFichas(roi && new Map(roi.map((f) => [f.ideia_id, f])));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const minhas = useMemo(
    () => linhas.filter((l) => l.autor_id === user?.id),
    [linhas, user?.id]
  );
  const souAdmin = ehAdminProgramas(modules);
  // Só INICIATIVA tem ficha: ideia é o que ainda não existe, e não há antes e
  // depois para medir.
  const semFicha = fichas
    ? minhas.filter((l) => l.tipo === 'iniciativa' && !fichas.has(l.id)).length
    : 0;

  const salvarEdicao = async (registro, valores) => {
    const atualizado = await atualizarIdeia(registro, valores, user.id);
    setLinhas((atual) => atual.map((l) => (l.id === registro.id ? atualizado : l)));
    setDetalhe(atualizado);
  };

  const apagar = async (registro) => {
    await excluirIdeia(registro.id);
    setLinhas((atual) => atual.filter((l) => l.id !== registro.id));
  };

  const trocarSituacao = async (registro, nova) => {
    setSalvando(registro.id);
    setErro('');
    try {
      const atualizado = await atualizarSituacao(registro, nova, user.id);
      setLinhas((atual) => atual.map((l) => (l.id === registro.id ? atualizado : l)));
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando('');
    }
  };

  return (
    <div className="pg-page pg-page-wide">
      <h1 className="pg-title"><Lightbulb size={24} /> Campo de Ideias</h1>
      <p className="pg-sub">
        Registre uma ideia nova ou cadastre o que você já está construindo. Tudo o que a
        empresa registrou fica no Painel da Inovação, aberto a todos.
      </p>

      {/* Dois botões, e não um com escolha depois: ideia e iniciativa são
          formulários diferentes, e a diferença entre elas está escrita logo
          abaixo — quem chega decide sem precisar de uma tela intermediária. */}
      <div className="pg-acoes" style={{ marginTop: 0, marginBottom: 8 }}>
        <Link to="/programas/ideias/nova/ideia" className="pg-btn pg-btn-primary">
          <Lightbulb size={16} /> Registrar ideia
        </Link>
        <Link to="/programas/ideias/nova/iniciativa" className="pg-btn pg-btn-primary">
          <Wrench size={16} /> Registrar iniciativa
        </Link>
      </div>
      <p className="pg-campo-dica" style={{ marginBottom: 16 }}>
        <strong>Ideia</strong> é o que ainda não existe e você acha que a PHD deveria ter.{' '}
        <strong>Iniciativa</strong> é o que você já está construindo, para uso próprio ou em projeto.
      </p>

      {/* As regras ficam aqui, e não só no formulário: a diferença entre ideia
          e iniciativa decide se a solução concorre ao prêmio, e essa escolha é
          feita nesta tela, nos botões acima. */}
      <div style={{ marginBottom: 22 }}>
        <RegrasInovacao />
      </div>

      {erro && <div className="pg-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}
      {aviso && <div className="pg-aviso tom-ok" role="status"><CheckCircle2 size={16} /> {aviso}</div>}

      <h2 className="pg-secao">O que você registrou</h2>

      {semFicha > 0 && (
        <div className="pg-aviso tom-atencao">
          <Calculator size={16} />
          <span>
            {semFicha === 1 ? 'Falta 1 ficha de ROI' : `Faltam ${semFicha} fichas de ROI`}. Toda iniciativa precisa
            dela para o Programa de Inovação 2026 — prazo até {PRAZO_RELATORIO}. Preencha pela coluna
            “Ficha de ROI” abaixo.
          </span>
        </div>
      )}

      {carregando ? (
        <div className="pg-vazio"><Loader2 size={20} className="pg-spin" /> Carregando…</div>
      ) : minhas.length === 0 ? (
        <div className="pg-vazio">
          Você ainda não registrou nada. Use os botões acima — e veja o que o resto da
          empresa está inventando no{' '}
          <Link className="pg-link" to="/programas/dashboard">Painel da Inovação</Link>.
        </div>
      ) : (
        <div className="pg-tabela-scroll">
          <table className="pg-tabela">
            <thead>
              <tr>
                <th>ID</th>
                <th className="col-titulo">Título</th>
                <th className="col-curta">Forma</th>
                <th className="col-curta">Setor</th>
                <th>Tipo</th>
                <th className="col-curta">Registro</th>
                <th>Situação</th>
                {fichas && <th>Ficha de ROI</th>}
              </tr>
            </thead>
            <tbody>
              {minhas.map((l) => (
                <tr key={l.id}>
                  <td className="num">#{l.numero}</td>
                  <td className="col-titulo">
                    <button type="button" className="pg-link" onClick={() => setDetalhe(l)}>
                      {l.titulo}
                    </button>
                    {/* Pendência herdada da importação: fica visível na linha,
                        senão só quem abre o detalhe descobre que falta algo. */}
                    {l.retorno?.startsWith('A preencher') && (
                      <span className="pg-motivo">Falta o retorno esperado — clique para preencher.</span>
                    )}
                  </td>
                  <td className="col-curta">{l.tipo === 'ideia' ? 'Ideia' : 'Iniciativa'}</td>
                  <td className="col-curta">{l.setor}</td>
                  <td>{CATEGORIA_LABEL[l.categoria] || l.categoria}</td>
                  <td className="num">{data(l.criado_em)}</td>
                  <td>
                    <select
                      className="pg-select"
                      value={l.situacao}
                      disabled={salvando === l.id}
                      onChange={(e) => trocarSituacao(l, e.target.value)}
                      aria-label={`Situação de ${l.titulo}`}
                    >
                      {SITUACOES.map((s) => (
                        <option key={s.valor} value={s.valor}>{s.label}</option>
                      ))}
                    </select>
                  </td>
                  {fichas && (
                    <td>
                      {l.tipo === 'iniciativa' ? (
                        <>
                          <Link className="pg-link" to={`/programas/ideias/${l.id}/roi`}>
                            {fichas.has(l.id) ? 'Abrir ficha' : 'Preencher ficha'}
                          </Link>
                          <span className="pg-motivo">{situacaoFicha(fichas.get(l.id)).label}</span>
                        </>
                      ) : (
                        <span className="pg-motivo">Não se aplica a ideia</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* A lista já é só a minha, mas a condição fica explícita: é a mesma da
          RLS, e some se um dia a tela passar a mostrar registro de terceiro. */}
      <DetalheIdeia
        registro={detalhe}
        podeEditar={Boolean(detalhe) && detalhe.autor_id === user?.id}
        podeExcluir={Boolean(detalhe) && (souAdmin || detalhe.autor_id === user?.id)}
        onFechar={() => setDetalhe(null)}
        onSalvar={salvarEdicao}
        onExcluir={apagar}
      />
    </div>
  );
}
