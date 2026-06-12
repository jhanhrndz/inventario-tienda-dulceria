import { db, type Category } from '../db';
import { generateUUID } from '../utils';

export const categoryRepository = {
  /**
   * Get all active categories (not soft-deleted) sorted by sort_order and name
   */
  async getAll(): Promise<Category[]> {
    return db.categories
      .filter(c => c._deletedAt === undefined)
      .toArray()
      .then(cats => 
        cats.sort((a, b) => {
          if (a.sort_order !== b.sort_order) {
            return a.sort_order - b.sort_order;
          }
          return a.name.localeCompare(b.name);
        })
      );
  },

  /**
   * Find category by ID
   */
  async getById(id: string): Promise<Category | undefined> {
    const cat = await db.categories.get(id);
    if (cat && cat._deletedAt === undefined) {
      return cat;
    }
    return undefined;
  },

  /**
   * Create a new category
   */
  async create(category: Omit<Category, 'id'> & { id?: string }): Promise<Category> {
    const id = category.id || generateUUID();
    const now = Date.now();
    const newCategory: Category = {
      ...category,
      id,
      _syncStatus: 'pending',
      _lastModified: now,
    };

    await db.transaction('rw', [db.categories, db.sync_queue], async () => {
      await db.categories.put(newCategory);
      await db.sync_queue.add({
        id: generateUUID(),
        collection: 'categories',
        type: 'CREATE',
        data: newCategory,
        timestamp: now,
        retryCount: 0,
      });
    });

    return newCategory;
  },

  /**
   * Update an existing category
   */
  async update(id: string, updates: Partial<Omit<Category, 'id'>>): Promise<Category> {
    const existing = await db.categories.get(id);
    if (!existing || existing._deletedAt !== undefined) {
      throw new Error('Category not found or deleted');
    }

    const now = Date.now();
    const updatedCategory: Category = {
      ...existing,
      ...updates,
      _syncStatus: 'pending',
      _lastModified: now,
    };

    await db.transaction('rw', [db.categories, db.sync_queue], async () => {
      await db.categories.put(updatedCategory);
      await db.sync_queue.add({
        id: generateUUID(),
        collection: 'categories',
        type: 'UPDATE',
        data: updatedCategory,
        timestamp: now,
        retryCount: 0,
      });
    });

    return updatedCategory;
  },

  /**
   * Soft delete a category
   */
  async delete(id: string): Promise<void> {
    const existing = await db.categories.get(id);
    if (!existing || existing._deletedAt !== undefined) {
      return; // Already deleted or doesn't exist
    }

    const now = Date.now();
    const deletedCategory: Category = {
      ...existing,
      _deletedAt: now,
      _syncStatus: 'pending',
      _lastModified: now,
    };

    await db.transaction('rw', [db.categories, db.sync_queue], async () => {
      await db.categories.put(deletedCategory);
      await db.sync_queue.add({
        id: generateUUID(),
        collection: 'categories',
        type: 'DELETE',
        data: { id },
        timestamp: now,
        retryCount: 0,
      });
    });
  }
};
