require("dotenv/config");
const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const ExcelJS = require("exceljs");
const cheerio = require('cheerio');

const sample_request = [
    {
        expedia_listing_page_url: `https://www.expedia.com/Carlsbad-Hotels-Motel-6-Carlsbad.h996221.Hotel-Information?bedroom_count_gt=&chkin=3%2F26%2F2023&chkout=3%2F27%2F2023&destType=MARKET&destination=Carlsbad%2C%20California%2C%20United%20States%20of%20America&endDate=3%2F27%2F2023&guestRating=&hotelName=motel%206&l10n=%5Bobject%20Object%5D&latLong=33.158093%2C-117.350594&neighborhood=&neighborhoodId=553248635976480927&poi=&pricing_group=&pwa_ts=1678904762085&referrerUrl=aHR0cHM6Ly93d3cuZXhwZWRpYS5jb20vSG90ZWwtU2VhcmNo&regionId=6056550&rm1=a1&selectedRatePlan=381906247&selectedRoomType=314069136&sort=RECOMMENDED&startDate=3%2F26%2F2023&us_bathroom_count_gt=&useRewards=false&userIntent=&vacationRentalsOnly=false&x_pwa=1`,
        start_date: `2024-02-08`,
        end_date: `2024-02-09`,
        file_name: `M6CE`
    },
    {
        expedia_listing_page_url: `https://www.expedia.com/Carlsbad-Hotels-Motel-6-Carlsbad.h980981.Hotel-Information?chkin=2023-05-12&chkout=2023-05-13&x_pwa=1&rfrr=HSR&pwa_ts=1683915571179&referrerUrl=aHR0cHM6Ly93d3cuZXhwZWRpYS5jb20vSG90ZWwtU2VhcmNo&useRewards=false&rm1=a2&regionId=6056550&destination=Carlsbad%2C+California%2C+United+States+of+America&destType=MARKET&latLong=33.158093%2C-117.350594&hotelName=motel+6&sort=RECOMMENDED&top_dp=91&top_cur=USD&userIntent=&selectedRoomType=200593062&selectedRatePlan=202940864
    `,
        start_date: `2024-02-08`,
        end_date: `2024-02-09`,
        file_name: `M6CB`
    },
    {
        expedia_listing_page_url: `https://www.expedia.com/Carlsbad-Hotels-Motel-6-Carlsbad.h2064060.Hotel-Information?chkin=2023-05-12&chkout=2023-05-13&x_pwa=1&rfrr=HSR&pwa_ts=1683915571179&referrerUrl=aHR0cHM6Ly93d3cuZXhwZWRpYS5jb20vSG90ZWwtU2VhcmNo&useRewards=false&rm1=a2&regionId=6056550&destination=Carlsbad%2C+California%2C+United+States+of+America&destType=MARKET&neighborhoodId=553248635976473227&latLong=33.158093%2C-117.350594&hotelName=motel+6&sort=RECOMMENDED&top_dp=142&top_cur=USD&userIntent=&selectedRoomType=314006917&selectedRatePlan=380054063
    `,
        start_date: `2024-02-08`,
        end_date: `2024-02-09`,
        file_name: `M6CN`
    }
]

const sample_room_total = {
    M6CE: 140,
    M6CB: 160,
    M6CN: 39
};

/*
req sample input style
[
  {
    expedia_listing_page_url : 
    start_date : 
    end_date : 
    file_name : 
  },
  {
    expedia_listing_page_url : 
    start_date : 
    end_date : 
    file_name : 
  },
  {
    expedia_listing_page_url : 
    start_date : 
    end_date : 
    file_name : 
  }
]
*/

async function scrapeUntilValid({ expedia_listing_page_url, start_date, end_date, check_in_date, check_out_date, file_name }) {
    while (true) {
        const ret = await scrapeExpediaPage(expedia_listing_page_url, start_date, end_date, check_in_date, check_out_date, file_name);
        console.log(ret.length);
        if (ret.length !== 0) {
            return ret;
        }
    }
}

