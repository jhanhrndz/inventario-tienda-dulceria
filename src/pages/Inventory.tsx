import React, { useState, useEffect } from 'react';
import { useInventoryStore } from '../store/useInventoryStore';
import { formatDate } from '../lib/utils';
import { productRepository } from '../lib/repositories/productRepository';

export const Inventory: React.FC = () => {
  const { movements, products, addMovement, loading } = useInventoryStore();

  const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [movementType, setMovementType] = useState<'PURCHASE' | 'ADJUSTMENT' | 'COUNT'>('PURCHASE');
  const [selectedUnit, setSelectedUnit] = useState('pza');
  const [qty, setQty] = useState('1');
  const [isExit, setIsExit] = useState(false); // for adjustments
  const [reason, setReason] = useState('Compra de mercancía');
  const [notes, setNotes] = useState('');

  // Available units for the selected product
  const [productUnits, setProductUnits] = useState<string[]>(['pza']);

  // Update units dropdown when product changes
  useEffect(() => {
    if (selectedProductId) {
      const prod = products.find(p => p.id === selectedProductId);
      if (prod) {
        const baseUnit = prod.base_unit;
        productRepository.getConversions(selectedProductId).then(convs => {
          const units = [baseUnit, ...convs.map(c => c.from_unit)];
          setProductUnits(units);
          setSelectedUnit(baseUnit);
        });
      }
    }
  }, [selectedProductId, products]);

  const handleMovementTypeChange = (type: 'PURCHASE' | 'ADJUSTMENT' | 'COUNT') => {
    setMovementType(type);
    if (type === 'PURCHASE') {
      setReason('Mercancía nueva recibida');
      setIsExit(false);
    } else if (type === 'COUNT') {
      setReason('Conteo físico periódico');
      setIsExit(false);
    } else {
      setReason('Ajuste de inventario');
    }
  };

  const handleOpenModal = () => {
    if (products.length === 0) {
      alert('Primero debes registrar productos en el catálogo.');
      return;
    }
    setSelectedProductId(products[0].id);
    setMovementType('PURCHASE');
    setReason('Mercancía nueva recibida');
    setQty('1');
    setIsExit(false);
    setNotes('');
    setViewMode('form');
  };

  const handleSaveMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) return;

    let finalQty = parseFloat(qty) || 0;
    if (movementType === 'ADJUSTMENT' && isExit) {
      finalQty = -finalQty;
    }

    try {
      await addMovement({
        product_id: selectedProductId,
        type: movementType,
        unit: selectedUnit,
        unit_quantity: finalQty,
        reason: reason.trim(),
        notes: notes.trim(),
      });
      setViewMode('list');
    } catch (err) {
      console.error(err);
    }
  };

  if (viewMode === 'form') {
    return (
      <div className="p-20 animate-slide-up" style={{ paddingBottom: '40px' }}>
        <div className="flex-between mb-4" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <h2 style={{ fontSize: '20px', margin: 0, fontWeight: 600 }}>Registrar Movimiento</h2>
          <button className="btn btn-secondary btn-sm" onClick={() => setViewMode('list')}>
            ← Volver al Historial
          </button>
        </div>

        <form onSubmit={handleSaveMovement}>
          {/* Product Selection */}
          <div className="form-group">
            <label className="form-label">Seleccionar Producto</label>
            <select 
              className="select-field"
              value={selectedProductId}
              onChange={e => setSelectedProductId(e.target.value)}
              required
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  [{p.internal_code}] {p.name} (Stock: {p.stock_quantity})
                </option>
              ))}
            </select>
          </div>

          {/* Movement Type */}
          <div className="form-group">
            <label className="form-label">Tipo de Movimiento</label>
            <div className="grid-2">
              <button
                type="button"
                className={`btn ${movementType === 'PURCHASE' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleMovementTypeChange('PURCHASE')}
              >
                Compra
              </button>
              <button
                type="button"
                className={`btn ${movementType === 'ADJUSTMENT' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleMovementTypeChange('ADJUSTMENT')}
              >
                Ajuste
              </button>
            </div>
            <button
              type="button"
              className={`btn ${movementType === 'COUNT' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ width: '100%', marginTop: '8px' }}
              onClick={() => handleMovementTypeChange('COUNT')}
            >
              Conteo Físico (Sobrescribir stock)
            </button>
          </div>

          {/* Direction Toggle for Adjustment */}
          {movementType === 'ADJUSTMENT' && (
            <div className="form-group">
              <label className="form-label">Dirección del Ajuste</label>
              <div className="grid-2">
                <button
                  type="button"
                  className={`btn ${!isExit ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ backgroundColor: !isExit ? 'var(--success)' : 'var(--bg-input)' }}
                  onClick={() => setIsExit(false)}
                >
                  Entrada (Suma stock)
                </button>
                <button
                  type="button"
                  className={`btn ${isExit ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ backgroundColor: isExit ? 'var(--danger)' : 'var(--bg-input)' }}
                  onClick={() => setIsExit(true)}
                >
                  Salida (Resta stock)
                </button>
              </div>
            </div>
          )}

          {/* Quantity and Unit Selection */}
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Cantidad</label>
              <input 
                type="number" 
                step="0.01"
                className="input-field" 
                value={qty}
                onChange={e => setQty(e.target.value)}
                required
                min="0.01"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Unidad de Entrada</label>
              <select 
                className="select-field"
                value={selectedUnit}
                onChange={e => setSelectedUnit(e.target.value)}
              >
                {productUnits.map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Reason / Comments */}
          <div className="form-group">
            <label className="form-label">Razón / Motivo</label>
            {movementType === 'PURCHASE' ? (
              <select className="select-field" value={reason} onChange={e => setReason(e.target.value)}>
                <option value="Mercancía nueva recibida">Mercancía nueva recibida</option>
                <option value="Reposición de stock">Reposición de stock</option>
                <option value="Compra extraordinaria">Compra extraordinaria</option>
              </select>
            ) : movementType === 'COUNT' ? (
              <select className="select-field" value={reason} onChange={e => setReason(e.target.value)}>
                <option value="Conteo físico periódico">Conteo físico periódico</option>
                <option value="Inventario mensual">Inventario mensual</option>
                <option value="Auditoría de stock">Auditoría de stock</option>
              </select>
            ) : (
              <select className="select-field" value={reason} onChange={e => setReason(e.target.value)}>
                <option value="Ajuste de inventario">Ajuste de inventario</option>
                <option value="Producto roto / dañado">Producto roto / dañado</option>
                <option value="Caducado / Vencido">Caducado / Vencido</option>
                <option value="Pérdida misteriosa">Pérdida misteriosa</option>
                <option value="Devolución de cliente">Devolución de cliente</option>
              </select>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Notas Adicionales (Opcional)</label>
            <textarea 
              className="input-field" 
              style={{ height: '60px', resize: 'none' }}
              placeholder="Escribe comentarios extra..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {/* Action Buttons */}
          <div className="grid-2 mt-4">
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={() => setViewMode('list')}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
            >
              Registrar
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="p-20 animate-slide-up" style={{ paddingBottom: '40px' }}>
      <div className="flex-between mb-4">
        <h2 style={{ fontSize: '24px', margin: 0 }}>Bitácora de Movimientos</h2>
        <button className="btn btn-primary" onClick={handleOpenModal}>
          + Registrar Movimiento
        </button>
      </div>

      {/* Quick Summary Cards */}
      <div className="grid-2 mb-4">
        <div className="card" style={{ margin: 0, padding: '12px', textAlign: 'center', backgroundColor: 'var(--success-light)', borderColor: 'var(--success)' }}>
          <h4 style={{ fontSize: '13px', color: 'var(--success)', marginTop: '4px' }}>Compras Recientes</h4>
          <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {movements.filter(m => m.type === 'PURCHASE').length}
          </span>
        </div>
        <div className="card" style={{ margin: 0, padding: '12px', textAlign: 'center', backgroundColor: 'var(--warning-light)', borderColor: 'var(--warning)' }}>
          <h4 style={{ fontSize: '13px', color: 'var(--warning)', marginTop: '4px' }}>Ajustes y Conteos</h4>
          <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {movements.filter(m => m.type === 'ADJUSTMENT' || m.type === 'COUNT').length}
          </span>
        </div>
      </div>

      {/* Movements Log List */}
      <h3 className="card-title" style={{ marginBottom: '12px' }}>Historial de Operaciones</h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {movements.map(mov => {
          let typeText = 'Inicial';
          let badgeClass = 'badge-primary';
          let signText = '';
          
          if (mov.type === 'PURCHASE') {
            typeText = 'Compra';
            badgeClass = 'badge-success';
            signText = '+';
          } else if (mov.type === 'ADJUSTMENT') {
            typeText = mov.quantity >= 0 ? 'Ajuste (+)' : 'Ajuste (-)';
            badgeClass = mov.quantity >= 0 ? 'badge-success' : 'badge-danger';
            signText = mov.quantity >= 0 ? '+' : '';
          } else if (mov.type === 'COUNT') {
            typeText = 'Conteo';
            badgeClass = 'badge-warning';
            signText = '=';
          }

          const prod = products.find(p => p.id === mov.product_id);
          const baseUnit = prod?.base_unit || 'pza';

          return (
            <div 
              key={mov.id} 
              className="card" 
              style={{ 
                margin: 0, 
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <div className="flex-between">
                <span className={`badge ${badgeClass}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                  {typeText}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {formatDate(mov.date, true)}
                </span>
              </div>

              <div className="flex-between" style={{ marginTop: '2px' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px' }}>
                  {mov.product_name}
                </span>
                <span style={{ fontSize: '16px', fontWeight: 700, color: mov.quantity >= 0 && mov.type !== 'COUNT' ? 'var(--success)' : mov.type === 'COUNT' ? 'var(--warning)' : 'var(--danger)' }}>
                  {signText}{mov.unit_quantity} {mov.unit}
                  {mov.unit !== baseUnit && (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', fontWeight: 400 }}>
                      ({signText}{mov.quantity} {baseUnit})
                    </span>
                  )}
                </span>
              </div>

              <div className="flex-between" style={{ fontSize: '12px', color: 'var(--text-muted)', borderTop: '1px dashed var(--border)', paddingTop: '4px', marginTop: '2px' }}>
                <span>{mov.reason}</span>
                <span style={{ fontStyle: 'italic' }}>{mov.notes ? `"${mov.notes}"` : ''}</span>
              </div>
            </div>
          );
        })}

        {movements.length === 0 && (
          <div className="card text-center" style={{ padding: '32px' }}>
            <h4 className="mt-4">Sin movimientos registrados</h4>
            <p className="card-subtitle">
              Los cambios de stock que realices figurarán en esta pantalla.
            </p>
          </div>
        )}
      </div>

    </div>
  );
};
