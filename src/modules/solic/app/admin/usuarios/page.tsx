import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Aba de usuários removida — papéis do solic são geridos direto no banco/futura tela de Acessos.
export default function RedirectUsuarios() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/solic/admin/cadastros", { replace: true });
  }, [navigate]);

  return (
    <div className="card">
      <div className="loadingRow"><span className="spinner" /> Redirecionando...</div>
    </div>
  );
}
