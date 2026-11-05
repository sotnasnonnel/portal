import { useState } from 'react';
import {
  Download, ExternalLink, FileText, Trash2, Upload,
} from 'lucide-react';
import { enviarAnexo, urlDoAnexo } from '../../lib/frota';
import { fmtDate } from '../../lib/formato';
import { useFrota } from './FrotaContext';

/** Um arquivo: abre e baixa por URL assinada, que vence em 2 minutos. */
export function ArquivoLinha({ arquivo, onRemover }) {
  const { toast } = useFrota();

  const abrir = async () => {
    // A aba abre antes do await: depois dele o navegador trata como pop-up.
    const aba = window.open('', '_blank');
    try {
      const url = await urlDoAnexo(arquivo.path);
      if (aba) aba.location.href = url;
      else window.location.assign(url);
    } catch (e) {
      aba?.close();
      toast(e.message, 'err');
    }
  };
  const baixar = async () => {
    try {
      window.location.assign(await urlDoAnexo(arquivo.path, { download: arquivo.nome || true }));
    } catch (e) {
      toast(e.message, 'err');
    }
  };

  const enviado = arquivo.enviado_em ? `enviado em ${fmtDate(String(arquivo.enviado_em).slice(0, 10))}` : '';
  return (
    <div className="frota-file">
      <FileText size={16} aria-hidden="true" />
      <div className="fn">
        <b>{arquivo.nome || 'arquivo'}</b>
        <span>{[arquivo.tipo_doc, enviado].filter(Boolean).join(' · ')}</span>
      </div>
      <button type="button" className="frota-ibtn" onClick={abrir} aria-label="Abrir em nova aba" title="Abrir"><ExternalLink size={15} /></button>
      <button type="button" className="frota-ibtn" onClick={baixar} aria-label="Baixar" title="Baixar"><Download size={15} /></button>
      {onRemover && (
        <button type="button" className="frota-ibtn" onClick={onRemover} aria-label="Remover" title="Remover"><Trash2 size={15} /></button>
      )}
    </div>
  );
}

/** Botão de envio. `onEscolher` recebe os File; quem chama decide o que fazer. */
export function EnviarArquivo({ rotulo, multi = false, onEscolher, ocupado = false }) {
  return (
    <label className={`frota-upl ${ocupado ? 'busy' : ''}`}>
      <Upload size={16} aria-hidden="true" />
      <span>{ocupado ? 'Enviando…' : rotulo}</span>
      <input
        type="file"
        accept="application/pdf,image/*"
        multiple={multi}
        disabled={ocupado}
        onChange={(e) => {
          const files = [...e.target.files];
          e.target.value = '';
          if (files.length) onEscolher(files);
        }}
      />
    </label>
  );
}

/** Campo de arquivo do formulário. O registro só muda ao clicar em Salvar. */
export default function CampoArquivos({ campo, col, lista, onChange, podeEditar }) {
  const { toast } = useFrota();
  const [tipoDoc, setTipoDoc] = useState(campo.docTypes?.[0] || '');
  const [ocupado, setOcupado] = useState(false);

  const enviar = async (files) => {
    setOcupado(true);
    let atual = lista;
    for (const file of files) {
      try {
        const a = await enviarAnexo(col, file, tipoDoc);
        atual = campo.multi ? [...atual, a] : [a];
        onChange(atual);
        toast('Arquivo anexado. Clique em Salvar para confirmar.');
      } catch (e) {
        toast(e.message, 'err');
      }
    }
    setOcupado(false);
  };

  return (
    <div className="frota-fld full">
      <span className="frota-lbl">{campo.l}</span>
      <div className="frota-files">
        {lista.map((a, i) => (
          <ArquivoLinha
            key={a.path}
            arquivo={a}
            onRemover={podeEditar ? () => {
              onChange(lista.filter((_, j) => j !== i));
              toast('Anexo removido. Clique em Salvar para confirmar.');
            } : null}
          />
        ))}
        {podeEditar ? (
          <div className="frota-up-row">
            {campo.docTypes && (
              <select className="frota-inp frota-comp" value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)} aria-label="Tipo do documento">
                {campo.docTypes.map((t) => <option key={t}>{t}</option>)}
              </select>
            )}
            <EnviarArquivo
              rotulo={`${lista.length && !campo.multi ? 'Substituir' : 'Anexar'} ${campo.what || 'arquivo'} — PDF ou imagem, até 20 MB`}
              multi={campo.multi}
              onEscolher={enviar}
              ocupado={ocupado}
            />
          </div>
        ) : !lista.length && <span className="frota-muted">Nenhum arquivo.</span>}
      </div>
    </div>
  );
}
