const express = require('express');
const router = express.Router();
const {
  getAllSealedProducts,
  getSealedProductById,
  createSealedProduct,
  updateSealedProduct,
  deleteSealedProduct,
  markAsSold,
} = require('../controllers/sealedProductsController');

router.get('/', getAllSealedProducts);
router.get('/:id', getSealedProductById);
router.post('/', createSealedProduct);
router.put('/:id', updateSealedProduct);
router.delete('/:id', deleteSealedProduct);
router.post('/:id/mark-sold', markAsSold);

module.exports = router;
