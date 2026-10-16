import { useAuth } from '../../contexts/AuthContext';
import { usePontos } from '../../contexts/PontosContext';
import { classeMoldura } from '../../config/pontos';
import SeloMoldura from '../Pontos/SeloMoldura';
import './AvatarUsuario.css';

// Bolinha do usuário LOGADO: foto do Microsoft 365 quando existe, iniciais como
// fallback (sem foto no perfil, sem token do Graph ou primeira carga offline).
// O visual é da classe de quem usa (.home-avatar, .modSb-avatar, ...) —
// aqui só entra a <img> que preenche o círculo, e a moldura da lojinha de
// pontos, quando a pessoa usa uma.
export default function AvatarUsuario({ className = '', iniciais, ...rest }) {
  const { fotoUrl } = useAuth();
  const { perfil } = usePontos();
  const moldura = perfil?.moldura;
  return (
    <span className={`${className} ${classeMoldura(moldura)}`.trim()} {...rest}>
      {fotoUrl ? <img className="avatar-foto" src={fotoUrl} alt="" /> : iniciais}
      <SeloMoldura moldura={moldura} />
    </span>
  );
}
