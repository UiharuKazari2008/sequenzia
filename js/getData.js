const global = require('../config.json');
let config = require('../host.config.json');

if (process.env.SYSTEM_NAME && process.env.SYSTEM_NAME.trim().length > 0)
    config.system_name = process.env.SYSTEM_NAME.trim()

let web = require('../web.config.json');
const { printLine } = require("./logSystem");
const { sqlPromiseSafe, sqlPromiseSimple } = require('../js/sqlClient');
const { sendData } = require('./mqAccess');
const getUrls = require('get-urls');
const moment = require('moment');
const useragent = require('express-useragent');
const {md5} = require("request/lib/helpers");
const Discord_CDN_Accepted_Files = ['jpg','jpeg','jfif','png','webp','gif'];
const app = require("../app");
if (web.Base_URL)
    web.base_url = web.Base_URL;


module.exports = async (req, res, next) => {
    let debugTimes = {};
    const source = req.headers['user-agent']
    const ua = (source) ? useragent.parse(source) : undefined
    const page_uri = `/${req.originalUrl.split('/')[1].split('?')[0]}`
    let android_uri = [`server_hostname=${req.headers.host}`]
    let search_prev = ''

    async function writeHistory(title) {
        function params(_removeParams, _addParams, _url, searchOnly) {
            let _params = new URLSearchParams((new URL(req.protocol + '://' + req.get('host') + req.originalUrl)).search);
            _removeParams.forEach(param => {
                if (_params.has(param)) {
                    _params.delete(param);
                }
            })
            _addParams.forEach(param => {
                if (_params.has(param[0])) {
                    _params.delete(param[0]);
                }
                _params.append(param[0], param[1]);
            })
            return req.originalUrl.split('?')[0] + `?${_params.toString()}`

        }

        const cleanURL = params(['nsfwEnable', 'pageinatorEnable', 'limit', 'responseType', 'key', 'blind_key', 'offset', 'nocds', 'setscreen','reqCount', '_', '_h'], [])
        await sqlPromiseSafe(`INSERT INTO sequenzia_navigation_history SET ? ON DUPLICATE KEY UPDATE date = CURRENT_TIMESTAMP`, {
            index: `${req.session.discord.user.id}-${md5(cleanURL)}`,
            uri: cleanURL,
            title: title,
            user: req.session.discord.user.id
        })
        await sqlPromiseSafe(`DELETE a FROM sequenzia_navigation_history a LEFT JOIN (SELECT \`index\` AS keep_index, date FROM sequenzia_navigation_history WHERE user = ? AND saved = 0 ORDER BY date DESC LIMIT ?) b ON (a.index = b.keep_index) WHERE b.keep_index IS NULL AND a.user = ? AND saved = 0;`, [req.session.discord.user.id, 50, req.session.discord.user.id])
    }

    console.log(req.query);

    if (!req.session.discord) {
        res.locals.response = {
            search_prev: search_prev,
            banners: ['noRights'],
            manage_channels: req.session.discord.channels.manage,
            write_channels: req.session.discord.channels.write,
            discord: req.session.discord,
            user: req.session.user,
            device: ua
        };
        console.error('No Session Data')
        next();
    } else {
        let multiChannel = false;
        let multiClass = false;
        let multiChannelBase = false;
        let hideChannels = true;
        let selectedServer = 0;
        let selectedChannel = 0;

        let execute = '';
        let sqlquery = [];
        let sqlorder = [];
        let sqlFavJoin = 'LEFT OUTER JOIN';
        let sqlFavWhere = [];
        let sqlHistoryJoin = 'LEFT OUTER JOIN';
        let sqlHistoryWhere = [
            `user = '${req.session.discord.user.id}'`
        ];
        let sqlHistorySort = 'eid';
        let sqlHistoryWherePost = '';
        let sqlAlbumWhere = '';
        let enablePrelimit = true;
        let sqlAlbumQueryStart = '';
        let sqlAlbumQueryEnd = '';
        let limit = 1;
        let offset = 0;

        let _dn = 'Untitled'
        if (req.query.displayname) {
            _dn = `${req.query.displayname}`
        } else if (!page_uri.includes('ambient') || !page_uri.includes('ads') || !page_uri.includes('/gallery') || !page_uri.includes('/files') || !page_uri.includes('/cards')) {
            _dn = 'Homepage'
        } else if (req.query && req.query.history && req.query.history === 'none') {
            _dn = 'PageResults'
        }

        debugTimes.build_query = new Date();
        // Main Query
        let baseQ = ''
        let addSearchTerm = [];
        if (req.query.channel && req.query.channel === 'random') {
            multiChannel = true;
        } else if (req.query.vchannel) {
            multiChannel = true;
            hideChannels = false;
            let _ch = req.query.vchannel.split(' ')
            if (_ch.length > 1) {
                let _andStat = []
                _ch.forEach((c) => {
                    _andStat.push(`virtual_channel_eid = '${c}'`)
                })
                baseQ += `(${_andStat.join(' OR ')}) AND`;
            } else {
                baseQ += `virtual_channel_eid = ${req.query.vchannel} AND `;
            }
        } else if (req.query.channel && req.query.channel !== 'random') {
            let _ch = req.query.channel.split(' ')
            if (_ch.length > 1) {
                let _andStat = []
                _ch.forEach((c) => {
                    _andStat.push(`channelid = '${c}'`)
                })
                baseQ += `(${_andStat.join(' OR ')}) AND`;
                multiChannel = true;
            } else {
                baseQ += `channelid = ${req.query.channel} AND `;
            }
            hideChannels = false;
        } else if (req.query.folder) {
            const _ch = req.query.folder.trim().split(' ').filter(e => e.length > 0)
            let _andStat = []
            _ch.forEach((_c) => {
                let fsv = undefined;
                let fcl = undefined;
                let fch = undefined;
                let c = [];
                if (_c.includes('/')) {
                    // If JFS 2.X Path
                    c = _c.split(':/').filter(e => e.length > 0).join('/')
                        .split(':').filter(e => e.length > 0).join('/')
                        .split('/').filter(e => e.length > 0)
                } else {
                    // If JFS 1.0 Path
                    c = _c.split(':').filter(e => e.length > 0);
                }

                if (c.length > 0) {
                    // If server is name is present
                    let _os = 0;
                    if (!isNaN(parseInt(c[c.length - 1]))) {
                        const __id = c.pop()
                        addSearchTerm.push(`eid:${__id}`);
                    }
                    if (c.length === 3) {
                        if (c.length >= 1 && c[0] !== "*") {
                            fsv = c[0];
                        }
                        _os = 1;
                    }
                    // If more parts of there
                    if (c.length >= 1) {
                        // Get class
                        fcl = c[_os];
                        // Get Channel
                        if (c.length - _os === 2) {
                            fch = c[1 + _os];
                        }
                    }

                    let _q = [];
                    // Extract Servers
                    if (fsv) {
                        let _svAND = [];
                        // Parse Server ID or Short Name
                        fsv.trim().split('~').filter(e => e.length > 0).forEach(e => {
                            if (!isNaN(parseInt(e.toString()))) {
                                _svAND.push(`serverid = '${e}'`);
                                selectedServer++;
                            } else if (e !== "*") {
                                _svAND.push(`LOWER(server_short_name) = LOWER('${e}')`);
                                selectedServer++;
                            }
                        })
                        if (_svAND.length > 0) {
                            _q.push(`(${_svAND.join(' OR ')})`)
                        }
                    }
                    // Extract Classes
                    if (fcl) {
                        let _svAND = [];
                        fcl.trim().split('~').filter(e => e.length > 0).forEach(e => {
                            if (e !== "*") {
                                _svAND.push(`LOWER(classification) = LOWER('${e}')`);
                            }
                        })
                        if (_svAND.length > 0) {
                            _q.push(`(${_svAND.join(' OR ')})`)
                            if (_svAND.length > 1) {
                                multiClass = true;
                            }
                        }
                    }
                    // Parse Channels
                    if (fch) {
                        let _svAND = [];
                        fch.trim().split('~').filter(e => e.length > 0).forEach(e => {
                            if (!isNaN(parseInt(e.toString()))) {
                                _svAND.push(`channelid = '${e}'`)
                                selectedChannel++;
                                hideChannels = false;
                            } else if (e.includes('virt_')) {
                                _svAND.push(`virtual_channel_eid = '${e.split('virt_').pop()}'`)
                            } else if (e !== '*') {
                                _svAND.push(`LOWER(channel_short_name) = LOWER('${e}')`)
                                selectedChannel++;
                                hideChannels = false;
                            } else if (e === '*') {
                                multiChannel = true;
                                multiChannelBase = true;
                            }
                        })
                        if (_svAND.length > 0) {
                            _q.push(`(${_svAND.join(' OR ')})`)
                            if (_svAND.length > 1) {
                                multiChannel = true;
                            }
                        }
                    } else {
                        multiChannel = true;
                        multiChannelBase = true;
                    }
                    // Generate Complete Query
                    if (_q.length >= 1) {
                        _andStat.push(`(${_q.join(" AND ")})`)
                    }
                }
            })
            // Merge all requests into a single query
            if (_andStat.length > 0) {
                baseQ += `(${_andStat.join(' OR ')}) AND `;
                if (_andStat.length > 1) {
                    multiChannel = true
                }
            }
        } else {
            multiChannel = true;
        }
        if (req.query.nsfwEnable && req.query.nsfwEnable === 'true') {
            req.session.nsfwEnabled = true
        } else if (req.query.nsfwEnable && req.query.nsfwEnable === 'false') {
            req.session.nsfwEnabled = false
        }
        if (req.query.pageinatorEnable && req.query.pageinatorEnable === 'true') {
            req.session.pageinatorEnable = true;
        } else if (req.query.pageinatorEnable && req.query.pageinatorEnable === 'false') {
            req.session.pageinatorEnable = false;
        } else if (typeof req.session.pageinatorEnable === 'undefined') {
            req.session.pageinatorEnable = true;
        }

        // Pinned
        let pinsUser = `${req.session.discord.user.id}`
        if (req.query && req.query.pins && req.query.pins === 'true') {
            sqlFavJoin = 'INNER JOIN'
            android_uri.push('pins=true');
            enablePrelimit = false;
        } else if (req.query && req.query.pins && req.query.pins === 'false') {
            sqlFavJoin = 'LEFT OUTER JOIN'
            sqlFavWhere.push('fav_date IS NULL')
            android_uri.push('pins=false');
            enablePrelimit = false;
        } else if (req.query && req.query.pins) {
            sqlFavJoin = 'INNER JOIN'
            pinsUser = `${req.query.pins}`
            android_uri.push(`pins=${req.query.pins}`);
            enablePrelimit = false;
        }
        // Show only Cached
        if (req.query && req.query.cached && req.query.cached === 'true') {
            sqlquery.push('((fileid IS NOT NULL AND filecached = 1) OR fileid IS NULL)')
        }

        // History
        if (req.query && req.query.history && req.query.history === 'only') {
            hideChannels = false;
            sqlHistoryJoin = 'INNER JOIN'
            android_uri.push('history=only');
            enablePrelimit = false;
        } else if (req.query && req.query.history && req.query.history === 'none') {
            hideChannels = false;
            sqlHistoryJoin = 'LEFT OUTER JOIN'
            sqlHistoryWherePost = ' WHERE history_date IS NULL'
            android_uri.push('history=none');
            enablePrelimit = false;
        }
        if (_dn !== '*') {
            sqlHistoryWhere.push( `name = '${_dn.replace(/'/g, '\\\'')}'`)
        }
        if (req.query && req.query.history_screen) {
            sqlHistoryWhere.push( `screen = '${req.query.history_screen.replace(/'/g, '\\\'')}'`)
        }
        // Sorting
        if (req.query && req.query.newest && req.query.newest === 'true') {
            sqlorder = [`date`, 'DESC']
        } else if (page_uri === '/' || page_uri === '/homeImage' || page_uri === '/home' || page_uri === '/start' || page_uri === '/ads-micro' || page_uri === '/ads-widget' || page_uri.startsWith('/ambient')) {
            if (!req.query.displaySlave) {
                sqlorder.push(`RAND()`)
            } else {
                sqlorder.push('history_date');
                sqlorder.push('DESC')
                sqlHistoryJoin = 'INNER JOIN';
                sqlHistorySort = 'history_date DESC'
            }
            enablePrelimit = false;
        } else {
            let sortPreset = false;
            if (req.query.sort === 'random') {
                sqlorder.push(`RAND()`)
            } else if (req.query.sort === 'name') {
                sqlorder.push('attachment_name')
            } else if (req.query.sort === 'file') {
                sqlorder.push('real_filename')
            } else if (req.query.sort === 'content') {
                sqlorder.push('content')
            } else if (req.query.sort === 'date') {
                sqlorder.push('date')
            } else if (req.query.sort === 'fav') {
                sqlorder.push('fav_date');
                sqlFavJoin = 'INNER JOIN';
                enablePrelimit = false;
            } else if (req.query.sort === 'album') {
                sqlorder.push('album_add_date');
                enablePrelimit = false;
            } else if (req.query.sort === 'history') {
                sqlorder.push('history_date');
                sqlHistoryJoin = 'INNER JOIN';
                enablePrelimit = false;
            } else if (req.query.sort === 'size') {
                sqlorder.push('filesize')
            } else if (req.query.sort === 'id') {
                sqlorder.push('id')
            } else if (req.query.sort === 'eid') {
                sqlorder.push('eid')
            } else if (page_uri === '/listTheater' || req.query.show_id || req.query.group) {
                enablePrelimit = false;
                sortPreset = true;
                if (req.query.watch_history === 'only') {
                    sqlorder.push('watched_date DESC');
                } else if (req.query.show_id === 'unmatched') {
                    sqlorder.push('real_filename ASC, attachment_name ASC');
                } else {
                    sqlorder.push('season_num ASC, episode_num ASC');
                }
            } else {
                sqlorder.push('date')
            }
            if (!sortPreset && req.query.reverse === 'true' && req.query.sort !== 'random') {
                sqlorder.push('ASC')
            } else if (!sortPreset && req.query.sort !== 'random') {
                sqlorder.push('DESC')
            }
        }
        sqlorder = sqlorder.join(' ');
        // Search
        function getAND(i) {
            return i.split(' AND ')
        }
        function getOR(i) {
            return i.split(' OR ')
        }
        function getType(i) {
            let _id = i;
            if (_id.startsWith('id:')) {
                _id = i.split('id:')[1];
                if (_id.startsWith('st:')) {
                    _id = _id.split('st:')[1]
                    return `kanmi_records.id LIKE '${_id}%'`
                } else if (_id.startsWith('ed:')) {
                    _id = _id.split('ed:')[1]
                    return `kanmi_records.id LIKE '%${_id}'`
                } else {
                    return `kanmi_records.id LIKE '%${_id}%'`
                }
            } else if (i.startsWith('eid:')) {
                _id = i.split('eid:')[1];
                if (_id.startsWith('st:')) {
                    _id = _id.split('st:')[1]
                    return `kanmi_records.eid LIKE '${_id}%'`
                } else if (_id.startsWith('ed:')) {
                    _id = _id.split('ed:')[1]
                    return `kanmi_records.eid LIKE '%${_id}'`
                } else if (_id.startsWith('gt:')) {
                    _id = _id.split('gt:')[1]
                    return `kanmi_records.eid >= '${_id}'`
                } else if (_id.startsWith('lt:')) {
                    _id = _id.split('lt:')[1]
                    return `kanmi_records.eid <= '${_id}'`
                } else {
                    return `kanmi_records.eid = '${_id}'`
                }
            } else if (i.startsWith('artist:')) {
                _id = i.split('artist:')[1];
                return '('+ [
                    `kanmi_records.attachment_name LIKE  '%${_id}-%'`,
                    `kanmi_records.real_filename LIKE  '%${_id}-%'`,
                    `kanmi_records.attachment_name LIKE  '%${_id}_%'`,
                    `kanmi_records.real_filename LIKE  '%${_id}_%'`,
                    `kanmi_records.content_full LIKE '%${_id}%'`
                ].join(' OR ') + ')';
            } else if (i.startsWith('text:')) {
                _id = i.split('text:')[1];
                if (_id.startsWith('st:')) {
                    _id = _id.split('st:')[1]
                    return `kanmi_records.content_full LIKE '${_id}%'`
                } else if (_id.startsWith('ed:')) {
                    _id = _id.split('ed:')[1]
                    return `kanmi_records.content_full LIKE '%${_id}'`
                } else {
                    return `kanmi_records.content_full LIKE '%${_id}%'`
                }
            } else if (i.startsWith('!text:')) {
                _id = i.split('!text:')[1];
                if (_id.startsWith('st:')) {
                    _id = _id.split('st:')[1]
                    return `kanmi_records.content_full NOT LIKE '${_id}%'`
                } else if (_id.startsWith('ed:')) {
                    _id = _id.split('ed:')[1]
                    return `kanmi_records.content_full NOT LIKE '%${_id}'`
                } else {
                    return `kanmi_records.content_full NOT LIKE '%${_id}%'`
                }
            } else if (i.startsWith('name:')) {
                _id = i.split('name:')[1];
                if (_id.startsWith('st:')) {
                    _id = _id.split('st:')[1]
                    return `(kanmi_records.attachment_name LIKE '${_id}%' OR kanmi_records.real_filename LIKE '${_id}%')`
                } else if (_id.startsWith('ed:')) {
                    _id = _id.split('ed:')[1]
                    return `(kanmi_records.attachment_name LIKE '%${_id}' OR kanmi_records.real_filename LIKE '%${_id}')`
                } else {
                    return `(kanmi_records.attachment_name LIKE '%${_id}%' OR kanmi_records.real_filename LIKE '%${_id}%')`
                }
            } else if (i.startsWith('full:')) {
                _id = _id.split('full:')[1];
                return [ `kanmi_records.content_full LIKE '%${_id}%'`,
                        `kanmi_records.attachment_name LIKE '%${_id}%'`,
                        `kanmi_records.real_filename LIKE '%${_id}%'`,
                        `kanmi_records.id LIKE '${_id}%'`].join(' OR ')
            } else {
                let _sh = []
                _id.split(' ').forEach(e =>
                    _sh.push('(' + [ `kanmi_records.content_full LIKE '%${e}%'`,
                        `kanmi_records.attachment_name LIKE '%${e}%'`,
                        `kanmi_records.real_filename LIKE '%${e}%'`,
                        `kanmi_records.id LIKE '${e}%'`].join(' OR ') + ')')
                )
                return _sh.join(' OR ')
            }
        }
        if (addSearchTerm.length > 0) {
            sqlquery.push('( ' + addSearchTerm.map(e => '( ' + getType(e) + ' )').join(' AND ') + ' )')
        }
        if ( req.query.search !== undefined && req.query.search !== '' ) {
            search_prev = req.query.search
            hideChannels = false;
            if (addSearchTerm.length > 0)
                sqlquery.push(' AND ')
            if ( search_prev.includes(' AND ') ) {
                sqlquery.push('( ' + getAND(search_prev).map(a => '( ' + getOR(a).map( b => '( ' + getType(b) + ' )' ).join(' OR ') + ' )' ).join(' AND ') + ' )')
            } else if ( search_prev.includes(' OR ') ) {
                sqlquery.push('( ' + getOR(search_prev).map( b => '( ' + getType(b) + ' )' ).join(' OR ') + ' )')
            } else {
                sqlquery.push('( ' + getType(search_prev) + ' )')
            }
            android_uri.push(`search=${req.query.search}`);
        }
        // Flagged
        if (req.query.flagged === 'true') {
            sqlquery.push(`flagged = 1`);
        }
        // Date Ranging
        if (req.query.datestart && req.query.dateend) {
            if (req.query.dateend === req.query.datestart) {
                sqlquery.push(`date BETWEEN '${req.query.datestart} 00:00:00' AND '${req.query.dateend} 23:59:59'`);
            } else {
                sqlquery.push(`date BETWEEN '${req.query.datestart}' AND '${req.query.dateend}'`);
            }

        } else if (req.query.history_numdays) {
            const numOfDays = parseInt(req.query.history_numdays)
            if (!isNaN(numOfDays) && numOfDays >= 2 && numOfDays <= 1000) {
                sqlHistoryWhere.push(`date >= NOW() - INTERVAL ${numOfDays} DAY`);
                android_uri.push(`history_numdays=${numOfDays}`);
            }
        }  else if (req.query.fav_numdays) {
            const numOfDays = parseInt(req.query.fav_numdays)
            if (!isNaN(numOfDays) && numOfDays >= 2 && numOfDays <= 1000) {
                sqlFavWhere.push(`fav_date >= NOW() - INTERVAL ${numOfDays} DAY`);
                android_uri.push(`fav_numdays=${numOfDays}`);
            }
        } else if (req.query.numdays) {
            const numOfDays = parseInt(req.query.numdays)
            if (!isNaN(numOfDays) && numOfDays >= 2 && numOfDays <= 1000) {
                sqlquery.push(`date >= NOW() - INTERVAL ${numOfDays} DAY`);
                android_uri.push(`numdays=${numOfDays}`);
            }
        } else if (page_uri === '/' || page_uri === '/homeImage' || page_uri === '/home' || page_uri === '/start') {
            sqlquery.push(`date >= NOW() - INTERVAL 360 DAY`);
            android_uri.push(`numdays=360`);
        }
        // Ratio
        if (req.query.ratio) {
            const _ratio = req.query.ratio.split('-');
            if (_ratio.length > 1) {
                const lessThanRatio = parseFloat(_ratio[0]);
                const greaterThanRatio = parseFloat(_ratio[1]);
                if (!isNaN(lessThanRatio) && !isNaN(greaterThanRatio)) {
                    sqlquery.push(`sizeR BETWEEN '${lessThanRatio}' AND '${greaterThanRatio}'`)
                }
            } else {
                const thisRatio = parseFloat(_ratio[0]);
                if (!isNaN(thisRatio)) {
                    sqlquery.push(`sizeR = ${thisRatio}`)
                }
            }
            android_uri.push(`ratio=${req.query.ratio}`);
        }
        // Image Resolution
        if (req.query.minres) {
            const thisResolution = parseInt(req.query.minres);
            if (req.query.ratio && !isNaN(thisResolution)) {
                const _ratio = req.query.ratio.split('-');
                if (_ratio.length > 1) {
                    const lessThanRatio = parseFloat(_ratio[0]);
                    const greaterThanRatio = parseFloat(_ratio[1]);
                    if (!isNaN(lessThanRatio) && !isNaN(greaterThanRatio)) {
                        if (lessThanRatio >= 1) {
                            sqlquery.push(`sizeH >= ${thisResolution}`)
                        }
                        if (greaterThanRatio >= 1) {
                            sqlquery.push(`sizeW >= ${thisResolution}`)

                        }
                    }
                } else {
                    const thisRatio = parseFloat(_ratio[0]);
                    if (thisRatio >= 1) {
                        sqlquery.push(`sizeH >= ${thisResolution}`)
                    } else {
                        sqlquery.push(`sizeW >= ${thisResolution}`)

                    }
                }
            } else if (!isNaN(thisResolution)) {
                sqlquery.push('(' + [
                    '(' + [
                        `sizeW >= ${thisResolution}`,
                        `sizeR <= 1`,
                    ].join(' AND ') + ')',
                    '(' + [
                        `sizeH >= ${thisResolution}`,
                        `sizeR >= 1`,
                    ].join(' AND ') + ')'
                ].join(' OR ') + ')')
            }
            android_uri.push(`minres=${req.query.minres}`);
        } else {
            if (req.query.minhres) {
                const thisResolution = parseInt(req.query.minhres);
                if (!isNaN(thisResolution)) {
                    sqlquery.push(`sizeH >= ${thisResolution}`)
                }
                android_uri.push(`minhres=${req.query.minhres}`);
            }
            if (req.query.minwres) {
                const thisResolution = parseInt(req.query.minwres);
                if (!isNaN(thisResolution)) {
                    sqlquery.push(`sizeW >= ${thisResolution}`)

                }
                android_uri.push(`minwres=${req.query.minwres}`);
            }
        }
        // Color
        if (req.query.color && typeof req.query.color === 'string' && req.query.color.includes(':')) {
            const thisColorRange = req.query.color.split(':');
            if (thisColorRange.length >= 3) {
                const thisColorR = thisColorRange[0].split('-');
                const thisColorG = thisColorRange[1].split('-');
                const thisColorB = thisColorRange[2].split('-');
                if (thisColorR.length === 2 && thisColorG.length === 2 && thisColorB.length === 2) {
                    let colorRangeSelection = [];
                    if (thisColorR[0] !== thisColorR[1]) {
                        colorRangeSelection.push(`colorR BETWEEN '${thisColorR[0]}' AND '${thisColorR[1]}'`);
                    } else {
                        colorRangeSelection.push(`colorR = '${thisColorR[0]}'`);
                    }
                    if (thisColorG[0] !== thisColorG[1]) {
                        colorRangeSelection.push(`colorG BETWEEN '${thisColorG[0]}' AND '${thisColorG[1]}'`);
                    } else {
                        colorRangeSelection.push(`colorG = '${thisColorG[0]}'`);
                    }
                    if (thisColorB[0] !== thisColorB[1]) {
                        colorRangeSelection.push(`colorB BETWEEN '${thisColorB[0]}' AND '${thisColorB[1]}'`);
                    } else {
                        colorRangeSelection.push(`colorB = '${thisColorB[0]}'`);
                    }
                    sqlquery.push('( ' + colorRangeSelection.join(' AND ') + ' )')
                    android_uri.push(`color=${req.query.color}`);
                } else if (thisColorR.length > 0 && thisColorG.length > 0 && thisColorB.length > 0) {
                    const colorRInt = parseInt(thisColorR[0]);
                    const colorGInt = parseInt(thisColorG[0]);
                    const colorBInt = parseInt(thisColorB[0]);
                    let colorStep
                    let colorEmphasis = [0,0,0]
                    if (thisColorRange.length >= 4) {
                        colorStep = parseInt(thisColorRange[3]);
                    } else {
                        colorStep = 16
                    }
                    if (thisColorRange.length >= 5) {
                        switch (thisColorRange[4]) {
                            case '0':
                                colorEmphasis = [colorStep * 2, 0, 0];
                                colorStep = (colorStep/1.5).toFixed(0)
                                break;
                            case '1':
                                colorEmphasis = [colorStep * 2, (colorStep * 1.5).toFixed(0), 0];
                                colorStep = (colorStep/1.5).toFixed(0)
                                break;
                            case '2':
                                colorEmphasis = [colorStep * 2, colorStep * 2, 0];
                                colorStep = (colorStep/1.5).toFixed(0)
                                break;
                            case '3':
                                colorEmphasis = [0, colorStep * 2, 0];
                                colorStep = (colorStep/1.5).toFixed(0)
                                break;
                            case '4':
                                colorEmphasis = [(colorStep * 1.5).toFixed(0), colorStep * 2, (colorStep * 1.5).toFixed(0)];
                                colorStep = (colorStep/1.5).toFixed(0)
                                break;
                            case '5':
                                colorEmphasis = [0, colorStep * 2, colorStep * 2];
                                colorStep = (colorStep/1.5).toFixed(0)
                                break;
                            case '6':
                                colorEmphasis = [0, (colorStep * 1.5).toFixed(0), colorStep * 2];
                                colorStep = (colorStep/1.5).toFixed(0)
                                break;
                            case '7':
                                colorEmphasis = [0, 0, colorStep * 2];
                                colorStep = (colorStep/1.5).toFixed(0)
                                break;
                            case '8':
                                colorEmphasis = [(colorStep * 1.5).toFixed(0), 0, colorStep * 2];
                                colorStep = (colorStep/1.5).toFixed(0)
                                break;
                            case '9':
                                colorEmphasis = [colorStep * 2, 0, colorStep * 2];
                                colorStep = (colorStep/1.5).toFixed(0)
                                break;
                        }
                    }

                    let colorRangeSelection = [];
                    if (!isNaN(colorRInt)) {
                        colorRangeSelection.push(`colorR BETWEEN '${Math.abs(colorRInt - colorStep) - colorEmphasis[0]}' AND '${(colorRInt + colorStep) + colorEmphasis[0]}'`);
                    }
                    if (!isNaN(colorGInt)) {
                        colorRangeSelection.push(`colorG BETWEEN '${Math.abs(colorGInt - colorStep) - colorEmphasis[1]}' AND '${(colorGInt + colorStep) + colorEmphasis[1]}'`);
                    }
                    if (!isNaN(colorBInt)) {
                        colorRangeSelection.push(`colorB BETWEEN '${Math.abs(colorBInt - colorStep) - colorEmphasis[2]}' AND '${(colorBInt + colorStep) + colorEmphasis[2]}'`);
                    }
                    sqlquery.push('( ' + colorRangeSelection.join(' AND ') + ' )');

                    android_uri.push(`color=${req.query.color}`);
                }
            }
        }
        if (req.query.dark) {
            if (req.query.dark === 'true') {
                sqlquery.push(`dark_color = 1`)
                android_uri.push(`brightness=2`);
            } else if (req.query.dark === 'false') {
                sqlquery.push(`dark_color = 0`)
                android_uri.push(`brightness=1`);
            }
        } else {
            android_uri.push(`brightness=0`);
        }
        if (req.query.show_id && !isNaN(parseInt(req.query.show_id))) {
            sqlquery.push(`kongou_shows.show_id = ${parseInt(req.query.show_id)}`)
        }
        if (req.query.group) {
            sqlquery.push(`${req.session.cache.channels_view}.media_group = '${req.query.group}' AND ${req.session.cache.channels_view}.media_group = kongou_media_groups.media_group`)
        }
        if (page_uri === '/listTheater' || req.query.show_id || req.query.group) {
            multiChannel = true;
            hideChannels = false;
        }
        // Limit
        if (req.query.num) {
            const _limit = parseInt(req.query.num);
            if (!isNaN(limit)) {
                limit = _limit;
            }
        } else if (req.query.show_id || req.query.group || req.query.watch_history === 'none') {
            limit = 100000;
        } else if (page_uri === '/ambient-get') {
            limit = 1;
            enablePrelimit = false;
        } else if (req.query.responseType) {
            limit = 1000;
            enablePrelimit = false;
        } else if (req.query.limit && !isNaN(parseInt(req.query.limit))) {
            limit = parseInt(req.query.limit.toString().substring(0,4))
            if (!isNaN(limit)) {
                req.session.current_limit = limit;
            } else if (page_uri === '/files') {
                limit = 250;
            } else {
                limit = 100;
            }
        } else if (!(page_uri === '/' || page_uri === '/homeImage' || page_uri === '/home' || page_uri === '/start' || page_uri === '/ads-micro' || page_uri === '/ads-widget' || page_uri.startsWith('/ambient'))) {
            if ( req.session.current_limit ) {
                limit = req.session.current_limit;
            } else if (page_uri === '/files') {
                limit = 250;
            } else {
                limit = 100;
            }
        }
        const sqllimit = limit + 1;
        // Offset
        if (!(page_uri === '/' || page_uri === '/homeImage' || page_uri === '/home' || page_uri === '/start' || page_uri === '/ads-micro' || page_uri === '/ads-widget' || page_uri.startsWith('/ambient')) && req.query.offset && !isNaN(parseInt(req.query.offset.toString()))) {
            offset = parseInt(req.query.offset.toString().substring(0,6))
        }
        if (req.query.album) {
            hideChannels = false;
        }
        // Where Exec
        if (req.session.disabled_channels && req.session.disabled_channels.length > 0 && hideChannels) {
            baseQ += '( ' + req.session.disabled_channels.map(e => `channel_eid != '${e}'`).join(' AND ') + ` ) AND ${req.session.cache.channels_view}.media_group IS NULL AND `
        } else if (hideChannels) {
            baseQ += `( ${req.session.cache.channels_view}.media_group IS NULL ) AND `
        }
        let channelFilter = `${baseQ}`
        if (req.query.album) {
            enablePrelimit = false;
            sqlAlbumWhere = req.query.album.split(' ').map(e => `sequenzia_albums.aid = '${e}'`).join(' OR ');
            android_uri.push(`album=${req.query.album}`);
            channelFilter += `( channel_nsfw = 1 OR channel_nsfw = 0 )`;
        } else if ((req.query.nsfw && req.query.nsfw === 'true') || (req.session.nsfwEnabled && req.session.nsfwEnabled === true) || req.query.group) {
            channelFilter += `( channel_nsfw = 1 OR channel_nsfw = 0 )`;
            android_uri.push('nsfw=true');
        } else if (req.query.nsfw && req.query.nsfw === 'only') {
            channelFilter += `( channel_nsfw = 1 )`;
            android_uri.push('nsfw=only');
        } else {
            channelFilter += `( channel_nsfw = 0 )`;
        }
        if (page_uri === '/gallery' || page_uri === '/listTheater') {
            sqlquery.push(`(attachment_hash IS NOT NULL OR filecached = 1)`)
            execute = '(' + [
                channelFilter,
                `(${[
                    '(' + [
                        '(' + [
                            "cache_proxy LIKE '%-t9-preview-video.jp%_'",
                            "cache_proxy LIKE '%-t9-preview-video.gif'",
                            "cache_proxy LIKE '%-t9-preview-video.gifv'"
                        ].join(' OR ') + ')',
                        '(' + [
                            "real_filename LIKE '%.mp4'",
                            "real_filename LIKE '%.mov'",
                            "real_filename LIKE '%.m4v'",
                        ].join(' OR ') + ')',
                        "attachment_extra IS NULL"
                    ].join(' AND ') + ')',
                    '(' + [
                        '(' + [
                            "cache_proxy LIKE '%-t9-preview-video.jp%_'",
                            "cache_proxy LIKE '%-t9-preview-video.gif'",
                            "cache_proxy LIKE '%-t9-preview-video.gifv'"
                        ].join(' OR ') + ')',
                        '(' + [
                            "attachment_name LIKE '%.mp4'",
                            "attachment_name LIKE '%.mov'",
                            "attachment_name LIKE '%.m4v'",
                        ].join(' OR ') + ')',
                        "attachment_extra IS NULL"
                    ].join(' AND ') + ')',
                    "attachment_name LIKE '%.jp%_'",
                    "attachment_name LIKE '%.jfif'",
                    "attachment_name LIKE '%.png'",
                    "attachment_name LIKE '%.gif'",
                    "attachment_name LIKE '%.web%_'",
                    "attachment_name = 'multi'",
                ].join(' OR ')})`
            ].join(' AND ')
        } else if (page_uri === '/' || page_uri === '/homeImage' || page_uri === '/home' || page_uri === '/start' || page_uri === '/ads-micro' || page_uri === '/ads-widget' || page_uri.startsWith('/ambient')) {
            sqlquery.push(`(attachment_hash IS NOT NULL OR filecached = 1)`)
            execute = '(' + [
                channelFilter,
                `(${[
                    "attachment_name LIKE '%.jp%_'",
                    "attachment_name LIKE '%.jfif'",
                    "attachment_name LIKE '%.png'",
                    "attachment_name LIKE '%.gif'",
                    "attachment_name LIKE '%.web%_'",
                ].join(' OR ')})`
            ].join(' AND ')
        } else if (page_uri === '/files') {
            if (req.query.filesonly) {
                execute = '(' + [
                    channelFilter,
                    '(' + [
                        '(' + [
                            "fileid IS NULL",
                            "attachment_name IS NOT NULL",
                            "attachment_name NOT LIKE '%.jp%_'",
                            "attachment_name NOT LIKE '%.jfif'",
                            "attachment_name NOT LIKE '%.png'",
                            "attachment_name NOT LIKE '%.gif'",
                            "attachment_name NOT LIKE '%.web%_'",
                            "attachment_name != 'multi'"
                        ].join(' AND ') + ')',
                        '(' + [
                            "fileid IS NOT NULL",
                            "real_filename NOT LIKE '%.jp%_'",
                            "real_filename NOT LIKE '%.jfif'",
                            "real_filename NOT LIKE '%.png'",
                            "real_filename NOT LIKE '%.gif'",
                            "real_filename NOT LIKE '%.web%_'",
                        ].join(' AND ') + ')'
                    ].join(' OR ') + ')'
                ].join(' AND ')

            } else {
                execute = '(' + [
                    channelFilter,
                    `( real_filename IS NOT NULL OR ( real_filename IS NULL AND attachment_hash IS NOT NULL ))`
                ].join(' AND ')
            }
        } else if (page_uri === '/cards') {
            execute = `(${channelFilter}`
        }
        //  Finalization
        if (sqlquery.length > 0) {
            execute += ` AND (${sqlquery.join(' AND ')}))`
        } else {
            execute += ')'
        }
        let sqlFields, sqlTables, sqlWhere
        sqlFields = [
            'kanmi_records.*',
            `${req.session.cache.channels_view}.*`
        ];
        const sqlAlbumFields = [
            'sequenzia_album_items.eid',
            'sequenzia_albums.privacy AS album_privacy',
            'sequenzia_albums.owner AS album_owner',
            'sequenzia_album_items.date AS album_add_date',
            'sequenzia_albums.name AS album_name'
        ].join(', ')
        sqlTables = [
            'kanmi_records',
            req.session.cache.channels_view
        ];
        sqlWhere = [
            `kanmi_records.channel = ${req.session.cache.channels_view}.channelid`
        ];

        if (page_uri === '/listTheater' || req.query.show_id || req.query.group) {
            // SELECT * FROM kanmi_records, kongou_episodes, kongou_shows, kongou_media_groups WHERE (kanmi_records.eid = kongou_episodes.eid AND kongou_episodes.show_id = kongou_shows.show_id AND kongou_shows.media_group = kongou_media_groups.media_group)
            if (req.query.show_id !== 'unmatched') {
                sqlFields.push(...[
                    'kongou_episodes.season_num',
                    'kongou_episodes.episode_num',
                    'kongou_episodes.show_id',

                    'kongou_shows.name AS show_name',
                    'kongou_shows.original_name AS show_original_name',
                    'kongou_shows.nsfw AS show_nsfw',
                    'kongou_shows.subtitled AS show_subtitled',
                    'kongou_shows.background AS show_background',
                    'kongou_shows.poster AS show_poster',

                    'kongou_media_groups.type AS group_type',
                    'kongou_media_groups.name AS group_name',
                    'kongou_media_groups.description AS group_description',
                    'kongou_media_groups.icon AS group_icon',
                    'kongou_media_groups.adult AS group_nsfw',
                ])
                sqlTables.push(...[
                    'kongou_episodes',
                    'kongou_shows',
                    'kongou_media_groups'
                ])
                sqlWhere.push(...[
                    'kanmi_records.eid = kongou_episodes.eid',
                    'kongou_episodes.show_id = kongou_shows.show_id',
                    'kongou_shows.media_group = kongou_media_groups.media_group'
                ])
            } else {
                sqlFields.push(...[
                    'kongou_media_groups.type AS group_type',
                    'kongou_media_groups.name AS group_name',
                    'kongou_media_groups.description AS group_description',
                    'kongou_media_groups.icon AS group_icon',
                    'kongou_media_groups.adult AS group_nsfw',
                ])
                sqlTables.push(...[
                    'kongou_media_groups',
                ])
                sqlWhere.push(...[
                    'kanmi_records.eid NOT IN (SELECT kongou_episodes.eid FROM kongou_episodes)'
                ])
            }
        }

        const selectBase = `SELECT x.*, y.data FROM (SELECT ${sqlFields.join(', ')} FROM ${sqlTables.join(', ')} WHERE (${execute} AND (${sqlWhere.join(' AND ')}))` + ((sqlorder.trim().length > 0 && enablePrelimit) ? ` ORDER BY ${sqlorder}` : '') + ((enablePrelimit) ? ` LIMIT ${sqllimit + 10} OFFSET ${offset}` : '') + `) x LEFT OUTER JOIN (SELECT * FROM kanmi_records_extended) y ON (x.eid = y.eid)`;
        const selectFavorites = `SELECT DISTINCT eid AS fav_id, date AS fav_date FROM sequenzia_favorites WHERE userid = '${pinsUser}'`;
        const selectAlbums = `SELECT DISTINCT ${sqlAlbumFields} FROM sequenzia_albums, sequenzia_album_items WHERE (sequenzia_album_items.aid = sequenzia_albums.aid AND (${sqlAlbumWhere}) AND (sequenzia_albums.owner = '${req.session.discord.user.id}' OR sequenzia_albums.privacy = 0))`
        const selectHistory = `SELECT DISTINCT eid AS history_eid, date AS history_date, user AS history_user, name AS history_name, screen AS history_screen FROM sequenzia_display_history WHERE (${sqlHistoryWhere.join(' AND ')}) ORDER BY ${sqlHistorySort} LIMIT ${(req.query.displaySlave) ? 2 : 100000}`;
        const selectConfig = `SELECT name AS config_name, nice_name AS config_nice, showHistory as config_show FROM sequenzia_display_config WHERE user = '${req.session.user.id}'`;

        let sqlCall = `SELECT * FROM (SELECT * FROM (${selectBase}) base ${sqlFavJoin} (${selectFavorites}) fav ON (base.eid = fav.fav_id)${(sqlFavWhere.length > 0) ? 'WHERE ' + sqlFavWhere.join(' AND ') : ''}) i_wfav ${sqlHistoryJoin} (SELECT * FROM (${selectHistory}) hist LEFT OUTER JOIN (${selectConfig}) conf ON (hist.history_name = conf.config_name)) his_wconf ON (i_wfav.eid = his_wconf.history_eid)${sqlHistoryWherePost}${(req.query && req.query.displayname && req.query.displayname === '*' && req.query.history  && req.query.history === 'only') ? ' WHERE config_show = 1 OR config_show IS NULL' : ''}`
        if (sqlAlbumWhere.length > 0) {
            sqlCall = `SELECT * FROM (${sqlCall}) res_wusr INNER JOIN (${selectAlbums}) album ON (res_wusr.eid = album.eid)`;
        }
        if (page_uri === '/listTheater') {
            if (req.query.show_id !== 'unmatched') {
                sqlCall = `SELECT res_all.*, kms_series_data.show_data, kms_ep_data.episode_data FROM (SELECT res_episodes.*, watch_history.date AS watched_date, watch_history.viewed AS wathched_percent FROM (${sqlCall}) res_episodes ${(req.query.watch_history === 'only') ? 'INNER JOIN' : 'LEFT JOIN'} (SELECT * FROM kongou_watch_history WHERE user = '${req.session.user.id}' AND viewed >= 0.05) watch_history ON (watch_history.eid = res_episodes.eid)${(req.query.watch_history === 'none') ? 'WHERE watch_history.viewed IS NULL OR watch_history.viewed < 0.9' : ''}) res_all INNER JOIN (SELECT show_id, data AS show_data FROM kongou_shows) kms_series_data ON (kms_series_data.show_id = res_all.show_id) INNER JOIN (SELECT eid, data AS episode_data FROM kongou_episodes) kms_ep_data ON (kms_ep_data.eid = res_all.eid)`;
            } else {
                sqlCall = `SELECT res_episodes.*, watch_history.date AS watched_date, watch_history.viewed AS wathched_percent FROM (${sqlCall}) res_episodes ${(req.query.watch_history === 'only') ? 'INNER JOIN' : 'LEFT JOIN'} (SELECT * FROM kongou_watch_history WHERE user = '${req.session.user.id}' AND viewed >= 0.05) watch_history ON (watch_history.eid = res_episodes.eid)${(req.query.watch_history === 'none') ? 'WHERE watch_history.viewed IS NULL OR watch_history.viewed < 0.9' : ''}`;
            }
        }
        if (sqlorder.trim().length > 0) {
            sqlCall += ` ORDER BY ${sqlorder}`
        }

        debugTimes.build_query = (new Date() - debugTimes.build_query) / 1000
        // SQL Query Call and Results Rendering
        let countOfEverything, sumOfEVerything
        if (page_uri === '/start') {
            debugTimes.sql_query = new Date();
            const totalCountsResults = await sqlPromiseSimple(`SELECT SUM(filesize) AS total_data, COUNT(filesize) AS total_count FROM kanmi_records WHERE (attachment_hash IS NOT NULL OR fileid IS NOT NULL)`)
            const imageResults = await sqlPromiseSimple(`${sqlCall} LIMIT ${sqllimit}`)
            debugTimes.sql_query = (new Date() - debugTimes.sql_query) / 1000;

            debugTimes.post_proccessing = new Date();
            if (totalCountsResults && totalCountsResults.rows.length > 0) {
                countOfEverything = totalCountsResults.rows[0].total_count;
                sumOfEVerything = totalCountsResults.rows[0].total_data;
            }
            if (imageResults && imageResults.rows.length > 0) {
                const randomImage = imageResults.rows.splice(0, limit)
                let images = [];
                let imagesArray = [];
                randomImage.forEach(function(image) {
                    // Get Image Preview URL
                    let ranImage = '';
                    if ( image.cache_proxy !== null) {
                        ranImage = item.cache_proxy.startsWith('http') ? item.cache_proxy : `https://media.discordapp.net/attachments${item.cache_proxy}`
                    } else {
                        ranImage = `https://media.discordapp.net/attachments/` + ((image.attachment_hash.includes('/')) ? image.attachment_hash : `${image.channelid}/${image.attachment_hash}/${image.attachment_name}`)
                    }

                    // Image Description
                    const contentText = image.content_full

                    // Image Channel
                    let channelName = ''
                    if (image.virtual_channel_name) {
                        channelName = image.virtual_channel_name
                    } else if (image.channel_nice) {
                        channelName = image.channel_nice
                    } else {
                        image.channel_name.split('-').forEach((wd, i, a) => {
                            channelName +=  wd.substring(0,1).toUpperCase() + wd.substring(1,wd.length)
                            if (i + 1  < a.length) {
                                channelName += ' '
                            }
                        })
                    }

                    // Image Date
                    const _messageDate = moment(Date.parse(image.date))
                    let messageDate = `${_messageDate.format('MMMM')} ${parseInt(_messageDate.format('DD'))}, ${_messageDate.format('YYYY')}`

                    // If Image is Favorited
                    let imageFav = false
                    if (image.fav_date !== null) {
                        imageFav = true
                    }

                    // Get Full Image URL
                    let ranfullImage = '';
                    let ranfullImagePerma = '';
                    if ((page_uri === '/ambient-refresh' || page_uri === '/ambient-remote-refresh') && !(req.query && req.query.nocds && req.query.nocds === 'true')) {
                        ranfullImage = `/content/full64/${image.channelid}/${image.id}`
                        ranfullImagePerma = `/content/link/${image.channelid}/${image.id}`
                    } else {
                        if (image.filecached === 1) {
                            ranfullImage = `/stream/${image.fileid}/${image.real_filename}`
                        } else {
                            ranfullImage = `https://cdn.discordapp.com/attachments/` + ((image.attachment_hash.includes('/')) ? image.attachment_hash : `${image.channelid}/${image.attachment_hash}/${image.attachment_name}`)
                        }
                    }

                    // Image Link
                    const imagelink = `http://${req.headers.host}/gallery?search=${encodeURIComponent("id:st:" + image.id.substring(0,7))}`
                    images.push([ranImage, ranfullImage, contentText, messageDate, [ image.class_name, `${channelName}`, `${image.server_short_name}` ], image.eid, imagelink, imageFav, image.id, ranfullImagePerma, [ image.sizeH ,image.sizeW ,image.sizeR ], [ image.colorR, image.colorG, image.colorB ]]);

                    imagesArray.push({
                        id: image.id,
                        eid: image.eid,
                        fullImage: ranFullImage,
                        previewImage: ranImage,
                        content: contentText,
                        date: messageDate,
                        channelName: channelName,
                        channelId: image.channel,
                        className: image.class_name,
                        serverName: image.server_short_name,
                        jumpLink: imagelink,
                        permalink: ranfullImagePerma,
                        pinned: imageFav,
                        sizeH: image.sizeH,
                        sizeW: image.sizeW,
                        sizeR: image.sizeR,
                        colorR: image.colorR,
                        colorB: image.colorB,
                        colorG: image.colorG
                    });
                })

                if (randomImage.length === 1) {
                    images = images[0];
                    printLine('GetData', `Returning Random Image "${images[8]}"`, 'debug')
                } else {
                    printLine('GetData', `Returning ${images.length} Random Images`, 'debug')
                }

                debugTimes.post_proccessing = (new Date() - debugTimes.post_proccessing) / 1000;
                console.log(debugTimes);
                res.locals.debugTimes = debugTimes;
                res.locals.response = {
                    url: req.url,
                    search_prev: search_prev,
                    masterCount: countOfEverything,
                    masterData: sumOfEVerything,
                    randomImage: images,
                    randomImagev2: imagesArray,
                    server: req.session.server_list,
                    download: req.session.discord.servers.download,
                    manage_channels: req.session.discord.channels.manage,
                    write_channels: req.session.discord.channels.write,
                    discord: req.session.discord,
                    user: req.session.user,
                    albums: (req.session.albums && req.session.albums.length > 0) ? req.session.albums : [],
                    theaters: (req.session.media_groups && req.session.media_groups.length > 0) ? req.session.media_groups : [],
                    next_episode: req.session.kongou_next_episode,
                    applications_list: req.session.applications_list,
                    call_uri: page_uri,
                    device: ua,
                }
                next();
            } else {
                debugTimes.post_proccessing = (new Date() - debugTimes.post_proccessing) / 1000;
                console.log(debugTimes);
                res.locals.debugTimes = debugTimes;
                res.locals.response = {
                    url: req.url,
                    search_prev: search_prev,
                    masterCount: countOfEverything,
                    masterData: sumOfEVerything,
                    server: req.session.server_list,
                    download: req.session.discord.servers.download,
                    manage_channels: req.session.discord.channels.manage,
                    write_channels: req.session.discord.channels.write,
                    discord: req.session.discord,
                    user: req.session.user,
                    albums: (req.session.albums && req.session.albums.length > 0) ? req.session.albums : [],
                    theaters: (req.session.media_groups && req.session.media_groups.length > 0) ? req.session.media_groups : [],
                    next_episode: req.session.kongou_next_episode,
                    applications_list: req.session.applications_list,
                    device: ua,
                    call_uri: page_uri,
                }
                next();
            }
        } else if (page_uri === '/' || page_uri === '/homeImage' || page_uri === '/home' || page_uri === '/ads-micro' || page_uri === '/ads-widget' || page_uri.startsWith('/ambient')) {
            debugTimes.sql_query = new Date();
            let ambientSQL = `${sqlCall} LIMIT ${sqllimit}`
            const imageResults = await sqlPromiseSimple(ambientSQL)
            debugTimes.sql_query = (new Date() - debugTimes.sql_query) / 1000;
            debugTimes.post_proccessing = new Date();
            if (imageResults && imageResults.rows.length > 0) {
                const randomImage = imageResults.rows.splice(0, limit)
                let images = [];
                let imagesArray = [];
                randomImage.forEach(function(image) {
                    // Get Image Preview URL
                    let ranImage = '';
                    if ( image.cache_proxy !== null) {
                        ranImage = item.cache_proxy.startsWith('http') ? item.cache_proxy : `https://media.discordapp.net/attachments${item.cache_proxy}`
                    } else {
                        ranImage = `https://media.discordapp.net/attachments/` + ((image.attachment_hash.includes('/')) ? image.attachment_hash : `${image.channelid}/${image.attachment_hash}/${image.attachment_name}`)
                    }

                    // Image Description
                    const contentText = image.content_full
                    const clean_content = contentText.replace('/^[ ]+|[ ]+$/g', '').split("***").join("").split("**").join("").split("*").join("").split("`").join("").split("__").join("").split("~~").join("").split("||").join("").split("<#").join("").split("<!@").join("").split(">").join("")


                    // Image Channel
                    let channelName = ''
                    if (image.virtual_channel_name) {
                        channelName = image.virtual_channel_name
                    } else if (image.channel_nice) {
                        channelName = image.channel_nice
                    } else {
                        image.channel_name.split('-').forEach((wd, i, a) => {
                            channelName +=  wd.substring(0,1).toUpperCase() + wd.substring(1,wd.length)
                            if (i + 1  < a.length) {
                                channelName += ' '
                            }
                        })
                    }
                    // Image Date
                    const _messageDate = moment(Date.parse(image.date))
                    let messageDate = `${_messageDate.format('MMMM')} ${parseInt(_messageDate.format('DD'))}, ${_messageDate.format('YYYY')}`

                    // If Image is Favorited
                    let imageFav = false
                    if (image.fav_date !== null) {
                        imageFav = true
                    }

                    // Get Full Image URL
                    let ranfullImage = '';
                    let ranfullImagePerma = '';
                    if ((page_uri === '/ambient-refresh' || page_uri === '/ambient-remote-refresh') && !(req.query && req.query.nocds && req.query.nocds === 'true')) {
                        ranfullImage = `/content/full64/${image.channelid}/${image.id}`
                        ranfullImagePerma = `/content/link/${image.channelid}/${image.id}`
                    } else {
                        if (image.filecached === 1) {
                            ranfullImage = `/stream/${image.fileid}/${image.real_filename}`
                        } else {
                            ranfullImage = `https://cdn.discordapp.com/attachments/` + ((image.attachment_hash.includes('/')) ? image.attachment_hash : `${image.channelid}/${image.attachment_hash}/${image.attachment_name}`)
                        }
                    }

                    // Image Link
                    const imagelink = `http://${req.headers.host}/gallery?search=${encodeURIComponent("id:st:" + image.id.substring(0,7))}`
                    let shown_date = undefined
                    if (req.query.displaySlave && image.history_date) {
                        shown_date = parseInt(moment(Date.parse(image.history_date)).format('x')) - new Date();
                    }
                    /*const imagelink = await qrcode.toDataURL(`http://${req.headers.host}/gallery?search=${image.id.substring(0,7)}`, {
                        margin: 1,
                        color: {
                            dark:"#000000",
                            light:"#ffffff"
                        }
                    })
                        .then ((imageData) => {
                            if (imageData) {
                                return imageData;
                            } else {
                                return null;
                            }
                        })
                        .catch((err) => {
                            console.error(err);
                            return null;
                        })*/
                    images.push([ranImage, ranfullImage, contentText, messageDate, [ image.class_name, `${channelName}`, `${image.server_short_name}` ], image.id.substring(0,7), imagelink, imageFav, image.eid, ranfullImagePerma, [ image.sizeH ,image.sizeW ,image.sizeR ], [ image.colorR, image.colorG, image.colorB ]]);
                    imagesArray.push({
                        id: image.id,
                        eid: image.eid,
                        fullImage: ranfullImage,
                        previewImage: ranImage,
                        content: contentText,
                        contentClean: clean_content,
                        date: messageDate,
                        sync_delta: shown_date,
                        channelName: channelName,
                        channelId: image.channel,
                        className: image.class_name,
                        serverName: image.server_short_name,
                        jumpLink: imagelink,
                        permalink: ranfullImagePerma,
                        pinned: imageFav,
                        history: (image.history_date) ? image.history_date : false,
                        sizeH: image.sizeH,
                        sizeW: image.sizeW,
                        sizeR: image.sizeR,
                        colorR: image.colorR,
                        colorB: image.colorB,
                        colorG: image.colorG
                    });
                })

                if (randomImage.length === 1) {
                    images = images[0];
                    printLine('GetData', `Returning Random Image "${images[8]}"`, 'debug')
                } else {
                    printLine('GetData', `Returning ${images.length} Random Images`, 'debug')
                }

                if ((page_uri === '/ambient-refresh' || page_uri === '/ambient-remote-refresh')  && req.query.displayname) {
                    try {
                        const displayConfig = await sqlPromiseSafe('SELECT * FROM sequenzia_display_config WHERE user = ? AND name = ? LIMIt 1', [req.session.discord.user.id, req.query.displayname])
                        if (displayConfig && displayConfig.rows.length > 0) {
                            const _configuration = Object.assign({}, displayConfig.rows.pop())
                            res.json({
                                randomImage: images,
                                randomImagev2: imagesArray,
                                configuration: _configuration,
                                user_id: req.session.user.id,
                                user_image: req.session.user.avatar,
                                user_username: req.session.user.username
                            })
                        } else {
                            res.json({
                                randomImage: images,
                                randomImagev2: imagesArray,
                                user_id: req.session.user.id,
                                user_image: req.session.user.avatar,
                                user_username: req.session.user.username
                            })
                        }
                    } catch (err) {
                        console.error(`Failed to get display config due to error`)
                        console.error(err)
                        res.json({
                            randomImage: images,
                            randomImagev2: imagesArray,
                            user_id: req.session.user.id,
                            user_image: req.session.user.avatar,
                            user_username: req.session.user.username
                        })
                    }
                } else if (page_uri === '/ambient-refresh' || page_uri === '/ambient-remote-refresh')  {
                    res.json({
                        randomImage: images,
                        randomImagev2: imagesArray,
                        user_id: req.session.user.id,
                        user_image: req.session.user.avatar,
                        user_username: req.session.user.username
                    })
                } else if ((page_uri === '/ads-micro' || page_uri === '/ads-widget')  && req.query.displayname) {
                    const _configuration = await sqlPromiseSafe('SELECT * FROM sequenzia_display_config WHERE user = ? AND name = ? LIMIt 1', [req.session.discord.user.id, req.query.displayname]);
                    if (_configuration.error) {
                        printLine('SQL', `Error adding messages to display history - ${_configuration.error.sqlMessage}`, 'error')
                    }
                    res.locals.response = {
                        url: req.url,
                        search_prev: search_prev,
                        randomImage: images,
                        randomImagev2: imagesArray,
                        configuration: (_configuration.rows.length > 0) ? _configuration.rows.pop() : undefined,
                        server: req.session.server_list,
                        download: req.session.discord.servers.download,
                        manage_channels: req.session.discord.channels.manage,
                        write_channels: req.session.discord.channels.write,
                        discord: req.session.discord,
                        user: req.session.user,
                        albums: (req.session.albums && req.session.albums.length > 0) ? req.session.albums : [],
                        theaters: (req.session.media_groups && req.session.media_groups.length > 0) ? req.session.media_groups : [],
                        next_episode: req.session.kongou_next_episode,
                        applications_list: req.session.applications_list,
                        device: ua,
                        call_uri: page_uri,
                    }
                    next();
                } else {
                    res.locals.response = {
                        url: req.url,
                        search_prev: search_prev,
                        randomImage: images,
                        randomImagev2: imagesArray,
                        server: req.session.server_list,
                        download: req.session.discord.servers.download,
                        manage_channels: req.session.discord.channels.manage,
                        write_channels: req.session.discord.channels.write,
                        discord: req.session.discord,
                        user: req.session.user,
                        albums: (req.session.albums && req.session.albums.length > 0) ? req.session.albums : [],
                        theaters: (req.session.media_groups && req.session.media_groups.length > 0) ? req.session.media_groups : [],
                        next_episode: req.session.kongou_next_episode,
                        applications_list: req.session.applications_list,
                        device: ua,
                        call_uri: page_uri,
                    }
                    next();
                }
                debugTimes.post_proccessing = (new Date() - debugTimes.post_proccessing) / 1000;

                debugTimes.history_write = new Date();
                let screenID = 0;
                if (req.query.setscreen) {
                    switch (req.query.setscreen) {
                        case '0':
                        case '1':
                            screenID = 0;
                            break;
                        case '2':
                            screenID = 1;
                            break;
                        default:
                            screenID = 0;
                            break;
                    }
                } else if (req.query.screen) {
                    screenID = parseInt(req.query.screen);
                }

                if (_dn !== "*" && (randomImage.length === 1 || (randomImage.length > 1 && req.query.nohistory && req.query.nohistory === 'false')) && req.session.discord.user.id && randomImage && !req.query.displaySlave && !(req.query.nohistory && req.query.nohistory === 'true')) {
                    for (const image of randomImage) {
                        const index = randomImage.indexOf(image);
                        const isExsists = await sqlPromiseSafe(`SELECT * FROM sequenzia_display_history WHERE eid = ? AND user = ?`, [image.eid, req.session.discord.user.id]);
                        if (isExsists.error) {
                            printLine('SQL', `Error adding messages to display history - ${isExsists.error.sqlMessage}`, 'error', err)
                        }
                        if (isExsists.rows.length > 0) {
                            const updateHistoryItem = await sqlPromiseSafe(`UPDATE sequenzia_display_history SET screen = ?, name = ?, date = ? WHERE eid = ? AND user = ?`, [screenID, _dn, moment().format('YYYY-MM-DD HH:mm:ss'), image.eid, req.session.discord.user.id])
                            if (updateHistoryItem.error) {
                                printLine('SQL', `Error adding messages to display history - ${updateHistoryItem.error.sqlMessage}`, 'error', err)
                            } else {
                                printLine('GetData', `Updated Image "${image.id}" to Display History for "${_dn}"`, 'debug')
                            }
                        } else {
                            const updateHistoryItem = await sqlPromiseSafe(`INSERT INTO sequenzia_display_history SET eid = ?, name = ?, screen = ?, user = ?, date = ?`, [image.eid, _dn, screenID, req.session.discord.user.id, moment().format('YYYY-MM-DD HH:mm:ss')])
                            if (updateHistoryItem.error) {
                                printLine('SQL', `Error adding messages to display history - ${updateHistoryItem.error.sqlMessage}`, 'error', err)
                            } else {
                                printLine('GetData', `Saving Image "${image.id}" to Display History for "${_dn}"`, 'debug')
                            }
                        }

                        if ((randomImage.length === 1 || randomImage.length === index + 1) && !(req.query && req.query.history && req.query.history === 'none' && randomImage.length <= limit)) {
                            let deleteCount = 250
                            if (req.query && req.query.history && req.query.history === 'none') {
                                deleteCount = 50000
                            } else if (req.query && !(page_uri.includes('ambient') || page_uri.includes('ads')) && req.query.reqCount && req.query.reqCount > deleteCount) {
                                deleteCount = req.query.reqCount
                            } else if (!(page_uri.includes('ambient') || page_uri.includes('ads')) && limit >= deleteCount) {
                                deleteCount = limit
                            }
                            try {
                                sqlPromiseSafe(`DELETE a FROM sequenzia_display_history a LEFT JOIN (SELECT eid AS keep_eid, date FROM sequenzia_display_history WHERE user = ? AND name = ? ORDER BY date DESC LIMIT ?) b ON (a.eid = b.keep_eid) WHERE b.keep_eid IS NULL AND a.user = ? AND a.name = ?;`, [req.session.discord.user.id, _dn, deleteCount, req.session.discord.user.id, _dn])
                            } catch (err) {
                                printLine('SQL', `Error deleting from display history - ${err.sqlMessage}`, 'error', err)
                            }
                        } else if (req.query && req.query.history && req.query.history === 'none' && randomImage.length < limit) {
                            printLine('GetData', `Truncating Display History for "${_dn}"`, 'info')
                            try {
                                sqlPromiseSafe(`DELETE a FROM sequenzia_display_history a LEFT JOIN (SELECT eid AS keep_eid, date FROM sequenzia_display_history WHERE user = ? AND name = ? ORDER BY date DESC LIMIT ?) b ON (a.eid = b.keep_eid) WHERE b.keep_eid IS NULL AND a.user = ? AND a.name = ?;`, [req.session.discord.user.id, _dn, 50, req.session.discord.user.id, _dn])
                            } catch (err) {
                                printLine('SQL', `Error deleting from display history - ${err.sqlMessage}`, 'error', err)
                            }
                        }
                    }
                }
                debugTimes.history_write = (new Date() - debugTimes.history_write) / 1000;
                console.log(debugTimes);
            } else {
                res.locals.response = {
                    url: req.url,
                    search_prev: search_prev,
                    randomImage: [],
                    randomImagev2: [],
                    server: req.session.server_list,
                    download: req.session.discord.servers.download,
                    manage_channels: req.session.discord.channels.manage,
                    write_channels: req.session.discord.channels.write,
                    discord: req.session.discord,
                    user: req.session.user,
                    albums: (req.session.albums && req.session.albums.length > 0) ? req.session.albums : [],
                    theaters: (req.session.media_groups && req.session.media_groups.length > 0) ? req.session.media_groups : [],
                    next_episode: req.session.kongou_next_episode,
                    applications_list: req.session.applications_list,
                    device: ua,
                    call_uri: page_uri,
                }
                next();
            }
        } else if (req.headers['x-requested-page'] && req.headers['x-requested-page'] === 'SeqPaginator' ) {
            if (req.session.pageinatorEnable && req.session.pageinatorEnable === true && (!req.query || (req.query && !req.query.watch_history))) {
                let sqlCountFeild = 'eid';
                let favmatch = '';
                if (req.query && req.query.pins && req.query.pins !== 'false') {
                    sqlTables.push('sequenzia_favorites');
                    sqlCountFeild = 'sequenzia_favorites.date';
                    favmatch = `AND sequenzia_favorites.eid = kanmi_records.eid AND sequenzia_favorites.userid = '${pinsUser.replace(/'/g, '\\\'')}'${(sqlFavWhere.length > 0) ? ' AND ' + sqlFavWhere.join(' AND ').replace('fav_date', 'sequenzia_favorites.date') : ''}`;
                }
                if (req.query && req.query.history && req.query.history === 'only') {
                    sqlTables.push('sequenzia_display_history');
                    sqlCountFeild = 'sequenzia_display_history.date';
                    favmatch = `AND sequenzia_display_history.eid = kanmi_records.eid AND sequenzia_display_history.user = '${req.session.discord.user.id}'${(_dn !== '*') ? "  AND sequenzia_display_history.name = '" + _dn.replace(/'/g, '\\\'') + "'" : ''}`;
                }
                if (sqlAlbumWhere.length > 0) {
                    sqlTables.push('sequenzia_album_items');
                    sqlTables.push('sequenzia_albums');
                    sqlCountFeild = 'sequenzia_album_items.date';
                    favmatch += `AND sequenzia_album_items.eid = kanmi_records.eid AND sequenzia_album_items.aid = sequenzia_albums.aid AND (${sqlAlbumWhere}) AND (sequenzia_albums.owner = '${req.session.discord.user.id}' OR sequenzia_albums.privacy = 0)`;
                } else if (req.query.album_name) {
                    sqlTables.push('sequenzia_album_items');
                    sqlTables.push('sequenzia_albums');
                    sqlCountFeild = 'sequenzia_album_items.date';
                    favmatch += `AND sequenzia_album_items.eid = kanmi_records.eid AND sequenzia_album_items.aid = sequenzia_albums.aid AND sequenzia_albums.name = '${req.query.album_name}' AND (sequenzia_albums.owner = '${req.session.discord.user.id}' OR sequenzia_albums.privacy = 0)`;
                } else if ((page_uri === '/listTheater' || req.query.show_id || req.query.group) && (req.query.show_id !== 'unmatched')) {
                    sqlCountFeild = 'kongou_episodes.eid';
                }
                debugTimes.sql_query_1 = new Date();
                let countResults = await sqlPromiseSimple(`SELECT COUNT(${sqlCountFeild}) AS total_count FROM ${sqlTables.join(', ')} WHERE (${execute}${favmatch} AND (${sqlWhere.join(' AND ')}))`);
                debugTimes.sql_query_1 = (new Date() - debugTimes.sql_query_1) / 1000;
                debugTimes.sql_query_2 = new Date();
                const history_urls = await sqlPromiseSafe(`SELECT * FROM sequenzia_navigation_history WHERE user = ? ORDER BY saved DESC, date DESC`, [ req.session.discord.user.id ]);
                debugTimes.sql_query_2 = (new Date() - debugTimes.sql_query_2) / 1000;

                debugTimes.post_proccessing = new Date();
                if (countResults && countResults.rows.length > 0) {
                    let pages = [];
                    let currentPage = undefined;
                    let pageList = undefined;
                    let count = countResults.rows[0].total_count;
                    const totalCount = count  / limit
                    let progressCount = 0;
                    let progressOffset = 0;
                    while (progressCount < totalCount) {
                        pages.push({
                            url: `['offset', "${progressOffset}"]`,
                            offset: progressOffset,
                            page: progressCount
                        });
                        progressCount++;
                        progressOffset = limit + progressOffset;
                    }
                    currentPage = pages.find(o => o.offset >= offset);

                    try {
                        if (pages.length > 10) {
                            let pagesShort = [];
                            if (currentPage.page && currentPage.page > 4) {
                                if (currentPage.page + 4 > pages.length) {
                                    pagesShort = pages.slice(currentPage.page - 4, pages.length);
                                } else {
                                    pagesShort = pages.slice(currentPage.page - 4, currentPage.page + 4);
                                }
                            } else {
                                pagesShort = pages.slice(0, 10);
                            }
                            pageList = pagesShort;
                            if (currentPage.page && currentPage.page > 4) {
                                pageList.unshift(pages[0]);
                            }
                            if (currentPage.page || currentPage.page + 4 < pages.length) {
                                pageList.push(pages.pop());
                            }
                        } else {
                            pageList = pages;
                        }
                    } catch (e) {
                        pageList = undefined
                    }
                    debugTimes.post_proccessing = (new Date() - debugTimes.post_proccessing) / 1000;
                    debugTimes.render = new Date();
                    res.render('pageinator', {
                        req_uri: req.protocol + '://' + req.get('host') + req.originalUrl,
                        pageList: pageList,
                        currentPage: currentPage,
                        resultsCount: (count >= 2048) ? ((count)/1000).toFixed(0) + "K" : count,
                        history: history_urls.rows
                    })
                    debugTimes.render = (new Date() - debugTimes.render) / 1000;
                    console.log(debugTimes);
                } else {
                    res.end();
                }
            } else {
                res.end();
            }
        } else {
            debugTimes.sql_query = new Date();
            console.log(`${sqlCall}` + ((!enablePrelimit && (!req.query || (req.query && !req.query.watch_history))) ? ` LIMIT ${sqllimit + 10} OFFSET ${offset}` : ''))
            const messageResults = await sqlPromiseSimple(`${sqlCall}` + ((!enablePrelimit) ? ` LIMIT ${sqllimit + 10} OFFSET ${offset}` : ''));
            debugTimes.sql_query = (new Date() - debugTimes.sql_query) / 1000;
            const users = app.get('users').rows
            const user_index = users.map(e => e.id)

            if (messageResults && messageResults.rows.length > 0) {
                ((messages) => {
                    let page_title
                    let page_image
                    let full_title
                    let description
                    let resultsArray = []
                    let imagesArray = []
                    let discordPath = null
                    let currentChannelId = null
                    let currentServerId = null;
                    let currentClassIcon = null;
                    let currentClassification = messages[0].classification;

                    let currentNsfw = null
                    let realoffset = 0
                    let folderInfo;
                    let channelid = []

                    debugTimes.post_proccessing = new Date();
                    if (messages[0].album_name && messages[0].album_name !== null) {
                        page_title = `${messages[0].album_name}`
                        full_title = `${messages[0].album_name}`
                    } else if (multiChannelBase) {
                        page_title = `${messages[0].class_name}`
                        full_title = `${messages[0].class_name}`
                        if (req.query.folder) {
                            folderInfo = req.query.folder;
                            android_uri.push('folder=' + folderInfo);
                        } else {
                            folderInfo = `/${messages[0].classification}/*`
                        }
                        if (messages[0].class_icon) {
                            currentClassIcon = `${messages[0].class_icon}`
                        }
                        android_uri.push('folder=' + folderInfo);
                    } else if ((req.query.channel && req.query.channel !== 'random') || req.query.vchannel || req.query.folder) {
                        page_title = ''
                        full_title = ''

                        if (messages[0].class_name) {
                            page_title += `${messages[0].class_name} / `
                            full_title += `${messages[0].class_name} / `
                        }
                        if (messages[0].class_icon) {
                            currentClassIcon = `${messages[0].class_icon}`
                        }

                        if (messages[0].virtual_channel_name && messages[0].virtual_channel_name !== null) {
                            page_title += messages[0].virtual_channel_name;
                            full_title += messages[0].virtual_channel_name;
                            if (req.query.channel) {
                                if (messages[0].channel_nice && messages[0].channel_nice !== null) {
                                    page_title += ' / ' + messages[0].channel_nice;
                                    full_title += ' / ' + messages[0].channel_nice;
                                } else if (messages[0].channel_name) {
                                    let cname = '';
                                    messages[0].channel_name.split('-').forEach((wd, i, a) => {
                                        cname +=  wd.substring(0,1).toUpperCase() + wd.substring(1,wd.length);
                                        if (i + 1  < a.length) {
                                            cname += ' ';
                                        }
                                    })
                                    full_title += ' / ' + cname;
                                    page_title += ' / ' + cname;
                                }
                            }
                        } else if (messages[0].channel_title) {
                            full_title = page_title = `${messages[0].channel_title}`
                        } else if (messages[0].channel_nice && messages[0].channel_nice !== null) {
                            page_title += messages[0].channel_nice;
                            full_title += messages[0].channel_nice;
                        } else if (messages[0].channel_name) {
                            messages[0].channel_name.split('-').forEach((wd, i, a) => {
                                page_title +=  wd.substring(0,1).toUpperCase() + wd.substring(1,wd.length);
                                if (i + 1  < a.length) {
                                    page_title += ' ';
                                }
                            })
                            full_title = page_title;
                        }
                        if (messages[0].virtual_channel_description && messages[0].virtual_channel_description.length > 1) {
                            description = messages[0].virtual_channel_description
                        } else if (messages[0].channel_description && messages[0].channel_description.length > 1) {
                            description = messages[0].channel_description
                        }
                        discordPath = `https://discord.com/channels/${messages[0].server}/${messages[0].channel}/`
                        if (!multiChannel) {
                            currentChannelId = messages[0].channel;
                            currentServerId = messages[0].server;
                            currentNsfw = (messages[0].channel_nsfw === 1);
                        }
                        if (req.query.vchannel) {
                            currentChannelId = `vc_${messages[0].virtual_channel_eid}`;
                            folderInfo = `${messages[0].server_short_name}:/${messages[0].classification}/virt_${messages[0].virtual_channel_eid}`
                            android_uri.push('folder=' + folderInfo);
                        } else if (req.query.channel) {
                            folderInfo = `${messages[0].server_short_name}:/${messages[0].classification}/${messages[0].channel_short_name}`
                            android_uri.push('folder=' + folderInfo);
                        } else if (req.query.folder) {
                            folderInfo = req.query.folder;
                            android_uri.push('folder=' + folderInfo);
                        }
                    } else if (req.query && req.query.displayname && req.query.displayname !== '*' && req.query.history  && req.query.history === 'only') {
                        page_title = `History / ${(req.query.displayname.includes('ADS')) ? req.query.displayname.split('-').pop() : req.query.displayname}`
                        full_title = `History / ${(req.query.displayname.includes('ADS')) ? req.query.displayname.split('-').pop() : req.query.displayname}`
                    } else if (page_uri === '/listTheater') {
                        if (req.query && req.query.show_id && messages[0].show_name) {
                            page_title = messages[0].show_name
                            full_title = `Theater / ${messages[0].group_name} / ${messages[0].show_name.split('-')[0].trim()}`
                        } else {
                            page_title = ''
                            full_title = ''
                        }
                        currentClassIcon = messages[0].group_icon
                    } else {
                        page_title = ''
                        full_title = ''
                    }
                    if (req.query.title && req.query.title !== '') {
                        page_title = req.query.title
                        full_title = req.query.title
                    }

                    if (!multiChannel) {
                        page_image = messages[0].channel_image
                    }
                    if (!(req.query.title && req.query.title !== '') || multiChannel) {
                        if (selectedServer === 1) {
                            currentServerId = messages[0].server;
                        }
                        if (selectedChannel === 1) {
                            currentChannelId = messages[0].channel;
                        }
                    }
                    if (page_uri === '/gallery' || page_uri === '/listTheater') {
                        messages.forEach(function (item, index) {
                            if (index + 1 <= limit) {
                                realoffset++
                                let decoded_content =  item.content_full
                                let content_urls = []
                                let user_search = undefined
                                let parent_search = undefined
                                content_urls.forEach(url => {
                                    decoded_content = decoded_content.split(url.split("%60").join("")).join("")
                                })
                                if (decoded_content.includes('🧩 File : ')) {
                                    decoded_content = decoded_content.split("\n").filter((e,i) => { if (i > 1) { return e } }).join("\n")
                                }
                                let clean_content = decoded_content.replace('/^[ ]+|[ ]+$/g', '').split("***").join("").split("**").join("").split("*").join("").split("`").join("").split("__").join("").split("~~").join("").split("||").join("").split("<#").join("").split("<!@").join("").split(">").join("")
                                if (clean_content.includes('Twitter Image') && clean_content.split("\n").length > 1) {
                                    let _ca = clean_content.split("\n")
                                    _ca.shift()
                                    clean_content = _ca.join('\n')
                                }
                                const content_single = item.content_full.split('\n')[0]
                                if (content_single.includes('Twitter Image')) {
                                    if (content_single.includes('(@')) {
                                        user_search = content_single.split('(@').pop().split(')')[0]
                                        content_urls.push(`https://twitter.com/${user_search}`)
                                    } else if (content_single.includes('RT @')) {
                                        user_search = content_single.split('RT @').pop().split(': ')[0]
                                        content_urls.push(`https://twitter.com/${user_search}`)
                                    } else {
                                        user_search = content_single.split('***')[1]
                                    }
                                } else if (decoded_content.includes('flickr.com/')) {
                                    if (decoded_content.includes(' (')) {
                                        user_search = decoded_content.split(' (').pop().split(')')[0]
                                    } else {
                                        user_search = decoded_content.split('flickr.com/photos/').pop().split('/')[0]
                                    }
                                    const _url = Array.from(getUrls(content_single))
                                    if (_url.length === 1) {
                                        content_urls = [_url[0]];
                                    } else if (_url.length > 1) {
                                        content_urls = [_url.pop()];
                                    }
                                } else if (decoded_content.includes('**🎆 ') && decoded_content.includes(' (')) {
                                    if (decoded_content.includes('Related to post ')) {
                                        parent_search = decoded_content.split('\n')[0].split(') by ')[0].split(' (').pop()
                                    }
                                    user_search = decoded_content.split(' (')[1].split(') - ')[0]
                                    content_urls = Array.from(getUrls(clean_content));
                                    if (content_urls.length === 0) {
                                        const user = clean_content.split(' : ')[0].split(') - ').pop()
                                        const id = clean_content.split('[').pop().split(']')[0]
                                        content_urls = []
                                        if (!isNaN(parseInt(id)))
                                            content_urls.push(`https://www.pixiv.net/en/artworks/${id}`)
                                        if (!isNaN(parseInt(user)))
                                            content_urls.push(`https://www.pixiv.net/en/users/${user}`)
                                    }
                                } else if (decoded_content.includes('://')) {
                                    content_urls = Array.from(getUrls(clean_content));
                                    if (decoded_content.includes(' by ')) {
                                        user_search = decoded_content.split(' by ').pop().split('\n')[0]
                                    }
                                } else {
                                    user_search = clean_content.split(' by ').pop().split('***')[0].split('**')[0]
                                }
                                let downloadlink = `/content/link/${item.channel}/${item.id}/`
                                let channelName = ''
                                let filesize = 'Unknown'
                                if (item.filesize !== null) {
                                    if (item.filesize > 100000) {
                                        filesize = (item.filesize / 100000).toFixed(2) + ' TB'
                                    } else if (item.filesize > 1000) {
                                        filesize = (item.filesize / 1000).toFixed(2) + ' GB'
                                    } else if (item.filesize > 1) {
                                        filesize = item.filesize + ' MB'
                                    } else {
                                        filesize = '< 1 MB'
                                    }

                                }
                                if (item.channel_nice) {
                                    channelName = item.channel_nice
                                } else {
                                    item.channel_name.split('-').forEach((wd, i, a) => {
                                        channelName +=  wd.substring(0,1).toUpperCase() + wd.substring(1,wd.length)
                                        if (i + 1  < a.length) {
                                            channelName += ' '
                                        }
                                    })
                                }
                                let history_type = null;
                                let history_screen = null;
                                let history_name = null;
                                if (item.history_name) {
                                    history_name = (item.config_nice) ? item.config_nice : item.history_name;
                                    if (item.history_name.startsWith('ADSMicro-')) {
                                        history_type = 'ads-micro'
                                        if (item.history_name.includes('Untitled')) {
                                            history_name = 'Desktop'
                                        } else {
                                            history_name = history_name.split('ADSMicro-').pop();
                                        }
                                    } else if (item.history_name.startsWith('ADSWidget-')) {
                                        history_type = 'ads-widget'
                                        if (item.history_name.includes('Untitled')) {
                                            history_name = 'Widget'
                                        } else {
                                            history_name = history_name.split('ADSWidget-').pop();
                                        }
                                    } else if (item.history_name.startsWith('ADSEmbed-')) {
                                        history_type = 'ads-embed'
                                        if (item.history_name.includes('Untitled')) {
                                            history_name = 'Randomizer'
                                        } else {
                                            history_name = history_name.split('ADSEmbed-').pop();
                                        }
                                    } else if (item.history_name.startsWith('ADSMobile-')) {
                                        history_type = 'ads-mobile'
                                        if (item.history_name.includes('Untitled')) {
                                            history_name = 'Mobile'
                                        } else {
                                            history_name = history_name.split('ADSMobile-').pop();
                                        }
                                        if (item.history_screen !== null && item.history_screen === 0) {
                                            history_screen = "Home"
                                        } else if (item.history_screen !== null && item.history_screen === 1) {
                                            history_screen = "Lock"
                                        }
                                    } else if (item.history_name.startsWith('ADS')) {
                                        history_type = 'ads-generic'
                                    } else if (item.history_name === 'Homepage') {
                                        history_type = 'homepage'
                                        history_name = "Homepage";
                                    } else if (item.history_name === 'WebExtension') {
                                        history_type = 'webextention'
                                    } else {
                                        history_type = 'ads-lite'
                                        if (item.history_name.includes('Untitled')) {
                                            history_name = 'Default'
                                        }
                                    }
                                }
                                let post_user = (() => {
                                    const _u = (user_index.indexOf(item.user) !== -1) ? users[user_index.indexOf(item.user)] : false
                                    if (_u) {
                                        return {
                                            id: item.user,
                                            name: (_u.nice_name) ? _u.nice_name: _u.username,
                                            avatar: (_u.avatar) ? `https://cdn.discordapp.com/avatars/${item.user}/${_u.avatar}.png?size=512` : null,
                                        }
                                    }
                                    return {
                                        id: item.user
                                    }
                                })()

                                if (item.attachment_extra !== null) {
                                    // Unpack data here
                                    const extractedItems = JSON.parse(item.attachment_extra)
                                    extractedItems.reverse().forEach(function (attachment, index) {
                                        if (attachment[0].includes('.jp') || attachment[0].includes('.png') ||
                                            attachment[0].includes('.gif') || attachment[0].includes('.jfif') || attachment[0].includes('.web')) {
                                            let imageurl = attachment[2]
                                            if (imageurl === undefined) {
                                                imageurl = attachment[1]
                                            }
                                            const extended_previews = (item.data && item.data.preview_image && item.data.preview_image[index]) ? "https://media.discordapp.net" + item.data.preview_image[index] : undefined
                                            const _date = moment(Date.parse(item.date))
                                            resultsArray.push({
                                                id: item.id,
                                                eid: item.eid,
                                                date: {
                                                    iso: _date.toISOString(),
                                                    pretty: _date.format('YYYY-MM-DD HH:mm:ss')
                                                },
                                                entities: {
                                                    full: attachment[1],
                                                    preview: attachment[2],
                                                    ext_preview: extended_previews,
                                                    filename: item.attachment_name,
                                                    meta: {
                                                        width: item.sizeW,
                                                        height: item.sizeH,
                                                        ratio: item.sizeR
                                                    }
                                                },
                                                pinned: (item.fav_date !== null),
                                                fav_date: item.fav_date,
                                                history: {
                                                    name: history_name,
                                                    real_name: item.history_name,
                                                    screen: history_screen,
                                                    type: history_type,
                                                    date: moment(Date.parse(item.history_date)).format('YYYY-MM-DD HH:mm')
                                                },
                                                flagged: (item.flagged === 1),
                                                content: {
                                                    raw: item.content_full,
                                                    clean: clean_content,
                                                    short: clean_content.substr(0,70),
                                                    single: clean_content.split('\n')[0].substr(0,70) + ((clean_content.split('\n')[0].length > 75) ? '...' : '')
                                                },
                                                meta: {
                                                    urls: content_urls,
                                                    search: user_search,
                                                    parent_search: parent_search,
                                                },
                                                media: {
                                                    season: item.season_num,
                                                    episode: item.episode_num,
                                                    show: {
                                                        id: item.show_id,
                                                        name: item.show_name,
                                                        original_name: item.show_original_name,
                                                        background: item.show_background,
                                                        nsfw: item.show_nsfw,
                                                        subtitled: item.show_subtitled,
                                                        poster: item.show_poster,
                                                        meta: item.show_data
                                                    },
                                                    watched: item.wathched_percent,
                                                    date_watched: item.watched_date,
                                                    meta: item.episode_data
                                                },
                                                channel: {
                                                    id: item.channel,
                                                    eid: item.channel_eid,
                                                    vid: (item.virtual_channel_eid) ? item.virtual_channel_eid : undefined,
                                                    vname: (item.virtual_channel_name) ? item.virtual_channel_name : undefined,
                                                    name: channelName,
                                                    icon: item.class_icon,
                                                    class_name: item.class_name,
                                                    class: item.classification
                                                },
                                                user: post_user,
                                                server: {
                                                    id: item.server,
                                                    name: item.server_short_name.toUpperCase(),
                                                    icon: `https://cdn.discordapp.com/icons/${item.server}/${item.server_avatar}.png?size=4096`
                                                }
                                            })
                                            imagesArray.push(imageurl);
                                        }
                                    })
                                } else if (item.attachment_hash !== null || item.cache_proxy !== null) {
                                    let filename = item.attachment_name
                                    let fileid = ''
                                    let inprogress = false
                                    const isCached = (!!(item.fileid && item.filecached === 1 && (global.fw_serve || global.spanned_cache)))
                                    if (item.real_filename !== null) {
                                        filename = item.real_filename
                                        fileid = item.fileid
                                    }
                                    let imageurl = null
                                    let fullimage = null
                                    let downloadimage = null

                                    if (item.attachment_hash && item.attachment_name) {
                                        fullimage = fullimage = imageurl = downloadimage = `https://cdn.discordapp.com/attachments/` + ((item.attachment_hash.includes('/')) ? item.attachment_hash : `${item.channel}/${item.attachment_hash}/${item.attachment_name}`)
                                    } else if (item.fileid) {
                                        fullimage = `/stream/${item.fileid}/${item.real_filename}`
                                    } else if (item.cache_proxy) {
                                        fullimage = fullimage = imageurl = downloadimage = item.cache_proxy.startsWith('http') ? item.cache_proxy : `https://media.discordapp.net/attachments${item.cache_proxy}`
                                    }
                                    if (isCached) {
                                        fullimage = (fullimage) ? fullimage : `/stream/${item.fileid}/${item.real_filename}`
                                    }
                                    if (item.fileid) {
                                        downloadimage = `/stream/${item.fileid}/${encodeURIComponent(item.real_filename)}`
                                    }
                                    if (item.cache_proxy) {
                                        imageurl = item.cache_proxy.startsWith('http') ? item.cache_proxy : `https://media.discordapp.net/attachments${item.cache_proxy}`
                                    } else if (item.attachment_hash && item.attachment_name) {
                                        function getimageSizeParam() {
                                            if (item.sizeH && item.sizeW && Discord_CDN_Accepted_Files.indexOf(item.attachment_name.split('.').pop().toLowerCase()) !== -1 && (item.sizeH > 512 || item.sizeW > 512)) {
                                                let ih = 512;
                                                let iw = 512;
                                                if (item.sizeW >= item.sizeH) {
                                                    iw = (item.sizeW * (512 / item.sizeH)).toFixed(0)
                                                } else {
                                                    ih = (item.sizeH * (512 / item.sizeW)).toFixed(0)
                                                }
                                                return `?width=${iw}&height=${ih}`
                                            } else {
                                                return ''
                                            }
                                        }
                                        imageurl = `https://media.discordapp.net/attachments/` + ((item.attachment_hash.includes('/')) ? `${item.attachment_hash}${getimageSizeParam()}` : `${item.channel}/${item.attachment_hash}/${item.attachment_name}${getimageSizeParam()}`)
                                    }
                                    let advColor = [];
                                    if (!(item.colorR === null || item.colorG === null || item.colorB === null || (item.colorR === 0 && item.colorG === 0 && item.colorB === 0))) {
                                        advColor = [
                                            item.colorR,
                                            item.colorG,
                                            item.colorB,
                                            item.dark_color
                                        ]
                                    } else {
                                        sendData(global.mq_discord_out, {
                                            fromClient : `return.Sequenzia.${config.system_name}`,
                                            messageReturn: false,
                                            messageID: item.id,
                                            messageChannelID : item.channel,
                                            messageType: 'command',
                                            messageAction: 'CacheColor',
                                        }, function (ok) { })
                                    }
                                    const _date = moment(Date.parse(item.date))
                                    const extended_previews = (item.data && item.data.preview_image) ? "https://media.discordapp.net" + item.data.preview_image : undefined
                                    resultsArray.push({
                                        id: item.id,
                                        eid: item.eid,
                                        date: {
                                            iso: _date.toISOString(),
                                            pretty: _date.format('YYYY-MM-DD HH:mm:ss')
                                        },
                                        entities: {
                                            full: fullimage,
                                            download: downloadimage,
                                            preview: imageurl,
                                            ext_preview: extended_previews,
                                            filename: filename,
                                            meta: {
                                                width: item.sizeW,
                                                height: item.sizeH,
                                                ratio: item.sizeR,
                                                color: advColor,
                                                filesize,
                                                filename_attachment: item.attachment_name,
                                                fileid,
                                            }
                                        },
                                        pinned: (item.fav_date !== null),
                                        fav_date: item.fav_date,
                                        history: {
                                            name: history_name,
                                            real_name: item.history_name,
                                            screen: history_screen,
                                            type: history_type,
                                            date: moment(Date.parse(item.history_date)).format('YYYY-MM-DD HH:mm')
                                        },
                                        flagged: (item.flagged === 1),
                                        content: {
                                            raw: item.content_full,
                                            clean: clean_content,
                                            short: clean_content.substr(0,70),
                                            single: clean_content.split('\n')[0].substr(0,70) + ((clean_content.split('\n')[0].length > 75) ? '...' : '')
                                        },
                                        meta: {
                                            urls: content_urls,
                                            search: user_search,
                                            parent_search: parent_search,
                                            cached: isCached,
                                            proccessing: inprogress,
                                        },
                                        media: {
                                            season: item.season_num,
                                            episode: item.episode_num,
                                            show: {
                                                id: item.show_id,
                                                name: item.show_name,
                                                original_name: item.show_original_name,
                                                background: item.show_background,
                                                nsfw: item.show_nsfw,
                                                subtitled: item.show_subtitled,
                                                poster: item.show_poster,
                                                meta: item.show_data
                                            },
                                            watched: item.wathched_percent,
                                            date_watched: item.watched_date,
                                            meta: item.episode_data
                                        },
                                        channel: {
                                            id: item.channel,
                                            eid: item.channel_eid,
                                            vid: (item.virtual_channel_eid) ? item.virtual_channel_eid : undefined,
                                            vname: (item.virtual_channel_name) ? item.virtual_channel_name : undefined,
                                            name: channelName,
                                            icon: item.class_icon,
                                            class_name: item.class_name,
                                            class: item.classification
                                        },
                                        user: post_user,
                                        server: {
                                            id: item.server,
                                            name: item.server_short_name.toUpperCase(),
                                            icon: `https://cdn.discordapp.com/icons/${item.server}/${item.server_avatar}.png?size=4096`
                                        },
                                        permalink: downloadlink,
                                        manage: (req.session.discord.channels.manage.indexOf(item.channel) !== -1)
                                    })
                                    imagesArray.push(imageurl);
                                }
                            }
                        })
                    } else if (page_uri === '/files' || page_uri === '/cards') {
                        messages.forEach((item, index) => {
                            if (index + 1 <= limit) {
                                realoffset++
                                let decoded_content =  item.content_full.split('`').join('')
                                let content_urls = []
                                if (decoded_content.includes('Twitter Image')) {
                                    content_urls.push(`https://twitter.com/${decoded_content.split('(@').pop().split(')')[0].split('***')[1]}`)
                                } else {
                                    content_urls = Array.from(getUrls(decoded_content));
                                }
                                let filename = item.attachment_name
                                let fileid = ''
                                let filesize = 'Unknown'
                                let downloadlink = null
                                if (item.real_filename !== null) {
                                    filename = item.real_filename
                                    fileid = item.fileid
                                }
                                if (item.filesize !== null) {
                                    if (item.filesize > 100000) {
                                        filesize = (item.filesize / 100000).toFixed(2) + ' TB'
                                    } else if (item.filesize > 1000) {
                                        filesize = (item.filesize / 1000).toFixed(2) + ' GB'
                                    } else if (item.filesize > 1) {
                                        filesize = item.filesize + ' MB'
                                    } else {
                                        filesize = '< 1 MB'
                                    }
                                }
                                if (decoded_content.includes('🧩 File : ')) {
                                    decoded_content = decoded_content.split("\n").filter((e,i) => { if (i > 1) { return e } }).join("\n")
                                }
                                let clean_content = decoded_content.replace('/^[ ]+|[ ]+$/g', '').split("***").join("").split("**").join("").split("*").join("").split("`").join("").split("__").join("").split("~~").join("").split("||").join("").split("<#").join("").split("<!@").join("").split(">").join("")
                                if (clean_content.includes('Twitter Image') && clean_content.split("\n").length > 1) {
                                    let _ca = clean_content.split("\n")
                                    _ca.shift()
                                    clean_content = _ca.join('\n')
                                }
                                const isCached = (!!(item.fileid && item.filecached === 1 && (global.fw_serve || global.spanned_cache)))
                                let channelName = ''
                                if (item.channel_nice) {
                                    channelName = item.channel_nice
                                } else {
                                    item.channel_name.split('-').forEach((wd, i, a) => {
                                        channelName +=  wd.substring(0,1).toUpperCase() + wd.substring(1,wd.length)
                                        if (i + 1  < a.length) {
                                            channelName += ' '
                                        }
                                    })
                                }
                                const _date = moment(Date.parse(item.date))
                                let post_user = (() => {
                                    const _u = (user_index.indexOf(item.user) !== -1) ? users[user_index.indexOf(item.user)] : false
                                    if (_u) {
                                        return {
                                            id: item.user,
                                            name: (_u.nice_name) ? _u.nice_name: _u.username,
                                            avatar: (_u.avatar) ? `https://cdn.discordapp.com/avatars/${item.user}/${_u.avatar}.png?size=512` : null,
                                        }
                                    }
                                    return {
                                        id: item.user
                                    }
                                })()

                                let _message_type
                                let _message_extra
                                let _message_header

                                if (item.fileid !== null && item.attachment_hash !== null && item.attachment_name !== null && (item.attachment_name.includes('.jp') || item.attachment_name.includes('.jfif') || item.attachment_name.includes('.png') || item.attachment_name.includes('.gif'))) {
                                    _message_header = '🖼 Large Image'
                                    if (isCached) {
                                        _message_type = 'image-unpacked'
                                        _message_header += `(${filesize})`
                                    } else {
                                        _message_header += ` (Packed - ${filesize})`
                                        _message_type = 'image-packed'
                                    }
                                } else if (item.attachment_hash !== null && item.attachment_name !== null && (item.attachment_name.includes('.jp') || item.attachment_name.includes('.jfif') || item.attachment_name.includes('.png') || item.attachment_name.includes('.gif'))) {
                                    _message_type = 'image'
                                    _message_header = '🖼 Image'
                                } else if (item.content_full.length > 5 && !item.content_full.startsWith("`") && (item.content_full.includes('://youtube.com/') || item.content_full.includes('://youtu.be/'))) {
                                    _message_type = 'youtube-video'
                                    _message_header = '📼 YouTube Video'
                                } else if (item.content_full.length > 5 && !item.content_full.startsWith("`")  && item.content_full.includes('://')) {
                                    _message_type = 'link'
                                    _message_header = '🔗 Link'
                                } else if (item.fileid !== null && item.filecached === 1) {
                                    _message_type = 'file-unpacked'
                                    _message_header = `🗄 Large File (${filesize})`
                                } else if (item.fileid !== null) {
                                    _message_type = 'file-packed'
                                    _message_header = `📦 Packed File (${filesize})`
                                } else if (item.attachment_hash !== null) {
                                    _message_type = 'file'
                                    _message_header = `🗄 File (${filesize})`
                                } else if (item.content_full.length > 5) {
                                    _message_type = 'text'
                                    _message_header = '✉️ Message'
                                } else {
                                    _message_type = 'unknown'
                                    _message_header = '❓ Unknown'
                                }
                                if (item.content_full.length > 5 && ( item.content_full.includes('** - ***') || item.content_full.includes('** - `'))) {
                                    _message_extra = 'cms-item'
                                    _message_header = item.content_full.split('** - ')[0].substr(2).split('-')[0]
                                }

                                let history_type = null;
                                let history_screen = null;
                                let history_name = null;
                                if (item.history_name) {
                                    history_name = (item.config_nice) ? item.config_nice : item.history_name;
                                    if (item.history_name.startsWith('ADSMicro-')) {
                                        history_type = 'ads-micro'
                                        if (item.history_name.includes('Untitled')) {
                                            history_name = 'Desktop'
                                        } else {
                                            history_name = history_name.split('ADSMicro-').pop();
                                        }
                                    } else if (item.history_name.startsWith('ADSWidget-')) {
                                        history_type = 'ads-widget'
                                        if (item.history_name.includes('Untitled')) {
                                            history_name = 'Widget'
                                        } else {
                                            history_name = history_name.split('ADSWidget-').pop();
                                        }
                                    } else if (item.history_name.startsWith('ADSEmbed-')) {
                                        history_type = 'ads-embed'
                                        if (item.history_name.includes('Untitled')) {
                                            history_name = 'Randomizer'
                                        } else {
                                            history_name = history_name.split('ADSEmbed-').pop();
                                        }
                                    } else if (item.history_name.startsWith('ADSMobile-')) {
                                        history_type = 'ads-mobile'
                                        if (item.history_name.includes('Untitled')) {
                                            history_name = 'Mobile'
                                        } else {
                                            history_name = history_name.split('ADSMobile-').pop();
                                        }
                                        if (item.history_screen !== null && item.history_screen === 0) {
                                            history_screen = "Home"
                                        } else if (item.history_screen !== null && item.history_screen === 1) {
                                            history_screen = "Lock"
                                        }
                                    } else if (item.history_name.startsWith('ADS')) {
                                        history_type = 'ads-generic'
                                    } else if (item.history_name === 'Homepage') {
                                        history_type = 'homepage'
                                        history_name = "Homepage";
                                    } else if (item.history_name === 'WebExtension') {
                                        history_type = 'webextention'
                                    } else {
                                        history_type = 'ads-lite'
                                        if (item.history_name.includes('Untitled')) {
                                            history_name = 'Default'
                                        }
                                    }
                                }


                                if (item.cache_proxy === null && filename && (filename.toLowerCase().includes('.mp4') || filename.toLowerCase().includes('.mov') || filename.toLowerCase().includes('.m4v') || filename.toLowerCase().includes('.mkv') || filename.toLowerCase().includes('.ts'))) {
                                    if ((item.cache_proxy === null && item.cache_proxy !== 'failed') && global.enable_polyfill_proxy_request) {
                                        sendData(global.mq_discord_out, {
                                            fromClient : `return.Sequenzia.${config.system_name}`,
                                            messageReturn: false,
                                            messageID: item.id,
                                            messageChannelID : item.channel,
                                            messageServerID : item.server,
                                            messageType: 'command',
                                            messageAction: 'CacheVideo',
                                        }, function (ok) { })
                                    }
                                }
                                const extended_previews = (item.data && item.data.preview_image) ? "https://media.discordapp.net" + item.data.preview_image : undefined;

                                if (item.attachment_extra !== null) {
                                    // Unpack data here
                                    const extractedItems = JSON.parse(item.attachment_extra)
                                    extractedItems.reverse().forEach(function (attachment) {
                                        const _date = moment(Date.parse(item.date))
                                        resultsArray.push({
                                            id: item.id,
                                            eid: item.eid,
                                            date: {
                                                iso: _date.toISOString(),
                                                pretty: _date.format('YYYY-MM-DD HH:mm:ss')
                                            },
                                            entities: {
                                                full: attachment[1],
                                                preview: attachment[2],
                                                ext_preview: extended_previews,
                                                filename: item.attachment_name,
                                                meta: {
                                                    width: item.sizeW,
                                                    height: item.sizeH,
                                                    ratio: item.sizeR
                                                }
                                            },
                                            pinned: (item.fav_date !== null),
                                            fav_date: item.fav_date,
                                            history: {
                                                name: history_name,
                                                real_name: item.history_name,
                                                screen: history_screen,
                                                type: history_type,
                                                date: moment(Date.parse(item.history_date)).format('YYYY-MM-DD HH:mm')
                                            },
                                            flagged: (item.flagged === 1),
                                            content: {
                                                raw: item.content_full,
                                                clean: clean_content,
                                                short: clean_content.substr(0,70),
                                                single: clean_content.split('\n')[0].substr(0,70) + ((clean_content.split('\n')[0].length > 75) ? '...' : '')
                                            },
                                            meta: {
                                                urls: content_urls,
                                                message_type: _message_type,
                                                message_extra: _message_extra,
                                                message_header: _message_header,
                                            },
                                            media: {
                                                season: item.season_num,
                                                episode: item.episode_num,
                                                show: {
                                                    id: item.show_id,
                                                    name: item.show_name,
                                                    original_name: item.show_original_name,
                                                    background: item.show_background,
                                                    nsfw: item.show_nsfw,
                                                    subtitled: item.show_subtitled,
                                                    poster: item.show_poster,
                                                    meta: item.show_data
                                                },
                                                watched: item.wathched_percent,
                                                date_watched: item.watched_date,
                                                meta: item.episode_data
                                            },
                                            channel: {
                                                id: item.channel,
                                                eid: item.channel_eid,
                                                vid: (item.virtual_channel_eid) ? item.virtual_channel_eid : undefined,
                                                vname: (item.virtual_channel_name) ? item.virtual_channel_name : undefined,
                                                name: channelName,
                                                icon: item.class_icon,
                                                class_name: item.class_name,
                                                class: item.classification
                                            },
                                            user: post_user,
                                            server: {
                                                id: item.server,
                                                name: item.server_short_name.toUpperCase(),
                                                icon: `https://cdn.discordapp.com/icons/${item.server}/${item.server_avatar}.png?size=4096`
                                            }
                                        })
                                    })
                                } else if (item.attachment_hash !== null) {
                                    let imageurl = undefined
                                    let fullurl
                                    let downloadurl
                                    downloadlink = `/content/link/${item.channel}/${item.id}/`
                                    fullurl = downloadurl = imageurl = `https://cdn.discordapp.com/attachments/` + ((item.attachment_hash.includes('/')) ? `${item.attachment_hash}` : `${item.channel}/${item.attachment_hash}/${item.attachment_name}`)

                                    if (item.cache_proxy !== null) {
                                        imageurl = item.cache_proxy.startsWith('http') ? item.cache_proxy : `https://media.discordapp.net/attachments${item.cache_proxy}`
                                    } else if (item.attachment_hash && item.attachment_name) {
                                        function getimageSizeParam() {
                                            if (item.sizeH && item.sizeW && Discord_CDN_Accepted_Files.indexOf(item.attachment_name.split('.').pop().toLowerCase()) !== -1 && (item.sizeH > 512 || item.sizeW > 512)) {
                                                let ih = 512;
                                                let iw = 512;
                                                if (item.sizeW >= item.sizeH) {
                                                    iw = (item.sizeW * (512 / item.sizeH)).toFixed(0)
                                                } else {
                                                    ih = (item.sizeH * (512 / item.sizeW)).toFixed(0)
                                                }
                                                return `?width=${iw}&height=${ih}`
                                            } else {
                                                return ''
                                            }
                                        }
                                        imageurl = `https://media.discordapp.net/attachments/` + ((item.attachment_hash.includes('/')) ? `${item.attachment_hash}${getimageSizeParam()}` : `${item.channel}/${item.attachment_hash}/${item.attachment_name}${getimageSizeParam()}`)
                                    } else if (filename && (filename.toLowerCase().includes('.mp4') || filename.toLowerCase().includes('.mov') || filename.toLowerCase().includes('.m4v') || filename.toLowerCase().includes('.mkv') || filename.toLowerCase().includes('.ts'))) {
                                        if (item.cache_proxy === null && item.cache_proxy !== 'failed' && global.enable_polyfill_proxy_request) {
                                            sendData(global.mq_discord_out, {
                                                fromClient : `return.Sequenzia.${config.system_name}`,
                                                messageReturn: false,
                                                messageID: item.id,
                                                messageChannelID : item.channel,
                                                messageServerID : item.server,
                                                messageType: 'command',
                                                messageAction: 'CacheVideo',
                                            }, function (ok) { })
                                        }
                                    }
                                    const extended_previews = (item.data && item.data.preview_image) ? "https://media.discordapp.net" + item.data.preview_image : undefined
                                    let inprogress = false
                                    if (item.fileid !== null) {
                                        downloadurl = `/stream/${item.fileid}/${encodeURIComponent(item.real_filename)}`
                                    }
                                    resultsArray.push({
                                        id: item.id,
                                        eid: item.eid,
                                        date: {
                                            iso: _date.toISOString(),
                                            pretty: _date.format('YYYY-MM-DD HH:mm:ss')
                                        },
                                        entities: {
                                            full: fullurl,
                                            download: downloadurl,
                                            preview: imageurl,
                                            ext_preview: extended_previews,
                                            filename: filename,
                                            meta: {
                                                width: item.sizeW,
                                                height: item.sizeH,
                                                ratio: item.sizeR,
                                                filesize,
                                                filename_attachment: item.attachment_name,
                                                fileid,
                                            }
                                        },
                                        pinned: (item.fav_date !== null),
                                        fav_date: item.fav_date,
                                        history: {
                                            name: history_name,
                                            real_name: item.history_name,
                                            screen: history_screen,
                                            type: history_type,
                                            date: moment(Date.parse(item.history_date)).format('YYYY-MM-DD HH:mm')
                                        },
                                        flagged: (item.flagged === 1),
                                        content: {
                                            raw: item.content_full,
                                            clean: clean_content,
                                            short: clean_content.substr(0,70),
                                            single: clean_content.split('\n')[0].substr(0,70) + ((clean_content.split('\n')[0].length > 75) ? '...' : '')
                                        },
                                        meta: {
                                            urls: content_urls,
                                            cached: isCached,
                                            proccessing: inprogress,
                                            message_type: _message_type,
                                            message_extra: _message_extra,
                                            message_header: _message_header,
                                        },
                                        media: {
                                            season: item.season_num,
                                            episode: item.episode_num,
                                            show: {
                                                id: item.show_id,
                                                name: item.show_name,
                                                original_name: item.show_original_name,
                                                background: item.show_background,
                                                nsfw: item.show_nsfw,
                                                subtitled: item.show_subtitled,
                                                poster: item.show_poster,
                                                meta: item.show_data
                                            },
                                            watched: item.wathched_percent,
                                            date_watched: item.watched_date,
                                            meta: item.episode_data
                                        },
                                        channel: {
                                            id: item.channel,
                                            eid: item.channel_eid,
                                            vid: (item.virtual_channel_eid) ? item.virtual_channel_eid : undefined,
                                            vname: (item.virtual_channel_name) ? item.virtual_channel_name : undefined,
                                            name: channelName,
                                            icon: item.class_icon,
                                            class_name: item.class_name,
                                            class: item.classification
                                        },
                                        user: post_user,
                                        server: {
                                            id: item.server,
                                            name: item.server_short_name.toUpperCase(),
                                            icon: `https://cdn.discordapp.com/icons/${item.server}/${item.server_avatar}.png?size=4096`
                                        },
                                        permalink: downloadlink,
                                        manage: (req.session.discord.channels.manage.indexOf(item.channel) !== -1)
                                    })
                                } else {
                                    downloadlink = `/content/link/${item.channel}/${item.id}/`
                                    let fullurl = null
                                    let inprogress = false
                                    let imageurl = null;
                                    if (item.cache_proxy !== null) {
                                        imageurl = item.cache_proxy.startsWith('http') ? item.cache_proxy : `https://media.discordapp.net/attachments${item.cache_proxy}`
                                    }
                                    if (item.fileid !== null) {
                                        fullurl = `/stream/${item.fileid}/${encodeURIComponent(item.real_filename)}`
                                    }
                                    resultsArray.push({
                                        id: item.id,
                                        eid: item.eid,
                                        date: {
                                            iso: _date.toISOString(),
                                            pretty: _date.format('YYYY-MM-DD HH:mm:ss')
                                        },
                                        entities: {
                                            full: fullurl,
                                            download: fullurl,
                                            preview: imageurl,
                                            filename: filename,
                                            meta: {
                                                width: item.sizeW,
                                                height: item.sizeH,
                                                ratio: item.sizeR,
                                                filesize,
                                                filename_attachment: item.attachment_name,
                                                fileid,
                                            }
                                        },
                                        pinned: (item.fav_date !== null),
                                        fav_date: item.fav_date,
                                        history: {
                                            name: history_name,
                                            real_name: item.history_name,
                                            screen: history_screen,
                                            type: history_type,
                                            date: moment(Date.parse(item.history_date)).format('YYYY-MM-DD HH:mm')
                                        },
                                        flagged: (item.flagged === 1),
                                        content: {
                                            raw: item.content_full,
                                            clean: clean_content,
                                            short: clean_content.substr(0,70),
                                            single: clean_content.split('\n')[0].substr(0,70) + ((clean_content.split('\n')[0].length > 75) ? '...' : '')
                                        },
                                        meta: {
                                            urls: content_urls,
                                            cached: isCached,
                                            proccessing: inprogress,
                                            message_type: _message_type,
                                            message_extra: _message_extra,
                                            message_header: _message_header,
                                        },
                                        media: {
                                            season: item.season_num,
                                            episode: item.episode_num,
                                            show: {
                                                id: item.show_id,
                                                name: item.show_name,
                                                original_name: item.show_original_name,
                                                background: item.show_background,
                                                nsfw: item.show_nsfw,
                                                subtitled: item.show_subtitled,
                                                poster: item.show_poster,
                                                meta: item.show_data
                                            },
                                            watched: item.wathched_percent,
                                            date_watched: item.watched_date,
                                            meta: item.episode_data
                                        },
                                        channel: {
                                            id: item.channel,
                                            eid: item.channel_eid,
                                            vid: (item.virtual_channel_eid) ? item.virtual_channel_eid : undefined,
                                            vname: (item.virtual_channel_name) ? item.virtual_channel_name : undefined,
                                            name: channelName,
                                            icon: item.class_icon,
                                            class_name: item.class_name,
                                            class: item.classification
                                        },
                                        user: post_user,
                                        server: {
                                            id: item.server,
                                            name: item.server_short_name.toUpperCase(),
                                            icon: `https://cdn.discordapp.com/icons/${item.server}/${item.server_avatar}.png?size=4096`
                                        },
                                        permalink: downloadlink,
                                        manage: (req.session.discord.channels.manage.indexOf(item.channel) !== -1)
                                    })
                                }
                            }
                        })
                    }
                    if (resultsArray.length > 0) {
                        writeHistory((full_title) ? full_title : page_title)
                        let prevurl = 'NA'
                        let nexturl = 'NA'
                        if (offset >= limit) {
                            if (realoffset < limit) {
                                prevurl = `['offset', "${offset - limit}"]`;
                            } else {
                                prevurl = `['offset', "${offset - realoffset}"]`;
                            }
                        }
                        if (resultsArray.length >= limit) {
                            nexturl = `['offset', "${offset + realoffset}"]`;
                        }

                        let _req_uri = req.protocol + '://' + req.get('host') + req.originalUrl;

                        debugTimes.post_proccessing = (new Date() - debugTimes.post_proccessing) / 1000;
                        res.locals.response = {
                            title: page_title,
                            full_title: full_title,
                            page_image,
                            description: description,
                            channel_url: discordPath,
                            results: resultsArray,
                            prevurl: prevurl,
                            nexturl: nexturl,
                            req_limit: limit,
                            req_offset: offset,
                            call_uri: page_uri,
                            android_uri: android_uri.join("&"),
                            req_uri: _req_uri,
                            search_prev: search_prev,
                            multiChannel: multiChannel,
                            active_ch: currentChannelId,
                            active_svr: currentServerId,
                            active_pt: currentClassification,
                            active_icon: currentClassIcon,
                            nsfwEnabled: req.session.nsfwEnabled,
                            pageinatorEnable: req.session.pageinatorEnable,
                            server: req.session.server_list,
                            download: req.session.discord.servers.download,
                            manage_channels: req.session.discord.channels.manage,
                            write_channels: req.session.discord.channels.write,
                            discord: req.session.discord,
                            user: req.session.user,
                            albums: (req.session.albums && req.session.albums.length > 0) ? req.session.albums : [],
                            theaters: (req.session.media_groups && req.session.media_groups.length > 0) ? req.session.media_groups : [],
                            next_episode: req.session.kongou_next_episode,
                            applications_list: req.session.applications_list,
                            device: ua,
                            folderInfo
                        }
                        printLine('GetData', `"${req.session.discord.user.username}" => "${page_title}" - ${resultsArray.length} Returned (${_req_uri})`, 'info', {
                            title: page_title,
                            full_title: full_title,
                            page_image,
                            description: description,
                            channel_url: discordPath,
                            num_images: resultsArray.length,
                            prevurl: prevurl,
                            nexturl: nexturl,
                            req_limit: limit,
                            req_offset: offset,
                            req_uri: _req_uri.split('?').pop(),
                            call_uri: page_uri,
                            search_prev: search_prev,
                            multiChannel: multiChannel,
                            active_ch: currentChannelId,
                            active_svr: currentServerId,
                            active_pt: currentClassification,
                            active_icon: currentClassIcon,
                            username: req.session.discord.user.username,
                            folderInfo
                        })
                        console.log(debugTimes);
                        res.locals.debugTimes = debugTimes;
                        next();
                    } else {
                        printLine('GetImages', `No Results were returned`, 'warn');
                        res.locals.response = {
                            search_prev: search_prev,
                            multiChannel: multiChannel,
                            active_ch: currentChannelId,
                            active_svr: currentServerId,
                            active_pt: currentClassification,
                            active_icon: currentClassIcon,
                            server: req.session.server_list,
                            download: req.session.discord.servers.download,
                            nsfwEnabled: req.session.nsfwEnabled,
                            pageinatorEnable: req.session.pageinatorEnable,
                            req_uri: req.originalUrl,
                            call_uri: page_uri,
                            manage_channels: req.session.discord.channels.manage,
                            write_channels: req.session.discord.channels.write,
                            discord: req.session.discord,
                            user: req.session.user,
                            albums: (req.session.albums && req.session.albums.length > 0) ? req.session.albums : [],
                            theaters: (req.session.media_groups && req.session.media_groups.length > 0) ? req.session.media_groups : [],
                            next_episode: req.session.kongou_next_episode,
                            applications_list: req.session.applications_list,
                            device: ua,
                        }
                        next();
                    }
                })(messageResults.rows);
            } else {
                printLine('GetImages', `No Results were returned`, 'warn');
                res.locals.response = {
                    search_prev: search_prev,
                    multiChannel: multiChannel,
                    server: req.session.server_list,
                    download: req.session.discord.servers.download,
                    req_uri: req.originalUrl,
                    call_uri: page_uri,
                    manage_channels: req.session.discord.channels.manage,
                    write_channels: req.session.discord.channels.write,
                    discord: req.session.discord,
                    user: req.session.user,
                    albums: (req.session.albums && req.session.albums.length > 0) ? req.session.albums : [],
                    theaters: (req.session.media_groups && req.session.media_groups.length > 0) ? req.session.media_groups : [],
                    next_episode: req.session.kongou_next_episode,
                    applications_list: req.session.applications_list,
                    device: ua,
                }
                next();
            }
        }
    }
}
