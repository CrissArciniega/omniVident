import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Eye, EyeOff, LogIn, Sun, Moon } from 'lucide-react';

export default function Login() {
  const { user, login } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Sanitize: block dangerous characters to prevent injection
  const sanitize = (val) => val.replace(/[/*<>,;'"\\{}()=|&$!`~]/g, '');

  const handleEmailChange = (e) => {
    const val = sanitize(e.target.value).slice(0, 50);
    setEmail(val);
  };

  const handlePasswordChange = (e) => {
    const val = sanitize(e.target.value).slice(0, 15);
    setPassword(val);
  };

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Correo y contraseña son requeridos');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Credenciales invalidas, correo o contraseña incorrecto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center px-4 transition-colors ${dark ? 'bg-dark-bg' : 'bg-gray-50'}`}>
      <button onClick={toggle} className={`absolute top-4 right-4 p-2.5 rounded-xl transition-colors ${dark ? 'text-yellow-400 hover:bg-dark-card' : 'text-gray-400 hover:bg-gray-200'}`}>
        {dark ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      {/* Logo — limpio, sin cuadro ni sombra */}
      <div className="mb-6 sm:mb-10 text-center">
        <img
          src="/logo.png"
          alt="El Mayorista"
          className="w-32 sm:w-44 h-auto object-contain mx-auto"
        />
        <h1 className={`text-2xl sm:text-3xl font-bold mt-4 ${dark ? 'text-white' : 'text-gray-900'}`}>OmniVident</h1>
      </div>

      {/* Formulario en su propio cuadro */}
      <div className="w-full max-w-md">
        <div className={`rounded-2xl shadow-sm border p-5 sm:p-8 ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
          <h2 className={`text-lg font-semibold mb-6 ${dark ? 'text-white' : 'text-gray-900'}`}>Iniciar Sesión</h2>

          {error && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${dark ? 'bg-red-900/30 text-red-400 border border-red-800' : 'bg-red-50 border border-red-200 text-red-700'}`}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>Correo:</label>
              <input type="email" value={email} onChange={handleEmailChange} placeholder="ejemplo@megamayorista.org" required maxLength={50}
                className={`w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition focus:ring-2 focus:ring-primary-500 ${dark ? 'bg-dark-bg border-dark-border text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`} />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1.5 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>Contraseña:</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={password} onChange={handlePasswordChange} required maxLength={15}
                  className={`w-full px-4 py-2.5 pr-10 rounded-xl border text-sm outline-none transition focus:ring-2 focus:ring-primary-500 ${dark ? 'bg-dark-bg border-dark-border text-white' : 'bg-white border-gray-300 text-gray-900'}`} />
                <button type="button" onClick={() => setShowPass(!showPass)} className={`absolute right-3 top-1/2 -translate-y-1/2 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 rounded-xl text-sm transition disabled:opacity-50">
              {loading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <LogIn size={18} />}
              {loading ? 'Ingresando...' : 'Iniciar Sesión'}
            </button>
          </form>
        </div>

        <p className={`text-center text-xs mt-6 ${dark ? 'text-gray-600' : 'text-gray-400'}`}>
          Mega Mayorista &copy; {new Date().getFullYear()} — OmniVident v1.0
        </p>
      </div>
    </div>
  );
}
