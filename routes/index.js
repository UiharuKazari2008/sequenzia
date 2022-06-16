const global = require('../config.json');
const config = require('../host.config.json');
const web = require('../web.config.json')
const express = require('express');
const getImages = require('../js/getData');
const getIndex = require('../js/getIndex');
const renderResults = require('../js/renderPage');
const downloadResults = require('../js/downloadFile');
const renderIndex = require('../js/renderIndex');
const renderSidebar = require('../js/renderSidebar');
const getHistory = require('../js/getHistory');
const getAlbums = require('../js/getAlbums');
const discordActions = require('../js/discordActions');
const generalActions = require('../js/generalActions');
const generateSidebar = require('../js/GenerateSideBar');
const generateConfiguration = require('../js/generateADSRequest')
const ajaxChecker = require('../js/ajaxChecker');
const ajaxOnly = require('../js/ajaxOnly');
const { printLine } = require('../js/logSystem');
const { sessionVerification, sessionVerificationWithReload, manageValidation, loginPage, readValidation, downloadValidation} = require('./discord');
const router = express.Router();
const qrcode = require('qrcode');
const {sqlSafe, sqlPromiseSafe} = require("../js/sqlClient");
const https = require('https');
const remoteSize = require('remote-file-size');
const fs = require("fs");
const os = require("os");
const path = require("path");
const stream = require("stream");
const useragent = require("express-useragent");
const mime = require("mime-types");
const sizeOf = require("image-size");
const sharp = require("sharp");
const closestIndex = (num, arr) => {
    let curr = arr[0], diff = Math.abs(num - curr);
    let index = 0;
    for (let val = 0; val < arr.length; val++) {
        let newdiff = Math.abs(num - arr[val]);
        if (newdiff < diff) {
            diff = newdiff;
            curr = arr[val];
            index = val;
        };
    };
    return index;
};

router.get(['/', '/juneOS'], sessionVerificationWithReload, generateSidebar, ajaxChecker);
router.get(['/home', '/'], sessionVerification, ajaxChecker);
router.get(['/gallery', '/files', '/cards', '/start', '/pages'], sessionVerification, ajaxChecker, getImages, renderResults);
router.get(['/homeImage'], sessionVerification, generateConfiguration, ajaxChecker, getImages, renderResults);
router.get(['/artists'], sessionVerification, ajaxChecker, getIndex, renderIndex);
router.get('/sidebar', sessionVerification, ajaxOnly, generateSidebar, renderSidebar);
router.get('/albums', sessionVerification, ajaxOnly, getAlbums);

router.get('/lite', sessionVerification, (req,res) => {
    res.render('layout_lite', {
        web: web
    })
})

router.get('/login', (req, res) => {
    try {
        if (req.signedCookies.user_token !== undefined && req.signedCookies.user_token.length > 64) {
            if (req.session && req.session.discord && req.session.discord.user.token) {
                res.redirect('/discord/refresh');
            } else {
                loginPage(req, res);
            }
        } else {
            req.session.loggedin = false;
            res.redirect('/');
        }

    } catch (err) {
        res.status(500).json({
            state: 'HALTED',
            message: err.message,
        });
    }
});

router.post('/actions/v2', sessionVerification, manageValidation, discordActions);
router.post('/actions/v1', sessionVerification, generalActions);

