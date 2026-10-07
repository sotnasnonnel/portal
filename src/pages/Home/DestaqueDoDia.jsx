import { useState } from 'react';
import { Cake, Award, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { comemoracoesDoDia } from './comemoracao';
import './DestaqueDoDia.css';

// Fechar vale só para hoje: amanhã o destaque já não apareceria mesmo.
const CHAVE = 'home-destaque-fechado';
const hojeIso = () => new Date().toLocaleDateString('sv-SE');
const lerFechado = () => {
  try { return localStorage.getItem(CHAVE) === hojeIso(); } catch { return false; }
};

// Destaque no topo da Home no aniversário e no aniversário de empresa — só
// para a própria pessoa: sai das datas dela no perfil carregado, nada de lista.
export default function DestaqueDoDia() {
  const { user } = useAuth();
  const [fechado, setFechado] = useState(lerFechado);
  const itens = comemoracoesDoDia({ dataNascimento: user?.dataNascimento, dataAdmissao: user?.dataAdmissao });
  if (fechado || itens.length === 0) return null;

  const fechar = () => {
    setFechado(true);
    try { localStorage.setItem(CHAVE, hojeIso()); } catch { /* sem storage, fecha só nesta tela */ }
  };
  const nome = (user?.nome || '').split(' ')[0].toLowerCase().replace(/^\S/, (l) => l.toUpperCase());
  const aniversario = itens.some((i) => i.tipo === 'aniversario');
  const casa = itens.find((i) => i.tipo === 'tempo_casa');
  const anos = casa ? `${casa.anos} ${casa.anos === 1 ? 'ano' : 'anos'}` : '';

  let titulo;
  let texto;
  if (aniversario && casa) {
    titulo = `Dia duplo, ${nome}! 🎉`;
    texto = `Hoje é o seu aniversário e você completa ${anos} de PHD. Parabéns e obrigado por fazer parte do time!`;
  } else if (aniversario) {
    titulo = `Feliz aniversário, ${nome}! 🎂`;
    texto = 'Toda a PHD deseja a você um dia incrível e um novo ano cheio de conquistas.';
  } else {
    titulo = `${anos} de PHD, ${nome}! 🏆`;
    texto = 'Hoje é o seu aniversário de empresa. Obrigado por fazer parte da nossa história!';
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
