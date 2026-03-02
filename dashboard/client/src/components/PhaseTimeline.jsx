import { CheckCircle2, Circle, Loader2, XCircle, Clock } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const phaseLabels = {
  phase1: { label: 'Investigacion de Keywords', desc: 'Recopila de 8 fuentes' },
  phase2: { label: 'Ranking de Keywords', desc: 'Deduplicacion y puntuacion' },
  phase3: { label: 'Generacion de Guiones', desc: '5 plataformas x 10 keywords' },
  phase4: { label: 'Diseno y Thumbnails', desc: 'Briefs y generacion de imagenes' },
  phase5: { label: 'Exportacion', desc: 'Google Drive y archivos locales' },
};

function PhaseIcon({ status }) {
  if (status === 'COMPLETED' || status === 'completed')
    return <CheckCircle2 size={20} className="text-green-500" />;
  if (status === 'RUNNING' || status === 'running')
    return <Loader2 size={20} className="text-yellow-500 animate-spin" />;
  if (status === 'FAILED' || status === 'failed')
    return <XCircle size={20} className="text-red-500" />;
  return <Circle size={20} className="text-gray-400 dark:text-gray-600" />;
}

function formatDuration(seconds) {
  if (!seconds) return '';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const min = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  return `${min}m ${sec}s`;
}

export default function PhaseTimeline({ phases }) {
  const { dark } = useTheme();

  if (!phases || phases.length === 0) {
    return (
      <div className={`rounded-xl p-6 text-center text-sm border ${dark ? 'bg-dark-card border-dark-border text-gray-500' : 'bg-white border-gray-200 text-gray-400'}`}>
        No hay datos del proceso disponibles
      </div>
    );
  }

  return (
    <div className={`rounded-xl p-6 border ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
      <h3 className={`text-sm font-semibold mb-5 ${dark ? 'text-white' : 'text-gray-900'}`}>Progreso de Generacion</h3>
      <div className="space-y-4">
        {phases.map((phase, i) => {
          const info = phaseLabels[phase.name] || { label: phase.name, desc: '' };
          return (
            <div key={phase.name} className="flex items-start gap-3">
              {/* Connector line */}
              <div className="flex flex-col items-center">
                <PhaseIcon status={phase.status} />
                {i < phases.length - 1 && (
                  <div className={`w-px h-8 mt-1 ${dark ? 'bg-dark-border' : 'bg-gray-200'}`} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 -mt-0.5">
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-medium ${dark ? 'text-gray-200' : 'text-gray-900'}`}>{info.label}</p>
                  {phase.duration > 0 && (
                    <span className={`flex items-center gap-1 text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                      <Clock size={12} />
                      {formatDuration(phase.duration)}
                    </span>
                  )}
                </div>
                <p className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-500'}`}>{info.desc}</p>
                {phase.errors?.length > 0 && (
                  <p className="text-xs text-red-500 mt-1">{phase.errors[0]}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
