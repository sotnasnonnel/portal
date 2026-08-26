import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Loader2, AlertCircle, Info } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { listarParaIndicadores } from '../../lib/chamados';
import { resumoIndicadores } from '../../lib/indicadores';
import { STATUS_LABEL } from '../../lib/statusChamado';

const pct = (n) => (n === null ? '—' : `${n}%`);

export default function DashboardAdm() {
  const { modules } = useAuth();
  const [chamados, setChamados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      setChamados(await listarParaIndicadores());
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const r = resumoIndicadores(chamados);
  const souDoTime = modules?.administrativo === 'admin' || modules?.administrativo === 'atendente';
  const maiorClasse = Math.max(1, ...r.abertosPorClasse.map((c) => c.total));

  return (
    <div className="adm-page adm-page-wide">
      <h1 className="adm-title"><BarChart3 size={24} /> Indicadores</h1>
      <p className="adm-sub">Como está a operação do Administrativo agora.</p>

      {erro && <div className="adm-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      {/* O recorte é da RLS. Sem dizer isto, quem só abre chamado leria os
          próprios números como se fossem os da empresa. */}
      {!souDoTime && (
        <div className="adm-aviso tom-info">
          <Info size={16} />
          <span>Estes números são só dos <strong>seus</strong> chamados. A visão da empresa
            inteira é do time do Administrativo.</span>
        </div>
      )}

      {carregando ? (
        <div className="adm-vazio"><Loader2 size={20} className="adm-spin" /> Carregando…</div>
      ) : r.total === 0 ? (
        <div className="adm-vazio">Nenhum chamado para medir ainda.</div>
      ) : (
        <>
          {/* Números são números: um cartão lê melhor que um gráfico de uma barra. */}
          <div className="adm-ind-tiles">
            <div className="adm-card adm-ind-tile is-destaque">
              <span className="adm-ind-rot">Em aberto</span>
              <strong className="adm-ind-num">{r.abertos}</strong>
              <span className="adm-ind-pe">de {r.total} chamados no total</span>
            </div>
            <div className="adm-card adm-ind-tile">
              <span className="adm-ind-rot">Fechados</span>
              <strong className="adm-ind-num">{r.encerrados}</strong>
              <span className="adm-ind-pe">
                {r.reprovados > 0
                  ? `${r.atendidos} atendidos e ${r.reprovados} reprovados`
                  : 'todos atendidos'}
              </span>
            </div>
            <div className="adm-card adm-ind-tile">
              <span className="adm-ind-rot">Fechados no prazo</span>
              <strong className={`adm-ind-num tom-${r.sla.pct === null ? 'vazio' : r.sla.pct >= 90 ? 'alta' : r.sla.pct >= 70 ? 'media' : 'baixa'}`}>
                {pct(r.sla.pct)}
              </strong>
              <span className="adm-ind-pe">
                {r.sla.medidos ? `${r.sla.noPrazo} de ${r.sla.medidos} medidos` : 'nada medido ainda'}
              </span>
            </div>
            <div className="adm-card adm-ind-tile">
              <span className="adm-ind-rot">Vencidos agora</span>
              <strong className={`adm-ind-num ${r.atrasados ? 'tom-baixa' : ''}`}>{r.atrasados}</strong>
              <span className="adm-ind-pe">abertos que passaram do prazo</span>
            </div>
          </div>

          <div className="adm-card">
            <h2 className="adm-card-tit">Chamados em aberto por tipo</h2>
            <p className="adm-campo-dica">Do maior volume para o menor — é onde a fila está.</p>

            {/* Oculto para leitor de tela: a tabela do fim tem os mesmos
                números e lê melhor do que um gráfico narrado. */}
            <div className="adm-ind-barras" aria-hidden="true">
              {r.abertosPorClasse.map((c) => (
                <div key={c.nome} className="adm-ind-linha">
                  <span className="adm-ind-nome" title={c.nome}>{c.nome}</span>
                  <span className="adm-ind-trilho">
                    <span className="adm-ind-barra" style={{ width: `${(c.total / maiorClasse) * 100}%` }} />
                  </span>
                  <span className="adm-ind-valor">{c.total}</span>
                </div>
              ))}
            </div>
            {r.abertosPorClasse.length === 0 && (
              <p className="adm-campo-dica">Nada em aberto no momento.</p>
            )}
          </div>

          <div className="adm-card">
            <h2 className="adm-card-tit">Cumprimento do prazo</h2>
            {r.sla.medidos === 0 ? (
              <p className="adm-campo-dica">
                Nenhum chamado fechado teve prazo definido ainda, então não há o que medir.
              </p>
            ) : (
              <>
                {/* Uma barra só, partida: a pergunta aqui é proporção entre duas
                    partes de um mesmo todo, não comparação entre categorias. */}
                <div className="adm-ind-proporcao" aria-hidden="true">
                  <span className="parte tom-alta" style={{ width: `${(r.sla.noPrazo / r.sla.medidos) * 100}%` }} />
                  <span className="parte tom-baixa" style={{ width: `${(r.sla.fora / r.sla.medidos) * 100}%` }} />
                </div>
                <p className="adm-ind-legenda">
                  <span><i className="tom-alta" /> {r.sla.noPrazo} no prazo</span>
                  <span><i className="tom-baixa" /> {r.sla.fora} fora do prazo</span>
                </p>
              </>
            )}
            {/* Fechado sem prazo não entra na conta: contá-lo como cumprido
                esconderia a lacuna de configuração dentro de um número bonito. */}
            {r.sla.semPrazo > 0 && (
              <p className="adm-campo-dica">
                {r.sla.semPrazo} chamado(s) fechado(s) ficaram de fora da conta por não terem
                prazo definido no serviço.
              </p>
            )}
          </div>

          <div className="adm-card">
            <h2 className="adm-card-tit">Detalhamento por serviço</h2>
            <div className="adm-tabela-scroll">
              <table className="adm-tabela">
                <thead>
                  <tr><th>Serviço</th><th>Em aberto</th><th>Fechados</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {r.porServico.map((s) => (
                    <tr key={s.nome}>
                      <td>{s.nome}</td>
                      <td className="num">{s.abertos}</td>
                      <td className="num">{s.encerrados}</td>
                      <td className="num">{s.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="adm-card">
            <h2 className="adm-card-tit">Em aberto por situação</h2>
            <div className="adm-tabela-scroll">
              <table className="adm-tabela">
                <thead><tr><th>Situação</th><th>Chamados</th></tr></thead>
                <tbody>
                  {r.abertosPorStatus.map((s) => (
                    <tr key={s.nome}>
                      <td>{STATUS_LABEL[s.nome] || s.nome}</td>
                      <td className="num">{s.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
