import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { Plus, Edit2, Eye, EyeOff, Loader2, X, Trash2, AlertTriangle } from 'lucide-react';

const ROLE_BADGES = {
  admin: { label: 'Admin', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  seo: { label: 'SEO', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  rrss: { label: 'RRSS', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
};

const EMAIL_DOMAIN = '@megamayorista.org';
const MAX_EMAIL_CHARS = 50;
const MAX_NAME_WORDS = 4;
const MIN_NAME_WORDS = 2;
const MAX_PASSWORD_LENGTH = 15;
const SUPER_ADMIN_ID = 1;

function countWords(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

// ─── Confirm Delete Modal ───
function ConfirmDeleteModal({ user, onClose, onConfirm, dark, deleting }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div onClick={e => e.stopPropagation()} className={`relative w-full max-w-sm rounded-2xl border shadow-2xl ${
        dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'
      }`}>
        <div className="px-6 py-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={24} className="text-red-500" />
          </div>
          <h3 className={`text-lg font-semibold mb-2 ${dark ? 'text-white' : 'text-gray-900'}`}>Eliminar usuario</h3>
          <p className={`text-sm mb-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
            Estas a punto de eliminar a:
          </p>
          <p className={`text-sm font-semibold mb-1 ${dark ? 'text-white' : 'text-gray-900'}`}>{user.name}</p>
          <p className={`text-xs mb-4 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{user.email}</p>
          <p className={`text-xs text-red-500 font-medium`}>Esta accion no se puede deshacer</p>
        </div>
        <div className={`flex gap-3 px-6 py-4 border-t ${dark ? 'border-dark-border' : 'border-gray-100'}`}>
          <button onClick={onClose} className={`flex-1 px-4 py-2.5 text-sm rounded-lg transition-colors ${
            dark ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'
          }`}>Cancelar</button>
          <button onClick={onConfirm} disabled={deleting}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {deleting && <Loader2 size={14} className="animate-spin" />}
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── User Create/Edit Modal ───
function UserModal({ user: editUser, onClose, onSave, dark, currentUserId }) {
  const isEdit = !!editUser;
  const [name, setName] = useState(editUser?.name || '');
  const [email, setEmail] = useState(editUser?.email || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(editUser?.role || 'seo');
  const [active, setActive] = useState(editUser ? !!editUser.active : true);
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isSelf = editUser?.id === currentUserId;
  const nameWordCount = countWords(name);

  // Name handler: max 4 words, only letters and spaces
  const handleNameChange = (e) => {
    const val = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
    const words = val.trim().split(/\s+/).filter(Boolean);
    if (words.length <= MAX_NAME_WORDS || val.length < name.length) {
      setName(val);
    }
  };

  // Email handler: when user types @, autocomplete with domain
  const handleEmailChange = (e) => {
    let val = e.target.value;
    // If it already has the full domain, don't allow editing the domain part
    if (val.includes(EMAIL_DOMAIN) && val.endsWith(EMAIL_DOMAIN)) {
      // User is editing the local part — extract it
      const localPart = val.replace(EMAIL_DOMAIN, '');
      const cleanLocal = localPart.replace(/[^a-zA-Z0-9._-]/g, '');
      const maxLocal = MAX_EMAIL_CHARS - EMAIL_DOMAIN.length;
      val = cleanLocal.slice(0, maxLocal) + EMAIL_DOMAIN;
    } else if (val.includes('@')) {
      // User just typed @ → autocomplete with domain
      const localPart = val.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '');
      const maxLocal = MAX_EMAIL_CHARS - EMAIL_DOMAIN.length;
      val = localPart.slice(0, maxLocal) + EMAIL_DOMAIN;
      // Set cursor position after local part (before @) on next tick
      setTimeout(() => {
        const input = e.target;
        if (input) {
          const cursorPos = localPart.slice(0, maxLocal).length;
          input.setSelectionRange(cursorPos, cursorPos);
        }
      }, 0);
    } else {
      // No @ yet — just clean local part characters
      val = val.replace(/[^a-zA-Z0-9._-]/g, '');
      const maxLocal = MAX_EMAIL_CHARS - EMAIL_DOMAIN.length;
      val = val.slice(0, maxLocal);
    }
    if (val.length > MAX_EMAIL_CHARS) val = val.slice(0, MAX_EMAIL_CHARS);
    setEmail(val);
  };

  // Handle keydown to prevent deleting into domain
  const handleEmailKeyDown = (e) => {
    if (!email.includes(EMAIL_DOMAIN)) return;
    const localLen = email.replace(EMAIL_DOMAIN, '').length;
    const input = e.target;
    const cursorPos = input.selectionStart;
    const selEnd = input.selectionEnd;
    // Prevent delete/backspace from modifying the domain part
    if (cursorPos >= localLen && e.key === 'Delete') { e.preventDefault(); return; }
    if (cursorPos > localLen && e.key === 'Backspace' && cursorPos === selEnd) { e.preventDefault(); return; }
    // Prevent arrow right beyond local part + @ boundary
    if (e.key === 'End' || (e.key === 'ArrowRight' && cursorPos >= localLen)) {
      // Allow but cap at local length
      setTimeout(() => input.setSelectionRange(localLen, localLen), 0);
    }
  };

  // Handle click to keep cursor in local part
  const handleEmailClick = (e) => {
    if (!email.includes(EMAIL_DOMAIN)) return;
    const localLen = email.replace(EMAIL_DOMAIN, '').length;
    const input = e.target;
    setTimeout(() => {
      if (input.selectionStart > localLen) {
        input.setSelectionRange(localLen, localLen);
      }
    }, 0);
  };

  // Password handler: max 15 chars
  const handlePasswordChange = (e) => {
    const val = e.target.value.slice(0, MAX_PASSWORD_LENGTH);
    setPassword(val);
  };

  const handleSubmit = async () => {
    // Name: 2-4 words
    if (nameWordCount < MIN_NAME_WORDS) { setError('Ingresa al menos nombre y apellido'); return; }
    if (nameWordCount > MAX_NAME_WORDS) { setError('Maximo 4 palabras (2 nombres y 2 apellidos)'); return; }

    // Email validation (both create and edit)
    if (!email.trim() || email === EMAIL_DOMAIN) { setError('El email es requerido'); return; }
    if (!email.endsWith(EMAIL_DOMAIN)) { setError(`El email debe terminar en ${EMAIL_DOMAIN}`); return; }
    if (email.length > MAX_EMAIL_CHARS) { setError(`El email no puede tener mas de ${MAX_EMAIL_CHARS} caracteres`); return; }

    if (!isEdit) {
      if (!password) { setError('La contraseña es requerida'); return; }
      if (password.length > MAX_PASSWORD_LENGTH) { setError(`La contraseña no puede tener mas de ${MAX_PASSWORD_LENGTH} caracteres`); return; }
    }
    if (isEdit && password && password.length > MAX_PASSWORD_LENGTH) {
      setError(`La contraseña no puede tener mas de ${MAX_PASSWORD_LENGTH} caracteres`); return;
    }

    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        const payload = { name: name.trim(), email, role };
        if (password) payload.password = password;
        if (!isSelf) payload.active = active;
        await api.put(`/users/${editUser.id}`, payload);
      } else {
        await api.post('/users', { email, password, name: name.trim(), role });
      }
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
      <div onClick={e => e.stopPropagation()} className={`relative w-full max-w-md rounded-2xl border shadow-2xl ${
        dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'
      }`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${dark ? 'border-dark-border' : 'border-gray-100'}`}>
          <h3 className={`text-lg font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>
            {isEdit ? 'Editar Usuario' : 'Nuevo Usuario'}
          </h3>
          <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors ${dark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Name */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={`text-sm font-medium ${dark ? 'text-gray-300' : 'text-gray-700'}`}>Nombre completo:</label>
              <span className={`text-[10px] ${nameWordCount >= MAX_NAME_WORDS ? 'text-red-500 font-medium' : dark ? 'text-gray-500' : 'text-gray-400'}`}>
                {nameWordCount}/{MAX_NAME_WORDS} palabras
              </span>
            </div>
            <input
              value={name}
              onChange={handleNameChange}
              className={inputCls}
              placeholder="Nombre Apellido"
            />
            <p className={`text-[10px] mt-1 ${dark ? 'text-gray-600' : 'text-gray-400'}`}>Minimo nombre y apellido, maximo 2 nombres y 2 apellidos</p>
          </div>

          {/* Email */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={`text-sm font-medium ${dark ? 'text-gray-300' : 'text-gray-700'}`}>Email:</label>
              <span className={`text-[10px] ${email.length >= MAX_EMAIL_CHARS ? 'text-red-500 font-medium' : dark ? 'text-gray-500' : 'text-gray-400'}`}>
                {email.length}/{MAX_EMAIL_CHARS}
              </span>
            </div>
            <input
              value={email}
              onChange={handleEmailChange}
              onKeyDown={handleEmailKeyDown}
              onClick={handleEmailClick}
              className={inputCls}
              placeholder={`usuario${EMAIL_DOMAIN}`}
            />
            <p className={`text-[10px] mt-1 ${dark ? 'text-gray-600' : 'text-gray-400'}`}>
              @megamayorista.org
            </p>
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={`text-sm font-medium ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                {isEdit ? 'Nueva contraseña: (dejar vacio para no cambiar)' : 'Contraseña:'}
              </label>
              <span className={`text-[10px] ${password.length >= MAX_PASSWORD_LENGTH ? 'text-red-500 font-medium' : password.length > 0 ? 'text-green-500 font-medium' : dark ? 'text-gray-500' : 'text-gray-400'}`}>
                {password.length}/{MAX_PASSWORD_LENGTH}
              </span>
            </div>
            <div className="relative">
              <input
                value={password}
                onChange={handlePasswordChange}
                type={showPass ? 'text' : 'password'}
                className={inputCls}
                placeholder={isEdit ? '••••••••' : 'Hasta 15 caracteres'}
                maxLength={MAX_PASSWORD_LENGTH}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 ${dark ? 'text-gray-500' : 'text-gray-400'}`}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className={`text-[10px] mt-1 ${dark ? 'text-gray-600' : 'text-gray-400'}`}>Hasta 15 caracteres</p>
          </div>

          {/* Role */}
          <div>
            <label className={`text-sm font-medium mb-1.5 block ${dark ? 'text-gray-300' : 'text-gray-700'}`}>Rol:</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              disabled={isSelf}
              className={`${inputCls} ${isSelf ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <option value="admin">Admin — Acceso total</option>
              <option value="seo">SEO — Solo Estudio de Mercado</option>
              <option value="rrss">RRSS — Solo Contenido y RRSS</option>
            </select>
          </div>

          {/* Active toggle (edit only, not self) */}
          {isEdit && !isSelf && (
            <div className="flex items-center justify-between">
              <label className={`text-sm font-medium ${dark ? 'text-gray-300' : 'text-gray-700'}`}>Usuario activo</label>
              <button
                onClick={() => setActive(!active)}
                className={`relative w-11 h-6 rounded-full transition-colors ${active ? 'bg-green-500' : dark ? 'bg-gray-600' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${active ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${dark ? 'border-dark-border' : 'border-gray-100'}`}>
          <button onClick={onClose} className={`px-4 py-2 text-sm rounded-lg transition-colors ${
            dark ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'
          }`}>Cancelar</button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-5 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Guardar' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main UsersPage ───
export default function UsersPage() {
  const { dark } = useTheme();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const isSuperAdmin = currentUser?.id === SUPER_ADMIN_ID;

  const fetchUsers = () => {
    api.get('/users').then(res => setUsers(res.data)).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(() => { fetchUsers(); }, []);

  const handleToggleActive = async (u) => {
    if (u.id === currentUser.id) return;
    try {
      await api.put(`/users/${u.id}`, { active: !u.active });
      fetchUsers();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/users/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchUsers();
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const openCreate = () => { setEditingUser(null); setShowModal(true); };
  const openEdit = (u) => { setEditingUser(u); setShowModal(true); };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className={`text-xl md:text-2xl font-bold mb-1 ${dark ? 'text-white' : 'text-gray-900'}`}>Usuarios</h1>
          <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Administra los usuarios y sus permisos</p>
        </div>
        {isSuperAdmin && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Nuevo usuario
          </button>
        )}
      </div>

      {/* Users table */}
      <div className={`rounded-xl border overflow-hidden ${dark ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-200'}`}>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className={dark ? 'bg-dark-bg' : 'bg-gray-50'}>
              <th className={`text-left px-3 sm:px-5 py-3 text-xs font-semibold uppercase tracking-wider ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Usuario</th>
              <th className={`text-left px-3 sm:px-5 py-3 text-xs font-semibold uppercase tracking-wider ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Rol</th>
              <th className={`text-center px-3 sm:px-5 py-3 text-xs font-semibold uppercase tracking-wider ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Estado</th>
              <th className={`text-right px-3 sm:px-5 py-3 text-xs font-semibold uppercase tracking-wider ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Acciones</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${dark ? 'divide-dark-border' : 'divide-gray-100'}`}>
            {users.map(u => {
              const badge = ROLE_BADGES[u.role] || ROLE_BADGES.seo;
              const isSelf = u.id === currentUser.id;
              const canDelete = !isSelf && u.id !== SUPER_ADMIN_ID;
              return (
                <tr key={u.id} className={dark ? 'hover:bg-dark-bg/50' : 'hover:bg-gray-50'}>
                  <td className="px-3 sm:px-5 py-3 sm:py-4">
                    <div>
                      <p className={`text-sm font-medium ${dark ? 'text-white' : 'text-gray-900'}`}>
                        {u.name} {isSelf && <span className={`text-[10px] ml-1 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>(tu)</span>}
                      </p>
                      <p className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{u.email}</p>
                    </div>
                  </td>
                  <td className="px-3 sm:px-5 py-3 sm:py-4">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-3 sm:px-5 py-3 sm:py-4 text-center">
                    <button
                      onClick={() => !isSelf && handleToggleActive(u)}
                      disabled={isSelf}
                      className={`relative inline-flex w-9 h-5 rounded-full transition-colors ${
                        isSelf ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                      } ${u.active ? 'bg-green-500' : dark ? 'bg-gray-600' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${u.active ? 'translate-x-4' : ''}`} />
                    </button>
                  </td>
                  <td className="px-3 sm:px-5 py-3 sm:py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(u)}
                        className={`p-2 rounded-lg transition-colors ${dark ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-400 hover:bg-gray-100'}`}
                        title="Editar"
                      >
                        <Edit2 size={16} />
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => setDeleteTarget(u)}
                          className={`p-2 rounded-lg transition-colors text-red-400 ${dark ? 'hover:bg-red-900/20' : 'hover:bg-red-50'}`}
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {showModal && (
        <UserModal
          user={editingUser}
          dark={dark}
          currentUserId={currentUser.id}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); fetchUsers(); }}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          user={deleteTarget}
          dark={dark}
          deleting={deleting}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
