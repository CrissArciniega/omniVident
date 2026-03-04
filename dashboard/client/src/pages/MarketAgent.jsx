import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import api from '../api/client';
import ProductTable from '../components/ProductTable';
import CountryFilter from '../components/CountryFilter';
import PriceChart, { CategoryChart } from '../components/PriceChart';
import StatusBadge from '../components/StatusBadge';
import RunAgentButton from '../components/RunAgentButton';
import {
  MarketDominanceChart, GeoDistributionChart, PriceComparisonChart,
  SourceDistributionChart, CountryCoverageTable, TopCategoriesTreemap,
} from '../components/MarketStudyCharts';
import { TrendingUp, ChevronLeft, ChevronRight, Clock, Sparkles, Target, AlertTriangle, Lightbulb, Star, RefreshCw, GitCompare, BarChart3, ChevronDown, ChevronUp, ShoppingBag, MapPin } from 'lucide-react';

const COUNTRY_FLAGS = { EC: '🇪🇨', MX: '🇲🇽', CO: '🇨🇴', USA: '🇺🇸' };
const COUNTRY_NAMES = { EC: 'Ecuador', MX: 'México', CO: 'Colombia', USA: 'USA' };
const SOURCE_LABELS = { mercadolibre: 'MercadoLibre', amazon: 'Amazon' };

// Deriva cobertura REAL desde los datos del backend (sourceCoverage)
function getCoverageInfo(sourceCoverage, country) {
  if (!sourceCoverage || country === 'all') return null;

  const countryName = COUNTRY_NAMES[country] || country;
  const flag = COUNTRY_FLAGS[country] || '';
  const allSources = Object.keys(sourceCoverage);
  if (allSources.length <= 1) return null; // Solo 1 fuente, nada que comparar

  const available = [];
  const unavailable = [];
  for (const src of allSources) {
    if (sourceCoverage[src]?.[country]) {
      available.push(SOURCE_LABELS[src] || src);
    } else {
      unavailable.push(SOURCE_LABELS[src] || src);
    }
  }

  if (unavailable.length === 0) return null; // Todas las fuentes tienen datos

  return {
    message: `${flag} ${countryName}:  ${available.map(s => s + ' ✓').join('  ·  ')}  ·  ${unavailable.map(s => s + ' ✗').join('  ·  ')}`,
    detail: available.length > 0
      ? `Mostrando solo resultados de ${available.join(' y ')}`
      : 'No hay datos recopilados para este país',
  };
}

