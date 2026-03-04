import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { LayoutDashboard, TrendingUp, PenTool, BarChart3, Bot, Zap, ShoppingCart, Globe, Megaphone, Sun, Moon } from 'lucide-react';
import api from '../api/client';

const iconMap = { TrendingUp, PenTool, BarChart3, Bot, Zap, ShoppingCart, Globe, Megaphone };

const AGENT_ROUTES = {
  'market-research': '/market',
  'content-rrss': '/content',
};

export default function Sidebar() {
  const { dark, toggle } = useTheme();
  const [agentItems, setAgentItems] = useState([]);

  const fetchAgents = () => {
    api.get('/agents').then(res => {
      setAgentItems(
        (res.data || []).map(a => ({
          to: AGENT_ROUTES[a.slug] || `/${a.slug}`,
          icon: iconMap[a.icon] || TrendingUp,
          label: a.name,
          customImage: a.custom_image || null,
          color: a.color,
        }))
      );
    }).catch(() => {});
  };

  useEffect(() => {
    fetchAgents();
    const handler = () => fetchAgents();
    window.addEventListener('agents-updated', handler);
    return () => window.removeEventListener('agents-updated', handler);
  }, []);

  return (
    <aside className={`w-64 flex flex-col h-screen fixed left-0 top-0 border-r transition-colors ${
      dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'
    }`}>
      {/* Logo */}
      <div className={`px-6 py-5 border-b ${dark ? 'border-dark-border' : 'border-gray-100'}`}>
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="El Mayorista" className="w-9 h-9 rounded-xl object-contain" />
          <div>
            <h1 className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>OmniVident</h1>
            <p className={`text-[11px] ${dark ? 'text-gray-500' : 'text-gray-400'}`}>El Mayorista</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? dark ? 'bg-primary-900/40 text-primary-400' : 'bg-primary-50 text-primary-700'
                : dark ? 'text-gray-400 hover:bg-dark-border hover:text-gray-200' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`
          }
        >
          <LayoutDashboard size={20} />
          Dashboard
        </NavLink>

        {agentItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? dark ? 'bg-primary-900/40 text-primary-400' : 'bg-primary-50 text-primary-700'
                  : dark ? 'text-gray-400 hover:bg-dark-border hover:text-gray-200' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className={`px-4 py-3 border-t flex items-center justify-between ${dark ? 'border-dark-border' : 'border-gray-100'}`}>
        <p className={`text-[11px] ${dark ? 'text-gray-600' : 'text-gray-400'}`}>v1.0</p>
        <button onClick={toggle} className={`p-2 rounded-lg transition-colors ${dark ? 'text-yellow-400 hover:bg-dark-border' : 'text-gray-400 hover:bg-gray-100'}`}>
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </aside>
  );
}
