import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { useFechamentoPj } from '../components/contexto';
import { Modal, Aviso, Carregando } from '../components/ui';
import { dataBr, dataExtenso, valorComExtenso, numeroExtenso, mascararCnpj, fmtBRL } from '../../lib/formato';
import { auditar, envelopesDoPrestador } from '../../lib/dados';
import { totaisEventos, EVENTO_BRUTO } from '../../lib/calculo';

const CONTRATANTE = {
  nome: 'PHD ASSESSORIA EM GESTÃO LTDA',
  cnpj: '45.420.053/0001-08',
  endereco: 'Rua Jurupari, 210 - 2º andar – Santa Lúcia – Belo Horizonte – Minas Gerais – CEP 30.350-590',
};

const ou = (v, alternativa = '[não informado]') => (String(v ?? '').trim() ? v : alternativa);

function enderecoContratada(p) {
  const rua = [p.tipo_logradouro, p.logradouro].filter(Boolean).join(' ');
  const partes = [
    [rua, p.numero].filter(Boolean).join(', '),
    p.complemento,
    p.bairro,
    [p.municipio, p.uf].filter(Boolean).join(' - '),
    p.cep && `CEP ${p.cep}`,
  ].filter(Boolean);
  return partes.length ? partes.join(' – ') : '[endereço não informado]';
}

// '50% (cinquenta por cento)'. Percentual quebrado sai só em número, que por
// extenso viraria aproximação.
function percentualExtenso(v) {
  const n = Number(v) || 0;
  return Number.isInteger(n) ? `${n}% (${numeroExtenso(n)} por cento)` : `${String(n).replace('.', ',')}%`;
}

const ROMANOS = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'];

// Verbas do acerto na ordem em que o instrumento as enumera: '(i) ...; e (ii) ...'.
function listarVerbas(verbas) {
  const itens = verbas.map((texto, i) => `(${ROMANOS[i] || i + 1}) ${texto}`);
  if (itens.length <= 1) return itens.join('');
  return `${itens.slice(0, -1).join('; ')}; e ${itens[itens.length - 1]}`;
}

const ehIndenizacao = (e) => /INDENIZ/i.test(e.descricao || '');

// Texto de cada provento do envelope. O 1000 e a indenização têm redação
// própria no termo; os demais saem com a descrição do evento.
function textoProvento(e, envelope, encerramento) {
  const valor = valorComExtenso(e.valor);
  if (e.codigo === EVENTO_BRUTO) {
    const dias = envelope.proporcional_motivo ? `, proporcional a ${envelope.dias_ativos ?? '—'}/${envelope.divisor ?? '—'} dias` : '';
    return `${valor} referente à remuneração dos serviços prestados no período${dias}`;
  }
  if (ehIndenizacao(e) && encerramento.indenizacao_percentual) {
    return `${valor} referente à indenização de ${percentualExtenso(encerramento.indenizacao_percentual)} do valor mensal, `
      + 'conforme estipulado no Parágrafo Segundo da Cláusula Segunda do Contrato originário';
  }
  return `${valor} a título de ${e.descricao}`;
}

/**
 * Termo de encerramento de parceria e quitação. Os valores saem do envelope da
 * competência do encerramento (o mesmo que vai para o pagamento), e não da foto
 * gravada no registro do encerramento, que não acompanha lançamentos feitos depois.
 */
