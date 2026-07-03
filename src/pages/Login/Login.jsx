import { useAuth } from '../../contexts/AuthContext';
import { Shield, Users, CalendarCheck } from 'lucide-react';
import './Login.css';

export default function Login() {
  const { signInWithMicrosoft, blocked, error, loading } = useAuth();

  return (
    <div className="login-page">
      <div className="login-bg" />

      <div className="login-content">
        {/* Painel esquerdo — branding sobre a foto */}
        <div className="login-left">
          <div className="login-left-inner">
            <h1 className="login-left-title">Portal PHD</h1>
            <p className="login-left-desc">
              Gestão de Pessoas, Reembolsos e Solicitações em um só acesso.
            </p>
            <div className="login-features">
              <div className="login-feature">
                <div className="login-feature-icon">
                  <Shield size={22} />
                </div>
                <span>Seguro</span>
              </div>
              <div className="login-feature">
                <div className="login-feature-icon">
                  <Users size={22} />
                </div>
                <span>Colaborativo</span>
              </div>
              <div className="login-feature">
                <div className="login-feature-icon">
                  <CalendarCheck size={22} />
                </div>
                <span>Organizado</span>
              </div>
            </div>
          </div>
          <p className="login-left-footer">PHD Engenharia</p>
        </div>

        {/* Painel direito — card de login */}
        <div className="login-right">
          <div className="login-card">
            <div className="login-card-header">
              <h2>Entrar</h2>
              <p>Acesse o Portal PHD com sua conta Microsoft</p>
            </div>

            <div className="login-actions">
              {blocked && (
                <div className="login-blocked">
                  Seu acesso ainda não foi liberado para <strong>{blocked}</strong>.<br />
                  Procure o DP para liberar seu cadastro.
                </div>
              )}
              {error && <div className="login-error">{error}</div>}
              <button type="button" className="ms-login-btn" onClick={signInWithMicrosoft} disabled={loading}>
                <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
                  <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                  <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                  <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                  <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                </svg>
                Entrar com Microsoft
              </button>
            </div>

            <div className="login-card-footer">
              <span className="login-card-logo" role="img" aria-label="PHD Engenharia" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
