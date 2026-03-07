import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Sidebar from './Sidebar';
import { LogOut, User } from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const { dark } = useTheme();

  return (
    <div className={`min-h-screen transition-colors ${dark ? 'bg-dark-bg' : 'bg-gray-50'}`}>
      <Sidebar />
      <div className="ml-64">
        <header className={`h-16 flex items-center justify-between px-8 sticky top-0 z-10 border-b transition-colors ${
          dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'
        }`}>
          <div />
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 text-sm ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
              <User size={16} />
              <span>{user?.name || user?.email}</span>
              {user?.role && (() => {
                const badges = {
                  admin: { label: 'Admin', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
                  seo: { label: 'SEO', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
                  rrss: { label: 'RRSS', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
                };
                const b = badges[user.role] || badges.seo;
                return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${b.cls}`}>{b.label}</span>;
              })()}
            </div>
            <button onClick={logout} className={`flex items-center gap-1.5 text-sm transition-colors ${dark ? 'text-gray-500 hover:text-red-400' : 'text-gray-500 hover:text-red-600'}`}>
              <LogOut size={16} />
              Salir
            </button>
          </div>
        </header>
        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
