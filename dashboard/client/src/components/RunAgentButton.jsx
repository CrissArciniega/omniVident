import { useState, useEffect, useRef } from 'react';
import { Play, Loader2, CheckCircle2, XCircle, AlertTriangle, Sparkles } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import api from '../api/client';

const AGENT_LABELS = {
  'content-rrss': {
    title: 'Generando contenido SEO y RRSS',
    subtitle: 'Buscando tendencias y creando guiones',
  },
  'market-research': {
    title: 'Realizando Estudio de Mercado',
    subtitle: 'MercadoLibre + Amazon en paralelo',
  },
};

export default function RunAgentButton({ slug, color = '#2563EB', onComplete }) {
  const { dark } = useTheme();
  const [state, setState] = useState('idle'); // idle | running | completed | error
  const [elapsed, setElapsed] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [progress, setProgress] = useState({ percent: 0, message: '', detail: '' });
  const timerRef = useRef(null);
  const pollRef = useRef(null);
  const progressRef = useRef(null);

  useEffect(() => {
    // Check if already running on mount
    api.get(`/agents/${slug}/running`)
      .then(res => {
        if (res.data.running) {
          setState('running');
          setElapsed(res.data.elapsedSeconds || 0);
        }
      })
      .catch(() => {});

    return () => {
      clearInterval(timerRef.current);
      clearInterval(pollRef.current);
      clearInterval(progressRef.current);
    };
  }, [slug]);

  useEffect(() => {
    if (state === 'running') {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);

      // Poll running status
      pollRef.current = setInterval(() => {
        api.get(`/agents/${slug}/running`)
          .then(res => {
            if (!res.data.running) {
              if (res.data.lastOutput && res.data.lastOutput.exitCode !== 0) {
                setState('error');
                setErrorMsg(res.data.lastOutput.stderr?.slice(0, 120) || 'La busqueda fallo');
              } else {
                setState('completed');
              }
              clearInterval(timerRef.current);
              clearInterval(pollRef.current);
              clearInterval(progressRef.current);
              if (onComplete) onComplete();
            }
          })
          .catch(() => {});
      }, 3000);

      // Poll progress
      progressRef.current = setInterval(() => {
        api.get(`/agents/${slug}/progress`)
          .then(res => {
            if (res.data) setProgress(res.data);
          })
          .catch(() => {});
      }, 800);
    }
    return () => {
      clearInterval(timerRef.current);
      clearInterval(pollRef.current);
      clearInterval(progressRef.current);
    };
  }, [state, slug, onComplete]);

  const handleRun = async () => {
    try {
      setErrorMsg('');
      setState('running');
      setElapsed(0);
      setProgress({ percent: 0, message: 'Iniciando...', detail: '' });
      const res = await api.post(`/agents/${slug}/run`);
      if (res.data.status === 'already_running') {
        setElapsed(res.data.elapsedSeconds || 0);
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al iniciar la busqueda';
      setErrorMsg(msg);
      setState('error');
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  // ── Progress Modal (shown when running) ──
  const modal = state === 'running' ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className={`w-full max-w-md mx-4 rounded-2xl shadow-2xl p-5 sm:p-8 ${dark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ backgroundColor: color + '18' }}>
            <Sparkles className="animate-pulse" size={30} style={{ color }} />
          </div>
          <h3 className={`text-lg font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
            {AGENT_LABELS[slug]?.title || 'Ejecutando agente'}
          </h3>
          <p className={`text-sm mt-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
            {AGENT_LABELS[slug]?.subtitle || 'Espera un momento por favor'}
          </p>
        </div>

        {/* Progress bar */}
        <div className={`w-full h-3 rounded-full mb-4 overflow-hidden ${dark ? 'bg-gray-700' : 'bg-gray-200'}`}>
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${Math.max(progress.percent, 3)}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)` }}
          />
        </div>

        <p className={`text-sm text-center font-medium ${dark ? 'text-gray-200' : 'text-gray-700'}`}>
          {progress.message || 'Iniciando...'}
        </p>
        {progress.detail && (
          <p className={`text-xs text-center mt-1.5 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
            {progress.detail}
          </p>
        )}

        <div className={`flex items-center justify-between mt-4 text-xs ${dark ? 'text-gray-600' : 'text-gray-300'}`}>
          <span>{progress.percent}%</span>
          <span>{formatTime(elapsed)}</span>
        </div>
      </div>
    </div>
  ) : null;

  if (state === 'running') {
    return (
      <>
        {modal}
        <button disabled className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg cursor-not-allowed border ${
          dark
            ? 'bg-yellow-900/30 text-yellow-400 border-yellow-800'
            : 'bg-yellow-50 text-yellow-700 border-yellow-200'
        }`}>
          <Loader2 size={16} className="animate-spin" />
          Buscando... {formatTime(elapsed)}
        </button>
      </>
    );
  }

  if (state === 'completed') {
    return (
      <button
        onClick={() => { setState('idle'); if (onComplete) onComplete(); }}
        className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors border ${
          dark
            ? 'bg-green-900/30 text-green-400 border-green-800 hover:bg-green-900/50'
            : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
        }`}
      >
        <CheckCircle2 size={16} />
        Completado — Actualizar datos
      </button>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          onClick={() => { setState('idle'); setErrorMsg(''); }}
          className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors border ${
            dark
              ? 'bg-red-900/30 text-red-400 border-red-800 hover:bg-red-900/50'
              : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
          }`}
        >
          <AlertTriangle size={16} />
          Error — Reintentar
        </button>
        {errorMsg && (
          <p className={`text-xs max-w-xs text-right ${dark ? 'text-red-400/70' : 'text-red-500/80'}`}>
            {errorMsg}
          </p>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={handleRun}
      className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
      style={{ backgroundColor: color }}
    >
      <Play size={16} />
      Buscar Ahora
    </button>
  );
}
