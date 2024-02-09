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
        if (ret.length !== 0) {
            return ret;
        }
    }
}

// Scraping Expedia Page Interface
async function scrapeExpedia(body) {
    const result = [];
    const time = new Date();
    const promises = [];

    for (let i = 0; i < body.length; i++) {
        let ranges = getSaturdayRanges(body[0].start_date, body[0].end_date);
        console.log(ranges);
        for (let j = 0; j < ranges.length; j++) {

            const promise = scrapeUntilValid({ expedia_listing_page_url: body[i].expedia_listing_page_url, check_in_date: ranges[j][0], check_out_date: ranges[j][1], start_date: body[0].start_date, end_date: body[i].end_date, file_name: body[i].file_name }).then(ret => {
                result.push(ret);
            });
            promises.push(promise);
        }
    }

    await Promise.all(promises);
    return result;
}

// Kernel Scraping Function
async function scrapeExpediaPage(url = '', start_date = '', end_date = '', check_in_date = '', check_out_date = '', file_name = 'M6CE') {

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

    let options = new chrome.Options();
    options.setAcceptInsecureCerts(true);

    let result = [];
    let driver = new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();
    try {
        // Navigate to login page
        await driver.get(url);
        console.log("---------Navigate Expedia Page---------");
        let pageSource = await driver.getPageSource();

        // Load Cheerio Module
        let $ = cheerio.load(pageSource);

        let total_num_rooms = sample_room_total[file_name] ? sample_room_total[file_name] : 140;
        $('div.uitk-expando-peek').each((i, element) => {
            let text = $(element).text();
            let match = text.match(/All (\d+) rooms/);
            if (match) {
                total_num_rooms = match[1];
            }
        });

        let total_available_rooms = 0;
        let total_price = 0;
        let quote_count = 0;

        $('div.uitk-layout-flex.uitk-layout-flex-block-size-full-size.uitk-layout-flex-flex-direction-column.uitk-layout-flex-justify-content-space-between.uitk-card.uitk-card-roundcorner-all.uitk-card-has-border.uitk-card-has-overflow.uitk-card-has-primary-theme').each((i, outerDiv) => {

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

            result.push(res);
        });
    }
    catch (err) {
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
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(newsData[0][0]['file_name']);
    worksheet.columns = [
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

    newsData.forEach((news) => {
        news.forEach((item) => {
            worksheet.addRow(item);
        })
    });

    await workbook.xlsx.writeFile(`./output_file/${newsData[0][0]['file_name']}.csv`);
}

// Extract Date List from Saturday to Saturday
function getSaturdayRanges(startDate, endDate) {
    console.log(startDate);
    console.log(endDate);
    let start = new Date(startDate);
    let end = new Date(endDate);
    let ranges = [];

    // Find the next Saturday after the start date
    while (start.getDay() !== 6) {
        start.setDate(start.getDate() + 1);
    }

    // Loop until the end date
    while (start <= end) {
        let rangeStart = new Date(start);

        // Find the next Saturday
        start.setDate(start.getDate() + 7);

        // If the next Saturday is after the end date, use the end date instead
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