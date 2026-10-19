import { useState } from 'react';
import { Cake, Award, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { comemoracoesEmCartaz } from './comemoracao';
import './DestaqueDoDia.css';

// Fechar vale só para o dia: quem fecha no sábado volta a ver na segunda, que é
// quando o resto da empresa está olhando (ver a janela em comemoracao.js).
const CHAVE = 'home-destaque-fechado';
const hojeIso = () => new Date().toLocaleDateString('sv-SE');
const lerFechado = () => {
  try { return localStorage.getItem(CHAVE) === hojeIso(); } catch { return false; }
};

// Destaque no topo da Home no aniversário e no aniversário de empresa — só
// para a própria pessoa: sai das datas dela no perfil carregado, nada de lista.
// Na segunda ele ainda aparece para quem comemorou no fim de semana, com o
// texto falando do dia certo em vez de "hoje".
export default function DestaqueDoDia() {
  const { user } = useAuth();
  const [fechado, setFechado] = useState(lerFechado);
  const itens = comemoracoesEmCartaz({ dataNascimento: user?.dataNascimento, dataAdmissao: user?.dataAdmissao });
  if (fechado || itens.length === 0) return null;

  const fechar = () => {
    setFechado(true);
    try { localStorage.setItem(CHAVE, hojeIso()); } catch { /* sem storage, fecha só nesta tela */ }
  };
  const nome = (user?.nome || '').split(' ')[0].toLowerCase().replace(/^\S/, (l) => l.toUpperCase());
  const aniversario = itens.find((i) => i.tipo === 'aniversario');
  const casa = itens.find((i) => i.tipo === 'tempo_casa');
  const anos = casa ? `${casa.anos} ${casa.anos === 1 ? 'ano' : 'anos'}` : '';

  let titulo;
  let texto;
  if (aniversario && casa) {
    // As duas datas podem cair em dias diferentes do mesmo fim de semana.
    const quando = aniversario.quando === casa.quando ? aniversario.quando : 'neste fim de semana';
    titulo = `Dia duplo, ${nome}! 🎉`;
    texto = quando === 'hoje'
      ? `Hoje é o seu aniversário e você completa ${anos} de PHD. Parabéns e obrigado por fazer parte do time!`
      : `Seu aniversário e seus ${anos} de PHD foram ${quando}. Parabéns e obrigado por fazer parte do time!`;
  } else if (aniversario) {
    titulo = aniversario.quando === 'hoje'
      ? `Feliz aniversário, ${nome}! 🎂`
      : `Seu aniversário foi ${aniversario.quando}, ${nome}! 🎂`;
    texto = aniversario.quando === 'hoje'
      ? 'Toda a PHD deseja a você um dia incrível e um novo ano cheio de conquistas.'
      : 'Toda a PHD deseja a você um novo ano cheio de conquistas. Os recados dos colegas estão no seu mural.';
  } else {
    titulo = `${anos} de PHD, ${nome}! 🏆`;
    texto = casa.quando === 'hoje'
      ? 'Hoje é o seu aniversário de empresa. Obrigado por fazer parte da nossa história!'
      : `Seu aniversário de empresa foi ${casa.quando}. Obrigado por fazer parte da nossa história!`;
  }

  return (
    <section className="home-destaque" role="status">
      <span className="home-destaque-icone" aria-hidden="true">
        {aniversario ? <Cake size={26} /> : <Award size={26} />}
      </span>
      <div className="home-destaque-texto">
        <strong>{titulo}</strong>
        <span>{texto}</span>
      </div>
      <button type="button" className="home-destaque-fechar" onClick={fechar} aria-label="Fechar o destaque" title="Fechar">
        <X size={16} />
      </button>
    </section>
  );
}
