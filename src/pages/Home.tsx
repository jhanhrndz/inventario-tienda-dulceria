import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useInventoryStore } from '../store/useInventoryStore';
import { exportToExcel } from '../lib/services/exportService';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { products, movements } = useInventoryStore();

  // Metrics calculations
  const totalProducts = products.length;
  const totalStockItems = products.reduce((acc, p) => acc + p.stock_quantity, 0);
  
  const lowStockProducts = products.filter(p => p.stock_quantity <= p.min_stock);
  const lowStockCount = lowStockProducts.length;

  const handleQuickExport = async () => {
    try {
      await exportToExcel();
    } catch (err) {
      alert('Error al exportar: ' + (err as Error).message);
    }
  };

  return (
    <div className="p-20 animate-slide-up" style={{ paddingBottom: '40px' }}>
      {/* Welcome & Slogan */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600 }}>Resumen de Inventario</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          Sistema local sin conexión a internet.
        </p>
      </div>

      {/* Main stats counters grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
        <div className="card" style={{ margin: 0, padding: '12px', textAlign: 'center' }}>
          <h4 style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Productos</h4>
          <span style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginTop: '4px' }}>
            {totalProducts}
          </span>
        </div>

        <div className="card" style={{ margin: 0, padding: '12px', textAlign: 'center' }}>
          <h4 style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Stock Total</h4>
          <span style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginTop: '4px' }}>
            {totalStockItems}
          </span>
        </div>

        <div 
          className="card" 
          style={{ 
            margin: 0, 
            padding: '12px', 
            textAlign: 'center', 
            backgroundColor: lowStockCount > 0 ? 'var(--warning-light)' : 'var(--bg-card)',
            borderColor: lowStockCount > 0 ? 'var(--warning)' : 'var(--border)',
            cursor: lowStockCount > 0 ? 'pointer' : 'default'
          }}
          onClick={() => lowStockCount > 0 && navigate('/productos')}
        >
          <h4 style={{ fontSize: '11px', color: lowStockCount > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
            Stock Bajo
          </h4>
          <span style={{ fontSize: '18px', fontWeight: 600, color: lowStockCount > 0 ? 'var(--warning)' : 'var(--text-primary)', display: 'block', marginTop: '4px' }}>
            {lowStockCount}
          </span>
        </div>
      </div>

      {/* Quick Actions Panel */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <h3 className="card-title" style={{ marginBottom: '10px' }}>Accesos Rápidos</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button 
            className="btn btn-primary" 
            style={{ padding: '12px', flexDirection: 'column', height: 'auto', gap: '4px', borderRadius: 'var(--radius-sm)' }}
            onClick={() => navigate('/escanear')}
          >
            <span style={{ fontSize: '13px' }}>Escanear Código</span>
          </button>
          
          <button 
            className="btn btn-secondary" 
            style={{ padding: '12px', flexDirection: 'column', height: 'auto', gap: '4px', borderRadius: 'var(--radius-sm)' }}
            onClick={() => navigate('/productos')}
          >
            <span style={{ fontSize: '13px' }}>Ver Catálogo</span>
          </button>

          <button 
            className="btn btn-secondary" 
            style={{ padding: '12px', flexDirection: 'column', height: 'auto', gap: '4px', borderRadius: 'var(--radius-sm)' }}
            onClick={() => navigate('/inventario')}
          >
            <span style={{ fontSize: '13px' }}>Bitácora Movs</span>
          </button>

          <button 
            className="btn btn-secondary" 
            style={{ padding: '12px', flexDirection: 'column', height: 'auto', gap: '4px', borderRadius: 'var(--radius-sm)' }}
            onClick={handleQuickExport}
          >
            <span style={{ fontSize: '13px' }}>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* Low Stock Alerts Section */}
      <div className="card" style={{ border: lowStockCount > 0 ? '1px solid var(--warning)' : '1px solid var(--border)' }}>
        <h3 className="card-title">
          {lowStockCount > 0 ? 'Alertas de Stock Bajo' : 'Stock en Orden'}
        </h3>
        <p className="card-subtitle" style={{ marginBottom: '10px' }}>
          {lowStockCount > 0 
            ? 'Los siguientes productos están por debajo del stock mínimo.'
            : 'Todos los niveles de existencias superan el mínimo configurado.'
          }
        </p>

        {lowStockCount > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
            {lowStockProducts.map(prod => (
              <div 
                key={prod.id} 
                className="flex-between"
                style={{ 
                  padding: '6px 8px', 
                  backgroundColor: 'var(--bg-input)', 
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer'
                }}
                onClick={() => navigate('/productos')}
              >
                <div>
                  <span style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text-primary)' }}>
                    {prod.name} {prod.content_size ? `(${prod.content_size})` : ''}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>
                    Cat: {prod.category_name} | Cód: {prod.internal_code}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: 'var(--danger)', fontWeight: 600, fontSize: '13px' }}>
                    {prod.stock_quantity} / {prod.min_stock} {prod.base_unit}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Existencias suficientes en todo el catálogo.
            </p>
          </div>
        )}
      </div>

      {/* Recent Movements Widget */}
      {movements.length > 0 && (
        <div className="card" style={{ marginTop: '16px' }}>
          <h3 className="card-title" style={{ marginBottom: '8px' }}>Últimos Movimientos</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {movements.slice(0, 3).map(mov => (
              <div key={mov.id} className="flex-between" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '12px' }}>
                <div>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{mov.product_name}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>
                    {mov.reason}
                  </span>
                </div>
                <span style={{ fontWeight: 600, color: mov.quantity >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {mov.quantity >= 0 ? '+' : ''}{mov.quantity} {mov.unit}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
