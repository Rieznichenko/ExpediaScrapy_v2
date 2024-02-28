const express = require('express');
const expediaController = require('../controllers/expediaController');

const router = express.Router();

// Route to get scrape result and set setting
router.post('/result', expediaController.getScrapeResult);
router.get('/setting', expediaController.updateScrapeSetting);

module.exports = router;