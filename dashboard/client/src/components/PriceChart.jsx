import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from '../context/ThemeContext';

export default function PriceChart({ summary }) {
  const { dark } = useTheme();

  if (!summary || !summary.byCountry) return null;

  const chartData = Object.entries(summary.byCountry).map(([country, count]) => ({
    country,
    productos: count,
  }));

  return (
    <div className={`rounded-xl p-6 border ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
      <h3 className={`text-sm font-semibold mb-4 ${dark ? 'text-white' : 'text-gray-900'}`}>Productos por Pais</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#334155' : '#E5E7EB'} />
          <XAxis dataKey="country" tick={{ fontSize: 12, fill: dark ? '#94A3B8' : '#6B7280' }} />
          <YAxis tick={{ fontSize: 12, fill: dark ? '#94A3B8' : '#6B7280' }} />
          <Tooltip
            contentStyle={{
              borderRadius: '8px',
              border: dark ? '1px solid #334155' : '1px solid #E5E7EB',
              fontSize: '12px',
              backgroundColor: dark ? '#1E293B' : '#FFFFFF',
              color: dark ? '#E2E8F0' : '#1F2937',
            }}
          />
          <Bar
            dataKey="productos"
            fill="#2563EB"
            radius={[4, 4, 0, 0]}
            maxBarSize={60}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryChart({ summary }) {
  const { dark } = useTheme();

  if (!summary?.topCategories) return null;

  const data = summary.topCategories.slice(0, 8).map(c => ({
    name: c.name.length > 20 ? c.name.slice(0, 20) + '...' : c.name,
    count: c.count,
  }));

  return (
    <div className={`rounded-xl p-6 border ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
      <h3 className={`text-sm font-semibold mb-4 ${dark ? 'text-white' : 'text-gray-900'}`}>Top Categorias</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#334155' : '#E5E7EB'} />
          <XAxis type="number" tick={{ fontSize: 11, fill: dark ? '#94A3B8' : '#6B7280' }} />
          <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: dark ? '#94A3B8' : '#6B7280' }} width={150} />
          <Tooltip
            contentStyle={{
              borderRadius: '8px',
              border: dark ? '1px solid #334155' : '1px solid #E5E7EB',
              fontSize: '12px',
              backgroundColor: dark ? '#1E293B' : '#FFFFFF',
              color: dark ? '#E2E8F0' : '#1F2937',
            }}
          />
          <Bar
            dataKey="count"
            fill="#7C3AED"
            radius={[0, 4, 4, 0]}
            maxBarSize={30}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
