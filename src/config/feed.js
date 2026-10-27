// Feed do portal: regras e formatação, sem React nem Supabase (testável com
// `node --test`). O banco repete os limites que importam nas RPCs de
// supabase/supabase_migration_feed.sql; aqui eles existem para a tela avisar
// antes do envio.
import { isSuperAdmin } from './superAdmin.js';

export const ROTA_FEED = '/feed';

// Lançado para todo mundo em 23/10/2026, a pedido do usuário (de 20/10 até
// lá, só o super admin via, testando). `veFeed` continua sendo o ponto único
// de quem vê o feed (botão da Home e a rota): se precisar fechar de novo, é
// voltar isto para false — o super admin segue entrando.
export const FEED_LIBERADO = true;

/** Quem vê o feed: todos com FEED_LIBERADO; com ele fechado, só o super admin. */
export const veFeed = (user) => FEED_LIBERADO || isSuperAdmin(user);

export const TEXTO_MAX = 3000;
export const COMENTARIO_MAX = 1000;
export const MIDIAS_MAX = 5;                      // fotos + vídeo, juntos
export const FOTO_BYTES_MAX = 8 * 1024 * 1024;   // só do navegador: o bucket aceita até 50 MB
export const FOTO_LADO_MAX = 1920;                // a foto é reduzida no navegador
export const POR_PAGINA = 20;

/**
 * Vídeo no post (26/10/2026). Ao contrário da foto, o navegador NÃO recomprime
 * vídeo (precisaria de ffmpeg): o arquivo sobe como veio, e por isso o limite é
 * baixo e vale um vídeo por post. 50 MB é o teto do bucket feed-midia
 * (supabase_migration_feed_video_curtidas.sql); a duração o navegador mede
 * antes de subir, lendo os metadados.
 *
 * `video/quicktime` é o .mov que o iPhone grava — sem ele, metade da empresa
 * não consegue postar do celular.
 */
export const VIDEOS_MAX = 1;
export const VIDEO_BYTES_MAX = 50 * 1024 * 1024;
export const VIDEO_SEG_MAX = 180;
export const VIDEO_TIPOS = ['video/mp4', 'video/webm', 'video/quicktime'];
export const VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime';
export const VIDEO_POSTER_LADO = 1280;            // a capa do vídeo, no tamanho do feed

export const ehVideo = (file) => Boolean(file?.type?.startsWith('video/'));
/** Item de `midia` que é vídeo. Item sem `tipo` é foto (posts antes de 26/10/2026). */
export const midiaEhVideo = (m) => m?.tipo === 'video';

/** Moderação: admin do portal ou super admin. Espelha app_private.feed_moderador(). */
export const ehModeradorFeed = (user) => user?.perfil === 'admin' || isSuperAdmin(user);

/**
 * REGRAS DE CONVIVÊNCIA do feed: termo que cobre a página no primeiro acesso,
 * com aceite obrigatório (pedido do usuário, 23/10/2026). Mesmo formato dos
 * termos do Financeiro (config/financeiroTermos.js): [título, texto] e um
 * terceiro `true` quando o item é DESTACADO.
 *
 * O texto segue o padrão das redes internas de empresa (o que não pode:
 * ofensa, sigilo de cliente, dado pessoal, política, venda, boato) com o que é
 * próprio da PHD (foto de obra). Quem revisa é RH/comunicação. Mudou o texto?
 * Suba a `versao`: todo mundo aceita de novo na próxima entrada.
 * Aceite gravado em colaboradores.feed_termos_versao/_em
 * (supabase/supabase_migration_feed_termos.sql).
 */
