const express = require('express');
const router = express.Router();
const { generateFacebookPost, generateDbaTitle } = require('../controllers/externalListingController');

// Facebook auction post generation
router.post('/generate-facebook-post', generateFacebookPost);

// DBA title generation
router.post('/generate-dba-title', generateDbaTitle);

module.exports = router;
