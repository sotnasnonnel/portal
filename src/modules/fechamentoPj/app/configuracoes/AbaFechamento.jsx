import { useState } from 'react';
import { Campo, Aviso } from '../components/ui';
import { paraNumero } from '../../lib/formato';
import { useFormConfig } from './useFormConfig';
import BarraSalvar from './BarraSalvar';

// Padrões da migration (pj_config).
const PADRAO = {
  empresa_padrao: 'PHD ASSESSORIA', base_proporcional: '30_dias', proporcional_admissao: true, proporcional_encerramento: true,
  indenizacao_percentual: '50', tolerancia_bruto: '0.01', cadastro_automatico: true, bloquear_termo_divergencia: true,
};

const derivar = (c) => ({
  empresa_padrao: c.empresa_padrao ?? PADRAO.empresa_padrao,
  base_proporcional: c.base_proporcional ?? PADRAO.base_proporcional,
  proporcional_admissao: c.proporcional_admissao ?? true,
  proporcional_encerramento: c.proporcional_encerramento ?? true,
  indenizacao_percentual: String(c.indenizacao_percentual ?? PADRAO.indenizacao_percentual),
  tolerancia_bruto: String(c.tolerancia_bruto ?? PADRAO.tolerancia_bruto),
  cadastro_automatico: c.cadastro_automatico ?? true,
  bloquear_termo_divergencia: c.bloquear_termo_divergencia ?? true,
});

function Chave({ checked, onChange, rotulo, explicacao }) {
  return (
    <label className="pj-cfg-chave">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span><strong>{rotulo}</strong><small>{explicacao}</small></span>
    </label>
  );
}

export default function AbaFechamento({ onSujo }) {
  const { form, setForm, set, sujo, salvando, salvar, descartar } = useFormConfig(derivar, { nomeAba: 'Fechamento', onSujo });
  const [erro, setErro] = useState('');

  const indenizacao = paraNumero(form.indenizacao_percentual);
  const tolerancia = paraNumero(form.tolerancia_bruto);

  async function gravar() {
    setErro('');
    if (!(indenizacao >= 0 && indenizacao <= 100)) { setErro('A indenização deve ficar entre 0 e 100%.'); return; }
    if (!(tolerancia >= 0)) { setErro('A tolerância do bruto não pode ser negativa.'); return; }
    await salvar({
      ...form, indenizacao_percentual: indenizacao, tolerancia_bruto: tolerancia,
    });
  }

  function restaurar() {
    if (!window.confirm('Carregar os valores padrão desta aba? Nada é gravado até você clicar em Salvar.')) return;
    setForm(PADRAO);
  }

  return (
    <div className="pj-cartao pj-cfg-aba">
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <div className="pj-secao-titulo">Empresa e proporcionalidade</div>
      <div className="pj-form-grid">
        <Campo rotulo="Empresa padrão" dica="Usada no cadastro de prestador novo (manual ou vindo da planilha).">
          <select className="form-select" value={form.empresa_padrao} onChange={(e) => set('empresa_padrao', e.target.value)}>
            <option value="PHD ASSESSORIA">PHD Assessoria</option>
            <option value="PHD ENGENHARIA">PHD Engenharia</option>
          </select>
        </Campo>
        <Campo rotulo="Base do cálculo proporcional"
          dica={form.base_proporcional === '30_dias' ? 'Mês comercial: todo mês vale 30 dias (dia 31 conta como 30).' : 'Divide pelos dias reais do mês (28 a 31).'}>
          <select className="form-select" value={form.base_proporcional} onChange={(e) => set('base_proporcional', e.target.value)}>
            <option value="30_dias">30 dias</option>
            <option value="dias_corridos">Dias corridos da competência</option>
          </select>
        </Campo>
        <Campo rotulo="Indenização contratual (%)" dica="Percentual do valor mensal pago no encerramento, quando marcado.">
          <input className="form-input" inputMode="decimal" value={form.indenizacao_percentual}
            onChange={(e) => set('indenizacao_percentual', e.target.value)} />
        </Campo>
        <Campo rotulo="Tolerância do bruto (R$)" dica="Diferença aceita entre o bruto da planilha e o valor contratual antes de virar divergência.">
          <input className="form-input" inputMode="decimal" value={form.tolerancia_bruto}
            onChange={(e) => set('tolerancia_bruto', e.target.value)} />
        </Campo>
      </div>

      <div className="pj-cfg-chaves">
        <Chave checked={form.proporcional_admissao} onChange={(v) => set('proporcional_admissao', v)}
          rotulo="Proporcional na admissão" explicacao="Quem começa no meio do mês recebe só os dias trabalhados." />
        <Chave checked={form.proporcional_encerramento} onChange={(v) => set('proporcional_encerramento', v)}
          rotulo="Proporcional no encerramento"
          explicacao="Quem sai no meio do mês recebe só os dias trabalhados. Encerramento registrado sempre gera proporcional." />
      </div>

      <div className="pj-secao-titulo">Regras automáticas</div>
      <div className="pj-cfg-chaves">
        <Chave checked={form.cadastro_automatico} onChange={(v) => set('cadastro_automatico', v)}
          rotulo="Cadastrar prestador novo no input da folha"
          explicacao="Linha da planilha sem cadastro correspondente vira prestador novo. Desligado, a linha fica como pendência." />
        <Chave checked={form.bloquear_termo_divergencia} onChange={(v) => set('bloquear_termo_divergencia', v)}
          rotulo="Bloquear termo com divergência"
          explicacao="Envelope com divergência em aberto não gera termo até ser resolvido." />
      </div>

      <BarraSalvar sujo={sujo} salvando={salvando} onSalvar={gravar} onDescartar={descartar}>
        <button type="button" className="btn btn-ghost" onClick={restaurar} disabled={salvando}>Restaurar padrões</button>
      </BarraSalvar>
    </div>
  );
}
