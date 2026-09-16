import { useMemo, useState } from 'react';
import { Printer, Send, Mail, CheckCircle2 } from 'lucide-react';
import { useFechamentoPj } from '../components/contexto';
import { Modal, Aviso, Badge, Moeda } from '../components/ui';
import { marcarTermo, auditar, enviarTermosEmail } from '../../lib/dados';
import { substituirAssunto } from '../../lib/calculo';
import { competenciaRotulo, dataBr, dataHoraBr, fmtBRL, mascararCnpj, round2 } from '../../lib/formato';
import {
  tomadorDaEmpresa, ENDERECO_TOMADOR, copiasDoTermo, emailValido, eventosOrdenados,
} from './folhaUtil';
import logoPhd from '../../../../assets/logo-phd.png';

// Termo de medição e autorização de faturamento (o "termo para emissão da NF").
// Diferente do protótipo, o destinatário é a razão social do cadastro (não
// "NOME + SERVIÇOS LTDA") e o CNPJ é o do cadastro.
function DocumentoTermo({ linha, competenciaAtual, config }) {
  const { envelope, pessoa } = linha;
  const tomador = tomadorDaEmpresa(pessoa.empresa);
  const comp = competenciaRotulo(envelope.competencia);
  const bruto = Number(envelope.bruto) || 0;
  const descontos = Number(envelope.descontos) || 0;
  const liquido = round2(bruto - descontos);
  const eventos = eventosOrdenados(envelope);

  return (
    <article className="pj-documento pj-imprimir pj-termo">
      <header className="pj-termo-topo">
        <img src={logoPhd} alt="PHD" className="pj-termo-logo" />
        <div className="pj-termo-topo-meta">
          <b>Competência {comp}</b>
          <span>Código {pessoa.codigo}</span>
        </div>
      </header>

      <h1>TERMO DE MEDIÇÃO E AUTORIZAÇÃO DE FATURAMENTO</h1>

      <p>
        À <b>{pessoa.razaoSocial || pessoa.nome}</b><br />
        CNPJ: <b>{pessoa.cnpj ? mascararCnpj(pessoa.cnpj) : 'não cadastrado'}</b>
      </p>

      <p>
        Informamos que a medição dos serviços prestados no mês <b>{comp}</b> foi concluída.
        Fica autorizada a emissão da Nota Fiscal no valor líquido de <b>{fmtBRL(liquido)}</b>.
      </p>

      <h2>Dados para emissão da Nota Fiscal</h2>
      <table className="pj-termo-tabela">
        <tbody>
          <tr><th>Tomador do serviço</th><td>{tomador.razao}</td></tr>
          <tr><th>CNPJ do tomador</th><td>{tomador.cnpj}</td></tr>
          <tr><th>Endereço</th><td>{ENDERECO_TOMADOR}</td></tr>
          <tr><th>Descrição do serviço</th><td>Atentar-se para o escopo contratual.</td></tr>
          <tr><th>Valor bruto</th><td>{fmtBRL(bruto)}</td></tr>
          <tr><th>Valor líquido da NF</th><td><b>{fmtBRL(liquido)}</b></td></tr>
        </tbody>
      </table>

      {descontos > 0 && (
        <>
          <p>
            Já se encontra compensado no valor líquido acima o valor total de <b>{fmtBRL(descontos)}</b>,
            referente aos descontos abaixo:
          </p>
          <table className="pj-termo-tabela pj-termo-eventos">
            <tbody>
              {eventos.filter((e) => e.natureza === 'desconto').map((e) => (
                <tr key={e.codigo}><th>{e.codigo} · {e.descricao}</th><td>{fmtBRL(e.valor)}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <p>
        Consulte a situação do seu pagamento em{' '}
        <a href="https://consulta.phdengenharia.tech/" target="_blank" rel="noreferrer">consulta.phdengenharia.tech</a>{' '}
        (informe o CNPJ).
      </p>
      <p>
        A Nota Fiscal deve ser enviada para <b>{config?.email_financeiro || 'e-mail do Financeiro não configurado'}</b>.
      </p>

      <div className="pj-termo-prazos pj-quebra-evitar">
        <h2>Atenção aos prazos</h2>
        <ul>
          <li>Envio dos termos: <b>{dataBr(competenciaAtual?.data_envio_termos)}</b></li>
          <li>Prazo para emissão e envio da NF: <b>{dataHoraBr(competenciaAtual?.prazo_nf)}</b></li>
          <li>Data prevista de pagamento: <b>{dataBr(competenciaAtual?.data_pagamento)}</b></li>
        </ul>
        <p>Nota Fiscal recebida depois do prazo passa para a data de pagamento seguinte.</p>
      </div>

      <footer className="pj-termo-assinatura pj-quebra-evitar">
        <p>Atenciosamente,</p>
        <b>{tomador.razao}</b>
        <span className="pj-termo-lema">Tudo acontece com gente!</span>
      </footer>
    </article>
  );
}

export function ModalTermo({ linha, onFechar, onRegistrarEnvio }) {
  const { config, competencias } = useFechamentoPj();
  const competenciaAtual = competencias.find((c) => c.competencia === linha.envelope.competencia) || null;
  const assunto = substituirAssunto(config?.assunto_email, linha.envelope.competencia);
  const { envelope } = linha;

  return (
    <Modal
      largura="lg"
      titulo="Termo para emissão da Nota Fiscal"
      subtitulo={`${linha.pessoa.codigo} · ${linha.pessoa.nome} · ${competenciaRotulo(envelope.competencia)}`}
      onFechar={onFechar}
      rodape={(
        <>
          <button type="button" className="btn btn-ghost" onClick={onFechar}>Fechar</button>
          <button type="button" className="btn btn-outline" onClick={() => window.print()}>
            <Printer size={16} /> Imprimir / salvar PDF
          </button>
          {envelope.termo === 'gerado' && envelope.envio !== 'enviado' && (
            <button type="button" className="btn btn-primary" onClick={() => onRegistrarEnvio([linha])}>
              <Send size={16} /> Enviar por e-mail
            </button>
          )}
        </>
      )}
    >
      <div className="pj-termo-barra pj-nao-imprimir">
        <span><CheckCircle2 size={14} /> Gerado pelo envelope de pagamento</span>
        <Badge tipo="termo" valor={envelope.termo} />
        <Badge tipo="envio" valor={envelope.envio} />
        <span className="pj-sub">Assunto: {assunto}</span>
      </div>
      <DocumentoTermo linha={linha} competenciaAtual={competenciaAtual} config={config} />
    </Modal>
  );
}

const ROTULO_RESULTADO = { enviado: 'Enviado', ignorado: 'Não enviado', falhou: 'Falhou' };
const BADGE_RESULTADO = { enviado: 'aprovada', ignorado: 'pendente', falhou: 'reprovada' };

/**
 * Envio dos termos por e-mail. O portal manda um e-mail por prestador (Edge
 * Function send-termo-pj), com o termo no corpo e cópia para o Financeiro, e
 * marca como enviado só o que saiu. "Só registrar" continua existindo para o
 * termo que foi mandado por fora do portal.
 */
export function DialogoEnvio({ linhas, onFechar, onConcluido }) {
  const { config, user, notificar } = useFechamentoPj();
  const [gravando, setGravando] = useState(null); // null | 'email' | 'registro'
  const [erro, setErro] = useState('');
  const [resultados, setResultados] = useState(null);

  const aptas = useMemo(() => linhas.filter((l) => l.envelope.termo === 'gerado' && l.envelope.envio !== 'enviado'), [linhas]);
  const semEmail = aptas.filter((l) => !emailValido(l.pessoa.email));
  const comEmail = aptas.length - semEmail.length;
  const copias = copiasDoTermo(config);
  const competencia = linhas[0]?.envelope.competencia;
  const assunto = substituirAssunto(config?.assunto_email, competencia);

  async function enviar() {
    setGravando('email');
    setErro('');
    try {
      const res = await enviarTermosEmail(aptas.map((l) => l.envelope.id));
      setResultados(res);
      const ok = res.filter((r) => r.status === 'enviado').length;
      const falhas = res.length - ok;
      notificar(falhas ? `${ok} termo(s) enviado(s), ${falhas} não enviado(s). Veja o detalhe.` : `${ok} termo(s) enviado(s) por e-mail.`,
        falhas ? 'alerta' : 'sucesso');
      await onConcluido({ manterAberto: true });
    } catch (e) {
      setErro(e.message);
    } finally {
      setGravando(null);
    }
  }

  async function soRegistrar() {
    setGravando('registro');
    setErro('');
    try {
      const n = await marcarTermo(aptas.map((l) => l.envelope.id), 'enviar', user?.id);
      const copiaTxt = copias.length ? copias.join(', ') : 'sem cópia';
      if (aptas.length === 1) {
        const l = aptas[0];
        await auditar('Envio de termo registrado (fora do portal)', `${l.pessoa.nome} • ${l.pessoa.email || 'sem e-mail'} • assunto: ${assunto} • cópia: ${copiaTxt}`,
          { competencia, prestadorId: l.pessoa.id });
      } else {
        await auditar('Envio de termos registrado (fora do portal)', `${n} termo(s) • assunto: ${assunto} • cópia: ${copiaTxt}`, { competencia });
      }
      notificar(n === aptas.length ? `Envio registrado para ${n} termo(s).` : `Envio registrado para ${n} de ${aptas.length} termo(s).`,
        n === aptas.length ? 'sucesso' : 'alerta');
      await onConcluido();
    } catch (e) {
      setErro(e.message);
    } finally {
      setGravando(null);
    }
  }

  if (resultados) {
    return (
      <Modal largura="md" titulo="Resultado do envio" subtitulo={competenciaRotulo(competencia)} onFechar={onFechar}
        rodape={<button type="button" className="btn btn-primary" onClick={onFechar}>Fechar</button>}>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Prestador</th><th>E-mail</th><th>Situação</th></tr></thead>
            <tbody>
              {resultados.map((r) => (
                <tr key={r.envelope_id}>
                  <td>{r.nome || '—'}</td>
                  <td>{r.email || <span className="pj-sub">sem e-mail</span>}</td>
                  <td>
                    <span className={`badge ${BADGE_RESULTADO[r.status] || 'pendente'}`}>{ROTULO_RESULTADO[r.status] || r.status}</span>
                    {r.motivo && <div className="pj-sub">{r.motivo}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      largura="md"
      titulo="Enviar termos por e-mail"
      subtitulo={`${aptas.length} termo(s) · ${competenciaRotulo(competencia)}`}
      onFechar={onFechar}
      bloqueado={Boolean(gravando)}
      rodape={(
        <>
          <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={Boolean(gravando)}>Cancelar</button>
          <button type="button" className="btn btn-outline" onClick={soRegistrar} disabled={Boolean(gravando) || !aptas.length}
            title="Marca como enviado sem mandar e-mail (termo enviado por fora do portal)">
            <CheckCircle2 size={16} /> {gravando === 'registro' ? 'Registrando…' : 'Só registrar'}
          </button>
          <button type="button" className="btn btn-primary" onClick={enviar} disabled={Boolean(gravando) || !comEmail}>
            <Mail size={16} /> {gravando === 'email' ? 'Enviando…' : `Enviar ${comEmail} e-mail(s)`}
          </button>
        </>
      )}
    >
      <div className="pj-folha-pilha">
        <Aviso tipo="info">
          Cada prestador recebe um e-mail só com o próprio termo. As respostas vão para o e-mail do Financeiro.
        </Aviso>
        {!aptas.length && <Aviso tipo="alerta">Nenhum termo selecionado está gerado e pendente de envio.</Aviso>}
        {aptas.length < linhas.length && aptas.length > 0 && (
          <Aviso tipo="alerta">{linhas.length - aptas.length} envelope(s) ficaram de fora: termo não gerado ou já enviado.</Aviso>
        )}
        {semEmail.length > 0 && (
          <Aviso tipo="alerta">{semEmail.length} prestador(es) sem e-mail válido no cadastro não vão receber: {semEmail.map((l) => l.pessoa.nome).join(', ')}.</Aviso>
        )}

        <div className="pj-pares">
          <div className="pj-par"><small>Assunto</small><b>{assunto}</b></div>
          <div className="pj-par"><small>Cópia</small><b>{copias.length ? copias.join(', ') : 'Sem cópia'}</b></div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Prestador</th><th>E-mail</th><th className="pj-direita">Líquido</th></tr>
            </thead>
            <tbody>
              {aptas.map((l) => (
                <tr key={l.envelope.id}>
                  <td>{l.pessoa.nome}<div className="pj-sub">{l.pessoa.codigo}</div></td>
                  <td>{l.pessoa.email || <span className="pj-sub">sem e-mail</span>}</td>
                  <td className="pj-direita"><Moeda valor={l.envelope.liquido} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
      </div>
    </Modal>
  );
}
