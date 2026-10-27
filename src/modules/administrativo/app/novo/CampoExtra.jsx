import { useState } from 'react';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import SearchSelect from '../../../../components/UI/SearchSelect';
import { buscarCep, cepValido, mascaraCep, soDigitosCep } from '../../../../services/cep';

// Tipos com desenho próprio. O que não estiver aqui cai no input de texto, para
// um tipo desconhecido (cadastro antigo, por exemplo) não sumir da tela.
const COM_DESENHO_PROPRIO = [
  'texto_longo', 'numero', 'data', 'hora', 'datahora', 'selecao', 'selecao_multipla', 'sim_nao', 'pessoa', 'cep',
];

/**
 * CEP que preenche o resto do endereço.
 *
 * Fechados os oito dígitos, a consulta sai sozinha — sem botão "buscar" e sem
 * esperar o blur: terminar de digitar o CEP já é o gesto de pedir o endereço.
 * O resultado vai nos campos irmãos (rua, bairro, cidade, estado) por `onPatch`,
 * e eles continuam EDITÁVEIS: o ViaCEP não conhece loteamento novo, e um
 * endereço quase certo que não se pode corrigir é pior que um campo vazio.
 *
 * Falha na consulta é recado, não trava: o pedido segue com o endereço à mão.
 */
function CampoCep({ campo, valor, onChange, onPatch }) {
  const id = `extra-${campo.chave}`;
  const [situacao, setSituacao] = useState('');   // '' | 'buscando' | 'ok'
  const [erro, setErro] = useState('');
  // Último CEP consultado. Sem isto, apagar e repor o hífen (ou sair e voltar
  // ao campo) refaz a consulta e sobrescreve a correção que a pessoa acabou de
  // digitar na rua.
  const [consultado, setConsultado] = useState('');

  // O campo não mudar sozinho é só o caso comum: trocar de serviço reinicia o
  // formulário por fora, e a memória da consulta sobreviveria à limpeza — o
  // mesmo CEP digitado de novo não buscaria nada. Reset durante o render, como
  // o React recomenda, em vez de um efeito atrás do valor.
  if (consultado && soDigitosCep(valor) !== consultado) setConsultado('');

  const consultar = async (bruto) => {
    const digitos = soDigitosCep(bruto);
    if (digitos.length !== 8 || digitos === consultado) return;
    setConsultado(digitos);
    setSituacao('buscando');
    setErro('');
    try {
      const endereco = await buscarCep(digitos);
      onPatch?.(endereco);
      setSituacao('ok');
    } catch (e) {
      setSituacao('');
      setErro(e.message);
      // Libera a mesma consulta de novo: quem errou foi a rede, não o CEP.
      setConsultado('');
    }
  };

  const digitar = (bruto) => {
    const mascarado = mascaraCep(bruto);
    onChange(campo.chave, mascarado);
    setSituacao('');
    setErro('');
    if (cepValido(mascarado)) consultar(mascarado);
  };

  return (
    <div className="adm-campo">
      <label htmlFor={id}>
        {campo.rotulo}
        {campo.obrigatorio && <span className="req">*</span>}
      </label>
      <span className="adm-cep">
        <input
          id={id}
          className="adm-input"
          type="text"
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="00000-000"
          maxLength={9}
          value={valor ?? ''}
          onChange={(e) => digitar(e.target.value)}
          // Rede de segurança para o CEP colado ou completado pelo navegador,
          // que nem sempre passa pelo onChange tecla a tecla.
          onBlur={(e) => consultar(e.target.value)}
        />
        {situacao === 'buscando' && <Loader2 size={15} className="adm-spin" aria-hidden="true" />}
        {situacao === 'ok' && <Check size={15} className="adm-cep-ok" aria-hidden="true" />}
      </span>
      {/* role="status" para o leitor de tela anunciar que o endereço chegou —
          quem não vê a tela não percebe quatro campos se preenchendo sozinhos. */}
      <span className="adm-campo-dica" role="status">
        {situacao === 'buscando' && 'Buscando o endereço…'}
        {situacao === 'ok' && 'Endereço preenchido pelo CEP. Confira e corrija se precisar.'}
        {!situacao && 'Rua, bairro, cidade e estado são preenchidos pelo CEP.'}
      </span>
      {erro && (
        <span className="adm-cep-erro">
          <AlertCircle size={13} aria-hidden="true" /> {erro}
        </span>
      )}
    </div>
  );
}

