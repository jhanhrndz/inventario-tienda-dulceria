import { db, type InventoryMovement, type Stock } from '../db';
import { generateUUID } from '../utils';

export interface MovementWithDetails extends InventoryMovement {
  product_name: string;
  product_internal_code: string;
  product_barcode?: string;
  category_name: string;
}

export interface MovementInput {
  product_id: string;
  type: 'PURCHASE' | 'ADJUSTMENT' | 'COUNT' | 'INITIAL';
  unit: string; // presentation unit, e.g. "caja", "pieza"
  unit_quantity: number; // count/number of units
  reason: string;
  notes?: string;
}

export const inventoryRepository = {
  /**
   * Add an inventory movement and update the stock transactionally.
   */
  async addMovement(input: MovementInput): Promise<InventoryMovement> {
    const now = Date.now();
    const id = generateUUID();

    // 1. Get product base unit to see if conversion is needed
    const product = await db.products.get(input.product_id);
    if (!product) {
      throw new Error(`Product ${input.product_id} not found`);
    }

    let factor = 1;
    if (input.unit !== product.base_unit) {
      // Find conversion factor
      const conversion = await db.unit_conversions
        .where('[product_id+from_unit]')
        .equals([input.product_id, input.unit])
        .filter(c => c._deletedAt === undefined)
        .first();
      
      if (conversion) {
        factor = conversion.factor;
      } else {
        console.warn(`No conversion found for ${input.unit} to ${product.base_unit} for product ${product.name}. Defaulting to factor 1.`);
      }
    }

    // Calculate converted quantity in base unit
    // Note: For adjustments and purchases, quantity can be positive or negative
    // (e.g. adjustment of -5 pieces, or purchase of 2 boxes = +48 pieces)
    // For COUNT, unit_quantity is the absolute physical count, so we convert that to base unit.
    const converted_quantity = input.unit_quantity * factor;
    const quantityInBaseUnit = input.type === 'COUNT' ? converted_quantity : converted_quantity;

    const newMovement: InventoryMovement = {
      id,
      product_id: input.product_id,
      type: input.type,
      quantity: quantityInBaseUnit, // matches converted_quantity
      unit: input.unit,
      unit_quantity: input.unit_quantity,
      converted_quantity: quantityInBaseUnit,
      reason: input.reason,
      notes: input.notes,
      date: now,
      _syncStatus: 'pending',
      _lastModified: now,
    };

    await db.transaction('rw', [db.stock, db.inventory_movements, db.sync_queue], async () => {
      // Get stock record
      let stock = await db.stock.where('product_id').equals(input.product_id).first();
      
      if (!stock) {
        // Create stock record if it doesn't exist
        stock = {
          id: generateUUID(),
          product_id: input.product_id,
          quantity: 0,
          min_stock: 0,
          _syncStatus: 'pending',
          _lastModified: now,
        };
        await db.stock.put(stock);
      }

      const updatedStock: Stock = {
        ...stock,
        _syncStatus: 'pending',
        _lastModified: now,
      };

      if (input.type === 'COUNT') {
        // COUNT overwrites the stock quantity completely
        updatedStock.quantity = quantityInBaseUnit;
        updatedStock.last_count_date = now;
      } else {
        // Other movements accumulate
        updatedStock.quantity += quantityInBaseUnit;
      }

      // 2. Put stock
      await db.stock.put(updatedStock);
      await db.sync_queue.add({
        id: generateUUID(),
        collection: 'stock',
        type: 'UPDATE',
        data: updatedStock,
        timestamp: now,
        retryCount: 0,
      });

      // 3. Put movement
      await db.inventory_movements.put(newMovement);
      await db.sync_queue.add({
        id: generateUUID(),
        collection: 'inventory_movements',
        type: 'CREATE',
        data: newMovement,
        timestamp: now,
        retryCount: 0,
      });
    });

    return newMovement;
  },

  /**
   * Get all movements for a specific product
   */
  async getByProduct(productId: string): Promise<InventoryMovement[]> {
    return db.inventory_movements
      .where('product_id')
      .equals(productId)
      .reverse()
      .sortBy('date');
  },

  /**
   * Get all movements with detailed product and category names, sorted descending by date
   */
  async getAllWithDetails(): Promise<MovementWithDetails[]> {
    const movements = await db.inventory_movements.reverse().sortBy('date');
    const products = await db.products.toArray();
    const categories = await db.categories.toArray();

    const productMap = new Map(products.map(p => [p.id, p]));
    const catMap = new Map(categories.map(c => [c.id, c]));

    return movements.map(m => {
      const prod = productMap.get(m.product_id);
      const cat = prod ? catMap.get(prod.category_id) : undefined;

      return {
        ...m,
        product_name: prod ? prod.name : 'Producto Eliminado',
        product_internal_code: prod ? prod.internal_code : '-',
        product_barcode: prod?.barcode,
        category_name: cat ? cat.name : 'General / Otros',
      };
    });
  }
};