export default function MarketAgent() {
  const { dark } = useTheme();
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [countries, setCountries] = useState([]);
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [trends, setTrends] = useState(null);
  const [marketStudy, setMarketStudy] = useState(null);
  const [showStudy, setShowStudy] = useState(true);
  const [studyCountry, setStudyCountry] = useState('all');

  // Filters
  const [country, setCountry] = useState('all');
  const [category, setCategory] = useState('all');
  const [source, setSource] = useState('all');
  const [sort, setSort] = useState('sold');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchInsights = useCallback((force = false) => {
    setInsightsLoading(true);
    api.get('/market/insights', { params: force ? { refresh: 1 } : {} })
      .then(res => {
        if (res.data.insights) setInsights(res.data.insights);
      })
      .catch(() => {})
      .finally(() => setInsightsLoading(false));
  }, []);

  const fetchMarketStudy = useCallback(() => {
    const params = studyCountry !== 'all' ? { country: studyCountry } : {};
    api.get('/market/market-study', { params })
      .then(res => {
        if (res.data && !res.data.study) setMarketStudy(res.data);
        else if (res.data?.study === null) setMarketStudy(null);
      })
      .catch(console.error);
  }, [studyCountry]);

  const fetchAllData = useCallback(() => {
    Promise.all([
      api.get('/market/summary'),
      api.get('/market/countries'),
      api.get('/market/categories'),
      api.get('/agents/market-research/status'),
      api.get('/market/trends'),
    ]).then(([summaryRes, countriesRes, categoriesRes, statusRes, trendsRes]) => {
      setSummary(summaryRes.data);
      setCountries(countriesRes.data);
      setCategories(categoriesRes.data);
      setStatus(statusRes.data);
      if (trendsRes.data && trendsRes.data.summary) setTrends(trendsRes.data);
    }).catch(console.error);

    fetchMarketStudy();

    // Re-fetch products
    setLoading(true);
    api.get('/market/products', { params: { country, category, sort, source, page, limit: 30 } })
      .then(res => {
        setProducts(res.data.products);
        setTotalPages(res.data.totalPages);
        setTotal(res.data.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    fetchInsights();
  }, [country, category, sort, source, page, fetchInsights, fetchMarketStudy]);

  useEffect(() => {
    fetchAllData();
  }, []);

  // Re-fetch market study when country filter changes
  useEffect(() => {
    fetchMarketStudy();
  }, [studyCountry, fetchMarketStudy]);

  useEffect(() => {
    setLoading(true);
    api.get('/market/products', { params: { country, category, sort, source, page, limit: 30 } })
      .then(res => {
        setProducts(res.data.products);
        setTotalPages(res.data.totalPages);
        setTotal(res.data.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [country, category, sort, source, page]);

  const mlCount = summary?.bySource?.mercadolibre || 0;
  const amzCount = summary?.bySource?.amazon || 0;

  // Coverage info derived from real data
  const coverageInfo = getCoverageInfo(summary?.sourceCoverage, country);

  // Build empty-state message based on real coverage
  const getEmptyMessage = () => {
    if (!summary?.sourceCoverage) return undefined; // default message
    const sc = summary.sourceCoverage;
    const srcLabel = SOURCE_LABELS[source] || source;
    const ctryName = COUNTRY_NAMES[country] || country;
    // Specific source + specific country with no data
    if (source !== 'all' && country !== 'all' && !sc[source]?.[country]) {
      return `No hay datos de ${srcLabel} en ${ctryName}. No se recopila información de esta fuente para este país.`;
    }
    // Specific country, no source has data
    if (country !== 'all' && source === 'all') {
      const hasSome = Object.values(sc).some(m => m[country]);
      if (!hasSome) return `No hay datos recopilados para ${ctryName}.`;
    }
    return undefined;
  };

  const [agentName, setAgentName] = useState('Estudio de Mercado');
  useEffect(() => {
    api.get('/agents').then(res => {
      const a = (res.data || []).find(a => a.slug === 'market-research');
      if (a?.name) setAgentName(a.name);
    }).catch(() => {});
    const h = () => api.get('/agents').then(res => {
      const a = (res.data || []).find(a => a.slug === 'market-research');
      if (a?.name) setAgentName(a.name);
    }).catch(() => {});
    window.addEventListener('agents-updated', h);
    return () => window.removeEventListener('agents-updated', h);
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className={`text-2xl font-bold mb-1 ${dark ? 'text-white' : 'text-gray-900'}`}>{agentName}</h1>
          <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
            MercadoLibre + Amazon — EC, MX, CO, USA
          </p>
        </div>
        <div className="flex items-center gap-3">
          {status && <StatusBadge status={status.status} date={status.lastRun} />}
          <RunAgentButton
            slug="market-research"
            color="#2563EB"
            onComplete={fetchAllData}
          />
        </div>
      </div>

      {/* Summary Stats - 5 cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          <div className={`rounded-xl p-3 border ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
            <p className={`text-[10px] mb-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Total Productos</p>
            <p className={`text-lg font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{summary.totalProducts.toLocaleString('es')}</p>
          </div>
          <div className={`rounded-xl p-3 border ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
            <p className={`text-[10px] mb-1 flex items-center gap-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: dark ? '#FFE600' : '#2D3277' }} />
              MercadoLibre
            </p>
            <p className={`text-lg font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{mlCount.toLocaleString('es')}</p>
          </div>
          <div className={`rounded-xl p-3 border ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
            <p className={`text-[10px] mb-1 flex items-center gap-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: '#FF9900' }} />
              Amazon
            </p>
            <p className={`text-lg font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{amzCount.toLocaleString('es')}</p>
          </div>
          <div className={`rounded-xl p-3 border ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
            <p className={`text-[10px] mb-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Paises</p>
            <p className={`text-lg font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{Object.keys(summary.byCountry).length}</p>
          </div>
          <div className={`rounded-xl p-3 border ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
            <p className={`text-[10px] mb-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Rating Prom.</p>
            <p className={`text-lg font-bold text-amber-500 flex items-center gap-1`}>
              <Star size={14} fill="currentColor" />
              {summary.avgRating || '\u2014'}
            </p>
          </div>
        </div>
      )}

      {/* Last updated info */}
      {summary?.lastUpdated && (
        <div className={`flex items-center gap-2 mb-4 px-3 py-2 rounded-lg text-xs ${dark ? 'bg-dark-card border border-dark-border text-gray-400' : 'bg-gray-50 border border-gray-200 text-gray-500'}`}>
          <Clock size={12} />
          Ultima busqueda: {new Date(summary.lastUpdated).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      {/* Trends Panel */}
      {trends && trends.summary && (trends.summary.new_products > 0 || trends.summary.price_changes > 0 || trends.summary.ranking_changes > 0) && (
        <div className={`rounded-xl p-4 mb-6 border ${dark ? 'bg-gradient-to-r from-emerald-950/30 to-teal-950/20 border-emerald-800/40' : 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200'}`}>
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={16} className="text-emerald-500" />
            <h3 className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>Tendencias Detectadas</h3>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${dark ? 'bg-emerald-900/50 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
              vs busqueda anterior
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className={`rounded-lg p-2.5 text-center ${dark ? 'bg-emerald-900/30 border border-emerald-800/30' : 'bg-white/80 border border-emerald-100'}`}>
              <p className={`text-lg font-bold ${dark ? 'text-emerald-400' : 'text-emerald-600'}`}>{trends.summary.new_products}</p>
              <p className={`text-[10px] ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Nuevos</p>
            </div>
            <div className={`rounded-lg p-2.5 text-center ${dark ? 'bg-red-900/20 border border-red-800/30' : 'bg-white/80 border border-red-100'}`}>
              <p className={`text-lg font-bold ${dark ? 'text-red-400' : 'text-red-600'}`}>{trends.summary.dropped_products}</p>
              <p className={`text-[10px] ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Salieron</p>
            </div>
            <div className={`rounded-lg p-2.5 text-center ${dark ? 'bg-blue-900/20 border border-blue-800/30' : 'bg-white/80 border border-blue-100'}`}>
              <p className={`text-lg font-bold ${dark ? 'text-blue-400' : 'text-blue-600'}`}>{trends.summary.price_changes}</p>
              <p className={`text-[10px] ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Cambios precio</p>
            </div>
            <div className={`rounded-lg p-2.5 text-center ${dark ? 'bg-purple-900/20 border border-purple-800/30' : 'bg-white/80 border border-purple-100'}`}>
              <p className={`text-lg font-bold ${dark ? 'text-purple-400' : 'text-purple-600'}`}>{trends.summary.ranking_changes}</p>
              <p className={`text-[10px] ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Cambios ranking</p>
            </div>
            <div className={`rounded-lg p-2.5 text-center ${dark ? 'bg-yellow-900/20 border border-yellow-800/30' : 'bg-white/80 border border-yellow-100'}`}>
              <p className={`text-lg font-bold ${dark ? 'text-yellow-400' : 'text-yellow-600'}`}>{trends.summary.sales_velocity_changes}</p>
              <p className={`text-[10px] ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Aceleracion ventas</p>
            </div>
          </div>
        </div>
      )}

      {/* Market Study Visual Analysis */}
      {marketStudy && marketStudy.totalProducts > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setShowStudy(!showStudy)}
              className={`flex items-center gap-2 text-sm font-bold transition-colors ${dark ? 'text-gray-200 hover:text-white' : 'text-gray-700 hover:text-gray-900'}`}
            >
              <ShoppingBag size={16} className="text-primary-600" />
              Analisis Visual del Mercado
              {showStudy ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showStudy && (
              <select
                value={studyCountry}
                onChange={(e) => setStudyCountry(e.target.value)}
                className={`text-xs border rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-primary-500 outline-none ${
                  dark
                    ? 'bg-dark-bg border-dark-border text-gray-300'
                    : 'bg-white border-gray-300 text-gray-600'
                }`}
              >
                <option value="all">🌎 Todos los paises</option>
                {countries.map(c => (
                  <option key={c} value={c}>{COUNTRY_FLAGS[c] || ''} {COUNTRY_NAMES[c] || c}</option>
                ))}
              </select>
            )}
          </div>

          {showStudy && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <MarketDominanceChart data={marketStudy.dominance} sources={marketStudy.sources} />
              <SourceDistributionChart data={marketStudy.sourceDistribution} />
              <GeoDistributionChart data={marketStudy.geoDistribution} sources={marketStudy.sources} />
              <PriceComparisonChart data={marketStudy.priceComparison} sources={marketStudy.sources} />
              <CountryCoverageTable data={marketStudy.coverageMap} sources={marketStudy.sources} />
              <TopCategoriesTreemap data={marketStudy.topCategories} />
            </div>
          )}
        </div>
      )}

      {/* Basic Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <PriceChart summary={summary} />
        <CategoryChart summary={summary} />
      </div>

      {/* AI Insights — formato lista */}
      {insights && (
        <div className={`rounded-xl p-5 mb-6 border ${dark ? 'bg-gradient-to-br from-blue-950/40 to-indigo-950/30 border-blue-800/40' : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-blue-500" />
              <h3 className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>Analisis IA del Mercado</h3>
            </div>
            <button
              onClick={() => fetchInsights(true)}
              disabled={insightsLoading}
              className={`p-1.5 rounded-lg transition-colors ${dark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-blue-100 text-gray-500'} ${insightsLoading ? 'animate-spin' : ''}`}
              title="Regenerar analisis"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          <div className="space-y-3">
            {/* 1. Tendencia principal */}
            <div className={`flex items-start gap-3 rounded-lg p-3 ${dark ? 'bg-blue-900/20' : 'bg-white/60'}`}>
              <TrendingUp size={16} className="text-blue-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className={`text-xs font-semibold mb-0.5 ${dark ? 'text-blue-400' : 'text-blue-600'}`}>Tendencia Principal</p>
                <p className={`text-sm leading-relaxed ${dark ? 'text-gray-200' : 'text-gray-700'}`}>{insights.tendencia_principal}</p>
              </div>
            </div>

            {/* 2. Oportunidades */}
            <div className={`flex items-start gap-3 rounded-lg p-3 ${dark ? 'bg-green-900/15' : 'bg-white/60'}`}>
              <Target size={16} className="text-green-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className={`text-xs font-semibold mb-1 ${dark ? 'text-green-400' : 'text-green-600'}`}>Oportunidades</p>
                <ul className="space-y-1">
                  {insights.oportunidades?.map((op, i) => (
                    <li key={i} className={`text-sm flex items-start gap-2 ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
                      <span className="text-green-500 mt-0.5 shrink-0">•</span>
                      {op}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 3. Productos estrella */}
            <div className={`flex items-start gap-3 rounded-lg p-3 ${dark ? 'bg-yellow-900/15' : 'bg-white/60'}`}>
              <Star size={16} className="text-yellow-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className={`text-xs font-semibold mb-0.5 ${dark ? 'text-yellow-400' : 'text-yellow-600'}`}>Productos Estrella</p>
                <p className={`text-sm leading-relaxed ${dark ? 'text-gray-300' : 'text-gray-600'}`}>{insights.productos_estrella}</p>
              </div>
            </div>

            {/* 4. Comparacion marketplaces */}
            {insights.comparacion_marketplaces && (
              <div className={`flex items-start gap-3 rounded-lg p-3 ${dark ? 'bg-indigo-900/15' : 'bg-white/60'}`}>
                <GitCompare size={16} className="text-indigo-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className={`text-xs font-semibold mb-0.5 ${dark ? 'text-indigo-400' : 'text-indigo-600'}`}>Comparacion Marketplaces</p>
                  <p className={`text-sm leading-relaxed ${dark ? 'text-gray-300' : 'text-gray-600'}`}>{insights.comparacion_marketplaces}</p>
                </div>
              </div>
            )}

            {/* 5. Tendencias temporales */}
            {insights.tendencias_temporales && (
              <div className={`flex items-start gap-3 rounded-lg p-3 ${dark ? 'bg-teal-900/15' : 'bg-white/60'}`}>
                <BarChart3 size={16} className="text-teal-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className={`text-xs font-semibold mb-0.5 ${dark ? 'text-teal-400' : 'text-teal-600'}`}>Tendencias Temporales</p>
                  <p className={`text-sm leading-relaxed ${dark ? 'text-gray-300' : 'text-gray-600'}`}>{insights.tendencias_temporales}</p>
                </div>
              </div>
            )}

            {/* 6. Alerta de mercado */}
            <div className={`flex items-start gap-3 rounded-lg p-3 ${dark ? 'bg-orange-900/15' : 'bg-white/60'}`}>
              <AlertTriangle size={16} className="text-orange-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className={`text-xs font-semibold mb-0.5 ${dark ? 'text-orange-400' : 'text-orange-600'}`}>Alerta de Mercado</p>
                <p className={`text-sm leading-relaxed ${dark ? 'text-gray-300' : 'text-gray-600'}`}>{insights.alerta_mercado}</p>
              </div>
            </div>

            {/* 7. Recomendacion */}
            <div className={`flex items-start gap-3 rounded-lg p-3 ${dark ? 'bg-purple-900/15' : 'bg-white/60'}`}>
              <Lightbulb size={16} className="text-purple-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className={`text-xs font-semibold mb-0.5 ${dark ? 'text-purple-400' : 'text-purple-600'}`}>Recomendacion</p>
                <p className={`text-sm leading-relaxed ${dark ? 'text-gray-300' : 'text-gray-600'}`}>{insights.recomendacion}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Insights loading skeleton */}
      {insightsLoading && !insights && summary?.totalProducts > 0 && (
        <div className={`rounded-xl p-5 mb-6 border ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={18} className="text-blue-500 animate-pulse" />
            <p className={`text-sm font-medium ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Generando analisis con IA...</p>
          </div>
          <div className="space-y-2">
            <div className={`h-3 rounded-full w-3/4 animate-pulse ${dark ? 'bg-gray-700' : 'bg-gray-200'}`} />
            <div className={`h-3 rounded-full w-1/2 animate-pulse ${dark ? 'bg-gray-700' : 'bg-gray-200'}`} />
            <div className={`h-3 rounded-full w-2/3 animate-pulse ${dark ? 'bg-gray-700' : 'bg-gray-200'}`} />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className={`rounded-xl p-4 mb-4 border ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <CountryFilter countries={countries} selected={country} onChange={(c) => { setCountry(c); setPage(1); }} />

            <select
              value={source}
              onChange={(e) => { setSource(e.target.value); setPage(1); }}
              className={`text-xs border rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-primary-500 outline-none ${
                dark
                  ? 'bg-dark-bg border-dark-border text-gray-300'
                  : 'bg-white border-gray-300 text-gray-600'
              }`}
            >
              <option value="all">Todas las fuentes</option>
              <option value="mercadolibre">MercadoLibre</option>
              <option value="amazon">Amazon</option>
            </select>

            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1); }}
              className={`text-xs border rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-primary-500 outline-none ${
                dark
                  ? 'bg-dark-bg border-dark-border text-gray-300'
                  : 'bg-white border-gray-300 text-gray-600'
              }`}
            >
              <option value="all">Todas las categorias</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className={`text-xs border rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-primary-500 outline-none ${
                dark
                  ? 'bg-dark-bg border-dark-border text-gray-300'
                  : 'bg-white border-gray-300 text-gray-600'
              }`}
            >
              <option value="sold">Mas vendidos</option>
              <option value="ranking">Ranking oficial</option>
              <option value="price_asc">Precio ↑</option>
              <option value="price_desc">Precio ↓</option>
              <option value="rating">Mejor rating</option>
            </select>

            <span className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
              {total.toLocaleString('es')} resultados
            </span>
          </div>
        </div>
      </div>

      {/* Coverage info banner */}
      {coverageInfo && (
        <div className={`flex items-center gap-3 rounded-xl p-4 mb-4 border ${
          dark
            ? 'bg-blue-950/20 border-blue-800/30 text-blue-300'
            : 'bg-blue-50 border-blue-200 text-blue-700'
        }`}>
          <MapPin size={18} className="shrink-0" />
          <div>
            <p className="text-sm font-medium">{coverageInfo.message}</p>
            <p className={`text-xs mt-0.5 ${dark ? 'text-blue-400/70' : 'text-blue-500/80'}`}>{coverageInfo.detail}</p>
          </div>
        </div>
      )}

      {/* Table */}
      <ProductTable products={products} loading={loading} emptyMessage={getEmptyMessage()} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className={`p-2 rounded-lg border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
              dark
                ? 'border-dark-border text-gray-400 hover:bg-dark-card'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            <ChevronLeft size={16} />
          </button>
          <span className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
            Pagina {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className={`p-2 rounded-lg border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
              dark
                ? 'border-dark-border text-gray-400 hover:bg-dark-card'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
