import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import { podeEditarTi } from '../../../../config/ti';
import { carregarTudo } from '../../lib/ti';
import { supabase } from '../../../../services/supabase';
import { emailChave } from '../../lib/regras';
import { TiContext } from './TiContext';

const VAZIO = {
  ativos: [], movimentacoes: [], termos: [], pessoas: [],
};

const FILTROS_INICIAIS = {
  ativos: {
    q: '', fornecedor: '', tipo: '', situacao: '', termo: '',
  },
  // aba '' = automática (o meu termo, se pendente; senão a equipe).
  termos: { q: '', status: '', aba: '' },
  modelos: { fornecedor: '', tipo: '' },
  alocar: { q: '', janela: '60' },
};

/**
 * Estado do módulo: as coleções inteiras em memória. São poucas centenas de
 * equipamentos, e as telas cruzam tudo (termos olha ativos e pessoas, a ficha
 * olha o histórico). Os filtros moram aqui para sobreviver à troca de tela.
 */
export default function TiProvider({ children }) {
  const { user, verComo } = useAuth();
  const [dadosBrutos, setDados] = useState(VAZIO);
  // Ver como (config/verComo.js): a sessão do banco é a do super admin, que vê
  // tudo. Para mostrar o que a PESSOA vê, recorta pela árvore dela.
  // Guardado junto com o id da pessoa: trocar de pessoa invalida sozinho, sem
  // precisar zerar o estado dentro do efeito.
  const [recorteSalvo, setRecorte] = useState(null); // { id, emails: Set }
  const precisaRecorte = !!verComo && !podeEditarTi(verComo);
  const idVerComo = verComo?.id || null;
  useEffect(() => {
    if (!precisaRecorte) return undefined;
    let vivo = true;
    supabase.rpc('ti_emails_visiveis_de', { p_colab: idVerComo }).then(({ data }) => {
      if (vivo) setRecorte({ id: idVerComo, emails: new Set(data || []) });
    });
    return () => { vivo = false; };
  }, [precisaRecorte, idVerComo]);
  const recorte = precisaRecorte && recorteSalvo?.id === idVerComo ? recorteSalvo.emails : null;
  const emailVerComo = emailChave(verComo?.email);
  const dados = useMemo(() => {
    if (!precisaRecorte) return dadosBrutos;
    if (!recorte) return VAZIO;
    const ve = (e) => recorte.has(emailChave(e));
    return {
      ativos: dadosBrutos.ativos.filter((a) => ve(a.responsavel)),
      movimentacoes: dadosBrutos.movimentacoes.filter((m) => ve(m.de_responsavel) || ve(m.para_responsavel)),
      // Termos guardam CPF: fora do time, só os próprios (mesma regra da RLS).
      termos: dadosBrutos.termos.filter((t) => emailChave(t.pessoa_email) === emailVerComo),
      pessoas: dadosBrutos.pessoas.filter((p) => ve(p.email)),
    };
  }, [dadosBrutos, precisaRecorte, recorte, emailVerComo]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  const [drawer, setDrawer] = useState(null);
  const [aviso, setAviso] = useState(null);
  const timerAviso = useRef(null);

  const recarregar = useCallback(async () => {
    try {
      setDados(await carregarTudo());
      setErro('');
    } catch (e) {
      setErro(e.message);
    }
  }, []);

  useEffect(() => {
    let vivo = true;
    carregarTudo()
      .then((d) => { if (vivo) setDados(d); })
      .catch((e) => { if (vivo) setErro(e.message); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
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

  /** Troca um ativo na lista sem recarregar tudo. */
  const trocarAtivos = useCallback((novos) => {
    const porId = new Map(novos.map((a) => [a.id, a]));
    setDados((d) => {
      const existentes = new Set(d.ativos.map((a) => a.id));
      return {
        ...d,
        ativos: [...d.ativos.map((a) => porId.get(a.id) || a), ...novos.filter((a) => !existentes.has(a.id))],
      };
    });
  }, []);

  const pessoaPorEmail = useMemo(
    () => new Map(dados.pessoas.map((p) => [emailChave(p.email), p])),
    [dados.pessoas],
  );
  const nomeDe = useCallback((email) => pessoaPorEmail.get(emailChave(email))?.nome || email || '', [pessoaPorEmail]);

  const abrirAtivo = useCallback((id) => setDrawer({ modo: 'detalhe', id }), []);
  const abrirForm = useCallback((id, init) => setDrawer({ modo: 'form', id: id || null, init }), []);
  const fecharDrawer = useCallback(() => setDrawer(null), []);

  // Time de TI: vê tudo e altera. Os demais só consultam o recorte da RLS.
  const podeEscrever = podeEditarTi(user);
  const meuEmail = emailChave(user?.email);

  const value = useMemo(() => ({
    dados, setDados, carregando: carregando || (precisaRecorte && !recorte), erro, recarregar, toast, trocarAtivos,
    filtros, setFiltro, pessoaPorEmail, nomeDe,
    drawer, abrirAtivo, abrirForm, fecharDrawer, podeEscrever, meuEmail,
  }), [dados, carregando, precisaRecorte, recorte, erro, recarregar, toast, trocarAtivos, filtros, setFiltro, pessoaPorEmail, nomeDe,
    drawer, abrirAtivo, abrirForm, fecharDrawer, podeEscrever, meuEmail]);

  return (
    <TiContext.Provider value={value}>
      {children}
      {aviso && (
        <div className={`ti-toast ${aviso.tipo}`} role="status">{aviso.msg}</div>
      )}
    </TiContext.Provider>
  );
}
