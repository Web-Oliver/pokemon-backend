import IcrBatchController from './src/icr/presentation/controllers/IcrBatchController.js';

console.log('Testing controller methods...');

try {
  const controller = new IcrBatchController();
  console.log('Controller created successfully');

  console.log('Available methods:');
  for (const prop in controller) {
    if (typeof controller[prop] === 'function') {
      console.log(`- ${prop}: ${typeof controller[prop]}`);
    }
  }

  console.log('\nSpecific method checks:');
  console.log('uploadBatch:', typeof controller.uploadBatch);
  console.log('extractLabels:', typeof controller.extractLabels);
  console.log('stitchBatch:', typeof controller.stitchBatch);
  console.log('processOcr:', typeof controller.processOcr);
  console.log('getUploadMiddleware:', typeof controller.getUploadMiddleware);

} catch (error) {
  console.error('Error creating controller:', error.message);
  console.error('Stack:', error.stack);
}
