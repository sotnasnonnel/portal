import { useEffect, useState } from 'react';
import { Loader2, Target } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { PLR_ANO, veTodosSetoresPlr } from '../../../../config/plr';
import { carregarPainel } from '../../lib/dados';
import { REGRAS, formatarPct, resumoSetor } from '../../lib/plr';
import CartaoSetor, { BarraTotal } from '../components/CartaoSetor';
import { nomeResponsavel } from '../components/rotulos';

// Metas por setor: o que a aba SETORES mostrava, filtrado pelo banco. Quem é
// de um setor vê só o dele; quem vê todos ganha um resumo no topo, que leva ao
// cartão de cada um.
export default function SetoresPlr() {
  const { modules } = useAuth();
  const [estado, setEstado] = useState({ carregando: true, erro: '', setores: [] });

  useEffect(() => {
    let vivo = true;
    carregarPainel(PLR_ANO)
      .then(({ setores }) => { if (vivo) setEstado({ carregando: false, erro: '', setores }); })
      .catch((e) => {
        if (vivo) setEstado({ carregando: false, erro: e?.message || 'Erro ao carregar.', setores: [] });
      });
    return () => { vivo = false; };
  }, []);

  const { carregando, erro, setores } = estado;
  const todos = veTodosSetoresPlr(modules);
  const sub = todos
    ? 'Metas e resultados de todos os setores.'
    : setores.length > 1
      ? 'Metas e resultados dos seus setores.'
      : 'Metas e resultados do seu setor.';

  // Rolagem por código, e não por âncora (#): o portal usa HashRouter, e um
  // href="#plr-setor-..." trocaria a rota.
  const irPara = (id) => {
    document.getElementById(`plr-setor-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="plr-page">
      <div className="plr-cab">
        <h1 className="plr-title"><Target size={24} /> PLR {PLR_ANO}</h1>
        <p className="plr-sub">{sub}</p>
      </div>

      {carregando ? (
        <div className="plr-vazio"><Loader2 size={22} className="plr-spin" /> Carregando…</div>
      ) : erro ? (
        <div className="plr-vazio plr-erro">Não foi possível carregar o PLR: {erro}</div>
      ) : setores.length === 0 ? (
        <div className="plr-vazio">Nenhum setor do PLR está ligado a você no organograma.</div>
      ) : (
        <>
          {setores.length > 1 ? (
            <section className="plr-card">
              <h2 className="plr-card-tit">Resumo</h2>
              <ul className="plr-resumo">
                {setores.map((s) => {
                  const total = resumoSetor(s.indicadores).total;
                  return (
                    <li key={s.id}>
                      <button type="button" className="plr-resumo-item" onClick={() => irPara(s.id)}>
                        <span className="plr-resumo-nome">
                          <b>{s.nome}</b>
                          <small>{nomeResponsavel(s)}</small>
                        </span>
                        <BarraTotal valor={total} />
                        <span className="plr-resumo-pct">{formatarPct(total)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {setores.map((s) => <CartaoSetor key={s.id} setor={s} />)}

          <section className="plr-card plr-legenda">
            <h2 className="plr-card-tit">Como ler</h2>
            <p>
              <b>Aderência</b> é quanto do peso do indicador entra no total do setor, e depende da regra
              do indicador:
            </p>
            <ul>
              <li><b>{REGRAS.proporcional.rotulo}:</b> {REGRAS.proporcional.descricao}</li>
              <li>
                <b>{REGRAS.teto.rotulo}:</b> {REGRAS.teto.descricao} É a regra dos custos e dos prazos, em
                que ficar abaixo da meta é o bom.
              </li>
            </ul>
            <p><b>Contribuição</b> = aderência × peso. O total do setor é a soma das contribuições.</p>
          </section>
        </>
      )}
    </div>
  );
}
