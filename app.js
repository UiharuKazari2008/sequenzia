const express = require("express");
const app = express()
const routes = require('./routes/index');
const { router: routesDiscord, sessionVerification, loginPage } = require('./routes/discord');
const { sqlPromiseSafe } = require('./js/sqlClient');
const routesAccessories = require('./routes/accessories');
const { router: routesTelegram } = require('./routes/telegram');
const { printLine } = require('./js/logSystem');
let routesUpload = require('./routes/upload');
const bodyParser = require('body-parser');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./host.config.json')
const global = require('./config.json')
const web = require('./web.config.json')
const {catchAsync} = require("./utils");
const sessionSQL = require('express-mysql-session')(session);
const rateLimit = require("express-rate-limit");
let activeRequests = new Map();
let fileIDCache = new Map();

//  Rate Limiters
app.use(['/discord', '/telegram', '/login', '/ping', '/transfer'], rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 100,
    message:
        "AuthWare: Too many requests"
}));
app.use('/device-login', rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 250,
    message:
        "AuthWare: Too many requests"
}));
app.use('/upload', rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 100,
    message:
        "Uploads: Too many requests"
}));
app.use('/stream', rateLimit({
    windowMs: ((global.user_max_streams_sec) ? parseInt(global.user_max_streams_sec.toString()) : 30) * 1000, // 5 minutes
    max: (global.max_streams_per_user) ? parseInt(global.max_streams_per_user.toString()) : 10,
    message:
        "Stream: Too many requests, Try again soon"
}));
app.use('/actions', rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 250,
    message:
        "Action API: Too many requests"
}));
app.use([ '/ads-micro', '/ambient-get', '/ads-widget'], rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 300,
    message:
        "Ambient Generator: Too many requests"
}));
app.use(['/acc', '/ambient', '/ambient-refresh', '/ambient-remote-refresh', '/ambient-history'], rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 150,
    message:
        "Ambient: Too many requests"
}));
app.use(['/gallery', '/files', '/cards', '/start', '/pages', '/artists', '/sidebar'], rateLimit({
    windowMs: 60 * 1000, // 5 minutes
    max: 250,
    message:
        "Sequenzia: Too many requests"
}));
app.use(['/pipe'], rateLimit({
    windowMs: 60 * 1000, // 5 minutes
    max: 1000,
    message:
        "Sequenzia Pipe: Too many requests"
}));

const sessionStore = new sessionSQL({
    host: config.sql_host,
    port: 3306,
    user: config.sql_user,
    password: config.sql_pass,
    database: config.sql_database,
    clearExpired: true,
    checkExpirationInterval: 900000,
    expiration: 604800000,
    createDatabaseTable: true,
    connectionLimit: 1,
    endConnectionOnClose: true,
    charset: 'utf8mb4_bin',
    schema: {
        tableName: 'sequenzia_sessions',
        columnNames: {
            session_id: 'session_id',
            expires: 'expires',
            data: 'data'
        }
    }
});

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(function (req, res, next) {
    res.setHeader('X-Powered-By', 'Kanmi Digital Media Management System');
    res.setHeader('X-Site-Name', web.site_name);
    res.setHeader('X-Site-Owner', web.company_name);
    res.setHeader('X-Eiga-Node', config.system_name);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next()
})

