import { db, type UnitOfMeasure } from '../db';
import { generateUUID } from '../utils';

export const unitRepository = {
  /**
   * Get all active units of measure (not soft-deleted) sorted by name
   */
  async getAll(): Promise<UnitOfMeasure[]> {
    return db.units
      .filter(u => u._deletedAt === undefined)
      .toArray()
      .then(units => units.sort((a, b) => a.name.localeCompare(b.name)));
  },

  /**
   * Find unit by ID
   */
  async getById(id: string): Promise<UnitOfMeasure | undefined> {
    const unit = await db.units.get(id);
    if (unit && unit._deletedAt === undefined) {
      return unit;
    }
    return undefined;
  },

  /**
   * Find unit by abbreviation
   */
  async getByAbbreviation(abbrev: string): Promise<UnitOfMeasure | undefined> {
    const cleanAbbrev = abbrev.trim().toLowerCase();
    return db.units
      .filter(u => u.abbreviation.toLowerCase() === cleanAbbrev && u._deletedAt === undefined)
      .first();
  },

  /**
   * Create a new unit of measure
   */
  async create(unit: Omit<UnitOfMeasure, 'id'> & { id?: string }): Promise<UnitOfMeasure> {
    const id = unit.id || generateUUID();
    const now = Date.now();
    const cleanAbbrev = unit.abbreviation.trim().toLowerCase();
    
    // Check if abbreviation already exists
    const existing = await this.getByAbbreviation(cleanAbbrev);
    if (existing) {
      throw new Error(`La unidad con abreviatura "${cleanAbbrev}" ya existe.`);
    }

    const newUnit: UnitOfMeasure = {
      ...unit,
      id,
      abbreviation: cleanAbbrev,
      _syncStatus: 'pending',
      _lastModified: now,
    };

    await db.transaction('rw', [db.units, db.sync_queue], async () => {
      await db.units.put(newUnit);
      await db.sync_queue.add({
        id: generateUUID(),
        collection: 'units',
        type: 'CREATE',
        data: newUnit,
        timestamp: now,
        retryCount: 0,
      });
    });

    return newUnit;
  },

  /**
   * Update an existing unit of measure
   */
  async update(id: string, updates: Partial<Omit<UnitOfMeasure, 'id'>>): Promise<UnitOfMeasure> {
    const existing = await db.units.get(id);
    if (!existing || existing._deletedAt !== undefined) {
      throw new Error('Unit not found or deleted');
    }

    const now = Date.now();
    let cleanAbbrev = existing.abbreviation;
    if (updates.abbreviation !== undefined) {
      cleanAbbrev = updates.abbreviation.trim().toLowerCase();
      // Check abbreviation uniqueness
      const existingAbbrev = await this.getByAbbreviation(cleanAbbrev);
      if (existingAbbrev && existingAbbrev.id !== id) {
        throw new Error(`La unidad con abreviatura "${cleanAbbrev}" ya existe.`);
      }
    }

    const updatedUnit: UnitOfMeasure = {
      ...existing,
      ...updates,
      ...(updates.abbreviation !== undefined ? { abbreviation: cleanAbbrev } : {}),
      _syncStatus: 'pending',
      _lastModified: now,
    };

    await db.transaction('rw', [db.units, db.sync_queue], async () => {
      await db.units.put(updatedUnit);
      await db.sync_queue.add({
        id: generateUUID(),
        collection: 'units',
        type: 'UPDATE',
        data: updatedUnit,
        timestamp: now,
        retryCount: 0,
      });
    });

    return updatedUnit;
  },

  /**
   * Soft delete a unit of measure
   */
  async delete(id: string): Promise<void> {
    const existing = await db.units.get(id);
    if (!existing || existing._deletedAt !== undefined) {
      return; // Already deleted or doesn't exist
    }

    // Protect default system units from deletion if necessary
    const protectedIds = ['u-uni', 'u-pza', 'u-gr', 'u-kg'];
    if (protectedIds.includes(id)) {
      throw new Error('No se puede eliminar una unidad base del sistema.');
    }

    const now = Date.now();
    const deletedUnit: UnitOfMeasure = {
      ...existing,
      _deletedAt: now,
      _syncStatus: 'pending',
      _lastModified: now,
    };

    await db.transaction('rw', [db.units, db.sync_queue], async () => {
      await db.units.put(deletedUnit);
      await db.sync_queue.add({
        id: generateUUID(),
        collection: 'units',
        type: 'DELETE',
        data: { id },
        timestamp: now,
        retryCount: 0,
      });
    });
  }
};
