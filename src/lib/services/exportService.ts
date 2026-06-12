import * as XLSX from 'xlsx';
import { db } from '../db';
import { formatDate } from '../utils';

export async function exportToExcel(): Promise<void> {
  try {
    // 1. Fetch data from Dexie
    const products = await db.products.filter(p => p._deletedAt === undefined).toArray();
    const categories = await db.categories.toArray();
    const stocks = await db.stock.toArray();
    const movements = await db.inventory_movements.reverse().sortBy('date');

    const catMap = new Map(categories.map(c => [c.id, c.name]));
    const stockMap = new Map(stocks.map(s => [s.product_id, s]));

    // 2. Format Products sheet
    const productsSheetData = products.map(p => {
      const stock = stockMap.get(p.id);
      const currentStock = stock ? stock.quantity : 0;
      const minStock = stock ? stock.min_stock : 0;
      const status = currentStock <= minStock ? 'ALERTA STOCK BAJO' : 'OK';

      return {
        'Código Interno': p.internal_code,
        'Código de Barras': p.barcode || 'Sin código',
        'Nombre del Producto': p.name,
        'Categoría': catMap.get(p.category_id) || 'General / Otros',
        'Presentación Base': p.base_unit,
        'Precio de Compra ($)': p.purchase_price,
        'Precio de Venta ($)': p.sale_price,
        'Stock Actual': currentStock,
        'Stock Mínimo': minStock,
        'Estado': status,
        'Notas': p.notes || '',
      };
    });

    // 3. Format Movements/Log sheet
    const movementsSheetData = movements.map(m => {
      const prod = products.find(p => p.id === m.product_id);
      
      const typeLabel = m.type === 'PURCHASE' ? 'COMPRA (Entrada)'
        : m.type === 'ADJUSTMENT' ? (m.quantity >= 0 ? 'AJUSTE (+) Entrada' : 'AJUSTE (-) Salida')
        : m.type === 'COUNT' ? 'CONTEO FISICO (Fijar stock)'
        : m.type === 'INITIAL' ? 'INVENTARIO INICIAL'
        : m.type;

      return {
        'Fecha y Hora': formatDate(m.date, true),
        'Código Interno': prod ? prod.internal_code : '-',
        'Nombre del Producto': prod ? prod.name : 'Producto Eliminado',
        'Tipo de Movimiento': typeLabel,
        'Unidad Usada': m.unit,
        'Cantidad en Unidad': m.unit_quantity,
        'Total en Pzas/Grs (Base)': m.quantity,
        'Motivo / Comentario': m.reason,
        'Notas Adicionales': m.notes || '',
      };
    });

    // 4. Create sheets and workbook
    const wsProducts = XLSX.utils.json_to_sheet(productsSheetData);
    const wsMovements = XLSX.utils.json_to_sheet(movementsSheetData);
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsProducts, 'Catálogo e Inventario');
    XLSX.utils.book_append_sheet(wb, wsMovements, 'Bitácora de Movimientos');

    // 5. Trigger download
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Reporte_Inventario_Dulceria_${dateStr}.xlsx`);
  } catch (error) {
    console.error('Error al exportar a Excel:', error);
    throw new Error('No se pudo generar el reporte de Excel.', { cause: error });
  }
}
