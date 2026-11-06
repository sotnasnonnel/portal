import { useState } from 'react';
import {
  Download, ExternalLink, FileText, Image as ImageIcon, Trash2, Upload,
} from 'lucide-react';
import { enviarAnexo, urlDoAnexo } from '../../lib/anexos';
import { fdateTs } from '../../lib/regras';

const tamanho = (b) => {
  const n = +b || 0;
  return n >= 1048576 ? `${(n / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
};

/**
 * Um arquivo: abre em nova aba e baixa por URL assinada (bucket privado). Mesmo
 * comportamento do ArquivoLinha da Frota, com o bucket e as classes daqui.
 * `compacto` é a versão das tabelas: só o nome e os botões.
 */
export function ArquivoLinha({
  arquivo, rotulo, compacto = false, onRemover, onErro,
}) {
  const abrir = async () => {
    // A aba abre antes do await: depois dele o navegador trata como pop-up.
    const aba = window.open('', '_blank');
    try {
      const url = await urlDoAnexo(arquivo.path);
      if (aba) aba.location.href = url;
      else window.location.assign(url);
    } catch (e) {
      aba?.close();
      onErro?.(e.message);
    }
  };
  const baixar = async () => {
    try {
      window.location.assign(await urlDoAnexo(arquivo.path, { download: arquivo.nome || true }));
    } catch (e) {
      onErro?.(e.message);
    }
  };
  const Icone = arquivo.tipo === 'application/pdf' ? FileText : ImageIcon;
  const nome = rotulo || arquivo.nome || 'arquivo';
  const detalhe = [arquivo.tamanho ? tamanho(arquivo.tamanho) : '', arquivo.enviado_em ? `enviado em ${fdateTs(arquivo.enviado_em)}` : ''].filter(Boolean).join(' · ');

  return (
    <div className={`aloj-file${compacto ? ' compacto' : ''}`}>
      <Icone size={15} aria-hidden="true" />
      <div className="fn" title={arquivo.nome}>
        <b>{nome}</b>
        {!compacto && detalhe && <span>{detalhe}</span>}
      </div>
      <button type="button" className="aloj-mini" onClick={abrir} aria-label={`Abrir ${arquivo.nome}`} title="Abrir"><ExternalLink size={14} /></button>
      <button type="button" className="aloj-mini" onClick={baixar} aria-label={`Baixar ${arquivo.nome}`} title="Baixar"><Download size={14} /></button>
      {onRemover && (
        <button type="button" className="aloj-mini" onClick={onRemover} aria-label={`Remover ${arquivo.nome}`} title="Remover"><Trash2 size={14} /></button>
      )}
    </div>
  );
}

/** Anexos de um lançamento nas tabelas: "Fatura", "Fatura 1"… ou o traço. */
export function AnexosCompactos({ lista, onErro, vazio = null }) {
  const fs = lista || [];
  if (!fs.length) return vazio;
  return (
    <div className="aloj-files">
      {fs.map((f, i) => (
        <ArquivoLinha key={f.path} arquivo={f} compacto rotulo={fs.length > 1 ? `Fatura ${i + 1}` : 'Fatura'} onErro={onErro} />
      ))}
    </div>
  );
}

/**
 * Campo de arquivo do formulário. O registro só muda ao clicar em Salvar; quem
 * apaga do bucket o que sobrou (cancelou ou removeu da lista) é o FormModal.
 */
export default function CampoAnexos({
  campo, lista, onChange, onEnviado, onOcupado, onErro,
}) {
  const [ocupado, setOcupado] = useState(false);

  const enviar = async (files) => {
    setOcupado(true);
    onOcupado(true);
    let atual = lista;
    for (const file of files) {
      try {
        const a = await enviarAnexo(file);
        onEnviado(a.path);
        atual = [...atual, a];
        onChange(atual);
      } catch (e) {
        onErro(e.message);
      }
    }
    setOcupado(false);
    onOcupado(false);
  };

  return (
    <div className="aloj-campo s2">
      <span className="aloj-campo-l">{campo.label}</span>
      <div className="aloj-files">
        {lista.length
          ? lista.map((a, i) => (
            <ArquivoLinha key={a.path} arquivo={a} onErro={onErro} onRemover={() => onChange(lista.filter((_, j) => j !== i))} />
          ))
          : <span className="aloj-muted aloj-pequeno">Nenhum arquivo anexado.</span>}
        <label className={`aloj-upl${ocupado ? ' busy' : ''}`}>
          <Upload size={14} aria-hidden="true" />
          <span>{ocupado ? 'Enviando…' : 'Anexar arquivo — PDF ou imagem, até 20 MB'}</span>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
            multiple
            disabled={ocupado}
            onChange={(e) => {
              const files = [...e.target.files];
              e.target.value = '';
              if (files.length) enviar(files);
            }}
          />
        </label>
      </div>
    </div>
  );
}
