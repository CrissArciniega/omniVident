import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { TrendingUp, PenTool, Search, ArrowRight, Calendar } from 'lucide-react';
import StatusBadge from './StatusBadge';

const iconMap = { TrendingUp, PenTool };

function formatLastSearch(dateStr) {
  if (!dateStr) return 'Sin busquedas previas';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Sin busquedas previas';
  return date.toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function AgentCard({ agent }) {
  const navigate = useNavigate();
  const { dark } = useTheme();
  const Icon = iconMap[agent.icon] || TrendingUp;
  const link = agent.slug === 'market-research' ? '/market' : '/content';

  return (
    <div
      onClick={() => navigate(link)}
      className={`rounded-xl p-6 border cursor-pointer group transition-all ${
        dark
          ? 'bg-dark-card border-dark-border hover:border-gray-600'
          : 'bg-white border-gray-200 hover:shadow-md'
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${agent.color}15` }}>
          <Icon size={24} style={{ color: agent.color }} />
        </div>
        <StatusBadge status={agent.liveState?.status || 'sin datos'} date={agent.liveState?.lastRun} />
      </div>

      <h3 className={`text-base font-semibold mb-1 ${dark ? 'text-white' : 'text-gray-900'}`}>{agent.name}</h3>
      <p className={`text-sm mb-4 line-clamp-2 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{agent.description}</p>

      <div className="space-y-2 mb-4">
        <div className={`flex items-center gap-2 text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
          <Search size={14} />
          <span>Ultima busqueda: {formatLastSearch(agent.liveState?.lastRun)}</span>
        </div>
        <div className={`flex items-center gap-2 text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
          <Calendar size={14} />
          <span>{agent.schedule_description}</span>
        </div>
      </div>

      <div className={`flex items-center gap-1 text-sm font-medium transition-colors ${
        dark ? 'text-primary-400 group-hover:text-primary-300' : 'text-primary-600 group-hover:text-primary-700'
      }`}>
        Ver detalle
        <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
      </div>
    </div>
  );
}
