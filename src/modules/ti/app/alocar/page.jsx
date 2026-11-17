import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, PackageOpen, Plus, UserPlus,
} from 'lucide-react';
import { useTi } from '../components/TiContext';
import {
  Busca, Chip, Esqueleto, Estado, PageHead, Pill, Secao,
} from '../components/Pecas';
import { fmtDate, tomSituacao } from '../../lib/formato';
import {
  SITUACOES_DISPONIVEIS, diasAtras, disponivel, norm, pessoasSemEquipamento,
} from '../../lib/regras';
import { modeloDoVinculo } from '../../lib/termoTexto';
import './alocar.css';

const JANELAS = [['60', 'Admitidos nos últimos 60 dias'], ['', 'Todos sem equipamento']];

/**
 * Alocar equipamentos (só o time de TI): de um lado quem entrou na empresa e
 * ainda não tem equipamento (aparece sozinho quando Gestão de Pessoas cadastra
 * a pessoa com e-mail), do outro o que está livre para entregar. "Alocar" leva
 * para Movimentar já com a pessoa ou o equipamento escolhido; lá a TI revisa e
 * confirma, e a pessoa passa a ter o termo pendente para aceitar.
 */
export default function AlocarTi() {
  const navigate = useNavigate();
  const {
    dados, carregando, filtros, setFiltro, abrirAtivo, abrirForm,
  } = useTi();
  const f = { q: '', janela: '60', ...filtros.alocar };
  const set = (patch) => setFiltro('alocar', patch);

  const pessoas = useMemo(
    () => pessoasSemEquipamento(dados.ativos, dados.pessoas, { desde: f.janela ? diasAtras(Number(f.janela)) : null }),
    [dados.ativos, dados.pessoas, f.janela],
  );
  const lista = pessoas.filter((p) => !f.q || norm(`${p.nome} ${p.email}`).includes(norm(f.q)));
  const livres = useMemo(
    () => dados.ativos.filter(disponivel)
      .sort((a, b) => SITUACOES_DISPONIVEIS.indexOf(a.situacao) - SITUACOES_DISPONIVEIS.indexOf(b.situacao)
        || String(a.tipo).localeCompare(String(b.tipo), 'pt-BR')),
    [dados.ativos],
  );

  const alocarPara = (email) => navigate(`/ti/movimentar?para=${encodeURIComponent(email)}`);
  const alocarAtivo = (id) => navigate(`/ti/movimentar?ativo=${encodeURIComponent(id)}`);

  return (
    <div className="ti-page ti-stack">
      <PageHead
        Icon={UserPlus}
        titulo="Alocar equipamentos"
        sub="Quem entrou na empresa e ainda está sem equipamento, e o que está livre para entregar. Cadastre o equipamento antes, sem dono, e aloque quando a pessoa chegar."
      >
        <button type="button" className="ti-btn primary" onClick={() => abrirForm(null, { situacao: 'Aguardando atribuição' })}>
          <Plus size={15} aria-hidden="true" /> Novo ativo
        </button>
      </PageHead>
      <Estado />
      {carregando ? <Esqueleto /> : (
        <div className="ti-alocar">
          <Secao titulo="Pessoas sem equipamento" contagem={pessoas.length}>
            <div className="ti-stack">
              <div className="ti-chips">
                {JANELAS.map(([v, l]) => (
                  <Chip key={v || 'todos'} ativo={f.janela === v} onClick={() => set({ janela: v })}>{l}</Chip>
                ))}
              </div>
              {pessoas.length > 6 && (
                <div className="ti-filters">
                  <Busca id="al-q" valor={f.q} onChange={(q) => set({ q })} placeholder="Nome ou e-mail" />
                </div>
              )}
              {lista.length ? (
                <ul className="ti-alocar-lista">
                  {lista.map((p) => (
                    <li key={p.email} className="ti-alocar-item">
                      <div className="tx">
                        <b>{p.nome}</b>
                        <span>{p.email}</span>
                        <span>
                          {[p.vinculo && `Termo ${modeloDoVinculo(p.vinculo)}`, p.data_admissao && `Admissão ${fmtDate(p.data_admissao)}`]
                            .filter(Boolean).join(' · ') || 'Sem data de admissão'}
                        </span>
                      </div>
                      <button type="button" className="ti-btn" onClick={() => alocarPara(p.email)} aria-label={`Alocar equipamento para ${p.nome}`}>
                        Alocar <ArrowRight size={14} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="ti-empty">
                  <strong>{f.q ? 'Ninguém com esse nome' : 'Ninguém esperando equipamento'}</strong>
                  {f.janela && !f.q ? 'Todos os admitidos nos últimos 60 dias já têm equipamento.' : ''}
                </div>
              )}
              <p className="ti-hint">A pessoa aparece aqui quando é cadastrada em Gestão de Pessoas com e-mail. Candidato em pré-admissão entra depois de efetivado.</p>
            </div>
          </Secao>

          <Secao titulo="Disponíveis para alocar" contagem={livres.length} nota={SITUACOES_DISPONIVEIS.join(' · ')}>
            {livres.length ? (
              <ul className="ti-alocar-lista">
                {livres.map((a) => (
                  <li key={a.id} className="ti-alocar-item">
                    <button type="button" className="tx ti-alocar-ficha" onClick={() => abrirAtivo(a.id)} title="Abrir ficha">
                      <b>{[a.tipo, a.modelo].filter(Boolean).join(' · ') || 'Equipamento'}</b>
                      <span>Série {a.numero_serie}{a.configuracao ? ` · ${a.configuracao}` : ''}</span>
                    </button>
                    <Pill tone={tomSituacao(a.situacao)}>{a.situacao}</Pill>
                    <button type="button" className="ti-btn" onClick={() => alocarAtivo(a.id)} aria-label={`Alocar ${a.numero_serie}`}>
                      Alocar <ArrowRight size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="ti-empty">
                <PackageOpen size={20} aria-hidden="true" />
                <strong>Nada livre no momento</strong>
                Cadastre em &quot;Novo ativo&quot;: ele entra como Aguardando atribuição.
              </div>
            )}
          </Secao>
        </div>
      )}
    </div>
  );
}
