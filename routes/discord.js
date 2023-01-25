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
const md5 = require('md5');
const request = require("request");
const RateLimiter = require('limiter').RateLimiter;
const geoIPLookup = new RateLimiter(25, 60000);

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
            await roleGeneration(req.params.userId, res, req, 950)
                .then((config) => {
                    if (config) {
                        req.session.login_source = 110;
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
                app.get('users').rows.map(e => `<li><a href="/discord/impersonate/${e.id}"><img src="/avatars/${e.id}/${e.avatar}.png?size=32"/>${e.username} @ ${e.server}</a></li>`).join('\n'),
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
router.get('/refresh', sessionVerification, (req, res) => { res.redirect('/') })
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
        if (req.query && req.query.action && thisUser.master && thisUser.master.discord) {
            switch (req.query.action) {
                case 'get':
                    if (thisUser.master.discord.user.token_static) {
                        res.status(200).send(thisUser.master.discord.user.token_static);
                    } else {
                        res.status(200).send('NO STATIC LOGIN TOKEN')
                    }
                    break;
                case 'renew':
                    const token = crypto.randomBytes(54).toString("hex");
                    sqlSafe(`UPDATE discord_users_extended SET token_static = ? WHERE (id = ?)`, [token, thisUser.master.discord.user.id], (err, result) => {
                        if (err) {
                            res.status(500).send('Internal Server Error')
                            printLine("StaticTokenSystem", `SQL Write Error`, 'error', err)
                        } else if (result.affectedRows && result.affectedRows > 0 ) {
                            res.status(200).json(token);
                        } else {
                            res.status(501).send('Internal Server Fault')
                        }
                    })
                    break;
                case 'erase':
                    sqlSafe(`UPDATE discord_users_extended SET token_static = null WHERE (id = ?)`, [thisUser.master.discord.user.id], (err, result) => {
                        if (err) {
                            res.status(500).send('Internal Server Error')
                            printLine("StaticTokenSystem", `SQL Write Error`, 'error', err)
                        } else if (result.affectedRows && result.affectedRows > 0 ) {
                            res.status(200).send('Erased');
                        } else {
                            res.status(501).send('Internal Server Fault')
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
        console.log(req.body)
        const thisUser = res.locals.thisUser
        if (req.body && thisUser) {
            delete req.body.id;
            delete req.body.server;
            delete req.body.serveruserid;
            delete req.body.token;
            delete req.body.token_expires;
            delete req.body.token_static;

            await sqlPromiseSafe(`UPDATE discord_users_extended SET ? WHERE id = ?`, [req.body, thisUser.master.discord.user.id])
            res.status(200).send('Updated Account');
        } else {
            res.status(400).send('Invalid Request')
            printLine("AccountUpdate", `Invalid Request Sent (Missing Body)`, 'error')
        }
    } catch (e) {
        console.error(e);
        res.status(500).send(e.message)
    }
});
router.post('/persistent/settings', persistSettingsManager);

async function getGeoLocation(ip) {
    return await new Promise(async ok => {
        const existingResults = (await sqlPromiseSafe(`SELECT geo FROM sequenzia_login_history WHERE ip_address = ?`, [ip]) ).rows
        if (existingResults.length > 0 && existingResults[0].geo) {
            ok(existingResults[0].geo);
        } else {
            geoIPLookup.removeTokens(1, async () => {
                request.get(`http://ip-api.com/json/${ip}?fields=54783999`, {}, function (error, response, body) {
                    if (!error) {
                        try {
                            const json = JSON.parse(body)
                            if (json.status === 'success') {
                                ok(json);
                            } else {
                                console.error(json)
                                ok(null);
                            }
                        } catch (err) {
                            console.error(err)
                            ok(null);
                        }
                    } else {
                        ok(null);
                    }
                });
            })
        }
    })
}
async function esmVerify(id, req) {
    const ip_address = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.ip || null;
    if (config.esm_no_verify_jumpping || (req.session.esm_key && req.session.esm_key === md5(id + ip_address + req.sessionID))) {
        return true;
    }
    printLine("AuthorizationGenerator", `User ${id} failed to verify ESM! Re-authenticating`, 'error');
    return false;
}
async function roleGeneration(id, res, req, type, authToken) {
    let thisUser = app.get('userCache').rows.filter(e => id === e.userid).map(e => e.data)[0];
    req.session.esm_verified = false;
    function continueLogin() {
        if (authToken && authToken.length > 10)
            req.session.auth_token = authToken;
        res.cookie('user_token', thisUser.master.discord.user.token, {
            maxAge: (new Date(thisUser.master.discord.user.token_rotation).getTime() - new Date(Date.now()).getTime()).toFixed(0),
            httpOnly: true, // The cookie only accessible by the web server
            signed: true, // Indicates if the cookie should be signed
        })
        if (req.sessionID && req.session.login_code) {
            sqlPromiseSafe(`DELETE FROM sequenzia_login_codes WHERE code = ? AND session = ?`, [req.session.login_code, req.sessionID], true)
            req.session.login_code = undefined;
        }
        req.session.loggedin = true;
        req.session.userid = thisUser.master.discord.user.id;
        res.locals.thisUser = thisUser;
    }
    function failLogin(code) {
        if (config.esm_lockout)
            sqlPromiseSafe(`UPDATE discord_users_extended SET locked = 1 WHERE id = ?`, [thisUser.master.discord.user.id])
        if (config.esm_lockout && config.esm_lockout_wipe_keys)
            sqlPromiseSafe(`UPDATE discord_users_extended SET token = null, blind_token = null, token_static = null WHERE id = ?`, [thisUser.master.discord.user.id])
        delete res.locals.thisUser;
        delete req.session.userid;
        req.session.loggedin = false;
        thisUser = undefined;
        loginPage(req, res, { noLoginAvalible: 'esm_activated', serverError: code,status: 401 });
    }

    if (thisUser && config.disable_esm) {
        continueLogin();
    } else if (thisUser) {
        const ip_address = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.ip || null;
        if (!ip_address) {
            printLine("AuthorizationGenerator", `User ${id} can not login! IP Address could not resolve!`, 'error');
            failLogin('0001');
        } else {
            const geo = await getGeoLocation(ip_address);
            const ua = req.get('User-Agent');
            console.log(ip_address);
            console.log(geo);
            console.log(ua);
            if (config.esm_kick_on_jump && req.session.loggedin && req.session.esm_key && req.session.esm_key === md5(thisUser.master.discord.user.id + ip_address + req.sessionID)) {
                printLine("AuthorizationGenerator", `User ${id} can not login! ${ip_address} has changed sense the last session!`, 'error');
                failLogin('0003');
            } else if (config.esm_no_geo ||
                (config.esm_allow_ip && config.esm_allow_ip.map(f => ip_address.startsWith(f)).filter(f => !!f).length > 0 ) ||
                (ua && geo &&
                    (!geo.proxy || config.esm_geo_allow_vpn || geo.org === 'Cloudflare WARP') &&
                    (!geo.hosting || config.esm_geo_allow_hosted) &&
                    (!config.esm_geo_blocked_asn || (config.esm_geo_blocked_asn && config.esm_geo_blocked_asn.indexOf(geo.asname) === -1)) &&
                    (!config.esm_geo_blocked_country || (config.esm_geo_blocked_country && config.esm_geo_blocked_country.indexOf(geo.country) === -1))
                )
            ) {
                req.session.esm_verified = true;
                req.session.esm_key = md5(thisUser.master.discord.user.id + ip_address + req.sessionID);
                continueLogin();
                sqlPromiseSafe(`INSERT INTO sequenzia_login_history SET ? ON DUPLICATE KEY UPDATE reauth_count = reauth_count + 1, reauth_time = CURRENT_TIMESTAMP`, [{
                    key: req.session.esm_key,
                    session: req.sessionID,
                    id: thisUser.master.discord.user.id,
                    ip_address: ip_address,
                    geo: (geo) ? JSON.stringify(geo) : null,
                    meathod: type,
                    user_agent: (ua) ? ua : null
                }])

                printLine("Passport", `User ${thisUser.master.user.username} (${thisUser.master.user.id}) logged in!`, 'info');
            } else {
                printLine("AuthorizationGenerator", `User ${id} can not login! ${ip_address} Location could not resolve!`, 'error');
                failLogin('0002');
            }
        }
    } else {
        printLine("AuthorizationGenerator", `User ${id} is not known! No roles will be returned!`, 'warn');
        delete res.locals.thisUser;
        delete req.session.userid;
        req.session.loggedin = false;
        thisUser = undefined;
        loginPage(req, res, { noLoginAvalible: 'nomember', status: 401 });
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
            await roleGeneration(user_response_json.id, res, req, 100, token)
                    .then((thisUser) => {
                        if (thisUser) {
                            req.session.login_source = 100;
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
    if (webconfig.site_name)
        _obj.site_name = webconfig.site_name;
    if (config.enable_impersonation)
        _obj.show_user_list = true
    sessionTransfer(req);
    if (obj && obj.noQRCode) {
        if (obj && obj.keepSession) {
            req.session.loggedin = false;
        }
        res.status(((obj && obj.status) ? obj.status : 403)).render((webconfig.use_classic_login) ? 'login_new' : 'login_new2', _obj);
    } else {
        try {
            async function tryToGenerateCode() {
                const doesExist = await sqlPromiseSafe(`SELECT * FROM sequenzia_login_codes WHERE session = ?`, [req.sessionID])
                if (doesExist && doesExist.rows.length === 0) {
                    async function generateLoginCode() {
                        try {
                            const setupCode = crypto.randomBytes(3).toString("hex").toUpperCase();
                            const results = await sqlPromiseSafe(`INSERT INTO sequenzia_login_codes SET code = ?, session = ?, expires = ?`, [setupCode, req.sessionID, moment(new Date()).add(5, 'minutes').format('YYYY-MM-DD HH:MM:00')])
                            if (!results)
                                return undefined;
                            return {
                                code: setupCode,
                                results
                            }
                        } catch (err) {
                            console.error('Can not generate login code', err);
                            return false;
                        }
                    }

                    let codeTry = 0;
                    while (codeTry < 10) {
                        const codeGenerated = await generateLoginCode();
                        if (codeGenerated === false)
                            break;
                        if (codeGenerated && codeGenerated.results && codeGenerated.results.rows.affectedRows) {
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
        } else if (req.originalUrl && req.originalUrl === '/home') {
            res.render('home_lite', {});
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
                    res.status(((obj && obj.status) ? obj.status : 403)).render((webconfig.use_classic_login) ? 'login_new' : 'login_new2', _obj);
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
    } else if (req.headers['X-Sequenzia-Exchange'] && req.headers['X-Sequenzia-Key'] && req.headers['X-Sequenzia-User'] &&
        host.Authorized_Exchange && host.Authorized_Exchange[req.headers['X-Sequenzia-Exchange']] &&
        host.Authorized_Exchange[req.headers['X-Sequenzia-Exchange']].key === req.headers['X-Sequenzia-Key']) {
        req.session.userid = req.headers['X-Sequenzia-User'];
        thisUser = app.get('userCache').rows.filter(e => req.headers['X-Sequenzia-User'] === e.userid).map(e => e.data)[0];
        if (thisUser) {
            res.locals.thisUser = thisUser;
            req.session.loggedin = true;
            req.session.esm_verified = true;
            printLine('PassportCheck', `Cross-Instance Session created for ${thisUser.master.discord.user.username}, No ESM Checks will be done!`, 'warn');
        }
    }
    if (req.session && req.query && req.query['lite_mode'] === 'true') {
        req.session.lite_mode = true
    }
    if (req.headers['X-Sequenzia-Exchange'] && req.headers['X-Sequenzia-Key'] && req.headers['X-Sequenzia-User'] &&
        host.Authorized_Exchange && host.Authorized_Exchange[req.headers['X-Sequenzia-Exchange']] &&
        host.Authorized_Exchange[req.headers['X-Sequenzia-Exchange']].key === req.headers['X-Sequenzia-Key'] && thisUser &&
        thisUser.master.discord.user.id === req.headers['X-Sequenzia-User']) {
        next()
    } else if (config.bypass_cds_check && (req.originalUrl.startsWith('/stream') || req.originalUrl.startsWith('/content')) && ((req.session.esm_verified && (await esmVerify(req.session.userid, req))) || config.disable_esm)) {
        next()
    } else if (req.session && req.session.userid && thisUser && thisUser.master && thisUser.master.discord && thisUser.master.discord.user.id && ((req.session.esm_verified && (await esmVerify(req.session.userid, req))) || config.disable_esm)) {
        if (thisUser.master.discord.channels.read && thisUser.master.discord.channels.read.length > 0) {
            next();
        } else if (req.originalUrl && req.originalUrl === '/home') {
            printLine('PassportCheck', `User ${thisUser.master.discord.user.username} is known but does not have rights to access anything!`, 'warn');
            res.render('home_lite', {});
        } else {
            printLine('PassportCheck', `User ${thisUser.master.discord.user.username} is known but does not have rights to access anything!`, 'warn');
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
            req.session.login_source = 900;
            await roleGeneration(user[0].id, res, req, 900)
                .then((thisUser) => {
                    if (thisUser) {
                        next();
                    } else {
                        printLine('PassportCheck', `Session Launch Failed using Static Login Token, redirecting to login`, 'warn');
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
            await roleGeneration(user[0].id, res, req, 102)
                .then((thisUser) => {
                    if (thisUser) {
                        req.session.login_source = 100;
                        next();
                    } else {
                        printLine('PassportCheck', `Session Launch Failed using Blind Token, redirecting to login`, 'warn');
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
            await roleGeneration(user[0].id, res, req, 101)
                .then((thisUser) => {
                    if (thisUser) {
                        if (!req.session.login_source) {
                            req.session.login_source = 100;
                        }
                        next();
                    } else {
                        printLine('PassportCheck', `Session Launch Failed when using Cookie Login, redirecting to login`, 'warn');
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
    if (req.session && req.session.loggedin && thisUser.master && thisUser.master.discord && thisUser.master.discord.user.id && thisUser.master.discord.user.known === true) {
        if (req.body && (req.body.batch || req.body.serverid && req.body.channelid)) {
            if (req.body.action && req.body.action === 'RequestFile' || (thisUser.master.discord.channels.manage && thisUser.master.discord.channels.manage.length > 0 && ((req.body.batch && req.body.batch.filter(e => e.action !== 'RequestFile').map(e => e.channelid).filter(e => thisUser.master.discord.channels.manage.indexOf(e) === -1).length === 0) || thisUser.master.discord.channels.manage.indexOf(req.body.channelid) !== -1))) {
                next();
            } else {
                printLine('PassportCheck-Manage', `User ${thisUser.master.discord.user.username} does not have the rights to manage this channel`, 'error', req.body);
                res.status(401).send('Unauthorized Channel');
            }
        } else if (req.body.action && req.body.action === 'DownloadLink' && req.body.url && req.body.serverid) {
            if (thisUser.master.discord && thisUser.master.discord.servers.download) {
                if (thisUser.master.discord.channels.write && thisUser.master.discord.channels.write.length > 0 && thisUser.master.discord.servers.download && thisUser.master.discord.servers.download.length > 0 && thisUser.master.discord.servers.download.filter(e => e.serverid === req.body.serverid).length > 0 && thisUser.master.discord.channels.write.indexOf(thisUser.master.discord.servers.download.filter(e => e.serverid === req.body.serverid)[0].channelid) !== -1) {
                    next();
                } else {
                    printLine('PassportCheck-Manage', `User ${thisUser.master.discord.user.username} does not have the rights to remote download files`, 'error', req.body);
                    res.status(401).send('Unauthorized Channel');
                }
            } else {
                res.status(400).send('You need to refresh your account');
            }
        } else if (req.body.action && req.body.action === 'textMessage' && req.body.text) {
            if (thisUser.master.discord && thisUser.master.discord.channels.write && thisUser.master.discord.channels.write.length > 0 && thisUser.master.discord.channels.write.indexOf(req.body.channelid) !== -1) {
                next();
            } else {
                printLine('PassportCheck-Manage', `User ${thisUser.master.discord.user.username} does not have the rights to send text message`, 'error', req.body);
                res.status(401).send('Unauthorized Channel');
            }
        } else {
            printLine('PassportCheck-Manage', `User ${thisUser.master.discord.user.username} manage request was invalid`, 'error', req.body);
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
    } else if (req.session && req.session.loggedin && thisUser.master && thisUser.master.discord && thisUser.master.discord.user.id && thisUser.master.discord.user.known === true) {
        if ( thisUser.master.discord.channels.read && thisUser.master.discord.channels.read.length > 0 ) {
            next();
        } else {
            printLine('PassportCheck-Read', `User ${thisUser.master.discord.user.username} does not have the rights to access this channel`, 'error', req.body);
            res.status(401).send('Unauthorized Channel');
        }
    } else {
        printLine('PassportCheck-Read', `User does not have a valid session! Redirecting to Login`, 'error', req.body);
        sessionTransfer(req);
        res.redirect(307, '/login');
    }
}
function downloadValidation(req, res, next) {
    let thisUser = null;
    if (req.session && req.session.userid) {
        thisUser = app.get('userCache').rows.filter(e => req.session.userid === e.userid).map(e => e.data)[0];
        if (thisUser) {
            res.locals.thisUser = thisUser;
        }
    }
    if (config.bypass_cds_check) {
        next()
    } else if (req.originalUrl && (req.originalUrl.startsWith('/content/link/') || req.originalUrl.startsWith('/content/json/'))) {
        printLine('PassportCheck-Proxy', `Request Bypassed for CDS Permalink URL`, 'debug', req.body);
        next();
    } else if (req.session && req.session.loggedin && thisUser.master && thisUser.master.discord && thisUser.master.discord.user.id && thisUser.master.discord.user.known === true) {
        if ( thisUser.master.discord.channels.read && thisUser.master.discord.channels.read.length > 0 ) {
            const channel = req.path.substr(1, req.path.length - 1).split('/')[1]
            if (thisUser.master.discord.channels.read.indexOf(channel) !== -1) {
                next();
            } else {
                printLine('PassportCheck-Proxy', `User ${thisUser.master.discord.user.username} does not have the rights to download from this channel`, 'error', req.body);
                res.status(401).send('Unauthorized Channels');
            }
        } else {
            printLine('PassportCheck-Proxy', `User ${thisUser.master.discord.user.username} does not have the rights to access this channel`, 'error', req.body);
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
    if (req.session && req.session.loggedin && thisUser.master && thisUser.master.discord && thisUser.master.discord.user.id && thisUser.master.discord.user.known === true && thisUser.master.discord.channels.write && thisUser.master.discord.channels.write.length > 0) {
        if (thisUser.master.user && (req.session.login_source < 900 || (req.headers && req.headers['x-bypass-warning'] && req.headers['x-bypass-warning'] === 'appIntent'))) {
            if (req.query && req.query.channelid) {
                if (thisUser.master.discord.channels.write.indexOf(req.query.channelid) !== -1) {
                    next();
                } else {
                    printLine('PassportCheck-Write', `User ${thisUser.master.discord.user.username} does not have the rights to upload to this channel`, 'error', req.body);
                    res.status(401).send('Unauthorized Channels');
                }
            } else {
                printLine('PassportCheck-Write', `User ${thisUser.master.discord.user.username} upload request was invalid`, 'error', req.body);
                res.status(400).send('Missing Parameters');
            }
        } else {
            printLine("PassportCheck-Write", `Insecure Session attempted to access API by ${thisUser.master.user.username}`, 'critical');
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
