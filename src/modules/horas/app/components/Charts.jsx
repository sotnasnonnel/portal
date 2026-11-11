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
  LabelList,
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

// Barras deitadas: o nome fica à esquerda, na horizontal, com espaço para ~26
// caracteres (16 no celular) em vez dos 14 inclinados das barras em pé. Cada
// linha tem altura fixa; se não couberem no quadro, ele rola por dentro em vez
// de espremer as barras. A duração vai escrita na ponta de cada barra.
const LINHA_PX = 30;
const fmtPonta = (h) => fmtHoras(h * 3600000);

function BarrasDeitadas({ data, onSelect, estreito }) {
  const larguraNome = estreito ? 110 : 170;
  const maxNome = estreito ? 16 : 26;
  const corta = (v) => {
    const s = String(v ?? '');
    return s.length > maxNome ? `${s.slice(0, maxNome - 1)}…` : s;
  };
  return (
    <div className="horas-chart-rola">
      <div style={{ height: Math.max(data.length * LINHA_PX + 16, 100), minHeight: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 56, left: 4, bottom: 4 }}
            barCategoryGap={6}
            onClick={(s) => s?.activeLabel && onSelect?.(s.activeLabel)}
          >
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={larguraNome}
              interval={0}
              tick={tickStyle}
              tickLine={false}
              axisLine={{ stroke: GRID }}
              tickFormatter={corta}
            />
            <Tooltip formatter={fmtTip} cursor={{ fill: 'rgba(196,74,40,.06)' }} />
            <Bar dataKey="horas" fill={PRIMARY} radius={[0, 6, 6, 0]} cursor="pointer" minPointSize={2} maxBarSize={22}>
              <LabelList dataKey="horas" position="right" formatter={fmtPonta} style={tickStyle} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function BrandBarChart({ data, onSelect }) {
  const estreito = useMediaQuery(ESTREITO);
  if (semDados(data)) return <Empty />;
  // Nome longo (tarefa, função, projeto) em barra em pé vira texto inclinado e
  // cortado — deita as barras e o nome passa a caber.
  if (data.some((d) => String(d.name ?? '').length > MAX_TICK)) {
    return <BarrasDeitadas data={data} onSelect={onSelect} estreito={estreito} />;
  }
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

// Legenda própria da rosca. A padrão do Recharts cresce com o número de itens
// e, no Dashboard da Equipe (dezenas de projetos, nomes longos), passava da
// altura e da largura do quadro. Aqui ela tem teto, rola por dentro e corta o
// nome com reticências — o nome inteiro fica no title (e no tooltip da fatia).
function LegendaRolavel({ payload = [], onSelect }) {
  return (
    <ul className="horas-legenda">
      {payload.map((p) => (
        <li key={p.value}>
          <button type="button" title={p.value} onClick={() => onSelect?.(p.value)}>
            <span className="horas-legenda-cor" style={{ background: p.color }} aria-hidden="true" />
            <span className="horas-legenda-nome">{p.value}</span>
          </button>
        </li>
      ))}
    </ul>
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
            rosca virava um anel minúsculo — embaixo ela usa a largura toda.
            O teto (largura à direita, altura embaixo) é o que impede a
            legenda de estourar o quadro quando há muitos itens. */}
        <Legend
          layout={estreito ? 'horizontal' : 'vertical'}
          align={estreito ? 'center' : 'right'}
          verticalAlign={estreito ? 'bottom' : 'middle'}
          content={<LegendaRolavel onSelect={onSelect} />}
          wrapperStyle={
            estreito
              ? { width: '100%', maxHeight: '38%', overflowY: 'auto' }
              : { width: '42%', maxHeight: '100%', overflowY: 'auto' }
          }
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
