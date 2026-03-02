import { Star, ExternalLink } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const countryFlags = { EC: '🇪🇨', MX: '🇲🇽', CO: '🇨🇴', USA: '🇺🇸' };

function formatPrice(price, currency) {
  const symbols = { USD: '$', MXN: 'MX$', COP: 'COP$' };
  const sym = symbols[currency] || '$';
  return `${sym}${Number(price).toLocaleString('es', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function ProductTable({ products, loading }) {
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
        No se encontraron productos
      </div>
    );
  }

  return (
    <div className={`rounded-xl overflow-hidden border ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={`border-b ${dark ? 'bg-dark-bg border-dark-border' : 'bg-gray-50 border-gray-200'}`}>
              <th className={`text-left px-4 py-3 font-medium w-12 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>#</th>
              <th className={`text-left px-4 py-3 font-medium ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Producto</th>
              <th className={`text-left px-4 py-3 font-medium ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Pais</th>
              <th className={`text-right px-4 py-3 font-medium ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Precio</th>
              <th className={`text-right px-4 py-3 font-medium ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Vendidos</th>
              <th className={`text-center px-4 py-3 font-medium ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Rating</th>
              <th className={`text-left px-4 py-3 font-medium ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Categoria</th>
              <th className={`text-center px-4 py-3 font-medium w-12 ${dark ? 'text-gray-400' : 'text-gray-500'}`}></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, i) => (
              <tr key={p.id + '-' + i} className={`border-b transition-colors ${dark ? 'border-dark-border hover:bg-dark-bg' : 'border-gray-100 hover:bg-gray-50'}`}>
                <td className={`px-4 py-3 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{i + 1}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {p.thumbnail && (
                      <img
                        src={p.thumbnail}
                        alt=""
                        className={`w-10 h-10 rounded-lg object-cover ${dark ? 'bg-gray-700' : 'bg-gray-100'}`}
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    )}
                    <span className={`font-medium line-clamp-1 max-w-xs ${dark ? 'text-gray-200' : 'text-gray-900'}`} title={p.title}>
                      {p.title}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1">
                    <span>{countryFlags[p.country] || ''}</span>
                    <span className={dark ? 'text-gray-400' : 'text-gray-600'}>{p.country}</span>
                  </span>
                </td>
                <td className={`px-4 py-3 text-right font-medium ${dark ? 'text-gray-200' : 'text-gray-900'}`}>
                  {formatPrice(p.price, p.currency)}
                </td>
                <td className={`px-4 py-3 text-right ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {p.soldQuantity.toLocaleString('es')}
                </td>
                <td className="px-4 py-3 text-center">
                  {p.rating > 0 ? (
                    <span className="inline-flex items-center gap-1 text-amber-500">
                      <Star size={14} fill="currentColor" />
                      {p.rating.toFixed(1)}
                    </span>
                  ) : (
                    <span className={dark ? 'text-gray-600' : 'text-gray-300'}>—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-md ${dark ? 'bg-dark-bg text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                    {p.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
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
