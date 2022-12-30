let config = require('../config.json')
let host = require('../host.config.json');
const webconfig = require('../web.config.json')
const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const crypto = require('crypto');
const btoa = require('btoa');
const qrcode = require("qrcode");
const { printLine } = require("../js/logSystem");
const { catchAsync } = require('../utils');
const creds = btoa(`${host.discord_id}:${host.discord_secret}`);
const { sqlSafe, sqlPromiseSafe, sqlPromiseSimple } = require('../js/sqlClient');
const moment = require('moment');
const persistSettingsManager = require('../js/persistSettingsManager');
const app = require('./../app');
const web = require("../web.config.json");

function _encode(obj) {
    let string = "";
    for (const [key, value] of Object.entries(obj)) {
        if (!value) continue;
        string += `&${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    }
    return string.substring(1);
}

function cleanDeadCodes() {
    sqlPromiseSimple(`DELETE FROM sequenzia_login_codes WHERE expires < DATE_SUB(NOW(), INTERVAL 1 HOUR)`, true);
}
setInterval(cleanDeadCodes, 60 * 1000);

const noSessionTrandferURL = [
    '/login',
    '/discord',
    '/homeImage',
    '/sidebar',
    '/actions',
    '/status',
    '/parity',
    '/ambient-',
    '/device-login',
    '/ping',
];

// Redirect to Discord Login
router.get('/login', (req, res) => {
    try {
        printLine('SessionInit', `Login Attempt!`, 'debug');
        res.redirect(`https://discordapp.com/api/oauth2/authorize?client_id=${host.discord_id}&scope=identify+guilds&response_type=code&redirect_uri=${encodeURIComponent(`${(host.discord_redirect_base) ? host.discord_redirect_base : web.base_url}/discord/callback`)}`);
    } catch (err) {
        res.status(500).json({
            state: 'HALTED',
            message: err.message,
        });
    }
})
// Destroy a Discord Session and Logout
router.get('/destroy', catchAsync(async (req, res) => {
    try {
        if (req.signedCookies.user_token && req.signedCookies.user_token.length > 128) {
            res.clearCookie('user_token', {path:'/'});
            if (req.auth_token) {
                const token = req.session.auth_token;
                const response = await fetch(`https://discord.com/api/oauth2/token/revoke`,
                    {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        body: _encode({
                            'client_id': host.discord_id,
                            'client_secret': host.discord_secret,
                            'grant_type': 'authorization_code',
                            'token': token,
                            'redirect_uri': `${(host.discord_redirect_base) ? host.discord_redirect_base : web.base_url}/discord/callback`,
                            'scope': 'identify guilds'
                        })
                    });
                printLine('SessionDestroy', `Deleted identity session`, 'info');
            } else {
                printLine('SessionDestroy', `Deleted a unknown session, did not have a token`, 'warn');
            }
            req.session.destroy();
            res.redirect('/discord/destroy');
        } else {
            res.clearCookie('user_token', {path:'/'});
            req.session.destroy();
            res.redirect(`/`)
        }
    } catch (err) {
        res.status(500).json({
            state: 'HALTED-LOGOUT',
            message: err.message,
        });
    }
}));
router.get('/callback', catchAsync(async (req, res) => {
    try {
        if (!req.query.code) {
            printLine('SessionCallback', `Failed to get valid response code to create session`, 'error');
            res.status(500).send('Failed to get response code')
        } else {
            const code = req.query.code;
            const response = await fetch(`https://discordapp.com/api/oauth2/token`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Basic ${creds}`,
                        'Content-Type': 'application/x-www-form-urlencoded'},
                    body: _encode({
                        'client_id': host.discord_id,
                        'client_secret': host.discord_secret,
                        'grant_type': 'authorization_code',
                        'code': code,
                        'redirect_uri': `${(host.discord_redirect_base) ? host.discord_redirect_base : web.base_url}/discord/callback`,
                        'scope': 'identify guilds'
                    })
                });
            const json = await response.json();
            printLine('SessionCallback', `Saved Persistent Token to cookies`, 'debug', json);
            await checkAccessToken(json.access_token, req, res, true)
        }
    } catch (err) {
        res.status(500).json({
            state: 'HALTED',
            message: err.message,
        });
    }
}));
if (config.enable_impersonation) {
    printLine("Init", `User Impersonation is ENABLED! You should never enable this on a non-localhost instance for testing only!`, 'critical');
    router.get('/impersonate/:userId', catchAsync(async (req, res) => {
        try {
            await roleGeneration(req.params.userId, res, req)
                .then((config) => {
                    if (config) {
                        req.session.source = 100;
                        printLine("PassportImpersonation", `User ${req.params.userId} logged in via impersonation!`, 'warn');
                        res.redirect('/');
                    }
                })
        } catch (err) {
            res.status(500).json({
                state: 'HALTED',
                message: err.message,
            });
        }
    }));
    router.get('/users', catchAsync(async (req, res) => {
        try {
            res.status(200).send([
                "<h1>Authorised Users</h1>",
                "<ul>",
                app.get('users').rows.map(e => `<li><a href="/discord/impersonate/${e.id}"><img src="https://cdn.discordapp.com/avatars/${e.id}/${e.avatar}.png?size=32"/>${e.username} @ ${e.server}</a></li>`).join('\n'),
                "</ul>",
                "<h2><a href='/discord/session'>View Current Session</a></h2>",
                "<h2><a href='/discord/destroy'>Burn Current Session</a></h2>",
            ].join('<br/>\n'));
        } catch (err) {
            res.status(500).json({
                state: 'HALTED',
                message: err.message,
            });
        }
    }));

}
router.get('/refresh', sessionVerification)
router.get('/session', (req, res) => {
    try {
        const thisUser = res.locals.thisUser || app.get('userCache').rows.filter(e => req.session.userid === e.userid).map(e => e.data)[0];
        if (!thisUser) {
            res.json({
                client: req.session
            })
        } else {
            res.json({
                ...thisUser,
                client: req.session
            })
        }
    } catch (err) {
        res.status(500).json({
            state: 'HALTED',
            message: err.message,
        });
    }
})
router.get('/token', sessionVerification, (req, res) => {
    try {
        const thisUser = res.locals.thisUser
        if (req.query && req.query.action) {
            switch (req.query.action) {
                case 'get':
                    sqlSafe(`SELECT * FROM discord_users WHERE (id = ? AND token IS NOT NULL) LIMIT 1`, [thisUser.discord.user.id], async (err, user) => {
                        if (err) {
                            res.status(500).send('Internal Server Error')
                            printLine("StaticTokenSystem", `SQL Get Error`, 'error', err)
                        } else if (user.length === 0 || !user) {
                            res.status(401).send('Invalid User Token')
                            printLine("StaticTokenSystem", `Invalid User Token`, 'error')
                        } else {
                            if (user[0].token_static) {
                                res.status(200).send(user[0].token_static);
                            } else {
                                res.status(200).send('NO STATIC LOGIN TOKEN')
                            }
                        }
                    })
                    break;
                case 'renew':
                    sqlSafe(`SELECT * FROM discord_users WHERE (id = ? AND token IS NOT NULL) LIMIT 1`, [thisUser.discord.user.id], async (err, user) => {
                        if (err) {
                            res.status(500).send('Internal Server Error')
                            printLine("StaticTokenSystem", `SQL Get Error`, 'error', err)
                        } else if (user.length === 0 || !user) {
                            res.status(401).send('Invalid User Token')
                            printLine("StaticTokenSystem", `Invalid Request Sent`, 'error')
                        } else {
                            const token = crypto.randomBytes(54).toString("hex");
                            sqlSafe(`UPDATE discord_users SET token_static = ? WHERE (id = ? AND token IS NOT NULL)`, [token, thisUser.discord.user.id], (err, result) => {
                                if (err) {
                                    res.status(500).send('Internal Server Error')
                                    printLine("StaticTokenSystem", `SQL Write Error`, 'error', err)
                                } else if (result.affectedRows && result.affectedRows > 0 ) {
                                    res.status(200).json(token);
                                } else {
                                    res.status(501).send('Internal Server Fault')
                                }
                            })
                        }
                    })
                    break;
                case 'erase':
                    sqlSafe(`SELECT * FROM discord_users WHERE (id = ? AND token IS NOT NULL) LIMIT 1`, [thisUser.discord.user.id], async (err, user) => {
                        if (err) {
                            res.status(500).send('Internal Server Error')
                            printLine("StaticTokenSystem", `SQL Get Error`, 'error', err)
                        } else if (user.length === 0 || !user) {
                            res.status(401).send('Invalid User Token')
                            printLine("StaticTokenSystem", `Invalid Request Sent`, 'error')
                        } else {
                            const token = crypto.randomBytes(54).toString("hex");
                            sqlSafe(`UPDATE discord_users SET token_static = null WHERE (id = ? AND token IS NOT NULL)`, [thisUser.discord.user.id], (err, result) => {
                                if (err) {
                                    res.status(500).send('Internal Server Error')
                                    printLine("StaticTokenSystem", `SQL Write Error`, 'error', err)
                                } else if (result.affectedRows && result.affectedRows > 0 ) {
                                    res.status(200).send('Erased');
                                } else {
                                    res.status(501).send('Internal Server Fault')
                                }
                            })
                        }
                    })
                    break;
                default:
                    res.status(400).send('Invalid Request')
                    printLine("StaticTokenSystem", `Invalid Request Sent (Invalid Action)`, 'error')
            }
        } else {
            res.status(400).send('Invalid Request')
            printLine("StaticTokenSystem", `Invalid Request Sent (Missing Query)`, 'error')
        }
    } catch (err) {
        console.error(err);
        loginPage(req, res, { serverError: 'tokenSys', status: 500 });
    }
});
router.post('/update', sessionVerification, async (req, res) => {
    try {
        const thisUser = res.locals.thisUser
        if (req.body && thisUser) {
            delete req.body.id;
            delete req.body.server;
            delete req.body.serveruserid;
            delete req.body.roles;
            delete req.body.write_roles;
            delete req.body.manage_roles;
            delete req.body.manager;
            delete req.body.token;
            delete req.body.token_expires;
            delete req.body.token_static;

            await sqlPromiseSafe(`UPDATE discord_users SET ? WHERE id = ?`, [req.body, thisUser.discord.user.id])
            res.status(200).send('Updated Account');
        } else {
            res.status(400).send('Invalid Request')
            printLine("AccountUpdate", `Invalid Request Sent (Missing Body)`, 'error')
        }
    } catch (e) {
        res.status(500).send(e.message)
    }
});
router.post('/persistent/settings', persistSettingsManager);

async function roleGeneration(id, res, req, authToken) {
    const thisUser = app.get('userCache').rows.filter(e => id === e.userid).map(e => e.data)[0];
    if (thisUser) {
        if (authToken && authToken.length > 10)
            req.session.auth_token = authToken;
        res.cookie('user_token', thisUser.discord.user.token, {
            maxAge: (new Date(thisUser.discord.user.token_rotation).getTime() - new Date(Date.now()).getTime()).toFixed(0),
            httpOnly: true, // The cookie only accessible by the web server
            signed: true, // Indicates if the cookie should be signed
        })
        if (req.session && req.session.login_code) {
            sqlPromiseSafe(`DELETE FROM sequenzia_login_codes WHERE code = ? AND session = ?`, [req.session.login_code, req.sessionID], true)
            req.session.login_code = undefined;
        }
        req.session.loggedin = true;
        req.session.userid = thisUser.discord.user.id;
        res.locals.thisUser = thisUser;
        printLine("Passport", `User ${thisUser.user.username} (${thisUser.user.id}) logged in!`, 'info');
    } else {
        printLine("AuthorizationGenerator", `User ${id} is not known! No roles will be returned!`, 'warn');
        loginPage(req, res, { noLoginAvalible: 'nomember', status: 401 });
        delete res.locals.thisUser;
        delete req.session.userid;
        req.session.loggedin = false;
    }
    return thisUser
}
async function getNextEpisode(req, id) {
    const tempLastEpisode = await sqlPromiseSimple(`SELECT Max(y.eid) AS eid, MAX(y.show_id) AS show_id FROM (SELECT * FROM kanmi_system.kongou_watch_history WHERE user = '${id}' ORDER BY date DESC LIMIT 1) x LEFT JOIN (SELECT * FROM kanmi_system.kongou_episodes) y ON (x.eid = y.eid);`)
    if (tempLastEpisode.rows.length > 0) {
        const nextEpisodeView = await sqlPromiseSimple(`SELECT * FROM  (SELECT * FROM kanmi_system.kongou_episodes WHERE eid > ${tempLastEpisode.rows[0].eid} AND show_id = ${tempLastEpisode.rows[0].show_id} AND season_num > 0 ORDER BY season_num ASC, episode_num ASC LIMIT 1) x LEFT JOIN (SELECT * FROM kanmi_system.kongou_shows) y ON (x.show_id = y.show_id);`)
        console.log(nextEpisodeView.rows)
        req.session.kongou_next_episode = nextEpisodeView.rows[0];
    } else {
        req.session.kongou_next_episode = {};
    }
}
async function checkAccessToken(token, req, res, redirect, next) {
    if (token !== undefined) {
        const user_response = await fetch(`https://discordapp.com/api/users/@me`,
            {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
        const user_response_json = await user_response.json();
        if (user_response_json.id !== undefined) {
            const guilds_response = await fetch(`https://discordapp.com/api/users/@me/guilds`,
                {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                });
            const guilds_response_json = await guilds_response.json();
            if (guilds_response_json !== undefined && guilds_response_json.length > 0)
                req.session.guilds = guilds_response_json;
            await roleGeneration(user_response_json.id, res, req, token)
                    .then((thisUser) => {
                        if (thisUser) {
                            printLine("PassportCheck", `User ${user_response_json.username}#${user_response_json.discriminator} (${user_response_json.id}) logged in!`, 'info', user_response_json);
                            if (redirect === true) {
                                if (req.session.goto && req.session.goto !== '') {
                                    printLine('SessionTransfer', `Redirecting to previous page "${req.session.goto}"`, 'info');
                                    res.redirect(req.session.goto);
                                } else {
                                    res.redirect('/');
                                }
                                req.session.goto = '';
                            } else {
                                next();
                            }
                        }
                })
        } else {
            if (req.session && req.session.goto !== null && req.session.goto !== undefined && req.session.goto.includes('ambient')) {
                printLine('PassportCheck', `No Valid User ID, Redirecting to Login`, 'error');
                res.redirect(307, '/device-login');
            } else {
                printLine('PassportCheck', `No Valid User ID, Redirecting to Login`, 'error');
                res.redirect(307, '/login')
            }
        }
    } else {
        printLine('PassportCheck', `No Valid Token Exists, Redirecting to Login`, 'error');
        res.redirect(307, '/login')
    }
}
async function loginPage(req, res, obj) {
    let _obj = {};
    if (obj) {
        _obj = obj;
    }
    _obj.joinLink = webconfig.discord_join_link;
    if (host.telegram_callback_url && host.telegram_secret && host.telegram_bot_name) {
        _obj.telegramCallback = host.telegram_callback_url;
        _obj.telegramName = host.telegram_bot_name;
    }
    if (webconfig.system_banner)
        _obj.banner = webconfig.system_banner;
    if (config.enable_impersonation)
        _obj.show_user_list = true
    sessionTransfer(req);
    if (obj && obj.noQRCode) {
        if (obj && obj.keepSession) {
            req.session.loggedin = false;
        }
        res.status(((obj && obj.status) ? obj.status : 403)).render('login_new', _obj);
    } else {
        try {
            async function tryToGenerateCode() {
                const doesExist = await sqlPromiseSafe(`SELECT * FROM sequenzia_login_codes WHERE session = ?`, [req.sessionID])
                if (doesExist && doesExist.rows.length === 0) {
                    async function generateLoginCode() {
                        const setupCode = crypto.randomBytes(3).toString("hex").toUpperCase();
                        const results = await sqlPromiseSafe(`INSERT INTO sequenzia_login_codes SET code = ?, session = ?, expires = ?`, [setupCode, req.sessionID, moment(new Date()).add(1, 'hour').format('YYYY-MM-DD HH:MM:00')])
                        return {
                            code: setupCode,
                            results
                        }
                    }

                    let codeTry = 0;
                    while (codeTry < 10) {
                        const codeGenerated = await generateLoginCode();
                        if (codeGenerated.results && codeGenerated.results.rows.affectedRows) {
                            req.session.login_code = codeGenerated.code
                            codeTry = 100;
                        } else {
                            codeTry++
                        }
                    }
                } else if (doesExist && doesExist.rows.length > 0) {
                    req.session.login_code = doesExist.rows[0].code;
                }
            }
            if (!req.session.login_code) {
                await tryToGenerateCode();
            } else {
                const IDfromCode = await sqlPromiseSafe(`SELECT code FROM sequenzia_login_codes WHERE session = ? LIMIT 1`, [req.sessionID])
                if (!(IDfromCode && IDfromCode.rows.length > 0)) {
                    await tryToGenerateCode();
                }
            }
        } catch (e) {
            console.error(e.message)
        }
        if (req.query && req.query.json && req.query.json === 'true') {
            res.json({
                loggedin: false,
                session: req.sessionID,
                code: (req.session.login_code) ? req.session.login_code : undefined
            })
        } else {
            qrcode.toDataURL(`https://${req.headers.host}/transfer?type=0&deviceID=${decodeURIComponent(req.sessionID)}`, {
                margin: 0.5,
                color: {
                    dark: "#ffffffff",
                    light: "#ffffff00"
                }
            })
                .then(image => {
                    if (image) {
                        _obj.login_image = image;
                    }
                    if (obj && obj.keepSession) {
                        req.session.loggedin = false;
                    }
                    if (req.session.login_code) {
                        _obj.login_code = req.session.login_code;
                    }
                    res.status(((obj && obj.status) ? obj.status : 403)).render('login_new', _obj);
                });
        }
    }
}
function sessionTransfer(req) {
    /* Session Transfer aka GoTo Urls are removed until its be fixed for rare issues */
    /* Under no circumstances should this be reenabled until deep testing can be done */
    /*console.log(req.originalUrl)
    if (req.originalUrl && req.originalUrl !== '/' && noSessionTrandferURL.filter(e => req.originalUrl.startsWith(e)).length === 0 && (
        req.originalUrl.toLowerCase().includes('juneOS') || req.originalUrl.toLowerCase().includes('lite') || req.originalUrl.toLowerCase().includes('home') ||
        req.originalUrl.toLowerCase().includes('ambient') || req.originalUrl.toLowerCase().includes('ads') ||
        req.originalUrl.toLowerCase().includes('gallery') || req.originalUrl.toLowerCase().includes('files') || req.originalUrl.toLowerCase().includes('cards'))) {
        printLine('SessionTransfer', `Redirect URL "${req.originalUrl}" Saved`, 'debug');
        req.session.goto = req.originalUrl
    }*/
}
async function sessionVerification(req, res, next) {
    let thisUser = null;
    if (req.session && req.session.userid) {
        thisUser = app.get('userCache').rows.filter(e => req.session.userid === e.userid).map(e => e.data)[0];
        if (thisUser) {
            res.locals.thisUser = thisUser;
        }
    }
    if (config.bypass_cds_check && (req.originalUrl.startsWith('/stream') || req.originalUrl.startsWith('/content'))) {
        printLine('PassportCheck', `CDS Checks are bypassed`, 'warn');
        next()
    } else if (req.session && req.session.userid && req.session.loggedin === true && thisUser && thisUser.discord && thisUser.discord.user.id) {
        if (thisUser.discord.channels.read && thisUser.discord.channels.read.length > 0) {
            next();
        } else if (req.originalUrl && req.originalUrl === '/home') {
            printLine('PassportCheck', `User ${thisUser.discord.user.username} is known but does not have rights to access anything!`, 'warn');
            res.render('home_lite', {});
        } else {
            printLine('PassportCheck', `User ${thisUser.discord.user.username} is known but does not have rights to access anything!`, 'warn');
            loginPage(req, res, { noLoginAvalible: 'nomember', status: 401 });
        }
    } else if (req.query && req.query.key) {
        printLine('PassportCheck', `Session does not exist but there is a static key, attempting to silently re-login`, 'warn');
        const user = app.get('users').rows.filter(e => e.token && e.token_static && e.token_static === ((typeof req.query.key === 'string') ? req.query.key : req.query.key.pop()));
        if (user.length === 0 || !user) {
            printLine('PassportCheck', `Invalid Static Token, redirecting to login`, 'warn');
            if (req.originalUrl && req.originalUrl === '/home') {
                res.render('home_lite', {});
            } else {
                loginPage(req, res, { noLoginAvalible: 'nomember', status: 401 });
            }
        } else {
            req.session.source = 900;
            await roleGeneration(user[0].id, res, req)
                .then((thisUser) => {
                    if (thisUser) {
                        next();
                    } else {
                        printLine('PassportCheck', `Session Launch Failed using Static Login Token, redirecting to login`, 'warn');
                        if (req.originalUrl && req.originalUrl === '/home') {
                            res.render('home_lite', {});
                        } else {
                            loginPage(req, res, { noLoginAvalible: 'nomember', status: 401 });
                        }
                    }
                })
        }
    } else if (req.query && req.query.blind_key) {
        printLine('PassportCheck', `Session does not exist but there is a blind key, attempting to silently re-login`, 'warn');
        const user = app.get('users').rows.filter(e => e.token_static !== null && e.blind_token && e.blind_token === ((typeof req.query.blind_key === 'string') ? req.query.blind_key : req.query.blind_key.pop()));
        if (user.length === 0 || !user) {
            printLine('PassportCheck', `Invalid Blind Token, redirecting to login`, 'warn');
            if (req.originalUrl && req.originalUrl === '/home') {
                res.render('home_lite', {});
            } else {
                loginPage(req, res, { noLoginAvalible: 'nomember', status: 401 });
            }
        } else {
            req.session.source = 100;
            await roleGeneration(user[0].id, res, req)
                .then((thisUser) => {
                    if (thisUser) {
                        next();
                    } else {
                        printLine('PassportCheck', `Session Launch Failed using Blind Token, redirecting to login`, 'warn');
                        if (req.originalUrl && req.originalUrl === '/home') {
                            res.render('home_lite', {});
                        } else {
                            loginPage(req, res, { noLoginAvalible: 'nomember', status: 401 });
                        }
                    }
                })
        }
    } else if (req.signedCookies && req.signedCookies.user_token && req.signedCookies.user_token.length > 64) {
        printLine('PassportCheck', `Session does not exist but there is a cookie, attempting to silently re-login`, 'warn');
        const user = app.get('users').rows.filter(e => e.token && e.token === req.signedCookies.user_token);
        if (user.length === 0 || !user) {
            printLine('PassportCheck', `Invalid Session Token, redirecting to login`, 'warn');
            if (req.originalUrl && req.originalUrl === '/home') {
                res.render('home_lite', {});
            } else {
                loginPage(req, res);
            }
        } else {
            if (!req.session.source) {
                req.session.source = 100;
            }
            await roleGeneration(user[0].id, res, req)
                .then((thisUser) => {
                    if (thisUser) {
                        next();
                    } else {
                        printLine('PassportCheck', `Session Launch Failed when using Cookie Login, redirecting to login`, 'warn');
                        if (req.originalUrl && req.originalUrl === '/home') {
                            res.render('home_lite', {});
                        } else {
                            loginPage(req, res, { noLoginAvalible: 'nomember', status: 401 });
                        }
                    }
                })
        }
    } else {
        if (req.originalUrl && req.originalUrl === '/home') {
            res.render('home_lite', {});
        } else if (req.originalUrl && req.originalUrl !== '' && req.originalUrl.includes('ambient')) {
            if (req.originalUrl !== '/' && req.originalUrl.toLowerCase().includes('login') && req.originalUrl.toLowerCase().includes('discord')) {
                sessionTransfer(req);
            }
            res.cookie('device', 'nonInteractive', {
                maxAge: 3155692600,
                httpOnly: true,
                signed: true
            });
            printLine('PassportCheck', `Session does not exist, redirecting to login`, 'warn');
            res.redirect(307, '/device-login');
        } else {
            if (req.originalUrl !== '/' && req.originalUrl.toLowerCase().includes('login') && req.originalUrl.toLowerCase().includes('discord')) {
                sessionTransfer(req);
            }
            printLine('PassportCheck', `Session does not exist, redirecting to login`, 'warn');
            loginPage(req, res);
        }
    }
}
function manageValidation(req, res, next) {
    const thisUser = res.locals.thisUser;
    if (req.session && req.session.loggedin && thisUser.discord && thisUser.discord.user.id && thisUser.discord.user.known === true) {
        if (req.body && (req.body.batch || req.body.serverid && req.body.channelid)) {
            if (req.body.action && req.body.action === 'RequestFile' || (thisUser.discord.channels.manage && thisUser.discord.channels.manage.length > 0 && ((req.body.batch && req.body.batch.filter(e => e.action !== 'RequestFile').map(e => e.channelid).filter(e => thisUser.discord.channels.manage.indexOf(e) === -1).length === 0) || thisUser.discord.channels.manage.indexOf(req.body.channelid) !== -1))) {
                next();
            } else {
                printLine('PassportCheck-Manage', `User ${thisUser.discord.user.username} does not have the rights to manage this channel`, 'error', req.body);
                res.status(401).send('Unauthorized Channel');
            }
        } else if (req.body.action && req.body.action === 'DownloadLink' && req.body.url && req.body.serverid) {
            if (thisUser.discord && thisUser.discord.servers.download) {
                if (thisUser.discord.channels.write && thisUser.discord.channels.write.length > 0 && thisUser.discord.servers.download && thisUser.discord.servers.download.length > 0 && thisUser.discord.servers.download.filter(e => e.serverid === req.body.serverid).length > 0 && thisUser.discord.channels.write.indexOf(thisUser.discord.servers.download.filter(e => e.serverid === req.body.serverid)[0].channelid) !== -1) {
                    next();
                } else {
                    printLine('PassportCheck-Manage', `User ${thisUser.discord.user.username} does not have the rights to remote download files`, 'error', req.body);
                    res.status(401).send('Unauthorized Channel');
                }
            } else {
                res.status(400).send('You need to refresh your account');
            }
        } else if (req.body.action && req.body.action === 'textMessage' && req.body.text) {
            if (thisUser.discord && thisUser.discord.channels.write && thisUser.discord.channels.write.length > 0 && thisUser.discord.channels.write.indexOf(req.body.channelid) !== -1) {
                next();
            } else {
                printLine('PassportCheck-Manage', `User ${thisUser.discord.user.username} does not have the rights to send text message`, 'error', req.body);
                res.status(401).send('Unauthorized Channel');
            }
        } else {
            printLine('PassportCheck-Manage', `User ${thisUser.discord.user.username} manage request was invalid`, 'error', req.body);
            res.status(400).send('Invalid Request');
        }
    } else {
        printLine('PassportCheck-Manage', `User does not have a valid session! Was attempting to manage`, 'error', req.body);
        res.status(404)
    }
}
function readValidation(req, res, next) {
    const thisUser = res.locals.thisUser
    if (config.bypass_cds_check) {
        printLine('PassportCheck-Read', `CDS Checks are bypassed`, 'warn');
        next()
    } else if (req.session && req.session.loggedin && thisUser.discord && thisUser.discord.user.id && thisUser.discord.user.known === true) {
        if ( thisUser.discord.channels.read && thisUser.discord.channels.read.length > 0 ) {
            next();
        } else {
            printLine('PassportCheck-Read', `User ${thisUser.discord.user.username} does not have the rights to access this channel`, 'error', req.body);
            res.status(401).send('Unauthorized Channel');
        }
    } else {
        printLine('PassportCheck-Read', `User does not have a valid session! Redirecting to Login`, 'error', req.body);
        sessionTransfer(req);
        res.redirect(307, '/login');
    }
}
function downloadValidation(req, res, next) {
    const thisUser = res.locals.thisUser
    if (config.bypass_cds_check) {
        next()
    } else if (req.originalUrl && (req.originalUrl.startsWith('/content/link/') || req.originalUrl.startsWith('/content/json/'))) {
        printLine('PassportCheck-Proxy', `Request Bypassed for CDS Permalink URL`, 'debug', req.body);
        next();
    } else if (req.session && req.session.loggedin && thisUser.discord && thisUser.discord.user.id && thisUser.discord.user.known === true) {
        if ( thisUser.discord.channels.read && thisUser.discord.channels.read.length > 0 ) {
            const channel = req.path.substr(1, req.path.length - 1).split('/')[1]
            if (thisUser.discord.channels.read.indexOf(channel) !== -1) {
                next();
            } else {
                printLine('PassportCheck-Proxy', `User ${thisUser.discord.user.username} does not have the rights to download from this channel`, 'error', req.body);
                res.status(401).send('Unauthorized Channels');
            }
        } else {
            printLine('PassportCheck-Proxy', `User ${thisUser.discord.user.username} does not have the rights to access this channel`, 'error', req.body);
            res.status(401).send('Unauthorized Roles');
        }
    } else {
        printLine('PassportCheck-Proxy', `User does not have a valid session! Redirecting to Login`, 'error', req.body);
        sessionTransfer(req);
        res.status(401).redirect('/');
    }
}
function writeValidation(req, res, next) {
    const thisUser = res.locals.thisUser
    if (req.session && req.session.loggedin && thisUser.discord && thisUser.discord.user.id && thisUser.discord.user.known === true && thisUser.discord.channels.write && thisUser.discord.channels.write.length > 0) {
        if (thisUser.user && (req.session.source < 900 || (req.headers && req.headers['x-bypass-warning'] && req.headers['x-bypass-warning'] === 'appIntent'))) {
            if (req.query && req.query.channelid) {
                if (thisUser.discord.channels.write.indexOf(req.query.channelid) !== -1) {
                    next();
                } else {
                    printLine('PassportCheck-Write', `User ${thisUser.discord.user.username} does not have the rights to upload to this channel`, 'error', req.body);
                    res.status(401).send('Unauthorized Channels');
                }
            } else {
                printLine('PassportCheck-Write', `User ${thisUser.discord.user.username} upload request was invalid`, 'error', req.body);
                res.status(400).send('Missing Parameters');
            }
        } else {
            printLine("PassportCheck-Write", `Insecure Session attempted to access API by ${thisUser.user.username}`, 'critical');
            res.status(401).send('Session was not authenticated securely! You CAN NOT use a Static Login Key or Blind Token o preform enhanced actions! Logout and Login with a secure login meathod.');
        }
    } else {
        printLine('PassportCheck-Write', `User does not have a valid session!`, 'error', req.body);
        res.status(404).send('Where is your session? Do not try that again or its a IP ban');
    }
}

module.exports = {
    sessionTransfer,
    roleGeneration,
    sessionVerification,
    manageValidation,
    writeValidation,
    readValidation,
    downloadValidation,
    loginPage,
    router
}
