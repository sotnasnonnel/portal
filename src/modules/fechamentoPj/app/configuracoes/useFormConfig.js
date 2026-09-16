import { useEffect, useMemo, useState } from 'react';
import { useFechamentoPj } from '../components/contexto';
import { salvarConfig, auditar } from '../../lib/dados';

/**
 * Formulário de uma aba de pj_config: estado local, indicador de alteração e
 * gravação explícita (nada de autosave). `derivar` tira da configuração os
 * campos da aba; `sujo` compara com o que está gravado — depois de salvar e
 * recarregar, volta a false sozinho.
 */
export function useFormConfig(derivar, { nomeAba, onSujo }) {
  const { config, recarregar, notificar } = useFechamentoPj();
  const gravado = useMemo(() => derivar(config || {}), [derivar, config]);
  const [form, setForm] = useState(gravado);
  const [salvando, setSalvando] = useState(false);

  const sujo = JSON.stringify(form) !== JSON.stringify(gravado);
  useEffect(() => { onSujo?.(sujo); }, [sujo, onSujo]);

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  async function salvar(patch, detalhe = nomeAba) {
    setSalvando(true);
    try {
      const linha = await salvarConfig(patch);
      // O banco devolve o valor normalizado (ex.: "50,5" vira 50.5): o form passa a refletir isso.
      setForm(derivar(linha));
      await auditar('Configuração alterada', detalhe);
      await recarregar();
      notificar(`${nomeAba}: configuração salva.`);
      return true;
    } catch (e) {
      notificar(e.message, 'erro');
      return false;
    } finally {
      setSalvando(false);
    }
  }

  return { form, setForm, set, sujo, salvando, salvar, descartar: () => setForm(gravado) };
}
