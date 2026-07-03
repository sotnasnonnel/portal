import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';

/** Botão "Baixar PDF" de uma requisição. Carrega o serviço por import dinâmico. */
export default function BotaoPdfRequisicao({ sol, nomeColaborador, nomeSolicitante, className = 'btn btn-outline btn-sm', label = 'Baixar PDF' }) {
  const [gerando, setGerando] = useState(false);
  const baixar = async () => {
    setGerando(true);
    try {
      const { gerarRequisicaoPdf } = await import('../services/requisicaoPdf');
      await gerarRequisicaoPdf(sol, { nomeColaborador, nomeSolicitante });
    } catch (err) {
      console.error(err);
      alert('Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setGerando(false);
    }
  };
  return (
    <button type="button" className={className} disabled={gerando} onClick={baixar}>
      {gerando ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} {label}
    </button>
  );
}