app.use(cors());
app.use(morgan(function(tokens, req, res) {
    const baseURL = req.url.split('/')[1].split('?')[0]
    let username = ''
    if (req.session && req.session.user && req.session.user.username) {
        username = req.session.user.username;
    }
    if (res.statusCode !== 304 && res.method === 'GET') {
        printLine(`Express`, `"${username}" => ${req.method} ${res.statusCode} ${req.originalUrl} - Completed in ${tokens['response-time'](req, res)}ms - Send ${tokens.res(req, res, 'content-length')}`, 'debug', {
            method: req.method,
            url: req.originalUrl,
            base: baseURL,
            status: res.statusCode,
            params: req.query,
            length: tokens.res(req, res, 'content-length'),
            time: tokens['response-time'](req, res),
            username: username,
        })
    } else {
        printLine(`Express`, `"${username}" => ${req.method} ${res.statusCode} ${req.originalUrl} - Completed in ${tokens['response-time'](req, res)}ms - Send Nothing`, 'debug', {
            method: req.method,
            url: req.originalUrl,
            base: baseURL,
            status: res.statusCode,
            params: req.query,
            length: 0,
            time: parseInt(tokens['response-time'](req, res)),
            username: username,
        })
    }

}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json({limit: '20mb'}));
app.use(express.urlencoded({extended : true, limit: '20mb'}));
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, X-WSS-Key, X-API-Key, X-User-Agent, User-Agent");
    next();
});
app.use(cookieParser(config.cookie_secret));

app.locals.moment = require('moment');
app.locals.webconf = require('./web.config.json');
app.locals.activestreams = activeRequests
app.locals.fileid_cache = fileIDCache

app.use(session({
    cookie: { path: '/', httpOnly: true, secure: (config.use_secure_cookie) ? true : undefined, maxAge: null},
    name: 'UserSession',
    secret: config.cookie_secret,
    store: sessionStore,
    proxy: true,
    resave: false,
    saveUninitialized: true
}));
app.set('trust proxy', 1);

app.locals.databaseCache = new Map();

async function cacheDatabase() {
    const users = await sqlPromiseSafe(`SELECT * FROM discord_users`)
    const extraLinks = await sqlPromiseSafe(`SELECT * FROM sequenzia_homelinks ORDER BY position`)
    const userPermissions = await sqlPromiseSafe("SELECT DISTINCT role, type FROM discord_users_permissons")
    const allChannels = await sqlPromiseSafe("SELECT x.*, y.chid_download FROM ( SELECT DISTINCT kanmi_channels.channelid, kanmi_channels.serverid, kanmi_channels.role, kanmi_channels.role_write, kanmi_channels.role_manage FROM kanmi_channels, sequenzia_class WHERE kanmi_channels.role IS NOT NULL AND kanmi_channels.classification = sequenzia_class.class) x LEFT OUTER JOIN (SELECT chid_download, serverid FROM discord_servers) y ON (x.serverid = y.serverid AND x.channelid = y.chid_download)");
    const disabledChannels = await sqlPromiseSafe(`SELECT DISTINCT cid FROM sequenzia_hidden_channels`)
    const allServers = await sqlPromiseSafe(`SELECT DISTINCT * FROM discord_servers ORDER BY position`);

    app.locals.databaseCache.set('users', users)
    app.locals.databaseCache.set('extraLinks', extraLinks)
    app.locals.databaseCache.set('userPermissions', userPermissions)
    app.locals.databaseCache.set('allChannels', allChannels)
    app.locals.databaseCache.set('disabledChannels', disabledChannels)
    app.locals.databaseCache.set('allServers', allServers)
}
setInterval(cacheDatabase, 60000)
cacheDatabase();

