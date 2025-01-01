const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
 

const downloadImage = async (url, folder_path) => {
    //check validility and download image into image folder
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        fs.writeFileSync(`${folder_path}/${url.split('/').pop()}`, response.data);
    } catch (err) {
        if(err.response && err.response.status != 404){
            console.error(`Failed to download image ${url}:`, err.message);
        }
    }
};

const crawlImages = async (url, depth, curr_depth, image_folder, ind_data) => {
    //check if we got to depth
    if (curr_depth > depth) {
        return;
    }

    try {
        const response = await axios.get(url);
        //use cheerio parser get all the html tags
        const $ = cheerio.load(response.data);
        //go over all img tag, chack validilty and download them into image folder 
        $('img').each((_, element) => {
            const img_url = $(element).attr('src');
            if (img_url && !img_url.startsWith('data:')) {
                const new_url = new URL(img_url, url).href; 
                downloadImage(new_url, image_folder);
                ind_data.push({ url: new_url, source: url,deep:curr_depth});
            }
        });

        let index = 0;
        
        if (curr_depth < depth) {
            //go over all the link tags, check validility and crawl
            for (const element of $('a')) {
                const nextUrl = $(element).attr('href');
                if (index < 3 && nextUrl && nextUrl.startsWith('http')) {
                    const updatedData = await crawlImages(nextUrl, depth, curr_depth + 1, image_folder, ind_data);
                    ind_data = updatedData;  // Merge the results of deeper crawls
                }
            index+=1;
            }
        }
        return ind_data; 

    } catch (err) {
        console.error(`Failed to crawl ${url}:`, err.message);
    }
};

//chack the validility of web address
function isValidUrl(url) {
    if (url === null) return false;
    const regex = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i;
    return regex.test(url);
}

async function main() {
    const start_url = process.argv[2];
    const depth = parseInt(process.argv[3]);
    const images_folder = 'images';
    const ind_data = [];
    const is_valid =isValidUrl(start_url);

    //check the validility of the arguments provided by the user
    if (!is_valid || isNaN(depth)||depth<0) {
        (!is_valid)?console.error(`URL is not valid`):
            console.error(`please enter a valid depth`);
        process.exit(1);
    }

    //create image folder if doesn't exist
    if (!fs.existsSync(images_folder)) {
        fs.mkdirSync(images_folder);
    }

    await crawlImages(start_url, depth, 0, images_folder, ind_data);

    //create json file name index.json and write the data of photos into it
    fs.writeFileSync('index.json', JSON.stringify(ind_data, null, 4));
    console.log('Done!');
}

main();
