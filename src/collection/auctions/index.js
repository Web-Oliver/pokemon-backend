// Main auction controller that exports all auction operations
import { createAuction, deleteAuction, getAllAuctions, getAuctionById, updateAuction } from './auctionCrudOperations.js';
import { addItemToAuction, markItemAsSold, removeItemFromAuction } from './auctionItemOperations.js';

export {
    getAllAuctions,
    getAuctionById,
    createAuction,
    updateAuction,
    deleteAuction,
    addItemToAuction,
    removeItemFromAuction,
    markItemAsSold
};
