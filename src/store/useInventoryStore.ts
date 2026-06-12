import { create } from 'zustand';
import { categoryRepository } from '../lib/repositories/categoryRepository';
import { productRepository, type ProductWithDetails } from '../lib/repositories/productRepository';
import { inventoryRepository, type MovementWithDetails, type MovementInput } from '../lib/repositories/inventoryRepository';
import { unitRepository } from '../lib/repositories/unitRepository';
import { type Category, type Product, type UnitOfMeasure, type UnitConversion, seedInitialData } from '../lib/db';
import { getErrorMessage } from '../lib/utils';

interface InventoryState {
  products: ProductWithDetails[];
  categories: Category[];
  movements: MovementWithDetails[];
  units: UnitOfMeasure[];
  loading: boolean;
  error: string | null;
  isOnline: boolean;
  isSyncing: boolean;

  // Initializer
  initStore: () => Promise<void>;

  // Category Actions
  loadCategories: () => Promise<void>;
  addCategory: (category: Omit<Category, 'id'>) => Promise<Category>;
  updateCategory: (id: string, updates: Partial<Omit<Category, 'id'>>) => Promise<Category>;
  deleteCategory: (id: string) => Promise<void>;

  // Unit of Measure Actions
  loadUnits: () => Promise<void>;
  addUnit: (unit: Omit<UnitOfMeasure, 'id'>) => Promise<UnitOfMeasure>;
  updateUnit: (id: string, updates: Partial<Omit<UnitOfMeasure, 'id'>>) => Promise<UnitOfMeasure>;
  deleteUnit: (id: string) => Promise<void>;

  // Product Actions
  loadProducts: () => Promise<void>;
  addProduct: (
    product: Omit<Product, 'id' | 'created_at' | 'updated_at'>, 
    minStock: number, 
    initialQty: number,
    initialConversions?: Omit<UnitConversion, 'id' | 'product_id'>[]
  ) => Promise<Product>;
  updateProduct: (id: string, updates: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>, minStock?: number) => Promise<Product>;
  deleteProduct: (id: string) => Promise<void>;

  // Inventory Actions
  loadMovements: () => Promise<void>;
  addMovement: (movement: MovementInput) => Promise<void>;

  // Connection State
  setOnlineStatus: (status: boolean) => void;
  triggerSync: () => Promise<void>;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  products: [],
  categories: [],
  movements: [],
  units: [],
  loading: false,
  error: null,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSyncing: false,

  initStore: async () => {
    set({ loading: true, error: null });
    try {
      // 1. Seed database with defaults
      await seedInitialData();

      // 2. Fetch everything
      await Promise.all([
        get().loadCategories(),
        get().loadProducts(),
        get().loadMovements(),
        get().loadUnits(),
      ]);

      // 3. Listen to connection changes
      if (typeof window !== 'undefined') {
        window.addEventListener('online', () => {
          set({ isOnline: true });
          get().triggerSync();
        });
        window.addEventListener('offline', () => {
          set({ isOnline: false });
        });
      }
    } catch (err) {
      set({ error: getErrorMessage(err) || 'Error inicializando el almacén de datos' });
    } finally {
      set({ loading: false });
    }
  },

  loadCategories: async () => {
    try {
      const categories = await categoryRepository.getAll();
      set({ categories });
    } catch (err) {
      set({ error: getErrorMessage(err) || 'Error al cargar categorías' });
    }
  },

  addCategory: async (category) => {
    set({ loading: true, error: null });
    try {
      const newCat = await categoryRepository.create(category);
      await get().loadCategories();
      return newCat;
    } catch (err) {
      set({ error: getErrorMessage(err) || 'Error al guardar categoría' });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  updateCategory: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      const updated = await categoryRepository.update(id, updates);
      await Promise.all([get().loadCategories(), get().loadProducts()]); // Products hold category name
      return updated;
    } catch (err) {
      set({ error: getErrorMessage(err) || 'Error al actualizar categoría' });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  deleteCategory: async (id) => {
    set({ loading: true, error: null });
    try {
      await categoryRepository.delete(id);
      await Promise.all([get().loadCategories(), get().loadProducts()]);
    } catch (err) {
      set({ error: getErrorMessage(err) || 'Error al eliminar categoría' });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  loadUnits: async () => {
    try {
      const units = await unitRepository.getAll();
      set({ units });
    } catch (err) {
      set({ error: getErrorMessage(err) || 'Error al cargar unidades de medida' });
    }
  },

  addUnit: async (unit) => {
    set({ loading: true, error: null });
    try {
      const newUnit = await unitRepository.create(unit);
      await get().loadUnits();
      return newUnit;
    } catch (err) {
      set({ error: getErrorMessage(err) || 'Error al guardar unidad de medida' });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  updateUnit: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      const updated = await unitRepository.update(id, updates);
      await Promise.all([get().loadUnits(), get().loadProducts()]);
      return updated;
    } catch (err) {
      set({ error: getErrorMessage(err) || 'Error al actualizar unidad de medida' });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  deleteUnit: async (id) => {
    set({ loading: true, error: null });
    try {
      await unitRepository.delete(id);
      await Promise.all([get().loadUnits(), get().loadProducts()]);
    } catch (err) {
      set({ error: getErrorMessage(err) || 'Error al eliminar unidad de medida' });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  loadProducts: async () => {
    try {
      const products = await productRepository.getAllWithDetails();
      set({ products });
    } catch (err) {
      set({ error: getErrorMessage(err) || 'Error al cargar productos' });
    }
  },

  addProduct: async (product, minStock, initialQty, initialConversions = []) => {
    set({ loading: true, error: null });
    try {
      const newProduct = await productRepository.create(product, minStock, initialQty, initialConversions);
      await Promise.all([get().loadProducts(), get().loadMovements()]);
      return newProduct;
    } catch (err) {
      set({ error: getErrorMessage(err) || 'Error al crear producto' });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  updateProduct: async (id, updates, minStock) => {
    set({ loading: true, error: null });
    try {
      const updated = await productRepository.update(id, updates, minStock);
      await Promise.all([get().loadProducts(), get().loadMovements()]);
      return updated;
    } catch (err) {
      set({ error: getErrorMessage(err) || 'Error al actualizar producto' });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  deleteProduct: async (id) => {
    set({ loading: true, error: null });
    try {
      await productRepository.delete(id);
      await Promise.all([get().loadProducts(), get().loadMovements()]);
    } catch (err) {
      set({ error: getErrorMessage(err) || 'Error al eliminar producto' });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  loadMovements: async () => {
    try {
      const movements = await inventoryRepository.getAllWithDetails();
      set({ movements });
    } catch (err) {
      set({ error: getErrorMessage(err) || 'Error al cargar movimientos' });
    }
  },

  addMovement: async (movement) => {
    set({ loading: true, error: null });
    try {
      await inventoryRepository.addMovement(movement);
      await Promise.all([get().loadProducts(), get().loadMovements()]);
    } catch (err) {
      set({ error: getErrorMessage(err) || 'Error al registrar movimiento' });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  setOnlineStatus: (isOnline) => {
    set({ isOnline });
    if (isOnline) {
      get().triggerSync();
    }
  },

  triggerSync: async () => {
    if (get().isSyncing) return;
    set({ isSyncing: true });
    
    // Simulate minor sync network lag
    await new Promise(resolve => setTimeout(resolve, 800));
    
    set({ isSyncing: false });
  }
}));
