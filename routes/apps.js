const global = require('../config.json')
const express = require('express');
const path = require("path");
//const { sqlSafe, sqlSimple} = require("../js/sqlClient");
//const { sendData } = require('../js/mqAccess')
//const { printLine } = require("../js/logSystem");
const request = require('request').defaults({ encoding: null });
const { sessionVerification, writeValidation } = require('./discord')
const web = require("../web.config.json");
const config = require("../host.config.json");
const ajaxChecker = require("../js/ajaxChecker");
const router = express.Router();

function decodeURLRecursively(uri) {
    while (uri !== decodeURIComponent(uri || '')){
        uri = decodeURIComponent(uri);
    }
    return uri;
}
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

router.use('/launch/*', sessionVerification, ajaxChecker, (req, res, next) => {
    const _url = req.originalUrl.slice(12).split('?')[0].split("/");
    const id = _url.shift();
    console.log(id)

    const perms = [
        req.session.discord.permissions.read,
        req.session.discord.permissions.write,
        req.session.discord.permissions.manage,
        req.session.discord.permissions.specialPermissions
    ]
    if (global.web_applications[id] && global.web_applications[id].embedded && perms.filter(p => global.web_applications[id].read_roles.indexOf(p) === -1).length > 0) {
        res.status(200).render('app_holder', {
            title: global.web_applications[id].name,
            full_title: global.web_applications[id].name,
            call_uri: `/${req.originalUrl.split('/')[1].split('?')[0]}`,
            req_uri: req.protocol + '://' + req.get('host') + req.originalUrl,

            server: req.session.server_list,
            download: req.session.discord.servers.download,
            manage_channels: req.session.discord.channels.manage,
            write_channels: req.session.discord.channels.write,
            discord: req.session.discord,
            user: req.session.user,
            webconfig: web,
            albums: (req.session.albums && req.session.albums.length > 0) ? req.session.albums : [],
            theaters: (req.session.media_groups && req.session.media_groups.length > 0) ? req.session.media_groups : [],
            next_episode: req.session.kongou_next_episode,
            applications_list: req.session.applications_list,
            appData: global.web_applications[id],
            appUrl: `/app/web/${id}`
        })
    } else {
        res.status(404).send('Application with that ID does not exist!');
    }
})
router.use('/web/*', sessionVerification, (req, res, next) => {
    const _url = req.originalUrl.slice(9).split("/");
    const id = (_url.length > 1) ? _url.shift() : _url.shift().split('?')[0];
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


        console.log(new_url)
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
                'Seq-User': (JSON.stringify(req.session.user)).toString('base64'),
                'Seq-BaseURL': req.originalUrl.slice(0,9) + id + '/',
            }
        }, async (err, proxyRes, body) => {
            if (err) {
                console.error(err);
                res.status(500).send(err.message);
            } else {
                Object.keys(proxyRes.headers).map(k => {
                    res.setHeader(k, proxyRes.headers[k])
                })
                res.status(proxyRes.statusCode).send(body)
            }
        })
    } else {
        res.status(404).send('Application with that ID does not exist!');
    }
})

module.exports = router;
