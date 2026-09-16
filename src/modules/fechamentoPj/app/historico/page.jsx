import { useEffect, useMemo, useState } from 'react';
import { Archive, Database, CalendarCheck } from 'lucide-react';
import { useFechamentoPj } from '../components/contexto';
import { Cabecalho, StatCard, Abas, Aviso, Carregando } from '../components/ui';
import { historicoEnvelopes, listarImportacoes, listarAuditoria, nomesColaboradores } from '../../lib/dados';
import { competenciaRotulo } from '../../lib/formato';
import { AbaCompetencias, AbaValores, AbaTermos, AbaImportacoes, AbaAuditoria } from './abas';
import './historico.css';

const ABAS = [
  { id: 'competencias', rotulo: 'Competências' },
  { id: 'valores', rotulo: 'Valores por prestador' },
  { id: 'termos', rotulo: 'Termos' },
  { id: 'importacoes', rotulo: 'Importações' },
  { id: 'auditoria', rotulo: 'Auditoria' },
];

/**
 * Histórico do Fechamento PJ. Os valores de cada mês vêm dos envelopes da
 * própria competência (imutáveis depois do fechamento), não de "snapshots".
 */
export default function PaginaHistorico() {
  const { competencias = [], carregando } = useFechamentoPj();
  const [aba, setAba] = useState('competencias');
  // null = carregando; o efeito só grava depois do await.
  const [base, setBase] = useState(null);
  const [nomes, setNomes] = useState(new Map());

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const resultado = { valores: [], importacoes: [], auditoria: [], erros: [] };
      // Cada fonte falha sozinha: um erro na auditoria não esconde os valores.
      const [valores, importacoes, auditoria] = await Promise.allSettled([
        historicoEnvelopes(), listarImportacoes(200), listarAuditoria({ limite: 500 }),
      ]);
      [['valores', valores], ['importacoes', importacoes], ['auditoria', auditoria]].forEach(([chave, r]) => {
        if (r.status === 'fulfilled') resultado[chave] = r.value;
        else resultado.erros.push(r.reason?.message || String(r.reason));
      });
      if (!cancelado) setBase(resultado);
    })();
    return () => { cancelado = true; };
  }, []);

  // Autores (fechou, reabriu, importou, auditou, enviou) resolvidos de uma vez.
  const idsAutores = useMemo(() => {
    const ids = new Set();
    competencias.forEach((c) => { ids.add(c.fechada_por); ids.add(c.reaberta_por); });
    (base?.importacoes || []).forEach((i) => ids.add(i.importado_por));
    (base?.auditoria || []).forEach((a) => ids.add(a.por));
    return [...ids].filter(Boolean).sort();
  }, [competencias, base]);
  const chaveAutores = idsAutores.join(',');

  useEffect(() => {
    if (!chaveAutores) return undefined;
    let cancelado = false;
    nomesColaboradores(chaveAutores.split(','))
      .then((mapa) => { if (!cancelado) setNomes((antes) => new Map([...antes, ...mapa])); })
      .catch(() => { /* sem nome: a tabela mostra "—" */ });
    return () => { cancelado = true; };
  }, [chaveAutores]);

  const stats = useMemo(() => {
    const fechadas = competencias.filter((c) => c.status === 'fechada');
    const ultima = fechadas.map((c) => c.competencia).sort().pop();
    return { fechadas: fechadas.length, registros: base?.valores.length ?? '…', ultima: ultima ? competenciaRotulo(ultima) : '—' };
  }, [competencias, base]);

  if (carregando) return <Carregando />;

  return (
    <>
      <Cabecalho titulo="Histórico" subtitulo="Competências, valores de cada mês, termos, importações e auditoria do Fechamento PJ." />

      <div className="pj-kpis">
        <StatCard tom="success" icone={<Archive size={22} />} valor={stats.fechadas} rotulo="Competências fechadas" />
        <StatCard tom="secondary" icone={<Database size={22} />} valor={stats.registros} rotulo="Registros de valores" />
        <StatCard tom="accent" icone={<CalendarCheck size={22} />} valor={stats.ultima} rotulo="Última competência fechada" />
      </div>

      {base?.erros.map((e) => <Aviso key={e} tipo="erro">{e}</Aviso>)}

      <Abas abas={ABAS} ativa={aba} onTrocar={setAba} />

      {aba === 'competencias' && <AbaCompetencias nomes={nomes} />}
      {aba === 'valores' && <AbaValores linhas={base?.valores} />}
      {aba === 'termos' && <AbaTermos />}
      {aba === 'importacoes' && <AbaImportacoes linhas={base?.importacoes} nomes={nomes} />}
      {aba === 'auditoria' && <AbaAuditoria linhas={base?.auditoria} nomes={nomes} />}
    </>
  );
}
