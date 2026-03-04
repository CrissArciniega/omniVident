import { Star, ExternalLink, Trophy, ArrowUp, ArrowDown, Sparkles } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const countryFlags = { EC: '🇪🇨', MX: '🇲🇽', CO: '🇨🇴', USA: '🇺🇸', GLOBAL: '🌏' };

function formatPrice(price, currency) {
  const symbols = { USD: '$', MXN: 'MX$', COP: 'COP$' };
  const sym = symbols[currency] || '$';
  return `${sym}${Number(price).toLocaleString('es', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatSold(qty) {
  if (!qty || qty === 0) return '\u2014';
  if (qty >= 1000) return `+${(qty / 1000).toFixed(qty >= 10000 ? 0 : 0)}mil`;
  return `+${qty}`;
}

function RankingBadge({ ranking, label }) {
  if (!ranking && !label) return null;
  const rank = ranking || parseInt(label) || null;
  if (!rank) return null;

  const colors = {
    1: 'bg-amber-500/20 text-amber-500 border-amber-500/30',
    2: 'bg-gray-300/20 text-gray-400 border-gray-400/30',
    3: 'bg-orange-400/20 text-orange-400 border-orange-400/30',
  };

  const color = colors[rank] || 'bg-blue-500/10 text-blue-400 border-blue-400/20';

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${color}`}>
      {rank <= 3 && <Trophy size={10} />}
      #{rank}
    </span>
  );
}

const SOURCE_BADGE_STYLES = {
  amazon: { bg: '#FF990020', color: '#FF9900', border: '#FF990040', label: 'AMZ' },
  mercadolibre: {
    light: { bg: '#2D327715', color: '#2D3277', border: '#2D327730' },
    dark: { bg: '#FFE60020', color: '#FFE600', border: '#FFE60040' },
    label: 'ML',
  },
  temu: { bg: '#FB770120', color: '#FB7701', border: '#FB770140', label: 'TEMU' },
  alibaba: { bg: '#E84C3D20', color: '#E84C3D', border: '#E84C3D40', label: 'ALI' },
};

function SourceBadge({ source, dark: isDark }) {
  const raw = SOURCE_BADGE_STYLES[source] || SOURCE_BADGE_STYLES.mercadolibre;
  // ML has dark/light variants; others use same colors
  const style = raw.light
    ? (isDark ? raw.dark : raw.light)
    : raw;
  const label = raw.label || SOURCE_BADGE_STYLES[source]?.label || source;
  return (
    <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md border"
      style={{ backgroundColor: style.bg, color: style.color, borderColor: style.border }}>
      {label}
    </span>
  );
}

function TrendIndicators({ product, dark }) {
  const indicators = [];

  if (product.isNew) {
    indicators.push(
      <span key="new" className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
        <Sparkles size={8} />
        NUEVO
      </span>
    );
  }

  if (product.priceChange && Math.abs(product.priceChange) >= 5) {
    const isUp = product.priceChange > 0;
    indicators.push(
      <span key="price" className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.5 rounded border ${
        isUp
          ? 'bg-red-500/15 text-red-400 border-red-500/25'
          : 'bg-green-500/15 text-green-400 border-green-500/25'
      }`}>
        {isUp ? <ArrowUp size={8} /> : <ArrowDown size={8} />}
        {Math.abs(product.priceChange).toFixed(0)}%
      </span>
    );
  }

  if (product.rankingChange && Math.abs(product.rankingChange) >= 3) {
    const improved = product.rankingChange > 0;
    indicators.push(
      <span key="rank" className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.5 rounded border ${
        improved
          ? 'bg-blue-500/15 text-blue-400 border-blue-500/25'
          : 'bg-orange-500/15 text-orange-400 border-orange-500/25'
      }`}>
        {improved ? <ArrowUp size={8} /> : <ArrowDown size={8} />}
        {Math.abs(product.rankingChange)}pos
      </span>
    );
  }

  if (indicators.length === 0) return null;
  return <div className="flex items-center gap-1 mt-0.5 flex-wrap">{indicators}</div>;
}

