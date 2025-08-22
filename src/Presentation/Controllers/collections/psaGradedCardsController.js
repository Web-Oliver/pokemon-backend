/**
 * PSA Graded Cards Controller
 * Simple wrapper around CollectionCrudService for PsaGradedCard entity
 */

import PsaGradedCard from '@/Domain/Entities/PsaGradedCard.js';
import CollectionCrudService from '@/Application/UseCases/Collections/collectionCrudService.js';

const crudService = new CollectionCrudService(PsaGradedCard, 'psa-graded-card');

export default {
  // CRUD operations
  async getAll(req, res, next) {
    return crudService.getAll(req, res, next);
  },

  async getById(req, res, next) {
    return crudService.getById(req, res, next);
  },

  async create(req, res, next) {
    return crudService.create(req, res, next);
  },

  async update(req, res, next) {
    return crudService.update(req, res, next);
  },

  async delete(req, res, next) {
    return crudService.delete(req, res, next);
  },

  async search(req, res, next) {
    return crudService.search(req, res, next);
  },

  // Additional utility methods
  async uploadImage(req, res, next) {
    return crudService.uploadImage(req, res, next);
  },

  async bulkImport(req, res, next) {
    return crudService.bulkImport(req, res, next);
  }
};