app.use('/', routes);
app.use('/discord', routesDiscord);
app.use('/telegram', routesTelegram);
app.use('/upload', routesUpload);
app.use('/acc', routesAccessories);
app.get('/transfer', sessionVerification, catchAsync(async (req, res) => {
    if (req.query.deviceID) {
        const device = req.query.deviceID
        if (req.session && req.session.discord && req.session.discord.user.token) {
            sessionStore.get(device, (error, session1) => {
                if (error) {
                    printLine('SessionTransfer', `Transfer session failed, Can't get active session data- ${error.message}`, 'debug');
                    loginPage(req, res, { authfailedDevice: true, keepSession: true, noQRCode: true });
                } else {
                    let passURL = undefined
                    if (session1 && session1.goto && session1.goto !== '/') {
                        passURL = session1.goto
                    }
                    if (req.query.type === '1' && !passURL) {
                        passURL = '/ambient'
                        if (session1 && session1.goto && session1.goto !== '' && session1.goto.includes('ambient')) {
                            passURL = session1.goto
                        }
                    }

                    sessionStore.set(device, {
                        cookie: { path: '/', httpOnly: true, secure: (config.use_secure_cookie) ? true : undefined, maxAge: null },
                        discord: req.session.discord,
                        user: req.session.user,
                        device: 'notInteractive',
                        goto: passURL,
                        loggedin: true,
                    }, function (err) {
                        if (err) {
                            printLine('SessionTransfer', `Transfer session failed - ${err.message}`, 'debug');
                            loginPage(req, res, { authfailedDevice: true, keepSession: true, noQRCode: true });
                        } else {
                            printLine('SessionTransfer', `Transfer session successfully to device!`, 'debug');
                            loginPage(req, res, { authenticatedDevice: true, keepSession: true, noQRCode: true });                        }
                    });
                }
            })
        } else {
            printLine('SessionTransfer', `Transfer session failed, Missing User Token`, 'debug');
            loginPage(req, res, { authfailedDevice: true, keepSession: true, noQRCode: true });
        }
    } else if (req.query.code) {
        if (req.session && req.session.discord && req.session.discord.user.token) {
            const code = (typeof req.query.code === 'string') ? req.query.code.toUpperCase() : req.query.code[0].toUpperCase();
            const IDfromCode = await sqlPromiseSafe(`SELECT session FROM sequenzia_login_codes WHERE code = ? LIMIT 1`, [code])
            if (IDfromCode && IDfromCode.rows.length > 0) {
                const device = IDfromCode.rows[0].session;
                sessionStore.get(device, (error, session1) => {
                    if (error) {
                        printLine('SessionTransfer', `Transfer session failed, Can't get active session data- ${error.message}`, 'debug');
                        res.status(401).send(`Transfer session failed - Could not read session`)
                    } else {
                        let passURL = undefined
                        if (session1 && session1.goto && session1.goto !== '/') {
                            passURL = session1.goto
                        }
                        if (req.query.type === '1' && !passURL) {
                            passURL = '/ambient'
                            if (session1 && session1.goto && session1.goto !== '' && session1.goto.includes('ambient')) {
                                passURL = session1.goto
                            }
                        }

                        sessionStore.set(device, {
                            cookie: {path: '/', httpOnly: true, secure: (config.use_secure_cookie) ? true : undefined, maxAge: null},
                            discord: req.session.discord,
                            user: req.session.user,
                            device: 'notInteractive',
                            goto: passURL,
                            loggedin: true,
                        }, function (err) {
                            if (err) {
                                printLine('SessionTransfer', `Transfer session failed - ${err.message}`, 'debug');
                                res.status(401).send(`Transfer session failed - ${err.message}`)
                            } else {
                                printLine('SessionTransfer', `Transfer session successfully to device!`, 'debug');
                                res.status(200).send('Login successful, Wait up to a minute for device to login or refresh');
                                sqlPromiseSafe(`DELETE FROM sequenzia_login_codes WHERE code = ? AND session = ?`, [code, device])
                            }
                        });
                    }
                })
            } else {
                printLine('SessionTransfer', `Transfer session failed, Code does not match`, 'debug');
                res.status(400).send('Code is not valid')
            }
        } else {
            printLine('SessionTransfer', `Transfer session failed, Missing User Token`, 'debug');
            res.status(401).send('Session is not valid!')
        }
    } else {
        printLine('SessionTransfer', `Failed to get device id to create session`, 'error');
        loginPage(req, res, { authfailedDevice: true, keepSession: true, noQRCode: true });
    }
}));
app.use('/', express.static('public'));
app.get('*', function(req, res){
    if (req.session && req.session.loggedin) {
        res.sendStatus(404);
        console.error(`Not Routed - ${req.path}`)
    } else {
        printLine('ExpressCore', `Invalid URL requested from non-authenticated user - ${req.url}`, 'warn');
    }
});
module.exports = app;
