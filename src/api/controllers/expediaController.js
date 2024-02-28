const { default: axios } = require('axios');
const expediaService = require('../services/expediaService');

// Update Scrape Setting
const updateScrapeSetting = async (req, res) => {
    try {
        const result = await expediaService.scrapeExpedia(req);
        res.json( result );
    } catch (error) {
        console.error('Error Scraping Expedia:', error);
        res.status(500).send("An error occurred while scraping expedia.");
    }
};

// Return Scrape Result
const getScrapeResult = async (req, res) => {
    try {
        const result = await expediaService.scrapeExpedia(req);
        res.json({ result });
    } catch (error) {
        console.error('Error Scraping Expedia:', error);
        res.status(500).send("An error occurred while scraping expedia.");
    }
};


module.exports = {
    getScrapeResult,
    updateScrapeSetting
};
