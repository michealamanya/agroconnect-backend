const express = require('express');
const router = express.Router();
const { getImage } = require('../controllers/produceController');

// GET /api/images/:imageId - Serve image (public, no auth required)
router.get('/:imageId', getImage);

module.exports = router;
