import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import { canAccessAgent } from './config/permissions';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MarketAgent from './pages/MarketAgent';
import ContentAgent from './pages/ContentAgent';
import UsersPage from './pages/UsersPage';
import Layout from './components/Layout';

const ROLE_HOME = { admin: '/', seo: '/market', rrss: '/content' };

function Spinner() {
  const { dark } = useTheme();
  return (
    <div className={`min-h-screen flex items-center justify-center ${dark ? 'bg-dark-bg' : 'bg-gray-50'}`}>
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Dashboard />;
  return <Navigate to={ROLE_HOME[user.role] || '/login'} replace />;
}

function AgentRoute({ children, slug }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (!canAccessAgent(user.role, slug)) return <Navigate to={ROLE_HOME[user.role] || '/'} replace />;
  return children;
}

function SuperAdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user || user.id !== 1) return <Navigate to={ROLE_HOME[user?.role] || '/'} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomeRedirect />} />
        <Route path="market" element={<AgentRoute slug="market-research"><MarketAgent /></AgentRoute>} />
        <Route path="content" element={<AgentRoute slug="content-rrss"><ContentAgent /></AgentRoute>} />
        <Route path="users" element={<SuperAdminRoute><UsersPage /></SuperAdminRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
