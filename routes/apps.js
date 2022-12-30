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
    const thisUser = res.locals.thisUser
    const isAuthorised = (thisUser.applications_list.filter(e => e.id === id).length > 0)

    if (global.web_applications[id] && global.web_applications[id].embedded && isAuthorised) {
        res.status(200).render('app_holder', {
            title: global.web_applications[id].name,
            full_title: global.web_applications[id].name,
            call_uri: `/${req.originalUrl.split('/')[1].split('?')[0]}`,
            req_uri: req.protocol + '://' + req.get('host') + req.originalUrl,
            server: thisUser.server_list,
            download: thisUser.discord.servers.download,
            manage_channels: thisUser.discord.channels.manage,
            write_channels: thisUser.discord.channels.write,
            discord: thisUser.discord,
            user: thisUser.user,
            login_source: req.session.login_source,
            webconfig: web,
            albums: (thisUser.albums && thisUser.albums.length > 0) ? thisUser.albums : [],
            artists: (thisUser.artists && thisUser.artists.length > 0) ? thisUser.artists : [],
            theaters: (thisUser.media_groups && thisUser.media_groups.length > 0) ? thisUser.media_groups : [],
            next_episode: thisUser.kongou_next_episode,
            applications_list: thisUser.applications_list,
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

    const thisUser = res.locals.thisUser
    const isAuthorised = (thisUser.applications_list.filter(e => e.id === id).length > 0)

    if (global.web_applications[id] && global.web_applications[id].embedded && isAuthorised) {
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
                'Seq-Perm': (JSON.stringify(thisUser.discord.permissions)).toString('base64'),
                'Seq-User': (JSON.stringify(thisUser.user)).toString('base64'),
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
