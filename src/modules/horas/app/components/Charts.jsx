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

const GRID = '#e2e8f0';
const TICK = '#64748b';
const PRIMARY = '#C44A28';

const tickStyle = { fill: TICK, fontSize: 11, fontFamily: 'Inter' };
const fmtTip = (v) => [`${v}h`, 'Horas'];

function Empty() {
  return <div className="horas-empty">Sem dados.</div>;
}

// Barras — clique numa barra dispara onSelect(name).
export function BrandBarChart({ data, onSelect }) {
  if (!data.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, left: -12, bottom: 4 }}
        onClick={(s) => s?.activeLabel && onSelect?.(s.activeLabel)}
      >
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={tickStyle} interval={0} angle={0} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tick={tickStyle} tickLine={false} axisLine={false} />
        <Tooltip formatter={fmtTip} cursor={{ fill: 'rgba(196,74,40,.06)' }} />
        <Bar dataKey="horas" fill={PRIMARY} radius={[6, 6, 0, 0]} cursor="pointer" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Linha — clique num ponto dispara onSelect(name).
export function BrandLineChart({ data, onSelect }) {
  if (!data.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{ top: 8, right: 8, left: -12, bottom: 4 }}
        onClick={(s) => s?.activeLabel && onSelect?.(s.activeLabel)}
      >
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={tickStyle} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tick={tickStyle} tickLine={false} axisLine={false} />
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

// Rosca — clique numa fatia dispara onSelect(name).
export function BrandPieChart({ data, onSelect }) {
  if (!data.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Tooltip formatter={fmtTip} />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          wrapperStyle={{ fontSize: 11, color: TICK }}
        />
        <Pie
          data={data}
          dataKey="horas"
          nameKey="name"
          innerRadius="45%"
          outerRadius="80%"
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
