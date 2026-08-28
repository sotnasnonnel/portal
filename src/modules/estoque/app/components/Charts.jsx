import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { useMediaQuery } from '../../../../hooks/useMediaQuery';

/**
 * Gráficos do Estoque. Segue o padrão do Controle de Horas
 * (modules/horas/app/components/Charts.jsx) — mesma mecânica de eixos, corte de
 * rótulo e comportamento no celular — sem importar aquele arquivo, que é
 * acoplado a milissegundos e a fmtHoras.
 */

// Legenda e eixos do Recharts são props, não CSS — daí precisar saber em JS.
const ESTREITO = '(max-width: 600px)';
const GRID = '#e2e8f0';
const TICK = '#64748b';
const VIOLETA = '#6d28d9';
const AZUL = '#2563eb';
const VERDE = '#059669';
const VERMELHO = '#dc2626';
const PALETA = [VIOLETA, AZUL, VERDE, '#b45309', '#0891b2', '#be185d'];

const tickStyle = { fill: TICK, fontSize: 11, fontFamily: 'Inter' };
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// Nome de item com tamanho e CA não cabe no eixo e invade o vizinho. Corta com
// reticências — o nome inteiro continua no tooltip, que usa o valor cru.
const MAX_TICK = 16;
const cortaTick = (v) => {
  const s = String(v ?? '');
  return s.length > MAX_TICK ? `${s.slice(0, MAX_TICK - 1)}…` : s;
};

export function Vazio({ children = 'Sem dados no período.' }) {
  return <div className="est-grafico-vazio">{children}</div>;
}

const semDados = (data, chaves) =>
  !data?.length || data.every((d) => chaves.every((k) => !d[k]));

/** Reposição: barra do saldo contra a linha do mínimo, item a item. */
export function GraficoDeficit({ data }) {
  const estreito = useMediaQuery(ESTREITO);
  if (!data?.length) return <Vazio>Nada abaixo do mínimo. Estoque em dia.</Vazio>;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={tickStyle} tickLine={false} axisLine={{ stroke: GRID }} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={tickStyle} tickLine={false} axisLine={false}
          width={estreito ? 96 : 168} tickFormatter={cortaTick} />
        <Tooltip cursor={{ fill: 'rgba(109, 40, 217, .06)' }} />
        <Legend wrapperStyle={{ fontSize: 12, color: TICK }} />
        <Bar dataKey="saldo" name="Saldo" fill={VERMELHO} radius={[0, 5, 5, 0]} minPointSize={2} />
        <Bar dataKey="minimo" name="Mínimo" fill={GRID} radius={[0, 5, 5, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Consumo mês a mês, uma linha por categoria. */
export function GraficoConsumo({ data }) {
  if (semDados(data, ['epi', 'uniforme'])) return <Vazio />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={tickStyle} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tick={tickStyle} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12, color: TICK }} />
        <Line type="monotone" dataKey="epi" name="EPIs" stroke={VIOLETA} strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="uniforme" name="Uniformes" stroke={AZUL} strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Ranking horizontal — nome de item não cabe no eixo X em pé. */
export function GraficoRanking({ data, cor = VIOLETA, rotulo = 'Peças' }) {
  const estreito = useMediaQuery(ESTREITO);
  if (semDados(data, ['qtd'])) return <Vazio />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={tickStyle} tickLine={false} axisLine={{ stroke: GRID }} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={tickStyle} tickLine={false} axisLine={false}
          width={estreito ? 96 : 168} tickFormatter={cortaTick} />
        <Tooltip cursor={{ fill: 'rgba(109, 40, 217, .06)' }} />
        <Bar dataKey="qtd" name={rotulo} fill={cor} radius={[0, 5, 5, 0]} minPointSize={2} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GraficoEntradaSaida({ data }) {
  if (semDados(data, ['entrada', 'saida'])) return <Vazio />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={tickStyle} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tick={tickStyle} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12, color: TICK }} />
        <Bar dataKey="entrada" name="Entradas" fill={VERDE} radius={[5, 5, 0, 0]} />
        <Bar dataKey="saida" name="Saídas" fill={VERMELHO} radius={[5, 5, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GraficoValor({ data }) {
  const estreito = useMediaQuery(ESTREITO);
  if (semDados(data, ['valor'])) {
    return <Vazio>Nenhum item com custo unitário cadastrado ainda.</Vazio>;
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Tooltip formatter={(v) => BRL.format(v)} />
        {/* No celular a legenda vertical à direita come ~40% da largura e a
            rosca vira um anel minúsculo — embaixo ela usa a largura toda. */}
        <Legend
          layout={estreito ? 'horizontal' : 'vertical'}
          align={estreito ? 'center' : 'right'}
          verticalAlign={estreito ? 'bottom' : 'middle'}
          wrapperStyle={{ fontSize: 12, color: TICK, lineHeight: '20px' }}
        />
        <Pie data={data} dataKey="valor" nameKey="name" innerRadius="48%" outerRadius="82%" paddingAngle={1}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETA[i % PALETA.length]} stroke="#fff" strokeWidth={2} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