export default function Distrato({ encerramento, prestador, onFechar }) {
  const { notificar } = useFechamentoPj();
  const [carga, setCarga] = useState({ carregando: true, erro: '', envelope: null });

  useEffect(() => {
    let vivo = true;
    envelopesDoPrestador(prestador.id)
      .then((lista) => {
        if (vivo) setCarga({ carregando: false, erro: '', envelope: lista.find((e) => e.competencia === encerramento.competencia) || null });
      })
      .catch((e) => { if (vivo) setCarga({ carregando: false, erro: e.message, envelope: null }); });
    return () => { vivo = false; };
  }, [prestador.id, encerramento.competencia]);

  const { envelope } = carga;
  const eventos = (envelope?.eventos || [])
    .map((e) => ({ ...e, valor: Number(e.valor) || 0 }))
    .filter((e) => e.valor)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const proventos = eventos.filter((e) => e.natureza === 'provento');
  const listaDescontos = eventos.filter((e) => e.natureza === 'desconto');
  const { descontos, liquido } = totaisEventos(eventos);

  // Sem envelope, sem cálculo ou calculado antes do encerramento (ainda com o
  // mês cheio), o termo sairia com valor que não é o do pagamento.
  let bloqueio = '';
  if (carga.erro) bloqueio = carga.erro;
  else if (!carga.carregando && !envelope) {
    bloqueio = 'O prestador não tem envelope nesta competência. Inclua-o na Folha do mês e calcule antes de gerar o distrato.';
  } else if (envelope && !envelope.calculado_em) {
    bloqueio = 'O envelope desta competência ainda não foi calculado. Calcule-o na Folha do mês antes de gerar o distrato.';
  } else if (envelope && encerramento.registrado_em && envelope.calculado_em < encerramento.registrado_em) {
    bloqueio = 'O envelope foi calculado antes do registro do encerramento. Recalcule-o na Folha do mês antes de gerar o distrato.';
  }

  const alertas = [];
  const indenizacaoRegistrada = Number(encerramento.valor_indenizacao) || 0;
  if (envelope && indenizacaoRegistrada > 0 && !proventos.some(ehIndenizacao)) {
    alertas.push(`O encerramento prevê indenização de ${fmtBRL(indenizacaoRegistrada)}, mas o envelope não tem esse provento. `
      + 'O distrato sai só com o que está no envelope: lance a indenização no envelope para ela entrar no termo e no pagamento.');
  }
  if (envelope && liquido < 0) alertas.push('Os descontos do envelope passam dos proventos: o valor total do termo ficou negativo.');

  const verbas = envelope ? proventos.map((e) => textoProvento(e, envelope, encerramento)) : [];
  const detalheDescontos = listaDescontos.map((e) => `${e.descricao} (${fmtBRL(e.valor)})`).join('; ');

  const razaoSocial = ou(prestador.razao_social, '[RAZÃO SOCIAL NÃO INFORMADA]');
  const cnpjContratada = prestador.cnpj ? mascararCnpj(prestador.cnpj) : '[não informado]';

  async function imprimir() {
    if (bloqueio || carga.carregando) return;
    window.print();
    try {
      await auditar('Distrato gerado', `${prestador.nome} • encerramento em ${dataBr(encerramento.data_encerramento)}`,
        { competencia: encerramento.competencia, prestadorId: prestador.id });
    } catch (e) {
      notificar(e.message, 'erro');
    }
  }

  return (
    <Modal titulo="Prévia do distrato" subtitulo={prestador.nome} largura="lg" onFechar={onFechar}
      rodape={(
        <>
          <button type="button" className="btn btn-ghost" onClick={onFechar}>Fechar</button>
          <button type="button" className="btn btn-primary" onClick={imprimir} disabled={Boolean(bloqueio) || carga.carregando}>
            <Printer size={18} /> Gerar PDF / Imprimir
          </button>
        </>
      )}>
      {carga.carregando && <Carregando texto="Carregando o envelope…" />}
      {bloqueio && <Aviso tipo="erro">{bloqueio}</Aviso>}
      {alertas.map((a) => <Aviso key={a} tipo="alerta">{a}</Aviso>)}
      {envelope && !bloqueio && (
      <div className="pj-documento pj-imprimir pjp-distrato">
        <h1>TERMO DE ENCERRAMENTO DE PARCERIA E QUITAÇÃO</h1>

        <h2>QUALIFICAÇÃO DAS PARTES</h2>
        <p>
          Para todos os efeitos legais, fica registrado abaixo, desde já, quem são as pessoas jurídicas envolvidas no
          negócio jurídico objeto deste TERMO DE ENCERRAMENTO DE PARCERIA E QUITAÇÃO (“Termo”), as quais prometem sempre
          agir conforme os preceitos éticos e de boa-fé da sociedade brasileira, por serem aplicadas as leis deste País.
        </p>
        <p>Figuram como PARTES:</p>
        <p>
          <b>{CONTRATANTE.nome}</b>, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº {CONTRATANTE.cnpj},
          com sede na {CONTRATANTE.endereco}, neste ato representada na forma de seu contrato social, doravante
          denominada <b>“CONTRATANTE”</b>.
        </p>
        <p>
          <b>{razaoSocial}</b>, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº {cnpjContratada}, com sede
          na {enderecoContratada(prestador)}, neste ato representada na forma de seu contrato social, doravante
          denominada <b>“CONTRATADA”</b>.
        </p>
        <p>
          As PARTES acima qualificadas, resolvem em comum acordo, ENCERRAR FORMALMENTE a parceria estabelecida entre
          elas, considerando o CONTRATO DE PRESTAÇÃO DE SERVIÇOS ESPECIALIZADOS (“Contrato”) firmado entre as PARTES
          em {prestador.data_inicio ? dataExtenso(prestador.data_inicio) : '[data não informada]'} como encerrado,
          declarando, para todos os fins, a regular quitação do referido Contrato, conforme as cláusulas e condições que
          vinculam as PARTES, por si e seus sucessores, os quais mutuamente outorgam e aceitam os termos que seguem.
        </p>

        <h2>CONDIÇÕES GERAIS</h2>

        <h2>CLÁUSULA PRIMEIRA – DO ENCERRAMENTO CONTRATUAL</h2>
        <p>
          As PARTES acordam pelo encerramento da relação jurídica outrora existente entre elas, a partir
          de {dataExtenso(encerramento.data_encerramento)} com a rescisão total do Contrato celebrado, o que se faz de
          forma amigável e consensual, sem quaisquer ônus ou penalidades para ambas as PARTES, declarando-se resolvido e
          extinto todo e qualquer vínculo jurídico e obrigacional existente entre elas no âmbito da relação ora
          encerrada.
        </p>
        <p>
          <b>Parágrafo Único:</b> as PARTES comprometem-se a excluir de forma imediata, definitiva e irreversível todas
          as informações, dados e materiais fornecidos pela outra parte que estejam armazenados em seus sistemas ou
          bancos de dados. Fica ressalvada a preservação dos dados estritamente necessários para o cumprimento de
          obrigações legais, nos termos da Lei nº 13.709/18 (Lei Geral de Proteção de Dados – LGPD).
        </p>

        <h2>CLÁUSULA SEGUNDA – QUITAÇÃO INTEGRAL</h2>
        <p>
          As PARTES se dão, reciprocamente, a mais ampla, plena, irrevogável e irretratável quitação, e de todo e
          qualquer aditamento a este relacionado, quer escrito ou verbal, inclusive quanto a possíveis ou eventuais
          execuções, multas, cobranças, restituições, reembolsos e indenizações a serem pagas, RESSALVADO o valor total
          de <b>{valorComExtenso(liquido)}</b>, que será pago pela CONTRATANTE à CONTRATADA
          {verbas.length > 0 && <>, composto pelas seguintes verbas: {listarVerbas(verbas)}</>}
          {descontos > 0 && <>, já deduzidos {valorComExtenso(descontos)} a título de descontos compensados no
            período: {detalheDescontos}</>}. O montante total será pago pela CONTRATANTE à CONTRATADA
          em {dataExtenso(encerramento.data_pagamento)}, mediante o envio da respectiva nota fiscal.
        </p>
        <p>
          <b>Parágrafo Primeiro:</b> as PARTES reconhecem que a relação que existia entre elas é de natureza cível,
          sendo unânime a completa não aplicabilidade dos dispositivos do Decreto-Lei nº 5.452/1943 (“Consolidação das
          Leis do Trabalho”).
        </p>
        <p>
          <b>Parágrafo Segundo:</b> as PARTES declaram estar cientes de que a presente relação não gerou qualquer tipo
          de vínculo empregatício entre a CONTRATANTE, os sócios, diretores, administradores, prepostos, seus
          funcionários e/ou terceiros contratados pela CONTRATADA, ainda que a atividade exercida por ele estivesse de
          qualquer forma relacionada ao negócio ou atividades realizadas pela CONTRATANTE.
        </p>

        <h2>CLÁUSULA TERCEIRA – DO SIGILO</h2>
        <p>
          As Partes se comprometem a manter sob sigilo e a não divulgar, sob qualquer forma ou meio, as informações
          técnicas, comerciais, jurídicas, financeiras, empresariais, estratégicas, tecnologias, métodos, documentos ou
          quaisquer outros tipos de informações relacionadas a este Termo, recebidos sob a forma verbal, escrita,
          gráfica, mecânica, eletrônica, digital, magnética ou qualquer outra forma, nos termos aqui estabelecidos,
          independentemente de estarem sinalizadas como sendo informações confidenciais.
        </p>
        <p>
          <b>Parágrafo Único:</b> as Partes se comprometem a manter sob sigilo as Informações Confidenciais às quais
          tiverem acesso em decorrência deste Termo e pelo prazo de 02 (dois) anos, contados a partir da data de
          assinatura deste Termo, sob pena de serem responsabilizados civilmente pelos prejuízos causados, sem prejuízo
          das sanções previstas neste Contrato.
        </p>

        <h2>CLÁUSULA QUARTA – DAS DISPOSIÇÕES GERAIS E FINAIS</h2>
        <p>
          Este Termo constitui o acordo integral entre as PARTES, substituindo e prevalecendo sobre todas as
          negociações, propostas, discussões, correspondências, acordos e entendimentos anteriores, seja de forma
          escrita ou verbal, no que se refere às questões objeto do Contrato celebrado.
        </p>
        <p>
          <b>Parágrafo Primeiro:</b> as PARTES declaram expressamente que leram o presente instrumento em todos os seus
          termos e concordam, por livre e espontânea manifestação de vontade, com todo o pactuado, declarando-se que as
          obrigações ora prescritas são manifestamente proporcionais e que o presente Termo se faz livre de defeitos que
          viciam a manifestação de vontade.
        </p>
        <p>
          <b>Parágrafo Segundo:</b> a invalidade ou anulação de qualquer disposição do presente Termo não afetará as
          demais disposições, as quais permanecerão em pleno vigor e efeito durante o seu termo.
        </p>
        <p>
          <b>Parágrafo Terceiro:</b> as disposições do presente Termo, que é irrevogável e irretratável, obrigam e
          vinculam não só as PARTES, mas também seus herdeiros ou sucessores, a qualquer título.
        </p>
        <p>
          <b>Parágrafo Quarto:</b> as Partes elegem o foro da comarca de Belo Horizonte/MG para dirimir quaisquer
          questões relativas a este Termo, com renúncia de qualquer outro, por mais privilegiado que possa vir a ser.
        </p>
        <p>
          <b>Parágrafo Quinto:</b> as PARTES, inclusive suas testemunhas, reconhecem a forma de contratação por meios
          eletrônicos, digitais e informáticos como válida e plenamente eficaz, conforme disposto pelo art. 10 da Medida
          Provisória nº 2.200/2001 em vigor no Brasil. Portanto, o presente Termo pode ser firmado pelo referido meio.
        </p>

        {encerramento.observacao && <p><b>Observação:</b> {encerramento.observacao}</p>}

        <p>E por assim estarem de pleno acordo, assinam o presente Termo em 01 (uma) via digital.</p>
        <p>Belo Horizonte/MG, {dataExtenso(encerramento.data_calculo)}.</p>

        <p><b>PARTES</b></p>
        <div className="pjp-assinaturas pj-quebra-evitar">
          <div className="pjp-assinatura">
            {CONTRATANTE.nome}<br />CNPJ: {CONTRATANTE.cnpj}
          </div>
          <div className="pjp-assinatura">
            {razaoSocial}<br />{prestador.nome}<br />CNPJ: {cnpjContratada}
          </div>
        </div>
      </div>
      )}
    </Modal>
  );
}
