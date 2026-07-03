import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Movido para a página única de cadastros.
export default function RedirectCriarEmpresa() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/solic/admin/cadastros?tab=empresa", { replace: true });
  }, [navigate]);

  return (
    <div className="card">
      <div className="loadingRow"><span className="spinner" /> Redirecionando...</div>
    </div>
  );
}
