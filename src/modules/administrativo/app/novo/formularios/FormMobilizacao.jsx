import { useEffect, useState } from 'react';
import SearchSelect from '../../../../../components/UI/SearchSelect';
import Marcador from './Marcador';
import CampoCentroCusto from '../CampoCentroCusto';
import {
  MOVIMENTOS, OUTRO_PROJETO, eDesmobilizacao, eInclusaoTreinamento, eMovimentacao,
  aoTrocarMovimento, codCt,
} from './mobilizacao';
import { dadosDaUltimaMobilizacao, ondeEstaHoje } from '../../../lib/chamados';
import { codigoCt, contatoDoCliente } from '../../../../mobilizacao/lib/painelEtapas';
import { OPCOES_EQUIPAMENTO, OPCOES_SOFTWARE, OPCOES_EPI } from './opcoes';
import { mascaraTelefone } from '../../../../../utils/phoneMask';

export default function FormMobilizacao({
  valores, onChange, pessoas = [], projetos = [], opcoesCc = [],
}) {
  const [aberto, setAberto] = useState('');
  const mexer = (patch) => onChange({ ...valores, ...patch });
  const desmob = eDesmobilizacao(valores);
  // Inclusão de treinamento: a pessoa já está mobilizada, então projeto, data
  // de início e adicionais não se aplicam — só quem, onde e quais treinamentos.
  const treino = eInclusaoTreinamento(valores);
  const movimentacao = eMovimentacao(valores);

  // Movimentação: de onde a pessoa sai. undefined = carregando; null = sem
  // mobilização finalizada registrada.
  // Guarda junto o id consultado: trocar de profissional volta a "carregando"
  // sem setState no corpo do efeito.
  const [consulta, setConsulta] = useState({ id: null, dados: null });
  useEffect(() => {
    if (!movimentacao || !valores.profissional_id) return undefined;
    let vivo = true;
    const id = valores.profissional_id;
    ondeEstaHoje(id).then((dados) => { if (vivo) setConsulta({ id, dados }); });
    return () => { vivo = false; };
  }, [movimentacao, valores.profissional_id]);
  const origem = consulta.id === valores.profissional_id ? consulta.dados : undefined;

  // Escolher o profissional já traz o gestor do organograma — é o mesmo dado
  // que decide quem aprova o chamado, então digitar à mão só criaria divergência.
  const escolherProfissional = (id) => {
    const p = pessoas.find((x) => x.id === id);
    mexer({
      profissional_id: id,
      profissional: p?.nome || '',
      gestor: p?.superior_nome || '',
    });
  };

  const opcoesPessoas = pessoas.map((p) => ({ value: p.id, label: p.rotulo || p.nome }));
  // Cliente junto do nome: várias obras se chamam parecido e o cliente é o que
  // separa uma da outra na hora de escolher.
  const opcoesProjetos = [
    ...projetos.map((p) => ({ value: p.id, label: p.cliente ? `${p.nome} — ${p.cliente}` : p.nome })),
    // Obra recém-fechada que ainda não está cadastrada não pode travar a
    // mobilização: quem não acha na lista escreve o nome.
    { value: OUTRO_PROJETO, label: 'Não está na lista — digitar o nome' },
  ];
  const projetoForaDaLista = valores.projeto_id === OUTRO_PROJETO;

  // O local e o cliente vêm da última mobilização do mesmo CT (pedido da
  // Edijane, 05/10/2026). Só preenche o que está vazio: o que a pessoa já
  // digitou vale mais que o histórico.
  const preencherPeloCt = async (base, projeto) => {
    const d = await dadosDaUltimaMobilizacao(codCt(projeto));
    if (!d) return;
    const patch = {};
    for (const [campo, valor] of [
      ['local_obra', d.local_obra], ['cliente', d.cliente_phd],
      ['cliente_final', d.cliente_final], ['empresa_phd', d.empresa_phd],
    ]) {
      if (valor && !base[campo]?.trim()) patch[campo] = valor;
    }
    if (Object.keys(patch).length) onChange({ ...base, ...patch });
  };

  const escolherProjeto = (id) => {
    if (id === OUTRO_PROJETO) return mexer({ projeto_id: OUTRO_PROJETO, projeto: '' });
    const p = projetos.find((x) => x.id === id);
    const novo = { ...valores, projeto_id: id, projeto: p?.nome || '' };
    onChange(novo);
    return preencherPeloCt(novo, novo.projeto);
  };
  const alternar = (chave) => setAberto((a) => (a === chave ? '' : chave));

  // Sem cartão próprio: os campos entram no mesmo cartão do resto do chamado,
  // senão a tela vira dois formulários empilhados.
  return (
    <>
      <div className="adm-campo">
        <label>O que você precisa?<span className="req">*</span></label>
        <div className="adm-radios">
          {MOVIMENTOS.map((m) => (
            <button
              key={m}
              type="button"
              className={`adm-chip ${valores.movimento === m ? 'is-on' : ''}`}
              onClick={() => onChange(aoTrocarMovimento(valores, m))}
              aria-pressed={valores.movimento === m}
            >
              {m}
            </button>
          ))}
        </div>
        <span className="adm-campo-dica">É o que vira o assunto do chamado.</span>
      </div>

      <div className="adm-campo">
        <label>Profissional<span className="req">*</span></label>
        <SearchSelect
          value={valores.profissional_id}
          onChange={escolherProfissional}
          options={opcoesPessoas}
          placeholder="Busque pelo nome…"
          ariaLabel={desmob ? 'Profissional a desmobilizar' : 'Profissional a mobilizar'}
        />
        <span className="adm-campo-dica">
          Se ele estiver de Folga de Campo ou em Ausência Programada, o chamado mostra o período
          e o prazo começa a contar na volta dele.
        </span>
      </div>

      {movimentacao && valores.profissional_id && <OndeEstaHoje origem={origem} />}

      {movimentacao && valores.profissional_id && (
        <>
          <div className="adm-campo">
            <label>Precisa de processo de desmobilização?<span className="req">*</span></label>
            <SimNao valor={valores.precisa_desmob} onChange={(v) => mexer({ precisa_desmob: v })} />
            <span className="adm-campo-dica">
              Se sim, um chamado de Desmobilização é aberto junto, para a obra de onde ele sai.
            </span>
          </div>

          {valores.precisa_desmob === 'sim' && (
            <>
              <div className="adm-campo">
                <label htmlFor="mob-desmob-data">Data da desmobilização<span className="req">*</span></label>
                <input id="mob-desmob-data" type="date" className="adm-input" value={valores.desmob_data}
                  onChange={(e) => mexer({ desmob_data: e.target.value })} />
              </div>

              <div className="adm-campo">
                <label>Possui crachá?<span className="req">*</span></label>
                <SimNao valor={valores.desmob_possui_cracha}
                  onChange={(v) => mexer({ desmob_possui_cracha: v, desmob_cracha_entregue: v === 'sim' ? valores.desmob_cracha_entregue : '' })} />
              </div>

              {valores.desmob_possui_cracha === 'sim' && (
                <div className="adm-campo">
                  <label>O crachá foi entregue ao cliente?<span className="req">*</span></label>
                  <SimNao valor={valores.desmob_cracha_entregue}
                    onChange={(v) => mexer({ desmob_cracha_entregue: v })} />
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Projeto logo depois do profissional (pedido de 27/10/2026): é dele que
          sai o Código CT do processo, e escolhê-lo cedo já preenche obra e
          cliente pela última mobilização do mesmo CT. */}
      {!desmob && !treino && (
        <>
          <div className="adm-campo">
            <label>Projeto<span className="req">*</span></label>
            <SearchSelect
              value={valores.projeto_id}
              onChange={escolherProjeto}
              options={opcoesProjetos}
              placeholder="Busque pelo projeto ou cliente…"
              ariaLabel="Projeto em que o profissional será alocado"
            />
            <span className="adm-campo-dica">
              {!valores.projeto
                ? 'Onde o profissional vai trabalhar. É dele que sai o Código CT do processo.'
                : codCt(valores.projeto)
                  ? <>Código CT do processo: <strong>{valores.projeto}</strong></>
                  : 'Este projeto não tem Código CT no nome (ex.: GERD-CT14-PIND): o processo nasce sem ele.'}
            </span>
          </div>

          {projetoForaDaLista && (
            <div className="adm-campo">
              <label htmlFor="mob-projeto-nome">Nome do projeto<span className="req">*</span></label>
              <input id="mob-projeto-nome" className="adm-input" value={valores.projeto}
                onChange={(e) => mexer({ projeto: e.target.value })}
                onBlur={() => preencherPeloCt(valores, valores.projeto)}
                placeholder="Ex.: GERD-CT14-PIND" />
            </div>
          )}
        </>
      )}

      {/* Desmobilização pede só quem sai e o que devolve — o resto (obra, CC,
          data, adicionais) não se aplica e sumir é melhor que desabilitar. */}
      {desmob && (
        <>
          <div className="adm-campo">
            <label className="adm-check">
              <input type="checkbox" checked={valores.devolucao}
                onChange={(e) => mexer({ devolucao: e.target.checked })} />
              Há devolução de equipamentos ou materiais
            </label>
          </div>
          {valores.devolucao && (
            <div className="adm-campo">
              <label htmlFor="mob-dev">O que será devolvido<span className="req">*</span></label>
              <textarea id="mob-dev" className="adm-textarea adm-textarea-curto"
                value={valores.devolucao_descricao}
                onChange={(e) => mexer({ devolucao_descricao: e.target.value })} />
            </div>
          )}

          {/* Data-base do processo de desmobilização. Sem ela nenhum passo
              ganha prazo, e o quadro nasce inteiro sem semáforo. */}
          <div className="adm-campo">
            <label htmlFor="mob-data-desmob">Data da desmobilização<span className="req">*</span></label>
            <input id="mob-data-desmob" type="date" className="adm-input"
              value={valores.data_desmobilizacao}
              onChange={(e) => mexer({ data_desmobilizacao: e.target.value })} />
            <span className="adm-campo-dica">
              Quando o profissional deixa a obra. É dela que partem os prazos do processo.
            </span>
          </div>
        </>
      )}

      {!desmob && (
        <>

      <div className="adm-campo">
        <label htmlFor="mob-gestor">Gestor</label>
        <input id="mob-gestor" className="adm-input" value={valores.gestor}
          onChange={(e) => mexer({ gestor: e.target.value })}
          placeholder="Preenchido pelo organograma ao escolher o profissional" />
      </div>

      {/* Cliente e empresa alimentam o processo de Mobilização que nasce deste
          chamado — é por eles que o time filtra o quadro e a torre. */}
      <div className="adm-campo">
        <label htmlFor="mob-cliente">Cliente<span className="req">*</span></label>
        <input id="mob-cliente" className="adm-input" value={valores.cliente}
          onChange={(e) => mexer({ cliente: e.target.value })}
          placeholder="Quem nos contratou (ex.: IMC SASTE)" />
      </div>

      <div className="adm-campo">
        <label htmlFor="mob-cliente-final">Cliente final</label>
        <input id="mob-cliente-final" className="adm-input" value={valores.cliente_final}
          onChange={(e) => mexer({ cliente_final: e.target.value })}
          placeholder="O dono da obra, quando é outro (ex.: VALE)" />
      </div>

      <div className="adm-campo">
        <label htmlFor="mob-empresa">Empresa PHD</label>
        <input id="mob-empresa" className="adm-input" value={valores.empresa_phd}
          onChange={(e) => mexer({ empresa_phd: e.target.value })}
          placeholder="PHD ENGENHARIA, PHD ASSESSORIA ou PJ" />
      </div>

      <CampoCentroCusto id="mob-cc" valor={valores.cc} opcoes={opcoesCc}
        onChange={(v) => mexer({ cc: v })} />

      {treino && (
        <div className="adm-campo">
          <label htmlFor="mob-treinamentos">Treinamentos a incluir<span className="req">*</span></label>
          <textarea id="mob-treinamentos" className="adm-textarea adm-textarea-curto"
            value={valores.treinamentos}
            onChange={(e) => mexer({ treinamentos: e.target.value })}
            placeholder="Ex.: RAC 04 e PRO" />
          <span className="adm-campo-dica">
            O processo acompanha agendamento, realização, novo ASO (quando precisar), postagem no SGC,
            aprovação do cliente e liberação do passaporte.
          </span>
        </div>
      )}


      <div className="adm-campo">
        <label htmlFor="mob-obra">Local da obra{!treino && <span className="req">*</span>}</label>
        <input id="mob-obra" className="adm-input" value={valores.local_obra}
          onChange={(e) => mexer({ local_obra: e.target.value })} />
      </div>

      {!treino && (
        <>
      <div className="adm-campo">
        <label htmlFor="mob-data">Data de início no cliente<span className="req">*</span></label>
        <input id="mob-data" type="date" className="adm-input" value={valores.data_inicio_cliente}
          onChange={(e) => mexer({ data_inicio_cliente: e.target.value })} />
      </div>

      <div className="adm-campo">
        <label>Adicionais</label>
        {/* Exames e treinamentos não entram aqui de propósito: são tratados no
            sistema do RH e só se definem na assinatura do contrato. Dizer isso
            evita que alguém procure o campo e abra outro chamado por causa. */}
        <span className="adm-campo-dica">
          Marque só o que este profissional precisa — tudo aqui é opcional, e quem já é da casa
          costuma usar o que tem. Exames e treinamentos não entram nesta lista: são tratados
          pelo RH na assinatura do contrato.
        </span>
        <div className="adm-marcadores">
          <Marcador titulo="Equipamento e acessórios" itens={OPCOES_EQUIPAMENTO}
            valor={valores.equipamentos} onChange={(v) => mexer({ equipamentos: v })}
            aberto={aberto === 'equip'} onToggle={() => alternar('equip')} />
          <Marcador titulo="Software" itens={OPCOES_SOFTWARE}
            valor={valores.softwares} onChange={(v) => mexer({ softwares: v })}
            aberto={aberto === 'soft'} onToggle={() => alternar('soft')} />
          <Marcador titulo="EPI" itens={OPCOES_EPI}
            valor={valores.epis} onChange={(v) => mexer({ epis: v })}
            aberto={aberto === 'epi'} onToggle={() => alternar('epi')} />
          <Marcador titulo="Uniforme" textoLivre
            dica="A lista de uniformes ainda não está cadastrada no portal — descreva as peças e os tamanhos."
            placeholder="Ex.: 2 camisas polo M, 1 blusão G"
            valor={valores.uniforme} onChange={(v) => mexer({ uniforme: v })}
            aberto={aberto === 'unif'} onToggle={() => alternar('unif')} />
        </div>
      </div>
        </>
      )}

      {/* Contato do setor do cliente: quem o Adm procura na obra. */}
      <div className="adm-campo">
        <label htmlFor="mob-contato-nome">Nome do contato no cliente<span className="req">*</span></label>
        <input id="mob-contato-nome" className="adm-input" value={valores.contato_nome}
          onChange={(e) => mexer({ contato_nome: e.target.value })} />
      </div>

      <div className="adm-campo">
        <label htmlFor="mob-contato-tel">Telefone do contato<span className="req">*</span></label>
        <input id="mob-contato-tel" className="adm-input" type="tel" inputMode="tel"
          value={valores.contato_telefone} placeholder="(31) 9 9999-9999"
          onChange={(e) => mexer({ contato_telefone: mascaraTelefone(e.target.value) })} />
      </div>

      <div className="adm-campo">
        <label htmlFor="mob-contato-email">E-mail do contato<span className="req">*</span></label>
        <input id="mob-contato-email" className="adm-input" type="email" inputMode="email"
          value={valores.contato_email} placeholder="nome@cliente.com.br"
          onChange={(e) => mexer({ contato_email: e.target.value })} />
      </div>
        </>
      )}
    </>
  );
}

// Sim/Não em botões, como o seletor de movimento: duas opções não pedem lista.
function SimNao({ valor, onChange }) {
  return (
    <div className="adm-radios">
      {[['sim', 'Sim'], ['nao', 'Não']].map(([v, rotulo]) => (
        <button key={v} type="button" className={`adm-chip ${valor === v ? 'is-on' : ''}`}
          aria-pressed={valor === v} onClick={() => onChange(v)}>
          {rotulo}
        </button>
      ))}
    </div>
  );
}

// De onde a pessoa sai, só para leitura: é o que a desmobilização vai herdar.
function OndeEstaHoje({ origem }) {
  if (origem === undefined) {
    return <div className="adm-campo"><span className="adm-campo-dica">Buscando onde ele está hoje…</span></div>;
  }
  if (!origem) {
    return (
      <div className="adm-campo">
        <label>Onde está hoje</label>
        <span className="adm-campo-dica">Nenhuma mobilização finalizada registrada para este profissional.</span>
      </div>
    );
  }
  const contato = contatoDoCliente(origem);
  const linhas = [
    ['Cliente', [origem.cliente_phd, origem.cliente_final !== origem.cliente_phd && origem.cliente_final]
      .filter(Boolean).join(' · ')],
    ['Local da obra', origem.local_obra],
    ['Código CT', codigoCt(origem)],
    ['Contato no cliente', (contato.nome || contato.telefone || contato.email) && (
      <span className="adm-onde-esta-contato">
        {[contato.nome, contato.telefone, contato.email].filter(Boolean)
          .map((linha) => <span key={linha} title={linha}>{linha}</span>)}
      </span>
    )],
  ];
  return (
    <div className="adm-campo">
      <label>Onde está hoje</label>
      <dl className="adm-onde-esta">
        {linhas.map(([rot, val]) => (
          <div key={rot}><dt>{rot}</dt><dd>{val || '—'}</dd></div>
        ))}
      </dl>
      <span className="adm-campo-dica">Da mobilização #{origem.numero}. É daqui que ele sai.</span>
    </div>
  );
}
