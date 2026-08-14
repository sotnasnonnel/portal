import { X } from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { CAMPOS } from '../../../config/formularioContratacao';
import { CAMPOS_MAPEAMENTO } from '../../../config/mapeamento';
import { CAMPOS_AJUDA_CUSTO } from '../../../config/ajudaCusto';
import { CAMPOS_NOVA_VAGA } from '../../../config/novaVaga';
import BotaoPdfRequisicao from '../../../components/BotaoPdfRequisicao';
import BotaoGerarNovaVaga from './BotaoGerarNovaVaga';
import '../../../components/UI/Components.css';

/**
 * Configuração do "Ver respostas" por tipo de requisição com tabela de detalhe.
 * Compartilhada entre Acompanhar e o Histórico de cada requisição.
 */
export const DETALHE = {
  formulario_contratacao: { tabela: 'formularios_contratacao', campos: CAMPOS, titulo: 'Formulário de Contratação' },
  mapeamento: { tabela: 'mapeamentos', campos: CAMPOS_MAPEAMENTO, titulo: 'Mapeamento', bucket: 'mapeamento-anexos' },
  ajuda_custo: { tabela: 'ajudas_custo', campos: CAMPOS_AJUDA_CUSTO, titulo: 'Ajuda de Custo', bucket: 'ajuda-custo-anexos' },
  nova_vaga: { tabela: 'vagas', campos: CAMPOS_NOVA_VAGA, titulo: 'Nova Vaga', bucket: 'vaga-anexos' },
};

/** Busca o detalhe da solicitação e resolve as URLs públicas dos anexos.
 *  Suporta o formato novo (coluna jsonb `anexos` = [{ path, nome }]) e cai no
 *  legado (anexo_path/anexo_nome único) para registros antigos. Devolve sempre
 *  `anexos` (array {nome,url}) e `anexoUrl` (o 1º, p/ compat). */
export async function buscarRespostas(sol) {
  const cfg = DETALHE[sol.tipo];
  if (!cfg) return null;
  const { data } = await supabase
    .from(cfg.tabela).select('*').eq('solicitacao_id', sol.id).maybeSingle();
  const dados = data || {};
  const urlDe = (path) => (cfg.bucket && path
    ? supabase.storage.from(cfg.bucket).getPublicUrl(path).data?.publicUrl || null
    : null);
  let anexos = [];
  if (Array.isArray(dados.anexos) && dados.anexos.length) {
    anexos = dados.anexos.map((a) => ({ nome: a.nome || 'Anexo', url: urlDe(a.path) }));
  } else if (dados.anexo_path) {
    anexos = [{ nome: dados.anexo_nome || 'Baixar anexo', url: urlDe(dados.anexo_path) }];
  }
  return { ...cfg, dados, anexos, anexoUrl: anexos[0]?.url || null };
}

export const fmtResposta = (c, v) => {
  if (c.tipo === 'check') return v === true ? 'Sim' : 'Não';
  if (v == null || v === '') return '—';
  if (c.tipo === 'bool') return v ? 'Sim' : 'Não';
  if (c.tipo === 'checkbox') return Array.isArray(v) && v.length ? v.join('; ') : '—';
  return String(v);
};

export default function ModalRespostas({ respostas, onClose, sol, nomeColaborador, nomeSolicitante }) {
  if (!respostas) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <span className="modal-title">{respostas.titulo}</span>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {respostas.campos.map((c) => (
            <div key={c.id} style={{ marginBottom: 'var(--space-md)' }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{c.n}. {c.label}</div>
              <div style={{ fontSize: 14, color: 'var(--color-text-primary, var(--color-text-secondary))' }}>{fmtResposta(c, respostas.dados[c.id])}</div>
            </div>
          ))}
          {respostas.anexos?.length > 0 && (
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                {respostas.anexos.length > 1 ? `Anexos (${respostas.anexos.length})` : 'Anexo'}
              </div>
              {respostas.anexos.map((a, i) => (
                <div key={i}>
                  <a href={a.url} target="_blank" rel="noreferrer" style={{ fontSize: 14 }}>{a.nome}</a>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          {sol && <BotaoPdfRequisicao sol={sol} nomeColaborador={nomeColaborador} nomeSolicitante={nomeSolicitante} />}
          {/* Abrir o Mapeamento é justamente quando o gestor decide virá-lo em vaga. */}
          {sol && <BotaoGerarNovaVaga sol={sol} onAntesDeIr={onClose} />}
          <button className="btn btn-outline" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
