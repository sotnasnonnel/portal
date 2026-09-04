import { useState } from 'react';
import SearchSelect from '../../../../../components/UI/SearchSelect';
import Marcador from './Marcador';
import { MOVIMENTOS, OUTRO_PROJETO, eDesmobilizacao, aoTrocarMovimento } from './mobilizacao';
import { OPCOES_EQUIPAMENTO, OPCOES_SOFTWARE, OPCOES_EPI } from './opcoes';

export default function FormMobilizacao({ valores, onChange, pessoas = [], projetos = [] }) {
  const [aberto, setAberto] = useState('');
  const mexer = (patch) => onChange({ ...valores, ...patch });
  const desmob = eDesmobilizacao(valores);

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

  const opcoesPessoas = pessoas.map((p) => ({ value: p.id, label: p.nome }));
  // Cliente junto do nome: várias obras se chamam parecido e o cliente é o que
  // separa uma da outra na hora de escolher.
  const opcoesProjetos = [
    ...projetos.map((p) => ({ value: p.id, label: p.cliente ? `${p.nome} — ${p.cliente}` : p.nome })),
    // Obra recém-fechada que ainda não está cadastrada não pode travar a
    // mobilização: quem não acha na lista escreve o nome.
    { value: OUTRO_PROJETO, label: 'Não está na lista — digitar o nome' },
  ];
  const projetoForaDaLista = valores.projeto_id === OUTRO_PROJETO;

  const escolherProjeto = (id) => {
    if (id === OUTRO_PROJETO) return mexer({ projeto_id: OUTRO_PROJETO, projeto: '' });
    const p = projetos.find((x) => x.id === id);
    return mexer({ projeto_id: id, projeto: p?.nome || '' });
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
      </div>

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

      <div className="adm-campo">
        <label htmlFor="mob-cc">Centro de custo<span className="req">*</span></label>
        <input id="mob-cc" className="adm-input" value={valores.cc}
          onChange={(e) => mexer({ cc: e.target.value })} />
      </div>

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
          Onde o profissional vai trabalhar. A lista é a mesma dos projetos do portal.
        </span>
      </div>

      {projetoForaDaLista && (
        <div className="adm-campo">
          <label htmlFor="mob-projeto-nome">Nome do projeto<span className="req">*</span></label>
          <input id="mob-projeto-nome" className="adm-input" value={valores.projeto}
            onChange={(e) => mexer({ projeto: e.target.value })} />
        </div>
      )}

      <div className="adm-campo">
        <label htmlFor="mob-obra">Local da obra<span className="req">*</span></label>
        <input id="mob-obra" className="adm-input" value={valores.local_obra}
          onChange={(e) => mexer({ local_obra: e.target.value })} />
      </div>

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

      <div className="adm-campo">
        <label htmlFor="mob-contato">Contato do setor do cliente</label>
        <input id="mob-contato" className="adm-input" value={valores.contato_cliente}
          onChange={(e) => mexer({ contato_cliente: e.target.value })} />
      </div>
        </>
      )}
    </>
  );
}
