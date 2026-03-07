import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import api from '../api/client';
import ContentPackList from '../components/ContentPackList';
import KeywordTable from '../components/KeywordTable';
import StatusBadge from '../components/StatusBadge';
import RunAgentButton from '../components/RunAgentButton';
import { PenTool, Download, FileSpreadsheet, Key, Layers, Sparkles, Search, ChevronRight, ChevronDown, ExternalLink, Loader2, TrendingUp, BarChart3, FileText, Zap, Bot, Check, X, Eye, EyeOff } from 'lucide-react';

export default function ContentAgent() {
  const { dark } = useTheme();
  const [pipelineStatus, setPipelineStatus] = useState(null);
  const [packs, setPacks] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [excelSheets, setExcelSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [packsLoading, setPacksLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('custom');
  const [runSummary, setRunSummary] = useState(null);

  // Custom generation state
  const [customKeyword, setCustomKeyword] = useState('');
  const [customGenerating, setCustomGenerating] = useState(false);
  const [customResult, setCustomResult] = useState(null);
  const [customPacks, setCustomPacks] = useState([]);
  const [customError, setCustomError] = useState('');

  // Agent name (dynamic)
  const [agentName, setAgentName] = useState('Contenido y RRSS');
  useEffect(() => {
    api.get('/agents').then(res => {
      const a = (res.data || []).find(a => a.slug === 'content-rrss');
      if (a?.name) setAgentName(a.name);
    }).catch(() => {});
    const h = () => api.get('/agents').then(res => {
      const a = (res.data || []).find(a => a.slug === 'content-rrss');
      if (a?.name) setAgentName(a.name);
    }).catch(() => {});
    window.addEventListener('agents-updated', h);
    return () => window.removeEventListener('agents-updated', h);
  }, []);

  // AI providers state
  const [aiStatus, setAiStatus] = useState({ providers: {}, activeCount: 0 });

  // Generation progress state
  const [genProgress, setGenProgress] = useState({ percent: 0, message: '', detail: '' });

  // Fetch all data from API
  const fetchAllData = () => {
    setPacksLoading(true);
    Promise.all([
      api.get('/content/pipeline-status').catch(() => ({ data: null })),
      api.get('/content/packs').catch(() => ({ data: [] })),
      api.get('/content/keywords').catch(() => ({ data: [] })),
      api.get('/content/excel/sheets').catch(() => ({ data: [] })),
      api.get('/content/custom-packs').catch(() => ({ data: { packs: [], summary: null } })),
      api.get('/content/last-run-summary').catch(() => ({ data: null })),
      api.get('/content/ai-status').catch(() => ({ data: { providers: {}, activeCount: 0 } })),
    ]).then(([statusRes, packsRes, keywordsRes, sheetsRes, customRes, summaryRes, aiRes]) => {
      setPipelineStatus(statusRes.data);
      setPacks(packsRes.data);
      setKeywords(keywordsRes.data);
      setExcelSheets(sheetsRes.data);
      setRunSummary(summaryRes.data);
      if (aiRes?.data) setAiStatus(aiRes.data);
      if (customRes.data?.summary) {
        setCustomResult(customRes.data.summary);
        setCustomPacks(customRes.data.packs);
        setCustomKeyword(customRes.data.summary.keyword || '');
      }
    }).catch(console.error)
      .finally(() => { setLoading(false); setPacksLoading(false); });
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleDownloadAll = () => {
    const token = localStorage.getItem('token');
    window.open(`/api/content/download-all?token=${token}`, '_blank');
  };

  const handleGenerateCustom = async () => {
    if (!customKeyword.trim() || customKeyword.trim().length < 2) return;
    setCustomGenerating(true);
    setCustomError('');
    setCustomResult(null);
    setCustomPacks([]);
    setGenProgress({ percent: 0, message: 'Iniciando...', detail: '' });

    // Poll progress every 800ms
    const pollId = setInterval(async () => {
      try {
        const prog = await api.get('/content/generate-progress');
        if (prog.data?.active) setGenProgress(prog.data);
      } catch {}
    }, 800);

    try {
      const res = await api.post('/content/generate-custom', {
        keyword: customKeyword.trim(),
        platforms: ['tiktok', 'instagram', 'facebook'],
      });
      setCustomResult(res.data);
      const packsRes = await api.get('/content/custom-packs');
      setCustomPacks(packsRes.data?.packs || []);
    } catch (err) {
      setCustomError(err.response?.data?.error || 'Error generando contenido');
    } finally {
      clearInterval(pollId);
      setCustomGenerating(false);
    }
  };

  const tabs = [
    { id: 'custom', label: 'Generar Ideas', icon: Sparkles },
    { id: 'packs', label: 'Guiones Base', icon: Layers },
    { id: 'keywords', label: 'Keywords', icon: Key },
    { id: 'excel', label: 'Info Complementaria', icon: FileSpreadsheet },
  ];

  return (
    <div>
      {/* Generation Progress Modal */}
      {customGenerating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-md mx-4 rounded-2xl shadow-2xl p-5 sm:p-8 ${dark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 mb-4">
                <Sparkles className="text-amber-400 animate-pulse" size={30} />
              </div>
              <h3 className={`text-lg font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
                Generando ideas de contenido
              </h3>
              <p className={`text-sm mt-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                Espera un momento por favor
              </p>
            </div>

            {/* Progress bar */}
            <div className={`w-full h-3 rounded-full mb-4 overflow-hidden ${dark ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-700 ease-out"
                style={{ width: `${Math.max(genProgress.percent, 3)}%` }}
              />
            </div>

            <p className={`text-sm text-center font-medium ${dark ? 'text-gray-200' : 'text-gray-700'}`}>
              {genProgress.message || 'Iniciando...'}
            </p>
            {genProgress.detail && (
              <p className={`text-xs text-center mt-1.5 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                {genProgress.detail}
              </p>
            )}

            <div className={`text-xs text-center mt-4 ${dark ? 'text-gray-600' : 'text-gray-300'}`}>
              {genProgress.percent}%
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className={`text-xl md:text-2xl font-bold mb-1 ${dark ? 'text-white' : 'text-gray-900'}`}>{agentName}</h1>
          <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
            Guiones para TikTok, Instagram, Facebook, YouTube y Blog
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {pipelineStatus && <StatusBadge status={pipelineStatus.status} date={pipelineStatus.lastRun} />}
          <RunAgentButton
            slug="content-rrss"
            color="#7C3AED"
            onComplete={fetchAllData}
          />
          <button
            onClick={handleDownloadAll}
            className="flex items-center gap-2 bg-accent-600 hover:bg-accent-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Descargar Todo</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className={`rounded-xl p-4 border ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
          <p className={`text-xs mb-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Content Packs</p>
          <p className={`text-xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{packs.length}</p>
        </div>
        <div className={`rounded-xl p-4 border ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
          <p className={`text-xs mb-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Keywords Rankeadas</p>
          <p className={`text-xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{Array.isArray(keywords) ? keywords.length : 0}</p>
        </div>
        <div className={`rounded-xl p-4 border ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
          <p className={`text-xs mb-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Hojas Excel</p>
          <p className={`text-xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{excelSheets.length}</p>
        </div>
      </div>

      {/* Two columns: Timeline + Content */}
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        {/* Left: Last Run Summary + AI Providers Config */}
        <div className="col-span-12 md:col-span-4 space-y-4">
          <LastRunSummary summary={runSummary} />
          <AIProvidersConfig status={aiStatus} onUpdate={setAiStatus} />
        </div>

        {/* Right: Tabs with content */}
        <div className="col-span-12 md:col-span-8">
          {/* Tab buttons */}
          <div className={`flex items-center gap-1 mb-4 rounded-lg p-1 flex-wrap ${dark ? 'bg-dark-bg' : 'bg-gray-100'}`}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? dark
                      ? 'bg-dark-card text-white shadow-sm'
                      : 'bg-white text-gray-900 shadow-sm'
                    : dark
                      ? 'text-gray-500 hover:text-gray-300'
                      : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon size={16} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'custom' && (
            <CustomGenerator
              keyword={customKeyword}
              setKeyword={setCustomKeyword}
              generating={customGenerating}
              result={customResult}
              packs={customPacks}
              error={customError}
              onGenerate={handleGenerateCustom}
            />
          )}

          {activeTab === 'packs' && (
            <ContentPackList packs={packs} loading={packsLoading} />
          )}

          {activeTab === 'keywords' && (
            <KeywordTable keywords={keywords} />
          )}

          {activeTab === 'excel' && (
            <ExcelViewer sheets={excelSheets} />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CUSTOM GENERATOR COMPONENT
// ============================================================================
function CustomGenerator({ keyword, setKeyword, generating, result, packs, error, onGenerate }) {
  const { dark } = useTheme();

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !generating) onGenerate();
  };

  return (
    <div>
      {/* Search Input */}
      <div className={`rounded-xl p-5 border mb-4 ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
        <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${dark ? 'text-white' : 'text-gray-900'}`}>
          <Sparkles size={16} className="text-amber-500" />
          Generador de Ideas por Keyword
        </h3>
        <p className={`text-xs mb-4 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
          Ingresa una palabra o frase en tendencia y generaremos ideas de contenido con guiones para TikTok, Instagram y Facebook
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${dark ? 'text-gray-500' : 'text-gray-400'}`} />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ej: gadgets, skincare coreano, smartwatch barato..."
              disabled={generating}
              className={`w-full pl-9 pr-4 py-2.5 rounded-lg border text-sm outline-none transition focus:ring-2 focus:ring-amber-500 ${
                dark
                  ? 'bg-dark-bg border-dark-border text-white placeholder-gray-500'
                  : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
              } ${generating ? 'opacity-50' : ''}`}
            />
          </div>
          <button
            onClick={onGenerate}
            disabled={generating || !keyword.trim() || keyword.trim().length < 2}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {generating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Generar Ideas
              </>
            )}
          </button>
        </div>

        {error && (
          <div className={`mt-3 p-3 rounded-lg text-sm ${dark ? 'bg-red-900/30 text-red-400 border border-red-800' : 'bg-red-50 border border-red-200 text-red-700'}`}>
            {error}
          </div>
        )}
      </div>

      {/* Trending suggestions from result */}
      {result?.trends?.combined?.length > 0 && (
        <div className={`rounded-xl p-5 border mb-4 ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-xs font-semibold mb-3 uppercase tracking-wider ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
            Tendencias encontradas para "{result.keyword}"
          </h3>
          <div className="flex flex-wrap gap-2">
            {result.trends.combined.map((trend, i) => (
              <button
                key={i}
                onClick={() => { setKeyword(trend); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border cursor-pointer ${
                  dark
                    ? 'bg-dark-bg border-dark-border text-gray-300 hover:border-amber-500 hover:text-amber-400'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-amber-500 hover:text-amber-600'
                }`}
              >
                {trend}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* AI error banner (when content was generated without AI) */}
      {result && result.gemini_error && (
        <div className={`rounded-xl p-4 border mb-4 ${dark ? 'bg-yellow-900/20 border-yellow-800' : 'bg-yellow-50 border-yellow-200'}`}>
          <p className={`text-xs font-semibold mb-1 ${dark ? 'text-yellow-300' : 'text-yellow-800'}`}>
            IA no disponible — contenido generado con templates
          </p>
          <p className={`text-xs ${dark ? 'text-yellow-400/80' : 'text-yellow-700'}`}>
            {result.gemini_error.message || 'Configura al menos una API Key (Gemini, ChatGPT o Claude) para contenido unico con IA.'}
          </p>
        </div>
      )}

      {/* Generated Packs (downloadable) */}
      {packs?.length > 0 && (
        <div>
          <div className={`rounded-xl border overflow-hidden mb-4 ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
            <div className={`px-5 py-3 border-b ${dark ? 'border-dark-border' : 'border-gray-100'}`}>
              <div className="flex items-center gap-2">
                <h3 className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>
                  {packs.length} Guiones Generados — {result?.vertical || 'Custom'}
                </h3>
                {result?.ai_powered && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                    <Bot size={10} />
                    IA
                  </span>
                )}
                {result && !result.ai_powered && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${dark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>
                    Templates
                  </span>
                )}
              </div>
              <p className={`text-xs mt-0.5 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                {result?.generated_at && `Generado: ${new Date(result.generated_at).toLocaleString('es-EC')}`}
                {result?.gemini_stats ? ` — ${result.gemini_stats.success} guiones IA` : ''}
                {result?.ideas_source === 'templates' && !result.ai_powered ? ' — Ideas basadas en plantillas' : ''}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {packs.map(pack => (
              <CustomPackItem key={pack.folder} pack={pack} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!result && !generating && (
        <div className={`rounded-xl p-12 text-center border ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
          <Sparkles size={40} className={`mx-auto mb-4 ${dark ? 'text-gray-600' : 'text-gray-300'}`} />
          <p className={`text-sm font-medium ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
            Escribe un keyword arriba para generar ideas de contenido
          </p>
          <p className={`text-xs mt-2 ${dark ? 'text-gray-600' : 'text-gray-400'}`}>
            Buscamos tendencias reales en Google y YouTube para crear guiones personalizados
          </p>
        </div>
      )}
    </div>
  );
}

function CustomPackItem({ pack }) {
  const { dark } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const handleDownload = (e, folder, file) => {
    e.stopPropagation();
    const token = localStorage.getItem('token');
    window.open(`/api/content/custom-packs/download/${encodeURIComponent(folder)}/${encodeURIComponent(file)}?token=${token}`, '_blank');
  };

  // Detect platform from filename
  const getPlatformInfo = (filename) => {
    if (filename.includes('TikTok')) return { name: 'TikTok', color: 'text-pink-500' };
    if (filename.includes('Instagram')) return { name: 'Instagram', color: 'text-purple-500' };
    if (filename.includes('Facebook')) return { name: 'Facebook', color: 'text-blue-600' };
    return { name: 'Otro', color: 'text-gray-500' };
  };

  const label = pack.label || pack.folder.replace(/^\d+_/, '').replace(/_/g, ' ');

  return (
    <div className={`border rounded-xl overflow-hidden ${dark ? 'border-dark-border' : 'border-gray-200'}`}>
      <div
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${dark ? 'hover:bg-dark-bg' : 'hover:bg-gray-50'}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {expanded
            ? <ChevronDown size={16} className={dark ? 'text-gray-500' : 'text-gray-400'} />
            : <ChevronRight size={16} className={dark ? 'text-gray-500' : 'text-gray-400'} />
          }
          <div className="min-w-0">
            <p className={`text-sm font-medium capitalize ${dark ? 'text-gray-200' : 'text-gray-900'}`}>{label}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {pack.files.map(f => {
                const info = getPlatformInfo(f);
                return (
                  <span key={f} className={`text-[11px] ${info.color}`}>{info.name}</span>
                );
              })}
            </div>
          </div>
        </div>
        <span className={`text-xs whitespace-nowrap ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{pack.fileCount} archivos</span>
      </div>

      {expanded && pack.files && (
        <div className={`border-t px-4 py-2 ${dark ? 'border-dark-border bg-dark-bg' : 'border-gray-100 bg-gray-50'}`}>
          {pack.files.map(file => (
            <div key={file} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={14} className={dark ? 'text-gray-500' : 'text-gray-400'} />
                <span className={`text-xs truncate ${dark ? 'text-gray-300' : 'text-gray-700'}`}>{file}</span>
              </div>
              <button
                onClick={(e) => handleDownload(e, pack.folder, file)}
                className="flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400 whitespace-nowrap ml-2"
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

// ============================================================================
// LAST RUN SUMMARY (replaces PhaseTimeline)
// ============================================================================
function LastRunSummary({ summary }) {
  const { dark } = useTheme();

  if (!summary || !summary.lastGenerated) {
    return (
      <div className={`rounded-xl p-6 text-center text-sm border ${dark ? 'bg-dark-card border-dark-border text-gray-500' : 'bg-white border-gray-200 text-gray-400'}`}>
        <Zap size={28} className="mx-auto mb-3 opacity-40" />
        Ejecuta "Buscar Ahora" para generar contenido con tendencias en tiempo real
      </div>
    );
  }

  const lastDate = new Date(summary.lastGenerated);
  const formatted = lastDate.toLocaleString('es-EC', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`rounded-xl border ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
      <div className={`px-5 py-4 border-b ${dark ? 'border-dark-border' : 'border-gray-100'}`}>
        <h3 className={`text-sm font-semibold flex items-center gap-2 ${dark ? 'text-white' : 'text-gray-900'}`}>
          <TrendingUp size={16} className="text-green-500" />
          Resumen Última Ejecución
        </h3>
        <p className={`text-xs mt-1 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{formatted}</p>
      </div>

      {/* Stats */}
      <div className={`px-5 py-3 grid grid-cols-2 gap-3 border-b ${dark ? 'border-dark-border' : 'border-gray-100'}`}>
        <div>
          <p className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>Tendencias</p>
          <p className={`text-lg font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{summary.totalTrends}</p>
        </div>
        <div>
          <p className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>Guiones</p>
          <p className={`text-lg font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{summary.docCount}</p>
        </div>
      </div>

      {/* Verticals */}
      {summary.verticalCounts && Object.keys(summary.verticalCounts).length > 0 && (
        <div className={`px-5 py-3 border-b ${dark ? 'border-dark-border' : 'border-gray-100'}`}>
          <p className={`text-[10px] uppercase tracking-wider font-semibold mb-2 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
            Por Vertical
          </p>
          <div className="space-y-1.5">
            {Object.entries(summary.verticalCounts).slice(0, 5).map(([v, count]) => (
              <div key={v} className="flex items-center justify-between">
                <span className={`text-xs ${dark ? 'text-gray-300' : 'text-gray-700'}`}>{v}</span>
                <span className={`text-xs font-mono ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{count} kw</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Keywords with sources */}
      {summary.topKeywords?.length > 0 && (
        <div className="px-5 py-3">
          <p className={`text-[10px] uppercase tracking-wider font-semibold mb-2 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
            Top Tendencias (fuentes reales)
          </p>
          <div className="space-y-1.5">
            {summary.topKeywords.slice(0, 10).map((kw, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-mono w-5 text-right ${dark ? 'text-gray-600' : 'text-gray-300'}`}>
                    {i + 1}
                  </span>
                  <span className={`text-xs flex-1 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {kw.keyword}
                  </span>
                  <div className="flex items-center gap-1">
                    {(kw.sources || []).map(src => (
                      <span key={src} className={`text-[9px] px-1 py-0.5 rounded font-medium ${
                        src === 'google' ? (dark ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-100 text-blue-600')
                        : src === 'youtube' ? (dark ? 'bg-red-900/40 text-red-300' : 'bg-red-100 text-red-600')
                        : src === 'tiktok' ? (dark ? 'bg-pink-900/40 text-pink-300' : 'bg-pink-100 text-pink-600')
                        : (dark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500')
                      }`}>
                        {src === 'google' ? 'G' : src === 'youtube' ? 'YT' : src === 'tiktok' ? 'TK' : src[0]?.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
                {kw.matchedProduct && (
                  <div className={`ml-7 flex items-center gap-2 px-2 py-1 rounded-lg ${dark ? 'bg-dark-card/50' : 'bg-gray-50'}`}>
                    {kw.matchedProduct.thumbnail && (
                      <img src={kw.matchedProduct.thumbnail} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />
                    )}
                    <span className={`text-[10px] flex-1 truncate ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {kw.matchedProduct.title?.length > 45 ? kw.matchedProduct.title.substring(0, 43) + '...' : kw.matchedProduct.title}
                    </span>
                    <span className={`text-[10px] font-semibold flex-shrink-0 ${dark ? 'text-green-400' : 'text-green-600'}`}>
                      ${kw.matchedProduct.price} {kw.matchedProduct.currency}
                    </span>
                    <span className={`text-[8px] px-1 py-0.5 rounded font-medium flex-shrink-0 ${
                      kw.matchedProduct.source === 'mercadolibre' ? (dark ? 'bg-yellow-900/30 text-yellow-300' : 'bg-yellow-100 text-yellow-700')
                      : kw.matchedProduct.source === 'amazon' ? (dark ? 'bg-orange-900/30 text-orange-300' : 'bg-orange-100 text-orange-700')
                      : (dark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500')
                    }`}>
                      {kw.matchedProduct.source === 'mercadolibre' ? 'ML' : kw.matchedProduct.source === 'amazon' ? 'AMZ' : kw.matchedProduct.source?.toUpperCase()}
                    </span>
                    {kw.matchedProduct.permalink && (
                      <a href={kw.matchedProduct.permalink} target="_blank" rel="noopener noreferrer"
                        className={`flex-shrink-0 p-0.5 rounded hover:opacity-80 transition-opacity ${dark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-500 hover:text-blue-600'}`}
                        title="Ver producto">
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className={`text-[9px] mt-2 ${dark ? 'text-gray-600' : 'text-gray-300'}`}>
            G = Google · YT = YouTube · TK = TikTok
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// AI PROVIDERS CONFIGURATION COMPONENT (Gemini, ChatGPT, Claude)
// ============================================================================
const PROVIDER_INFO = {
  gemini: { name: 'Gemini', color: 'blue', placeholder: 'AIzaSy...', link: 'https://aistudio.google.com/apikey', linkText: 'aistudio.google.com/apikey' },
  openai: { name: 'ChatGPT', color: 'green', placeholder: 'sk-...', link: 'https://platform.openai.com/api-keys', linkText: 'platform.openai.com/api-keys' },
  anthropic: { name: 'Claude', color: 'purple', placeholder: 'sk-ant-...', link: 'https://console.anthropic.com', linkText: 'console.anthropic.com' },
};

const PROVIDER_COLORS = {
  blue: { active: 'text-blue-500', border: 'border-blue-500/30', bg: 'bg-blue-500/10' },
  green: { active: 'text-green-500', border: 'border-green-500/30', bg: 'bg-green-500/10' },
  purple: { active: 'text-purple-500', border: 'border-purple-500/30', bg: 'bg-purple-500/10' },
};

function ProviderCard({ providerId, provider, info, onUpdate }) {
  const { dark } = useTheme();
  const [showInput, setShowInput] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [msg, setMsg] = useState('');

  const isActive = provider?.status === 'active';
  const hasError = provider?.status === 'error';
  const isConfigured = provider?.configured;
  const colors = PROVIDER_COLORS[info.color];

  const handleSave = async () => {
    if (!apiKey.trim() || apiKey.trim().length < 10) return;
    setSaving(true);
    setMsg('');
    try {
      await api.post('/content/ai-key', { provider: providerId, apiKey: apiKey.trim() });
      setShowInput(false);
      setApiKey('');
      const res = await api.get('/content/ai-status');
      if (res.data) onUpdate(res.data);
      const prov = res.data?.providers?.[providerId];
      setMsg(prov?.status === 'active' ? 'Activo' : 'Guardada pero: ' + (prov?.error?.message || 'error'));
      setTimeout(() => setMsg(''), 5000);
    } catch (err) {
      setMsg('Error: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/content/ai-key/${providerId}`);
      const res = await api.get('/content/ai-status');
      if (res.data) onUpdate(res.data);
      setMsg('Key eliminada');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg('Error: ' + (err.response?.data?.error || err.message));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={`rounded-lg border p-3 ${dark ? 'border-dark-border' : 'border-gray-200'} ${isActive ? (dark ? colors.border : colors.border) : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot size={14} className={isActive ? colors.active : hasError ? 'text-red-400' : dark ? 'text-gray-600' : 'text-gray-400'} />
          <span className={`text-xs font-semibold ${dark ? 'text-gray-200' : 'text-gray-800'}`}>{info.name}</span>
        </div>
        {isActive ? (
          <span className={`flex items-center gap-1 text-[10px] font-bold ${colors.active}`}>
            <Check size={10} /> Activo
          </span>
        ) : hasError ? (
          <span className="flex items-center gap-1 text-[10px] font-bold text-red-400">
            <X size={10} /> Error
          </span>
        ) : isConfigured ? (
          <span className={`text-[10px] ${dark ? 'text-yellow-400' : 'text-yellow-600'}`}>Verificando...</span>
        ) : (
          <span className={`text-[10px] ${dark ? 'text-gray-600' : 'text-gray-400'}`}>No configurado</span>
        )}
      </div>

      {isActive && (
        <p className={`text-[10px] mt-1 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
          Key: {provider.key}
        </p>
      )}

      {hasError && provider.error && (
        <div className={`mt-1.5 p-2 rounded text-[10px] ${dark ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'}`}>
          {provider.error.message}
        </div>
      )}

      {msg && (
        <p className={`text-[10px] mt-1 ${msg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{msg}</p>
      )}

      {!showInput && (
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={() => setShowInput(true)}
            className={`text-[10px] font-medium ${dark ? `${colors.active} hover:opacity-80` : `${colors.active} hover:opacity-80`}`}
          >
            {hasError ? 'Actualizar Key' : isConfigured ? 'Cambiar Key' : 'Agregar Key'}
          </button>
          {isConfigured && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className={`text-[10px] font-medium ${dark ? 'text-red-400 hover:text-red-300' : 'text-red-500 hover:text-red-600'}`}
            >
              {deleting ? '...' : 'Eliminar'}
            </button>
          )}
        </div>
      )}

      {showInput && (
        <div className="mt-2">
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={info.placeholder}
                className={`w-full pl-2.5 pr-7 py-1.5 rounded border text-[11px] outline-none ${
                  dark
                    ? 'bg-dark-bg border-dark-border text-white placeholder-gray-600'
                    : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
                }`}
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className={`absolute right-1.5 top-1/2 -translate-y-1/2 ${dark ? 'text-gray-500' : 'text-gray-400'}`}
              >
                {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || !apiKey.trim()}
              className="px-2.5 py-1.5 rounded bg-green-600 hover:bg-green-700 text-white text-[10px] font-medium disabled:opacity-50"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : 'OK'}
            </button>
            <button
              onClick={() => { setShowInput(false); setApiKey(''); }}
              className={`px-1.5 py-1.5 rounded text-[10px] ${dark ? 'text-gray-400 hover:bg-dark-bg' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <X size={12} />
            </button>
          </div>
          <p className={`text-[9px] mt-1 ${dark ? 'text-gray-600' : 'text-gray-400'}`}>
            <a href={info.link} target="_blank" rel="noopener noreferrer" className="underline">{info.linkText}</a>
          </p>
        </div>
      )}
    </div>
  );
}

function AIProvidersConfig({ status, onUpdate }) {
  const { dark } = useTheme();
  const { providers = {}, activeCount = 0 } = status;

  return (
    <div className={`rounded-xl border ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
      <div className={`px-5 py-3 border-b ${dark ? 'border-dark-border' : 'border-gray-100'}`}>
        <div className="flex items-center justify-between">
          <h3 className={`text-sm font-semibold flex items-center gap-2 ${dark ? 'text-white' : 'text-gray-900'}`}>
            <Sparkles size={16} className={activeCount > 0 ? 'text-purple-400' : dark ? 'text-gray-600' : 'text-gray-400'} />
            Proveedores IA
          </h3>
          <span className={`text-[10px] font-bold ${activeCount > 0 ? 'text-green-500' : dark ? 'text-gray-600' : 'text-gray-400'}`}>
            {activeCount}/3 activos
          </span>
        </div>
        {activeCount === 0 && (
          <p className={`text-[10px] mt-1 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
            Configura al menos una API Key para contenido unico con IA
          </p>
        )}
      </div>
      <div className="px-4 py-3 space-y-2">
        {Object.entries(PROVIDER_INFO).map(([id, info]) => (
          <ProviderCard
            key={id}
            providerId={id}
            provider={providers[id] || {}}
            info={info}
            onUpdate={onUpdate}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// EXCEL VIEWER (unchanged)
// ============================================================================
function ExcelViewer({ sheets }) {
  const { dark } = useTheme();
  const [selectedSheet, setSelectedSheet] = useState(sheets[0] || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sheets.length > 0 && !selectedSheet) {
      setSelectedSheet(sheets[0]);
    }
  }, [sheets]);

  useEffect(() => {
    if (!selectedSheet) return;
    setLoading(true);
    api.get('/content/excel/data', { params: { sheet: selectedSheet } })
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedSheet]);

  if (sheets.length === 0) {
    return (
      <div className={`rounded-xl p-6 text-center text-sm border ${dark ? 'bg-dark-card border-dark-border text-gray-500' : 'bg-white border-gray-200 text-gray-400'}`}>
        No hay archivo Excel disponible
      </div>
    );
  }

  const columns = data && data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
        {sheets.map(s => (
          <button
            key={s}
            onClick={() => setSelectedSheet(s)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedSheet === s
                ? 'bg-accent-600 text-white'
                : dark
                  ? 'bg-dark-bg text-gray-400 hover:bg-gray-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={`rounded-xl p-8 flex items-center justify-center border ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent-600" />
        </div>
      ) : data && data.length > 0 ? (
        <div className={`rounded-xl overflow-hidden border ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0">
                <tr className={`border-b ${dark ? 'bg-dark-bg border-dark-border' : 'bg-gray-50 border-gray-200'}`}>
                  {columns.map(col => (
                    <th key={col} className={`text-left px-3 py-2 font-medium whitespace-nowrap ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 100).map((row, i) => (
                  <tr key={i} className={`border-b transition-colors ${dark ? 'border-dark-border hover:bg-dark-bg' : 'border-gray-100 hover:bg-gray-50'}`}>
                    {columns.map(col => (
                      <td key={col} className={`px-3 py-2 break-words ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {String(row[col] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.length > 100 && (
            <div className={`px-4 py-2 border-t text-xs ${dark ? 'bg-dark-bg border-dark-border text-gray-500' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
              Mostrando 100 de {data.length} filas
            </div>
          )}
        </div>
      ) : (
        <div className={`rounded-xl p-6 text-center text-sm border ${dark ? 'bg-dark-card border-dark-border text-gray-500' : 'bg-white border-gray-200 text-gray-400'}`}>
          Hoja vacia
        </div>
      )}
    </div>
  );
}
