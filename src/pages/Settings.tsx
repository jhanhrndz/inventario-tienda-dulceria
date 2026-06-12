import React, { useState } from 'react';
import { useInventoryStore } from '../store/useInventoryStore';
import { exportToExcel } from '../lib/services/exportService';
import { type Category, type UnitOfMeasure } from '../lib/db';
import { getErrorMessage } from '../lib/utils';
import { getSupabaseCredentials, saveSupabaseCredentials, isUsingEnvCredentials } from '../lib/supabaseClient';

export const Settings: React.FC = () => {
  const { 
    categories, 
    addCategory, 
    updateCategory, 
    deleteCategory, 
    units,
    addUnit,
    updateUnit,
    deleteUnit,
    loading, 
    error,
    user,
    logout,
    triggerSync,
    isSyncing,
    isOnline
  } = useInventoryStore();

  // Active tab state to switch between Categories and Units
  const [activeTab, setActiveTab] = useState<'categories' | 'units'>('categories');

  // Category Modal State
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  const [catSortOrder, setCatSortOrder] = useState('0');

  // Unit Modal State
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [unitName, setUnitName] = useState('');
  const [unitAbbreviation, setUnitAbbreviation] = useState('');

  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Category Handlers
  const handleOpenAddCat = () => {
    setEditingCatId(null);
    setCatName('');
    setCatSortOrder(String(categories.length));
    setShowCatModal(true);
  };

  const handleOpenEditCat = (cat: Category) => {
    setEditingCatId(cat.id);
    setCatName(cat.name);
    setCatSortOrder(String(cat.sort_order));
    setShowCatModal(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    const catData = {
      name: catName.trim(),
      sort_order: parseInt(catSortOrder, 10) || 0,
    };

    try {
      if (editingCatId) {
        await updateCategory(editingCatId, catData);
      } else {
        await addCategory(catData);
      }
      setShowCatModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCat = async (id: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar esta categoría? Los productos bajo esta categoría se mantendrán pero tendrán la categoría por defecto.')) {
      try {
        await deleteCategory(id);
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Unit Handlers
  const handleOpenAddUnit = () => {
    setEditingUnitId(null);
    setUnitName('');
    setUnitAbbreviation('');
    setShowUnitModal(true);
  };

  const handleOpenEditUnit = (unit: UnitOfMeasure) => {
    setEditingUnitId(unit.id);
    setUnitName(unit.name);
    setUnitAbbreviation(unit.abbreviation);
    setShowUnitModal(true);
  };

  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitName.trim() || !unitAbbreviation.trim()) return;

    const unitData = {
      name: unitName.trim(),
      abbreviation: unitAbbreviation.trim().toLowerCase(),
    };

    try {
      if (editingUnitId) {
        await updateUnit(editingUnitId, unitData);
      } else {
        await addUnit(unitData);
      }
      setShowUnitModal(false);
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const handleDeleteUnit = async (id: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar esta unidad de medida? Si hay productos usándola, puede causar discrepancias en el catálogo.')) {
      try {
        await deleteUnit(id);
      } catch (err) {
        alert(getErrorMessage(err));
      }
    }
  };

  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [configSuccess, setConfigSuccess] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  // Load credentials on mount
  React.useEffect(() => {
    const creds = getSupabaseCredentials();
    setSupabaseUrl(creds.url);
    setSupabaseAnonKey(creds.anonKey);
  }, []);

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) return;

    try {
      saveSupabaseCredentials(supabaseUrl, supabaseAnonKey);
      setConfigSuccess(true);
      setTimeout(() => setConfigSuccess(false), 3000);
      setShowConfigPanel(false);
    } catch (err) {
      alert('Error al guardar credenciales: ' + getErrorMessage(err));
    }
  };

  const handleManualSync = async () => {
    setSyncStatusMsg('Sincronizando...');
    try {
      await triggerSync();
      setSyncStatusMsg('Sincronización completada con éxito.');
      setTimeout(() => setSyncStatusMsg(null), 3000);
    } catch (err) {
      setSyncStatusMsg('Error al sincronizar: ' + getErrorMessage(err));
    }
  };

  const handleLogout = async () => {
    if (confirm('¿Estás seguro de que deseas cerrar sesión? Esto limpiará TODOS los datos guardados en este dispositivo para proteger tu cuenta.')) {
      await logout();
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setExportSuccess(false);
    try {
      await exportToExcel();
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      alert('Error al exportar: ' + (err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-20 animate-slide-up" style={{ paddingBottom: '40px' }}>
      <h2 className="mb-4" style={{ fontSize: '20px', fontWeight: 600 }}>
        Ajustes del Sistema
      </h2>

      {/* Cloud Sync & Session Section */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Sincronización en la Nube</span>
          <span style={{ fontSize: '11px', fontWeight: 'normal' }} className={`badge ${isOnline ? 'badge-success' : 'badge-danger'}`}>
            {isOnline ? 'En Línea' : 'Sin Conexión'}
          </span>
        </h3>
        
        {user && (
          <div style={{ margin: '10px 0 16px 0', fontSize: '13px' }}>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}>
              <strong>Usuario:</strong> {user.email}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isUsingEnvCredentials() ? 'var(--success)' : 'var(--primary)' }}></span>
              <span>
                Conexión: <strong>{isUsingEnvCredentials() ? 'Configuración Global (Vercel/.env)' : 'Configuración Personalizada'}</strong>
              </span>
            </div>
            <div style={{ color: 'var(--text-muted)' }}>
              Los cambios se guardan localmente y se sincronizan automáticamente.
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
          <button 
            onClick={handleManualSync} 
            disabled={isSyncing || !isOnline}
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            {isSyncing ? 'Sincronizando...' : 'Sincronizar Ahora'}
          </button>

          <button 
            onClick={handleLogout} 
            className="btn btn-secondary"
            style={{ width: '100%', borderColor: 'rgba(220, 38, 38, 0.3)', color: 'var(--danger)' }}
          >
            Cerrar Sesión
          </button>
        </div>

        {syncStatusMsg && (
          <div style={{ marginTop: '12px', fontSize: '12px', color: syncStatusMsg.includes('Error') ? 'var(--danger)' : 'var(--success)', textAlign: 'center', fontWeight: 500 }}>
            {syncStatusMsg}
          </div>
        )}

        {!isUsingEnvCredentials() && (
          <>
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => setShowConfigPanel(!showConfigPanel)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                {showConfigPanel ? 'Ocultar Credenciales de Supabase' : 'Modificar Credenciales de Supabase'}
              </button>
            </div>

            {showConfigPanel && (
              <form onSubmit={handleSaveCredentials} style={{ marginTop: '16px', borderTop: '1px dashed var(--border)', paddingTop: '16px' }}>
                <div className="form-group">
                  <label className="form-label">URL del Proyecto</label>
                  <input 
                    type="url" 
                    className="input-field" 
                    placeholder="https://xxxx.supabase.co"
                    value={supabaseUrl}
                    onChange={e => setSupabaseUrl(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Clave Anónima (Anon Key)</label>
                  <input 
                    type="password" 
                    className="input-field" 
                    placeholder="Clave anónima"
                    value={supabaseAnonKey}
                    onChange={e => setSupabaseAnonKey(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
                  Actualizar Credenciales
                </button>
              </form>
            )}

            {configSuccess && (
              <div className="badge badge-success text-center mt-4" style={{ width: '100%', padding: '6px', justifyContent: 'center' }}>
                Credenciales actualizadas.
              </div>
            )}
          </>
        )}
      </div>

      {/* Backup Section */}
      <div className="card">
        <h3 className="card-title">Copia de Seguridad</h3>
        <p className="card-subtitle" style={{ marginBottom: '12px' }}>
          Descarga un archivo Excel completo con todo tu catálogo y bitácora de stock.
        </p>

        <button 
          onClick={handleExport} 
          disabled={exporting}
          className="btn btn-primary"
          style={{ width: '100%' }}
        >
          {exporting ? 'Generando Excel...' : 'Exportar Inventario a Excel'}
        </button>

        {exportSuccess && (
          <div className="badge badge-success text-center mt-4" style={{ width: '100%', padding: '8px', justifyContent: 'center' }}>
            Reporte Excel descargado con éxito.
          </div>
        )}
      </div>

      {/* Tabs Selector for Categories & Units */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
        <button
          onClick={() => setActiveTab('categories')}
          style={{
            flex: 1,
            padding: '12px 6px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'categories' ? '2px solid var(--text-primary)' : '2px solid transparent',
            color: activeTab === 'categories' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'categories' ? 600 : 400,
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Categorías
        </button>
        <button
          onClick={() => setActiveTab('units')}
          style={{
            flex: 1,
            padding: '12px 6px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'units' ? '2px solid var(--text-primary)' : '2px solid transparent',
            color: activeTab === 'units' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'units' ? 600 : 400,
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Unidades de Medida
        </button>
      </div>

      {error && <p style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '12px' }}>⚠️ {error}</p>}

      {/* Categories CRUD View */}
      {activeTab === 'categories' && (
        <div>
          <div className="flex-between mb-4">
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Organiza tus dulces en grupos principales.</span>
            <button onClick={handleOpenAddCat} className="btn btn-primary btn-sm">+ Nueva</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {categories.map(cat => (
              <div 
                key={cat.id} 
                className="flex-between"
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)'
                }}
              >
                <div>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{cat.name}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>
                    Prioridad de orden: {cat.sort_order}
                  </span>
                </div>

                {cat.id !== 'cat-default-0000-0000-000000000000' && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button 
                      onClick={() => handleOpenEditCat(cat)}
                      className="btn btn-secondary btn-sm"
                      style={{ minHeight: '28px', padding: '2px 8px' }}
                    >
                      Editar
                    </button>
                    <button 
                      onClick={() => handleDeleteCat(cat.id)}
                      className="btn btn-danger btn-sm"
                      style={{ minHeight: '28px', padding: '2px 8px', backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--danger)' }}
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Units CRUD View */}
      {activeTab === 'units' && (
        <div>
          <div className="flex-between mb-4">
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Gestiona los tipos de medida base (ej. Pza, Bolsa).</span>
            <button onClick={handleOpenAddUnit} className="btn btn-primary btn-sm">+ Nueva</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {units.map(unit => {
              const isProtected = ['u-uni', 'u-pza', 'u-gr', 'u-kg'].includes(unit.id);
              
              return (
                <div 
                  key={unit.id} 
                  className="flex-between"
                  style={{
                    padding: '10px 12px',
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)'
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{unit.name}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>
                      Abreviatura: <code style={{ backgroundColor: 'var(--bg-input)', padding: '2px 4px', borderRadius: '3px' }}>{unit.abbreviation}</code>
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button 
                      onClick={() => handleOpenEditUnit(unit)}
                      className="btn btn-secondary btn-sm"
                      style={{ minHeight: '28px', padding: '2px 8px' }}
                    >
                      Editar
                    </button>
                    {!isProtected && (
                      <button 
                        onClick={() => handleDeleteUnit(unit.id)}
                        className="btn btn-danger btn-sm"
                        style={{ minHeight: '28px', padding: '2px 8px', backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--danger)' }}
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category Add/Edit Modal */}
      {showCatModal && (
        <div className="modal-overlay" onClick={() => setShowCatModal(false)}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
            <div className="bottom-sheet-header">
              <h3 style={{ fontSize: '16px', margin: 0, fontWeight: 600 }}>
                {editingCatId ? 'Editar Categoría' : 'Nueva Categoría'}
              </h3>
              <button className="close-btn" onClick={() => setShowCatModal(false)}>×</button>
            </div>

            <form onSubmit={handleSaveCategory}>
              <div className="form-group">
                <label className="form-label">Nombre de la Categoría</label>
                <input 
                  type="text" 
                  className="input-field"
                  placeholder="Ej: Gomitas, Frituras..."
                  value={catName}
                  onChange={e => setCatName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">Orden de Visualización</label>
                <input 
                  type="number" 
                  className="input-field"
                  value={catSortOrder}
                  onChange={e => setCatSortOrder(e.target.value)}
                />
              </div>

              <div className="grid-2">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowCatModal(false)}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={loading}
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unit Add/Edit Modal */}
      {showUnitModal && (
        <div className="modal-overlay" onClick={() => setShowUnitModal(false)}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
            <div className="bottom-sheet-header">
              <h3 style={{ fontSize: '16px', margin: 0, fontWeight: 600 }}>
                {editingUnitId ? 'Editar Unidad de Medida' : 'Nueva Unidad de Medida'}
              </h3>
              <button className="close-btn" onClick={() => setShowUnitModal(false)}>×</button>
            </div>

            <form onSubmit={handleSaveUnit}>
              <div className="form-group">
                <label className="form-label">Nombre Completo</label>
                <input 
                  type="text" 
                  className="input-field"
                  placeholder="Ej: Bolsa, Paquete, Pieza..."
                  value={unitName}
                  onChange={e => setUnitName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">Abreviación</label>
                <input 
                  type="text" 
                  className="input-field"
                  placeholder="Ej: bolsa, paq, pza..."
                  value={unitAbbreviation}
                  onChange={e => setUnitAbbreviation(e.target.value)}
                  required
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Se usará para representar la cantidad en las listas de existencias.
                </span>
              </div>

              <div className="grid-2">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowUnitModal(false)}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={loading}
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