router.get('/status', sessionVerification, async (req, res) => {
    try {
        if (req.query && req.query.request && req.query.item) {
            switch (req.query.request) {
                case 'FileStatus':
                    sqlSafe(`SELECT * FROM kanmi_records WHERE id = ? AND fileid IS NOT NULL LIMIT 1`, [req.query.item], (err, messages) => {
                        if (err) {
                            res.status(501).end();
                        } else if (messages.length > 0) {
                            if (messages[0].filecached !== 1) {
                                res.status(201).send('Item exists but has not been processed')
                            } else if (messages[0].filecached !== 1) {
                                res.status(200).send(`${web.base_url}stream/${messages[0].fileid}/${messages[0].real_filename}`)
                            } else {
                                res.status(500).send('Unknown Error')
                            }
                        } else {
                            res.status(404).send('Item does not exist')
                        }
                    })
                    break;
                default:
                    res.status(501).end();
                    break;
            }
        }
    } catch (err) {
        res.status(500).json({
            state: 'HALTED',
            message: err.message,
        });
    }
});
router.use('/parity', sessionVerification, readValidation, async (req, res) => {
    try {
        const params = req.path.substr(1, req.path.length - 1).split('/')
        if (params.length > 0) {
            const results = await (() => {
                if (global.bypass_cds_check) {
                    return sqlPromiseSafe(`SELECT records.*, spfp.part_url FROM (SELECT * FROM kanmi_records WHERE fileid = ?) records LEFT OUTER JOIN (SELECT url AS part_url, fileid FROM discord_multipart_files WHERE fileid = ? AND valid = 1) spfp ON (spfp.fileid = records.fileid) ORDER BY part_url`, [params[0], params[0]])
                } else {
                    return sqlPromiseSafe(`SELECT rk.* FROM (SELECT DISTINCT channelid FROM ${req.session.cache.channels_view}) auth INNER JOIN (SELECT records.*, spfp.part_url FROM (SELECT * FROM kanmi_records WHERE fileid = ?) records LEFT OUTER JOIN (SELECT url AS part_url, fileid FROM discord_multipart_files WHERE fileid = ? AND valid = 1) spfp ON (spfp.fileid = records.fileid)) rk ON (auth.channelid = rk.channel) ORDER BY part_url`, [params[0], params[0]])
                }
            })()
            if (results.error) {
                res.status(500)
                console.error(results.error)
            } else if (results.rows.length === 0) {
                res.status(404).send(`File ${params[0]} does not exist`)
            } else if (results.rows.length > 1) {
                const file = results.rows[0]
                const files = results.rows.map(e => `${(global.proxy_host) ? global.proxy_host : ''}/pipe${e.part_url.split('attachments').pop()}`).sort((x, y) => (x.split('.').pop() < y.split('.').pop()) ? -1 : (y.split('.').pop() > x.split('.').pop()) ? 1 : 0)

                printLine('ClientStreamFile', `Requested ${file.fileid}: ${file.paritycount} Parts, ${results.rows.length} Available`, 'info');
                if (file.fileid && !(file.paritycount && file.paritycount !== results.rows.length)) {
                    res.status(200).json({
                        parts: files,
                        expected_parts: file.paritycount,
                        filename: file.real_filename
                    })
                } else {
                    res.status(415).send('This content is not streamable or is damaged!')
                }
            } else {
                res.status(415).send('This content is not streamable')
            }
        } else {
            res.status(400).send('Invalid Request')
        }
        return false
    } catch (err) {
        res.status(500).json({
            state: 'HALTED',
            message: err.message,
        });
        console.error(err)
    }
});
router.get('/ping', sessionVerification, ((req, res) => {
    if (req.query && req.query.json && req.query.json === 'true') {
        res.json({
            loggedin: true,
            user: req.session.user,
            session: req.sessionID
        })
    } else {
        res.status(200).send('Pong')
    }
}));

