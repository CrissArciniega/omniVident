import { useTheme } from '../context/ThemeContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer, Treemap,
} from 'recharts';
import { Check, X } from 'lucide-react';

const SOURCE_COLORS_LIGHT = {
  mercadolibre: '#2D3277',
  amazon: '#FF9900',
  temu: '#FB7701',
  alibaba: '#E84C3D',
};

const SOURCE_COLORS_DARK = {
  mercadolibre: '#7B8CFF',
  amazon: '#FF9900',
  temu: '#FB7701',
  alibaba: '#E84C3D',
};

function useSourceColors() {
  const { dark } = useTheme();
  return dark ? SOURCE_COLORS_DARK : SOURCE_COLORS_LIGHT;
}

const SOURCE_LABELS = {
  mercadolibre: 'MercadoLibre',
  amazon: 'Amazon',
  temu: 'Temu',
  alibaba: 'Alibaba',
};

function ChartCard({ title, dark, children }) {
  return (
    <div className={`rounded-xl p-4 border ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
      <h4 className={`text-sm font-semibold mb-3 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>{title}</h4>
      {children}
    </div>
  );
}

export function MarketDominanceChart({ data, sources }) {
  const { dark } = useTheme();
  const SOURCE_COLORS = useSourceColors();
  if (!data || data.length === 0) return null;

  // Truncate category names
  const chartData = data.map(d => ({
    ...d,
    cat: d.category.length > 18 ? d.category.substring(0, 16) + '...' : d.category,
  }));

  return (
    <ChartCard title="Dominancia por Categoria" dark={dark}>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#374151' : '#e5e7eb'} />
          <XAxis dataKey="cat" tick={{ fontSize: 10, fill: dark ? '#9ca3af' : '#6b7280' }} angle={-25} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 10, fill: dark ? '#9ca3af' : '#6b7280' }} />
          <Tooltip
            contentStyle={{ backgroundColor: dark ? '#1f2937' : '#fff', border: 'none', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: dark ? '#e5e7eb' : '#111' }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {sources.map(src => (
            <Bar key={src} dataKey={src} stackId="a" fill={SOURCE_COLORS[src]} name={SOURCE_LABELS[src] || src} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function GeoDistributionChart({ data, sources }) {
  const { dark } = useTheme();
  const SOURCE_COLORS = useSourceColors();
  if (!data || data.length === 0) return null;

  return (
    <ChartCard title="Distribucion Geografica" dark={dark}>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#374151' : '#e5e7eb'} />
          <XAxis dataKey="country" tick={{ fontSize: 11, fill: dark ? '#9ca3af' : '#6b7280' }} />
          <YAxis tick={{ fontSize: 10, fill: dark ? '#9ca3af' : '#6b7280' }} />
          <Tooltip
            contentStyle={{ backgroundColor: dark ? '#1f2937' : '#fff', border: 'none', borderRadius: 8, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {sources.map(src => (
            <Bar key={src} dataKey={src} fill={SOURCE_COLORS[src]} name={SOURCE_LABELS[src] || src} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function PriceComparisonChart({ data, sources }) {
  const { dark } = useTheme();
  const SOURCE_COLORS = useSourceColors();
  if (!data || data.length === 0) return null;

  const chartData = data.map(d => ({
    ...d,
    cat: d.category.length > 18 ? d.category.substring(0, 16) + '...' : d.category,
  }));

  return (
    <ChartCard title="Precio Promedio por Categoria" dark={dark}>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#374151' : '#e5e7eb'} />
          <XAxis dataKey="cat" tick={{ fontSize: 10, fill: dark ? '#9ca3af' : '#6b7280' }} angle={-25} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 10, fill: dark ? '#9ca3af' : '#6b7280' }} tickFormatter={v => `$${v}`} />
          <Tooltip
            contentStyle={{ backgroundColor: dark ? '#1f2937' : '#fff', border: 'none', borderRadius: 8, fontSize: 12 }}
            formatter={(value) => [`$${value.toFixed(2)}`, '']}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {sources.map(src => (
            <Bar key={src} dataKey={src} fill={SOURCE_COLORS[src]} name={SOURCE_LABELS[src] || src} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function SourceDistributionChart({ data }) {
  const { dark } = useTheme();
  const SOURCE_COLORS = useSourceColors();
  if (!data || data.length === 0) return null;

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <ChartCard title="Distribucion por Marketplace" dark={dark}>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={75}
            paddingAngle={3}
            dataKey="value"
            label={false}
          >
            {data.map((entry) => (
              <Cell key={entry.source} fill={SOURCE_COLORS[entry.source] || '#888'} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: dark ? '#1f2937' : '#fff', border: 'none', borderRadius: 8, fontSize: 12 }}
            formatter={(value) => [`${value} productos (${((value / total) * 100).toFixed(1)}%)`, '']}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Legend below chart — always shows full names */}
      <div className="flex flex-col items-center gap-2 -mt-2">
        {data.map((entry) => (
          <div key={entry.source} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: SOURCE_COLORS[entry.source] || '#888' }} />
            <span className={`text-sm font-medium ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
              {entry.name}
            </span>
            <span className={`text-sm ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
              {entry.value} ({((entry.value / total) * 100).toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

export function CountryCoverageTable({ data, sources }) {
  const { dark } = useTheme();
  const SOURCE_COLORS = useSourceColors();
  if (!data || data.length === 0) return null;

  const countryFlags = { EC: '🇪🇨', MX: '🇲🇽', CO: '🇨🇴', USA: '🇺🇸', GLOBAL: '🌏' };

  return (
    <ChartCard title="Cobertura por Pais y Marketplace" dark={dark}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={`border-b ${dark ? 'border-dark-border' : 'border-gray-200'}`}>
              <th className={`text-left px-3 py-2 font-medium ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Pais</th>
              {sources.map(src => (
                <th key={src} className="text-center px-3 py-2 font-medium" style={{ color: SOURCE_COLORS[src] }}>
                  {SOURCE_LABELS[src] || src}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map(row => (
              <tr key={row.country} className={`border-b ${dark ? 'border-dark-border' : 'border-gray-100'}`}>
                <td className={`px-3 py-2 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {countryFlags[row.country] || ''} {row.country}
                </td>
                {sources.map(src => (
                  <td key={src} className="px-3 py-2 text-center">
                    {row[src] ? (
                      <Check size={16} className="inline text-green-500" />
                    ) : (
                      <X size={16} className="inline text-gray-400" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}

function TreemapContent({ x, y, width, height, name, dominantSource, size, dark }) {
  if (width < 40 || height < 30 || !name) return null;
  const colors = dark ? SOURCE_COLORS_DARK : SOURCE_COLORS_LIGHT;
  const color = colors[dominantSource] || '#6b7280';
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={color} fillOpacity={0.85} stroke="#fff" strokeWidth={2} rx={4} />
      {width > 60 && height > 40 && (
        <>
          <text x={x + width / 2} y={y + height / 2 - 6} textAnchor="middle" fill="#fff" fontSize={11} fontWeight="600">
            {name.length > 16 ? name.substring(0, 14) + '..' : name}
          </text>
          <text x={x + width / 2} y={y + height / 2 + 10} textAnchor="middle" fill="#ffffffcc" fontSize={10}>
            {size} prod.
          </text>
        </>
      )}
    </g>
  );
}

export function TopCategoriesTreemap({ data }) {
  const { dark } = useTheme();
  const SOURCE_COLORS = useSourceColors();
  if (!data || data.length === 0) return null;

  return (
    <ChartCard title="Top Categorias (color = marketplace dominante)" dark={dark}>
      <ResponsiveContainer width="100%" height={280}>
        <Treemap
          data={data}
          dataKey="size"
          nameKey="name"
          content={<TreemapContent dark={dark} />}
        />
      </ResponsiveContainer>
      <div className="flex items-center flex-wrap gap-2 sm:gap-4 mt-2 justify-center">
        {Object.entries(SOURCE_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: SOURCE_COLORS[key] }} />
            <span className={`text-[10px] ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{label}</span>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}
