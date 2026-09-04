import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilePlus2, Loader2, AlertCircle, Check, Info } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { ehTimeMobilizacao, FLUXOS, rotuloFluxo } from '../../../../config/mobilizacao';
import { listarCatalogo, abrirProcesso } from '../../lib/mobilizacao';
import { etapasPrevistas } from '../../lib/catalogo';
import { projetarDatas } from '../../lib/prazoEtapa';
import { hojeIso } from '../../../../utils/diasUteis';

const dataBr = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');

const VAZIO = {
  titulo: '', profissional_nome: '', empresa_phd: '', cliente_phd: '', cliente_final: '',
  local_obra: '', cod_ct: '', cod_phd: '', contrato: '', coo_phd: '', ger_phd: '',
  data_base: '', observacoes: '',
};

export default function NovaMob() {
  const { modules } = useAuth();
  const navigate = useNavigate();
  const souTime = ehTimeMobilizacao(modules);

  // Empresa primeiro: é o único fluxo sem gatilho, e por isso a razão de esta
  // tela existir. Os de pessoa nascem do chamado do Adm; abrir um aqui é a
  // exceção (o processo que ficou de fora, o chamado antigo).
  const [fluxo, setFluxo] = useState('mobilizacao_empresa');
  const [v, setV] = useState({ ...VAZIO, data_base: hojeIso() });
  const [catalogo, setCatalogo] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    listarCatalogo()
      .then(setCatalogo)
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, []);

  const trocar = (campo) => (ev) => setV((a) => ({ ...a, [campo]: ev.target.value }));

  // A prévia usa a MESMA regra do banco (projetarDatas espelha mob_recalcular).
  // Mostrar os passos e as datas antes de gravar é o que evita descobrir o
  // catálogo vazio depois do processo criado.
  const previa = useMemo(() => {
    const etapas = etapasPrevistas(catalogo, fluxo, v);
    const datas = projetarDatas(etapas, v.data_base || null);
    return etapas.map((e) => ({ ...e, prevista: datas[e.codigo] }));
  }, [catalogo, fluxo, v]);

  const ehEmpresa = fluxo === 'mobilizacao_empresa';
  const identidade = ehEmpresa ? v.cliente_phd : v.profissional_nome;

  const salvar = async (ev) => {
    ev.preventDefault();
    if (!identidade.trim()) {
      setErro(ehEmpresa ? 'Informe o cliente.' : 'Informe o profissional.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const id = await abrirProcesso(fluxo, {
        ...v,
        titulo: v.titulo.trim() || identidade.trim(),
      });
      navigate(`/mobilizacao/processo/${id}`);
    } catch (e) {
      setErro(e.message);
      setSalvando(false);
    }
  };

  if (!souTime) {
    return (
      <div className="mob-page">
        <h1 className="mob-title"><FilePlus2 size={24} /> Abrir processo</h1>
        <div className="mob-aviso tom-info">
          <Info size={16} />
          Abrir um processo é do time do Administrativo. Se você precisa mobilizar alguém,
          abra um chamado de Mobilização no Administrativo — o processo nasce sozinho a partir dele.
        </div>
      </div>
    );
  }

  return (
    <div className="mob-page mob-page-wide">
      <h1 className="mob-title"><FilePlus2 size={24} /> Abrir processo</h1>
      <p className="mob-sub">
        A mobilização e a desmobilização de PESSOAS nascem sozinhas do chamado do Administrativo.
        Use esta tela para a mobilização da EMPRESA, que não tem chamado que a dispare — ou para
        um processo que ficou de fora.
      </p>

      {erro && <div className="mob-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      <form onSubmit={salvar}>
        <section className="mob-card">
          <h2 className="mob-card-tit">Fluxo</h2>
          <div className="mob-tabs">
            {FLUXOS.map((f) => (
              <button key={f.slug} type="button"
                className={`mob-tab ${fluxo === f.slug ? 'is-active' : ''}`}
                onClick={() => setFluxo(f.slug)}>
                <f.Icon size={15} /> {f.label}
              </button>
            ))}
          </div>
          <p className="mob-campo-dica">{FLUXOS.find((f) => f.slug === fluxo)?.descricao}</p>
        </section>

        <section className="mob-card">
          <h2 className="mob-card-tit">Identificação</h2>
          <div className="mob-grid2">
            {ehEmpresa ? (
              <div className="mob-campo">
                <label htmlFor="mob-n-cliente">Cliente PHD *</label>
                <input id="mob-n-cliente" type="text" value={v.cliente_phd} onChange={trocar('cliente_phd')} required />
              </div>
            ) : (
              <div className="mob-campo">
                <label htmlFor="mob-n-prof">Profissional *</label>
                <input id="mob-n-prof" type="text" value={v.profissional_nome} onChange={trocar('profissional_nome')} required />
                <span className="mob-campo-dica">
                  Texto livre: a planilha traz gente que ainda não está cadastrada no portal.
                </span>
              </div>
            )}

            <div className="mob-campo">
              <label htmlFor="mob-n-data">Data-base *</label>
              <input id="mob-n-data" type="date" value={v.data_base} onChange={trocar('data_base')} required />
              <span className="mob-campo-dica">É dela que partem os prazos de todos os passos.</span>
            </div>

            <div className="mob-campo">
              <label htmlFor="mob-n-titulo">Título do processo</label>
              <input id="mob-n-titulo" type="text" value={v.titulo} onChange={trocar('titulo')}
                placeholder={identidade || 'Usa a identificação acima'} />
            </div>

            {!ehEmpresa && (
              <div className="mob-campo">
                <label htmlFor="mob-n-cliente2">Cliente PHD</label>
                <input id="mob-n-cliente2" type="text" value={v.cliente_phd} onChange={trocar('cliente_phd')} />
              </div>
            )}

            <div className="mob-campo">
              <label htmlFor="mob-n-cfinal">Cliente final</label>
              <input id="mob-n-cfinal" type="text" value={v.cliente_final} onChange={trocar('cliente_final')} />
            </div>
            <div className="mob-campo">
              <label htmlFor="mob-n-empresa">Empresa PHD</label>
              <input id="mob-n-empresa" type="text" value={v.empresa_phd} onChange={trocar('empresa_phd')} />
            </div>
            <div className="mob-campo">
              <label htmlFor="mob-n-obra">Local da obra</label>
              <input id="mob-n-obra" type="text" value={v.local_obra} onChange={trocar('local_obra')} />
            </div>
            <div className="mob-campo">
              <label htmlFor="mob-n-ct">Cód. CT</label>
              <input id="mob-n-ct" type="text" value={v.cod_ct} onChange={trocar('cod_ct')} />
            </div>
            <div className="mob-campo">
              <label htmlFor="mob-n-cphd">Cód. PHD</label>
              <input id="mob-n-cphd" type="text" value={v.cod_phd} onChange={trocar('cod_phd')} />
            </div>
            <div className="mob-campo">
              <label htmlFor="mob-n-contrato">Nº do contrato</label>
              <input id="mob-n-contrato" type="text" value={v.contrato} onChange={trocar('contrato')} />
            </div>
            <div className="mob-campo">
              <label htmlFor="mob-n-coo">COO PHD</label>
              <input id="mob-n-coo" type="text" value={v.coo_phd} onChange={trocar('coo_phd')} />
            </div>
            <div className="mob-campo">
              <label htmlFor="mob-n-ger">Gerente PHD</label>
              <input id="mob-n-ger" type="text" value={v.ger_phd} onChange={trocar('ger_phd')} />
            </div>
          </div>

          <div className="mob-campo">
            <label htmlFor="mob-n-obs">Observações</label>
            <textarea id="mob-n-obs" value={v.observacoes} onChange={trocar('observacoes')} />
          </div>
        </section>

        <section className="mob-card">
          <h2 className="mob-card-tit">Passos que serão criados</h2>

          {carregando ? (
            <div className="mob-vazio"><Loader2 size={18} className="mob-spin" /> Carregando catálogo…</div>
          ) : !previa.length ? (
            <div className="mob-aviso tom-alerta">
              <AlertCircle size={16} />
              O catálogo de {rotuloFluxo(fluxo)} está vazio. O processo seria criado sem passo nenhum —
              cadastre as etapas em Catálogo e SLAs antes.
            </div>
          ) : (
            <>
              <div className="mob-tabela-scroll">
                <table className="mob-tabela">
                  <thead>
                    <tr><th>#</th><th>Etapa</th><th>Depende de</th><th className="num">SLA</th><th className="num">Previsto</th></tr>
                  </thead>
                  <tbody>
                    {previa.map((e) => (
                      <tr key={e.codigo}>
                        <td className="num">{e.ordem}</td>
                        <td>{e.titulo}</td>
                        <td>{previa.find((x) => x.codigo === e.depende_de)?.titulo || '—'}</td>
                        <td className="num">{e.sla_dias_uteis ?? '—'}</td>
                        <td className="num">{dataBr(e.prevista)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mob-campo-dica" style={{ marginTop: 10 }}>
                Previsão em dias úteis. Quando um passo for concluído de fato, os seguintes se
                reajustam a partir da data real.
              </p>
            </>
          )}
        </section>

        <button type="submit" className="mob-btn mob-btn-primary" disabled={salvando || !previa.length}>
          {salvando ? <Loader2 size={16} className="mob-spin" /> : <Check size={16} />}
          {salvando ? 'Abrindo…' : 'Abrir processo'}
        </button>
      </form>
    </div>
  );
}
