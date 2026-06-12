import React, { useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { useInventoryStore } from './store/useInventoryStore';
import { Header } from './components/layout/Header';
import { BottomNav } from './components/layout/BottomNav';
import { Home } from './pages/Home';
import { Products } from './pages/Products';
import { Scanner } from './pages/Scanner';
import { Inventory } from './pages/Inventory';
import { Settings } from './pages/Settings';

import { Login } from './components/auth/Login';

const App: React.FC = () => {
  const { initStore, checkAuth, isAuthenticated, loading, error } = useInventoryStore();
  const [hasCheckedAuth, setHasCheckedAuth] = React.useState(false);

  // Check auth on startup
  useEffect(() => {
    const runAuthCheck = async () => {
      await checkAuth();
      setHasCheckedAuth(true);
    };
    runAuthCheck();
  }, [checkAuth]);

  // Initialize DB and load store data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      initStore();
    }
  }, [isAuthenticated, initStore]);

  if (!hasCheckedAuth) {
    return (
      <div 
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100vh',
          backgroundColor: 'var(--bg-app)',
          color: 'var(--text-primary)',
          fontFamily: 'Outfit, sans-serif'
        }}
      >
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse 1.5s infinite' }}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white" style={{ width: '24px', height: '24px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
        </div>
        <h3 style={{ marginTop: '16px', fontWeight: 600 }}>Cargando DulceStock...</h3>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => {}} />;
  }

  if (loading && !error) {
    return (
      <div 
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100vh',
          backgroundColor: 'var(--bg-app)',
          color: 'var(--text-primary)',
          fontFamily: 'Outfit, sans-serif'
        }}
      >
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse 1.5s infinite' }}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white" style={{ width: '24px', height: '24px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
        </div>
        <h3 style={{ marginTop: '16px', fontWeight: 600 }}>Cargando Inventario...</h3>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>Preparando base de datos local</p>
      </div>
    );
  }

  return (
    <HashRouter>
      {/* Top Header */}
      <Header />

      {/* Main Content Area */}
      <main style={{ flex: 1, overflowY: 'auto' }}>
        {error && (
          <div 
            style={{ 
              margin: '20px', 
              padding: '12px 16px', 
              backgroundColor: 'var(--danger-light)', 
              color: 'var(--danger)', 
              borderRadius: 'var(--radius-sm)',
              fontWeight: 500,
              fontSize: '14px'
            }}
          >
            Error: {error}
          </div>
        )}
        
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/productos" element={<Products />} />
          <Route path="/escanear" element={<Scanner />} />
          <Route path="/inventario" element={<Inventory />} />
          <Route path="/ajustes" element={<Settings />} />
        </Routes>
      </main>

      {/* Navigation tabs at the bottom */}
      <BottomNav />
    </HashRouter>
  );
};

export default App;
