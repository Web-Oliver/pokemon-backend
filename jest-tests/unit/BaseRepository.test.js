const mongoose = require('mongoose');
const BaseRepository = require('../../repositories/base/BaseRepository');
const { NotFoundError, ValidationError } = require('../../middleware/errorHandler');
const { withDatabase } = require('../helpers/database.helper');

// Create a test model schema for testing
const testSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  dateAdded: { type: Date, default: Date.now },
  relatedField: { type: mongoose.Schema.Types.ObjectId, ref: 'RelatedModel' },
});

const TestModel = mongoose.model('TestModel', testSchema);
const RelatedModel = mongoose.model('RelatedModel', new mongoose.Schema({ name: String }));

describe('BaseRepository', () => {
  let repository;
  let relatedDocument;

  withDatabase();

  beforeEach(async () => {
    repository = new BaseRepository(TestModel, {
      entityName: 'TestEntity',
      defaultPopulate: 'relatedField',
      defaultSort: { dateAdded: -1 },
      defaultLimit: 5,
    });

    // Create a related document for population testing
    relatedDocument = await RelatedModel.create({ name: 'Related Document' });
  });

  afterEach(async () => {
    await TestModel.deleteMany({});
    await RelatedModel.deleteMany({});
  });

  describe('Constructor', () => {
    test('should initialize with correct model and options', () => {
      expect(repository.model).toBe(TestModel);
      expect(repository.options.entityName).toBe('TestEntity');
      expect(repository.options.defaultPopulate).toBe('relatedField');
      expect(repository.options.defaultSort).toEqual({ dateAdded: -1 });
      expect(repository.options.defaultLimit).toBe(5);
    });

    test('should use default options when not provided', () => {
      const defaultRepo = new BaseRepository(TestModel);

      expect(defaultRepo.options.entityName).toBe('TestModel');
      expect(defaultRepo.options.defaultSort).toEqual({ dateAdded: -1 });
      expect(defaultRepo.options.defaultLimit).toBe(1000);
    });
  });

  describe('findById', () => {
    test('should find document by valid ID', async () => {
      const testDoc = await TestModel.create({
        name: 'Test Document',
        relatedField: relatedDocument._id,
      });

      const result = await repository.findById(testDoc._id.toString());

      expect(result).toBeDefined();
      expect(result.name).toBe('Test Document');
      expect(result.relatedField).toBeDefined();
      expect(result.relatedField.name).toBe('Related Document'); // Populated
    });

    test('should throw ValidationError for invalid ObjectId', async () => {
      await expect(repository.findById('invalid-id')).rejects.toThrow(ValidationError);
      await expect(repository.findById('invalid-id')).rejects.toThrow('Invalid ObjectId format');
    });

    test('should throw NotFoundError for non-existent ID', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      await expect(repository.findById(nonExistentId.toString())).rejects.toThrow(NotFoundError);
      await expect(repository.findById(nonExistentId.toString())).rejects.toThrow('TestEntity not found');
    });

    test('should work without population when not specified', async () => {
      const repoWithoutPopulate = new BaseRepository(TestModel);
      const testDoc = await TestModel.create({
        name: 'Test Document',
        relatedField: relatedDocument._id,
      });

      const result = await repoWithoutPopulate.findById(testDoc._id.toString());

      expect(result).toBeDefined();
      expect(result.name).toBe('Test Document');
      expect(mongoose.Types.ObjectId.isValid(result.relatedField)).toBe(true);
    });

    test('should override default populate with options', async () => {
      const testDoc = await TestModel.create({
        name: 'Test Document',
        relatedField: relatedDocument._id,
      });

      const result = await repository.findById(testDoc._id.toString(), { populate: null });

      expect(result).toBeDefined();
      expect(result.name).toBe('Test Document');
      expect(mongoose.Types.ObjectId.isValid(result.relatedField)).toBe(true);
    });
  });

  describe('findAll', () => {
    beforeEach(async () => {
      // Create test documents
      await TestModel.create([
        { name: 'Document 1', description: 'First', relatedField: relatedDocument._id },
        { name: 'Document 2', description: 'Second' },
        { name: 'Document 3', description: 'Third' },
      ]);
    });

    test('should find all documents with default options', async () => {
      const results = await repository.findAll();

      expect(results).toHaveLength(3);
      expect(results[0].name).toBeDefined();
      // Find the document that has the populated relatedField
      const populatedDoc = results.find(doc => doc.relatedField && doc.relatedField.name);

      expect(populatedDoc?.relatedField?.name).toBe('Related Document');
    });

    test('should apply filters correctly', async () => {
      const results = await repository.findAll({ name: 'Document 1' });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Document 1');
    });

    test('should apply limit correctly', async () => {
      const results = await repository.findAll({}, { limit: 2 });

      expect(results).toHaveLength(2);
    });

    test('should apply skip correctly', async () => {
      const results = await repository.findAll({}, { skip: 1, limit: 2 });

      expect(results).toHaveLength(2);
      // Since we created documents sequentially, skipping 1 should give us the second and third
    });

    test('should apply sorting', async () => {
      const results = await repository.findAll({}, { sort: { name: 1 } });

      expect(results[0].name).toBe('Document 1');
      expect(results[1].name).toBe('Document 2');
      expect(results[2].name).toBe('Document 3');
    });

    test('should apply field selection', async () => {
      const results = await repository.findAll({}, { select: 'name' });

      expect(results[0].name).toBeDefined();
      expect(results[0].description).toBeUndefined();
    });

    test('should work without population', async () => {
      const results = await repository.findAll({}, { populate: null });

      expect(results).toHaveLength(3);
      expect(results[0].relatedField?.name).toBeUndefined(); // Not populated
    });
  });

  describe('count', () => {
    beforeEach(async () => {
      await TestModel.create([
        { name: 'Document 1' },
        { name: 'Document 2' },
        { name: 'Special Document' },
      ]);
    });

    test('should count all documents', async () => {
      const count = await repository.count();

      expect(count).toBe(3);
    });

    test('should count with filters', async () => {
      const count = await repository.count({ name: /^Document/ });

      expect(count).toBe(2);
    });

    test('should return 0 for no matches', async () => {
      const count = await repository.count({ name: 'Non-existent' });

      expect(count).toBe(0);
    });
  });

  describe('findWithPagination', () => {
    beforeEach(async () => {
      // Create 10 test documents
      const docs = Array.from({ length: 10 }, (_, i) => ({
        name: `Document ${i + 1}`,
        description: `Description ${i + 1}`,
      }));

      await TestModel.create(docs);
    });

    test('should return paginated results with metadata', async () => {
      const result = await repository.findWithPagination({}, { page: 1, limit: 3 });

      expect(result.data).toHaveLength(3);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 3,
        totalCount: 10,
        totalPages: 4,
        hasNextPage: true,
        hasPrevPage: false,
      });
    });

    test('should handle middle page correctly', async () => {
      const result = await repository.findWithPagination({}, { page: 2, limit: 3 });

      expect(result.data).toHaveLength(3);
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPrevPage).toBe(true);
    });

    test('should handle last page correctly', async () => {
      const result = await repository.findWithPagination({}, { page: 4, limit: 3 });

      expect(result.data).toHaveLength(1); // Only 1 document on last page
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPrevPage).toBe(true);
    });

    test('should use default limit from repository options', async () => {
      const result = await repository.findWithPagination({}, { page: 1 });

      expect(result.data).toHaveLength(5); // Default limit from repository
      expect(result.pagination.limit).toBe(5);
    });
  });

  describe('create', () => {
    test('should create document successfully', async () => {
      const data = {
        name: 'New Document',
        description: 'New Description',
        relatedField: relatedDocument._id,
      };

      const result = await repository.create(data);

      expect(result).toBeDefined();
      expect(result.name).toBe('New Document');
      expect(result.description).toBe('New Description');
      expect(result._id).toBeDefined();
      expect(result.relatedField.name).toBe('Related Document'); // Populated
    });

    test('should create without population when not specified', async () => {
      const data = { name: 'New Document' };
      const result = await repository.create(data, { populate: null });

      expect(result).toBeDefined();
      expect(result.name).toBe('New Document');
      expect(result.relatedField).toBeUndefined();
    });

    test('should throw ValidationError for invalid data', async () => {
      await expect(repository.create({})).rejects.toThrow(ValidationError);
    });

    test('should handle mongoose validation errors', async () => {
      const data = { description: 'Missing required name' };
      
      await expect(repository.create(data)).rejects.toThrow(ValidationError);
    });
  });

  describe('update', () => {
    let testDocument;

    beforeEach(async () => {
      testDocument = await TestModel.create({
        name: 'Original Name',
        description: 'Original Description',
      });
    });

    test('should update document successfully', async () => {
      const updateData = { name: 'Updated Name', description: 'Updated Description' };
      
      const result = await repository.update(testDocument._id.toString(), updateData);

      expect(result.name).toBe('Updated Name');
      expect(result.description).toBe('Updated Description');
      expect(result._id.toString()).toBe(testDocument._id.toString());
    });

    test('should throw ValidationError for invalid ID', async () => {
      await expect(repository.update('invalid-id', {})).rejects.toThrow(ValidationError);
    });

    test('should throw NotFoundError for non-existent document', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      await expect(
        repository.update(nonExistentId.toString(), { name: 'Updated' })
      ).rejects.toThrow(NotFoundError);
    });

    test('should run validators on update', async () => {
      // Try to set name to empty string (required field)
      await expect(
        repository.update(testDocument._id.toString(), { name: '' })
      ).rejects.toThrow(ValidationError);
    });

    test('should populate after update when specified', async () => {
      await repository.update(
        testDocument._id.toString(), 
        { relatedField: relatedDocument._id }
      );

      // Update should return populated document
      const result = await repository.findById(testDocument._id.toString());

      expect(result.relatedField.name).toBe('Related Document');
    });
  });

  describe('delete', () => {
    let testDocument;

    beforeEach(async () => {
      testDocument = await TestModel.create({
        name: 'Document to Delete',
        description: 'Will be deleted',
      });
    });

    test('should delete document successfully', async () => {
      const result = await repository.delete(testDocument._id.toString());

      expect(result._id.toString()).toBe(testDocument._id.toString());
      expect(result.name).toBe('Document to Delete');

      // Verify document is actually deleted
      const count = await TestModel.countDocuments({ _id: testDocument._id });

      expect(count).toBe(0);
    });

    test('should throw ValidationError for invalid ID', async () => {
      await expect(repository.delete('invalid-id')).rejects.toThrow(ValidationError);
    });

    test('should throw NotFoundError for non-existent document', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      await expect(repository.delete(nonExistentId.toString())).rejects.toThrow(NotFoundError);
    });
  });

  describe('findOne', () => {
    beforeEach(async () => {
      await TestModel.create([
        { name: 'First Document', description: 'First' },
        { name: 'Second Document', description: 'Second' },
      ]);
    });

    test('should find one document matching filters', async () => {
      const result = await repository.findOne({ name: 'First Document' });

      expect(result).toBeDefined();
      expect(result.name).toBe('First Document');
    });

    test('should return null when no match found', async () => {
      const result = await repository.findOne({ name: 'Non-existent' });

      expect(result).toBeNull();
    });

    test('should apply population', async () => {
      await TestModel.create({
        name: 'With Relation',
        relatedField: relatedDocument._id,
      });

      const result = await repository.findOne({ name: 'With Relation' });

      expect(result).toBeDefined();
      expect(result.relatedField.name).toBe('Related Document');
    });
  });

  describe('updateMany', () => {
    beforeEach(async () => {
      await TestModel.create([
        { name: 'Document 1', description: 'Old' },
        { name: 'Document 2', description: 'Old' },
        { name: 'Document 3', description: 'Different' },
      ]);
    });

    test('should update multiple documents', async () => {
      const result = await repository.updateMany(
        { description: 'Old' },
        { description: 'Updated' }
      );

      expect(result.modifiedCount).toBe(2);

      const updatedDocs = await TestModel.find({ description: 'Updated' });

      expect(updatedDocs).toHaveLength(2);
    });

    test('should return update statistics', async () => {
      const result = await repository.updateMany(
        { description: 'Old' },
        { description: 'New' }
      );

      expect(result).toHaveProperty('modifiedCount');
      expect(result).toHaveProperty('matchedCount');
      expect(result.matchedCount).toBe(2);
    });
  });

  describe('deleteMany', () => {
    beforeEach(async () => {
      await TestModel.create([
        { name: 'Delete Me 1', description: 'ToDelete' },
        { name: 'Delete Me 2', description: 'ToDelete' },
        { name: 'Keep Me', description: 'Keep' },
      ]);
    });

    test('should delete multiple documents', async () => {
      const result = await repository.deleteMany({ description: 'ToDelete' });

      expect(result.deletedCount).toBe(2);

      const remainingDocs = await TestModel.find();

      expect(remainingDocs).toHaveLength(1);
      expect(remainingDocs[0].name).toBe('Keep Me');
    });
  });

  describe('exists', () => {
    beforeEach(async () => {
      await TestModel.create({ name: 'Existing Document' });
    });

    test('should return true for existing documents', async () => {
      const exists = await repository.exists({ name: 'Existing Document' });

      expect(exists).toBe(true);
    });

    test('should return false for non-existing documents', async () => {
      const exists = await repository.exists({ name: 'Non-existing' });

      expect(exists).toBe(false);
    });
  });

  describe('aggregate', () => {
    beforeEach(async () => {
      await TestModel.create([
        { name: 'Doc 1', description: 'Type A' },
        { name: 'Doc 2', description: 'Type A' },
        { name: 'Doc 3', description: 'Type B' },
      ]);
    });

    test('should perform aggregation operations', async () => {
      const pipeline = [
        { $group: { _id: '$description', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ];

      const result = await repository.aggregate(pipeline);

      expect(result).toHaveLength(2);
      expect(result[0]._id).toBe('Type A');
      expect(result[0].count).toBe(2);
      expect(result[1]._id).toBe('Type B');
      expect(result[1].count).toBe(1);
    });
  });

  describe('createStream', () => {
    beforeEach(async () => {
      await TestModel.create([
        { name: 'Stream Doc 1' },
        { name: 'Stream Doc 2' },
        { name: 'Stream Doc 3' },
      ]);
    });

    test('should create a readable stream', (done) => {
      // Mock the stream method on the query
      const mockStreamData = [
        { name: 'Stream Doc 1' },
        { name: 'Stream Doc 2' },
        { name: 'Stream Doc 3' },
      ];

      // Create a mock stream
      const EventEmitter = require('events');
      const mockStream = new EventEmitter();
      
      // Mock the find query to return a query object with stream method
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        stream: jest.fn().mockReturnValue(mockStream)
      };
      
      jest.spyOn(TestModel, 'find').mockReturnValue(mockQuery);

      const stream = repository.createStream({ name: /^Stream/ });
      const documents = [];

      stream.on('data', (doc) => {
        documents.push(doc);
      });

      stream.on('end', () => {
        expect(documents).toHaveLength(3);
        expect(documents[0].name).toMatch(/^Stream/);
        done();
      });

      stream.on('error', done);

      // Simulate stream events
      setTimeout(() => {
        mockStreamData.forEach(doc => stream.emit('data', doc));
        stream.emit('end');
      }, 10);
    });
  });

  describe('bulkWrite', () => {
    test('should perform bulk operations', async () => {
      const operations = [
        {
          insertOne: {
            document: { name: 'Bulk Insert 1', description: 'Bulk' },
          },
        },
        {
          insertOne: {
            document: { name: 'Bulk Insert 2', description: 'Bulk' },
          },
        },
      ];

      const result = await repository.bulkWrite(operations);

      expect(result.insertedCount).toBe(2);

      const insertedDocs = await TestModel.find({ description: 'Bulk' });

      expect(insertedDocs).toHaveLength(2);
    });
  });
});