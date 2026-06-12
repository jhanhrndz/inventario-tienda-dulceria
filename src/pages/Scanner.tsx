import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useInventoryStore } from '../store/useInventoryStore';
import { productRepository, type ProductWithDetails } from '../lib/repositories/productRepository';
import { formatCurrency, generateNextInternalCode, getErrorMessage } from '../lib/utils';
import { type UnitConversion } from '../lib/db';

export const Scanner: React.FC = () => {
  const { categories, units, addProduct, addMovement, loading } = useInventoryStore();

  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [scannedProduct, setScannedProduct] = useState<ProductWithDetails | null>(null);
  const [manualCode, setManualCode] = useState('');
  
  // Scanner state
  const [scannerActive, setScannerActive] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Quick transaction state
  const [quickQty, setQuickQty] = useState('1');
  const [quickUnit, setQuickUnit] = useState('pieza');
  const [productUnits, setProductUnits] = useState<string[]>(['pieza']);
  const [isPurchase, setIsPurchase] = useState(true);
  const [txSuccess, setTxSuccess] = useState(false);

  // New Product state (if scanned code doesn't exist)
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newBaseUnit, setNewBaseUnit] = useState('unidad');
  const [newPurchasePrice, setNewPurchasePrice] = useState('0');
  const [newSalePrice, setNewSalePrice] = useState('0');
  const [newMinStock, setNewMinStock] = useState('5');
  const [newInternalCode, setNewInternalCode] = useState('');
  const [newContentSize, setNewContentSize] = useState('');
  const [newInitialStock, setNewInitialStock] = useState('0');
  const [newNotes, setNewNotes] = useState('');
  const [conversions, setConversions] = useState<UnitConversion[]>([]);
  const [newConvUnit, setNewConvUnit] = useState('caja');
  const [newConvFactor, setNewConvFactor] = useState('24');

  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const scannerId = 'camera-reader-element';

  const handleProcessCode = async (code: string) => {
    setScannedCode(code);
    
    // Check if product exists
    const product = await productRepository.getDetailsById(code) || await productRepository.getByCode(code);
    
    if (product) {
      // Exist: show quick inventory form
      const castedProd = product as ProductWithDetails;
      setScannedProduct(castedProd);
      
      // Load units
      const baseUnit = castedProd.base_unit;
      const convs = await productRepository.getConversions(castedProd.id);
      const units = [baseUnit, ...convs.map(c => c.from_unit)];
      setProductUnits(units);
      setQuickUnit(baseUnit);
    } else {
      // Don't exist: pre-fill form
      setScannedProduct(null);
      setNewName('');
      setNewCategoryId('');
      setNewBaseUnit('unidad');
      setNewPurchasePrice('');
      setNewSalePrice('');
      setNewMinStock('5');
      setNewInternalCode('');
      setNewContentSize('');
      setNewInitialStock('0');
      setNewNotes('');
      setConversions([]);
      setNewConvUnit('caja');
      setNewConvFactor('24');
      setShowCreateForm(true);
    }
  };

  // Start/Stop scanner based on scannerActive state
  useEffect(() => {
    let isMounted = true;

    const initScanner = async () => {
      // Wait for DOM to render container element
      await new Promise(resolve => setTimeout(resolve, 150));
      if (!isMounted) return;

      const element = document.getElementById(scannerId);
      if (!element) {
        console.error('Scanner element not found in DOM');
        setScanError('Error: No se encontró el contenedor de la cámara.');
        setScannerActive(false);
        return;
      }

      try {
        if (!html5QrcodeRef.current) {
          html5QrcodeRef.current = new Html5Qrcode(scannerId);
        }

        // Avoid double-start
        if (html5QrcodeRef.current.isScanning) {
          return;
        }

        const qrCodeSuccessCallback = async (decodedText: string) => {
          console.log('Barcode scanned:', decodedText);
          try {
            window.speechSynthesis.speak(new SpeechSynthesisUtterance('OK'));
          } catch {
            // Ignore speech synthesis errors
          }

          // Stop scanner first
          if (html5QrcodeRef.current?.isScanning) {
            await html5QrcodeRef.current.stop();
          }
          if (isMounted) {
            setScannerActive(false);
            void handleProcessCode(decodedText);
          }
        };

        const config = { 
          fps: 10, 
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.777778
        };

        await html5QrcodeRef.current.start(
          { facingMode: 'environment' },
          config,
          qrCodeSuccessCallback,
          () => {
            // Ignore spam error messages from html5-qrcode
          }
        );
      } catch (err) {
        console.error('Error starting scanner:', err);
        if (isMounted) {
          setScanError(getErrorMessage(err) || 'No se pudo acceder a la cámara. Concede permisos.');
          setScannerActive(false);
        }
      }
    };

    const deactivateScanner = async () => {
      if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
        try {
          await html5QrcodeRef.current.stop();
        } catch (e) {
          console.error('Error stopping scanner:', e);
        }
      }
    };

    if (scannerActive) {
      void initScanner();
    } else {
      void deactivateScanner();
    }

    return () => {
      isMounted = false;
      void deactivateScanner();
    };
  }, [scannerActive]);

  const startScanner = () => {
    setScanError(null);
    setScannedCode(null);
    setScannedProduct(null);
    setShowCreateForm(false);
    setTxSuccess(false);
    setScannerActive(true);
  };

  const stopScanner = () => {
    setScannerActive(false);
  };

  // Hook for generating internal code
  useEffect(() => {
    if (!showCreateForm) return;

    const updateInternalCode = async () => {
      if (!newCategoryId) {
        setNewInternalCode('');
        return;
      }
      try {
        const code = await generateNextInternalCode(newCategoryId);
        setNewInternalCode(code);
      } catch (err) {
        console.error('Error generating internal code:', err);
      }
    };

    void updateInternalCode();
  }, [newCategoryId, showCreateForm]);

  const handleAddConversion = () => {
    if (!newConvUnit.trim()) return;
    const factor = parseFloat(newConvFactor) || 1;

    setConversions([...conversions, {
      id: 'temp-' + Date.now(),
      product_id: '',
      from_unit: newConvUnit.trim().toLowerCase(),
      to_unit: newBaseUnit,
      factor,
    }]);
    setNewConvUnit('');
    setNewConvFactor('24');
  };

  const handleDeleteConversion = (convId: string) => {
    setConversions(conversions.filter(c => c.id !== convId));
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    stopScanner();
    handleProcessCode(manualCode.trim());
    setManualCode('');
  };

  const handleQuickTxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedProduct) return;

    let quantity = parseFloat(quickQty) || 0;
    if (!isPurchase) {
      quantity = -quantity; // adjustment subtraction
    }

    try {
      await addMovement({
        product_id: scannedProduct.id,
        type: isPurchase ? 'PURCHASE' : 'ADJUSTMENT',
        unit: quickUnit,
        unit_quantity: quantity,
        reason: isPurchase ? 'Mercancía nueva (Escáner)' : 'Ajuste rápido (Escáner)',
        notes: 'Registro mediante escáner de cámara'
      });

      // Fetch updated product details
      const updated = await productRepository.getDetailsById(scannedProduct.id);
      if (updated) setScannedProduct(updated);

      setTxSuccess(true);
      setQuickQty('1');
      setTimeout(() => setTxSuccess(false), 2500);
    } catch (err) {
      alert('Error: ' + getErrorMessage(err));
    }
  };

  const handleCreateProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedCode || !newName.trim() || !newInternalCode.trim() || !newCategoryId) return;

    try {
      // Create product
      await addProduct({
        name: newName.trim(),
        barcode: scannedCode,
        internal_code: newInternalCode.trim(),
        category_id: newCategoryId,
        base_unit: newBaseUnit,
        purchase_price: parseFloat(newPurchasePrice) || 0,
        sale_price: parseFloat(newSalePrice) || 0,
        notes: newNotes.trim() || `Registrado tras escanear: ${scannedCode}`,
        content_size: newContentSize.trim() || undefined,
      }, parseFloat(newMinStock) || 0, parseFloat(newInitialStock) || 0, conversions.map(c => ({ from_unit: c.from_unit, to_unit: c.to_unit, factor: c.factor })));

      setShowCreateForm(false);
      // Automatically load the newly created product details
      void handleProcessCode(scannedCode);
    } catch (err) {
      alert('Error al crear producto: ' + getErrorMessage(err));
    }
  };

  return (
    <div className="p-20 animate-slide-up" style={{ paddingBottom: '40px' }}>
      <h2 className="mb-4" style={{ fontSize: '24px' }}>Escáner de Códigos</h2>

      {/* Manual Input Search Bar */}
      <form onSubmit={handleManualSearch} className="search-bar">
        <svg className="search-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input 
          type="text" 
          className="input-field search-input" 
          placeholder="Escribe el código de barras manualmente..." 
          value={manualCode}
          onChange={e => setManualCode(e.target.value)}
        />
      </form>

      {/* Scanner viewfinder / video stream container */}
      {!scannedCode && !showCreateForm && (
        <div className="card" style={{ padding: '12px', overflow: 'hidden' }}>
          {scannerActive ? (
            <div className="scanner-overlay animate-slide-up">
              <div id={scannerId} style={{ width: '100%', height: '100%', objectFit: 'cover' }}></div>
              <div className="scanner-laser"></div>
              <div className="scanner-viewfinder"></div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '32px 16px' }}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '64px', height: '64px', display: 'block', margin: '0 auto', animation: 'pulse 2s infinite', color: 'var(--text-muted)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
              <button 
                type="button" 
                className="btn btn-primary mt-4" 
                style={{ width: '100%' }}
                onClick={startScanner}
              >
                Activar Cámara y Escanear
              </button>
              {scanError && (
                <p style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '12px' }}>
                  ⚠️ {scanError}
                </p>
              )}
            </div>
          )}

          {scannerActive && (
            <button 
              type="button" 
              className="btn btn-secondary mt-4" 
              style={{ width: '100%' }}
              onClick={stopScanner}
            >
              Apagar Cámara
            </button>
          )}
        </div>
      )}

      {/* Scanned product found state */}
      {scannedCode && scannedProduct && (
        <div className="card animate-slide-up">
          <div className="flex-between">
            <span className="badge badge-success">¡Producto Encontrado!</span>
            <button className="btn btn-secondary btn-sm" onClick={startScanner}>
              🔄 Volver a Escanear
            </button>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px', alignItems: 'center' }}>

            <div>
              <h3 style={{ fontSize: '18px', margin: 0 }}>{scannedProduct.name}</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Cód: {scannedProduct.internal_code} | Barras: {scannedCode}
              </p>
            </div>
          </div>

          {/* Current Stock Widget */}
          <div 
            className="flex-between mt-4" 
            style={{ 
              backgroundColor: 'var(--bg-input)', 
              padding: '12px', 
              borderRadius: 'var(--radius-sm)' 
            }}
          >
            <div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block' }}>Stock en Tienda</span>
              <strong style={{ fontSize: '20px', color: 'var(--text-primary)' }}>
                {scannedProduct.stock_quantity} {scannedProduct.base_unit}
              </strong>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block' }}>Precio Venta</span>
              <strong style={{ fontSize: '20px', color: 'var(--primary)' }}>
                {formatCurrency(scannedProduct.sale_price)}
              </strong>
            </div>
          </div>

          {/* Quick Adjustment / Transaction Form */}
          <form onSubmit={handleQuickTxSubmit} className="mt-4" style={{ borderTop: '1px dashed var(--border)', paddingTop: '16px' }}>
            <h4 style={{ fontSize: '14px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
              Registrar Movimiento Rápido
            </h4>

            <div className="grid-2" style={{ marginBottom: '12px' }}>
              <button 
                type="button" 
                className={`btn ${isPurchase ? 'btn-primary' : 'btn-secondary'}`}
                style={{ minHeight: '40px', padding: '6px' }}
                onClick={() => setIsPurchase(true)}
              >
                Recibir (Compra)
              </button>
              <button 
                type="button" 
                className={`btn ${!isPurchase ? 'btn-primary' : 'btn-secondary'}`}
                style={{ minHeight: '40px', padding: '6px', backgroundColor: !isPurchase ? 'var(--danger)' : 'var(--bg-input)' }}
                onClick={() => setIsPurchase(false)}
              >
                Retirar (Ajuste)
              </button>
            </div>

            <div className="grid-2">
              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label className="form-label" style={{ fontSize: '12px', marginBottom: '2px' }}>Cantidad</label>
                <input 
                  type="number" 
                  className="input-field" 
                  value={quickQty}
                  onChange={e => setQuickQty(e.target.value)}
                  style={{ padding: '8px 12px' }}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label className="form-label" style={{ fontSize: '12px', marginBottom: '2px' }}>Presentación</label>
                <select 
                  className="select-field"
                  value={quickUnit}
                  onChange={e => setQuickUnit(e.target.value)}
                  style={{ padding: '8px 12px' }}
                >
                  {productUnits.map(unit => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>
              {isPurchase ? 'Guardar Entrada' : 'Guardar Salida'}
            </button>

            {txSuccess && (
              <div className="badge badge-success text-center mt-4" style={{ width: '100%', padding: '10px', justifyContent: 'center' }}>
                ¡Movimiento registrado con éxito!
              </div>
            )}
          </form>
        </div>
      )}

      {/* Scanned product NOT found - creation form */}
      {scannedCode && showCreateForm && (
        <div className="card animate-slide-up" style={{ borderColor: 'var(--warning)' }}>
          <div className="flex-between">
            <span className="badge badge-warning">Producto No Registrado</span>
            <button className="btn btn-secondary btn-sm" onClick={startScanner}>
              🔄 Reintentar Escáner
            </button>
          </div>

          <p className="card-subtitle mt-4">
            El código <strong>{scannedCode}</strong> no existe. Rellena los datos para agregarlo al inventario.
          </p>

          <form onSubmit={handleCreateProductSubmit} className="mt-4">
            <div className="form-group">
              <label className="form-label">Nombre del Producto</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Ej: Bubu Lubu Gigante" 
                value={newName}
                onChange={e => setNewName(e.target.value)}
                required
              />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Código Interno</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={newInternalCode}
                  required
                  readOnly
                  style={{ backgroundColor: 'rgba(0,0,0,0.03)' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Código de Barras</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={scannedCode}
                  readOnly
                  style={{ backgroundColor: 'rgba(0,0,0,0.03)' }}
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Categoría</label>
                <select 
                  className="select-field"
                  value={newCategoryId}
                  onChange={e => setNewCategoryId(e.target.value)}
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
                  value={newBaseUnit}
                  onChange={e => setNewBaseUnit(e.target.value)}
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
                value={newContentSize}
                onChange={e => setNewContentSize(e.target.value)}
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
                  value={newPurchasePrice}
                  onChange={e => setNewPurchasePrice(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Precio de Venta ($)</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="input-field" 
                  placeholder="0.00" 
                  value={newSalePrice}
                  onChange={e => setNewSalePrice(e.target.value)}
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Alerta Stock Mínimo</label>
                <input 
                  type="number" 
                  className="input-field" 
                  value={newMinStock}
                  onChange={e => setNewMinStock(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Stock Inicial</label>
                <input 
                  type="number" 
                  className="input-field" 
                  value={newInitialStock}
                  onChange={e => setNewInitialStock(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notas / Observaciones</label>
              <textarea 
                className="input-field" 
                style={{ height: '60px', resize: 'none' }}
                placeholder="Detalles sobre presentación, sabor o proveedor..."
                value={newNotes}
                onChange={e => setNewNotes(e.target.value)}
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

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }} disabled={loading}>
              Crear Producto e Inicializar Stock
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
