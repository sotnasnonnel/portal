import { Lock } from 'lucide-react';
import ErroCampo from './ErroCampo';
import { ariaDoErro } from '../../lib/errosDeCampo';

/**
 * Centro de custo — o mesmo campo em TODO formulário do módulo.
 *
 * Vem preenchido com o CC do aprovador (organograma) porque o gasto costuma
 * correr por conta de quem avaliza, mas nem sempre corre: quem abre o chamado
 * precisa poder destiná-lo a outra área na hora, em vez de abrir o pedido
 * errado e pedir ao Adm que corrija depois. Por isso é lista, e não campo
 * travado.
 *
 * A lista é FECHADA (as gerências do organograma) de propósito: texto livre foi
 * o que inviabilizou os relatórios por CC, porque cada pessoa escrevia o mesmo
 * centro de um jeito.
 *
 * Sem lista (a consulta falhou) o campo cai no comportamento antigo: travado
 * quando já veio preenchido, digitável quando não há nada a mostrar — melhor
 * isso do que um seletor vazio que impede abrir o chamado.
 */
export default function CampoCentroCusto({
  id = 'adm-cc', valor, onChange, opcoes = [], obrigatorio = true, erro = '',
}) {
  const atual = valor ?? '';
  const aria = ariaDoErro('cc', erro);
  const rotulo = (
    <label htmlFor={id}>
      Centro de custo
      {obrigatorio && <span className="req">*</span>}
    </label>
  );

  if (!opcoes.length) {
    if (!atual) {
      return (
        <div className="adm-campo adm-campo-meia">
          {rotulo}
          <input id={id} className="adm-input" value={atual} aria-required={obrigatorio} {...aria}
            onChange={(e) => onChange(e.target.value)} />
          <ErroCampo chave="cc" msg={erro} />
        </div>
      );
    }
    return (
      <div className="adm-campo adm-campo-meia">
        {rotulo}
        <div className="adm-travado">
          <input id={id} className="adm-input" value={atual} readOnly tabIndex={-1} />
          <Lock size={15} aria-hidden="true" />
        </div>
        <span className="adm-campo-dica">Vem da sua gerência no organograma.</span>
      </div>
    );
  }

  // O CC que veio do organograma pode não estar na lista (gerência renomeada,
  // por exemplo). Entra na frente em vez de sumir de um campo já preenchido.
  const lista = atual && !opcoes.includes(atual) ? [atual, ...opcoes] : opcoes;

  return (
    <div className="adm-campo adm-campo-meia">
      {rotulo}
      <select id={id} className="adm-select" value={atual} aria-required={obrigatorio} {...aria}
        onChange={(e) => onChange(e.target.value)}>
        <option value="">Selecione…</option>
        {lista.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ErroCampo chave="cc" msg={erro} />
      <span className="adm-campo-dica">
        Vem da sua gerência no organograma — troque se o gasto for de outra área.
      </span>
    </div>
  );
}
