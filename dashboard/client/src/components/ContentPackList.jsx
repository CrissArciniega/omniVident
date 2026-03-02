import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Download, FileText, ChevronDown, ChevronRight, Film, Camera, MessageSquare, TrendingUp, Sparkles, Search } from 'lucide-react';

const platformIcons = {
  TikTok: Film,
  Instagram: Camera,
  Facebook: MessageSquare,
  YouTube: Film,
  Blog: FileText,
};

const platformColors = {
  TikTok: 'text-pink-500',
  Instagram: 'text-purple-500',
  Facebook: 'text-blue-600',
  YouTube: 'text-red-500',
  Blog: 'text-green-600',
};

const sourceLabels = {
  google: { label: 'Google', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  youtube: { label: 'YouTube', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  tiktok: { label: 'TikTok', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300' },
  amazon: { label: 'Amazon', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  instagram: { label: 'Instagram', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
};

function PackItem({ pack }) {
  const { dark } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const handleDownload = (e, folder, file) => {
    e.stopPropagation();
    const token = localStorage.getItem('token');
    window.open(`/api/content/download/${encodeURIComponent(folder)}/${encodeURIComponent(file)}?token=${token}`, '_blank');
  };

  return (
    <div className={`border rounded-xl overflow-hidden ${dark ? 'border-dark-border' : 'border-gray-200'}`}>
      <div
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${
          dark ? 'hover:bg-dark-bg' : 'hover:bg-gray-50'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {expanded
            ? <ChevronDown size={16} className={`flex-shrink-0 ${dark ? 'text-gray-500' : 'text-gray-400'}`} />
            : <ChevronRight size={16} className={`flex-shrink-0 ${dark ? 'text-gray-500' : 'text-gray-400'}`} />
          }
          <div className="min-w-0 flex-1">
            {/* Full title — no truncation */}
            <p className={`text-sm font-medium leading-snug ${dark ? 'text-gray-200' : 'text-gray-900'}`}>
              {pack.label}
            </p>

            {/* Metadata row: keyword + vertical + platforms + trend sources */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
              {/* Keyword badge */}
              {pack.keyword && (
                <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md ${
                  dark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                }`}>
                  <Search size={10} />
                  {pack.keyword}
                </span>
              )}

              {/* Vertical badge */}
              {pack.vertical && (
                <span className={`text-[11px] px-1.5 py-0.5 rounded-md ${
                  dark ? 'bg-indigo-900/30 text-indigo-300' : 'bg-indigo-50 text-indigo-600'
                }`}>
                  {pack.vertical}
                </span>
              )}

              {/* Trend source badges */}
              {pack.trendSources && pack.trendSources.length > 0 && (
                <>
                  <span className={`text-[10px] ${dark ? 'text-gray-600' : 'text-gray-300'}`}>|</span>
                  <TrendingUp size={10} className={dark ? 'text-green-400' : 'text-green-600'} />
                  {pack.trendSources.map(src => {
                    const info = sourceLabels[src] || { label: src, color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' };
                    return (
                      <span key={src} className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${info.color}`}>
                        {info.label}
                      </span>
                    );
                  })}
                </>
              )}

              {/* AI badge */}
              {pack.generatedWithAI && (
                <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                  dark ? 'bg-violet-900/30 text-violet-300' : 'bg-violet-50 text-violet-600'
                }`}>
                  <Sparkles size={9} />
                  IA
                </span>
              )}
            </div>

            {/* Platform icons */}
            <div className="flex items-center gap-2 mt-1">
              {pack.platforms.map(p => {
                const Icon = platformIcons[p] || FileText;
                return (
                  <span key={p} className={`inline-flex items-center gap-1 text-[11px] ${platformColors[p] || 'text-gray-500'}`}>
                    <Icon size={12} />
                    {p}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
        <span className={`text-xs flex-shrink-0 ml-2 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{pack.fileCount} archivos</span>
      </div>

      {expanded && pack.files && (
        <div className={`border-t px-4 py-2 ${dark ? 'border-dark-border bg-dark-bg' : 'border-gray-100 bg-gray-50'}`}>
          {pack.files.map(file => (
            <div key={file} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={14} className={`flex-shrink-0 ${dark ? 'text-gray-500' : 'text-gray-400'}`} />
                <span className={`text-xs truncate ${dark ? 'text-gray-300' : 'text-gray-700'}`}>{file}</span>
              </div>
              <button
                onClick={(e) => handleDownload(e, pack.folder, file)}
                className={`flex items-center gap-1 text-xs flex-shrink-0 ml-2 transition-colors ${
                  dark ? 'text-primary-400 hover:text-primary-300' : 'text-primary-600 hover:text-primary-700'
                }`}
              >
                <Download size={14} />
                Descargar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ContentPackList({ packs, loading }) {
  const { dark } = useTheme();

  if (loading) {
    return (
      <div className={`rounded-xl p-8 flex items-center justify-center border ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent-600" />
      </div>
    );
  }

  if (!packs || packs.length === 0) {
    return (
      <div className={`rounded-xl p-8 text-center text-sm border ${dark ? 'bg-dark-card border-dark-border text-gray-500' : 'bg-white border-gray-200 text-gray-400'}`}>
        No hay content packs disponibles
      </div>
    );
  }

  // Count stats
  const aiCount = packs.filter(p => p.generatedWithAI).length;
  const trendCount = packs.filter(p => p.trendSources && p.trendSources.length > 0).length;

  return (
    <div className="space-y-3">
      {/* Stats bar */}
      {(aiCount > 0 || trendCount > 0) && (
        <div className={`flex items-center gap-4 px-3 py-2 rounded-lg text-xs ${
          dark ? 'bg-dark-card border border-dark-border' : 'bg-gray-50 border border-gray-200'
        }`}>
          <span className={dark ? 'text-gray-400' : 'text-gray-500'}>
            {packs.length} guiones base
          </span>
          {trendCount > 0 && (
            <span className={`inline-flex items-center gap-1 ${dark ? 'text-green-400' : 'text-green-600'}`}>
              <TrendingUp size={12} />
              {trendCount} basados en tendencias reales
            </span>
          )}
          {aiCount > 0 && (
            <span className={`inline-flex items-center gap-1 ${dark ? 'text-violet-400' : 'text-violet-600'}`}>
              <Sparkles size={12} />
              {aiCount} generados con IA
            </span>
          )}
        </div>
      )}

      {packs.map(pack => (
        <PackItem key={pack.folder} pack={pack} />
      ))}
    </div>
  );
}
