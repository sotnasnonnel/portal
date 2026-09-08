import { lazy } from 'react';

const CHAVE = 'portal:recarregado-apos-deploy';

// Cada build renomeia os arquivos das telas. Quem ficou com o index.html antigo
// no cache continua pedindo o nome velho, que sumiu no upload: o import falha e
// a tela abre em branco. Recarregar resolve, porque busca o index.html novo.
const ehArquivoQueSumiu = (erro) => {
  const msg = String(erro?.message || erro || '');
  return /dynamically imported module|Importing a module script failed|error loading dynamically/i.test(msg);
};

const marca = {
  ja: () => { try { return sessionStorage.getItem(CHAVE) === '1'; } catch { return false; } },
  poe: () => { try { sessionStorage.setItem(CHAVE, '1'); } catch { /* modo restrito */ } },
  tira: () => { try { sessionStorage.removeItem(CHAVE); } catch { /* modo restrito */ } },
};

export function lazyPagina(importar) {
  return lazy(() => importar().then((modulo) => {
    // Carregou: libera a recarga para o próximo deploy.
    marca.tira();
    return modulo;
  }).catch((erro) => {
    // Recarrega uma vez só. Sem essa trava, um erro real dentro da tela
    // viraria um laço de recarregamentos.
    if (!ehArquivoQueSumiu(erro) || marca.ja()) throw erro;
    marca.poe();
    window.location.reload();
    // Deixa o Suspense esperando enquanto a página recarrega, para não piscar
    // a tela de erro antes de sair.
    return new Promise(() => {});
  }));
}

export const _internos = { CHAVE, ehArquivoQueSumiu };
