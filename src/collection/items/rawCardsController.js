/**
 * Raw Cards Controller
 * Simple wrapper around CollectionCrudService for RawCard entity
 */

import RawCard from '@/collection/items/RawCard.js';
import CollectionCrudService from '@/collection/items/collectionCrudService.js';

const crudService = new CollectionCrudService(RawCard, 'RawCard');

export default {
  // CRUD operations - fixed to match service method names
  async getAll(req, res, next) {
    try {
      const items = await crudService.findAll({});
      res.json({ success: true, data: items });
    } catch (error) {
      next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const item = await crudService.findById(req.params.id);
      res.json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  },

  async create(req, res, next) {
    try {
      const item = await crudService.create(req.body);
      res.status(201).json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  },

  async update(req, res, next) {
    try {
      const item = await crudService.updateById(req.params.id, req.body);
      res.json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  },

  async delete(req, res, next) {
    try {
      await crudService.deleteById(req.params.id);
      res.json({ success: true, message: 'Item deleted successfully' });
    } catch (error) {
      next(error);
    }
  },

  async search(req, res, next) {
    try {
      const filters = {}; // Build filters from req.query if needed
      const items = await crudService.findAll(filters);
      res.json({ success: true, data: items });
    } catch (error) {
      next(error);
    }
  },

  // Additional utility methods - need to check if these exist in service
  async uploadImage(req, res, next) {
    res.status(501).json({ success: false, message: 'Image upload not yet implemented' });
  },

  async bulkImport(req, res, next) {
    res.status(501).json({ success: false, message: 'Bulk import not yet implemented' });
  }
};
