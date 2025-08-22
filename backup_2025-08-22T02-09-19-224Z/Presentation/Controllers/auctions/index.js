// Main auction controller that exports all auction operations
import { getAllAuctions,
  getAuctionById,
  createAuction,
  updateAuction,
  deleteAuction,
  } from './auctionCrudOperations.js';
import { addItemToAuction, removeItemFromAuction, markItemAsSold   } from './auctionItemOperations.js';
export {
  getAllAuctions,
  getAuctionById,
  createAuction,
  updateAuction,
  deleteAuction,
  addItemToAuction,
  removeItemFromAuction,
  markItemAsSold,
};
