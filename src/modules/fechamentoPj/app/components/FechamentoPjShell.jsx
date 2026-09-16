import { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  obterConfig, listarCodigos, listarCentros, mapaCentros, listarCompetencias, listarPrestadores, listarRateios,
  listarFornecedores, listarEncerramentos,
} from '../../lib/dados';
import { FechamentoPjContext } from './contexto';
import { Toast } from './ui';
import '../../../../components/UI/Components.css';
import '../../../../pages/Admin/Admin.css';
import '../../fechamentoPj.css';

const CHAVE_COMPETENCIA = 'fechamentoPj:competencia';

async function carregarBase() {
  const [config, codigos, centros, competencias, prestadores, rateios, fornecedores, encerramentos] = await Promise.all([
    obterConfig(), listarCodigos(), listarCentros(), listarCompetencias(), listarPrestadores(), listarRateios(),
    listarFornecedores(), listarEncerramentos({ vigentes: true }),
  ]);
  return { config, codigos, centros, competencias, prestadores, rateios, fornecedores, encerramentos };
}

const lerCompetenciaSalva = () => {
  try { return localStorage.getItem(CHAVE_COMPETENCIA); } catch { return null; }
};

/**
 * Casca do Fechamento PJ dentro da Gestão de Pessoas.
 *
 * Carrega uma vez o que quase toda tela usa (configuração, códigos, centros de
 * custo, competências, prestadores, rateios, fornecedores, encerramentos) e
 * guarda a competência em exibição. As telas pedem recarregar() depois de
 * gravar. Envelopes NÃO moram aqui: são por competência e cada tela carrega os
 * seus.
 */
export default function FechamentoPjShell() {
  const { user } = useAuth();
  const [base, setBase] = useState(null);
  const [erro, setErro] = useState('');
  const [competencia, setCompetenciaState] = useState(lerCompetenciaSalva);
  const [toast, setToast] = useState(null);

  const recarregar = useCallback(() => carregarBase().then(
    (b) => { setBase(b); setErro(''); },
    (e) => setErro(e.message || 'Falha ao carregar o Fechamento PJ.'),
  ), []);

  useEffect(() => { recarregar(); }, [recarregar]);

  const setCompetencia = useCallback((c) => {
    setCompetenciaState(c);
    try { localStorage.setItem(CHAVE_COMPETENCIA, c); } catch { /* sem storage */ }
  }, []);

  // Sem escolha salva (ou escolha que não existe mais): a aberta, senão a mais recente.
  const competenciaEfetiva = useMemo(() => {
    const lista = base?.competencias || [];
    if (lista.some((c) => c.competencia === competencia)) return competencia;
    return (lista.find((c) => c.status === 'aberta') || lista[0])?.competencia || null;
  }, [base, competencia]);

  const notificar = useCallback((mensagem, tipo = 'sucesso') => {
    setToast({ mensagem, tipo, id: Date.now() });
  }, []);

  const valor = useMemo(() => {
    const competenciaAtual = base?.competencias.find((c) => c.competencia === competenciaEfetiva) || null;
    return {
      ...(base || {}),
      carregando: !base && !erro,
      erro,
      user,
      centrosMapa: mapaCentros(base?.centros || []),
      competencia: competenciaEfetiva,
      competenciaAtual,
      aberta: competenciaAtual?.status === 'aberta',
      setCompetencia,
      recarregar,
      notificar,
    };
  }, [base, erro, user, competenciaEfetiva, setCompetencia, recarregar, notificar]);

  return (
    <FechamentoPjContext.Provider value={valor}>
      <div className="admin-page pj-root animate-fade-in-up">
        {erro && !base ? (
          <div className="pj-aviso pj-aviso--erro">{erro}</div>
        ) : (
          <Outlet />
        )}
      </div>
      {toast && <Toast key={toast.id} {...toast} onFim={() => setToast(null)} />}
    </FechamentoPjContext.Provider>
  );
}
