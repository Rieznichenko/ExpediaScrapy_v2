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

async function scrapeUntilValid({ expedia_listing_page_url, start_date, end_date, file_name }) {
    while (true) {
        const ret = await scrapeExpediaPage(expedia_listing_page_url, start_date, end_date, file_name);
        if (ret.data.length !== 0 || ret.adr || ret.revpar) {
            return ret;
        }
    }
}

// Scraping Expedia Page Interface
async function scrapeExpedia(req) {
    const { body } = req;
    const result = [];
    const time = new Date();
    const promises = [];

    for (let i = 0; i < body.length; i++) {
        const promise = scrapeUntilValid(body[i]).then(ret => {
            ret.timestamp = time;
            result.push(ret);
        });
        promises.push(promise);
    }

    await Promise.all(promises);
    console.log(result);
    return result;
}

// Kernel Scraping Function
async function scrapeExpediaPage(url = '', check_in_date = '', check_out_date = '', file_name = 'M6CE') {

    // Parse URL with check_in_date and check_out_date
    let urlObj = new URL(url);
    let params = urlObj.searchParams;

    params.set('chkin', check_in_date);
    params.set('chkout', check_out_date);

    url = urlObj.toString()

    const finalResult = {
        data: [],
        occupancy_rate: '',
        adr: '',
        revpar: '',
    }
    let options = new chrome.Options();
    options.setAcceptInsecureCerts(true);

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

        let total_num_rooms = 140;
        $('div.uitk-expando-peek').each((i, element) => {
            let text = $(element).text();
            let match = text.match(/All (\d+) rooms/);
            if (match) {
                total_num_rooms = match[1];
            }
        });

        let result = [];
        let total_available_rooms = 0;
        let total_price = 0;
        let quote_count = 0;

        $('div.uitk-layout-flex.uitk-layout-flex-block-size-full-size.uitk-layout-flex-flex-direction-column.uitk-layout-flex-justify-content-space-between.uitk-card.uitk-card-roundcorner-all.uitk-card-has-border.uitk-card-has-overflow.uitk-card-has-primary-theme').each((i, outerDiv) => {

            let res = {
                display_price: '',
                strikeout_price: '',
                listing_text: '',
                num_room_available: 0,
                check_in_date: check_in_date,
                check_out_date: check_out_date,
                total_num_rooms: total_num_rooms,
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

        // Calculate math statistics data - occupancy_rate, ADR, REVPAR
        console.log(`total_num_rooms: ${total_num_rooms}`);
        console.log(`total_available_rooms: ${total_available_rooms}`)
        console.log(`total_price: ${total_price}`)
        console.log(`quote_count: ${quote_count}`)

        let occupancy_rate = (total_num_rooms - total_available_rooms) / total_num_rooms * 100;
        let ADR = total_price / quote_count;
        let REVPAR = ADR * occupancy_rate / 100;
        ADR = ADR.toFixed(2);
        REVPAR = `$${REVPAR.toFixed(2)}`;
        occupancy_rate = `${occupancy_rate.toFixed(2)}%`;

        finalResult.adr = ADR;
        finalResult.revpar = REVPAR;
        finalResult.occupancy_rate = occupancy_rate;
        finalResult.data = result;
    }
    catch (err) {
        console.log(err);
    } finally {
        await driver.quit();
        return finalResult;
    }
}

// Export data to xlsx file
async function save2Excel(newsData) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("News Headlines");
    worksheet.columns = [
        { header: "Date", key: "date" },
        { header: "Stock Name", key: "stockName" },
        { header: "Headline Info", key: "headlineInfo" },
        { header: "Content", key: "content" },
    ];

    newsData.forEach((news) => {
        worksheet.addRow(news);
    });

    await workbook.xlsx.writeFile("FinvizNewsHeadlines.xlsx");
}

module.exports = { save2Excel, scrapeExpedia };