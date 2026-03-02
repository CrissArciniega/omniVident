import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import api from '../api/client';
import ProductTable from '../components/ProductTable';
import CountryFilter from '../components/CountryFilter';
import PriceChart, { CategoryChart } from '../components/PriceChart';
import StatusBadge from '../components/StatusBadge';
import RunAgentButton from '../components/RunAgentButton';
import { TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';

export default function MarketAgent() {
  const { dark } = useTheme();
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [countries, setCountries] = useState([]);
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [country, setCountry] = useState('all');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('sold');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    Promise.all([
      api.get('/market/summary'),
      api.get('/market/countries'),
      api.get('/market/categories'),
      api.get('/agents/market-research/status'),
    ]).then(([summaryRes, countriesRes, categoriesRes, statusRes]) => {
      setSummary(summaryRes.data);
      setCountries(countriesRes.data);
      setCategories(categoriesRes.data);
      setStatus(statusRes.data);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    api.get('/market/products', { params: { country, category, sort, page, limit: 30 } })
      .then(res => {
        setProducts(res.data.products);
        setTotalPages(res.data.totalPages);
        setTotal(res.data.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [country, category, sort, page]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${dark ? 'bg-blue-900/40' : 'bg-blue-50'}`}>
              <TrendingUp size={22} className="text-primary-600" />
            </div>
            <h1 className={`text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>Estudio de Mercado</h1>
          </div>
          <p className={`text-sm ml-13 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
            Productos mas vendidos en MercadoLibre — Ecuador, Mexico, Colombia
          </p>
        </div>
        <div className="flex items-center gap-3">
          {status && <StatusBadge status={status.status} date={status.lastRun} />}
          <RunAgentButton
            slug="market-research"
            color="#2563EB"
            onComplete={() => window.location.reload()}
          />
        </div>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className={`rounded-xl p-4 border ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
            <p className={`text-xs mb-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Total Productos</p>
            <p className={`text-xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{summary.totalProducts.toLocaleString('es')}</p>
          </div>
          {Object.entries(summary.byCountry).map(([c, count]) => (
            <div key={c} className={`rounded-xl p-4 border ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
              <p className={`text-xs mb-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{c === 'EC' ? '🇪🇨 Ecuador' : c === 'MX' ? '🇲🇽 Mexico' : '🇨🇴 Colombia'}</p>
              <p className={`text-xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{count.toLocaleString('es')}</p>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <PriceChart summary={summary} />
        <CategoryChart summary={summary} />
      </div>

      {/* Filters */}
      <div className={`rounded-xl p-4 mb-4 border ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <CountryFilter countries={countries} selected={country} onChange={(c) => { setCountry(c); setPage(1); }} />

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

      {/* Table */}
      <ProductTable products={products} loading={loading} />

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