router.use('/stream', sessionVerification, readValidation, async (req, res) => {
    try {
        const params = req.path.substr(1, req.path.length - 1).split('/')
        if (params.length > 0) {
            const results = await (() => {
                if (global.bypass_cds_check) {
                    return sqlPromiseSafe(`SELECT records.*, spfp.part_url FROM (SELECT * FROM kanmi_records WHERE fileid = ?) records LEFT OUTER JOIN (SELECT url AS part_url, fileid FROM discord_multipart_files WHERE fileid = ? AND valid = 1) spfp ON (spfp.fileid = records.fileid) ORDER BY part_url`, [params[0], params[0]])
                } else {
                    return sqlPromiseSafe(`SELECT rk.* FROM (SELECT DISTINCT channelid FROM ${req.session.cache.channels_view}) auth INNER JOIN (SELECT records.*, spfp.part_url FROM (SELECT * FROM kanmi_records WHERE fileid = ?) records LEFT OUTER JOIN (SELECT url AS part_url, fileid FROM discord_multipart_files WHERE fileid = ? AND valid = 1) spfp ON (spfp.fileid = records.fileid)) rk ON (auth.channelid = rk.channel) ORDER BY part_url`, [params[0], params[0]])
                }
            })()
            if (results.error) {
                res.status(500)
                console.error(results.error)
            } else if (results.rows.length === 0) {
                res.status(404).send(`File ${params[0]} does not exist`)
            } else if (results.rows.length > 1) {
                const file = results.rows[0]
                const files = results.rows.map(e => e.part_url).sort((x, y) => (x.split('.').pop() < y.split('.').pop()) ? -1 : (y.split('.').pop() > x.split('.').pop()) ? 1 : 0)

                printLine('StreamFile', `Requested ${file.fileid}: ${file.paritycount} Parts, ${results.rows.length} Available`, 'info');
                if ((global.fw_serve || global.spanned_cache) && fs.existsSync(path.join((global.fw_serve) ? global.fw_serve : global.spanned_cache, `.${file.fileid}`)) && (fs.statSync(path.join((global.fw_serve) ? global.fw_serve : global.spanned_cache, `.${file.fileid}`))).size > 100  && !(req.query && req.query.rebuild && req.query.rebuild === 'true')) {
                    printLine('StreamFile', `Sending file request for ${file.real_filename}`, 'info');
                    const contentLength = fs.statSync(path.join((global.fw_serve) ? global.fw_serve : global.spanned_cache, `.${file.fileid}`)).size
                    /*if (contentLength)
                        res.setHeader('Content-Length', contentLength);*/
                    res.sendFile(`.${file.fileid}`, {
                        dotfiles : 'allow',
                        root: path.join((global.fw_serve) ? global.fw_serve : global.spanned_cache),
                        headers: {
                            'Content-Disposition': `attachment; filename="${file.real_filename}"`
                        } })
                } else if (file.fileid && !(file.paritycount && file.paritycount !== results.rows.length)) {
                    printLine('StreamFile', `Preparing to stream spanned file request for ${file.real_filename}`, 'info');
                    let contentLength = 0;
                    let contentRanges = [];
                    const partFilesizes = (await Promise.all(files.map(async (e, i, a) => {
                        contentRanges.push(contentLength);
                        return await new Promise((resolve) => {
                            remoteSize(e, async (err, size) => {
                                if (!err || (size !== undefined && size > 0)) {
                                    contentLength += size;
                                    resolve(size)
                                } else {
                                    console.error(err)
                                    resolve(false)
                                }
                            })
                        })
                    }))).sort()
                    contentRanges.sort()

                    if (partFilesizes.length === files.length && partFilesizes.filter(e => !e).length === 0) {
                        let requestedStartBytes = ((() => {
                            if (req.headers.range && req.headers.range.startsWith('bytes=')) {
                                const requestedBytes = parseInt(req.headers.range.replace('bytes=', '').split('-')[0].toString())
                                return ((!isNaN(requestedBytes) && requestedBytes <= contentLength)) ? requestedBytes : 0
                            }
                            return 0
                        })())


                        if ((!web.stream_max_file_size || (web.stream_max_file_size && (contentLength / 1024000).toFixed(2) <= web.stream_max_file_size)) && contentLength <= os.freemem() - (256 * 1024000)) {
                            res.setHeader('Content-Disposition', `attachment; filename="${file.real_filename}"`);
                            let fileIndex = 0;
                            let startByteOffset = 0;
                            if (requestedStartBytes !== 0) {
                                fileIndex = closestIndex(requestedStartBytes, contentRanges)
                                startByteOffset = (requestedStartBytes - partFilesizes[fileIndex])
                            }
                            const parityFiles = files.splice(fileIndex)

                            res.setHeader('Content-Length', (requestedStartBytes - contentLength));
                            res.setHeader('Content-Range', `bytes ${requestedStartBytes}-${contentLength}/${contentLength + 1}`);
                            res.setHeader('accept-ranges', 'bytes')
                            res.setHeader('Transfer-Encoding', '')
                            // Start Multiplexed Pipeline
                            let passTrough = new stream.PassThrough();
                            printLine('StreamFile', `Sequential Parity Stream for spanned file ${file.real_filename} (${(contentLength / 1024000).toFixed(2)} MB)...`, 'info');
                            passTrough.pipe(res, {end: true})
                            passTrough.on('end', () => {
                                printLine('StreamFile', `Stream completed for ${file.real_filename} (${(contentLength / 1024000).toFixed(2)} MB)`, 'info');
                                passTrough.close()
                                passTrough.destroy();
                                passTrough = null;
                            })
                            passTrough.on('error', () => { res.status(500).end(); })
                            // Pipeline Files to Save for future requests
                            if ((global.fw_serve || global.spanned_cache) && requestedStartBytes === 0 && !(req.query.nocache && !req.query.nocache === 'true') && (!web.cache_max_file_size || (web.cache_max_file_size && (contentLength / 1024000).toFixed(2) <= web.cache_max_file_size))) {
                                printLine('StreamFile', `Sequential Stream will be saved in parallel`, 'info');
                                const filePath = path.join((global.fw_serve) ? global.fw_serve : global.spanned_cache, `.${file.fileid}`);
                                const fileCompleted = fs.createWriteStream(filePath,{flags: 'a', autoClose: true})
                                passTrough.pipe(fileCompleted)
                                fileCompleted.on('finish', function() {
                                    try {
                                        printLine('StreamFile', `Sequential Parity Stream saved as file ${file.real_filename} (${(contentLength / 1024000).toFixed(2)} MB) for cache`, 'info');
                                        sqlPromiseSafe(`UPDATE kanmi_records SET filecached = 1 WHERE fileid = ?`, file.fileid);
                                        if (global.spanned_cache_no_symlinks)
                                            fs.symlinkSync(`.${file.fileid}`, path.join((global.fw_serve) ? global.fw_serve : global.spanned_cache, `${file.eid}-${file.real_filename}`), "file")
                                    } catch (err) {
                                        printLine('StreamFile', `Failed to link built Spanned file ${file.real_filename}! - ${(err.message) ? err.message : (err.sqlmessage) ? err.sqlmessage : ''}`, 'error');
                                        console.error(err)
                                    }
                                    printLine('StreamFile', `Saved built Spanned file ${file.real_filename}! - ${(contentLength / 1024000).toFixed(2)} MB`, 'info');
                                })
                                fileCompleted.on('error', function(err){
                                    console.log(err.stack);
                                });
                                passTrough.on('end', () => { printLine('StreamFile', `Sequential Stream cached successfully`, 'info'); })
                                passTrough.on('error', () => { fs.unlinkSync(filePath); })
                            }

                            for (const i in parityFiles) {
                                let requestedHeaders = {
                                    'cache-control': 'max-age=0',
                                    'User-Agent': 'Sequenzia/v1.5 (JuneOS 1.7) Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36 Edg/92.0.902.73'
                                }
                                if (i === 0 && startByteOffset > 0) {
                                    requestedHeaders['range'] = `bytes=${startByteOffset}-`
                                }
                                await new Promise((resolve) => {
                                    const request = https.get(parityFiles[i], { headers: requestedHeaders }, async (response) => {
                                        response.on('data', (data) => { passTrough.push(data) });
                                        response.on('end', () => {
                                            printLine('StreamFile', `Parity Stream chunk complete for part #${parseInt(i) + 1}/${parityFiles.length} - ${parityFiles[i]}`, 'info');
                                            resolve()
                                        });
                                    });
                                    request.on('error', function(e){
                                        res.end();
                                        passTrough.destroy(e)
                                        printLine('ProxyFile', `Failed to stream file request - ${e.message}`, 'error');
                                        resolve()
                                    });
                                })
                            }
                            printLine('StreamFile', `Parity Stream completed for ${file.real_filename}`, 'info');
                            passTrough.destroy()
                            passTrough.close()
                        } else if (global.fw_serve || global.spanned_cache) {
                            printLine('StreamFile', `Stalled build for spanned file ${file.real_filename} (${(contentLength / 1024000).toFixed(2)} MB), due to file size being to large!`, 'info');
                            const filePath = path.join((global.fw_serve) ? global.fw_serve : global.spanned_cache, `.${file.fileid}`);
                            const fileCompleted = fs.createWriteStream(filePath)

                            for (const i in files) {
                                let requestedHeaders = {
                                    'cache-control': 'max-age=0',
                                    'User-Agent': 'Sequenzia/v1.5 (JuneOS 1.7) Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36 Edg/92.0.902.73'
                                }
                                await new Promise((resolve) => {
                                    const request = https.get(files[i], { headers: requestedHeaders }, async (response) => {
                                        response.on('data', (data) => { fileCompleted.write(data) });
                                        response.on('end', () => {
                                            printLine('StreamFile', `Parity chunk complete for part #${parseInt(i) + 1}/${files.length} - ${files[i]}`, 'info');
                                            resolve()
                                        });
                                    });
                                    request.on('error', function(e){
                                        res.end();
                                        printLine('ProxyFile', `Failed to build file request - ${e.message}`, 'error');
                                        fs.unlinkSync(filePath)
                                    });
                                })
                            }

                            fileCompleted.end()
                            try {
                                printLine('StreamFile', `Spanned file saved as ${file.real_filename} (${(contentLength / 1024000).toFixed(2)} MB) for cache`, 'info');
                                sqlPromiseSafe(`UPDATE kanmi_records SET filecached = 1 WHERE fileid = ?`, file.fileid);
                                if (global.spanned_cache_no_symlinks)
                                    fs.symlinkSync(`.${file.fileid}`, path.join((global.fw_serve) ? global.fw_serve : global.spanned_cache, `${file.eid}-${file.real_filename}`), "file")
                            } catch (err) {
                                printLine('StreamFile', `Failed to link built Spanned file ${file.real_filename}! - ${(err.message) ? err.message : (err.sqlmessage) ? err.sqlmessage : ''}`, 'error');
                                console.error(err)
                            }
                            printLine('StreamFile', `Saved built Spanned file ${file.real_filename}! - ${(contentLength / 1024000).toFixed(2)} MB`, 'info');

                            res.sendFile(`.${file.fileid}`, { dotfiles : 'allow', root: path.join((global.fw_serve) ? global.fw_serve : global.spanned_cache) })
                        } else {
                            res.status(500).send('Unable to stream file, out of memory slots or no place to build file');
                        }
                    } else {
                        res.status(500).send('Error preparing file for streaming');
                    }
                } else {
                    res.status(415).send('This content is not streamable or is damaged!')
                }
            } else {
                res.status(415).send('This content is not streamable')
            }
        } else {
            res.status(400).send('Invalid Request')
        }
        return false
    } catch (err) {
        res.status(500).json({
            state: 'HALTED',
            message: err.message,
        });
        console.error(err)
    }
});
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
                        if (url) {
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
                                    if (params[0].includes('full64')) {
                                        response.setEncoding('base64');
                                        res.write("data:" + contentType + ";base64,");
                                        response.on('data', (data) => {
                                            res.write(data)
                                        });
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
                            request.on('error', function (e) {
                                res.status(500).send('Error during proxying request');
                                printLine('ProxyFile', `Failed to stream file request - ${e.message}`, 'error');
                            });
                        } else {
                            const bitmap = fs.readFileSync(path.join((global.fw_serve) ? global.fw_serve : global.spanned_cache, `.${message.fileid}`));
                            const contentType = mime.lookup(path.join((global.fw_serve) ? global.fw_serve : global.spanned_cache, `.${message.fileid}`))
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
                                    .toBuffer(function (err, buffer) {
                                        if (err) {
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
                                    .toBuffer(function (err, buffer) {
                                        if (err) {
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
                        if (message.filecached && (global.fw_serve || global.spanned_cache)) {
                            returnContent();
                        } else if (message.attachment_hash) {
                            returnContent(`https://cdn.discordapp.com/attachments/` + ((message.attachment_hash.includes('/')) ? message.attachment_hash : `${message.channel}/${message.attachment_hash}/${message.attachment_name}`));
                        } else {
                            res.status(404).send('Data not available');
                            printLine('ProxyFile', `No full content exists`, 'error');
                        }
                    } else if (params[0] === 'proxy') {
                        if (message.cache_proxy) {
                            returnOptiContent(message.cache_proxy.startsWith('http') ? message.cache_proxy : `https://media.discordapp.net/attachments${message.cache_proxy}`);
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
                            if (message.filecached === 1 && (message.real_filename.split('.').pop().toLowerCase() === 'webp' || message.real_filename.split('.').pop().toLowerCase() === 'png' || message.real_filename.split('.').pop().toLowerCase() === 'jpeg' || message.real_filename.split('.').pop().toLowerCase() === 'jpg' || message.real_filename.split('.').pop().toLowerCase() === 'gif')) {
                                obj.image = `${web.base_url}stream/${message.fileid}/${message.real_filename}`
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
                            res.redirect(`/stream/${message.fileid}/${message.real_filename}`);
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
router.use('/pipe', async function (req, res) {
    try {
        const params = req.path.substr(1, req.path.length - 1).split('/')
        if (params.length === 3) {
            const request = https.get('https://cdn.discordapp.com/attachments/' + params.join('/'), {
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
                    res.setHeader('Content-Type', contentType);
                    response.pipe(res);
                } else {
                    res.status(500).end();
                    printLine('ProxyFile', `Failed to stream file request - No Data`, 'error');
                    console.log(response.rawHeaders)
                }
            });
            request.on('error', function (e) {
                res.status(500).send('Error during proxying request');
                printLine('ProxyFile', `Failed to stream file request - ${e.message}`, 'error');
            });
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

// Ambient Mode
router.get(['/ambient', '/ads-lite'], sessionVerification, async (req, res) => {
    try {
        res.render('ambient', {
            discord: req.session.discord,
            user: req.session.user
        })
    } catch {
        res.render('failed_device')
    }
});
router.get(['/ads-micro', '/ads-widget'], sessionVerification, generateConfiguration, getImages, downloadResults, renderResults);
router.get('/ambient-refresh', sessionVerification, getImages, renderResults);
router.get('/ambient-remote-refresh', sessionVerification, generateConfiguration, getImages, renderResults);
router.get('/ambient-get', sessionVerification, generateConfiguration, getImages, downloadResults);
router.get('/ambient-history', sessionVerification, async (req, res) => {
    try {
        await getHistory(req, res)
    } catch (e) {
        res.status(500).send(e.message);
    }
});
router.post('/ambient-history', sessionVerification, async (req, res) => {
    try {
        await getHistory(req, res)
    } catch (e) {
        res.status(500).send(e.message);
    }
});
router.get('/device-login', (req, res) => {
    try {
        if (req.session && req.session.discord && (req.session.discord.user.id || req.session.discord.user.token)) {
            req.session.loggedin = true;
            if (req.query && req.query.checklogin === 'true') {
                res.status(200).send('true');
            } else {
                if (req.session.discord.user.token) {
                    res.cookie('user_token', req.session.discord.user.token, {
                        maxAge: (new Date(req.session.discord.user.token_rotation).getTime() - new Date(Date.now()).getTime()).toFixed(0),
                        httpOnly: true,
                        signed: true
                    });
                }
                res.redirect('/discord/refresh');
            }
        } else {
            if (req.query && req.query.checklogin === 'true') {
                res.status(200).send('false');
            } else if (req.query && req.query.idonly === 'true') {
                res.status(200).send(`${req.sessionID}`);
            } else {
                qrcode.toDataURL(`https://${req.headers.host}/transfer?type=1&deviceID=${decodeURIComponent(req.sessionID)}`)
                    .then(image => {
                        if (image) {
                            res.render('login_device', {
                                login_image: image
                            })
                        } else {
                            if (req.query && req.query.checklogin === 'true') {
                                res.status(200).send('false');
                            } else {
                                res.status(500).send('Error during image gen');
                            }
                        }
                    });
            }
        }
    } catch {
        if (req.query && req.query.checklogin === 'true') {
            res.status(200).send('false');
        } else {
            res.render('failed_device')
        }
    }
});

module.exports = router;
