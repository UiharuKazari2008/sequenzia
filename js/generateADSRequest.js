const {printLine} = require("./logSystem");
const { sqlSimple, sqlPromiseSimple, sqlPromiseSafe } = require('../js/sqlClient');

module.exports = async (req, res, next) => {
    const thisUser = res.locals.thisUser

    if (req.query.device) {
        if (req.query.device.includes('iPad') || req.query.device.includes('Mac') || req.query.device.includes('Tablet') || req.query.device.includes('Desktop')) {
            if (!req.query.ratio) { req.query.ratio = '0.65-1'; }
            if (!req.query.displayname) {
                if (req.query.device.includes('Mac') || req.query.device.includes('Desktop')) {
                    req.query.displayname = `ADSMicro-${req.query.device}`;
                } else {
                    req.query.displayname = `ADSMobile-${req.query.device}`;
                }
            }
        } else if (req.query.device.includes('iPhone') || req.query.device.includes('Phone')) {
            if (!req.query.ratio) { req.query.ratio = '1-3'; }
            if (!req.query.displayname) { req.query.displayname = `ADSMobile-${req.query.device}` }
        }
        next();
    } else if (req.query.displayname) {
        const displayConfig = await sqlPromiseSafe('SELECT * FROM sequenzia_display_config WHERE user = ? AND name = ? LIMIT 1', [thisUser.discord.user.id, req.query.displayname]);
        if (displayConfig && displayConfig.rows.length > 0) {
            const thisConfig = displayConfig.rows[0];
            if (thisConfig.requestOptions) {
                const options = new URLSearchParams(thisConfig.requestOptions.trim());
                options.forEach((value, key) => {
                    req.query[key] = value;
                });
                if (req.query.displaySlave) {
                    req.query.history = undefined;
                }
                if (req.query.wtype && req.query.wtype === 'wide' && req.query.forceWideWidget && req.query.forceWideWidget === 'true') {
                    req.query.ratio = '0.1-.7';
                }

                printLine('ADSRequest', `Generated ADS Request Parameters => "${options.toString()}"`, 'debug')
            }
            next();
        } else {
            next();
        }
    } else if (req.path === '/' || req.path === '/homeImage') {
        const displayConfig = await sqlPromiseSafe('SELECT * FROM sequenzia_display_config WHERE user = ? AND name = ? LIMIT 1', [thisUser.discord.user.id, "Homepage"]);
        if (displayConfig && displayConfig.rows.length > 0) {
            const thisConfig = displayConfig.rows[0];
            if (thisConfig.requestOptions) {
                const options = new URLSearchParams(thisConfig.requestOptions.trim());
                options.forEach((value, key) => {
                    req.query[key] = value;
                });
                if (req.query.displaySlave) {
                    req.query.history = undefined;
                }
                printLine('ADSRequest', `Generated ADS Request Parameters => "${options.toString()}"`, 'debug')
            }

            next();
        } else {
            if (!req.query.numdays)
                req.query.numdays = '30';
            next();
        }
    } else {
        next();
    }
}
