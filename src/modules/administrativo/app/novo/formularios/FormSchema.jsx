import CampoExtra from '../CampoExtra';
import { schemaDoServico } from './schemas';

/**
 * Desenha o formulário de um serviço a partir do esquema declarado em
 * schemas.js. Um componente só para os 22 serviços transcritos da planilha —
 * o que muda entre eles é dado, não código.
 */
export default function FormSchema({ valores, onChange, pessoas = [], classe, servico, travarCc = false }) {
  const schema = schemaDoServico(classe, servico) || [];
  const mexer = (chave, valor) => onChange({ ...valores, [chave]: valor });

  return schema.map((campo) => (
    <CampoExtra
      key={campo.chave}
      campo={campo}
      valor={valores[campo.chave]}
      onChange={mexer}
      pessoas={pessoas}
      travado={travarCc && campo.chave === 'cc'}
    />
  ));
}
