const schedule = require("node-schedule");
const expediaService = require("./src/api/services/expediaService");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const axios = require("axios");
const apiRoutes = require("./src/api");
require("dotenv").config();
const app = express();

async function main() {
  // Check if the filename was provided
  if (process.argv.length < 3) {
    console.log("Please provide a filename");
    process.exit(1);
  }

  // Get the filename from the command line arguments
  let filename = process.argv[2];
  let body = await expediaService.parseExcel(`./input_file/${filename}`);

  console.log("--------Request Sent-------");
  const response = await axios.post(
    "http://3.88.135.24:3128/api/v1/expedia/result",
    body
  );

  let { result } = response.data;
  console.log(result);
  await expediaService.save2Excel(result);
  console.log("------------Saved Successfully!-------------");
}

main();