// Scraping Expedia Page Interface
async function scrapeExpedia(req) {
    const body = req.body;
    let allResults = [];
    let batchCount = 8;

    // This helper function will process a batch of promises and resolve when all are done
    async function processBatch(batch) {
        console.log(`Processing batch of ${batch.length}`);
        const results = await Promise.all(batch);
        console.log(`Finished batch of ${batch.length}`);
        return results;
    }

    for (let i = 0; i < body.length; i++) {
        let ranges = getFridayRanges(body[i].start_date, body[i].end_date);
        let promises = ranges.map(range => {
            return () => scrapeUntilValid({ // Wrap the call in a function to prevent immediate execution
                expedia_listing_page_url: body[i].expedia_listing_page_url,
                check_in_date: range[0],
                check_out_date: range[1],
                start_date: body[i].start_date,
                end_date: body[i].end_date,
                file_name: body[i].file_name
            });
        });

        // Process promises in batches of n
        for (let j = 0; j < promises.length; j += batchCount) {
            const batchPromises = promises.slice(j, j + batchCount).map(p => p()); // Invoke the functions to get the promises
            const results = await processBatch(batchPromises);
            allResults = allResults.concat(results);
        }
    }

    return allResults;
}

// Scrape result with Timeout limit
async function findElementWithTimeout(driver, by, timeout) {
    return new Promise(async (resolve, reject) => {
      try {
        await driver.wait(until.elementLocated(by), timeout);
        const element = await driver.findElement(by);
        resolve(element);
      } catch (error) {
        reject(error);
      }
    });
  }

 //  Kernel Expedia Scrape Function
