import { useState, useEffect, useCallback } from 'react';
import { supabaseBackoffice } from '../../../services/supabaseBackoffice';
import { mapAlocacoes, distinctMonths } from './organogramaData';

/**
 * Carrega a lista de meses e as alocações do mês selecionado do projeto
 * backoffice_phd. Read-only. A lista de meses vem da view organograma_meses
 * (DISTINCT mes) para não sofrer o teto de linhas do PostgREST.
 */
export function useOrganograma(mes) {
  const [months, setMonths] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Meses disponíveis (view distinta: ~15 linhas, sem risco de truncamento).
  const carregarMeses = useCallback(() => {
    let ativo = true;
    supabaseBackoffice
      .from('organograma_meses')
      .select('mes')
      .then(({ data, error: err }) => {
        if (!ativo) return;
        if (err) { setError(err.message); setLoading(false); return; }
        const meses = distinctMonths(data);
        setMonths(meses);
        if (meses.length === 0) setLoading(false);
      });
    return () => { ativo = false; };
  }, []);

  useEffect(() => carregarMeses(), [carregarMeses]);

  const carregar = useCallback(() => {
    if (!mes) return undefined;
    let ativo = true;
    setLoading(true);
    setError(null);
    supabaseBackoffice
      .from('organograma_alocacao')
      .select('percentual, obra_cod_phd, colaborador:organograma_colaborador(nome, gerente)')
      .eq('mes', mes)
      .order('nome', { referencedTable: 'organograma_colaborador' })
      .then(({ data, error: err }) => {
        if (!ativo) return;
        if (err) { setError(err.message); setRows([]); }
        else setRows(mapAlocacoes(data));
        setLoading(false);
      });
    return () => { ativo = false; };
    // carregar dispara setState de forma síncrona ao rodar dentro do efeito abaixo;
    // é o padrão de data-fetching em efeito, seguro aqui.
  }, [mes]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => carregar(), [carregar]);

  const recarregar = useCallback(() => {
    setError(null);
    if (mes) carregar();
    else carregarMeses();
  }, [mes, carregar, carregarMeses]);

  return { months, rows, loading, error, recarregar };
}
