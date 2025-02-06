const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

const downloadImage = async (url, folder_path, state, max_images) => {
    if (state.num_images >= max_images) return;

    try {
        const fileExtension = url.split('.').pop().toLowerCase();
        if (!['png'].includes(fileExtension)) {
            return;
        }


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

const crawlImages = async (start_url, depth, image_folder, max_images) => {
    let queue = [{ url: start_url, curr_depth: 0 }];
    let visited = new Set();
    let state = { num_images: 0 };
    let ind_data = [];

    while (queue.length > 0 && state.num_images < max_images) {
        let { url, curr_depth } = queue.shift();
        if (visited.has(url) || curr_depth > depth) continue;
        visited.add(url);

        try {
            const response = await axios.get(url);
            const $ = cheerio.load(response.data);

            // Process images
            $('img').each((_, element) => {
                if (state.num_images >= max_images) return;

                let img_url = $(element).attr('src');
                if (img_url && !img_url.startsWith('data:')) {
                    let new_url = new URL(img_url, url).href;
                    downloadImage(new_url, image_folder, state, max_images);
                    ind_data.push({ url: new_url, source: url, deep: curr_depth });
                }
            });

            // Process links for further crawling
            if (curr_depth < depth) {
                $('a').each((_, element) => {
                    let nextUrl = $(element).attr('href');
                    if (nextUrl && nextUrl.startsWith('http') && !visited.has(nextUrl)) {
                        queue.push({ url: nextUrl, curr_depth: curr_depth + 1 });
                    }
                });
            }
        } catch (err) {
            console.error(`Failed to crawl ${url}:`, err.message);
        }
    }

    // Save metadata
    fs.writeFileSync('index.json', JSON.stringify(ind_data, null, 4));
    console.log(`Done! Downloaded ${state.num_images} images.`);
};

// Validate URL format
const isValidUrl = (url) => {
    if (!url) return false;
    const regex = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i;
    return regex.test(url);
};

async function main() {
    const start_url = process.argv[2];
    const depth = parseInt(process.argv[3]);
    const max_images = parseInt(process.argv[4]);
    const images_folder = 'images';

    // Validate input
    if (!isValidUrl(start_url) || isNaN(depth) || depth < 0 || isNaN(max_images) || max_images <= 0) {
        console.error('Invalid input. Ensure the URL is valid and depth/max_images are positive integers.');
        process.exit(1);
    }

    // Create images folder if it doesn't exist
    if (!fs.existsSync(images_folder)) {
        fs.mkdirSync(images_folder);
    }

    console.log(`Starting crawl at ${start_url} for up to ${max_images} images.`);
    await crawlImages(start_url, depth, images_folder, max_images);
}

main();
