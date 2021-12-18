const https = require('https');
const { printLine } = require("../js/logSystem");

module.exports = async (req, res, next) => {
    if (res.locals.response.randomImagev2 && res.locals.response.randomImagev2.length > 0) {
        const url = res.locals.response.randomImagev2[0].fullImage;
        printLine('ProxyFile', `Starting download proxy for ${url}`, 'info');
        const request = https.get(url, {
            headers: {
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                'accept-language': 'en-US,en;q=0.9',
                'cache-control': 'max-age=0',
                'sec-ch-ua': '"Chromium";v="92", " Not A;Brand";v="99", "Microsoft Edge";v="92"',
                'sec-ch-ua-mobile': '?0',
                'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'none',
                'sec-fetch-user': '?1',
                'upgrade-insecure-requests': '1',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36 Edg/92.0.902.73'
            }
        }, async function (response) {
            const contentType = response.headers['content-type'];
            if (contentType) {
                if (req.originalUrl.includes('/ads-micro') || req.originalUrl.includes('/ads-widget')) {
                    response.setEncoding('base64');
                    let imageData = "data:" + contentType + ";base64,";
                    response.on('data', (data) => { imageData += data});
                    response.on('end', () => {
                        printLine('ProxyFile', `Downloaded Image to memory!`, 'info');
                        res.locals.imagedata = imageData;
                        next();
                    });
                } else {
                    res.setHeader('Content-Type', contentType);
                    response.pipe(res);
                }
            } else {
                if (req.originalUrl.includes('/ads-micro') || req.originalUrl.includes('/ads-widget') {
                    res.locals.imagedata = undefined;
                    next();
                } else {
                    res.status(500).end();
                }
                printLine('ProxyFile', `Failed to stream file request - No Data`, 'error');
                console.log(response.rawHeaders)
            }
        });
        request.on('error', function (e) {
            if (req.originalUrl.includes('/ads-micro') || req.originalUrl.includes('/ads-widget') {
                res.locals.imagedata = undefined;
                next();
            } else {
                res.status(500).send('Error during downloading image');
            }
            printLine('ProxyFile', `Failed to stream file request - ${e.message}`, 'error');
        });
    } else {
        if (req.originalUrl.includes('/ads-micro') || req.originalUrl.includes('/ads-widget') {
            res.locals.imagedata = undefined;
            next();
        } else {
            res.status(404).send("No Results")
        }
    }
    if (!(req.originalUrl.includes('/ads-micro') || req.originalUrl.includes('/ads-widget'))) {
        res.locals.response = undefined;
    }
}
