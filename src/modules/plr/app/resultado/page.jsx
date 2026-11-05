import { useEffect, useState } from 'react';
import { AlertTriangle, Calculator, Loader2 } from 'lucide-react';
import { PLR_ANO } from '../../../../config/plr';
import { formatarDataHora } from '../../../../utils/formatters';
import { carregarCalculo } from '../../lib/dados';
import MinhaLinha from './MinhaLinha';
import ResultadoTodos from './ResultadoTodos';

// Resultado por pessoa: a conta da aba CALCULO PLR com os números do HUB. O admin
// ganha todas as pessoas, por setor; o gestor, as do setor dele; o usuário, só a
// própria linha. Quem decide é o banco (`papel` e as linhas vêm na resposta), não
// esta tela.
export default function ResultadoPlr() {
  const [estado, setEstado] = useState({ carregando: true, erro: false, dados: null });

  useEffect(() => {
    let vivo = true;
    carregarCalculo(PLR_ANO)
      .then((dados) => { if (vivo) setEstado({ carregando: false, erro: false, dados }); })
      .catch(() => { if (vivo) setEstado({ carregando: false, erro: true, dados: null }); });
    return () => { vivo = false; };
  }, []);

  const { carregando, erro, dados } = estado;
  const soPropria = dados?.papel === 'usuario';
  const temValor = dados?.colaboradores.length > 0 || dados?.gerencia.length > 0;

  return (
    <div className={dados && !soPropria ? 'plr-page plr-page-wide' : 'plr-page'}>
      <div className="plr-cab">
        <h1 className="plr-title">
          <Calculator size={24} /> Resultado por pessoa {PLR_ANO}
        </h1>
        <p className="plr-sub">
          YTD com os números do HUB PHD
          {dados?.atualizadoEm ? `, atualizados em ${formatarDataHora(dados.atualizadoEm)}` : ''}.
        </p>
      </div>

      {carregando ? (
        <div className="plr-vazio"><Loader2 size={22} className="plr-spin" /> Carregando…</div>
      ) : erro ? (
        <div className="plr-vazio plr-erro">Não foi possível calcular o PLR agora. Tente de novo em instantes.</div>
      ) : (
        <>
          {temValor ? (
            <p className="plr-alerta" role="note">
              <AlertTriangle size={16} aria-hidden="true" />
              <span>São dados preliminares, podendo sofrer alterações.</span>
            </p>
          ) : null}
          {soPropria ? <MinhaLinha dados={dados} /> : <ResultadoTodos dados={dados} />}
        </>
      )}
    </div>
  );
}
