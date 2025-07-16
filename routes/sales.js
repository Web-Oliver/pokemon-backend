const express = require('express');
const router = express.Router();
const { getSales, getSalesSummary, getSalesGraphData } = require('../controllers/salesController');

router.get('/', getSales);
router.get('/summary', getSalesSummary);
router.get('/graph-data', getSalesGraphData);

module.exports = router;
