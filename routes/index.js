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
const { sessionVerification, manageValidation, loginPage } = require('./discord');
const router = express.Router();
const qrcode = require('qrcode');
const {sqlSafe} = require("../js/sqlClient");

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
                    sqlSafe(`SELECT cache_url FROM kanmi_records WHERE id = ? AND fileid IS NOT NULL LIMIT 1`, [req.query.item], (err, messages) => {
                        if (err) {
                            res.status(501).end();
                        } else if (messages.length > 0) {
                            if (messages[0].cache_url === null) {
                                res.status(201).send('Item exists but has not been processed')
                            } else if (messages[0].cache_url === 'inprogress') {
                                res.status(202).send('Item in progress')
                            } else if (messages[0].cache_url !== null && messages[0].cache_url.includes('http')) {
                                res.status(200).send(messages[0].cache_url)
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
