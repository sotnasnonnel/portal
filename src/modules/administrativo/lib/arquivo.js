/**
 * Formatação de arquivo para a tela. Vive aqui porque DOIS lugares anexam
 * arquivo — a abertura do chamado e a resposta dentro dele —, e duas cópias da
 * mesma conta acabariam mostrando o mesmo arquivo com tamanhos diferentes.
 */
export const formatarTamanho = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
