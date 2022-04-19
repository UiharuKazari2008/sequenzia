const config = require('../host.config.json')
const webconfig = require('../web.config.json')
const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const crypto = require('crypto');
const btoa = require('btoa');
const useragent = require('express-useragent');
const qrcode = require("qrcode");
const { printLine } = require("../js/logSystem");
const { catchAsync } = require('../utils');
const creds = btoa(`${config.discord_id}:${config.discord_secret}`);
const { sqlSafe, sqlSimple, sqlPromiseSafe, sqlPromiseSimple } = require('../js/sqlClient');
const moment = require('moment');
const persistSettingsManager = require('../js/persistSettingsManager');
const app = require('./../app');

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

// Redirect to Discord Login
router.get('/login', (req, res) => {
    try {
        printLine('SessionInit', `Login Attempt!`, 'debug');
        res.redirect(`https://discordapp.com/api/oauth2/authorize?client_id=${config.discord_id}&scope=identify+guilds&response_type=code&redirect_uri=${encodeURIComponent(`${config.discord_redirect_base}/discord/callback`)}`);
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
            if (req.session.discord && req.session.discord.user && req.session.discord.user.auth_token) {
                const token = req.session.discord.user.auth_token;
                const response = await fetch(`https://discord.com/api/oauth2/token/revoke`,
                    {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        body: _encode({
                            'client_id': config.discord_id,
                            'client_secret': config.discord_secret,
                            'grant_type': 'authorization_code',
                            'token': token,
                            'redirect_uri': `${config.discord_redirect_base}/discord/callback`,
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
                        'client_id': config.discord_id,
                        'client_secret': config.discord_secret,
                        'grant_type': 'authorization_code',
                        'code': code,
                        'redirect_uri': `${config.discord_redirect_base}/discord/callback`,
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
router.get('/refresh', async (req, res) => {
    try {
        async function _generate(token) {
            await roleGeneration(token, res, req)
                .then((config) => {
                    if (config) {
                        let _source = 900;
                        if (req.session.user && req.session.user.source || req.session.user && req.session.user.source === 0) {
                            _source = req.session.user.source
                        }
                        req.session.user = {
                            id: req.session.discord.user.id,
                            source: _source,
                            username: (req.session.discord.user.name) ? req.session.discord.user.name : req.session.discord.user.username,
                            avatar: (req.session.discord.user.avatar) ? `https://cdn.discordapp.com/avatars/${req.session.discord.user.id}/${req.session.discord.user.avatar}.${(req.session.discord.user.avatar && req.session.discord.user.avatar.startsWith('a_')) ? 'gif' : 'jpg'}` : `https://cdn.discordapp.com/embed/avatars/0.png`
                        }
                        printLine('SessionRefresh', `Successfully refreshed session for ${req.session.discord.user.username}`, 'info');
                        if (req.session.goto && req.session.goto !== '') {
                            printLine('SessionTransfer', `Redirecting to previous page "${req.session.goto}"`, 'info');
                            res.redirect(req.session.goto);
                        } else if (req.query.return && req.query.return !== '') {
                            printLine('SessionTransfer', `Redirecting to return page "${req.query.return}"`, 'info');
                            res.redirect(req.query.return);
                        } else if (req.originalUrl && req.originalUrl.includes('ambient')) {
                            printLine('SessionTransfer', `Redirecting to return page "${req.query.return}"`, 'info');
                            res.redirect(req.originalUrl);
                        } else {
                            res.redirect('/');
                        }
                        req.session.goto = '';
                    }
                })
        }
        if ((req.session.discord && req.session.discord.user.id) || (req.signedCookies.user_token !== undefined && req.signedCookies.user_token.length > 64)) {
            req.session.sidebar = undefined;

            let token = ''
            if (req.session.discord && req.session.discord.user.id) {
                await _generate(req.session.discord.user.id);
            } else if (req.signedCookies.user_token && req.signedCookies.user_token.length > 64) {
                sqlSafe(`SELECT * FROM discord_users WHERE (token = ? AND token IS NOT NULL) LIMIT 1`, [req.signedCookies.user_token], async (err, user) => {
                    if (err) {
                        printLine('PassportCheck', `Error with SQL Login, redirecting to login`, 'error', err);
                        loginPage(req, res, { noLoginAvalible: 'noauth', status: 401 });
                    } else if (user.length === 0 || !user) {
                        printLine('PassportCheck', `Invalid Session Token, redirecting to login`, 'warn');
                        loginPage(req, res, { noLoginAvalible: 'nomember', status: 401 });
                    } else {
                        await _generate(user[0].id);
                    }
                })
            } else if (req.query && req.query.key) {
                sqlSafe(`SELECT * FROM discord_users WHERE (token_static = ? AND token_static IS NOT NULL) LIMIT 1`, [(typeof req.query.key === 'string') ? req.query.key : req.query.key.pop()], async (err, user) => {
                    if (err) {
                        printLine('PassportCheck', `Error with SQL Login, redirecting to login`, 'error', err);
                        loginPage(req, res, { noLoginAvalible: 'noauth', status: 401 });
                    } else if (user.length === 0 || !user) {
                        printLine('PassportCheck', `Invalid Session Token, redirecting to login`, 'warn');
                        loginPage(req, res, { noLoginAvalible: 'nomember', status: 401 });
                    } else {
                        await _generate(user[0].id);
                    }
                })
            } else {
                printLine('PassportCheck', `No Authentication Method, redirecting to login`, 'warn');
                loginPage(req, res, { noLoginAvalible: 'noauth', status: 401 });
            }
        } else if (req.query && req.query.key) {
            printLine('SessionRefresh', `Session does not exist but there is a static key, attempting to silently re-login`, 'warn');
            sqlSafe(`SELECT * FROM discord_users WHERE (token_static = ? AND token_static IS NOT NULL AND token IS NOT NULL) LIMIT 1`, [(typeof req.query.key === 'string') ? req.query.key : req.query.key.pop()], async (err, user) => {
                if (err) {
                    printLine('SessionRefresh', `Error with SQL Login, redirecting to login`, 'error', err);
                    if (req.originalUrl && req.originalUrl !== '' && req.originalUrl.includes('ambient')) {
                        res.redirect(307, '/device-login');
                    } if (req.originalUrl && req.originalUrl === '/home') {
                        res.render('home_lite', {});
                    } else {
                        loginPage(req, res, { noLoginAvalible: 'noauth', status: 401 });
                    }
                } else if (user.length === 0 || !user) {
                    printLine('SessionRefresh', `Invalid Static Token, redirecting to login`, 'warn');
                    if (req.originalUrl && req.originalUrl !== '' && req.originalUrl.includes('ambient')) {
                        res.redirect(307, '/device-login');
                    } if (req.originalUrl && req.originalUrl === '/home') {
                        res.render('home_lite', {});
                    } else {
                        loginPage(req, res, { noLoginAvalible: 'nomember', status: 401 });
                    }
                } else {
                    await _generate(user[0].id);
                }
            })
        } else {
            printLine('SessionRefresh', `No Valid Session Exists, Redirecting to Login`, 'error');
            if (req.originalUrl && req.originalUrl === '/home') {
                res.render('home_lite', {});
            } else if (req.originalUrl && req.originalUrl !== '' && req.originalUrl.includes('ambient')) {
                res.redirect(307, '/device-login');
            } else {
                res.redirect(307, '/login');
            }
        }
    } catch (err) {
        res.status(500).json({
            state: 'HALTED',
            message: err.message,
        });
    }
})
router.get('/session', (req, res) => {
    try {
        res.json(req.session)
    } catch (err) {
        res.status(500).json({
            state: 'HALTED',
            message: err.message,
        });
    }
})
router.get('/token', sessionVerification, (req, res) => {
    try {
        if (req.query && req.query.action) {
            switch (req.query.action) {
                case 'get':
                    sqlSafe(`SELECT * FROM discord_users WHERE (id = ? AND token IS NOT NULL) LIMIT 1`, [req.session.discord.user.id], async (err, user) => {
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
                    sqlSafe(`SELECT * FROM discord_users WHERE (id = ? AND token IS NOT NULL) LIMIT 1`, [req.session.discord.user.id], async (err, user) => {
                        if (err) {
                            res.status(500).send('Internal Server Error')
                            printLine("StaticTokenSystem", `SQL Get Error`, 'error', err)
                        } else if (user.length === 0 || !user) {
                            res.status(401).send('Invalid User Token')
                            printLine("StaticTokenSystem", `Invalid Request Sent`, 'error')
                        } else {
                            const token = crypto.randomBytes(54).toString("hex");
                            sqlSafe(`UPDATE discord_users SET token_static = ? WHERE (id = ? AND token IS NOT NULL)`, [token, req.session.discord.user.id], (err, result) => {
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
                    sqlSafe(`SELECT * FROM discord_users WHERE (id = ? AND token IS NOT NULL) LIMIT 1`, [req.session.discord.user.id], async (err, user) => {
                        if (err) {
                            res.status(500).send('Internal Server Error')
                            printLine("StaticTokenSystem", `SQL Get Error`, 'error', err)
                        } else if (user.length === 0 || !user) {
                            res.status(401).send('Invalid User Token')
                            printLine("StaticTokenSystem", `Invalid Request Sent`, 'error')
                        } else {
                            const token = crypto.randomBytes(54).toString("hex");
                            sqlSafe(`UPDATE discord_users SET token_static = null WHERE (id = ? AND token IS NOT NULL)`, [req.session.discord.user.id], (err, result) => {
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
        loginPage(req, res, { serverError: 'tokenSys', status: 500 });
    }
});
router.post('/update', sessionVerification, async (req, res) => {
    try {
        if (req.body) {
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

            await sqlPromiseSafe(`UPDATE discord_users SET ? WHERE id = ?`, [req.body, req.session.discord.user.id])
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
    return new Promise(async function (resolve) {
        const users = app.get('users').rows.filter(user => user.id === id);
        const extraLinks = app.get('extraLinks').rows
        const userPermissions = app.get('userPermissions').rows.filter(user => user.userid === id);
        const allChannels = app.get('allChannels').rows
        const disabledChannels = app.get('disabledChannels').rows.filter(user => user.user === id);
        const allServers = app.get('allServers').rows

        const readPermissions = userPermissions.filter(e => e.type === 1).map(e => e.role);
        const writePermissions = userPermissions.filter(e => e.type === 2).map(e => e.role);
        const managePermissions = userPermissions.filter(e => e.type === 3).map(e => e.role);
        const specialPermissions = userPermissions.filter(e => e.type === 4).map(e => e.role);

        if (disabledChannels) {
            req.session.disabled_channels = disabledChannels.map(e => e.cid);
        } else {
            req.session.disabled_channels = [];
        }

        if (allChannels.length > 0 ) {
            if (users.length > 0) {
                let _roles_channels = [];
                let _write_channels = [];
                let _manage_channels = [];
                let _server_download = [];
                let _server_list = [];
                await allChannels.forEach(u => {
                    if (readPermissions.indexOf(u.role) !== -1 || specialPermissions.indexOf(u.role) !== -1) {
                        _roles_channels.push(u.channelid)
                    }
                    if (writePermissions.indexOf(u.role_write) !== -1 || managePermissions.indexOf(u.role_write) !== -1 || specialPermissions.indexOf(u.role_write) !== -1) {
                        _write_channels.push(u.channelid)
                        if (u.chid_download !== null) {
                            _server_download.push({
                                serverid: u.serverid,
                                channelid: u.chid_download
                            });
                        }
                    }
                    if (managePermissions.indexOf(u.role_manage) !== -1 || specialPermissions.indexOf(u.role_manage) !== -1) {
                        _manage_channels.push(u.channelid);
                    }
                })
                printLine("AuthorizationGenerator", `User ${id} was found and role session data is loaded into memory!`, 'info');

                if (allServers.length > 0) {
                    allServers.forEach(e => {
                        _server_list.push({
                            serverid: e.serverid,
                            name: e.name,
                            nice_name: e.nice_name,
                            short_name: e.short_name,
                            icon: `https://cdn.discordapp.com/icons/${e.serverid}/${e.avatar}.png`,
                            login: (e.authware_enabled)
                        })
                    })
                }

                let _authToken = undefined
                if (authToken && authToken.length > 10) {
                    _authToken = authToken;
                } else if (req.session && req.session.discord && req.session.discord.user && req.session.discord.user.auth_token ) {
                    _authToken = req.session.discord.user.auth_token;
                }
                let homeLinks = [];
                await extraLinks.forEach(link => {
                    homeLinks.push({
                        title: link.name,
                        icon: (link.icon !== url) ? link.icon : undefined,
                        url: link.url
                    })
                })
                req.session.loggedin = true;
                req.session.discord = {
                    user: {
                        id,
                        name: users[0].nice_name,
                        username: users[0].username,
                        avatar: users[0].avatar,
                        known: true,
                        auth_token: _authToken,
                        token: users[0].token,
                        token_login: users[0].blind_token,
                        token_static: users[0].token_static,
                        token_rotation: users[0].token_expires
                    },
                    channels: {
                        read: _roles_channels,
                        write: _write_channels,
                        manage: _manage_channels
                    },
                    servers: {
                        download: _server_download,
                        list: _server_list,
                    },
                    links: homeLinks
                }
                res.cookie('user_token', users[0].token, {
                    maxAge: (new Date(users[0].token_expires).getTime() - new Date(Date.now()).getTime()).toFixed(0),
                    httpOnly: true, // The cookie only accessible by the web server
                    signed: true, // Indicates if the cookie should be signed
                })

                await generateViews(req, id);
                if (req.session && req.session.login_code) {
                    sqlPromiseSafe(`DELETE FROM sequenzia_login_codes WHERE code = ? AND session = ?`, [req.session.login_code, req.sessionID], true)
                    req.session.login_code = undefined;
                }
                resolve(true)
            } else {
                printLine("AuthorizationGenerator", `User ${id} is not known! No roles will be returned!`, 'warn');
                loginPage(req, res, { noLoginAvalible: 'nomember', status: 401 });
                resolve(false);
            }
        } else {
            printLine("AuthorizationGenerator", `Missing Required data`, 'warn')
            loginPage(req, res, { serverError: 'roleGenSQL0', status: 500 });
            resolve(false);
        }
    })
}
async function generateViews(req, id) {
    const authViewsqlFields = [
        'kanmi_channels.channelid',
        'kanmi_channels.cid AS channel_eid',
        'kanmi_channels.virtual_cid AS virtual_channel_eid',
        'discord_servers.serverid',
        'kanmi_channels.position',
        'discord_servers.short_name AS server_short_name',
        'discord_servers.avatar AS server_avatar',
        'kanmi_channels.name AS channel_name',
        'kanmi_channels.image_hash AS channel_image',
        'kanmi_channels.nice_title AS channel_title',
        'kanmi_channels.short_name AS channel_short_name',
        'kanmi_channels.nice_name AS channel_nice',
        'kanmi_channels.description AS channel_description',
        'kanmi_channels.nsfw AS channel_nsfw',
        'kanmi_channels.uri AS channel_uri',
        'kanmi_channels.role',
        'kanmi_channels.role_write',
        'kanmi_channels.role_manage',
        'kanmi_channels.classification',
        'sequenzia_class.name AS class_name',
        'sequenzia_class.icon AS class_icon',
    ].join(', ');
    const authViewsqlTables = [
        'kanmi_channels',
        'discord_servers',
        'sequenzia_class'
    ].join(', ');
    const authViewsqlWhere = [
        "(kanmi_channels.parent IS NOT NULL AND kanmi_channels.parent != 'isparent' || kanmi_channels.parent IS NULL)",
        'kanmi_channels.classification = sequenzia_class.class',
        'kanmi_channels.serverid = discord_servers.serverid'
    ].join(' AND ');
    const authView = await sqlPromiseSimple(`CREATE OR REPLACE VIEW kanmi_auth_${id} AS SELECT x.*, y.virtual_channel_name, y.virtual_channel_description, y.virtual_channel_uri FROM (SELECT x.* FROM (SELECT DISTINCT role FROM discord_users_permissons WHERE userid = '${id}') z LEFT JOIN (SELECT DISTINCT ${authViewsqlFields} FROM ${authViewsqlTables} WHERE (${authViewsqlWhere}) ) x ON (x.role = z.role)) x LEFT OUTER JOIN (SELECT virtual_cid AS virtual_channel_eid, name AS virtual_channel_name, description AS virtual_channel_description, uri AS virtual_channel_uri FROM kanmi_virtual_channels) y ON (x.virtual_channel_eid = y.virtual_channel_eid) ORDER BY x.position`)
    printLine("ViewGenerator", `User ${id} authentication view was refreshed!`, 'info');

    const sidebarViewsqlFields = [
        `kanmi_auth_${id}.channelid`,
        `kanmi_auth_${id}.channel_eid`,
        `kanmi_auth_${id}.virtual_channel_eid`,
        'discord_servers.serverid',
        `kanmi_auth_${id}.position`,
        'sequenzia_superclass.position AS super_position',
        'sequenzia_superclass.super',
        'sequenzia_superclass.name AS super_name',
        'sequenzia_superclass.icon AS super_icon',
        'sequenzia_superclass.uri AS super_uri',
        'sequenzia_class.uri AS class_uri',
        'sequenzia_class.position AS class_position',
        'sequenzia_class.class',
        'sequenzia_class.name AS class_name',
        'sequenzia_class.icon AS class_icon',
        `kanmi_auth_${id}.channel_nsfw`,
        `kanmi_auth_${id}.channel_name`,
        `kanmi_auth_${id}.channel_image`,
        `kanmi_auth_${id}.channel_title`,
        `kanmi_auth_${id}.channel_short_name`,
        `kanmi_auth_${id}.channel_nice`,
        `kanmi_auth_${id}.channel_description`,
        `kanmi_auth_${id}.channel_uri`,
        `discord_servers.position AS server_position`,
        'discord_servers.name AS server_name',
        'discord_servers.nice_name AS server_nice',
        'discord_servers.short_name AS server_short',
        'discord_servers.avatar AS server_avatar',
        `kanmi_auth_${id}.role_write`,
        `kanmi_auth_${id}.role_manage`,
    ].join(', ');
    const sidebarViewsqlTables = [
        'discord_servers',
        'sequenzia_superclass',
        'sequenzia_class',
        `kanmi_auth_${id}`,
    ].join(', ');
    const sidebarViewsqlWhere = [
        `kanmi_auth_${id}.classification IS NOT NULL`,
        `kanmi_auth_${id}.classification = sequenzia_class.class`,
        `kanmi_auth_${id}.serverid = discord_servers.serverid`,
        'sequenzia_class.class IS NOT NULL',
        'sequenzia_class.super = sequenzia_superclass.super',
    ].join(' AND ');
    const sidebarViewsqlOrderBy = [
        'x.super_position',
        'x.class_position',
        `x.server_position`,
        `x.virtual_channel_eid`,
        `x.position`,
    ].join(', ');
    const sidebarView = await sqlPromiseSimple(`CREATE OR REPLACE VIEW kanmi_sidebar_${id} AS SELECT x.*, y.virtual_channel_name, y.virtual_channel_uri, y.virtual_channel_description FROM (SELECT ${sidebarViewsqlFields} FROM ${sidebarViewsqlTables} WHERE ${sidebarViewsqlWhere}) x LEFT OUTER JOIN (SELECT virtual_cid AS virtual_channel_eid, name AS virtual_channel_name, uri AS virtual_channel_uri, description AS virtual_channel_description FROM kanmi_virtual_channels) y ON (x.virtual_channel_eid = y.virtual_channel_eid) ORDER BY ${sidebarViewsqlOrderBy}`);
    printLine("ViewGenerator", `User ${id} sidebar view was refreshed!`, 'info');

    req.session.cache = {
        channels_view: `kanmi_auth_${id}`,
        sidebar_view: `kanmi_sidebar_${id}`,
    };

    const serverResults = await sqlPromiseSimple(`SELECT DISTINCT kanmi_sidebar_${id}.serverid, kanmi_sidebar_${id}.server_nice, kanmi_sidebar_${id}.server_name, kanmi_sidebar_${id}.server_short, discord_servers.position, discord_servers.authware_enabled FROM kanmi_sidebar_${id}, discord_servers WHERE kanmi_sidebar_${id}.serverid = discord_servers.serverid ORDER BY discord_servers.position`);
    req.session.server_list = serverResults.rows.map((e) => ({
        id: e.serverid,
        name: (e.server_nice) ? e.server_nice : e.server_name,
        short_name: e.server_short.toUpperCase(),
        login: (e.authware_enabled)
    }));
    printLine("ViewGenerator", `User ${id} channels index cache was loaded into memory!`, 'info');
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
            if (guilds_response_json !== undefined && guilds_response_json.length > 0) {
                req.session.guilds = guilds_response_json;
            }
            await roleGeneration(user_response_json.id, res, req, token)
                    .then((config) => {
                        if (config) {
                            req.session.loggedin = true;
                            req.session.user = {
                                id: req.session.discord.user.id,
                                source: 0,
                                username: (req.session.discord.user.name) ? req.session.discord.user.name : req.session.discord.user.username,
                                avatar: (req.session.discord.user.avatar) ? `https://cdn.discordapp.com/avatars/${req.session.discord.user.id}/${req.session.discord.user.avatar}.${(req.session.discord.user.avatar && req.session.discord.user.avatar.startsWith('a_')) ? 'gif' : 'jpg'}` : `https://cdn.discordapp.com/embed/avatars/0.png`,
                            }
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
    _obj.enableTelegram = (config.telegram_secret);
    _obj.joinLink = webconfig.discord_join_link;
    if (config.telegram_callback_url && config.telegram_secret && config.telegram_bot_name) {
        _obj.telegramCallback = config.telegram_callback_url;
        _obj.telegramName = config.telegram_bot_name;
    }
    sessionTransfer(req);
    if (obj && obj.noQRCode) {
        if (obj && obj.keepSession) {
            req.session.loggedin = false;
        }
        res.status(((obj && obj.status) ? obj.status : 200)).render('login_new', _obj);
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
                    res.status(((obj && obj.status) ? obj.status : 200)).render('login_new', _obj);
                });
        }
    }
}
function sessionTransfer(req) {
    console.log(req.originalUrl)
    if (req.originalUrl && req.originalUrl !== '/' && (
        req.originalUrl.toLowerCase().includes('juneOS') || req.originalUrl.toLowerCase().includes('lite') || req.originalUrl.toLowerCase().includes('home') ||
        req.originalUrl.toLowerCase().includes('ambient') || req.originalUrl.toLowerCase().includes('ads') ||
        req.originalUrl.toLowerCase().includes('gallery') || req.originalUrl.toLowerCase().includes('files') || req.originalUrl.toLowerCase().includes('cards'))) {
        printLine('SessionTransfer', `Redirect URL "${req.originalUrl}" Saved`, 'debug');
        req.session.goto = req.originalUrl
    }
}
async function sessionVerification(req, res, next) {
    console.log(req.path)
    if (config.bypass_cds_check && (req.path.startsWith('/stream') || req.path.startsWith('/content'))) {
        next()
    } else if (req.session && req.session.loggedin === true && req.session.discord && req.session.discord.user.id) {
        if (req.session.discord.channels.read && req.session.discord.channels.read.length > 0) {
            next();
        } else if (req.originalUrl && req.originalUrl === '/home') {
            printLine('PassportCheck', `User ${req.session.discord.user.username} is known but does not have rights to access anything!`, 'warn');
            res.render('home_lite', {});
        } else {
            printLine('PassportCheck', `User ${req.session.discord.user.username} is known but does not have rights to access anything!`, 'warn');
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
            await roleGeneration(user[0].id, res, req)
                .then((config) => {
                    if (config) {
                        if (req.session.discord && req.session.discord.user.known) {
                            req.session.user = {
                                id: req.session.discord.user.id,
                                source: 900,
                                username: (req.session.discord.user.name) ? req.session.discord.user.name : req.session.discord.user.username,
                                avatar: (req.session.discord.user.avatar) ? `https://cdn.discordapp.com/avatars/${req.session.discord.user.id}/${req.session.discord.user.avatar}.${(req.session.discord.user.avatar && req.session.discord.user.avatar.startsWith('a_')) ? 'gif' : 'jpg'}` : `https://cdn.discordapp.com/embed/avatars/0.png`,
                            }
                            req.session.loggedin = true;
                            next();
                        } else {
                            printLine('PassportCheck', `Session Launch Failed using Static Login Token, redirecting to login`, 'warn');
                            if (req.originalUrl && req.originalUrl === '/home') {
                                res.render('home_lite', {});
                            } else {
                                loginPage(req, res, { noLoginAvalible: 'nomember', status: 401 });
                            }
                        }
                    }
                })
        }
    } else if (req.query && req.query.blind_key) {
        printLine('PassportCheck', `Session does not exist but there is a blind key, attempting to silently re-login`, 'warn');
        sqlSafe(`SELECT *
                     FROM discord_users
                     WHERE (blind_token = ? AND blind_token IS NOT NULL AND token IS NOT NULL AND token_static IS NOT NULL)
                     LIMIT 1`, [(typeof req.query.blind_key === 'string') ? req.query.blind_key : req.query.blind_key.pop()], async (err, user) => {
            if (err) {
                printLine('PassportCheck', `Error with SQL Login, redirecting to login`, 'error', err);
                if (req.originalUrl && req.originalUrl === '/home') {
                    res.render('home_lite', {});
                } else {
                    loginPage(req, res, { noLoginAvalible: 'noauth', status: 401 });
                }
            } else if (user.length === 0 || !user) {
                printLine('PassportCheck', `Invalid Blind Token, redirecting to login`, 'warn');
                if (req.originalUrl && req.originalUrl === '/home') {
                    res.render('home_lite', {});
                } else {
                    loginPage(req, res, { noLoginAvalible: 'nomember', status: 401 });
                }
            } else {
                await roleGeneration(user[0].id, res, req)
                    .then((config) => {
                        if (config) {
                            if (req.session.discord && req.session.discord.user.known) {
                                req.session.user = {
                                    id: req.session.discord.user.id,
                                    source: 900,
                                    username: (req.session.discord.user.name) ? req.session.discord.user.name : req.session.discord.user.username,
                                    avatar: (req.session.discord.user.avatar) ? `https://cdn.discordapp.com/avatars/${req.session.discord.user.id}/${req.session.discord.user.avatar}.${(req.session.discord.user.avatar && req.session.discord.user.avatar.startsWith('a_')) ? 'gif' : 'jpg'}` : `https://cdn.discordapp.com/embed/avatars/0.png`,
                                }
                                req.session.loggedin = true;
                                next();
                            } else {
                                printLine('PassportCheck', `Session Launch Failed using Blind Token, redirecting to login`, 'warn');
                                if (req.originalUrl && req.originalUrl === '/home') {
                                    res.render('home_lite', {});
                                } else {
                                    loginPage(req, res, { noLoginAvalible: 'nomember', status: 401 });
                                }
                            }
                        }
                    })
            }
        })
    } else if (req.signedCookies && req.signedCookies.user_token && req.signedCookies.user_token.length > 64) {
        printLine('PassportCheck', `Session does not exist but there is a cookie, attempting to silently re-login`, 'warn');
        sqlSafe(`SELECT *
                     FROM discord_users
                     WHERE (token = ? AND token IS NOT NULL)
                     LIMIT 1`, [req.signedCookies.user_token], async (err, user) => {
            if (err) {
                printLine('PassportCheck', `Error with SQL Login, redirecting to login`, 'error', err);
                if (req.originalUrl && req.originalUrl === '/home') {
                    res.render('home_lite', {});
                } else {
                    loginPage(req, res, { noLoginAvalible: 'noauth', status: 401 });
                }
            } else if (user.length === 0 || !user) {
                printLine('PassportCheck', `Invalid Session Token, redirecting to login`, 'warn');
                if (req.originalUrl && req.originalUrl === '/home') {
                    res.render('home_lite', {});
                } else {
                    loginPage(req, res);
                }
            } else {
                await roleGeneration(user[0].id, res, req)
                    .then((config) => {
                        if (config) {
                            if (req.session.discord && req.session.discord.user.known) {
                                let _source = 100;
                                if (req.session.user && req.session.user.source || req.session.user && req.session.user.source === 0) {
                                    _source = req.session.user.source
                                }
                                req.session.user = {
                                    id: req.session.discord.user.id,
                                    source: _source,
                                    username: (req.session.discord.user.name) ? req.session.discord.user.name : req.session.discord.user.username,
                                    avatar: (req.session.discord.user.avatar) ? `https://cdn.discordapp.com/avatars/${req.session.discord.user.id}/${req.session.discord.user.avatar}.${(req.session.discord.user.avatar && req.session.discord.user.avatar.startsWith('a_')) ? 'gif' : 'jpg'}` : `https://cdn.discordapp.com/embed/avatars/0.png`,
                                }
                                req.session.loggedin = true;
                                next();
                            } else {
                                printLine('PassportCheck', `Session Launch Failed when using Cookie Login, redirecting to login`, 'warn');
                                if (req.originalUrl && req.originalUrl === '/home') {
                                    res.render('home_lite', {});
                                } else {
                                    loginPage(req, res, { noLoginAvalible: 'nomember', status: 401 });
                                }
                            }
                        }
                    })
            }
        })
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
    if (req.session && req.session.loggedin && req.session.discord && req.session.discord.user.id && req.session.discord.user.known === true) {
        if (req.body && req.body.serverid && req.body.channelid) {
            if ((req.session.discord.channels.manage && req.session.discord.channels.manage.length > 0 && req.session.discord.channels.manage.indexOf(req.body.channelid) !== -1) || req.body.action && req.body.action === 'RequestFile') {
                next();
            } else {
                printLine('PassportCheck-Manage', `User ${req.session.discord.user.username} does not have the rights to manage this channel`, 'error', req.body);
                res.status(401).send('Unauthorized Channel');
            }
        } else if (req.body.action && req.body.action === 'DownloadLink' && req.body.url && req.body.serverid) {
            if (req.session.discord && req.session.discord.servers.download) {
                if (req.session.discord.channels.write && req.session.discord.channels.write.length > 0 && req.session.discord.servers.download && req.session.discord.servers.download.length > 0 && req.session.discord.servers.download.filter(e => e.serverid === req.body.serverid).length > 0 && req.session.discord.channels.write.indexOf(req.session.discord.servers.download.filter(e => e.serverid === req.body.serverid)[0].channelid) !== -1) {
                    next();
                } else {
                    printLine('PassportCheck-Manage', `User ${req.session.discord.user.username} does not have the rights to remote download files`, 'error', req.body);
                    res.status(401).send('Unauthorized Channel');
                }
            } else {
                res.status(400).send('You need to refresh your account');
            }
        } else if (req.body.action && req.body.action === 'textMessage' && req.body.text) {
            if (req.session.discord && req.session.discord.channels.write && req.session.discord.channels.write.length > 0 && req.session.discord.channels.write.indexOf(req.body.channelid) !== -1) {
                next();
            } else {
                printLine('PassportCheck-Manage', `User ${req.session.discord.user.username} does not have the rights to send text message`, 'error', req.body);
                res.status(401).send('Unauthorized Channel');
            }
        } else {
            printLine('PassportCheck-Manage', `User ${req.session.discord.user.username} manage request was invalid`, 'error', req.body);
            res.status(400).send('Invalid Request');
        }
    } else {
        printLine('PassportCheck-Manage', `User does not have a valid session! Was attempting to manage`, 'error', req.body);
        res.status(404)
    }
}
function readValidation(req, res, next) {
    if (config.bypass_cds_check) {
        next()
    } else if (req.session && req.session.loggedin && req.session.discord && req.session.discord.user.id && req.session.discord.user.known === true) {
        if ( req.session.discord.channels.read && req.session.discord.channels.read.length > 0 ) {
            next();
        } else {
            printLine('PassportCheck-Read', `User ${req.session.discord.user.username} does not have the rights to access this channel`, 'error', req.body);
            res.status(401).send('Unauthorized Channel');
        }
    } else if (!(req.session && req.session.loggedin && req.session.discord && req.session.discord.user.id) && req.query && req.query.blind_key) {
        printLine('PassportCheck', `Session does not exist but there is a blind key, attempting to silently re-login`, 'warn');
        sqlSafe(`SELECT * FROM discord_users WHERE (blind_token = ? AND blind_token IS NOT NULL AND token IS NOT NULL AND token_static IS NOT NULL) LIMIT 1`, [(typeof req.query.blind_key === 'string') ? req.query.blind_key : req.query.blind_key.pop()], async (err, user) => {
            if (err) {
                printLine('PassportCheck', `Error with SQL Login, redirecting to login`, 'error', err);
                if (req.originalUrl && req.originalUrl === '/home') {
                    res.render('home_lite', {});
                } else {
                    loginPage(req, res, { noLoginAvalible: 'noauth', status: 401 });
                }
            } else if (user.length === 0 || !user) {
                printLine('PassportCheck', `Invalid Blind Token, redirecting to login`, 'warn');
                if (req.originalUrl && req.originalUrl === '/home') {
                    res.render('home_lite', {});
                } else {
                    loginPage(req, res, { noLoginAvalible: 'nomember', status: 401 });
                }
            } else {
                await roleGeneration(user[0].id, res, req)
                    .then((config) => {
                        if (config) {
                            if (req.session.discord && req.session.discord.user.known) {
                                req.session.user = {
                                    id: req.session.discord.user.id,
                                    source: 900,
                                    username: (req.session.discord.user.name) ? req.session.discord.user.name : req.session.discord.user.username,
                                    avatar: (req.session.discord.user.avatar) ? `https://cdn.discordapp.com/avatars/${req.session.discord.user.id}/${req.session.discord.user.avatar}.${(req.session.discord.user.avatar && req.session.discord.user.avatar.startsWith('a_')) ? 'gif' : 'jpg'}` : `https://cdn.discordapp.com/embed/avatars/0.png`,
                                }
                                req.session.loggedin = true;
                                next();
                            } else {
                                printLine('PassportCheck-Read', `User could not be logged in via blind token! Redirecting to Login`, 'error', req.body);
                                sessionTransfer(req);
                                res.redirect(307, '/login');
                            }
                        }
                    })
            }
        })
    } else {
        printLine('PassportCheck-Read', `User does not have a valid session! Redirecting to Login`, 'error', req.body);
        sessionTransfer(req);
        res.redirect(307, '/login');
    }
}
function downloadValidation(req, res, next) {
    if (config.bypass_cds_check) {
        next()
    } else if (req.originalUrl && (req.originalUrl.includes('/content/link/') || req.originalUrl.includes('/content/json/'))) {
        printLine('PassportCheck-Proxy', `Request Bypassed for CDS Permalink URL`, 'debug', req.body);
        next();
    } else if (req.session && req.session.loggedin && req.session.discord && req.session.discord.user.id && req.session.discord.user.known === true) {
        if ( req.session.discord.channels.read && req.session.discord.channels.read.length > 0 ) {
            const channel = req.path.substr(1, req.path.length - 1).split('/')[1]
            if (req.session.discord.channels.read.indexOf(channel) !== -1) {
                next();
            } else {
                printLine('PassportCheck-Proxy', `User ${req.session.discord.user.username} does not have the rights to download from this channel`, 'error', req.body);
                res.status(401).send('Unauthorized Channels');
            }
        } else {
            printLine('PassportCheck-Proxy', `User ${req.session.discord.user.username} does not have the rights to access this channel`, 'error', req.body);
            res.status(401).send('Unauthorized Roles');
        }
    } else {
        printLine('PassportCheck-Proxy', `User does not have a valid session! Redirecting to Login`, 'error', req.body);
        sessionTransfer(req);
        res.status(401).redirect('/');
    }
}
function writeValidation(req, res, next) {
    if (req.session && req.session.loggedin && req.session.discord && req.session.discord.user.id && req.session.discord.user.known === true && req.session.discord.channels.write && req.session.discord.channels.write.length > 0) {
        if (req.session.user && (req.session.user.source < 900 || (req.headers && req.headers['x-bypass-warning'] && req.headers['x-bypass-warning'] === 'appIntent'))) {
            if (req.query && req.query.channelid) {
                if (req.session.discord.channels.write.indexOf(req.query.channelid) !== -1) {
                    next();
                } else {
                    printLine('PassportCheck-Write', `User ${req.session.discord.user.username} does not have the rights to upload to this channel`, 'error', req.body);
                    res.status(401).send('Unauthorized Channels');
                }
            } else {
                printLine('PassportCheck-Write', `User ${req.session.discord.user.username} upload request was invalid`, 'error', req.body);
                res.status(400).send('Missing Parameters');
            }
        } else {
            printLine("PassportCheck-Write", `Insecure Session attempted to access API by ${req.session.user.username}`, 'critical');
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
