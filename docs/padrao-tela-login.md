# Padrão de Tela de Login — PHD

Documento de referência para **replicar a tela de login em outros apps**.
A identidade visual (imagem de fundo, logo, cores) muda por app; o **layout,
a estrutura e o comportamento** descritos aqui são o padrão a manter.

Referência de implementação neste projeto:
- `src/pages/Login.jsx` — estrutura/markup e lógica
- `src/pages/Login.css` — estilos
- `index.html` — preload do fundo e favicon
- `public/` — arquivos de imagem

---

## 1. Descrição (visão geral)

Layout **split-screen** (duas colunas), em tela cheia (`100vh`):

```
┌───────────────────────────────┬──────────────────┐
│  PAINEL ESQUERDO (flexível)    │  PAINEL DIREITO  │
│                                │  (largura fixa)  │
│  [ Logo do produto (grande) ]  │                  │
│  Frase curta de descrição      │   [ logo cliente]│  ← opcional
│                                │   Entrar         │
│                                │   subtítulo      │
│  rodapé: empresa / CNPJ        │   [ E-mail     ] │
│                                │   [ Senha      ] │
│                                │   [  ENTRAR →  ] │
│   (sobre IMAGEM DE FUNDO       │   ───────────    │
│    com overlay escuro)         │   logo rodapé    │
└───────────────────────────────┴──────────────────┘
```

- **Painel esquerdo** (`flex: 1`): branding sobre a imagem de fundo, com um
  overlay escuro em gradiente para garantir legibilidade. Some no mobile.
- **Painel direito** (largura fixa **420px**): faixa clara translúcida
  (`rgba(255,255,255,0.88)` + `backdrop-filter: blur(16px)`) com o card de login.
  No mobile ocupa 100% da largura.
- A imagem de fundo cobre a tela inteira atrás dos dois painéis.

---

## 2. Imagens / assets (formato e specs)

Todos os arquivos ficam em **`public/`** e são referenciados pela raiz (`/arquivo.ext`).

| Asset | Arquivo (exemplo) | Formato | Dimensão recomendada | Peso alvo | Onde aparece |
|---|---|---|---|---|---|
| **Imagem de fundo** | `public/fundo.png` | JPG ou **WebP** (preferir) | 1920×1080+ (16:9), horizontal | **≤ 400 KB** | Cobre a tela toda (`.login-bg`) |
| **Logo do produto** | componente SVG `Logo.jsx` (ou `public/logo.svg`) | **SVG** (ideal) ou PNG transparente | vetorial / 256px+ | — | Painel esquerdo, grande |
| **Logo no rodapé do card** | `public/logo-phd.png` | PNG transparente | altura ~44px (2x do exibido 22px) | ≤ 50 KB | Rodapé do card direito |
| **Favicon** | `public/favicon.svg` | SVG (ou PNG 32×32) | — | — | Aba do navegador (`index.html`) |

> ⚠️ **Otimize o fundo.** Neste projeto o `fundo.png` está com ~20 MB — pesado
> demais. Para novos apps, exporte em **WebP/JPG ≤ 400 KB**; a tela carrega
> muito mais rápido. Mantenha sempre o **preload** no `index.html`:
> ```html
> <link rel="preload" as="image" href="/fundo.png" />
> ```

### Imagem de fundo — CSS de referência
```css
.login-bg {
  position: absolute;
  inset: 0;
  background-color: #0a0c12;            /* fallback enquanto carrega */
  background-image: url('/fundo.png');
  background-size: cover;
  background-position: center 30%;       /* ajuste o foco da foto */
  z-index: 0;
}
/* Overlay escuro p/ legibilidade do branding por cima */
.login-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg,
    rgba(10,12,18,0.85) 0%,
    rgba(10,12,18,0.68) 55%,
    rgba(10,12,18,0.42) 100%);
}
```

### Logo monocromática via filtro (opcional)
O logo do rodapé do card é PNG e recolorido por CSS `filter` para a cor da marca,
em vez de exportar várias versões:
```css
.login-card-logo {
  height: 22px; width: auto; opacity: 0.75;
  /* converte um PNG escuro para a cor da marca (gerar o filtro por app) */
  filter: brightness(0) saturate(100%) invert(38%) sepia(62%)
          saturate(1200%) hue-rotate(349deg) brightness(92%) contrast(98%);
}
```
> Gere o `filter` da nova cor com uma ferramenta de "hex to CSS filter".
> Alternativa mais simples: exportar o PNG/SVG já na cor certa e remover o filtro.

---

## 3. Parte de login (card + formulário)

O card fica no painel direito, **sem borda/sombra** (a faixa translúcida já o
destaca). Largura máxima do conteúdo: **22rem**.

