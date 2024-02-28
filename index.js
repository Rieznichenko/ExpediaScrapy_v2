const schedule = require("node-schedule");
const expediaService = require('./src/api/services/expediaService');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const apiRoutes = require('./src/api');
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

async function main() {
  // Check if the filename was provided
  if (process.argv.length < 3) {
    console.log('Please provide a filename');
    process.exit(1);
  }

  // Get the filename from the command line arguments
  let filename = process.argv[2];
  let body = await expediaService.parseExcel(`./input_file/${filename}`);
  const response = await axios.get('http://3.88.135.24:3128/api/v1/result', body);
  console.log(response.data);
  // let result = await expediaService.scrapeExpedia(body);
  // await expediaService.save2Excel(result);
}