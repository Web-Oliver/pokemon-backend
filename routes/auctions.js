const express = require('express');
const router = express.Router();
const {
  getAllAuctions,
  getAuctionById,
  createAuction,
  updateAuction,
  deleteAuction,
  addItemToAuction,
  removeItemFromAuction,
  markItemAsSold,
} = require('../controllers/auctionsController');

router.get('/', getAllAuctions);
router.get('/:id', getAuctionById);
router.post('/', createAuction);
router.put('/:id', updateAuction);
router.delete('/:id', deleteAuction);
router.post('/:id/add-item', addItemToAuction);
router.post('/:id/items', addItemToAuction); // Alternative route for frontend
router.delete('/:id/remove-item', removeItemFromAuction);
router.post('/:id/mark-item-sold', markItemAsSold);
router.patch('/:id/items/sold', markItemAsSold);

module.exports = router;
