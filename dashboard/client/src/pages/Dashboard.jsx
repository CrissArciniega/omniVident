import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { canAccessAgent } from '../config/permissions';
import api from '../api/client';
import AgentCard from '../components/AgentCard';
import { Activity, Package, FileText } from 'lucide-react';

export default function Dashboard() {
  const { dark } = useTheme();
  const { user } = useAuth();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marketTotal, setMarketTotal] = useState(null);
  const [contentPacks, setContentPacks] = useState(null);

  const hasMarket = canAccessAgent(user?.role, 'market-research');
  const hasContent = canAccessAgent(user?.role, 'content-rrss');

  const fetchData = () => {
    const promises = [api.get('/agents')];
    promises.push(hasMarket ? api.get('/market/summary').catch(() => ({ data: {} })) : Promise.resolve({ data: {} }));
    promises.push(hasContent ? api.get('/content/packs').catch(() => ({ data: [] })) : Promise.resolve({ data: [] }));

    Promise.all(promises).then(([agentsRes, marketRes, contentRes]) => {
      setAgents(agentsRes.data);
      setMarketTotal(marketRes.data?.totalProducts || 0);
      setContentPacks(Array.isArray(contentRes.data) ? contentRes.data.length : 0);
    }).catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  const marketAgent = agents.find(a => a.slug === 'market-research');
  const contentAgent = agents.find(a => a.slug === 'content-rrss');

  return (
    <div>
      {/* Header */}
      <div className="mb-4 md:mb-8">
        <h1 className={`text-xl md:text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>Mission Control</h1>
        <p className={`text-sm mt-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
          Panel de control centralizado para todos los agentes de OmniVident
        </p>
      </div>

      {/* Stats */}
      <div className={`grid grid-cols-1 gap-4 mb-8 ${hasMarket && hasContent ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        <div className={`rounded-xl p-5 border ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${dark ? 'bg-primary-900/40' : 'bg-primary-50'}`}>
              <Activity size={20} className="text-primary-600" />
            </div>
            <div>
              <p className={`text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{agents.length}</p>
              <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Agentes activos</p>
            </div>
          </div>
        </div>

        {hasMarket && (
        <div className={`rounded-xl p-5 border ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${dark ? 'bg-blue-900/40' : 'bg-blue-50'}`}>
              <Package size={20} className={dark ? 'text-blue-400' : 'text-blue-600'} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
                {marketTotal != null ? marketTotal.toLocaleString() : '—'}
              </p>
              <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Productos analizados</p>
            </div>
          </div>
        </div>
        )}

        {hasContent && (
        <div className={`rounded-xl p-5 border ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${dark ? 'bg-accent-900/40' : 'bg-accent-50'}`}>
              <FileText size={20} className={dark ? 'text-accent-400' : 'text-accent-600'} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
                {contentPacks != null ? contentPacks : '—'}
              </p>
              <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Content Packs</p>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Agent Cards */}
      <h2 className={`text-lg font-semibold mb-4 ${dark ? 'text-white' : 'text-gray-900'}`}>Agentes</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {agents.map(agent => (
          <AgentCard key={agent.id} agent={agent} onUpdate={fetchData} />
        ))}
      </div>
    </div>
  );
}
