const global = require('../config.json');
const config = require('../host.config.json');
const web = require('../web.config.json');
const { printLine } = require("./logSystem");
const { sqlSimple, sqlSafe } = require('../js/sqlClient');
const { sendData } = require('./mqAccess');
const getUrls = require('get-urls');
const moment = require('moment');

module.exports = async (req, res, next) => {

    if (req.query.json && req.query.json === 'true') {
        res.json(res.locals.response)
    } else {
        if (res.locals.response.call_uri === '/artists') {
            res.render('index_artists', res.locals.response);
        } else {
            res.end();
        }
    }
    res.locals.response = undefined;
}
