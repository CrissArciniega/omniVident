import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { TrendingUp, PenTool, BarChart3, Bot, Zap, ShoppingCart, Globe, Megaphone, Search, ArrowRight, Calendar, Settings } from 'lucide-react';
import StatusBadge from './StatusBadge';
import AgentSettingsModal from './AgentSettingsModal';

const iconMap = { TrendingUp, PenTool, BarChart3, Bot, Zap, ShoppingCart, Globe, Megaphone };

function formatLastSearch(dateStr) {
  if (!dateStr) return 'Sin busquedas previas';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Sin busquedas previas';
  return date.toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function AgentCard({ agent, onUpdate }) {
  const navigate = useNavigate();
  const { dark } = useTheme();
  const [showSettings, setShowSettings] = useState(false);
  const Icon = iconMap[agent.icon] || TrendingUp;
  const link = agent.slug === 'market-research' ? '/market' : '/content';

  return (
    <>
    <div
      onClick={() => navigate(link)}
      className={`relative rounded-xl p-4 sm:p-6 border cursor-pointer group transition-all ${
        dark
          ? 'bg-dark-card border-dark-border hover:border-gray-600'
          : 'bg-white border-gray-200 hover:shadow-md'
      }`}
    >
      {/* Settings button */}
      <button
        onClick={e => { e.stopPropagation(); setShowSettings(true); }}
        className={`absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${
          dark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-400'
        }`}
        title="Configurar agente"
      >
        <Settings size={16} />
      </button>

      <div className="flex items-start justify-between mb-4">
        {agent.custom_image ? (
          <img src={agent.custom_image} alt={agent.name} className="w-[96px] h-[96px] rounded-full object-cover ring-2 ring-white dark:ring-gray-700 shadow-md transition-transform duration-300 ease-out group-hover:scale-125" />
        ) : (
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${agent.color}15` }}>
            <Icon size={24} style={{ color: agent.color }} />
          </div>
        )}
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

    {showSettings && (
      <AgentSettingsModal
        agent={agent}
        onClose={() => setShowSettings(false)}
        onSave={() => { setShowSettings(false); onUpdate?.(); }}
      />
    )}
    </>
  );
}
