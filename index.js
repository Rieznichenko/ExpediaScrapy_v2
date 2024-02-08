const schedule = require("node-schedule");
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./src/api');
const { scrapeExpedia } = require("./src/api/services/expediaService");
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/v1', apiRoutes);

// Start server
const PORT = process.env.PORT || 3128;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Execute Scrapy Bot Every 5 Minutes
// const job = schedule.scheduleJob("*/5 * * * *", function () {
//   console.log("Running bot function...");
//   scrapeExpedia();
// });

module.exports = app;