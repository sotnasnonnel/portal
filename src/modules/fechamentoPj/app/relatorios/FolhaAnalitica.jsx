import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer } from 'lucide-react';
import { Modal } from '../components/ui';
import { folhaAnalitica } from '../../lib/relatorios';
import { competenciaRotulo, dataBr, fmtBRL, fmtNum } from '../../lib/formato';
import logo from '../../../../assets/logo-phd.png';

const EMPRESA = 'PHD ASSESSORIA EM GESTÃO LTDA';
const EMPRESA_CNPJ = '45.420.053/0001-08';

const ROTULO_CONFERENCIA = { ok: 'Sem divergência', divergente: 'Divergência' };
const ROTULO_TERMO = { disponivel: 'Termo disponível', gerado: 'Termo gerado', bloqueado: 'Termo bloqueado' };

function Documento({ relatorio, competenciaAtual, emissao }) {
  const comp = competenciaRotulo(competenciaAtual?.competencia);
  const status = competenciaAtual?.status === 'fechada' ? 'Fechada' : 'Em conferência';
  return (
    <>
      <header className="pj-fa-topo">
        <img src={logo} alt="PHD" className="pj-fa-logo" />
        <div className="pj-fa-empresa">
          <strong>Fechamento PJ</strong>
          <span>{EMPRESA}</span>
          <span>CNPJ {EMPRESA_CNPJ}</span>
        </div>
        <dl className="pj-fa-info">
          <div><dt>Competência</dt><dd>{comp}</dd></div>
          <div><dt>Emissão</dt><dd>{emissao}</dd></div>
          <div><dt>Status</dt><dd>{status}</dd></div>
        </dl>
      </header>

      <h1 className="pj-fa-titulo">FOLHA ANALÍTICA PJ</h1>

      {relatorio.pessoas.map((p, i) => (
        <section key={p.envelopeId} className="pj-fa-pessoa pj-quebra-evitar">
          <div className="pj-fa-pessoa-cab">
            <strong>{p.codigo || String(i + 1).padStart(6, '0')} - {p.nome}</strong>
            <span>{p.funcao} · {ROTULO_CONFERENCIA[p.conferencia] || '—'} · {ROTULO_TERMO[p.termo] || '—'}</span>
          </div>
          <div className="pj-fa-meta">
            <span><small>Razão social</small>{p.razaoSocial}</span>
            <span><small>CNPJ</small>{p.cnpj}</span>
            <span><small>CPF</small>{p.cpf}</span>
            <span><small>Início</small>{p.inicio ? dataBr(p.inicio) : '—'}</span>
          </div>
          <table className="pj-fa-tabela">
            <thead>
              <tr><th>Cód.</th><th>Descrição</th><th className="pj-fa-dir">Ref.</th><th className="pj-fa-dir">Proventos</th><th className="pj-fa-dir">Descontos</th></tr>
            </thead>
            <tbody>
              {p.eventos.map((e) => (
                <tr key={`${e.codigo}-${e.descricao}`} className={e.natureza === 'provento' ? 'pj-fa-provento' : 'pj-fa-desconto'}>
                  <td>{e.codigo}</td>
                  <td>{e.descricao}</td>
                  <td className="pj-fa-dir">{e.referencia === '' ? '' : fmtNum(e.referencia)}</td>
                  <td className="pj-fa-dir">{e.natureza === 'provento' ? fmtBRL(e.valor) : ''}</td>
                  <td className="pj-fa-dir">{e.natureza === 'desconto' ? fmtBRL(e.valor) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pj-fa-totais">
            <span>Proventos <b>{fmtBRL(p.proventos)}</b></span>
            <span>Descontos <b>{fmtBRL(p.descontos)}</b></span>
            <span>Líquido NF <b>{fmtBRL(p.liquido)}</b></span>
          </div>
        </section>
      ))}

      <section className="pj-fa-geral pj-quebra-evitar">
        <h2>TOTAL GERAL</h2>
        <table className="pj-fa-tabela">
          <thead>
            <tr><th>Cód.</th><th>Descrição</th><th className="pj-fa-dir">N.F.</th><th className="pj-fa-dir">Proventos</th><th className="pj-fa-dir">Descontos</th></tr>
          </thead>
          <tbody>
            {relatorio.totalGeral.map((t) => (
              <tr key={`${t.codigo}-${t.descricao}-${t.natureza}`} className={t.natureza === 'provento' ? 'pj-fa-provento' : 'pj-fa-desconto'}>
                <td>{t.codigo}</td>
                <td>{t.descricao}</td>
                <td className="pj-fa-dir">{t.quantidade}</td>
                <td className="pj-fa-dir">{t.natureza === 'provento' ? fmtBRL(t.valor) : ''}</td>
                <td className="pj-fa-dir">{t.natureza === 'desconto' ? fmtBRL(t.valor) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pj-fa-totais pj-fa-totais--geral">
          <span>Prestadores <b>{relatorio.totais.prestadores}</b></span>
          <span>Proventos <b>{fmtBRL(relatorio.totais.proventos)}</b></span>
          <span>Descontos <b>{fmtBRL(relatorio.totais.descontos)}</b></span>
          <span>Líquido NF <b>{fmtBRL(relatorio.totais.liquido)}</b></span>
        </div>
      </section>

      <footer className="pj-fa-rodape">Relatório Analítico do Fechamento PJ • {comp} • PHD</footer>
    </>
  );
}

/**
 * A cópia impressa vai por portal direto no <body>: dentro do modal (fixo e com
 * rolagem) o navegador cortaria o relatório na primeira página.
 */
export default function FolhaAnalitica({ envelopes, prestadores, competenciaAtual, onImprimir, onFechar }) {
  const relatorio = useMemo(() => folhaAnalitica({ envelopes, prestadores }), [envelopes, prestadores]);
  const [emissao] = useState(() => new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }));

  function imprimir() {
    onImprimir?.();
    window.print();
  }

  return (
    <Modal largura="xl" onFechar={onFechar} titulo="Folha Analítica PJ"
      subtitulo={`${competenciaRotulo(competenciaAtual?.competencia)} · ${relatorio.totais.prestadores} prestador(es)`}
      rodape={(
        <>
          <button type="button" className="btn btn-outline" onClick={onFechar}>Fechar</button>
          <button type="button" className="btn btn-primary" onClick={imprimir}><Printer size={16} /> Imprimir / salvar PDF</button>
        </>
      )}>
      <div className="pj-documento pj-fa">
        <Documento relatorio={relatorio} competenciaAtual={competenciaAtual} emissao={emissao} />
      </div>
      {createPortal(
        <div className="pj-documento pj-fa pj-imprimir pj-fa-impressao">
          <Documento relatorio={relatorio} competenciaAtual={competenciaAtual} emissao={emissao} />
        </div>,
        document.body,
      )}
    </Modal>
  );
}
