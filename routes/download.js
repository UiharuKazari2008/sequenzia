const global = require('../config.json')
const webconfig = require('../web.config.json')
const express = require('express');
const { readValidation, downloadValidation } = require('./discord')
const generateSidebar = require('../js/GenerateSideBar');
const { printLine } = require("../js/logSystem");
const router = express.Router();
const https = require('https');
const sizeOf = require('image-size');
const sharp = require('sharp');
const {readFileSync} = require("fs");
const path = require('path');
const mime = require('mime-types');
const useragent = require('express-useragent');
const {sqlSafe} = require("../js/sqlClient");

router.use('/cache', express.static(global.cache_serve));
router.use('/files', readValidation, express.static(global.fw_serve));
router.use('/content', downloadValidation, async function (req, res) {
    try {
        const source = req.headers['user-agent']
        const ua = (source) ? useragent.parse(source) : undefined
        const params = req.path.substr(1, req.path.length - 1).split('/')
        if (req.query && params.length > 2 && params[0] !== '' && params[2] !== '') {
            sqlSafe(`SELECT * FROM kanmi_records WHERE id = ? LIMIT 1`, [ params[2]], async (err, messages) => {
                if (err) {
                    res.status(404).send('Message not found');
                    printLine('ProxyFile', `Message ID was not found, can not download`, 'error');
                } else if (messages.length > 0) {
                    const message = messages.pop();
                    async function returnContent(url) {
                        if (url.includes(webconfig.cdn_url) || url.includes(webconfig.cds_url)) {
                            const urlParts = url.split('/')
                            let filePath
                            if (url.includes(webconfig.cdn_url)) {
                                filePath = path.join(global.cache_serve, urlParts[urlParts.length - 2], urlParts.pop())
                            } else if (url.includes(webconfig.cds_url)) {
                                filePath = path.join(global.fw_serve, urlParts[urlParts.length - 2], urlParts.pop())
                            }
                            const bitmap = readFileSync(filePath);
                            const contentType = mime.lookup(filePath)
                            const dimensions = sizeOf(bitmap);
                            let scaleSizeH = 1080 // Lets Shoot for 2100?
                            let scaleSizeW = 1920 // Lets Shoot for 2100?
                            if (req.query.mh && req.query.mh !== '' && !isNaN(parseInt(req.query.mh)))
                                scaleSizeH = parseInt(req.query.mh)
                            if (req.query.mw && req.query.mw !== '' && !isNaN(parseInt(req.query.mw)))
                                scaleSizeW = parseInt(req.query.mw)
                            let resizeParam = {
                                fit: sharp.fit.inside,
                                withoutEnlargement: true
                            }
                            if (dimensions.width > dimensions.height) { // Landscape Resize
                                resizeParam.width = scaleSizeW
                            } else { // Portrait or Square Image
                                resizeParam.height = scaleSizeH
                            }
                            if (req.query.format && req.query.format !== '' && (req.query.format.toLowerCase() === 'webp' || req.query.format.toLowerCase() === 'png' || req.query.format.toLowerCase() === 'jpeg' || req.query.format.toLowerCase() === 'jpg')) {
                                sharp(bitmap)
                                    .resize(resizeParam)
                                    .toFormat(req.query.format.toLowerCase())
                                    .withMetadata()
                                    .toBuffer(function(err, buffer){
                                        if(err){
                                            console.error(err);
                                            res.write(`data:${contentType};base64,`);
                                            res.write(Buffer.from(bitmap).toString('base64'))
                                            res.end();
                                        } else {
                                            res.write(`data:image/${req.query.format};base64,`);
                                            res.write(buffer.toString('base64'))
                                            res.end();
                                        }
                                    })
                            } else {
                                sharp(bitmap)
                                    .resize(resizeParam)
                                    .toFormat('png')
                                    .withMetadata()
                                    .toBuffer(function(err, buffer){
                                        if(err){
                                            console.error(err);
                                            res.write(`data:${contentType};base64,`);
                                            res.write(Buffer.from(bitmap).toString('base64'))
                                            res.end();
                                        } else {
                                            res.write(`data:image/png;base64,`);
                                            res.write(buffer.toString('base64'))
                                            res.end();
                                        }
                                    })
                            }
                        } else {
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
                            }, async function(response) {
                                const contentType = response.headers['content-type'];
                                if (contentType) {
                                    if (params[0].includes('full64')) {
                                        response.setEncoding('base64');
                                        res.write("data:" + contentType + ";base64,");
                                        response.on('data', (data) => { res.write(data)});
                                        response.on('end', () => {
                                            res.end();
                                        });
                                    } else {
                                        res.setHeader('Content-Type', contentType);
                                        response.pipe(res);
                                    }
                                } else {
                                    res.status(500).end();
                                    printLine('ProxyFile', `Failed to stream file request - No Data`, 'error');
                                    console.log(response.rawHeaders)
                                }
                            });
                            request.on('error', function(e){
                                res.status(500).send('Error during proxying request');
                                printLine('ProxyFile', `Failed to stream file request - ${e.message}`, 'error');
                            });
                        }
                    }
                    async function returnOptiContent(url) {
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
                        }, function(response) {
                            const optimize = sharp()
                                .resize({
                                    fit: sharp.fit.inside,
                                    withoutEnlargement: true,
                                    width: 256
                                })
                                .toFormat('webp',{
                                    quality: 50
                                })
                            res.setHeader('Content-Type', 'image/webp');
                            response.pipe(optimize).pipe(res);
                            optimize.on('error', (err) => {
                                res.end();
                                printLine('ProxyFile', `Failed to stream the optimized file request - ${error.message}`, 'error');
                            })
                            optimize.on('end', (err) => {
                                printLine('ProxyFile', `Succssfuly passed a optimized image for ${params[2]}`, 'info');
                            })
                        });
                        request.on('error', function(e){
                            res.status(500).send('Error during proxying request');
                            printLine('ProxyFile', `Failed to stream file request - ${e.message}`, 'error');
                        });
                    }
                    if (params[0] === 'full' || params[0] === 'full64') {
                        if (message.cache_url && !(message.cache_url.includes('inprogress'))) {
                            returnContent(message.cache_url);
                        } else if (message.attachment_hash) {
                            returnContent(`https://cdn.discordapp.com/attachments/` + ((message.attachment_hash.includes('/')) ? message.attachment_hash : `${message.channel}/${message.attachment_hash}/${message.attachment_name}`));
                        } else {
                            res.status(404).send('Data not available');
                            printLine('ProxyFile', `No full content exists`, 'error');
                        }
                    } else if (params[0] === 'proxy') {
                        if (message.cache_proxy) {
                            returnOptiContent(message.cache_proxy);
                        } else if (message.attachment_hash) {
                            returnOptiContent(`https://media.discordapp.net/attachments/` + ((message.attachment_hash.includes('/')) ? message.attachment_hash : `${message.channel}/${message.attachment_hash}/${message.attachment_name}`));
                        } else {
                            res.status(404).send('Data not available');
                            printLine('ProxyFile', `No proxy content exists`, 'error');
                        }
                    } else if (params[0] === 'link' || params[0] === 'json' || (ua && (ua.isBot || (ua.source && ua.source.toLowerCase().includes('discord'))) || (req.query.json && req.query.json === 'true'))) {
                        if ((ua && ua.isBot || (ua.source && ua.source.toLowerCase().includes('discord'))) || (req.query.json && req.query.json === 'true')) {
                            let obj = {
                                description: message.content_full,
                                site_title: webconfig.site_name,
                                msg_id: message.id,
                                msg_channel: message.channel,
                            }
                            let json = {
                                "provider_name": webconfig.site_name,
                                "provider_url": webconfig.base_url
                            }
                            if (message.cache_url !== null && message.cache_url !== 'inprogress' && (message.cache_url.split('.').pop().toLowerCase() === 'webp' || message.cache_url.split('.').pop().toLowerCase() === 'png' || message.cache_url.split('.').pop().toLowerCase() === 'jpeg' || message.cache_url.split('.').pop().toLowerCase() === 'jpg' || message.cache_url.split('.').pop().toLowerCase() === 'gif')) {
                                obj.image = message.cache_url
                            }
                            sqlSafe(`SELECT * FROM kanmi_channels WHERE channelid = ?`, [message.channel], async (err, _channelInfo) => {
                                const channelInfo = _channelInfo[0];
                                let classInfo = undefined;
                                let superInfo = undefined;
                                let channelName = undefined;
                                function complete() {
                                    if (params[0] === 'json') { res.json(json) } else { res.render('meta_page', obj) }
                                }
                                if (channelInfo) {
                                    sqlSafe(`SELECT * FROM sequenzia_class WHERE class = ?`, [channelInfo.classification], (err, _classInfo) => {
                                        if (_classInfo) {
                                            const classInfo = _classInfo[0];
                                            sqlSafe(`SELECT * FROM sequenzia_superclass WHERE super = ?`, [classInfo.super], (err, _superInfo) => {
                                                const superInfo = _superInfo[0];
                                                if (_superInfo)
                                                    json.author_url = `/${superInfo.uri}?channel=${message.channel}&nsfw=true`
                                                let channelName = `${classInfo.name}`
                                                if (channelInfo.nice_name) {
                                                    channelName += ' / '
                                                    channelName += channelInfo.nice_name
                                                } else {
                                                    channelName += ' / '
                                                    channelInfo.name.split('-').forEach((wd, i, a) => {
                                                        channelName +=  wd.substring(0,1).toUpperCase() + wd.substring(1,wd.length)
                                                        if (i + 1  < a.length) {
                                                            channelName += ' '
                                                        }
                                                    })
                                                }
                                                if (message.real_filename) {
                                                    obj.site_title = `${webconfig.site_name} - ${channelName}`
                                                    obj.title = message.real_filename
                                                    json.author_name = channelName
                                                } else {
                                                    obj.title = channelName
                                                    json.author_name = channelName
                                                }
                                                complete();
                                            })
                                        } else {
                                            complete();
                                        }
                                    })
                                } else {
                                    complete();
                                }
                            })
                        } else if (message.fileid !== null) {
                            if (message.cache_url !== null && message.cache_url !== 'inprogress') {
                                res.redirect(message.cache_url);
                            } else {
                                res.redirect(`/files?channel=${message.channel}&search=${encodeURIComponent("eid:" + message.eid)}`);
                            }
                        } else if (message.cache_url !== null) {
                            res.redirect(message.cache_url);
                        } else if (message.attachment_hash !== null) {
                            res.redirect(`https://cdn.discordapp.com/attachments/` + ((message.attachment_hash.includes('/')) ? message.attachment_hash : `${message.channel}/${message.attachment_hash}/${message.attachment_name}`));
                        } else {
                            res.status(404).send('Item does not have any valid content to serve');
                        }
                    } else {
                        res.status(400).send('Message not found');
                        printLine('ProxyFile', `Incorrect Content type passed`, 'error');
                    }
                } else {
                    res.status(400).send('Message not found');
                }
            })
        } else {
            res.status(400).send('Missing Parameters');
            printLine('ProxyFile', `Invalid Request to proxy, missing a message ID`, 'error');
        }
    } catch (err) {
        res.status(500).json({
            state: 'HALTED',
            message: err.message,
        });
    }

});
router.use('/*', function(req, res){
    if (req.session && req.session.loggedin) {
        res.status(404).send('Not Found - CDS Audit');
    } else {
        printLine('ExpressCore', `Invalid URL requested from non-authenticated user - ${req.url}`, 'warn');
    }
});
module.exports = router;
