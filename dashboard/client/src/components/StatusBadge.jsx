function formatDate(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      // Try YYYYMMDD format
      if (/^\d{8}$/.test(dateStr)) {
        const y = dateStr.slice(0, 4);
        const m = dateStr.slice(4, 6);
        const da = dateStr.slice(6, 8);
        return `${da}/${m}/${y}`;
      }
      return null;
    }
    return d.toLocaleString('es-EC', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return null; }
}

const statusConfig = {
  completado: { bg: 'bg-green-50 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', dot: 'bg-green-500', label: 'Completado' },
  ejecutando: { bg: 'bg-yellow-50 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', dot: 'bg-yellow-500', label: 'Buscando...' },
  error: { bg: 'bg-red-50 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500', label: 'Error' },
  pendiente: { bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', dot: 'bg-gray-400', label: 'Sin buscar' },
  'sin datos': { bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-400 dark:text-gray-500', dot: 'bg-gray-300', label: 'Sin datos' },
};

export default function StatusBadge({ status, date }) {
  const config = statusConfig[status] || statusConfig['sin datos'];

  // If we have a date and status is not error/running, show date instead
  const formattedDate = formatDate(date);
  const displayLabel = (status === 'completado' || status === 'pendiente') && formattedDate
    ? formattedDate
    : config.label;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} ${status === 'ejecutando' ? 'animate-pulse' : ''}`} />
      {displayLabel}
    </span>
  );
}