Ordem dos elementos no card:
1. **(Opcional) Logo do cliente** — imagem centralizada no topo (≤ 72px de altura).
2. **Título** "Entrar" (`.login-card-title`).
3. **Subtítulo** "Informe sua conta para continuar".
4. **Formulário** (`.login-form`, coluna com `gap`):
   - Campo **E-mail** (`type="email"`, `autoComplete="email"`).
   - Campo **Senha** (`type="password"`, `autoComplete="current-password"`).
   - **Alerta de erro** (aparece só quando há erro).
   - **Botão Entrar** (`.login-submit`): largura total, cor da marca, com
     estado `disabled` + spinner enquanto carrega.
5. **Rodapé do card**: divisória + logo do produto (discreta).

### Estados do formulário
- **Carregando:** botão `disabled` mostrando spinner no lugar do texto.
- **Erro:** mensagem genérica ("E-mail ou senha inválidos.") — nunca revelar se
  foi o e-mail ou a senha (segurança).
- **Sucesso:** redireciona conforme o papel (ex.: admin → painel; demais → app).

### Markup de referência (resumido)
```jsx
<div className="login-page">
  <div className="login-bg" />
  <div className="login-content">
    {/* Painel esquerdo — branding */}
    <div className="login-left">
      <div className="login-left-inner">
        <Logo iconSize={72} textVariant="xl" light />
        <p className="login-left-desc">Frase curta do produto</p>
      </div>
      <p className="login-left-footer">Empresa · CNPJ 00.000.000/0001-00</p>
    </div>

    {/* Painel direito — card */}
    <div className="login-right">
      <div className="login-card">
        {/* logo do cliente (opcional) */}
        <h2 className="login-card-title">Entrar</h2>
        <p className="login-card-sub">Informe sua conta para continuar</p>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input type="email" className="form-input" autoComplete="email" required />
          </div>
          <div className="form-group">
            <label className="form-label">Senha</label>
            <input type="password" className="form-input" autoComplete="current-password" required />
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? <span className="spinner" /> : <>Entrar &rarr;</>}
          </button>
        </form>

        <div className="login-card-footer">
          <img src="/logo-phd.png" alt="Empresa" className="login-card-logo" />
        </div>
      </div>
    </div>
  </div>
</div>
```

---

## 4. Cores e tema

Tudo usa **CSS Custom Properties** (variáveis), então trocar a marca é trocar
as variáveis — não os componentes. As principais:

```css
--color-brand:        #c35e1e;  /* cor de ação principal (botão Entrar, foco) */
--color-brand-hover:  #a34c16;
--color-text:         #0f1117;
--color-text-muted:   #6b7385;
--color-border:       #e4e7ed;
--font-family:        'Inter', system-ui, sans-serif;
```

- O **botão Entrar** usa `var(--color-brand)` / `var(--color-brand-hover)`.
- O anel de foco usa `var(--color-brand)`.
- Para um novo app, defina essas variáveis em `:root` (arquivo de variáveis) e
  o login se adapta sozinho.

---

## 5. Responsivo

Breakpoint em **768px**:
```css
@media (max-width: 768px) {
  .login-left  { display: none; }            /* esconde o branding lateral */
  .login-right { width: 100%; padding: 3rem 1.75rem; } /* card ocupa a tela */
}
```
No mobile: só o painel do card aparece, em largura total, sobre a faixa clara.

---

## 6. Checklist para adaptar a um novo app

1. [ ] Trocar **`public/fundo.png`** pela imagem do app (WebP/JPG, ≤ 400 KB, 16:9).
2. [ ] Ajustar `background-position` em `.login-bg` para o foco da nova foto.
3. [ ] Trocar o **logo do produto** (componente `Logo`/SVG) no painel esquerdo.
4. [ ] Trocar **`public/logo-phd.png`** (logo do rodapé) e recalcular o `filter`
       de cor — ou exportar já colorido e remover o filtro.
5. [ ] Trocar **`public/favicon.svg`** e o `<title>` no `index.html`.
6. [ ] Definir as variáveis de cor (`--color-brand` etc.) com a paleta do app.
7. [ ] Ajustar textos: frase do painel esquerdo, rodapé (empresa/CNPJ),
       título/subtítulo do card.
8. [ ] Conferir o **preload** do fundo no `index.html`.
9. [ ] Testar no **mobile** (≤ 768px): card em tela cheia, branding oculto.

---

## 7. Resumo do que NÃO muda (o padrão)

- Estrutura split-screen (branding à esquerda sobre foto + card à direita).
- Painel direito **fixo em 420px** com fundo claro translúcido e blur.
- Card com título "Entrar", subtítulo, e-mail, senha, botão de largura total.
- Overlay escuro em gradiente sobre a foto de fundo.
- Erro genérico, botão com spinner no loading, redirecionamento por papel.
- Tudo dirigido por variáveis CSS e responsivo no breakpoint 768px.
