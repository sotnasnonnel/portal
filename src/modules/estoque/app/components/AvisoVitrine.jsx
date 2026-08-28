import { Eye } from 'lucide-react';
import { ESTOQUE_VITRINE, AVISO_VITRINE } from '../../../../config/estoqueModo';

/**
 * Faixa de "módulo em demonstração", no topo das telas que gravariam algo.
 *
 * Existe para a tela não parecer quebrada: sem ela, a pessoa preenche o
 * formulário inteiro e só descobre no clique que nada acontece. Some sozinha
 * quando ESTOQUE_VITRINE vira false — nenhuma tela precisa ser mexida.
 */
export default function AvisoVitrine({ acao = 'gravar' }) {
  if (!ESTOQUE_VITRINE) return null;
  return (
    <div className="est-aviso tom-info">
      <Eye size={16} />
      <span>
        {AVISO_VITRINE} Você pode navegar e conferir as telas à vontade; o botão de {acao} volta
        quando o módulo entrar no ar.
      </span>
    </div>
  );
}
