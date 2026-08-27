import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { PALETTE } from '../../lib/aggregate';
import { fmtHoras } from '../../lib/format';
import { useMediaQuery } from '../../../../hooks/useMediaQuery';

// Legenda e eixos do Recharts são props, não CSS — daí precisar saber em JS.
const ESTREITO = '(max-width: 600px)';

const GRID = '#e2e8f0';
const TICK = '#64748b';
const PRIMARY = '#C44A28';

// 11px = --font-size-2xs. Aqui vai o número cru porque o tick vira atributo
// SVG (font-size="..."), e atributo de apresentação não resolve var().
const tickStyle = { fill: TICK, fontSize: 11, fontFamily: 'Inter' };

// Tooltip mostra a duração real (10s / 45min / 1,5h), não as horas arredondadas.
const fmtTip = (value, _name, item) => [fmtHoras(item?.payload?.ms ?? value * 3600000), 'Duração'];

// Eixo Y: quando o total é pequeno, "0,02h" não diz nada — mostra em min/s.
const fmtEixoY = (h) => fmtHoras(h * 3600000);

function Empty() {
  return <div className="horas-empty">Sem dados no período.</div>;
}

// Rótulo do eixo X: nomes de colaborador/projeto não cabem inteiros e um
// invade o vizinho. Corta com reticências — o nome completo continua no
// tooltip, que usa o valor cru (o tickFormatter só afeta o eixo).
const MAX_TICK = 14;
const cortaTick = (v) => {
  const s = String(v ?? '');
  return s.length > MAX_TICK ? `${s.slice(0, MAX_TICK - 1)}…` : s;
};

// true quando não há nada a plotar (lista vazia ou tudo zerado)
const semDados = (data) => !data.length || data.every((d) => !(d.ms ?? d.horas));

export function BrandBarChart({ data, onSelect }) {
  const estreito = useMediaQuery(ESTREITO);
  if (semDados(data)) return <Empty />;
  // Com rótulo longo (nome de pessoa/projeto) ou muitas barras, na horizontal
  // um nome encosta no outro — aí inclina e reserva altura para o eixo.
  const inclina = !estreito && (data.length > 6 || data.some((d) => String(d.name ?? '').length > 10));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 8, right: 12, left: 4, bottom: inclina ? 8 : 4 }}
        onClick={(s) => s?.activeLabel && onSelect?.(s.activeLabel)}
      >
        <CartesianGrid stroke={GRID} vertical={false} />
        {/* interval 0 força todos os rótulos; em tela estreita eles se sobrepõem
            e viram sopa de letras, então deixa o Recharts ralear. */}
        <XAxis
          dataKey="name"
          tick={tickStyle}
          interval={estreito ? 'preserveStartEnd' : 0}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          tickFormatter={cortaTick}
          tickMargin={inclina ? 4 : 6}
          angle={inclina ? -35 : 0}
          textAnchor={inclina ? 'end' : 'middle'}
          height={inclina ? 84 : 30}
        />
        <YAxis tick={tickStyle} tickLine={false} axisLine={false} width={estreito ? 38 : 54} tickFormatter={fmtEixoY} />
        <Tooltip formatter={fmtTip} cursor={{ fill: 'rgba(196,74,40,.06)' }} />
        <Bar dataKey="horas" fill={PRIMARY} radius={[6, 6, 0, 0]} cursor="pointer" minPointSize={2} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BrandLineChart({ data, onSelect }) {
  if (semDados(data)) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
        onClick={(s) => s?.activeLabel && onSelect?.(s.activeLabel)}
      >
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={tickStyle} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tick={tickStyle} tickLine={false} axisLine={false} width={54} tickFormatter={fmtEixoY} />
        <Tooltip formatter={fmtTip} />
        <Line
          type="monotone"
          dataKey="horas"
          stroke={PRIMARY}
          strokeWidth={2}
          dot={{ r: 3, fill: PRIMARY }}
          activeDot={{ r: 6, cursor: 'pointer' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BrandPieChart({ data, onSelect }) {
  const estreito = useMediaQuery(ESTREITO);
  if (semDados(data)) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Tooltip formatter={fmtTip} />
        {/* No celular a legenda vertical à direita comia ~40% da largura e a
            rosca virava um anel minúsculo — embaixo ela usa a largura toda. */}
        <Legend
          layout={estreito ? 'horizontal' : 'vertical'}
          align={estreito ? 'center' : 'right'}
          verticalAlign={estreito ? 'bottom' : 'middle'}
          wrapperStyle={{ fontSize: 'var(--font-size-xs)', color: TICK, lineHeight: '20px' }}
        />
        <Pie
          data={data}
          dataKey="horas"
          nameKey="name"
          innerRadius="48%"
          outerRadius="82%"
          paddingAngle={1}
          onClick={(entry) => entry?.name && onSelect?.(entry.name)}
          cursor="pointer"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} stroke="#fff" strokeWidth={2} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
