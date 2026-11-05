import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { SlidersHorizontal } from 'lucide-react';
import { useFrota } from '../components/FrotaContext';
import { Estado, PageHead, Secao } from '../components/Pecas';
import { parseBR } from '../../lib/regras';
import { salvarConfig } from '../../lib/frota';

const CAMPOS = [
  { k: 'intervalo_revisao_km', l: 'Intervalo de revisão (km)' },
  { k: 'margem_revisao_km', l: 'Avisar antes (km)' },
  { k: 'margem_revisao_dias', l: 'Avisar revisão por data (dias antes)' },
  { k: 'validade_termo_meses', l: 'Validade do termo (meses)' },
  { k: 'alerta_dias', l: 'Alerta de vencimento CNH/termo (dias)' },
];
const CONTAGENS = [
  ['veiculos', 'Veículos'],
  ['mensal', 'Lançamentos mensais'],
  ['ocorrencias', 'Multas e avarias'],
  ['condutores', 'Condutores'],
  ['manutencoes', 'Manutenções'],
];

export default function ConfiguracoesFrota() {
  const {
    dados, cfg, setCfg, carregando, isAdmin, toast,
  } = useFrota();
  // null = ainda não mexeu: mostra o que veio do banco, que pode chegar depois.
  const [rascunho, setRascunho] = useState(null);
  const [salvando, setSalvando] = useState(false);

  if (!isAdmin) return <Navigate to="/frota/painel" replace />;

  const valor = (k) => (rascunho?.[k] ?? String(cfg[k]));

  const salvar = async (e) => {
    e.preventDefault();
    // Valor inválido ou negativo mantém o anterior, como no protótipo.
    const next = { ...cfg };
    CAMPOS.forEach(({ k }) => {
      const n = parseBR(valor(k));
      if (n != null && n >= 0) next[k] = Math.round(n);
    });
    setSalvando(true);
    try {
      setCfg(await salvarConfig(next));
      setRascunho(null);
      toast('Parâmetros salvos');
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="frota-page frota-stack">
      <PageHead Icon={SlidersHorizontal} titulo="Configurações" sub="Parâmetros usados nos alertas de revisão, termos e CNH." />
      <Estado />
      <div className="frota-grid g2">
        <Secao titulo="Regras de alerta">
          <form className="frota-stack" onSubmit={salvar}>
            <div className="frota-fgrid">
              {CAMPOS.map(({ k, l }) => (
                <div key={k} className="frota-fld">
                  <label htmlFor={`cfg-${k}`}>{l}</label>
                  <input
                    id={`cfg-${k}`}
                    className="frota-inp"
                    inputMode="numeric"
                    value={valor(k)}
                    disabled={carregando}
                    onChange={(ev) => setRascunho((r) => ({ ...r, [k]: ev.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div>
              <button type="submit" className="frota-btn primary" disabled={salvando || carregando}>{salvando ? 'Salvando…' : 'Salvar parâmetros'}</button>
            </div>
          </form>
        </Secao>
        <Secao titulo="Base de dados">
          <dl className="frota-dl">
            {CONTAGENS.map(([k, l]) => (
              <div key={k}><dt>{l}</dt><dd>{dados[k].length}</dd></div>
            ))}
          </dl>
          <div className="frota-note frota-mt">
            <span>Quem pode alterar: quem tem acesso ao módulo. Excluir veículo ou condutor e mudar estes parâmetros é só do administrador.</span>
          </div>
        </Secao>
      </div>
    </div>
  );
}
