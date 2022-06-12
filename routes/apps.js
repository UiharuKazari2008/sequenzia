const global = require('../config.json')
const express = require('express');
const path = require("path");
//const { sqlSafe, sqlSimple} = require("../js/sqlClient");
//const { sendData } = require('../js/mqAccess')
//const { printLine } = require("../js/logSystem");
const request = require('request').defaults({ encoding: null });
const { sessionVerification, writeValidation } = require('./discord')
const router = express.Router();

function params(_removeParams, _addParams, _url) {
    let _URL = new URL(_url);
    let _params = new URLSearchParams(_URL.search);
    _removeParams.forEach(param => {
        if (_params.has(param)) {
            _params.delete(param);
        }
    })
    _addParams.forEach(param => {
        if (_params.has(param[0])) {
            _params.delete(param[0]);
        }
        _params.set(param[0], encodeURIComponent(decodeURLRecursively(param[1])));
    })
    return `${_URL.pathname}?${_params.toString()}`
}

router.use('/web/*', (req, res, next) => {
    const _url = req.originalUrl.slice(9).split("/");
    const id = _url.shift();
    const url = '/' + _url.join('/');
    console.log(`${id} - ${req.method} - ${url}`)

    const perms = [
        req.session.discord.permissions.read,
        req.session.discord.permissions.write,
        req.session.discord.permissions.manage,
        req.session.discord.permissions.specialPermissions
    ]
    if (global.web_applications[id] && global.web_applications[id].embedded && perms.filter(p => global.web_applications[id].read_roles.indexOf(p) === -1).length > 0) {
        const base_url = global.web_applications[id].url;
        const base_query = (global.web_applications[id].query) ? global.web_applications[id].query : [];

        const new_url = base_url + params([],base_query, `${base_url}${url}`)


        request({
            method: req.method,
            url: new_url,
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
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36 Edg/92.0.902.73',
                'Seq-Perm': (JSON.stringify(req.session.discord.permissions)).toString('base64'),
                'Seq-User': (JSON.stringify(req.session.user)).toString('base64')
            }
        }, async (err, proxyRes, body) => {
            if (err) {
                console.error(err);
                req.status(500).send(err.message);
            } else {
                req.status(proxyRes.status)
            }
        })
        res.status(200).send(new_url);
    } else {
        res.status(404).send('Application with that ID does not exsist!');
    }
})

module.exports = router;
