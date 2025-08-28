/**
 * PSA Graded Cards Controller
 * Simple wrapper around CollectionCrudService for PsaGradedCard entity
 */

import PsaGradedCard from '@/collection/items/PsaGradedCard.js';
import CollectionCrudService from '@/collection/items/collectionCrudService.js';
import { asyncHandler } from '@/system/middleware/CentralizedErrorHandler.js';

const crudService = new CollectionCrudService(PsaGradedCard, 'PsaGradedCard');

export default {
  // CRUD operations
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
  }
};