async function scrapeExpediaPage(url = '', start_date = '', end_date = '', check_in_date = '', check_out_date = '', file_name = 'M6CE') {

    // Check the date
    c_date_1 = new Date(check_in_date);
    c_date_2 = new Date(check_out_date);
    now_time = new Date();
    now_time.setDate(now_time.getDate() - 1); // Set to previous day


    // Parse URL with check_in_date and check_out_date
    let urlObj = new URL(url);
    let params = urlObj.searchParams;

    params.set('chkin', check_in_date);
    params.set('chkout', check_out_date);

    url = urlObj.toString()

    // Parse Listing ID

    let listing_id = '';
    let match = url.match(/\.h(.*?)\./);
    if (match)
        listing_id = match[1]
    // Validate Date
    if (c_date_2 <= c_date_1 || c_date_1 < now_time) {
        return [{
            strikeout_price: '-',
            display_price: '-',
            listing_id: listing_id,
            listing_text: '-',
            expedia_listing_page_url: url,
            check_in_date: check_in_date,
            check_out_date: check_out_date,
            start_date: start_date,
            end_date: end_date,
            file_name: file_name,
        }];
    }

    // Start option of Selenium
    let options = new chrome.Options();
    options.setAcceptInsecureCerts(true);
    options.addArguments('--blink-settings=imagesEnabled=false'); // Disable images in Chrome.

    let result = [];
    let driver = new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();
    try {
        // Navigate to login page
        await driver.get(url);

        const totalHeight = await driver.executeScript("return document.body.scrollHeight");
        const scrollStep = totalHeight / 4;

        for (let i = 0; i < 4; i++) {
            await driver.executeScript(`window.scrollTo(0, ${scrollStep * i});`);
            await new Promise(resolve => setTimeout(resolve, 1));
        }

        // Wait for at least one button to appear
        const condition_1 = findElementWithTimeout(driver, By.css("div.uitk-layout-flex.uitk-layout-flex-block-size-full-size.uitk-layout-flex-flex-direction-column.uitk-layout-flex-justify-content-space-between.uitk-card.uitk-card-roundcorner-all.uitk-card-has-border.uitk-card-has-overflow.uitk-card-has-primary-theme"), 10000);
        const condition_2 = findElementWithTimeout(driver, By.css("span.uitk-text.uitk-type-300.uitk-text-negative-theme.uitk-spacing.uitk-spacing-padding-inlineend-one"), 10000);

        await Promise.race([condition_1, condition_2]);

        console.log("---------Navigate Expedia Page---------");
        let pageSource = await driver.getPageSource();


        // Load Cheerio Module
        let $ = cheerio.load(pageSource);

        let issue = $('span.uitk-text.uitk-type-300.uitk-text-negative-theme.uitk-spacing.uitk-spacing-padding-inlineend-one');
        if (issue.length > 0) {
            console.log(issue.length);
            result.push({
                strikeout_price: '-',
                display_price: '-',
                listing_id: listing_id,
                listing_text: '-',
                expedia_listing_page_url: url,
                check_in_date: check_in_date,
                check_out_date: check_out_date,
                start_date: start_date,
                end_date: end_date,
                file_name: file_name,
            });
        }
        else {
            let total_available_rooms = 0;
            let total_price = 0;
            let quote_count = 0;

            let el = $('div.uitk-layout-flex.uitk-layout-flex-block-size-full-size.uitk-layout-flex-flex-direction-column.uitk-layout-flex-justify-content-space-between.uitk-card.uitk-card-roundcorner-all.uitk-card-has-border.uitk-card-has-overflow.uitk-card-has-primary-theme');
            console.log(el.length);
            el.each((i, outerDiv) => {

                let res = {
                    strikeout_price: '',
                    display_price: '',
                    listing_id: listing_id,
                    listing_text: '',
                    expedia_listing_page_url: url,
                    check_in_date: check_in_date,
                    check_out_date: check_out_date,
                    start_date: start_date,
                    end_date: end_date,
                    file_name: file_name,
                }

                // Extract listing_text
                let l1_element = $(outerDiv).find('h3.uitk-heading.uitk-heading-6');
                if (l1_element.length > 0) {
                    let l1_text = l1_element.text();
                    res.listing_text = l1_text;
                } else {
                    console.log('Could not find listing_text element');
                }

                // Extract num_room_available
                let l2_element = $(outerDiv).find('div.uitk-text.uitk-type-end.uitk-type-100.uitk-text-negative-theme');
                if (l2_element.length > 0) {
                    let l2_text = l2_element.text();
                    res.num_room_available = l2_text.match(/\d+/)[0]; // This will extract the number from the string
                    total_available_rooms += res.num_room_available - 0;
                } else {
                    console.log('Could not find num_room_available element');
                }

                // Extract displayPrice
                let l3_element = $(outerDiv).find('div.uitk-text.uitk-type-500.uitk-type-medium.uitk-text-emphasis-theme');
                if (l3_element.length > 0) {
                    let l3_text = l3_element.text();
                    res.display_price = l3_text; // This will extract the number from the string
                    total_price += Number(l3_text.replace("$", ""));
                    quote_count++;
                } else {
                    console.log('Could not find displayPrice element');
                }

                // Extract strikeoutPrice
                let l4_element = $(outerDiv).find('del span div.uitk-text.uitk-type-300.uitk-text-default-theme');
                if (l4_element.length > 0) {
                    let l4_text = l4_element.text();
                    res.strikeout_price = l4_text; // This will extract the number from the string
                } else {
                    console.log('Could not find strikeoutPrice element');
                }

                // Extract Cancellation Policy
                let l5_element = $(outerDiv).find('uitk-radio-button-label-suffix');
                if (l5_element.length > 1) {
                    let l5_text = l5_element[2].text();
                    let addition_price = parseFloat(l5_text.replace(/[^0-9.-]+/g,""));
                    res.display_price = Number(res.display_price) + Number(addition_price);
                } else {
                    console.log('Could not find strikeoutPrice element');
                }

                result.push(res);
            });
        }
    }
    catch (err) {
        console.log(err);
    } finally {
        await driver.quit();
        return result;
    }
}
// Kernel Scraping Function
async function scrapeExpediaPage_selenium(
    url = "",
    check_in_date = "",
    check_out_date = "",
    file_name = "M6CE"
) {
    // Parse URL with check_in_date and check_out_date
    let urlObj = new URL(url);
    let params = urlObj.searchParams;

    params.set("chkin", check_in_date);
    params.set("chkout", check_out_date);

    url = urlObj.toString();

    let options = new chrome.Options();
    options.setAcceptInsecureCerts(true);

    let driver = new Builder()
        .forBrowser("chrome")
        .setChromeOptions(options)
        .build();

    let result = [];
    let occupancy_rate, ADR, REVPAR;

    try {
        await driver.get(url);
        const totalHeight = await driver.executeScript("return document.body.scrollHeight");
        const scrollStep = totalHeight / 5;

        for (let i = 0; i < 5; i++) {
            await driver.executeScript(`window.scrollTo(0, ${scrollStep * i});`);
            await new Promise(resolve => setTimeout(resolve, 1500));
        }

        // Wait for at least one button to appear
        let condition = until.elementLocated(
            By.css("div.uitk-expando-peek-control button.uitk-link.uitk-expando-peek-link")
        );
        await driver.wait(condition, 10000);

        // Get all buttons
        let button = await driver.findElement(
            By.css("button.uitk-link.uitk-expando-peek-link")
        );
        await driver.executeScript("arguments[0].click();", button);

        let condition1 = driver.wait(
            until.elementLocated(
                By.css(
                    "div.uitk-text.uitk-type-end.uitk-type-100.uitk-text-negative-theme"
                )
            ),
            20000
        );
        let condition2 = driver.wait(
            until.elementLocated(
                By.css(
                    "div.uitk-expando-peek div.uitk-layout-grid.uitk-layout-grid-has-auto-columns.uitk-layout-grid-has-space.uitk-layout-grid-display-grid"
                )
            ),
            20000
        );
        let condition3 = driver.wait(
            until.elementLocated(
                By.css(
                    "div.uitk-text.uitk-type-start.uitk-type-200.uitk-type-medium.uitk-text-negative-theme"
                )
            ),
            20000
        );
        await Promise.race([Promise.all([condition2, condition3]), Promise.all([condition1, condition2])]);

        console.log("---------Navigate Expedia Page---------");

        let total_num_rooms = sample_room_total[file_name]
            ? sample_room_total[file_name]
            : 0;
        let total_available_rooms = 0;
        let total_price = 0;
        let quote_count = 0;

        // Extract total_num_rooms
        try {
            let totalRoomsElement = await driver.findElement(
                By.css(
                    "div.uitk-expando-peek div.uitk-layout-grid.uitk-layout-grid-has-auto-columns.uitk-layout-grid-has-space.uitk-layout-grid-display-grid"
                )
            );
            if (totalRoomsElement) {
                let totalRoomsText = await totalRoomsElement.getText();
                let match = totalRoomsText.match(/All (\d+) rooms/);
                console.log(totalRoomsText);
                if (match) {
                    total_num_rooms = match[1];
                }
            }
        } catch { }

        // Extract data for each room
        try {
            let roomElements = await driver.findElements(
                By.css(
                    "div.uitk-layout-flex.uitk-layout-flex-block-size-full-size.uitk-layout-flex-flex-direction-column.uitk-layout-flex-justify-content-space-between.uitk-card.uitk-card-roundcorner-all.uitk-card-has-border.uitk-card-has-overflow.uitk-card-has-primary-theme"
                )
            );
            for (let roomElement of roomElements) {
                let res = {
                    display_price: "",
                    strikeout_price: "",
                    listing_text: "",
                    num_room_available: 0,
                    check_in_date: check_in_date,
                    check_out_date: check_out_date,
                    // total_num_rooms: total_num_rooms,
                    file_name: file_name,
                };

                // Extract listing_text
                try {
                    let listingTextElement = await roomElement.findElement(
                        By.css("h3.uitk-heading.uitk-heading-6")
                    );
                    if (listingTextElement) {
                        let listingText = await listingTextElement.getText();
                        res.listing_text = listingText;
                    }
                } catch { }
                // Extract num_room_available
                try {
                    let numAvailableElement = await roomElement.findElement(
                        By.css(
                            "div.uitk-text.uitk-type-end.uitk-type-100.uitk-text-negative-theme"
                        )
                    );
                    if (numAvailableElement) {
                        let numAvailableText = await numAvailableElement.getText();
                        res.num_room_available = numAvailableText.match(/\d+/)[0]; // This will extract the number from the string
                    }
                } catch {
                    // Could not find num_room_available element
                    console.log(total_num_rooms);
                    res.num_room_available = 10;
                    if (total_num_rooms >= 100)
                        res.num_room_available = Math.round(total_num_rooms * 0.1);
                    console.log(Math.round(total_num_rooms * 0.1));
                }

                // Extract displayPrice
                try {
                    let displayPriceElement = await roomElement.findElement(
                        By.css(
                            "div.uitk-text.uitk-type-500.uitk-type-medium.uitk-text-emphasis-theme"
                        )
                    );
                    if (displayPriceElement) {
                        let displayPriceText = await displayPriceElement.getText();
                        res.display_price = displayPriceText; // This will extract the number from the string
                        total_price += Number(displayPriceText.replace("$", ""));
                        quote_count++;
                    }
                } catch { }
                // Extract strikeoutPrice
                try {
                    let strikeoutPriceElement = await roomElement.findElement(
                        By.css(
                            "del span div.uitk-text.uitk-type-300.uitk-text-default-theme"
                        )
                    );
                    if (strikeoutPriceElement) {
                        let strikeoutPriceText = await strikeoutPriceElement.getText();
                        res.strikeout_price = strikeoutPriceText; // This will extract the number from the string
                    }
                } catch { }

                // Extract Sold Out text
                try {
                    let soldOutElement = await roomElement.findElements(
                        By.css(
                            "div.uitk-spacing.uitk-spacing-margin-three div.uitk-text.uitk-type-300.uitk-type-bold.uitk-text-negative-theme"
                        )
                    );
                    if (soldOutElement.length > 0) {
                        res.num_room_available = 0;
                    }
                } catch { }

                total_available_rooms += res.num_room_available - 0;
                result.push(res);
            }
        } catch { }
    } catch (err) {
        console.log(err);
    } finally {
        await driver.quit();
        return result;
    }
}
// Parse data from xlsx file
async function parseExcel(path) {
    let workbook = new ExcelJS.Workbook();
    await workbook.csv.readFile(`${path}`);

    // Read the Excel file
    let data = [];
    let worksheet = workbook.getWorksheet(1);
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip the header row
        let rowData = {
            expedia_listing_page_url: row.values[1],
            start_date: row.values[2],
            end_date: row.values[3],
            file_name: row.values[4],
        };
        data.push(rowData);
    });

    return data;
}

