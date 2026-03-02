import { TrendingUp, TrendingDown, Minus, Search } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

function TrendIcon({ direction }) {
  if (direction === 'rising' || direction === 'new')
    return <TrendingUp size={14} className="text-green-500" />;
  if (direction === 'declining')
    return <TrendingDown size={14} className="text-red-500" />;
  return <Minus size={14} className="text-gray-400" />;
}

const sourceStyles = {
  google: { label: 'Google', short: 'G', dark: 'bg-blue-900/40 text-blue-300', light: 'bg-blue-100 text-blue-700' },
  youtube: { label: 'YouTube', short: 'YT', dark: 'bg-red-900/40 text-red-300', light: 'bg-red-100 text-red-700' },
  tiktok: { label: 'TikTok', short: 'TK', dark: 'bg-pink-900/40 text-pink-300', light: 'bg-pink-100 text-pink-700' },
  amazon: { label: 'Amazon', short: 'AZ', dark: 'bg-orange-900/40 text-orange-300', light: 'bg-orange-100 text-orange-700' },
  instagram: { label: 'IG', short: 'IG', dark: 'bg-purple-900/40 text-purple-300', light: 'bg-purple-100 text-purple-700' },
};

function SourceBadges({ sources, dark }) {
  if (!sources || sources.length === 0) return <span className={`text-xs ${dark ? 'text-gray-600' : 'text-gray-300'}`}>—</span>;

  return (
    <div className="flex items-center gap-1 justify-center flex-wrap">
      {sources.map(src => {
        const style = sourceStyles[src] || { label: src, short: src[0]?.toUpperCase() || '?', dark: 'bg-gray-700 text-gray-400', light: 'bg-gray-100 text-gray-500' };
        return (
          <span
            key={src}
            title={style.label}
            className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-medium ${dark ? style.dark : style.light}`}
          >
            {style.short}
          </span>
        );
      })}
    </div>
  );
}

export default function KeywordTable({ keywords }) {
  const { dark } = useTheme();

  if (!keywords || keywords.length === 0) {
    return (
      <div className={`rounded-xl p-6 text-center text-sm border ${dark ? 'bg-dark-card border-dark-border text-gray-500' : 'bg-white border-gray-200 text-gray-400'}`}>
        <Search size={28} className="mx-auto mb-3 opacity-40" />
        Ejecuta "Buscar Ahora" para obtener keywords rankeadas de tendencias reales
      </div>
    );
  }

  // Handle both array of objects and nested structures
  const items = Array.isArray(keywords)
    ? keywords.map((k, i) => ({
        rank: k.rank || i + 1,
        keyword: k.keyword || k.name || '',
        score: k.weighted_total || k.score || 0,
        sourceCount: k.source_count || k.sources_found_in?.length || 0,
        sources: k.sources_found_in || [],
        direction: k.trend_data?.direction || k.direction || 'stable',
      }))
    : [];

  // Stats
  const googleCount = items.filter(k => k.sources.includes('google')).length;
  const youtubeCount = items.filter(k => k.sources.includes('youtube')).length;

  return (
    <div className="space-y-3">
      {/* Source legend */}
      <div className={`flex items-center gap-4 px-3 py-2 rounded-lg text-xs ${
        dark ? 'bg-dark-card border border-dark-border' : 'bg-gray-50 border border-gray-200'
      }`}>
        <span className={dark ? 'text-gray-400' : 'text-gray-500'}>
          {items.length} keywords rankeadas
        </span>
        {googleCount > 0 && (
          <span className={`inline-flex items-center gap-1 ${dark ? 'text-blue-400' : 'text-blue-600'}`}>
            <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${dark ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>G</span>
            Google Autocomplete ({googleCount})
          </span>
        )}
        {youtubeCount > 0 && (
          <span className={`inline-flex items-center gap-1 ${dark ? 'text-red-400' : 'text-red-600'}`}>
            <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${dark ? 'bg-red-900/40 text-red-300' : 'bg-red-100 text-red-700'}`}>YT</span>
            YouTube ({youtubeCount})
          </span>
        )}
      </div>

      <div className={`rounded-xl overflow-hidden border ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className={`border-b ${dark ? 'bg-dark-bg border-dark-border' : 'bg-gray-50 border-gray-200'}`}>
              <th className={`text-left px-4 py-3 font-medium w-12 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>#</th>
              <th className={`text-left px-4 py-3 font-medium ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Keyword</th>
              <th className={`text-center px-4 py-3 font-medium ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Relevancia</th>
              <th className={`text-center px-4 py-3 font-medium ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Fuente</th>
              <th className={`text-center px-4 py-3 font-medium ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Tendencia</th>
            </tr>
          </thead>
          <tbody>
            {items.map(k => (
              <tr key={k.rank} className={`border-b transition-colors ${dark ? 'border-dark-border hover:bg-dark-bg' : 'border-gray-100 hover:bg-gray-50'}`}>
                <td className={`px-4 py-3 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{k.rank}</td>
                <td className={`px-4 py-3 font-medium ${dark ? 'text-gray-200' : 'text-gray-900'}`}>{k.keyword}</td>
                <td className="px-4 py-3 text-center">
                  <div className="inline-flex items-center">
                    <div className={`w-16 h-2 rounded-full overflow-hidden mr-2 ${dark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                      <div
                        className="h-full bg-accent-500 rounded-full"
                        style={{ width: `${Math.min(100, k.score)}%` }}
                      />
                    </div>
                    <span className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-600'}`}>{k.score.toFixed(1)}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <SourceBadges sources={k.sources} dark={dark} />
                </td>
                <td className="px-4 py-3 text-center">
                  <TrendIcon direction={k.direction} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
