import Dexie, { type Table } from 'dexie';

// --- Interfaces ---

export interface SyncableEntity {
  user_id?: string;
  _syncStatus?: 'synced' | 'pending' | 'conflicted';
  _lastModified?: number;
  _deletedAt?: number;
}

export interface UnitOfMeasure extends SyncableEntity {
  id: string; // UUID v4 or short code
  name: string; // E.g., "Unidad", "Pieza", "Gramo"
  abbreviation: string; // E.g., "unidad", "pza", "gr"
}

export interface Category extends SyncableEntity {
  id: string; // UUID v4
  name: string;
  sort_order: number;
}

export interface Product extends SyncableEntity {
  id: string; // UUID v4
  name: string;
  barcode?: string;
  internal_code: string; // E.g., DUL-001
  category_id: string;
  base_unit: string; // E.g., "unidad", "pza", "gr" (matches unit abbreviation)
  purchase_price: number;
  sale_price: number;
  notes?: string;
  created_at: number;
  updated_at: number;
  content_size?: string; // E.g., "80g", "500ml", "100g" (descriptive only)
}

export interface UnitConversion extends SyncableEntity {
  id: string; // UUID v4
  product_id: string;
  from_unit: string; // E.g., "caja"
  to_unit: string;   // E.g., "pieza"
  factor: number;    // E.g., 24 (1 caja = 24 piezas)
}

export interface Stock extends SyncableEntity {
  id: string; // UUID v4
  product_id: string;
  quantity: number; // Always in base_unit
  min_stock: number;
  last_count_date?: number;
}

export interface InventoryMovement extends SyncableEntity {
  id: string; // UUID v4
  product_id: string;
  type: 'PURCHASE' | 'ADJUSTMENT' | 'COUNT' | 'INITIAL';
  quantity: number; // Positive for incoming, negative for outgoing (in base_unit)
  unit: string; // Presentation used (e.g. "caja", "pieza")
  unit_quantity: number; // Quantity in the entered unit
  converted_quantity: number; // Quantity in base_unit (matches quantity)
  reason: string;
  notes?: string;
  date: number; // Timestamp
}

export interface QueuedOperation {
  id: string; // UUID v4
  collection: string; // E.g. "products", "categories"
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  data: unknown;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

// --- Dexie Database Definition ---

class DulceriaDatabase extends Dexie {
  units!: Table<UnitOfMeasure, string>;
  categories!: Table<Category, string>;
  products!: Table<Product, string>;
  unit_conversions!: Table<UnitConversion, string>;
  stock!: Table<Stock, string>;
  inventory_movements!: Table<InventoryMovement, string>;
  sync_queue!: Table<QueuedOperation, string>;

  constructor() {
    super('DulceriaInventoryDB');
    
    // Version 1
    this.version(1).stores({
      categories: 'id, name, sort_order',
      products: 'id, barcode, internal_code, category_id, name',
      unit_conversions: 'id, product_id, [product_id+from_unit]',
      stock: 'id, product_id, quantity',
      inventory_movements: 'id, product_id, type, date, [product_id+date]',
      sync_queue: 'id, collection, timestamp',
    });

    // Version 2 (Adds units table, cleans categories schema logic)
    this.version(2).stores({
      units: 'id, name, abbreviation',
      categories: 'id, name, sort_order',
      products: 'id, barcode, internal_code, category_id, name',
      unit_conversions: 'id, product_id, [product_id+from_unit]',
      stock: 'id, product_id, quantity',
      inventory_movements: 'id, product_id, type, date, [product_id+date]',
      sync_queue: 'id, collection, timestamp',
    });
  }
}

export const db = new DulceriaDatabase();

// --- Seed Helper ---
export async function seedInitialData() {
  // 1. Seed Categories
  const categoryCount = await db.categories.count();
  if (categoryCount === 0) {
    const defaultCategoryId = 'cat-default-0000-0000-000000000000';
    await db.categories.add({
      id: defaultCategoryId,
      name: 'General / Otros',
      sort_order: 0,
    });
    
    const categories = [
      { id: 'cat-general-otros', name: 'General / Otros', sort_order: 1 },
      { id: 'cat-lacteos', name: 'Lácteos', sort_order: 2 },
      { id: 'cat-dulces', name: 'Dulces', sort_order: 3 },
      { id: 'cat-paletas', name: 'Paletas', sort_order: 4 },
      { id: 'cat-mecatos', name: 'Mecatos', sort_order: 5 },
      { id: 'cat-bebidas', name: 'Bebidas', sort_order: 6 },
      { id: 'cat-frutas', name: 'Frutas', sort_order: 7 },
    ];
    
    for (const cat of categories) {
      await db.categories.add(cat);
    }
  }

  // 2. Seed Units of Measure
  const unitCount = await db.units.count();
  if (unitCount === 0) {
    const initialUnits = [
      { id: 'u-uni', name: 'Unidad', abbreviation: 'unidad' },
      { id: 'u-pza', name: 'Pieza', abbreviation: 'pza' },
      { id: 'u-gr', name: 'Gramo', abbreviation: 'gr' },
      { id: 'u-kg', name: 'Kilogramo', abbreviation: 'kg' },
      { id: 'u-paq', name: 'Paquete', abbreviation: 'paq' },
      { id: 'u-bolsa', name: 'Bolsa', abbreviation: 'bolsa' },
      { id: 'u-caja', name: 'Caja', abbreviation: 'caja' },
      { id: 'u-l', name: 'Litro', abbreviation: 'l' },
      { id: 'u-ml', name: 'Mililitro', abbreviation: 'ml' },
      { id: 'u-cm3', name: 'Centimetros cúbicos', abbreviation: 'cm³' },
      { id: 'u-displey', name: 'Displey', abbreviation: 'displey' },
    ];
    
    for (const u of initialUnits) {
      await db.units.add(u);
    }
  }
}
