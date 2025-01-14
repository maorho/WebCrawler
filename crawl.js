const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');


const downloadImage = async (url, folder_path, state, max_images) => {
    if (state.num_images >= max_images) return;

    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const fileName = `${folder_path}/${url.split('/').pop()}`;
        fs.writeFileSync(fileName, response.data);
        state.num_images++;
        console.log(`Downloaded image ${state.num_images}: ${url}`);
    } catch (err) {
        if (err.response && err.response.status !== 404) {
            console.error(`Failed to download image ${url}:`, err.message);
        }
    }
};


const crawlImages = async (url, depth, curr_depth, image_folder, ind_data, state, max_images) => {
    if (curr_depth > depth || state.num_images >= max_images) return;

    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        // Process images sequentially
        const imgElements = $('img').toArray();
        for (const element of imgElements){
            if (state.num_images >= max_images) break;
            
            const img_url = $(element).attr('src');
            if (img_url && !img_url.startsWith('data:')) {
                const new_url = new URL(img_url, url).href;
                await downloadImage(new_url, image_folder, state, max_images);
                ind_data.push({ url: new_url, source: url, deep: curr_depth });
            }
        }

        // Process links sequentially
        if (curr_depth < depth && state.num_images < max_images) {
            const linkElements = $('a').toArray();
            for (const element of linkElements) {
                if (state.num_images >= max_images) break;

                const nextUrl = $(element).attr('href');
                if (nextUrl && nextUrl.startsWith('http')) {
                    await crawlImages(nextUrl, depth, curr_depth + 1, image_folder, ind_data, state, max_images);
                }
            }
        }
    } catch (err) {
        console.error(`Failed to crawl ${url}:`, err.message);
    }
};



//check the validility of web address
function isValidUrl(url) {
    if (url === null) return false;
    const regex = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i;
    return regex.test(url);
}

async function main() {
    const start_url = process.argv[2];
    const depth = parseInt(process.argv[3]);
    const max_images = parseInt(process.argv[4]);
    const images_folder = 'images';
    const ind_data = [];
    const state = { num_images: 0 };

    // Validate input
    if (!isValidUrl(start_url) || isNaN(depth) || depth < 0 || isNaN(max_images) || max_images <= 0) {
        console.error('Invalid input. Ensure the URL is valid and depth/max_images are positive integers.');
        process.exit(1);
    }

    // Create the images folder if it doesn't exist
    if (!fs.existsSync(images_folder)) {
        fs.mkdirSync(images_folder);
    }

    console.log(`Crawling for a maximum of ${max_images} images.`);
    await crawlImages(start_url, depth, 0, images_folder, ind_data, state, max_images);

    // Save the image metadata to `index.json`
    fs.writeFileSync('index.json', JSON.stringify(ind_data, null, 4));
    console.log(`Done! Downloaded ${state.num_images} images.`);
}



main();