export const TERMOS_FEED = {
  versao: '1',
  titulo: 'Regras de convivência do Feed PHD',
  intro: 'O feed é aberto a todos os colaboradores da PHD. Antes de entrar, leia o que não pode. Vale para posts, fotos e comentários:',
  itens: [
    ['Respeito acima de tudo', 'nada de ofensa, deboche, assédio, ameaça ou exposição de colega. Discriminação por raça, cor, gênero, orientação sexual, religião, origem, idade ou deficiência não é tolerada.', true],
    ['Sigilo de cliente e da empresa', 'não publique contrato, proposta, valor, medição, desenho ou documento interno.', true],
    ['Dados pessoais', 'não exponha CPF, telefone, endereço, salário, atestado ou qualquer dado pessoal, de colega ou seu. Para postar foto de alguém, peça antes.'],
    ['Segurança nas fotos de campo', 'foto de obra mostra o jeito certo de trabalhar: com EPI e sem situação de risco. Acidente e incidente não vão para o feed: seguem pelos canais de segurança.'],
    ['Política e religião', 'sem campanha político-partidária, propaganda eleitoral ou pregação religiosa.'],
    ['Venda, corrente e spam', 'o feed não é classificado: nada de venda, rifa, corrente, pirâmide, propaganda de fora ou link suspeito.'],
    ['Conteúdo impróprio', 'nada de conteúdo sexual, violento, com drogas ou armas, nem palavrão.'],
    ['Boato não é notícia', 'não espalhe rumor sobre a empresa, clientes ou colegas. Comunicado oficial vem pelos canais oficiais.'],
    ['O que você posta leva o seu nome', 'post e comentário saem com seu nome e foto, para a empresa toda. A moderação pode ocultar o que fugir destas regras, e o caso pode ser tratado pelas normas internas da PHD. Viu algo fora delas? Use o "Denunciar".'],
  ],
};

/** O termo cobre o feed até a pessoa aceitar a versão atual. `aceite`: { versao, em } ou null. */
export const precisaAceitarTermos = (aceite) => !aceite?.em || aceite.versao !== TERMOS_FEED.versao;

/** Erros que impedem publicar. `midias` são os File escolhidos (foto ou vídeo). */
export function validarPost({ texto = '', midias = [] } = {}) {
  const erros = [];
  const t = String(texto || '').trim();
  const videos = midias.filter(ehVideo);
  if (!t && midias.length === 0) erros.push('Escreva algo ou escolha uma foto ou vídeo.');
  if (t.length > TEXTO_MAX) erros.push(`O texto passou de ${TEXTO_MAX.toLocaleString('pt-BR')} caracteres.`);
  if (midias.length > MIDIAS_MAX) erros.push(`No máximo ${MIDIAS_MAX} arquivos por post.`);
  if (midias.some((f) => f?.type && !f.type.startsWith('image/') && !f.type.startsWith('video/'))) {
    erros.push('Só dá para anexar fotos e vídeos.');
  }
  if (videos.length > VIDEOS_MAX) erros.push('Só um vídeo por post.');
  if (videos.some((f) => f?.type && !VIDEO_TIPOS.includes(f.type))) erros.push('O vídeo precisa ser MP4, WebM ou MOV.');
  if (videos.some((f) => f?.size > VIDEO_BYTES_MAX)) {
    erros.push(`Vídeo acima de ${Math.round(VIDEO_BYTES_MAX / 1024 / 1024)} MB. Corte um trecho ou grave em qualidade menor.`);
  }
  return erros;
}

/**
 * Cursor da próxima página: o último post NÃO fixado. Os fixados vêm só na
 * primeira página, no topo, e não andam com a paginação.
 */
export function cursorDe(posts = []) {
  const ultimo = [...posts].reverse().find((p) => !p.fixado);
  return ultimo ? { em: ultimo.criado_em, id: ultimo.id } : null;
}

/** Junta páginas sem repetir post (um post novo pode empurrar outro de página). */
export function juntarPaginas(atuais = [], novos = []) {
  const vistos = new Set(atuais.map((p) => p.id));
  return [...atuais, ...novos.filter((p) => !vistos.has(p.id))];
}

/**
 * Comentários em árvore de um nível: [{ ...comentario, respostas: [...] }].
 * Resposta cujo pai não veio (excluído sem marcador) sobe para o primeiro nível.
 */
