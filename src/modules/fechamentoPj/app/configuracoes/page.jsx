import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFechamentoPj } from '../components/contexto';
import { Cabecalho, Abas, Carregando } from '../components/ui';
import AbaFechamento from './AbaFechamento';
import AbaComunicacao from './AbaComunicacao';
import AbaMotivos from './AbaMotivos';
import AbaCodigos from './AbaCodigos';
import AbaCentros from './AbaCentros';
import AbaParametrosRm from './AbaParametrosRm';
import './configuracoes.css';

const ABAS = [
  { id: 'fechamento', rotulo: 'Fechamento' },
  { id: 'comunicacao', rotulo: 'Comunicação e termo' },
  { id: 'motivos', rotulo: 'Motivos de encerramento' },
  { id: 'codigos', rotulo: 'Códigos de cálculo' },
  { id: 'centros', rotulo: 'Centros de custo RM' },
  { id: 'rm', rotulo: 'Parâmetros TOTVS RM' },
];

/**
 * Configurações do Fechamento PJ. Só o que alguma regra lê de verdade; cada aba
 * grava com o próprio "Salvar" (sem autosave). A aba vai na URL (?aba=centros)
 * para os atalhos das pendências do pagamento caírem no lugar certo.
 */
export default function PaginaConfiguracoes() {
  const { carregando, config } = useFechamentoPj();
  const [params, setParams] = useSearchParams();
  const aba = ABAS.some((a) => a.id === params.get('aba')) ? params.get('aba') : 'fechamento';
  const [sujo, setSujo] = useState(false);

  const aoMudarSujo = useCallback((v) => setSujo(v), []);

  function trocar(id) {
    if (id === aba) return;
    if (sujo && !window.confirm('Há alterações não salvas nesta aba. Trocar de aba e descartar?')) return;
    setSujo(false);
    setParams({ aba: id }, { replace: true });
  }

  if (carregando || !config) return <Carregando />;

  const props = { onSujo: aoMudarSujo };
  return (
    <>
      <Cabecalho titulo="Configurações" subtitulo="Regras do fechamento, comunicação, códigos, centros de custo e parâmetros do TOTVS RM." />
      <Abas abas={ABAS.map((a) => (a.id === aba && sujo ? { ...a, rotulo: `${a.rotulo} •` } : a))} ativa={aba} onTrocar={trocar} />
      {/* key: trocar de aba monta o formulário de novo a partir do que está gravado. */}
      <div key={aba}>
        {aba === 'fechamento' && <AbaFechamento {...props} />}
        {aba === 'comunicacao' && <AbaComunicacao {...props} />}
        {aba === 'motivos' && <AbaMotivos {...props} />}
        {aba === 'codigos' && <AbaCodigos />}
        {aba === 'centros' && <AbaCentros {...props} />}
        {aba === 'rm' && <AbaParametrosRm {...props} />}
      </div>
    </>
  );
}
