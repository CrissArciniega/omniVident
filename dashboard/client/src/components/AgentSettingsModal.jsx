import { useState, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { X, Upload, Trash2, Loader2, TrendingUp, PenTool, BarChart3, Bot, Zap, ShoppingCart, Globe, Megaphone } from 'lucide-react';
import api from '../api/client';

const ICON_OPTIONS = [
  { name: 'TrendingUp', icon: TrendingUp, label: 'Tendencias' },
  { name: 'PenTool', icon: PenTool, label: 'Contenido' },
  { name: 'BarChart3', icon: BarChart3, label: 'Graficos' },
  { name: 'Bot', icon: Bot, label: 'Robot' },
  { name: 'Zap', icon: Zap, label: 'Rayo' },
  { name: 'ShoppingCart', icon: ShoppingCart, label: 'Compras' },
  { name: 'Globe', icon: Globe, label: 'Global' },
  { name: 'Megaphone', icon: Megaphone, label: 'Marketing' },
];

const DAY_OPTIONS = [
  { value: 1, label: 'L' },
  { value: 2, label: 'M' },
  { value: 3, label: 'X' },
  { value: 4, label: 'J' },
  { value: 5, label: 'V' },
  { value: 6, label: 'S' },
  { value: 0, label: 'D' },
];

const DAY_NAMES = { 0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mie', 4: 'Jue', 5: 'Vie', 6: 'Sab' };

function parseCron(cron) {
  try {
    const parts = (cron || '0 7 * * 1,3,5').split(' ');
    const minute = parseInt(parts[0]) || 0;
    const hour = parseInt(parts[1]) || 7;
    const daysStr = parts[4] || '*';
    const days = daysStr === '*' ? [0, 1, 2, 3, 4, 5, 6] : daysStr.split(',').map(Number);
    return { hour, minute, days };
  } catch {
    return { hour: 7, minute: 0, days: [1, 3, 5] };
  }
}

function buildCron(hour, minute, days) {
  const daysStr = days.length === 7 ? '*' : [...days].sort((a, b) => a - b).join(',');
  return `${minute} ${hour} * * ${daysStr}`;
}

function buildScheduleDesc(hour, minute, days) {
  const dayLabels = days.length === 7 ? 'Diario' : [...days].sort((a, b) => a - b).map(d => DAY_NAMES[d]).join('/');
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const m = minute.toString().padStart(2, '0');
  return `${dayLabels} — ${h12}:${m} ${ampm}`;
}

function resizeImage(dataUrl, maxSize = 256) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;
      canvas.width = maxSize;
      canvas.height = maxSize;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, sx, sy, size, size, 0, 0, maxSize, maxSize);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = dataUrl;
  });
}

const MAX_DESC_WORDS = 20;
const MAX_NAME_WORDS = 5;

