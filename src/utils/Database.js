require("dotenv/config");
const { MongoClient } = require("mongodb");
const crypto = require("crypto");

const dbSetting = {
  url: `mongodb://${process.env.MONGODB_USER}:${encodeURIComponent(process.env.MONGODB_PASS)}@${process.env.MONGODB_SERVER}/${process.env.DBNAME}?w=majority`,
  dbName: process.env.DBNAME,
  newsCollection: "stockNews",
  latestNewsCollection: "latestNews",
  tickersCollection: "tickers",
};
const client = new MongoClient(dbSetting.url);
console.log("MongoDB init successfully");

// Helper function to generate a hash for a news item
function generateNewsHash(newsItem) {
  const data = `${newsItem.date}-${newsItem.stockName}-${newsItem.headlineInfo}`;
  return crypto.createHash("md5").update(data).digest("hex");
}

//News save function
async function saveNewsData(newsData) {
  try {
    // Connect to the MongoDB client
    await client.connect(dbSetting.dbName);
    console.log("Connected to MongoDB");

    const db = client.db(dbSetting.dbName);
    const newsCollection = db.collection(dbSetting.newsCollection);
    const latestNewsCollection = db.collection(dbSetting.latestNewsCollection);

    for (const [stockName, stockData] of Object.entries(newsData)) {
      // Handle the numbers data
      if (stockData.numbers) {
        await newsCollection.updateOne(
          { stockName: stockName },
          {
            $push: {
              numbers: {
                $each: [stockData.numbers], // Push the numbers data as an object in an array
                $position: 0, // Insert at the beginning of the array
              },
            },
          },
          { upsert: true }
        );
      }

      // Handle the news data
      if (stockData.news && Array.isArray(stockData.news)) {
        for (const newsItem of stockData.news) {
          // Generate a unique hash for the news item
          const newsHash = generateNewsHash(newsItem);

          // Check if the news item already exists to avoid duplicates
          const existingNewsItem = await newsCollection.findOne({
            stockName: stockName,
            "newsItem.headlineInfo": newsItem.headlineInfo,
          });

          // If the news item does not exist, insert it
          if (!existingNewsItem) {
            await newsCollection.updateOne(
              { stockName: stockName },
              {
                $push: {
                  newsItem: {
                    $each: [
                      {
                        date: newsItem.date,
                        headlineInfo: newsItem.headlineInfo,
                        url: newsItem.url,
                      },
                    ],
                    $position: 0, // Insert at the beginning of the array
                  },
                },
              },
              { upsert: true }
            );
          }
        }
      }
      // Replace the news item in the 'latestNewsCollection' for the given stockName
      await latestNewsCollection.replaceOne(
        { stockName: stockName },
        {
          stockName: stockName,
          newsItem: stockData.news,
          numbers: stockData.numbers,
        },
        { upsert: true }
      );
    }
  } catch (err) {
    console.error("An error occurred:", err);
  } finally {
    // Close the connection to the MongoDB client
    await client.close();
  }
}

async function saveTickerData(tickerArray) {
  try {
    // Connect to the MongoDB client
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db(dbSetting.dbName);
    const tickerCollection = db.collection(dbSetting.tickersCollection);

    // Use $each with $addToSet to add multiple values without creating duplicates
    const update = {
      $addToSet: {
        tickers: { $each: tickerArray },
      },
    };

    // Assuming we have a single document to hold the array of tickers
    // Here, we use an arbitrary { _id: 'tickerList' } to identify the document
    // If you have multiple documents and want to add tickers to specific ones,
    // you need to adjust the filter accordingly.
    const filter = { _id: "tickerList" };
    const options = { upsert: true };

    const result = await tickerCollection.updateOne(filter, update, options);
    console.log(`Documents matched: ${result.matchedCount}`);
    console.log(`Documents modified: ${result.modifiedCount}`);
    if (result.upsertedCount > 0) {
      console.log(`New document created with _id: ${result.upsertedId._id}`);
    }
  } catch (err) {
    console.error("An error occurred:", err);
  } finally {
    // Close the connection to the MongoDB client
    await client.close();
  }
}

// Function to retrieve news data by stockName
async function getNewsByStockName(stockName) {
  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db(dbSetting.dbName);
    const newsCollection = db.collection(dbSetting.latestNewsCollection);

    // Retrieve the news items for the given stockName
    const result = await newsCollection.findOne({ stockName: stockName });
    return result ? result.newsItems : [];
  } catch (err) {
    console.error("An error occurred:", err);
    return [];
  } finally {
    await client.close();
  }
}

module.exports = {
  saveNewsData,
  getNewsByStockName,
  saveTickerData,
};
