import { db, type Product, type Stock, type UnitConversion } from '../db';
import { generateUUID } from '../utils';

export interface ProductWithDetails extends Product {
  stock_quantity: number;
  min_stock: number;
  category_name: string;
}

export const productRepository = {
  /**
   * Get all active products
   */
  async getAll(): Promise<Product[]> {
    return db.products.filter(p => p._deletedAt === undefined).toArray();
  },

  /**
   * Get all active products with stock and category details
   */
  async getAllWithDetails(): Promise<ProductWithDetails[]> {
    const products = await db.products.filter(p => p._deletedAt === undefined).toArray();
    const categories = await db.categories.toArray();
    const stocks = await db.stock.toArray();

    const catMap = new Map(categories.map(c => [c.id, c]));
    const stockMap = new Map(stocks.map(s => [s.product_id, s]));

    return products.map(p => {
      const cat = catMap.get(p.category_id);
      const st = stockMap.get(p.id);

      return {
        ...p,
        stock_quantity: st ? st.quantity : 0,
        min_stock: st ? st.min_stock : 0,
        category_name: cat ? cat.name : 'General / Otros',
      };
    });
  },

  /**
   * Find product by ID
   */
  async getById(id: string): Promise<Product | undefined> {
    const product = await db.products.get(id);
    if (product && product._deletedAt === undefined) {
      return product;
    }
    return undefined;
  },

  /**
   * Find product with stock and category detail by ID
   */
  async getDetailsById(id: string): Promise<ProductWithDetails | undefined> {
    const product = await db.products.get(id);
    if (!product || product._deletedAt !== undefined) return undefined;

    const cat = await db.categories.get(product.category_id);
    const stock = await db.stock.where('product_id').equals(id).first();

    return {
      ...product,
      stock_quantity: stock ? stock.quantity : 0,
      min_stock: stock ? stock.min_stock : 0,
      category_name: cat ? cat.name : 'General / Otros',
    };
  },

  /**
   * Search product by barcode or internal code
   */
  async getByCode(code: string): Promise<Product | undefined> {
    if (!code) return undefined;
    
    // Clean code (remove spaces/trim)
    const cleanCode = code.trim();
    
    // Check barcode first
    let product = await db.products.where('barcode').equals(cleanCode).first();
    
    // If not found, check internal code
    if (!product) {
      product = await db.products.where('internal_code').equals(cleanCode).first();
    }
    
    if (product && product._deletedAt === undefined) {
      return product;
    }
    return undefined;
  },

  /**
   * Create a new product along with its stock record, conversions, and optionally initial stock movement
   */
  async create(
    product: Omit<Product, 'id' | 'created_at' | 'updated_at'> & { id?: string },
    minStock = 0,
    initialQuantity = 0,
    initialConversions: Omit<UnitConversion, 'id' | 'product_id'>[] = []
  ): Promise<Product> {
    const id = product.id || generateUUID();
    const now = Date.now();
    
    const newProduct: Product = {
      ...product,
      id,
      created_at: now,
      updated_at: now,
      _syncStatus: 'pending',
      _lastModified: now,
    };

    const newStock: Stock = {
      id: generateUUID(),
      product_id: id,
      quantity: initialQuantity,
      min_stock: minStock,
      _syncStatus: 'pending',
      _lastModified: now,
    };

    await db.transaction('rw', [db.products, db.stock, db.unit_conversions, db.inventory_movements, db.sync_queue], async () => {
      // 1. Add product
      await db.products.put(newProduct);
      await db.sync_queue.add({
        id: generateUUID(),
        collection: 'products',
        type: 'CREATE',
        data: newProduct,
        timestamp: now,
        retryCount: 0,
      });

      // 2. Add stock
      await db.stock.put(newStock);
      await db.sync_queue.add({
        id: generateUUID(),
        collection: 'stock',
        type: 'CREATE',
        data: newStock,
        timestamp: now,
        retryCount: 0,
      });

      // 3. Add conversions if provided
      for (const conv of initialConversions) {
        const convId = generateUUID();
        const newConv: UnitConversion = {
          ...conv,
          id: convId,
          product_id: id,
          _syncStatus: 'pending',
          _lastModified: now,
        };
        await db.unit_conversions.put(newConv);
        await db.sync_queue.add({
          id: generateUUID(),
          collection: 'unit_conversions',
          type: 'CREATE',
          data: newConv,
          timestamp: now,
          retryCount: 0,
        });
      }

      // 4. Add initial inventory movement if quantity > 0
      if (initialQuantity > 0) {
        const movementId = generateUUID();
        const initialMovement = {
          id: movementId,
          product_id: id,
          type: 'INITIAL' as const,
          quantity: initialQuantity,
          unit: product.base_unit,
          unit_quantity: initialQuantity,
          converted_quantity: initialQuantity,
          reason: 'Carga inicial de inventario',
          date: now,
          _syncStatus: 'pending' as const,
          _lastModified: now,
        };
        await db.inventory_movements.put(initialMovement);
        await db.sync_queue.add({
          id: generateUUID(),
          collection: 'inventory_movements',
          type: 'CREATE',
          data: initialMovement,
          timestamp: now,
          retryCount: 0,
        });
      }
    });

    return newProduct;
  },

  /**
   * Update product
   */
  async update(id: string, updates: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>, minStock?: number): Promise<Product> {
    const existing = await db.products.get(id);
    if (!existing || existing._deletedAt !== undefined) {
      throw new Error('Product not found or deleted');
    }

    const now = Date.now();
    const updatedProduct: Product = {
      ...existing,
      ...updates,
      updated_at: now,
      _syncStatus: 'pending',
      _lastModified: now,
    };

    await db.transaction('rw', [db.products, db.stock, db.sync_queue], async () => {
      // 1. Update product
      await db.products.put(updatedProduct);
      await db.sync_queue.add({
        id: generateUUID(),
        collection: 'products',
        type: 'UPDATE',
        data: updatedProduct,
        timestamp: now,
        retryCount: 0,
      });

      // 2. Update stock min_stock if specified
      if (minStock !== undefined) {
        const stock = await db.stock.where('product_id').equals(id).first();
        if (stock) {
          const updatedStock = {
            ...stock,
            min_stock: minStock,
            _syncStatus: 'pending' as const,
            _lastModified: now,
          };
          await db.stock.put(updatedStock);
          await db.sync_queue.add({
            id: generateUUID(),
            collection: 'stock',
            type: 'UPDATE',
            data: updatedStock,
            timestamp: now,
            retryCount: 0,
          });
        }
      }
    });

    return updatedProduct;
  },

  /**
   * Soft delete a product
   */
  async delete(id: string): Promise<void> {
    const existing = await db.products.get(id);
    if (!existing || existing._deletedAt !== undefined) {
      return; // Already deleted or doesn't exist
    }

    const now = Date.now();
    const deletedProduct: Product = {
      ...existing,
      _deletedAt: now,
      _syncStatus: 'pending',
      _lastModified: now,
    };

    await db.transaction('rw', [db.products, db.stock, db.sync_queue], async () => {
      // 1. Mark product deleted
      await db.products.put(deletedProduct);
      await db.sync_queue.add({
        id: generateUUID(),
        collection: 'products',
        type: 'DELETE',
        data: { id },
        timestamp: now,
        retryCount: 0,
      });

      // 2. Clear stock quantity
      const stock = await db.stock.where('product_id').equals(id).first();
      if (stock) {
        const deletedStock = {
          ...stock,
          quantity: 0,
          _deletedAt: now, // Soft delete stock as well
          _syncStatus: 'pending' as const,
          _lastModified: now,
        };
        await db.stock.put(deletedStock);
        await db.sync_queue.add({
          id: generateUUID(),
          collection: 'stock',
          type: 'DELETE',
          data: { id: stock.id },
          timestamp: now,
          retryCount: 0,
        });
      }
    });
  },

  // --- Unit Conversions Repo Operations ---

  async getConversions(productId: string): Promise<UnitConversion[]> {
    return db.unit_conversions
      .where('product_id')
      .equals(productId)
      .filter(c => c._deletedAt === undefined)
      .toArray();
  },

  async addConversion(conversion: Omit<UnitConversion, 'id'>): Promise<UnitConversion> {
    const id = generateUUID();
    const now = Date.now();
    const newConversion: UnitConversion = {
      ...conversion,
      id,
      _syncStatus: 'pending',
      _lastModified: now,
    };

    await db.transaction('rw', [db.unit_conversions, db.sync_queue], async () => {
      await db.unit_conversions.put(newConversion);
      await db.sync_queue.add({
        id: generateUUID(),
        collection: 'unit_conversions',
        type: 'CREATE',
        data: newConversion,
        timestamp: now,
        retryCount: 0,
      });
    });

    return newConversion;
  },

  async deleteConversion(id: string): Promise<void> {
    const existing = await db.unit_conversions.get(id);
    if (!existing || existing._deletedAt !== undefined) {
      return;
    }

    const now = Date.now();
    const deletedConversion: UnitConversion = {
      ...existing,
      _deletedAt: now,
      _syncStatus: 'pending',
      _lastModified: now,
    };

    await db.transaction('rw', [db.unit_conversions, db.sync_queue], async () => {
      await db.unit_conversions.put(deletedConversion);
      await db.sync_queue.add({
        id: generateUUID(),
        collection: 'unit_conversions',
        type: 'DELETE',
        data: { id },
        timestamp: now,
        retryCount: 0,
      });
    });
  }
};