/**
 * Desenha um campo a partir da definição — venha ela do cadastro do Adm
 * (campos extras) ou do esquema em código de um serviço (schemas.js).
 *
 * É o ponto único de renderização de campo do módulo: assim os 22 serviços
 * ficam idênticos entre si sem ninguém precisar repetir estilo e marcação.
 *
 * `onPatch` troca VÁRIOS campos de uma vez — só o CEP precisa, por preencher os
 * irmãos dele. Quem renderiza um campo avulso pode não passar.
 */
export default function CampoExtra({ campo, valor, onChange, onPatch, pessoas = [] }) {
  const id = `extra-${campo.chave}`;
  const comum = {
    id,
    value: valor ?? '',
    onChange: (e) => onChange(campo.chave, e.target.value),
  };

  // Componente à parte porque tem estado próprio (a consulta em curso), e um
  // hook não pode nascer dentro do `if` de um tipo.
  if (campo.tipo === 'cep') {
    return <CampoCep campo={campo} valor={valor} onChange={onChange} onPatch={onPatch} />;
  }

  // Múltipla escolha tem marcação própria: são vários botões, e um <label
  // htmlFor> não aponta para um controle só. O grupo é rotulado pelo texto.
  if (campo.tipo === 'selecao_multipla') {
    const marcados = Array.isArray(valor) ? valor : [];
    const alternar = (o) => onChange(
      campo.chave,
      marcados.includes(o) ? marcados.filter((v) => v !== o) : [...marcados, o],
    );
    return (
      <div className="adm-campo" role="group" aria-labelledby={`${id}-rot`}>
        <span className="adm-campo-rotulo" id={`${id}-rot`}>
          {campo.rotulo}
          {campo.obrigatorio && <span className="req">*</span>}
        </span>
        <div className="adm-opcoes">
          {(campo.opcoes || []).map((o) => {
            const marcado = marcados.includes(o);
            return (
              <button
                key={o}
                type="button"
                className={`adm-chip ${marcado ? 'is-on' : ''}`}
                aria-pressed={marcado}
                onClick={() => alternar(o)}
              >
                {marcado && <Check size={13} />}
                {o}
              </button>
            );
          })}
        </div>
        <span className="adm-campo-dica">Pode marcar mais de um.</span>
      </div>
    );
  }

  return (
    <div className="adm-campo">
      <label htmlFor={id}>
        {campo.rotulo}
        {campo.obrigatorio && <span className="req">*</span>}
      </label>

      {campo.tipo === 'texto_longo' && <textarea className="adm-textarea adm-textarea-curto" {...comum} />}
      {campo.tipo === 'numero' && (campo.formato === 'moeda' ? (
        // Prefixo dentro do campo: o rótulo não precisa carregar "(R$)", e na
        // leitura o valor já sai formatado como moeda.
        <span className="adm-prefixado">
          <span className="adm-prefixo">R$</span>
          <input type="number" step="0.01" min="0" className="adm-input" {...comum} />
        </span>
      ) : (
        <input type="number" className="adm-input" {...comum} />
      ))}
      {campo.tipo === 'data' && <input type="date" className="adm-input" {...comum} />}
      {campo.tipo === 'hora' && <input type="time" className="adm-input" {...comum} />}
      {campo.tipo === 'datahora' && <input type="datetime-local" className="adm-input" {...comum} />}

      {/* Toda pessoa no módulo é escolhida do mesmo jeito: seletor com busca. */}
      {campo.tipo === 'pessoa' && (
        <SearchSelect
          value={valor ?? ''}
          onChange={(v) => onChange(campo.chave, v)}
          options={pessoas.map((p) => ({ value: p.id, label: p.rotulo || p.nome }))}
          placeholder="Busque pelo nome…"
          ariaLabel={campo.rotulo}
        />
      )}

      {campo.tipo === 'selecao' && (
        <select className="adm-select" {...comum}>
          <option value="">Selecione…</option>
          {(campo.opcoes || []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )}

      {campo.tipo === 'sim_nao' && (
        <select className="adm-select" {...comum}>
          <option value="">Selecione…</option>
          <option value="sim">Sim</option>
          <option value="nao">Não</option>
        </select>
      )}

      {!COM_DESENHO_PROPRIO.includes(campo.tipo) && (
        <input type="text" className="adm-input" {...comum} />
      )}
    </div>
  );
}
