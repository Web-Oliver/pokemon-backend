// Main auction controller that exports all auction operations
const {
  getAllAuctions,
  getAuctionById,
  createAuction,
  updateAuction,
  deleteAuction,
} = require('./auctionCrudOperations');

const { addItemToAuction, removeItemFromAuction, markItemAsSold } = require('./auctionItemOperations');

module.exports = {
  getAllAuctions,
  getAuctionById,
  createAuction,
  updateAuction,
  deleteAuction,
  addItemToAuction,
  removeItemFromAuction,
  markItemAsSold,
};
