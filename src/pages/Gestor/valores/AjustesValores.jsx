import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Coins, Loader2, Check, AlertCircle, Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import CurrencyInput from '../../../components/CurrencyInput';
import { CATALOGOS, chavePreco, comItensExtras, normalizarItem } from '../../../config/precosItens';
import { parseCurrency, numeroParaMascara } from '../../../utils/currencyMask';
import {
  carregarCatalogoPrecos, salvarPreco, adicionarItem, removerItem,
} from '../../../services/precosItens';
import { podeAjustarValores } from '../../../config/valores';
import '../../../components/UI/Components.css';
import '../Gestor.css';
import './AjustesValores.css';

export default function AjustesValores() {
  const { user } = useAuth();
  const [mascaras, setMascaras] = useState({});     // chave -> string mascarada (editável)
  const [originais, setOriginais] = useState({});   // chave -> número|null (base p/ detectar mudança)
  const [extras, setExtras] = useState({});         // catalogo -> [item] cadastrados nesta tela
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [salvandoKey, setSalvandoKey] = useState(null);
  const [salvoKey, setSalvoKey] = useState(null);
  const [novo, setNovo] = useState(null);           // { catalogo, nome, preco } do item sendo cadastrado
  const [gravandoNovo, setGravandoNovo] = useState(false);
  const [removendoKey, setRemovendoKey] = useState(null);

  // Mesma regra da rota e da RLS: perfil do DP ou a flag avulsa.
  const podeEditar = useMemo(() => podeAjustarValores(user), [user]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { precos: mapa, extras: ext } = await carregarCatalogoPrecos();
        if (!vivo) return;
        const mask = {};
        for (const [k, n] of Object.entries(mapa)) mask[k] = numeroParaMascara(n);
        setOriginais(mapa);
        setMascaras(mask);
        setExtras(ext);
      } catch (e) {
        if (vivo) setErro(e.message || 'Não foi possível carregar os preços.');
      } finally {
        if (vivo) setLoading(false);
      }
    })();
    return () => { vivo = false; };
  }, []);

  const setMascara = (key, valor) => {
    setMascaras((p) => ({ ...p, [key]: valor }));
    setSalvoKey((k) => (k === key ? null : k));
  };

  const persistir = async (catalogo, item) => {
    const key = chavePreco(catalogo, item);
    const novoPreco = parseCurrency(mascaras[key]);
    const antigo = originais[key] ?? null;
    if (novoPreco === antigo) return;            // nada mudou
    setSalvandoKey(key);
    setErro('');
    try {
      await salvarPreco(catalogo, item, novoPreco, user?.id);
      setOriginais((p) => ({ ...p, [key]: novoPreco }));
      setSalvoKey(key);
    } catch (e) {
      setErro(e.message || 'Não foi possível salvar. Tente novamente.');
      // Reverte o campo ao último valor salvo.
      setMascaras((p) => ({ ...p, [key]: numeroParaMascara(antigo) }));
    } finally {
      setSalvandoKey(null);
    }
  };

  const abrirNovo = (catalogo) => {
    setErro('');
    setNovo({ catalogo, nome: '', preco: '' });
  };

  const cadastrar = async (cat, itensAtuais) => {
    const nome = novo.nome.trim().replace(/\s+/g, ' ');
    if (!nome) { setErro('Informe o nome do item.'); return; }
    if (itensAtuais.some((i) => normalizarItem(i) === normalizarItem(nome))) {
      setErro(`"${nome}" já está na lista de ${cat.label}.`);
      return;
    }
    const preco = parseCurrency(novo.preco);
    setGravandoNovo(true);
    setErro('');
    try {
      await adicionarItem(cat.key, nome, preco, user?.id);
      const key = chavePreco(cat.key, nome);
      setExtras((p) => ({ ...p, [cat.key]: [...(p[cat.key] || []), nome] }));
      setOriginais((p) => ({ ...p, [key]: preco }));
      setMascaras((p) => ({ ...p, [key]: numeroParaMascara(preco) }));
      setSalvoKey(key);
      setNovo(null);
    } catch (e) {
      setErro(e.message || 'Não foi possível cadastrar o item. Tente novamente.');
    } finally {
      setGravandoNovo(false);
    }
  };

  const remover = async (cat, item) => {
    const ok = window.confirm(
      `Remover "${item}" da lista de ${cat.label}? Ele deixa de aparecer nos formulários; as requisições já enviadas não mudam.`
    );
    if (!ok) return;
    const key = chavePreco(cat.key, item);
    setRemovendoKey(key);
    setErro('');
    try {
      await removerItem(cat.key, item);
      setExtras((p) => ({ ...p, [cat.key]: (p[cat.key] || []).filter((i) => i !== item) }));
    } catch (e) {
      setErro(e.message || 'Não foi possível remover o item. Tente novamente.');
    } finally {
      setRemovendoKey(null);
    }
  };

  if (!podeEditar) return <Navigate to="/home" replace />;

  return (
    <div className="gestor-page animate-fade-in-up">
      <h1 className="page-title"><Coins size={28} /> Ajustes de Valores</h1>
      <p className="page-subtitle">
        Configure o preço de cada item com custo. O valor aparece ao lado do item nos formulários de requisição.
        Use <strong>Adicionar</strong> para incluir um item novo na lista; ele passa a ser opção no formulário.
      </p>

      {erro && (
        <div className="sol-card-resumo tom-reprovada" style={{ marginBottom: 'var(--space-lg)' }}>
          <AlertCircle size={15} /> {erro}
        </div>
      )}

      {loading ? (
        <div className="av-loading"><Loader2 size={18} className="animate-spin" /> Carregando preços…</div>
      ) : (
        <div className="av-catalogos">
          {CATALOGOS.map((cat) => {
            const cadastrados = extras[cat.key] || [];
            const itens = comItensExtras(cat.itens, cadastrados);
            const ehExtra = new Set(cadastrados);
            const abertoAqui = novo?.catalogo === cat.key;
            return (
              <section key={cat.key} className="av-card">
                <header className="av-card-head">
                  <h2>{cat.label}</h2>
                  <span className="av-origem">{cat.origem}</span>
                </header>
                <div className="av-itens">
                  {itens.map((item) => {
                    const key = chavePreco(cat.key, item);
                    return (
                      <div key={key} className="av-item">
                        <span className="av-item-nome">
                          {item}
                          {ehExtra.has(item) && <span className="av-tag-novo" title="Cadastrado nesta tela">novo</span>}
                        </span>
                        <div className="av-item-valor">
                          <span className="av-prefix">R$</span>
                          <CurrencyInput
                            className="form-input av-input"
                            value={mascaras[key] ?? ''}
                            onChange={(v) => setMascara(key, v)}
                            onBlur={() => persistir(cat.key, item)}
                            placeholder="0,00"
                          />
                          <span className="av-status">
                            {salvandoKey === key && <Loader2 size={14} className="animate-spin" />}
                            {salvoKey === key && salvandoKey !== key && <Check size={15} className="av-ok" />}
                          </span>
                          {ehExtra.has(item) ? (
                            <button
                              type="button"
                              className="av-remover"
                              onClick={() => remover(cat, item)}
                              disabled={removendoKey === key}
                              title="Remover item da lista"
                              aria-label={`Remover ${item}`}
                            >
                              {removendoKey === key
                                ? <Loader2 size={14} className="animate-spin" />
                                : <Trash2 size={14} />}
                            </button>
                          ) : (
                            <span className="av-remover-vazio" aria-hidden="true" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {abertoAqui ? (
                  <form className="av-novo" onSubmit={(e) => { e.preventDefault(); cadastrar(cat, itens); }}>
                    <input
                      className="form-input av-novo-nome"
                      value={novo.nome}
                      onChange={(e) => setNovo((p) => ({ ...p, nome: e.target.value }))}
                      placeholder={`Nome do ${cat.singular}`}
                      maxLength={120}
                      autoFocus
                    />
                    <div className="av-item-valor">
                      <span className="av-prefix">R$</span>
                      <CurrencyInput
                        className="form-input av-input"
                        value={novo.preco}
                        onChange={(v) => setNovo((p) => ({ ...p, preco: v }))}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="av-novo-acoes">
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setNovo(null)}
                        disabled={gravandoNovo}
                      >
                        <X size={14} /> Cancelar
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary btn-sm"
                        disabled={gravandoNovo || !novo.nome.trim()}
                      >
                        {gravandoNovo ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Salvar
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="av-rodape">
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => abrirNovo(cat.key)}>
                      <Plus size={14} /> Adicionar {cat.singular}
                    </button>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
