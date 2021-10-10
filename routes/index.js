const global = require('../config.json');
const config = require('../host.config.json');
const web = require('../web.config.json')
const express = require('express');
const getImages = require('../js/getData');
const getIndex = require('../js/getIndex');
const renderResults = require('../js/renderPage');
const downloadResults = require('../js/downloadFile');
const renderIndex = require('../js/renderIndex');
const getHistory = require('../js/getHistory');
const getAlbums = require('../js/getAlbums');
const discordActions = require('../js/discordActions');
const generalActions = require('../js/generalActions');
const generateSidebar = require('../js/GenerateSideBar');
const generateConfiguration = require('../js/generateADSRequest')
const ajaxChecker = require('../js/ajaxChecker');
const ajaxOnly = require('../js/ajaxOnly');
const { printLine } = require('../js/logSystem');
const { sessionVerification, manageValidation, loginPage, readValidation} = require('./discord');
const router = express.Router();
const qrcode = require('qrcode');
const {sqlSafe, sqlPromiseSafe} = require("../js/sqlClient");
const useragent = require("express-useragent");

const https = require('https');
const remoteSize = require('remote-file-size');
const fs = require("fs");
const path = require("path");

router.get('/juneOS', sessionVerification, ajaxChecker)

router.get(['/gallery', '/files', '/cards', '/start', '/pages'], sessionVerification, ajaxChecker, getImages, renderResults);
router.get('/', sessionVerification, generateConfiguration, ajaxChecker, getImages, renderResults);
router.get(['/artists'], sessionVerification, ajaxChecker, getIndex, renderIndex);
router.get('/sidebar', sessionVerification, ajaxOnly, generateSidebar);
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
router.get('/home', (req, res) => {
    res.redirect('/')
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
                                res.status(200).send(`${req.protocol}://${req.hostname}${(req.port) ? ':' + req.port : ''}/stream/${messages[0].fileid}/${messages[0].real_filename}`)
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
            const results = await sqlPromiseSafe(`SELECT rk.* FROM (SELECT DISTINCT channelid FROM ${req.session.cache.channels_view}) auth INNER JOIN (SELECT records.*, spfp.part_url FROM (SELECT * FROM kanmi_records WHERE fileid = ?) records LEFT OUTER JOIN (SELECT url AS part_url, fileid FROM discord_multipart_files WHERE fileid = ? AND valid = 1) spfp ON (spfp.fileid = records.fileid)) rk ON (auth.channelid = rk.channel) ORDER BY eid, part_url`, [params[0], params[0]])
            if (results.error) {
                res.status(500)
                console.error(results.error)
            } else if (results.rows.length === 0) {
                res.status(404).send(`File ${params[0]} does not exist`)
            } else if (results.rows.length > 1) {
                const file = results.rows[0]
                const files = results.rows.map(e => e.part_url).sort()
                const filePath = path.join(global.fw_serve, `.${file.fileid}`)

                if (fs.existsSync(filePath) && !(req.query && req.query.rebuild && req.query.rebuild === 'true')) {
                    printLine('StreamFile', `Sending file request for ${file.real_filename}`, 'info');
                    const contentLength = fs.statSync(filePath).size
                    res.setHeader('Content-Type', 'application/octet-stream');
                    res.setHeader('Content-Length', contentLength);
                    res.setHeader('Content-Disposition', `attachment; filename="${file.real_filename}"`);

                    fs.createReadStream(filePath).pipe(res);
                } else if (file.fileid && !(file.paritycount && file.paritycount !== results.rows.length)) {
                    printLine('StreamFile', `Preparing to stream spanned file request for ${file.real_filename}`, 'info');
                    let contentLength = 0;
                    const partFilesizes = await Promise.all(files.map(async e => {
                        return await new Promise((resolve) => {
                            remoteSize(e, async (err, size) => {
                                if (!err || (size !== undefined && size > 0)) {
                                    contentLength += size;
                                    resolve(true)
                                } else {
                                    console.error(err)
                                    resolve(false)
                                }
                            })
                        })
                    }))
                    if (partFilesizes.length === files.length && partFilesizes.filter(e => !e).length === 0) {
                        res.setHeader('Content-Type', 'application/octet-stream');
                        res.setHeader('Content-Length', contentLength);
                        res.setHeader('Content-Disposition', `attachment; filename="${file.real_filename}"`);

                        printLine('StreamFile', `Sequential Stream & Save spanned file for ${file.real_filename} (${(contentLength / 1024000).toFixed(2)} MB)...`, 'info');
                        const fileCompleted = fs.createWriteStream(filePath,{flags: 'a'})
                            .on('finish', function() {
                                try {
                                    fs.symlinkSync(`.${file.fileid}`, path.join(global.fw_serve, `${file.eid}-${file.real_filename}`), "file")
                                } catch (err) {
                                    printLine('StreamFile', `Failed to link built Spanned file ${file.real_filename}!`, 'error');
                                }
                                printLine('StreamFile', `Saved built Spanned file ${file.real_filename}! - ${(contentLength / 1024000).toFixed(2)} MB`, 'info');
                            })
                            .on('error', function(err){
                                console.log(err.stack);
                            });
                        for (const i in files) {
                            await new Promise((resolve) => {
                                const request = https.get(files[i], {
                                    headers: {
                                        'cache-control': 'max-age=0',
                                        'User-Agent': 'Sequenzia/v1.5 (JuneOS 1.7) Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36 Edg/92.0.902.73'
                                    }
                                }, async (response) => {
                                    response.on('data', (data) => {
                                        fileCompleted.write(data,() => {
                                            res.write(data)
                                        });
                                    });
                                    response.on('end', () => {
                                        printLine('StreamFile', `Stream chunk complete for part #${parseInt(i) + 1}/${files.length} for ${file.real_filename}...`, 'info');
                                        resolve()
                                    });
                                });
                                request.on('error', function(e){
                                    res.status(500).send('Error during proxying request');
                                    printLine('ProxyFile', `Failed to stream file request - ${e.message}`, 'error');
                                    resolve()
                                });
                            })
                        }
                        printLine('StreamFile', `Stream completed for ${file.real_filename} (${(contentLength / 1024000).toFixed(2)} MB)...`, 'info');
                        fileCompleted.end()
                        res.end();
                        await sqlPromiseSafe(`UPDATE kanmi_records SET filecached = 1 WHERE fileid = ?`, file.fileid);
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
    } catch (err) {
        res.status(500).json({
            state: 'HALTED',
            message: err.message,
        });
        console.error(err)
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
router.get('/ads-micro', sessionVerification, generateConfiguration, getImages, downloadResults, renderResults);
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
