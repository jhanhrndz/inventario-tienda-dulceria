import React, { useState, useEffect } from 'react';
import { getSupabaseClient, isSupabaseConfigured, saveSupabaseCredentials, getSupabaseCredentials, isUsingEnvCredentials } from '../../lib/supabaseClient';
import { useInventoryStore } from '../../store/useInventoryStore';

interface LoginProps {
  onLoginSuccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Supabase Configuration State
  const [showConfig, setShowConfig] = useState(!isSupabaseConfigured());
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [configSuccess, setConfigSuccess] = useState(false);

  // Load existing credentials
  useEffect(() => {
    const creds = getSupabaseCredentials();
    setSupabaseUrl(creds.url);
    setSupabaseAnonKey(creds.anonKey);
  }, []);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setConfigSuccess(false);

    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      setErrorMessage('Por favor ingrese la URL y la Clave Anónima de Supabase.');
      return;
    }

    try {
      saveSupabaseCredentials(supabaseUrl, supabaseAnonKey);
      setConfigSuccess(true);
      setTimeout(() => setConfigSuccess(false), 3000);
      setShowConfig(false);
    } catch (err: any) {
      setErrorMessage('Error al guardar la configuración: ' + (err.message || err));
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isSupabaseConfigured()) {
      setErrorMessage('Debe configurar las credenciales de Supabase antes de iniciar sesión.');
      setShowConfig(true);
      return;
    }

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Por favor ingrese su correo y contraseña.');
      return;
    }

    setIsLoading(true);
    const supabase = getSupabaseClient();
    
    if (!supabase) {
      setErrorMessage('No se pudo inicializar el cliente de Supabase.');
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        // Logged in successfully
        // Store session explicitly for offline fallback
        localStorage.setItem('offline_session_user', JSON.stringify(data.user));
        localStorage.setItem('offline_session_active', 'true');
        
        // Update store authentication state
        await useInventoryStore.getState().checkAuth();
        onLoginSuccess();
      }
    } catch (err: any) {
      console.error('Login error:', err);
      
      // Fallback: Check if we are offline and have a cached offline session
      const isOnline = navigator.onLine;
      if (!isOnline) {
        const cachedUser = localStorage.getItem('offline_session_user');
        const isActive = localStorage.getItem('offline_session_active') === 'true';
        
        if (isActive && cachedUser) {
          // Verify cached email matches input for safety
          const userObj = JSON.parse(cachedUser);
          if (userObj.email === email.trim()) {
            // Authorized offline access!
            await useInventoryStore.getState().checkAuth();
            onLoginSuccess();
            setIsLoading(false);
            return;
          } else {
            setErrorMessage('Las credenciales ingresadas no coinciden con la sesión guardada localmente.');
          }
        } else {
          setErrorMessage('Sin conexión a internet. Requiere conectarse al menos una vez para autorizar este dispositivo.');
        }
      } else {
        setErrorMessage(err.message || 'Error al iniciar sesión. Verifique sus credenciales.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      minHeight: 'calc(100vh - var(--nav-height))',
      padding: '24px',
      maxWidth: '440px',
      margin: '0 auto',
      animation: 'slide-up 0.3s ease-out'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        {/* Modern clean SVG logo */}
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          backgroundColor: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px auto',
          boxShadow: 'var(--shadow-md)'
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--bg-card)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
          DulceStock
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          Gestión de Inventario Profesional
        </p>
      </div>

      {errorMessage && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: 'var(--danger-light)',
          color: 'var(--danger)',
          fontSize: '13px',
          fontWeight: 500,
          border: '1px solid rgba(220, 38, 38, 0.1)',
          marginBottom: '20px'
        }}>
          {errorMessage}
        </div>
      )}

      {configSuccess && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: 'var(--success-light)',
          color: 'var(--success)',
          fontSize: '13px',
          fontWeight: 500,
          border: '1px solid rgba(5, 150, 105, 0.1)',
          marginBottom: '20px'
        }}>
          Configuración guardada exitosamente.
        </div>
      )}

      {/* Main Login Card */}
      <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
        <form onSubmit={handleLogin}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>
            Iniciar Sesión
          </h2>
          
          <div className="form-group">
            <label className="form-label" htmlFor="email">Correo Electrónico</label>
            <input
              className="input-field"
              type="email"
              id="email"
              placeholder="nombre@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label" htmlFor="password">Contraseña</label>
            <input
              className="input-field"
              type="password"
              id="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <button
            className="btn btn-primary"
            type="submit"
            style={{ width: '100%', minHeight: '44px' }}
            disabled={isLoading}
          >
            {isLoading ? 'Verificando...' : 'Ingresar'}
          </button>
        </form>

        {!isUsingEnvCredentials() && (
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              {showConfig ? 'Ocultar Configuración de Nube' : 'Mostrar Configuración de Nube'}
            </button>
          </div>
        )}
      </div>

      {/* Collapsible Supabase Configuration Card */}
      {!isUsingEnvCredentials() && showConfig && (
        <div className="card" style={{ padding: '20px', borderStyle: 'dashed', animation: 'slide-up 0.2s ease-out' }}>
          <form onSubmit={handleSaveConfig}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>
              Configuración de Supabase (Base de Datos)
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Para conectar con tu propia nube, ingresa la URL y la clave anónima del proyecto de Supabase.
            </p>

            <div className="form-group">
              <label className="form-label" htmlFor="url">Proyecto URL</label>
              <input
                className="input-field"
                type="url"
                id="url"
                placeholder="https://xxxx.supabase.co"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" htmlFor="anonKey">Clave Anónima (Anon Key)</label>
              <input
                className="input-field"
                type="password"
                id="anonKey"
                placeholder="eyJhbGciOiJIUzI1NiIsIn..."
                value={supabaseAnonKey}
                onChange={(e) => setSupabaseAnonKey(e.target.value)}
                required
              />
            </div>

            <button
              className="btn btn-secondary"
              type="submit"
              style={{ width: '100%' }}
            >
              Guardar Credenciales
            </button>
          </form>
        </div>
      )}

      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', marginTop: '12px' }}>
        <p style={{ marginBottom: '4px' }}>
          * El primer inicio de sesión requiere internet.
        </p>
        <p>
          Los datos se guardan de forma local y se sincronizan cuando vuelva la red.
        </p>
      </div>
    </div>
  );
};
