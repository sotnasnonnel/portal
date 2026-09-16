import { useState } from 'react';
import { Campo, Aviso } from '../components/ui';
import { RM_PADRAO } from '../../lib/totvs';
import { useFormConfig } from './useFormConfig';
import BarraSalvar from './BarraSalvar';

const CAMPOS = [
  ['coligada', 'Coligada', 'Código da coligada no RM (vai no TXT com 4 dígitos).'],
  ['filial', 'Filial', ''],
  ['tipoDocumento', 'Tipo de documento', ''], ['tipoDocumentoDesc', 'Descrição do tipo', ''],
  ['serie', 'Série', '3 caracteres no TXT.'],
  ['natureza', 'Natureza orçamentária', 'Formato 2.03.04.13.'], ['naturezaDesc', 'Descrição da natureza', ''],
  ['contaCaixa', 'Conta/Caixa', ''], ['contaCaixaDesc', 'Descrição da conta/caixa', ''],
  ['dadosBancarios', 'Dados bancários', ''], ['dadosBancariosDesc', 'Descrição dos dados bancários', ''],
];

const derivar = (c) => {
  const rm = { ...RM_PADRAO, ...(c.rm || {}) };
  return { ...Object.fromEntries(CAMPOS.map(([k]) => [k, String(rm[k] ?? '')])), diaEmissao: String(rm.diaEmissao ?? 28) };
};

export default function AbaParametrosRm({ onSujo }) {
  const { form, set, sujo, salvando, salvar, descartar } = useFormConfig(derivar, { nomeAba: 'Parâmetros TOTVS RM', onSujo });
  const [erro, setErro] = useState('');

  async function gravar() {
    setErro('');
    const vazio = CAMPOS.find(([k]) => !form[k].trim());
    if (vazio) { setErro(`Preencha: ${vazio[1]}.`); return; }
    if (!/^\d{1,2}$/.test(form.tipoDocumento.trim())) { setErro('O tipo de documento tem até 2 dígitos.'); return; }
    if (form.serie.trim().length > 3) { setErro('A série tem no máximo 3 caracteres.'); return; }
    if (form.natureza.trim().length > 12) { setErro('A natureza tem no máximo 12 caracteres.'); return; }
    const dia = Number(form.diaEmissao);
    // Até 28: o mesmo dia precisa existir em fevereiro.
    if (!Number.isInteger(dia) || dia < 1 || dia > 28) { setErro('O dia de emissão deve ser de 1 a 28.'); return; }
    const rm = { ...Object.fromEntries(CAMPOS.map(([k]) => [k, form[k].trim()])), diaEmissao: dia };
    await salvar({ rm });
  }

  return (
    <div className="pj-cartao pj-cfg-aba">
      <p className="pj-sub">Usados no TXT, no Excel de conferência e no CSV de pagamento. Mudar aqui muda o próximo arquivo gerado, inclusive de meses fechados.</p>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <div className="pj-form-grid">
        {CAMPOS.map(([k, rotulo, dica]) => (
          <Campo key={k} rotulo={rotulo} dica={dica || undefined} obrigatorio>
            <input className="form-input" value={form[k]} onChange={(e) => set(k, e.target.value)} />
          </Campo>
        ))}
        <Campo rotulo="Dia de emissão" dica="Emissão = este dia da competência; vencimento e baixa = dia 1 do mês seguinte." obrigatorio>
          <input className="form-input" inputMode="numeric" value={form.diaEmissao} onChange={(e) => set('diaEmissao', e.target.value)} />
        </Campo>
      </div>
      <BarraSalvar sujo={sujo} salvando={salvando} onSalvar={gravar} onDescartar={descartar} />
    </div>
  );
}