export function agruparComentarios(lista = []) {
  const ordenada = [...lista].sort((a, b) => (a.criado_em < b.criado_em ? -1 : a.criado_em > b.criado_em ? 1 : 0));
  const topo = new Map();
  for (const c of ordenada) if (!c.pai_id) topo.set(c.id, { ...c, respostas: [] });
  const raiz = [...topo.values()];
  for (const c of ordenada) {
    if (!c.pai_id) continue;
    const pai = topo.get(c.pai_id);
    if (pai) pai.respostas.push({ ...c, respostas: [] });
    else raiz.push({ ...c, respostas: [] });
  }
  return raiz.sort((a, b) => (a.criado_em < b.criado_em ? -1 : a.criado_em > b.criado_em ? 1 : 0));
}

/** "agora", "há 5 min", "há 3 h", "ontem", "há 4 dias", depois a data. */
export function tempoRelativo(iso, agora = new Date()) {
  if (!iso) return '';
  const d = new Date(iso);
  const seg = Math.max(0, Math.floor((agora - d) / 1000));
  if (seg < 60) return 'agora';
  const min = Math.floor(seg / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.floor(h / 24);
  if (dias === 1) return 'ontem';
  if (dias < 7) return `há ${dias} dias`;
  const mesmoAno = d.getFullYear() === agora.getFullYear();
  return d.toLocaleDateString('pt-BR', mesmoAno
    ? { day: '2-digit', month: 'short' }
    : { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '');
}

/** Contagem em texto: "1 curtida", "3 comentários". */
export const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/**
 * A linha "Curtido por…" embaixo do post, no molde do Instagram: dois nomes e
 * o resto como "e outras N pessoas".
 *
 * `quem` é o resumo que o banco manda (3 por post, feed_curtidas_resumo), e
 * `total` é o número do post — podem divergir, porque o resumo é cortado e o
 * total conta todo mundo. Quem curtiu aparece primeiro como "Você": é o que
 * faz a linha responder ao próprio clique no coração.
 *
 * Devolve { lista, resto }: `lista` são os curtidores a nomear (com `euAqui`
 * marcando o "Você") e `resto` quantas pessoas ficaram de fora.
 */
export function resumoCurtidas(quem = [], total = 0, euId = null, max = 2) {
  const eu = quem.filter((p) => p.colaborador_id === euId);
  const outros = quem.filter((p) => p.colaborador_id !== euId);
  const lista = [...eu, ...outros].slice(0, max).map((p) => ({ ...p, euAqui: p.colaborador_id === euId }));
  // `total` é a verdade; o resumo nunca tem mais gente do que ele.
  return { lista, resto: Math.max(0, Math.max(total, lista.length) - lista.length) };
}

// Links no texto: http(s)://… e www.…, até o primeiro espaço. Pontuação de fim
// de frase (". , ; : ! ?" e o ")" que não abriu dentro do link) fica de fora.
const RE_LINK = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;

function aparar(url) {
  let u = url;
  for (;;) {
    const ult = u.slice(-1);
    if (/[.,;:!?'"]/.test(ult)) { u = u.slice(0, -1); continue; }
    if (ult === ')' && (u.match(/\(/g) || []).length < (u.match(/\)/g) || []).length) { u = u.slice(0, -1); continue; }
    return u;
  }
}

/**
 * Quebra o texto em pedaços para a tela: [{ texto }] e [{ link, href }].
 * `href` sempre com http(s) — "www.x.com" vira "https://www.x.com".
 */
export function pedacosComLinks(texto = '') {
  const out = [];
  let i = 0;
  for (const m of String(texto).matchAll(RE_LINK)) {
    const link = aparar(m[0]);
    if (m.index > i) out.push({ texto: texto.slice(i, m.index) });
    out.push({ link, href: /^https?:\/\//i.test(link) ? link : `https://${link}` });
    i = m.index + link.length;
  }
  if (i < texto.length) out.push({ texto: texto.slice(i) });
  return out;
}

// ---- Marcação com @ ---------------------------------------------------------

/**
 * O "@" que está sendo digitado antes do cursor: { inicio, termo } ou null.
 * Vale do "@" (no começo ou depois de espaço) até o cursor, sem quebra de
 * linha e com até 30 letras — "@lu", "@lucas fe".
 */
export function buscaMencao(texto = '', cursor = texto.length) {
  const antes = texto.slice(0, cursor);
  const m = /(^|\s)@([^\s@][^@\n]{0,29}|)$/u.exec(antes);
  if (!m) return null;
  const termo = m[2];
  // Dois espaços seguidos ou espaço no fim de 2+ palavras: a pessoa já seguiu.
  if (/\s{2}/.test(termo) || termo.split(' ').length > 3) return null;
  return { inicio: antes.length - termo.length - 1, termo };
}

/** Nome curto para a marcação: primeiro e último nome ("Lucas Goncalves"). */
export function nomeMencao(nome = '') {
  const partes = String(nome).trim().toLowerCase().split(/\s+/).filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1));
  return partes.length > 1 ? `${partes[0]} ${partes[partes.length - 1]}` : (partes[0] || '');
}

/** Só as marcações que ainda estão no texto (a pessoa pode ter apagado). */
export const mencoesNoTexto = (texto = '', mencoes = []) => {
  const vistos = new Set();
  return mencoes.filter((m) => texto.includes(`@${m.nome}`) && !vistos.has(m.id) && vistos.add(m.id));
};

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Texto em pedaços para a tela: [{ texto }], [{ link, href }] e
 * [{ mencao, id }]. As marcações vêm de `mencoes` ([{ id, nome }]); o resto
 * passa por pedacosComLinks.
 */
export function pedacosDoTexto(texto = '', mencoes = []) {
  const lista = [...(mencoes || [])].filter((m) => m?.nome).sort((a, b) => b.nome.length - a.nome.length);
  if (!lista.length) return pedacosComLinks(texto);
  const re = new RegExp(`@(${lista.map((m) => escapar(m.nome)).join('|')})`, 'g');
  const out = [];
  let i = 0;
  for (const m of String(texto).matchAll(re)) {
    if (m.index > i) out.push(...pedacosComLinks(texto.slice(i, m.index)));
    const quem = lista.find((x) => x.nome === m[1]);
    out.push({ mencao: m[1], id: quem.id });
    i = m.index + m[0].length;
  }
  if (i < texto.length) out.push(...pedacosComLinks(texto.slice(i)));
  return out;
}

/** Marcação especial que avisa a empresa toda (só RH e admin; o banco confere). */
export const MENCAO_TODOS = { id: 'todos', nome: 'todos' };

const normal = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Pessoas para a lista do "@", filtradas na hora a partir do diretório
 * ([{ id, nome, funcao }]). Quem tem uma palavra do nome começando pelo termo
 * vem antes; depois, quem só contém. Sem acento e sem caixa. No máximo `max`.
 */
export function filtrarPessoas(diretorio = [], termo = '', max = 8) {
  const t = normal(termo).trim();
  if (!t) return diretorio.slice(0, max);
  const comeca = [];
  const contem = [];
  for (const p of diretorio) {
    const n = normal(p.nome);
    if (n.startsWith(t) || n.split(/\s+/).some((w) => w.startsWith(t)) || n.includes(` ${t}`)) comeca.push(p);
    else if (n.includes(t)) contem.push(p);
    if (comeca.length >= max) break;
  }
  return [...comeca, ...contem].slice(0, max);
}

/** Onde o termo aparece no nome mostrado, para destacar: [antes, achado, depois]. */
export function partesDestaque(nome = '', termo = '') {
  const t = normal(termo).trim();
  const i = t ? normal(nome).indexOf(t) : -1;
  if (i < 0) return [nome, '', ''];
  return [nome.slice(0, i), nome.slice(i, i + t.length), nome.slice(i + t.length)];
}
