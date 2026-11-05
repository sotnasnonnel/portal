import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Save } from 'lucide-react';
import { PLR_ANO } from '../../../../config/plr';
import { carregarMultEmpresa, salvarMultEmpresa } from '../../lib/dados';
import { deCampo, paraCampo } from '../../lib/plr';

// A parte da empresa no PLR dos colaboradores. Fica fora do formulário do setor
// porque vale para todos, e tem o próprio Salvar.
export default function CartaoMultEmpresa() {
  const [salvo, setSalvo] = useState(null);
  const [campo, setCampo] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    let ativo = true;
    carregarMultEmpresa(PLR_ANO)
      .then((valor) => {
        if (!ativo) return;
        setSalvo(valor);
        setCampo(paraCampo(valor, 'percentual'));
      })
      .catch((e) => {
        if (ativo) setMsg({ tipo: 'erro', texto: `Não foi possível carregar: ${e?.message || 'erro desconhecido'}` });
      })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, []);

  const valor = deCampo(campo, 'percentual');
  const valido = valor !== null && !Number.isNaN(valor) && valor >= 0 && valor <= 1;
  const sujo = salvo !== null && valor !== salvo;

  const salvar = async () => {
    setSalvando(true);
    setMsg(null);
    try {
      await salvarMultEmpresa(PLR_ANO, valor);
      setSalvo(valor);
      setMsg({ tipo: 'ok', texto: 'Salvo. Os Resultados dos colaboradores já usa o novo percentual.' });
    } catch (e) {
      setMsg({ tipo: 'erro', texto: `Não foi possível salvar: ${e?.message || 'erro desconhecido'}` });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="plr-card">
      <h2 className="plr-card-tit">Multiplicador empresa</h2>
      <div className="plr-campo">
        <label htmlFor="plr-mult-empresa">Percentual igual para todos os colaboradores</label>
        <span className="plr-input-sufixo">
          <input
            id="plr-mult-empresa"
            className="plr-input plr-input-num plr-input-pct"
            value={campo}
            inputMode="decimal"
            disabled={carregando || salvando || salvo === null}
            onChange={(e) => { setMsg(null); setCampo(e.target.value); }}
          />
          <small>%</small>
        </span>
      </div>
      <p className="plr-rodape">Somado à parte do setor nos Resultados {PLR_ANO}. A gerência continua com o valor do HUB.</p>

      {sujo && !valido ? <p className="plr-msg is-erro"><AlertTriangle size={15} /> Informe um número de 0 a 100.</p> : null}
      {msg ? (
        <p className={`plr-msg is-${msg.tipo}`}>
          {msg.tipo === 'ok' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />} {msg.texto}
        </p>
      ) : null}

      <div className="plr-acoes">
        <button
          type="button"
          className="plr-btn plr-btn-primary"
          onClick={salvar}
          disabled={!sujo || !valido || salvando}
        >
          {salvando ? <Loader2 size={16} className="plr-spin" /> : <Save size={16} />} Salvar percentual
        </button>
      </div>
    </section>
  );
}