// Export data to xlsx file
async function save2Excel(newsData) {
    console.log(newsData);
    const columns = [
        { header: "strikeout_price", key: "strikeout_price" },
        { header: "display_price", key: "display_price" },
        { header: "listing_id", key: "listing_id" },
        { header: "listing_text", key: "listing_text" },
        { header: "expedia_listing_page_url", key: "expedia_listing_page_url" },
        { header: "check_in_date", key: "check_in_date" },
        { header: "check_out_date", key: "check_out_date" },
        { header: "start_date", key: "start_date" },
        { header: "end_date", key: "end_date" },
        { header: "file_name", key: "file_name" },
    ];

    newsData.forEach((news, index) => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(newsData[index][0]['file_name']);
        worksheet.columns = columns;
        news.forEach((item) => {
            worksheet.addRow(item);
        })
        workbook.xlsx.writeFile(`./output_file/${newsData[index][0]['file_name']}.csv`);
    });

}

// Extract Date List from Friday to Friday
function getFridayRanges(startDate, endDate) {
    console.log(startDate);
    console.log(endDate);
    let start = new Date(startDate);
    let end = new Date(endDate);
    let ranges = [];

    // Find the next Friday after the start date
    while (start.getDay() !== 5) {
        start.setDate(start.getDate() + 1);
    }

    // Loop until the end date
    while (start <= end) {
        let rangeStart = new Date(start);

        // Find the next Friday
        start.setDate(start.getDate() + 7);

        // If the next Friday is after the end date, use the end date instead
        let rangeEnd = start <= end ? new Date(start) : end;

        // Push the range to the array
        ranges.push([
            rangeStart.toISOString().split('T')[0],
            rangeEnd.toISOString().split('T')[0]
        ]);
    }

    return ranges;
}



module.exports = { save2Excel, scrapeExpedia, parseExcel };