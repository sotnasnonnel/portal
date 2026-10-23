import { useEffect } from 'react';
import { AtSign, Building2, Heart, Newspaper, ScrollText, Star, X } from 'lucide-react';
import { COMO_GANHAR } from '../../config/pontos';

// Boas-vindas logo depois do primeiro aceite das regras (TermosFeed): para que
// serve o feed. Só aparece essa vez; as regras continuam no cabeçalho.

// Os pontos vêm da mesma lista do "Como ganhar pontos" da lateral, para os
// dois lugares não discordarem se o valor mudar.
const PONTOS_POST = COMO_GANHAR.find((g) => g.o === 'Postar no feed')?.p;

const ITENS = [
  { Icon: Building2, titulo: 'Coisas da empresa', texto: 'Obra andando, projeto entregue, treinamento, evento, conquista da equipe: mostre o que está rolando na PHD.' },
  { Icon: Heart, titulo: 'Coisas pessoais também', texto: 'Viagem, formatura, filho que nasceu, o pet, o hobby, a receita do fim de semana. O feed é da turma, não só do trabalho.' },
  { Icon: AtSign, titulo: 'Marque, curta e comente', texto: 'Use @ para marcar um colega: ele recebe o aviso no sino. Curtir e comentar faz o feed andar.' },
  ...(PONTOS_POST ? [{ Icon: Star, titulo: 'Ganhe pontos', texto: `O primeiro post do dia vale +${PONTOS_POST} pontos para a lojinha.` }] : []),
  { Icon: ScrollText, titulo: 'Regras sempre à mão', texto: 'Elas ficam no ícone ao lado do Atualizar. Viu algo fora delas? Use o "Denunciar" do post.' },
];

// Com o passo a passo do feed rodando (ele espera esta tela fechar, ver
// usePausaTour em Feed.jsx), o botão diz que ele continua: "Começar" fazia
// parecer que o destaque que volta em seguida era outra coisa.
export default function BoasVindasFeed({ onFechar, comTutorial = false }) {
  useEffect(() => {
    const tecla = (e) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onFechar]);

  return (
    <div className="feed-modal-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div className="feed-modal feed-boasvindas" role="dialog" aria-modal="true" aria-labelledby="feed-bv-tit">
        <button type="button" className="feed-iconbtn feed-boasvindas-x" aria-label="Fechar" onClick={onFechar}><X size={20} /></button>
        <div className="feed-boasvindas-topo">
          <span className="feed-boasvindas-icone" aria-hidden="true"><Newspaper size={28} /></span>
          <h2 id="feed-bv-tit">Boas-vindas ao Feed PHD</h2>
          <p>O lugar para a empresa toda acompanhar o que acontece nas obras, nos projetos, no escritório e com quem faz a PHD.</p>
        </div>

        <ul className="feed-boasvindas-lista">
          {ITENS.map((item) => (
            <li key={item.titulo}>
              <span className="feed-boasvindas-ic" aria-hidden="true"><item.Icon size={18} /></span>
              <span><b>{item.titulo}</b>{item.texto}</span>
            </li>
          ))}
        </ul>

        <div className="feed-modal-rodape is-leitura">
          <button type="button" className="feed-btn-publicar" onClick={onFechar} autoFocus>
            {comTutorial ? 'Continuar o passo a passo' : 'Começar'}
          </button>
        </div>
      </div>
    </div>
  );
}
