const schedule = require("node-schedule");
const expediaService = require('./src/api/services/expediaService');


async function main() {
  // Check if the filename was provided
  if (process.argv.length < 3) {
    console.log('Please provide a filename');
    process.exit(1);
  }

  // Get the filename from the command line arguments
  let filename = process.argv[2];
  let body = await expediaService.parseExcel(`./input_file/${filename}`);
  let result = await expediaService.scrapeExpedia(body);
  await expediaService.save2Excel(result);
}

main();