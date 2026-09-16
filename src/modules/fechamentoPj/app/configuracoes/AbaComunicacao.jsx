import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useFechamentoPj } from '../components/contexto';
import { Campo, Aviso } from '../components/ui';
import { substituirAssunto } from '../../lib/calculo';
import { useFormConfig } from './useFormConfig';
import BarraSalvar from './BarraSalvar';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const derivar = (c) => ({
  email_financeiro: c.email_financeiro ?? '',
  copia_financeiro: c.copia_financeiro ?? true,
  modo_envio: c.modo_envio ?? 'individual',
  assunto_email: c.assunto_email ?? '',
  contatos_extras: (c.contatos_extras || []).map((x) => ({ nome: x.nome || '', email: x.email || '' })),
});

export default function AbaComunicacao({ onSujo }) {
  const { competencia } = useFechamentoPj();
  const { form, set, sujo, salvando, salvar, descartar } = useFormConfig(derivar, { nomeAba: 'Comunicação e termo', onSujo });
  const [erro, setErro] = useState('');

  const setContato = (i, campo, valor) => set('contatos_extras', form.contatos_extras.map((c, j) => (j === i ? { ...c, [campo]: valor } : c)));

  async function gravar() {
    setErro('');
    const email = form.email_financeiro.trim();
    if (email && !EMAIL.test(email)) { setErro('E-mail do Financeiro inválido.'); return; }
    if (form.copia_financeiro && !email) { setErro('Para copiar o Financeiro, informe o e-mail do Financeiro.'); return; }
    if (!form.assunto_email.trim()) { setErro('Informe o assunto do e-mail.'); return; }
    const contatos = form.contatos_extras
      .map((c) => ({ nome: c.nome.trim(), email: c.email.trim().toLowerCase() }))
      .filter((c) => c.nome || c.email);
    const invalido = contatos.find((c) => !EMAIL.test(c.email));
    if (invalido) { setErro(`E-mail inválido no contato ${invalido.nome || invalido.email || '(sem nome)'}.`); return; }
    if (new Set(contatos.map((c) => c.email)).size !== contatos.length) { setErro('Há contatos extras com o mesmo e-mail.'); return; }
    await salvar({
      email_financeiro: email, copia_financeiro: form.copia_financeiro, modo_envio: form.modo_envio,
      assunto_email: form.assunto_email.trim(), contatos_extras: contatos,
    });
  }

  return (
    <div className="pj-cartao pj-cfg-aba">
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <div className="pj-secao-titulo">Envio do termo</div>
      <div className="pj-form-grid">
        <Campo rotulo="E-mail do Financeiro" dica="Aparece no termo como destino da nota fiscal.">
          <input className="form-input" type="email" value={form.email_financeiro} onChange={(e) => set('email_financeiro', e.target.value)} />
        </Campo>
        {/* Sem "modo de envio": o portal manda sempre um e-mail por prestador
            (send-termo-pj). Um disparo único mostraria o valor de um para o outro. */}
        <Campo rotulo="Envio" dica="Um e-mail por prestador, só com o próprio termo.">
          <input className="form-input" value="E-mail individual" disabled />
        </Campo>
        <Campo rotulo="Assunto do e-mail" largura="total" dica="Use {{competencia}} para o mês do fechamento.">
          <input className="form-input" value={form.assunto_email} onChange={(e) => set('assunto_email', e.target.value)} />
        </Campo>
      </div>
      <div className="pj-cfg-previa">Prévia: <strong>{substituirAssunto(form.assunto_email, competencia) || '—'}</strong></div>
      <label className="pj-check">
        <input type="checkbox" checked={form.copia_financeiro} onChange={(e) => set('copia_financeiro', e.target.checked)} />
        Enviar cópia ao Financeiro
      </label>

      <div className="pj-secao-titulo">Contatos extras em cópia</div>
      {!form.contatos_extras.length && <p className="pj-sub">Nenhum contato extra. Quem estiver aqui recebe cópia de cada termo enviado.</p>}
      {form.contatos_extras.map((c, i) => (
        <div key={i} className="pj-cfg-contato">
          <input className="form-input" placeholder="Nome / descrição" value={c.nome} onChange={(e) => setContato(i, 'nome', e.target.value)} />
          <input className="form-input" type="email" placeholder="E-mail" value={c.email} onChange={(e) => setContato(i, 'email', e.target.value)} />
          <button type="button" className="btn btn-ghost btn-icon" aria-label="Remover contato"
            onClick={() => set('contatos_extras', form.contatos_extras.filter((_, j) => j !== i))}>
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <div>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => set('contatos_extras', [...form.contatos_extras, { nome: '', email: '' }])}>
          <Plus size={16} /> Adicionar contato
        </button>
      </div>

      <BarraSalvar sujo={sujo} salvando={salvando} onSalvar={gravar} onDescartar={descartar} />
    </div>
  );
}
