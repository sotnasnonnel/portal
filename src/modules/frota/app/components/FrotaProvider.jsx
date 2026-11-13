import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import { ehAdminSetorAdm, ehTimeSetorAdm } from '../../../../config/setorAdm';
import { DEFAULT_CFG } from '../../lib/regras';
import { FILTROS_FATURAS } from '../../lib/faturas';
import { carregarColecao, carregarConfig, carregarTudo } from '../../lib/frota';
import { FrotaContext } from './FrotaContext';

const FILTROS_OCORRENCIAS = {
  q: '', tipo: '', status: '', categoria: '', ano: '', condutor: '', placa: '', de: '', ate: '',
};
const FILTROS_RELATORIOS = {
  de: '', ate: '', q: '', grp: '', sel: {},
};
const FILTROS_INICIAIS = {
  veiculos: { q: '', status: 'Ativo', locadora: '', ct: '', custo_resp: '' },
  faturas: FILTROS_FATURAS,
  mensal: { comp: '', q: '', locadora: '', custo_resp: '' },
  combustivel: { comp: '', q: '' },
  manutencao: { q: '', st: '' },
  ocorrencias: FILTROS_OCORRENCIAS,
  condutores: { q: '', sit: 'Ativo', conf: '' },
  relatorios: { tipo: 'custos', ...FILTROS_RELATORIOS },
  painel: { comp: '' },
};
const VAZIO = {
  veiculos: [], mensal: [], ocorrencias: [], condutores: [], manutencoes: [], faturas: [],
};

/**
 * Estado do módulo: as seis coleções inteiras em memória, como no protótipo. As
 * telas cruzam tudo (o painel lê as cinco, o condutor olha veículo e ocorrência) e
 * a frota é pequena: poucos milhares de linhas no total. Os filtros também moram
 * aqui para sobreviver à troca de tela, e para um indicador do painel poder abrir
 * a tela de destino já filtrada.
 */
export default function FrotaProvider({ children }) {
  const { user, modules } = useAuth();
  const navigate = useNavigate();
  const [dados, setDados] = useState(VAZIO);
  const [cfg, setCfg] = useState(DEFAULT_CFG);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  // Coleções cuja tabela ainda não existe no banco (migração pendente).
  const [ausentes, setAusentes] = useState([]);
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  const [drawer, setDrawer] = useState(null);
  const [aviso, setAviso] = useState(null);
  const timerAviso = useRef(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([carregarTudo(), carregarConfig()])
      .then(([d, c]) => {
        if (!vivo) return;
        setDados(d.dados);
        setAusentes(d.ausentes);
        setCfg(c);
      })
      .catch((e) => { if (vivo) setErro(e.message); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, []);

  const recarregar = useCallback(async (cols) => {
    const listas = await Promise.all(cols.map(carregarColecao));
    setDados((d) => ({ ...d, ...Object.fromEntries(cols.map((c, i) => [c, listas[i] || []])) }));
  }, []);

  const toast = useCallback((msg, tipo = '') => {
    clearTimeout(timerAviso.current);
    setAviso({ msg, tipo });
    timerAviso.current = setTimeout(() => setAviso(null), tipo === 'err' ? 6000 : 2600);
  }, []);
  useEffect(() => () => clearTimeout(timerAviso.current), []);

  const setFiltro = useCallback((tela, patch) => {
    setFiltros((f) => ({ ...f, [tela]: { ...f[tela], ...patch } }));
  }, []);

  const irPara = useCallback((tela, patch) => {
    if (patch) setFiltro(tela, patch);
    navigate(`/frota/${tela}`);
  }, [navigate, setFiltro]);

  const limparFiltros = useCallback((tela) => {
    setFiltros((f) => ({
      ...f,
      [tela]: tela === 'relatorios' ? { tipo: f.relatorios.tipo, ...FILTROS_RELATORIOS } : FILTROS_INICIAIS[tela],
    }));
  }, []);

  // Veículo e condutor têm ficha; o resto abre direto no formulário.
  const abrirDetalhe = useCallback((col, id) => {
    setDrawer(col === 'veiculos' || col === 'condutores' ? { modo: 'detalhe', col, id } : { modo: 'form', col, id });
  }, []);
  const abrirForm = useCallback((col, id, init) => setDrawer({ modo: 'form', col, id: id || null, init }), []);
  const fecharDrawer = useCallback(() => setDrawer(null), []);

  const podeEscrever = ehTimeSetorAdm(user);
  const isAdmin = ehAdminSetorAdm(modules, user);
  // Cadastro-mestre só o admin exclui (policies frota_*_delete).
  const podeExcluir = useCallback((col) => (
    col === 'veiculos' || col === 'condutores' ? isAdmin : podeEscrever
  ), [isAdmin, podeEscrever]);

  const ctx = useMemo(() => ({ dados, cfg }), [dados, cfg]);

  const value = useMemo(() => ({
    dados, cfg, setCfg, ctx, carregando, erro, ausentes, recarregar, toast,
    filtros, setFiltro, irPara, limparFiltros,
    drawer, abrirDetalhe, abrirForm, fecharDrawer,
    podeEscrever, isAdmin, podeExcluir,
  }), [dados, cfg, ctx, carregando, erro, ausentes, recarregar, toast, filtros, setFiltro, irPara, limparFiltros,
    drawer, abrirDetalhe, abrirForm, fecharDrawer, podeEscrever, isAdmin, podeExcluir]);

  return (
    <FrotaContext.Provider value={value}>
      {children}
      {aviso && (
        <div className={`frota-toast ${aviso.tipo}`} role="status">{aviso.msg}</div>
      )}
    </FrotaContext.Provider>
  );
}
