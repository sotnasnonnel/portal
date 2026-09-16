import { Printer } from 'lucide-react';
import { useFechamentoPj } from '../components/contexto';
import { Modal } from '../components/ui';
import { dataBr, fmtBRL, round2, mascararCnpj, mascararCpf } from '../../lib/formato';
import { auditar } from '../../lib/dados';

const CONTRATANTE = {
  nome: 'PHD ASSESSORIA EM GESTÃO LTDA.',
  cnpj: '45.420.053/0001-08',
  endereco: 'Rua Jurupari, 210, 2º andar, bairro Santa Lúcia, Belo Horizonte/MG, CEP 30.350-590',
};

const ou = (v, alternativa = '[não informado]') => (String(v ?? '').trim() ? v : alternativa);

function enderecoContratada(p) {
  const rua = [p.tipo_logradouro, p.logradouro].filter(Boolean).join(' ');
  const partes = [
    [rua, p.numero].filter(Boolean).join(', '),
    p.complemento,
    p.bairro && `bairro ${p.bairro}`,
    [p.municipio, p.uf].filter(Boolean).join('/'),
    p.cep && `CEP ${p.cep}`,
  ].filter(Boolean);
  return partes.length ? partes.join(', ') : '[endereço não informado]';
}

/** Termo de encerramento de parceria e quitação, a partir do encerramento gravado. */
export default function Distrato({ encerramento, prestador, onFechar }) {
  const { notificar } = useFechamentoPj();
  const proporcional = Number(encerramento.valor_proporcional) || 0;
  const indenizacao = Number(encerramento.valor_indenizacao) || 0;
  const descontos = Number(encerramento.descontos) || 0;
  const liquido = round2(proporcional - descontos + indenizacao);

  async function imprimir() {
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
          <button type="button" className="btn btn-primary" onClick={imprimir}><Printer size={18} /> Gerar PDF / Imprimir</button>
        </>
      )}>
      <div className="pj-documento pj-imprimir pjp-distrato">
        <h1>TERMO DE ENCERRAMENTO DE PARCERIA E QUITAÇÃO</h1>

        <p>
          Pelo presente instrumento particular, de um lado <b>{CONTRATANTE.nome}</b>, inscrita no CNPJ sob o nº {CONTRATANTE.cnpj},
          com sede na {CONTRATANTE.endereco}, doravante denominada <b>CONTRATANTE</b>; e, de outro lado,
          {' '}<b>{ou(prestador.razao_social, '[RAZÃO SOCIAL NÃO INFORMADA]')}</b>, inscrita no CNPJ sob o
          nº {prestador.cnpj ? mascararCnpj(prestador.cnpj) : '[não informado]'}, com sede na {enderecoContratada(prestador)},
          neste ato representada por {prestador.nome}{prestador.cpf ? `, CPF ${mascararCpf(prestador.cpf)}` : ''}, doravante
          denominada <b>CONTRATADA</b>, resolvem, de comum acordo, firmar o presente Termo de Encerramento de Parceria e
          Quitação, que se regerá pelas cláusulas a seguir.
        </p>

        <h2>CLÁUSULA 1ª — DO ENCERRAMENTO</h2>
        <p>
          As partes dão por encerrado o contrato de prestação de serviços firmado entre si, com efeitos a partir
          de {dataBr(encerramento.data_encerramento)}, sendo {dataBr(encerramento.data_ultimo_movimento)} a data do último
          movimento de serviços. Motivo: {encerramento.motivo}. A partir desta data, a CONTRATANTE eliminará os dados pessoais
          da CONTRATADA e de seus representantes que não sejam necessários ao cumprimento de obrigações legais ou regulatórias,
          nos termos da Lei nº 13.709/2018 (Lei Geral de Proteção de Dados).
        </p>

        <h2>CLÁUSULA 2ª — DA QUITAÇÃO</h2>
        <p>
          Pelos serviços prestados no período, a CONTRATANTE pagará à CONTRATADA o valor líquido de <b>{fmtBRL(liquido)}</b>,
          correspondente a {fmtBRL(proporcional)} proporcionais a {encerramento.dias_ativos ?? '—'}/{encerramento.divisor ?? '—'} dias
          {indenizacao > 0 && <>, acrescidos de {fmtBRL(indenizacao)} a título de indenização contratual ({Number(encerramento.indenizacao_percentual) || 0}%)</>}
          {descontos > 0 && <>, deduzidos {fmtBRL(descontos)} de descontos já compensados</>}, em {dataBr(encerramento.data_pagamento)},
          mediante a emissão da respectiva nota fiscal. Com o pagamento, as partes outorgam-se mútua, plena, geral e irrevogável
          quitação quanto ao contrato encerrado, nada mais tendo a reclamar uma da outra, a qualquer título.
        </p>

        <h2>CLÁUSULA 3ª — DO SIGILO</h2>
        <p>
          A CONTRATADA obriga-se a manter sigilo sobre todas as informações técnicas, comerciais e estratégicas a que teve acesso
          em razão do contrato, pelo prazo de 2 (dois) anos contados da data de encerramento.
        </p>

        <h2>CLÁUSULA 4ª — DAS DISPOSIÇÕES GERAIS</h2>
        <p>
          Fica eleito o foro da Comarca de Belo Horizonte/MG para dirimir quaisquer questões oriundas deste termo, com renúncia a
          qualquer outro, por mais privilegiado que seja. As partes reconhecem a validade da assinatura eletrônica deste
          instrumento, nos termos da Medida Provisória nº 2.200-2/2001.
        </p>
        {encerramento.observacao && <p><b>Observação:</b> {encerramento.observacao}</p>}

        <p>Belo Horizonte/MG, {dataBr(encerramento.data_calculo)}.</p>

        <div className="pjp-assinaturas pj-quebra-evitar">
          <div className="pjp-assinatura">{CONTRATANTE.nome}<br />CONTRATANTE</div>
          <div className="pjp-assinatura">{ou(prestador.razao_social, prestador.nome)}<br />CONTRATADA</div>
          <div className="pjp-assinatura">Testemunha 1<br />Nome / CPF</div>
          <div className="pjp-assinatura">Testemunha 2<br />Nome / CPF</div>
        </div>
      </div>
    </Modal>
  );
}