// Strip special/dangerous characters, allow letters, accents, numbers, spaces, basic punctuation
const sanitize = (text) => text.replace(/[<>\/\\{}|^~`$#@&*=+\[\]%]/g, '');

function countWords(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export default function AgentSettingsModal({ agent, onClose, onSave }) {
  const { dark } = useTheme();
  const fileRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState(agent.name || '');
  const [description, setDescription] = useState(agent.description || '');
  const [selectedIcon, setSelectedIcon] = useState(agent.icon || 'TrendingUp');
  const [customImage, setCustomImage] = useState(agent.custom_image || null);
  const [useCustomImage, setUseCustomImage] = useState(!!agent.custom_image);
  const [previewImage, setPreviewImage] = useState(null);

  const parsed = parseCron(agent.schedule_cron);
  const [selectedDays, setSelectedDays] = useState(parsed.days);
  const [scheduleHour, setScheduleHour] = useState(parsed.hour);
  const [scheduleMinute, setScheduleMinute] = useState(parsed.minute);

  const nameWordCount = countWords(name);
  const descWordCount = countWords(description);

  const handleNameChange = (e) => {
    const val = sanitize(e.target.value);
    const words = val.trim().split(/\s+/).filter(Boolean);
    // Allow if under limit OR if user is deleting text
    if (words.length <= MAX_NAME_WORDS || val.length < name.length) {
      setName(val);
    }
  };

  const handleDescriptionChange = (e) => {
    const val = sanitize(e.target.value);
    const words = val.trim().split(/\s+/).filter(Boolean);
    if (words.length <= MAX_DESC_WORDS || val.length < description.length) {
      setDescription(val);
    }
  };

  const toggleDay = (dayValue) => {
    setSelectedDays(prev => {
      if (prev.includes(dayValue)) {
        if (prev.length === 1) return prev;
        return prev.filter(d => d !== dayValue);
      }
      return [...prev, dayValue];
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten imagenes');
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = async () => {
      setPreviewImage(reader.result);
      const resized = await resizeImage(reader.result, 256);
      setCustomImage(resized);
      setUseCustomImage(true);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setCustomImage(null);
    setPreviewImage(null);
    setUseCustomImage(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const timeValue = `${scheduleHour.toString().padStart(2, '0')}:${scheduleMinute.toString().padStart(2, '0')}`;
  const handleTimeChange = (e) => {
    const [h, m] = e.target.value.split(':').map(Number);
    if (!isNaN(h)) setScheduleHour(h);
    if (!isNaN(m)) setScheduleMinute(m);
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('El nombre es requerido'); return; }
    if (selectedDays.length === 0) { setError('Selecciona al menos un dia'); return; }
    setSaving(true);
    setError('');
    try {
      const cronExpr = buildCron(scheduleHour, scheduleMinute, selectedDays);
      const schedDesc = buildScheduleDesc(scheduleHour, scheduleMinute, selectedDays);
      const payload = {
        name: name.trim(),
        description: description.trim(),
        schedule_description: schedDesc,
        schedule_cron: cronExpr,
        icon: selectedIcon,
        custom_image: useCustomImage ? customImage : null,
      };
      await api.put(`/agents/${agent.slug}`, payload);
      window.dispatchEvent(new Event('agents-updated'));
      onSave();
    } catch (err) {
      setError(err.response?.data?.error || 'Error guardando');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = `w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
    dark ? 'bg-dark-bg border-dark-border text-white' : 'bg-white border-gray-300 text-gray-900'
  }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        onClick={e => e.stopPropagation()}
        className={`relative w-full max-w-md sm:max-w-lg rounded-2xl border shadow-2xl max-h-[90vh] overflow-y-auto ${
          dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-4 sm:px-6 py-4 border-b ${dark ? 'border-dark-border' : 'border-gray-100'}`}>
          <h3 className={`text-lg font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>Configurar Agente</h3>
          <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors ${dark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
            <X size={18} />
          </button>
        </div>

        <div className="px-4 sm:px-6 py-5 space-y-5">
          {/* Name */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={`text-sm font-medium ${dark ? 'text-gray-300' : 'text-gray-700'}`}>Nombre</label>
              <span className={`text-xs ${nameWordCount >= MAX_NAME_WORDS ? 'text-red-500 font-medium' : dark ? 'text-gray-500' : 'text-gray-400'}`}>
                {nameWordCount}/{MAX_NAME_WORDS} palabras
              </span>
            </div>
            <input value={name} onChange={handleNameChange} className={inputCls} />
          </div>

          {/* Description with word counter */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={`text-sm font-medium ${dark ? 'text-gray-300' : 'text-gray-700'}`}>Descripción</label>
              <span className={`text-xs ${descWordCount >= MAX_DESC_WORDS ? 'text-red-500 font-medium' : dark ? 'text-gray-500' : 'text-gray-400'}`}>
                {descWordCount}/{MAX_DESC_WORDS} palabras
              </span>
            </div>
            <textarea
              value={description}
              onChange={handleDescriptionChange}
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Schedule — free picker */}
          <div>
            <label className={`text-sm font-medium mb-2 block ${dark ? 'text-gray-300' : 'text-gray-700'}`}>Horario de ejecución</label>

            {/* Day buttons */}
            <div className="flex gap-1.5 mb-3">
              {DAY_OPTIONS.map(day => {
                const active = selectedDays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    onClick={() => toggleDay(day.value)}
                    className={`w-9 h-9 rounded-lg text-xs font-semibold transition-all ${
                      active
                        ? 'bg-primary-600 text-white shadow-sm'
                        : dark ? 'bg-dark-bg border border-dark-border text-gray-400 hover:border-gray-500' : 'bg-gray-50 border border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>

            {/* Time input */}
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={timeValue}
                onChange={handleTimeChange}
                className={`px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  dark ? 'bg-dark-bg border-dark-border text-white [color-scheme:dark]' : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
              <span className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                {buildScheduleDesc(scheduleHour, scheduleMinute, selectedDays)}
              </span>
            </div>
          </div>

          {/* Icon / Image */}
          <div>
            <label className={`text-sm font-medium mb-2 block ${dark ? 'text-gray-300' : 'text-gray-700'}`}>Icono o Imagen</label>

            {/* Image upload area with profile preview */}
            <div className={`mb-3 p-4 rounded-lg border ${dark ? 'border-dark-border' : 'border-gray-200'}`}>
              {useCustomImage && customImage ? (
                <div className="flex flex-col items-center gap-3">
                  {/* Profile preview */}
                  <div className="relative">
                    <img
                      src={customImage}
                      alt="Vista previa"
                      className="w-[120px] h-[120px] rounded-full object-cover ring-3 ring-gray-200 dark:ring-gray-600 shadow-lg"
                    />
                    <span className={`block text-center text-[10px] mt-1.5 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                      Vista previa de perfil
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    <button
                      onClick={() => fileRef.current?.click()}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        dark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <Upload size={12} className="inline mr-1" />
                      Cambiar
                    </button>
                    <button
                      onClick={handleRemoveImage}
                      className="text-xs px-3 py-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 size={12} className="inline mr-1" />
                      Quitar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${agent.color}15` }}>
                    {(() => {
                      const IconComp = ICON_OPTIONS.find(i => i.name === selectedIcon)?.icon || TrendingUp;
                      return <IconComp size={24} style={{ color: agent.color }} />;
                    })()}
                  </div>
                  <div>
                    <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    <button
                      onClick={() => fileRef.current?.click()}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        dark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <Upload size={12} className="inline mr-1" />
                      Subir imagen de perfil
                    </button>
                    <p className={`text-[10px] mt-1 ${dark ? 'text-gray-600' : 'text-gray-400'}`}>
                      Se recorta automaticamente a formato circular
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Icon selection (when no custom image) */}
            {!useCustomImage && (
              <div className="grid grid-cols-4 gap-2">
                {ICON_OPTIONS.map(opt => {
                  const IconComp = opt.icon;
                  const isSelected = selectedIcon === opt.name;
                  return (
                    <button
                      key={opt.name}
                      onClick={() => setSelectedIcon(opt.name)}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border transition-all ${
                        isSelected
                          ? (dark ? 'border-primary-500 bg-primary-900/30' : 'border-primary-500 bg-primary-50')
                          : (dark ? 'border-dark-border hover:border-gray-600' : 'border-gray-200 hover:border-gray-300')
                      }`}
                    >
                      <IconComp size={20} style={{ color: isSelected ? agent.color : (dark ? '#9ca3af' : '#6b7280') }} />
                      <span className={`text-[10px] ${isSelected ? (dark ? 'text-primary-300' : 'text-primary-600') : (dark ? 'text-gray-500' : 'text-gray-400')}`}>
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t ${dark ? 'border-dark-border' : 'border-gray-100'}`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              dark ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
