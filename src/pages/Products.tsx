import React, { useState } from 'react';
import { useInventoryStore } from '../store/useInventoryStore';
import { formatCurrency, generateNextInternalCode } from '../lib/utils';
import { productRepository, type ProductWithDetails } from '../lib/repositories/productRepository';
import { type UnitConversion } from '../lib/db';

export const Products: React.FC = () => {
  const { 
    products, 
    categories, 
    addProduct, 
    updateProduct, 
    deleteProduct, 
    loading,
    units
  } = useInventoryStore();

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [filterLowStock, setFilterLowStock] = useState(false);

  // View State
  const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
  const [editingProdId, setEditingProdId] = useState<string | null>(null);
  
  // Form Fields
  const [prodName, setProdName] = useState('');
  const [prodBarcode, setProdBarcode] = useState('');
  const [prodInternalCode, setProdInternalCode] = useState('');
  const [prodCategoryId, setProdCategoryId] = useState('');
  const [prodBaseUnit, setProdBaseUnit] = useState('unidad');
  const [prodPurchasePrice, setProdPurchasePrice] = useState('0');
  const [prodSalePrice, setProdSalePrice] = useState('0');
  const [prodMinStock, setProdMinStock] = useState('5');
  const [prodInitialStock, setProdInitialStock] = useState('0');
  const [prodNotes, setProdNotes] = useState('');
  const [prodContentSize, setProdContentSize] = useState('');
  const [originalCategoryId, setOriginalCategoryId] = useState('');
  const [originalInternalCode, setOriginalInternalCode] = useState('');

  // Unit Conversions Sub-state
  const [conversions, setConversions] = useState<UnitConversion[]>([]);
  const [newConvUnit, setNewConvUnit] = useState('caja');
  const [newConvFactor, setNewConvFactor] = useState('24');

  const handleCategoryChange = async (newCatId: string) => {
    setProdCategoryId(newCatId);
    if (!newCatId) {
      setProdInternalCode('');
      return;
    }
    if (!editingProdId) {
      // Creation Mode
      const code = await generateNextInternalCode(newCatId);
      setProdInternalCode(code);
    } else {
      // Edit Mode
      if (newCatId === originalCategoryId) {
        setProdInternalCode(originalInternalCode);
      } else {
        const code = await generateNextInternalCode(newCatId);
        setProdInternalCode(code);
      }
    }
  };

  const handleOpenAdd = () => {
    setEditingProdId(null);
    setProdName('');
    setProdBarcode('');
    setProdInternalCode('');
    setProdCategoryId('');
    setOriginalCategoryId('');
    setOriginalInternalCode('');
    setProdBaseUnit('pza');
    setProdPurchasePrice('');
    setProdSalePrice('');
    setProdMinStock('5');
    setProdInitialStock('0');
    setProdNotes('');
    setProdContentSize('');
    setConversions([]);
    setViewMode('form');
  };

  const handleOpenEdit = async (prod: ProductWithDetails) => {
    setEditingProdId(prod.id);
    setProdName(prod.name);
    setProdBarcode(prod.barcode || '');
    setProdInternalCode(prod.internal_code);
    setProdCategoryId(prod.category_id);
    setOriginalCategoryId(prod.category_id);
    setOriginalInternalCode(prod.internal_code);
    setProdBaseUnit(prod.base_unit);
    setProdPurchasePrice(String(prod.purchase_price));
    setProdSalePrice(String(prod.sale_price));
    setProdMinStock(String(prod.min_stock));
    setProdInitialStock('0'); // not editable since stock has already changed
    setProdNotes(prod.notes || '');
    setProdContentSize(prod.content_size || '');
    
    // Load conversions immediately
    try {
      const convs = await productRepository.getConversions(prod.id);
      setConversions(convs);
    } catch (err) {
      console.error('Error loading conversions:', err);
    }
    
    setViewMode('form');
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim() || !prodInternalCode.trim() || !prodCategoryId) return;

    const prodData = {
      name: prodName.trim(),
      barcode: prodBarcode.trim() || undefined,
      internal_code: prodInternalCode.trim(),
      category_id: prodCategoryId,
      base_unit: prodBaseUnit,
      purchase_price: parseFloat(prodPurchasePrice) || 0,
      sale_price: parseFloat(prodSalePrice) || 0,
      notes: prodNotes.trim(),
      content_size: prodContentSize.trim() || undefined,
    };

    const minStock = parseFloat(prodMinStock) || 0;
    const initialQty = parseFloat(prodInitialStock) || 0;

    try {
      if (editingProdId) {
        await updateProduct(editingProdId, prodData, minStock);
      } else {
        await addProduct(prodData, minStock, initialQty, conversions.map(c => ({ from_unit: c.from_unit, to_unit: c.to_unit, factor: c.factor })));
      }
      setViewMode('list');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar este producto? El historial de movimientos se mantendrá, pero el producto ya no figurará en el catálogo.')) {
      try {
        await deleteProduct(id);
        setViewMode('list');
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Conversion actions
  const handleAddConversion = async () => {
    if (!newConvUnit.trim()) return;
    const factor = parseFloat(newConvFactor) || 1;
    
    if (editingProdId) {
      // Editing existing product: persist to DB immediately
      try {
        const newConv = await productRepository.addConversion({
          product_id: editingProdId,
          from_unit: newConvUnit.trim().toLowerCase(),
          to_unit: prodBaseUnit,
          factor,
        });
        setConversions([...conversions, newConv]);
      } catch (err) {
        console.error(err);
      }
    } else {
      // Creating new product: add to local state only, will be saved transactionally
      setConversions([...conversions, {
        id: 'temp-' + Date.now(),
        product_id: '',
        from_unit: newConvUnit.trim().toLowerCase(),
        to_unit: prodBaseUnit,
        factor,
      }]);
    }
    setNewConvUnit('');
    setNewConvFactor('24');
  };

  const handleDeleteConversion = async (convId: string) => {
    if (convId.startsWith('temp-')) {
      // Local-only conversion (new product), just remove from state
      setConversions(conversions.filter(c => c.id !== convId));
    } else {
      try {
        await productRepository.deleteConversion(convId);
        setConversions(conversions.filter(c => c.id !== convId));
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Filtered Products List
  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.internal_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchTerm));
      
    const matchesCategory = selectedCategory === 'all' || p.category_id === selectedCategory;
    const matchesLowStock = !filterLowStock || p.stock_quantity <= p.min_stock;

    return matchesSearch && matchesCategory && matchesLowStock;
  });

  if (viewMode === 'form') {
    return (
      <div className="p-20 animate-slide-up" style={{ paddingBottom: '40px' }}>
        <div className="flex-between mb-4" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <h2 style={{ fontSize: '20px', margin: 0, fontWeight: 600 }}>
            {editingProdId ? 'Editar Producto' : 'Nuevo Producto'}
          </h2>
          <button className="btn btn-secondary btn-sm" onClick={() => setViewMode('list')}>
            ← Volver al Catálogo
          </button>
        </div>

        <form onSubmit={handleSaveProduct}>
          {/* Product General Info */}
          <div className="form-group">
            <label className="form-label">Nombre del Producto</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Ej: Mazapán De La Rosa Gigante" 
              value={prodName}
              onChange={e => setProdName(e.target.value)}
              required
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Código Interno</label>
              <input 
                type="text" 
                className="input-field" 
                value={prodInternalCode}
                onChange={e => setProdInternalCode(e.target.value)}
                required
                readOnly={!!editingProdId}
                style={{ backgroundColor: editingProdId ? 'rgba(0,0,0,0.03)' : 'var(--bg-input)' }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Código de Barras (Opcional)</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Escanear o escribir" 
                value={prodBarcode}
                onChange={e => setProdBarcode(e.target.value)}
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Categoría</label>
              <select 
                className="select-field"
                value={prodCategoryId}
                onChange={e => handleCategoryChange(e.target.value)}
                required
              >
                <option value="">-- Seleccionar Categoría --</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Unidad de Medida Base</label>
              <select 
                className="select-field"
                value={prodBaseUnit}
                onChange={e => setProdBaseUnit(e.target.value)}
              >
                {units.map(u => (
                  <option key={u.id} value={u.abbreviation}>{u.name} ({u.abbreviation})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Contenido / Presentación (Opcional)</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Ej: 80g, 500ml, 100g" 
              value={prodContentSize}
              onChange={e => setProdContentSize(e.target.value)}
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              Información descriptiva del empaque individual.
            </span>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Precio de Compra ($)</label>
              <input 
                type="number" 
                step="0.01"
                className="input-field" 
                placeholder="0.00" 
                value={prodPurchasePrice}
                onChange={e => setProdPurchasePrice(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Precio de Venta ($)</label>
              <input 
                type="number" 
                step="0.01"
                className="input-field" 
                placeholder="0.00" 
                value={prodSalePrice}
                onChange={e => setProdSalePrice(e.target.value)}
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Alerta Stock Mínimo</label>
              <input 
                type="number" 
                className="input-field" 
                value={prodMinStock}
                onChange={e => setProdMinStock(e.target.value)}
              />
            </div>
            {!editingProdId && (
              <div className="form-group">
                <label className="form-label">Stock Inicial (Pzas/Grs)</label>
                <input 
                  type="number" 
                  className="input-field" 
                  value={prodInitialStock}
                  onChange={e => setProdInitialStock(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Notas / Observaciones</label>
            <textarea 
              className="input-field" 
              style={{ height: '60px', resize: 'none' }}
              placeholder="Detalles sobre presentación, sabor o proveedor..."
              value={prodNotes}
              onChange={e => setProdNotes(e.target.value)}
            />
          </div>

          {/* Unit Conversions Section */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px', marginBottom: '20px' }}>
            <h4 style={{ fontSize: '14px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
              Presentaciones / Conversión de Unidades
            </h4>
            
            {/* List of conversions */}
            {conversions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                {conversions.map(conv => (
                  <div key={conv.id} className="flex-between" style={{ padding: '6px 8px', backgroundColor: 'var(--bg-input)', borderRadius: '4px', fontSize: '13px' }}>
                    <span>1 <strong>{conv.from_unit}</strong> = {conv.factor} {conv.to_unit} (base)</span>
                    <button 
                      type="button" 
                      className="btn btn-danger btn-sm" 
                      style={{ minHeight: '24px', padding: '2px 6px', fontSize: '11px' }}
                      onClick={() => handleDeleteConversion(conv.id)}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Conversion mini-form */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label className="form-label" style={{ fontSize: '11px', marginBottom: '2px' }}>Unidad (Ej: Caja)</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="caja, display, pqte"
                  style={{ padding: '8px', fontSize: '13px' }}
                  value={newConvUnit}
                  onChange={e => setNewConvUnit(e.target.value)}
                />
              </div>
              <div style={{ width: '80px' }}>
                <label className="form-label" style={{ fontSize: '11px', marginBottom: '2px' }}>Factor</label>
                <input 
                  type="number" 
                  className="input-field" 
                  style={{ padding: '8px', fontSize: '13px' }}
                  value={newConvFactor}
                  onChange={e => setNewConvFactor(e.target.value)}
                />
              </div>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm" 
                style={{ padding: '8px 12px', minHeight: '34px' }}
                onClick={handleAddConversion}
              >
                Añadir
              </button>
            </div>
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
              Guardar
            </button>
          </div>

          {editingProdId && (
            <button 
              type="button" 
              className="btn btn-danger btn-sm"
              style={{ width: '100%', marginTop: '16px', minHeight: '44px' }}
              onClick={() => handleDeleteProduct(editingProdId)}
            >
              Eliminar Producto
            </button>
          )}
        </form>
      </div>
    );
  }

  return (
    <div className="p-20 animate-slide-up" style={{ paddingBottom: '40px' }}>
      <div className="flex-between mb-4">
        <h2 style={{ fontSize: '24px', margin: 0 }}>Catálogo de Productos</h2>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          + Agregar Producto
        </button>
      </div>

      {/* Search & Filter Section */}
      <div className="card" style={{ padding: '12px' }}>
        <div className="search-bar">
          <svg className="search-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input 
            type="text" 
            className="input-field search-input" 
            placeholder="Buscar por nombre, código..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="grid-2">
          <div>
            <label className="form-label" style={{ marginBottom: '2px', fontSize: '12px' }}>Categoría</label>
            <select 
              className="select-field"
              style={{ padding: '8px 12px', fontSize: '14px' }}
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
            >
              <option value="all">Todas las categorías</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <label 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--text-secondary)'
              }}
            >
              <input 
                type="checkbox" 
                checked={filterLowStock} 
                onChange={e => setFilterLowStock(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
              />
              Solo stock bajo
            </label>
          </div>
        </div>
      </div>

      {/* Product List Count */}
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px', textAlign: 'right' }}>
        Mostrando {filteredProducts.length} de {products.length} productos
      </p>

      {/* Products Grid / List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filteredProducts.map(prod => {
          const isLowStock = prod.stock_quantity <= prod.min_stock;
          
          return (
            <div 
              key={prod.id} 
              className="card" 
              style={{ 
                margin: 0, 
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer'
              }}
              onClick={() => handleOpenEdit(prod)}
            >
              {/* Product Info Left */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                <div style={{ minWidth: 0 }}>
                  <h4 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {prod.name}{prod.content_size ? ` (${prod.content_size})` : ''}
                  </h4>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '2px' }}>
                    <span className="badge" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)', padding: '2px 6px', fontSize: '10px' }}>
                      {prod.internal_code}
                    </span>
                    {prod.barcode && (
                      <span className="badge" style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--text-muted)', padding: '2px 6px', fontSize: '10px' }}>
                        {prod.barcode}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    P. Compra: {formatCurrency(prod.purchase_price)} | P. Venta: {formatCurrency(prod.sale_price)}
                  </span>
                </div>
              </div>

              {/* Product Stock Right */}
              <div style={{ textAlign: 'right', marginLeft: '12px' }}>
                <span 
                  className={`badge ${isLowStock ? 'badge-warning' : 'badge-success'}`}
                  style={{ fontSize: '14px', padding: '6px 12px', fontWeight: 700 }}
                >
                  {prod.stock_quantity} {prod.base_unit}
                </span>
                <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Min: {prod.min_stock}
                </span>
              </div>
            </div>
          );
        })}

        {filteredProducts.length === 0 && (
          <div className="card text-center" style={{ padding: '32px' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Sin resultados</p>
            <h4 className="mt-4">No se encontraron productos</h4>
            <p className="card-subtitle">
              Intenta cambiar los filtros o agrega un producto nuevo.
            </p>
          </div>
        )}
      </div>

    </div>
  );
};
