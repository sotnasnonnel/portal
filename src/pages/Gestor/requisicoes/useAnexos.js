import { useRef, useState } from 'react';
import { supabase } from '../../../services/supabase';

// Anexos MÚLTIPLOS de uma requisição. Guarda os arquivos escolhidos, valida
// tamanho, sobe todos para o bucket e devolve [{ path, nome }] para gravar na
// coluna jsonb `anexos`. Se um upload falhar, faz rollback dos que já subiram.
const sanitizarNome = (nome) => nome
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-zA-Z0-9._-]/g, '_');

export function useAnexos({ bucket, maxMb = 10 }) {
  const [arquivos, setArquivos] = useState([]); // File[]
  const [erro, setErro] = useState('');
  const inputRef = useRef(null);

  const adicionar = (fileList) => {
    setErro('');
    const novos = Array.from(fileList || []);
    const grande = novos.find((f) => f.size > maxMb * 1024 * 1024);
    if (grande) setErro(`"${grande.name}" está acima de ${maxMb} MB. Escolha um arquivo menor.`);
    const ok = novos.filter((f) => f.size <= maxMb * 1024 * 1024);
    setArquivos((prev) => {
      const chave = (f) => `${f.name}::${f.size}`;
      const vistos = new Set(prev.map(chave));
      return [...prev, ...ok.filter((f) => !vistos.has(chave(f)))]; // ignora duplicados
    });
    if (inputRef.current) inputRef.current.value = ''; // permite re-selecionar o mesmo arquivo
  };

  const remover = (i) => setArquivos((prev) => prev.filter((_, j) => j !== i));

  const limpar = () => {
    setArquivos([]);
    setErro('');
    if (inputRef.current) inputRef.current.value = '';
  };

  // Sobe todos; retorna [{ path, nome }]. Em falha, remove os que já subiram.
  const enviar = async () => {
    const enviados = [];
    try {
      for (const f of arquivos) {
        const path = `${crypto.randomUUID()}/${sanitizarNome(f.name)}`;
        const { error } = await supabase.storage.from(bucket).upload(path, f);
        if (error) throw new Error(`Falha ao enviar o anexo "${f.name}": ${error.message}`);
        enviados.push({ path, nome: f.name });
      }
      return enviados;
    } catch (e) {
      if (enviados.length) await supabase.storage.from(bucket).remove(enviados.map((a) => a.path));
      throw e;
    }
  };

  return { arquivos, erro, inputRef, adicionar, remover, limpar, enviar };
}