export default function ProductTable({ products, loading, emptyMessage }) {
  const { dark } = useTheme();

  if (loading) {
    return (
      <div className={`rounded-xl p-8 flex items-center justify-center border ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className={`rounded-xl p-8 text-center text-sm border ${dark ? 'bg-dark-card border-dark-border text-gray-500' : 'bg-white border-gray-200 text-gray-400'}`}>
        {emptyMessage || 'No se encontraron productos. Ejecuta el agente de Estudio de Mercado para obtener datos.'}
      </div>
    );
  }

  return (
    <div className={`rounded-xl overflow-hidden border ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={`border-b ${dark ? 'bg-dark-bg border-dark-border' : 'bg-gray-50 border-gray-200'}`}>
              <th className={`text-center px-2 py-3 font-medium w-12 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Rank</th>
              <th className={`text-center px-2 py-3 font-medium w-12 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Fuente</th>
              <th className={`text-left px-4 py-3 font-medium ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Producto</th>
              <th className={`text-left px-3 py-3 font-medium ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Pais</th>
              <th className={`text-right px-4 py-3 font-medium ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Precio</th>
              <th className={`text-right px-4 py-3 font-medium ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Vendidos</th>
              <th className={`text-center px-3 py-3 font-medium ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Rating</th>
              <th className={`text-left px-3 py-3 font-medium ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Categoria</th>
              <th className={`text-center px-3 py-3 font-medium w-10 ${dark ? 'text-gray-400' : 'text-gray-500'}`}></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, i) => (
              <tr key={p.id + '-' + i} className={`border-b transition-colors ${dark ? 'border-dark-border hover:bg-dark-bg' : 'border-gray-100 hover:bg-gray-50'}`}>
                <td className="px-2 py-3 text-center">
                  <RankingBadge ranking={p.ranking} label={p.rankingLabel} />
                </td>
                <td className="px-2 py-3 text-center">
                  <SourceBadge source={p.source} dark={dark} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {p.thumbnail && (
                      <img
                        src={p.thumbnail}
                        alt=""
                        className={`w-10 h-10 rounded-lg object-cover shrink-0 ${dark ? 'bg-gray-700' : 'bg-gray-100'}`}
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    )}
                    <div className="min-w-0">
                      <span className={`font-medium line-clamp-1 ${dark ? 'text-gray-200' : 'text-gray-900'}`} title={p.title}>
                        {p.title}
                      </span>
                      {p.seller && (
                        <span className={`text-[11px] block ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                          {p.seller}
                        </span>
                      )}
                      <TrendIndicators product={p} dark={dark} />
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span className="inline-flex items-center gap-1">
                    <span>{countryFlags[p.country] || ''}</span>
                    <span className={dark ? 'text-gray-400' : 'text-gray-600'}>{p.country}</span>
                  </span>
                </td>
                <td className={`px-4 py-3 text-right font-medium ${dark ? 'text-gray-200' : 'text-gray-900'}`}>
                  {p.source === 'alibaba' && p.priceMin && p.priceMax && p.priceMin !== p.priceMax ? (
                    <div>
                      <span>{formatPrice(p.priceMin, 'USD')}-{formatPrice(p.priceMax, 'USD')}</span>
                      {p.moq && (
                        <span className={`block text-[10px] font-normal ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                          MOQ: {p.moq}
                        </span>
                      )}
                    </div>
                  ) : (
                    formatPrice(p.price, p.currency)
                  )}
                </td>
                <td className={`px-4 py-3 text-right font-medium ${
                  p.soldQuantity > 0
                    ? dark ? 'text-green-400' : 'text-green-600'
                    : dark ? 'text-gray-600' : 'text-gray-300'
                }`}>
                  {formatSold(p.soldQuantity)}
                </td>
                <td className="px-3 py-3 text-center">
                  {p.rating > 0 ? (
                    <span className="inline-flex items-center gap-1 text-amber-500">
                      <Star size={14} fill="currentColor" />
                      {p.rating.toFixed(1)}
                    </span>
                  ) : (
                    <span className={dark ? 'text-gray-600' : 'text-gray-300'}>{'\u2014'}</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <span className={`text-xs px-2 py-1 rounded-md whitespace-nowrap ${dark ? 'bg-dark-bg text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                    {p.category}
                  </span>
                </td>
                <td className="px-3 py-3 text-center">
                  {p.permalink && (
                    <a
                      href={p.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`transition-colors ${dark ? 'text-gray-500 hover:text-primary-400' : 'text-gray-400 hover:text-primary-600'}`}
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
