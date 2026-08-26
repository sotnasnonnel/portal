import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Loader2, Plus, Rocket } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  ELEGIBILIDADE_LABEL, STATUS_ALAVANCA_LABEL, ehComercial,
} from '../../../../config/programas';
import { listarIndicacoes } from '../../lib/alavanca';

/**
 * Minhas indicações da Alavanca.
 *
 * A consulta é a mesma do painel do comercial — quem faz o recorte é a RLS.
 * Aqui filtramos por autor mesmo assim: um membro do time comercial que abre
 * esta tela quer ver as DELE, não a fila inteira (que tem página própria).
 */

const data = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
const dinheiro = (n) => (n == null
  ? '—'
  : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

export default function MinhasIndicacoes() {
  const { user, modules } = useAuth();
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const todas = await listarIndicacoes();
      setLinhas(todas.filter((i) => i.indicado_por === user?.id));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [user?.id]);

  useEffect(() => { carregar(); }, [carregar]);

  return (
    <div className="pg-page pg-page-wide">
      <h1 className="pg-title"><Rocket size={24} /> Alavanca PHD</h1>
      <p className="pg-sub">
        Indique uma oportunidade comercial. Fechando contrato, a premiação é de 0,5% do valor,
        limitada a R$ 10.000,00 — conforme as regras do programa.
      </p>

      <div className="pg-acoes" style={{ marginTop: 0, marginBottom: 18 }}>
        <Link to="/programas/alavanca/nova" className="pg-btn pg-btn-primary">
          <Plus size={16} /> Indicar oportunidade
        </Link>
        {ehComercial(modules) && (
          <Link to="/programas/painel-alavanca" className="pg-btn pg-btn-ghost">
            Abrir o painel do comercial
          </Link>
        )}
      </div>

      {erro && <div className="pg-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      {carregando ? (
        <div className="pg-vazio"><Loader2 size={20} className="pg-spin" /> Carregando…</div>
      ) : linhas.length === 0 ? (
        <div className="pg-vazio">
          Você ainda não indicou nenhuma oportunidade.{' '}
          <Link className="pg-link" to="/programas/alavanca/nova">Fazer a primeira indicação</Link>.
        </div>
      ) : (
        <div className="pg-tabela-scroll">
          <table className="pg-tabela">
            <thead>
              <tr>
                <th>ID</th>
                <th>Oportunidade</th>
                <th>Empresa</th>
                <th>Enviada</th>
                <th>Elegibilidade</th>
                <th>Situação</th>
                <th>Premiação</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((i) => (
                <tr key={i.id}>
                  <td className="num">#{i.numero}</td>
                  <td>{i.oportunidade}</td>
                  <td>{i.empresa}</td>
                  <td className="num">{data(i.criado_em)}</td>
                  <td>
                    <span className={`pg-badge tom-${i.elegibilidade}`}>
                      {ELEGIBILIDADE_LABEL[i.elegibilidade] || i.elegibilidade}
                    </span>
                    {/* O motivo é o que responde "por que não?" sem obrigar
                        ninguém a perguntar ao comercial. */}
                    {i.elegibilidade_motivo && <span className="pg-motivo">{i.elegibilidade_motivo}</span>}
                  </td>
                  <td>
                    <span className={`pg-badge tom-${i.status}`}>
                      {STATUS_ALAVANCA_LABEL[i.status] || i.status}
                    </span>
                    {i.comentario && <span className="pg-motivo">{i.comentario}</span>}
                  </td>
                  <td className="num">
                    {dinheiro(i.valor_premio)}
                    {i.pago_em && <span className="pg-motivo">Pago em {data(i.pago_em)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
