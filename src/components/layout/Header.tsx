import React from 'react';
import { useInventoryStore } from '../../store/useInventoryStore';

export const Header: React.FC = () => {
  const { isOnline, isSyncing, triggerSync } = useInventoryStore();

  return (
    <header className="header animate-slide-up">
      <div className="flex-align-center">
        <h1 className="header-title" style={{ margin: 0 }}>DulceStock</h1>
      </div>
      
      <div className="flex-align-center">
        {/* Sync spinner button */}
        {isOnline && (
          <button 
            onClick={() => triggerSync()} 
            disabled={isSyncing}
            className="btn btn-secondary btn-sm btn-icon"
            style={{ 
              width: '32px', 
              height: '32px', 
              minHeight: '32px',
              border: 'none',
              backgroundColor: 'transparent'
            }}
            title="Sincronizar ahora"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24" 
              strokeWidth={2} 
              stroke="var(--text-secondary)" 
              style={{ 
                width: '18px', 
                height: '18px',
                animation: isSyncing ? 'spin 1s linear infinite' : 'none'
              }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        )}

        {/* Connection status badge */}
        <div className="conn-status">
          <span className={`conn-dot ${isOnline ? 'online' : 'offline'}`}></span>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            {isOnline ? 'Conectado' : 'Sin Internet'}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </header>
  );
};
