let config = require('./host.config.json')
let global = require('./config.json')
let web = require('./web.config.json')

if (process.env.SYSTEM_NAME && process.env.SYSTEM_NAME.trim().length > 0)
    config.system_name = process.env.SYSTEM_NAME.trim()
if (process.env.DATABASE_HOST && process.env.DATABASE_HOST.trim().length > 0)
    config.sql_host = process.env.DATABASE_HOST.trim()
if (process.env.DATABASE_NAME && process.env.DATABASE_NAME.trim().length > 0)
    config.sql_database  = process.env.DATABASE_NAME.trim()
if (process.env.DATABASE_USERNAME && process.env.DATABASE_USERNAME.trim().length > 0)
    config.sql_user = process.env.DATABASE_USERNAME.trim()
if (process.env.DATABASE_PASSWORD && process.env.DATABASE_PASSWORD.trim().length > 0)
    config.sql_pass = process.env.DATABASE_PASSWORD.trim()

const express = require("express");
const app = module.exports = express()
const routes = require('./routes/index');
const apps = require('./routes/apps');
const { router: routesDiscord, sessionVerification, loginPage } = require('./routes/discord');
const { sqlPromiseSafe } = require('./js/sqlClient');
const routesAccessories = require('./routes/accessories');
const { printLine } = require('./js/logSystem');
let routesUpload = require('./routes/upload');
const bodyParser = require('body-parser');
const compression = require('compression')
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const cors = require('cors');
const morgan = require('morgan');
const {catchAsync} = require("./utils");
const sessionSQL = require('express-mysql-session')(session);
const rateLimit = require("express-rate-limit");
const fs = require("fs");
let activeRequests = new Map();
let fileIDCache = new Map();
if (web.Base_URL)
    web.base_url = web.Base_URL;
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
let ready = false;

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
    max: 1000,
    message:
        "Actions API: Too many requests"
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
app.use(['/attachments'], rateLimit({
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
    res.setHeader('X-Site-Name', web.site_name || 'Sequenzia');
    res.setHeader('X-Site-Owner', web.company_name || 'Undisclosed Operator Name');
    res.setHeader('X-Eiga-Node', config.system_name || 'Anonymous Server Name');
    res.setHeader('X-Validator', web.domain_validation || 'SequenziaOK');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.locals.ua = req.get('User-Agent');
    if (res.locals.ua.toLowerCase().includes("pocketcasts") || (res.locals.ua.toLowerCase().includes("bot") && !res.locals.ua.toLowerCase().includes("discord"))) {
        res.status(444).end();
    } else {
        next()
    }
})
app.use(cors());
app.use(compression());
app.use(morgan(function(tokens, req, res) {
    const thisUser = res.locals.thisUser || app.get('userCache').rows.filter(e => req.session && req.session.userid === e.userid).map(e => e.data)[0];
    const baseURL = req.url.split('/')[1].split('?')[0]
    let username = ''
    let ipaddress = (req.headers['x-real-ip']) ? req.headers['x-real-ip'] : (req.headers['x-forwarded-for']) ? req.headers['x-forwarded-for'] : 'Unknown'
    if (req.session && thisUser && thisUser.user && thisUser.user.username) {
        username = thisUser.user.username;
    }
    if (!(req.originalUrl.startsWith('/static') || req.originalUrl.startsWith('/css') || req.originalUrl.startsWith('/js') || req.originalUrl.startsWith('/favicon') || req.originalUrl.startsWith('/serviceWorker'))) {
        if (res.statusCode !== 304 && res.method === 'GET') {
            printLine(`Express`, `"${username}" via ${ipaddress} => ${req.method} ${res.statusCode} ${req.originalUrl} - Completed in ${tokens['response-time'](req, res)}ms - Send ${tokens.res(req, res, 'content-length')}`, 'debug', {
                method: req.method,
                url: req.originalUrl,
                ip: ipaddress,
                base: baseURL,
                status: res.statusCode,
                params: req.query,
                length: tokens.res(req, res, 'content-length'),
                time: tokens['response-time'](req, res),
                username: username,
            })
        } else {
            printLine(`Express`, `"${username}" via ${ipaddress} => ${req.method} ${res.statusCode} ${req.originalUrl} - Completed in ${tokens['response-time'](req, res)}ms - Send Nothing`, 'debug', {
                method: req.method,
                url: req.originalUrl,
                ip: ipaddress,
                base: baseURL,
                status: res.statusCode,
                params: req.query,
                length: 0,
                time: parseInt(tokens['response-time'](req, res)),
                username: username,
            })
        }
    }
}));

app.use(bodyParser.urlencoded({
    limit: '50mb',
    parameterLimit: 100000,
    extended: true
}));
app.use(express.json({limit: '50mb'}));
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
if (process.env.NODE_ENV !== 'production') {
    printLine("Init", `View Caching is not enabled and performance WILL SUFFER GREATLY, Set the environment variable NODE_ENV to production`, 'critical');
    app.disable('view cache')
}

app.locals.databaseCache = new Map();

app.cacheDatabase = async function cacheDatabase() {
    const users = await sqlPromiseSafe(`SELECT x.* FROM (SELECT * FROM discord_users) x LEFT JOIN (SELECT discord_servers.position, discord_servers.authware_enabled, discord_servers.name, discord_servers.serverid FROM discord_servers) y ON x.server = y.serverid ORDER BY y.authware_enabled, y.position, x.id`)
    const userCache = await sqlPromiseSafe(`SELECT * FROM sequenzia_user_cache`);

    app.set('users', users)
    app.set('userCache', userCache)
    if (!ready)
        printLine("Init", `Initial System Cacahe Complete, Server is now available!`, 'info');
    ready = true;
}
setInterval(app.cacheDatabase, 60000)

app.use('/', routes);
app.use('/app', apps);
app.use('/discord', routesDiscord);
app.use('/upload', routesUpload);
app.use('/acc', routesAccessories);
app.get('/transfer', sessionVerification, catchAsync(async (req, res) => {
    if (req.query.deviceID) {
        const thisUser = res.locals.thisUser || app.get('userCache').rows.filter(e => req.session.userid === e.userid).map(e => e.data)[0];
        if (!thisUser)
            res.status(403).send('User account can not correlated to a valid user!')
        const device = req.query.deviceID
        if (req.session && thisUser.discord && thisUser.discord.user.token) {
            sessionStore.get(device, (error, session1) => {
                if (error) {
                    printLine('SessionTransfer', `Transfer session failed, Can't get active session data- ${error.message}`, 'debug');
                    loginPage(req, res, { authfailedDevice: true, keepSession: true, noQRCode: true });
                } else {
                    let passURL = undefined
                    /* Session Transfer aka GoTo Urls are removed until its be fixed for rare issues */
                    /*if (session1 && session1.goto && session1.goto !== '/' && noSessionTrandferURL.filter(e => session1.goto.startsWith(e)).length === 0) {
                        passURL = session1.goto
                    }
                    if (req.query.type === '1' && !passURL) {
                        passURL = '/ambient'
                        if (session1 && session1.goto && session1.goto !== '' && session1.goto.includes('ambient')) {
                            passURL = session1.goto
                        }
                    }*/

                    sessionStore.set(device, {
                        cookie: { path: '/', httpOnly: true, secure: (config.use_secure_cookie) ? true : undefined, maxAge: null },
                        discord: thisUser.discord,
                        user: thisUser.user,
                        login_source: req.session.login_source,
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
        const thisUser = res.locals.thisUser || app.get('userCache').rows.filter(e => req.session.userid === e.userid).map(e => e.data)[0];
        if (!thisUser)
            res.status(403).send('User account can not correlated to a valid user!')
        if (req.session && thisUser.discord && thisUser.discord.user.token) {
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
                        /* Session Transfer aka GoTo Urls are removed until its be fixed for rare issues */
                        /*if (session1 && session1.goto && session1.goto !== '/' && noSessionTrandferURL.filter(e => session1.goto.startsWith(e)).length === 0) {
                            passURL = session1.goto
                        }
                        if (req.query.type === '1' && !passURL) {
                            passURL = '/ambient'
                            if (session1 && session1.goto && session1.goto !== '' && session1.goto.includes('ambient')) {
                                passURL = session1.goto
                            }
                        }*/

                        sessionStore.set(device, {
                            cookie: {path: '/', httpOnly: true, secure: (config.use_secure_cookie) ? true : undefined, maxAge: null},
                            discord: thisUser.discord,
                            user: thisUser.user,
                            login_source: req.session.login_source,
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
app.get('/static/*', (req, res, next) => {
    const fileUrl = req.url.split('/').slice(2).join('/').split('../').join('')
    if (fs.existsSync(`./custom/${fileUrl}`)) {
        res.sendFile(fileUrl, { root: 'custom/' })
    } else if (fs.existsSync(`./public/static/${fileUrl}`)) {
        res.sendFile(fileUrl, { root: 'public/static/' })
    } else {
        res.status(404).send('')
    }

})
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
