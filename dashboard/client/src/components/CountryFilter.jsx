import { useTheme } from '../context/ThemeContext';

const countryFlags = { EC: '🇪🇨 Ecuador', MX: '🇲🇽 Mexico', CO: '🇨🇴 Colombia', USA: '🇺🇸 USA' };

export default function CountryFilter({ countries, selected, onChange }) {
  const { dark } = useTheme();

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange('all')}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          selected === 'all'
            ? 'bg-primary-600 text-white'
            : dark
              ? 'bg-dark-bg text-gray-400 hover:bg-gray-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        Todos
      </button>
      {countries.map(c => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            selected === c
              ? 'bg-primary-600 text-white'
              : dark
                ? 'bg-dark-bg text-gray-400 hover:bg-gray-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {countryFlags[c] || c}
        </button>
      ))}
    </div>
  );
}
