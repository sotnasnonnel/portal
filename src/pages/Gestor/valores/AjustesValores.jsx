import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Coins, Loader2, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import CurrencyInput from '../../../components/CurrencyInput';
import { CATALOGOS, chavePreco } from '../../../config/precosItens';
import { parseCurrency, numeroParaMascara } from '../../../utils/currencyMask';
import { carregarPrecosMap, salvarPreco } from '../../../services/precosItens';
import '../../../components/UI/Components.css';
import '../Gestor.css';
import './AjustesValores.css';

const PODE = ['gestor', 'admin'];

export default function AjustesValores() {
  const { user } = useAuth();
  const [mascaras, setMascaras] = useState({});     // chave -> string mascarada (editável)
  const [originais, setOriginais] = useState({});   // chave -> número|null (base p/ detectar mudança)
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [salvandoKey, setSalvandoKey] = useState(null);
  const [salvoKey, setSalvoKey] = useState(null);

  const podeEditar = useMemo(() => PODE.includes(user?.perfil), [user]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const mapa = await carregarPrecosMap();
        if (!vivo) return;
        const mask = {};
        for (const [k, n] of Object.entries(mapa)) mask[k] = numeroParaMascara(n);
        setOriginais(mapa);
        setMascaras(mask);
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
    const novo = parseCurrency(mascaras[key]);
    const antigo = originais[key] ?? null;
    if (novo === antigo) return;                 // nada mudou
    setSalvandoKey(key);
    setErro('');
    try {
      await salvarPreco(catalogo, item, novo, user?.id);
      setOriginais((p) => ({ ...p, [key]: novo }));
      setSalvoKey(key);
    } catch (e) {
      setErro(e.message || 'Não foi possível salvar. Tente novamente.');
      // Reverte o campo ao último valor salvo.
      setMascaras((p) => ({ ...p, [key]: numeroParaMascara(antigo) }));
    } finally {
      setSalvandoKey(null);
    }
  };

  if (!podeEditar) return <Navigate to="/home" replace />;

  return (
    <div className="gestor-page animate-fade-in-up">
      <h1 className="page-title"><Coins size={28} /> Ajustes de Valores</h1>
      <p className="page-subtitle">
        Configure o preço de cada item com custo. O valor aparece ao lado do item nos formulários de requisição.
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
          {CATALOGOS.map((cat) => (
            <section key={cat.key} className="av-card">
              <header className="av-card-head">
                <h2>{cat.label}</h2>
                <span className="av-origem">{cat.origem}</span>
              </header>
              <div className="av-itens">
                {cat.itens.map((item) => {
                  const key = chavePreco(cat.key, item);
                  return (
                    <div key={key} className="av-item">
                      <span className="av-item-nome">{item}</span>
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
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
