import { useAuth } from '../../contexts/AuthContext';
import './AvatarUsuario.css';

// Bolinha do usuário LOGADO: foto do Microsoft 365 quando existe, iniciais como
// fallback (sem foto no perfil, sem token do Graph ou primeira carga offline).
// O visual é da classe de quem usa (.home-avatar, .modSb-avatar, ...) —
// aqui só entra a <img> que preenche o círculo.
export default function AvatarUsuario({ className = '', iniciais, ...rest }) {
  const { fotoUrl } = useAuth();
  return (
    <span className={className} {...rest}>
      {fotoUrl ? <img className="avatar-foto" src={fotoUrl} alt="" /> : iniciais}
    </span>
  );
}
