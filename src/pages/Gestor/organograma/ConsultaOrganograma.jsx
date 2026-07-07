import { useMemo, useState, useEffect } from 'react';
import { Search, RefreshCw, Network } from 'lucide-react';
import { useOrganograma } from './useOrganograma';
import {
  resolveDefaultMonth, deriveFilterOptions, applyFilters,
  formatPercent, formatMonthLabel, countColaboradores,
} from './organogramaData';
import '../Gestor.css';
import './ConsultaOrganograma.css';

export default function ConsultaOrganograma() {
  const [mes, setMes] = useState('');
  const { months, rows, loading, error, recarregar } = useOrganograma(mes);
  const [gerente, setGerente] = useState('');
  const [contrato, setContrato] = useState('');
  const [nome, setNome] = useState('');

  // Define o mês padrão assim que a lista de meses chega.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mês inicial só existe após a lista chegar
    if (!mes && months.length) setMes(resolveDefaultMonth(months, new Date()));
  }, [months, mes]);

  // Trocar de mês zera os filtros dependentes (evita filtro "fantasma").
  const [mesAnterior, setMesAnterior] = useState(mes);
  if (mes !== mesAnterior) {
    setMesAnterior(mes);
    setGerente('');
    setContrato('');
  }

  const opcoes = useMemo(() => deriveFilterOptions(rows), [rows]);
  const filtradas = useMemo(
    () => applyFilters(rows, { gerente, contrato, nome }),
    [rows, gerente, contrato, nome],
  );

  return (
    <div className="gestor-page animate-fade-in-up">
      <h1 className="page-title"><Network size={28} /> Consulta Organograma</h1>
      <div className="org-consulta">
      <div className="org-filtros">
        <label className="org-filtro">
          <span>Mês</span>
          <select value={mes} onChange={(e) => setMes(e.target.value)}>
            {months.map((m) => (
              <option key={m} value={m}>{formatMonthLabel(m)}</option>
            ))}
          </select>
        </label>
        <label className="org-filtro">
          <span>Gerente</span>
          <select value={gerente} onChange={(e) => setGerente(e.target.value)}>
            <option value="">Todos</option>
            {opcoes.gerentes.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <label className="org-filtro">
          <span>Contrato</span>
          <select value={contrato} onChange={(e) => setContrato(e.target.value)}>
            <option value="">Todos</option>
            {opcoes.contratos.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="org-filtro org-busca">
          <span>Buscar</span>
          <span className="org-busca-input">
            <Search size={15} />
            <input type="text" placeholder="Nome do colaborador"
              value={nome} onChange={(e) => setNome(e.target.value)} />
          </span>
        </label>
      </div>

      {loading && <p className="org-status">Carregando…</p>}

      {error && !loading && (
        <p className="org-status org-erro">
          Erro ao carregar: {error}{' '}
          <button type="button" className="btn btn-ghost btn-sm" onClick={recarregar}>
            <RefreshCw size={14} /> Tentar de novo
          </button>
        </p>
      )}

      {!loading && !error && (
        <>
          <p className="org-contador">
            {filtradas.length} alocações · {countColaboradores(filtradas)} colaboradores
          </p>
          {filtradas.length === 0 ? (
            <p className="org-status">Sem alocações neste mês.</p>
          ) : (
            <div className="org-tabela-wrap">
              <table className="org-tabela">
                <thead>
                  <tr>
                    <th>Colaborador</th><th>Contrato</th><th>%</th><th>Gerente</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((r, i) => (
                    <tr key={`${r.colaborador}-${r.contrato}-${i}`}>
                      <td>{r.colaborador}</td>
                      <td>{r.contrato}</td>
                      <td className="org-perc">{formatPercent(r.percentual)}</td>
                      <td>{r.gerente}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}
