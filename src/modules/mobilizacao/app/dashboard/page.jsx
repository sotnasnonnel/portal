import { useEffect, useState } from 'react';
import { BarChart3, Loader2, AlertCircle, Info } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { ehTimeMobilizacao, rotuloFluxo } from '../../../../config/mobilizacao';
import { listarParaIndicadores } from '../../lib/mobilizacao';
import { resumoIndicadores, faixaPct, formatarPct } from '../../lib/indicadoresMob';
import { rotuloStatus } from '../../lib/statusEtapa';

export default function DashboardMob() {
  const { modules } = useAuth();
  const souTime = ehTimeMobilizacao(modules);

  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    listarParaIndicadores()
      .then(setDados)
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, []);

  if (carregando) {
    return <div className="mob-page"><div className="mob-vazio"><Loader2 size={20} className="mob-spin" /> Carregando…</div></div>;
  }
  if (erro) {
    return <div className="mob-page"><div className="mob-aviso tom-erro"><AlertCircle size={16} /> {erro}</div></div>;
  }

  const r = resumoIndicadores(dados.etapas, dados.processos);
  const maxFluxo = Math.max(1, ...r.abertasPorFluxo.map((x) => x.total));

  return (
    <div className="mob-page mob-page-wide">
      <h1 className="mob-title"><BarChart3 size={24} /> Indicadores</h1>
      <p className="mob-sub">O que está rodando, o que travou e onde o processo mais demora.</p>

      {/* O mesmo aviso do painel do Adm: os números são "do que eu enxergo".
          Sem isso, quem não é do time acha que a empresa toda tem 3 processos. */}
      {!souTime && (
        <div className="mob-aviso tom-info">
          <Info size={16} />
          Os números abaixo cobrem só os processos em que você está envolvido.
        </div>
      )}

      <div className="mob-ind-tiles">
        <article className="mob-ind-tile is-destaque">
          <span className="mob-ind-rot">Processos em andamento</span>
          <span className="mob-ind-num">{r.processos.emAndamento}</span>
          <span className="mob-ind-pe">{r.processos.finalizados} finalizados · {r.processos.cancelados} cancelados</span>
        </article>

        <article className="mob-ind-tile">
          <span className="mob-ind-rot">Processos travados</span>
          <span className={`mob-ind-num ${r.processos.atrasados ? 'tom-baixa' : 'tom-alta'}`}>
            {r.processos.atrasados}
          </span>
          <span className="mob-ind-pe">com ao menos uma etapa vencida</span>
        </article>

        <article className="mob-ind-tile">
          <span className="mob-ind-rot">Etapas vencidas</span>
          <span className={`mob-ind-num ${r.etapas.atrasadas ? 'tom-baixa' : 'tom-alta'}`}>
            {r.etapas.atrasadas}
          </span>
          <span className="mob-ind-pe">de {r.etapas.abertas} em aberto</span>
        </article>

        <article className="mob-ind-tile">
          <span className="mob-ind-rot">Concluídas no prazo</span>
          <span className={`mob-ind-num tom-${faixaPct(r.prazo.pct)}`}>{formatarPct(r.prazo.pct)}</span>
          <span className="mob-ind-pe">
            {r.prazo.medidas} etapas medidas
            {r.prazo.semPrazo > 0 && ` · ${r.prazo.semPrazo} sem prazo cadastrado`}
          </span>
        </article>

        <article className="mob-ind-tile">
          <span className="mob-ind-rot">Sem responsável</span>
          <span className={`mob-ind-num ${r.etapas.semDono ? 'tom-media' : 'tom-vazio'}`}>
            {r.etapas.semDono}
          </span>
          <span className="mob-ind-pe">etapas que ninguém está olhando</span>
        </article>
      </div>

      <section className="mob-card">
        <h2 className="mob-card-tit">Etapas em aberto por fluxo</h2>
        {!r.abertasPorFluxo.length ? (
          <p className="mob-campo-dica">Nada em aberto.</p>
        ) : (
          <div className="mob-ind-barras">
            {r.abertasPorFluxo.map((x) => (
              <div key={x.nome} className="mob-ind-linha">
                <span className="mob-ind-nome">{rotuloFluxo(x.nome)}</span>
                <div className="mob-ind-barra">
                  <div className="mob-ind-fill" style={{ width: `${(x.total / maxFluxo) * 100}%` }} />
                </div>
                <span className="mob-ind-val">{x.total}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* O achado que a planilha nunca deu: qual passo trava o processo sempre.
          As duas colunas separam "esse passo sempre demora" (fora do prazo,
          histórico) de "esse passo está travado hoje" (abertas atrasadas). */}
      <section className="mob-card">
        <h2 className="mob-card-tit">Onde o processo mais trava</h2>
        {!r.gargalos.length ? (
          <p className="mob-campo-dica">Ainda não há etapas suficientes para dizer.</p>
        ) : (
          <div className="mob-tabela-scroll">
            <table className="mob-tabela">
              <thead>
                <tr>
                  <th>Etapa</th>
                  <th className="num">Ocorrências</th>
                  <th className="num">Concluídas fora do prazo</th>
                  <th className="num">Vencidas agora</th>
                  <th className="num">Atraso médio</th>
                </tr>
              </thead>
              <tbody>
                {r.gargalos.slice(0, 12).map((g) => (
                  <tr key={g.nome}>
                    <td>{g.nome}</td>
                    <td className="num">{g.total}</td>
                    <td className="num">{g.foraDoPrazo}</td>
                    <td className={`num ${g.abertasAtrasadas ? 'is-vencido' : ''}`}>{g.abertasAtrasadas}</td>
                    <td className="num">
                      {g.atrasoMedio === null ? '—' : `${g.atrasoMedio > 0 ? '+' : ''}${g.atrasoMedio}d`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mob-card">
        <h2 className="mob-card-tit">Etapas vencidas por responsável</h2>
        {!r.atrasadasPorResponsavel.length ? (
          <p className="mob-campo-dica">Nenhuma etapa vencida.</p>
        ) : (
          <div className="mob-ind-barras">
            {r.atrasadasPorResponsavel.map((x) => (
              <div key={x.nome} className="mob-ind-linha">
                <span className="mob-ind-nome">{x.nome}</span>
                <div className="mob-ind-barra">
                  <div className="mob-ind-fill tom-atraso"
                    style={{ width: `${(x.total / Math.max(1, r.atrasadasPorResponsavel[0].total)) * 100}%` }} />
                </div>
                <span className="mob-ind-val">{x.total}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mob-card">
        <h2 className="mob-card-tit">Etapas em aberto por situação</h2>
        <div className="mob-tabela-scroll">
          <table className="mob-tabela">
            <thead><tr><th>Situação</th><th className="num">Etapas</th></tr></thead>
            <tbody>
              {r.abertasPorStatus.map((x) => (
                <tr key={x.nome}><td>{rotuloStatus(x.nome)}</td><td className="num">{x.total}</td></tr>
              ))}
              {!r.abertasPorStatus.length && <tr><td colSpan={2}>Nada em aberto.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
