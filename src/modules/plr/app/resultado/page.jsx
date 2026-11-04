import { useEffect, useState } from 'react';
import { Calculator, Loader2 } from 'lucide-react';
import { PLR_ANO } from '../../../../config/plr';
import { formatarDataHora } from '../../../../utils/formatters';
import { carregarCalculo } from '../../lib/dados';
import MinhaLinha from './MinhaLinha';
import ResultadoTodos from './ResultadoTodos';

// Resultado por pessoa: a conta da aba CALCULO PLR com os números do HUB. Quem vê
// tudo ganha todas as pessoas, por setor; os demais, só a própria linha. Quem
// decide é o banco (`veTodos` vem da resposta), não esta tela.
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

  return (
    <div className={dados?.veTodos ? 'plr-page plr-page-wide' : 'plr-page'}>
      <div className="plr-cab">
        <h1 className="plr-title">
          <Calculator size={24} /> {dados?.veTodos ? 'Resultado por pessoa' : 'Meu PLR'} {PLR_ANO}
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
      ) : dados.veTodos ? (
        <ResultadoTodos dados={dados} />
      ) : (
        <MinhaLinha dados={dados} />
      )}
    </div>
  );
}
