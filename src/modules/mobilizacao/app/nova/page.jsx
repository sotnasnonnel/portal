import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, Loader2, AlertCircle, Check, Info, Headset } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { ehTimeMobilizacao, rotuloFluxo } from '../../../../config/mobilizacao';
import { listarCatalogo, abrirProcesso } from '../../lib/mobilizacao';
import { etapasPrevistas } from '../../lib/catalogo';
import { projetarDatas } from '../../lib/prazoEtapa';
import { hojeIso } from '../../../../utils/diasUteis';

const dataBr = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');

/**
 * Esta tela abre SÓ mobilização de empresa.
 *
 * Os fluxos de PESSOA (mobilização e desmobilização) nascem do chamado do
 * Administrativo, por gatilho no banco. Oferecê-los aqui criaria um segundo
 * caminho para a mesma coisa — e o resultado seria um processo à mão e outro do
 * chamado para a mesma pessoa, sem nada que os ligasse. A mobilização de
 * empresa é a única sem chamado que a dispare, e por isso é a única manual.
 */
const FLUXO = 'mobilizacao_empresa';

const VAZIO = {
  cliente_phd: '', titulo: '', cliente_final: '', empresa_phd: '',
  local_obra: '', cod_ct: '', cod_phd: '', contrato: '', coo_phd: '', ger_phd: '',
  data_base: '', observacoes: '',
};

export default function NovaMob() {
  const { modules } = useAuth();
  const navigate = useNavigate();
  const souTime = ehTimeMobilizacao(modules);

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
    const etapas = etapasPrevistas(catalogo, FLUXO, v);
    const datas = projetarDatas(etapas, v.data_base || null);
    return etapas.map((e) => ({ ...e, prevista: datas[e.codigo] }));
  }, [catalogo, v]);

  const salvar = async (ev) => {
    ev.preventDefault();
    if (!v.cliente_phd.trim()) { setErro('Informe o cliente.'); return; }
    setSalvando(true);
    setErro('');
    try {
      const id = await abrirProcesso(FLUXO, { ...v, titulo: v.titulo.trim() || v.cliente_phd.trim() });
      navigate(`/mobilizacao/processo/${id}`);
    } catch (e) {
      setErro(e.message);
      setSalvando(false);
    }
  };

  if (!souTime) {
    return (
      <div className="mob-page">
        <h1 className="mob-title"><Building2 size={24} /> Mobilizar empresa</h1>
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
      <h1 className="mob-title"><Building2 size={24} /> Mobilizar empresa</h1>
      <p className="mob-sub">
        A mobilização de uma empresa num contrato novo é a única que não tem chamado que a dispare,
        e por isso é aberta aqui.
      </p>

      {/* Sem isto, alguém do time procuraria por "onde abro a mobilização do
          fulano" e não acharia — e a resposta não está nesta tela. */}
      <div className="mob-aviso tom-info">
        <Headset size={16} />
        <span>
          <strong>Mobilização e desmobilização de PESSOAS não se abrem aqui.</strong>{' '}
          Elas nascem sozinhas do chamado de Mobilização do Administrativo, e aparecem no{' '}
          <Link to="/mobilizacao/kanban">Quadro</Link> como &quot;A fazer&quot;. Se um chamado foi
          aberto e o processo não apareceu, a{' '}
          <Link to="/mobilizacao/torre">Torre de controle</Link> lista as falhas com um botão de
          reprocessar.
        </span>
      </div>

      {erro && <div className="mob-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      <form onSubmit={salvar}>
        <section className="mob-card">
          <h2 className="mob-card-tit">Identificação</h2>
          <div className="mob-grid2">
            <div className="mob-campo">
              <label htmlFor="mob-n-cliente">Cliente PHD *</label>
              <input id="mob-n-cliente" type="text" value={v.cliente_phd} onChange={trocar('cliente_phd')} required />
            </div>

            <div className="mob-campo">
              <label htmlFor="mob-n-data">Data-base *</label>
              <input id="mob-n-data" type="date" value={v.data_base} onChange={trocar('data_base')} required />
              <span className="mob-campo-dica">É dela que partem os prazos de todos os passos.</span>
            </div>

            <div className="mob-campo">
              <label htmlFor="mob-n-titulo">Título do processo</label>
              <input id="mob-n-titulo" type="text" value={v.titulo} onChange={trocar('titulo')}
                placeholder={v.cliente_phd || 'Usa o cliente acima'} />
            </div>

            <div className="mob-campo">
              <label htmlFor="mob-n-cfinal">Cliente final</label>
              <input id="mob-n-cfinal" type="text" value={v.cliente_final} onChange={trocar('cliente_final')} />
            </div>
            <div className="mob-campo">
              <label htmlFor="mob-n-empresa">Empresa PHD</label>
              <input id="mob-n-empresa" type="text" value={v.empresa_phd} onChange={trocar('empresa_phd')}
                placeholder="PHD ENGENHARIA, PHD ASSESSORIA ou PJ" />
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
              O catálogo de {rotuloFluxo(FLUXO)} está vazio. O processo seria criado sem passo nenhum —
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
          {salvando ? 'Abrindo…' : 'Abrir mobilização de empresa'}
        </button>
      </form>
    </div>
  );
}
