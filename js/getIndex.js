const global = require('../config.json');
const config = require('../host.config.json');
const { printLine } = require("./logSystem");
const { sqlPromiseSimple, sqlPromiseSafe } = require('../js/sqlClient');
const { sendData } = require('./mqAccess');
const getUrls = require('get-urls');
const moment = require('moment');
const useragent = require('express-useragent');

module.exports = async (req, res, next) => {
    const source = req.headers['user-agent']
    const ua = (source) ? useragent.parse(source) : undefined
    const page_uri = `/${req.originalUrl.split('/')[1].split('?')[0]}`
    let search_prev = ''

    if (!req.session.discord) {
        res.locals.response = {
            search_prev: search_prev,
            manage_channels: req.session.discord.channels.manage,
            write_channels: req.session.discord.channels.write,
            discord: req.session.discord,
            user: req.session.user,
            albums: (req.session.albums && req.session.albums.length > 0) ? req.session.albums : [],
            device: ua
        };
        next();
    } else {
        let multiChannel = false;
        let multiChannelBase = false;

        let limit = 1;
        let offset = 0;

        let sqlquery = [];
        let sqlorder = 'y.fav_date DESC, x.artist_count DESC, x.artist_full_name, x.artist';

        // Limit
         if (req.query.num) {
            const _limit = parseInt(req.query.num);
            if (!isNaN(limit)) {
                limit = _limit;
            }
        } else if (req.query.limit && !isNaN(parseInt(req.query.limit))) {
            limit = parseInt(req.query.limit.toString().substring(0,4))
        } else {
             limit = 100;
        }
        // Offset
        if (req.query.offset && !isNaN(parseInt(req.query.offset.toString()))) {
            offset = parseInt(req.query.offset.toString().substring(0,6))
        }

        // Sorting
        let sqlrevered = false;
        if (req.query.reverse === 'true' && req.query.sort !== 'random') {
            sqlrevered = true;
        }
        if (req.query.sort === 'random') {
            sqlorder =  `RAND()`
        } else if (req.query.sort === 'count') {
            sqlorder = `x.artist_count ${(sqlrevered) ? 'ASC' : 'DESC'}`
        } else if (req.query.sort === 'name') {
            sqlorder = `x.artist ${(sqlrevered) ? 'DESC' : 'ASC'}`
        } else if (req.query.sort === 'fav') {
            sqlorder = `y.fav_date ${(sqlrevered) ? 'ASC' : 'DESC'}`
        } else if (req.query.sort === 'eid') {
            sqlorder = `x.artist_last ${(sqlrevered) ? 'ASC' : 'DESC'}`
        } else {
            sqlorder = `y.fav_date ${(sqlrevered) ? 'ASC' : 'DESC'}, x.artist_count DESC, x.artist_full_name, x.artist`
        }

        // Search
        if (req.query.search !== undefined && req.query.search !== '' ) {
            if (req.query.search.includes(' OR ')) {
                let _orOptions = []
                req.query.search.split(' OR ').forEach((or) => {
                    or.split(' ').forEach((queryString) => {
                        _orOptions.push('(' + [
                            `sequenzia_index_artists.artist LIKE '%${queryString}%'`,
                            `sequenzia_index_artists.name LIKE '%${queryString}%'`
                        ].join(' OR ') + ')');
                    });
                })
                sqlquery.push('(' + _orOptions.join(' OR ') + ')');
            } else {
                req.query.search.split(' ').forEach((queryString) => {
                    sqlquery.push('(' + [
                        `sequenzia_index_artists.artist LIKE '%${queryString}%'`,
                        `sequenzia_index_artists.name LIKE '%${queryString}%'`
                    ].join(' OR ') + ')');
                });
            }
            search_prev = decodeURIComponent(req.query.search)
        }

        // Main Query
        let baseQ = ''
        if (req.query.channel && req.query.channel === 'random') {
            multiChannel = true;
        } else if (req.query.vchannel) {
            multiChannel = true;
            let _ch = req.query.vchannel.split(' ')
            if (_ch.length > 1) {
                let _andStat = []
                _ch.forEach((c) => {
                    _andStat.push(`${req.session.cache.channels_view}.virtual_channel_eid = '${c}'`)
                })
                baseQ += `(${_andStat.join(' OR ')}) AND`;
            } else {
                baseQ += `${req.session.cache.channels_view}.virtual_channel_eid = ${req.query.vchannel} AND `;
            }
        } else if (req.query.channel && req.query.channel !== 'random') {
            let _ch = req.query.channel.split(' ')
            if (_ch.length > 1) {
                let _andStat = []
                _ch.forEach((c) => {
                    _andStat.push(`${req.session.cache.channels_view}.channelid = '${c}'`)
                })
                baseQ += `(${_andStat.join(' OR ')}) AND`;
                multiChannel = true;
            } else {
                baseQ += `${req.session.cache.channels_view}.channelid = ${req.query.channel} AND `;
            }
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

                console.log(c)
                if (c.length > 0) {
                    // If server is name is present
                    let _os = 0;
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
                    console.log(`${fsv} - ${fcl} - ${fch}`)

                    let _q = [];
                    // Extract Servers
                    if (fsv) {
                        let _svAND = [];
                        // Parse Server ID or Short Name
                        fsv.trim().split('~').filter(e => e.length > 0).forEach(e => {
                            if (!isNaN(parseInt(e.toString()))) {
                                _svAND.push(`serverid = '${e}'`);
                            } else if (e !== "*") {
                                _svAND.push(`LOWER(server_short_name) = LOWER('${e}')`);
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
                                hideChannels = false;
                            } else if (e.includes('virt_')) {
                                _svAND.push(`virtual_channel_eid = '${e.split('virt_').pop()}'`)
                            } else if (e !== '*') {
                                _svAND.push(`LOWER(channel_short_name) = LOWER('${e}')`)
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
        let channelFilter = `${baseQ}`
        if ((req.query.nsfw && req.query.nsfw === 'true') || (req.session.nsfwEnabled && req.session.nsfwEnabled === true)) {
            channelFilter += `( channel_nsfw = 0 OR channel_nsfw = 1 )`;
        } else if (req.query.nsfw && req.query.nsfw === 'only') {
            channelFilter += `( channel_nsfw = 1 )`;
        } else {
            channelFilter += `( channel_nsfw = 0 )`;
        }
        //  Finalization
        let execute = `(${channelFilter}`
        if (sqlquery.length > 0) {
            execute += ` AND (${sqlquery.join(' AND ')}))`
        } else {
            execute += ')'
        }
        let sqlFields, sqlTables, sqlWhere
        sqlFields = [
            'kanmi_records.attachment_hash',
            'kanmi_records.attachment_name',
            'kanmi_records.cache_proxy',
            'kanmi_records.sizeH',
            'kanmi_records.sizeW',
            'kanmi_records.sizeR',
            'kanmi_records.colorR',
            'kanmi_records.colorG',
            'kanmi_records.colorB',
            'sequenzia_index_artists.id AS artist_id',
            'sequenzia_index_artists.artist',
            'sequenzia_index_artists.name AS artist_full_name',
            'sequenzia_index_artists.url AS artist_url',
            'sequenzia_index_artists.search AS artist_search',
            'sequenzia_index_artists.count AS artist_count',
            `sequenzia_index_artists.last AS artist_last`,
            `sequenzia_index_artists.source AS artist_source`,
            `sequenzia_index_artists.confidence AS artist_confidence`,
            `${req.session.cache.channels_view}.*`,
        ].join(', ');
        sqlTables = [
            'kanmi_records',
            req.session.cache.channels_view,
            'sequenzia_index_artists'
        ].join(', ');
        sqlWhere = [
            `sequenzia_index_artists.channelid = ${req.session.cache.channels_view}.channelid`,
            'kanmi_records.eid = sequenzia_index_artists.last',
            `kanmi_records.channel = ${req.session.cache.channels_view}.channelid`
        ].join(' AND ');

        const sqlCall = `SELECT * FROM (SELECT ${sqlFields} FROM ${sqlTables} WHERE (${execute} AND (${sqlWhere}))) x LEFT OUTER JOIN (SELECT id AS fav_id, date AS fav_date FROM sequenzia_artists_favorites WHERE userid = "${req.session.discord.user.id}") y ON x.artist_id = y.fav_id ORDER BY ${sqlorder}`

        if (req.headers['x-requested-page'] && req.headers['x-requested-page'] === 'SeqPaginator' ) {
            if (req.session.pageinatorEnable && req.session.pageinatorEnable === true) {
                const allresults = await sqlPromiseSafe(`SELECT COUNT(sequenzia_index_artists.id) AS total_count FROM ${sqlTables} WHERE (${execute} AND (${sqlWhere}))`)
                if (allresults && allresults.rows.length > 0) {
                    let pages = [];
                    let currentPage = undefined;
                    let pageList = undefined;
                    let count = allresults.rows[0].total_count;
                    const totalCount = count / limit;
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
                        console.error(e)
                        pageList = undefined
                    }
                    res.render('pageinator', {
                        req_uri: req.protocol + '://' + req.get('host') + req.originalUrl,
                        pageList: pageList,
                        currentPage: currentPage,
                        resultsCount: count,
                    })
                } else {
                    res.end();
                }
            } else {
                res.end();
            }
        } else {
            const sqlResult = await sqlPromiseSimple(`${sqlCall} LIMIT ${limit} OFFSET ${offset}`)
            async function parseResults(results) {
                let page_title;
                let full_title;
                let description;
                let resultsArray = [];
                let resultsImages = [];
                let discordPath = null;
                let currentChannelId = null;
                let currentServerId = null;
                let currentClassification = null;
                let currentNsfw = null;
                let folderInfo;
                let _req_uri = req.protocol + '://' + req.get('host') + req.originalUrl;

                if (req.query.title && req.query.title !== '') {
                    page_title = req.query.title
                    full_title = req.query.title
                    if (req.query.channel) {
                        folderInfo = `${results[0].server_short_name}:${results[0].classification}:${results[0].channel}`
                    } else if (req.query.folder) {
                        folderInfo = decodeURIComponent(req.query.folder);
                    }
                } else if (multiChannelBase) {
                    page_title = `${results[0].class_name}`
                    full_title = `${results[0].class_name}`
                    folderInfo = `${results[0].server_short_name}:${results[0].class_name}:*`
                    if (req.query.folder && !req.query.folder.includes(' ')) {
                        currentClassification = results[0].class_name;
                    }
                } else if ((req.query.channel && req.query.channel !== 'random') || req.query.folder) {
                    page_title = ''
                    full_title = ''
                    if (results[0].class_name) {
                        page_title += `${results[0].class_name} / `
                        full_title += `${results[0].class_name} / `
                    }

                    if (results[0].channel_nice && results[0].channel_nice !== null) {
                        page_title += results[0].channel_nice;
                        full_title += results[0].channel_nice;
                    } else if (results[0].channel_name) {
                        results[0].channel_name.split('-').forEach((wd, i, a) => {
                            page_title +=  wd.substring(0,1).toUpperCase() + wd.substring(1,wd.length);
                            if (i + 1  < a.length) {
                                page_title += ' ';
                            }
                        })
                        full_title = page_title;
                    }
                    if (results[0].channel_description && results[0].channel_description.length > 1) {
                        description = results[0].channel_description
                    }
                    discordPath = `https://discord.com/channels/${results[0].server}/${results[0].channel}/`
                    if (!multiChannel) {
                        currentChannelId = results[0].channel;
                        currentServerId = results[0].server;
                        currentClassification = results[0].class_name;
                        currentNsfw = (results[0].channel_nsfw === 1);
                    }
                    if (req.query.channel) {
                        folderInfo = `${results[0].server_short_name}:${results[0].class_name}:${results[0].channel_short_name}`
                    } else if (req.query.folder) {
                        folderInfo = decodeURIComponent(req.query.folder);
                    }
                } else {
                    page_title = ''
                    full_title = ''
                }

                results.forEach(item => {
                    let advColor = [];
                    let imageurl = null;
                    let channelName = ''
                    if (item.channel_nice === null || item.channel_nice === undefined) {
                        item.channel_name.split('-').forEach((wd, i, a) => {
                            channelName +=  wd.substring(0,1).toUpperCase() + wd.substring(1,wd.length)
                            if (i + 1  < a.length) {
                                channelName += ' '
                            }
                        })
                    } else {
                        channelName = item.channel_nice
                    }
                    if (item.cache_proxy !== null) {
                        imageurl = (item.cache_proxy.startsWith('http') ? item.cache_proxy : `https://media.discordapp.net/attachments${item.cache_proxy}`);
                    } else {
                        function getimageSizeParam() {
                            if (item.sizeH && item.sizeW && (item.sizeH > 512 || item.sizeW > 512)) {
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
                        imageurl = `https://media.discordapp.net/attachments/` + ((item.attachment_hash.includes('/')) ? `${item.attachment_hash}${getimageSizeParam()}` : `${item.channelid}/${item.attachment_hash}/${item.attachment_name}${getimageSizeParam()}`)
                    }
                    if (item.colorR !== null && item.colorG !== null && item.colorB !== null) {
                        advColor = [
                            item.colorR,
                            item.colorG,
                            item.colorB
                        ]

                    }
                    resultsArray.push({
                        id: item.artist_id,
                        entities: {
                            preview: imageurl,
                            meta: {
                                color: advColor,
                                ratio: item.sizeR
                            }
                        },
                        artist: {
                            name: item.artist,
                            nice_name: item.artist_full_name,
                            url: item.artist_url,
                            search: item.artist_search,
                            count: item.artist_count,
                            source: item.artist_source,
                            confidence: item.artist_confidence
                        },
                        channel: {
                            id: item.channelid,
                            name: channelName,
                            class_name: item.class_name,
                            class: item.classification
                        },
                        server: {
                            id: item.server,
                            name: item.server_short_name.toUpperCase()
                        },
                        pinned: (item.fav_date !== null)
                    })
                    resultsImages.push(imageurl);
                })

                let prevurl = 'NA'
                let nexturl = 'NA'
                if (offset >= limit) {
                    if (resultsArray.length < limit) {
                        prevurl = `['offset', "${offset - limit}"]`;
                    } else {
                        prevurl = `['offset', "${offset}"]`;
                    }
                }
                if (resultsArray.length >= limit) {
                    nexturl = `['offset', "${offset + resultsArray.length}"]`;
                }

                res.locals.response = {
                    title: page_title,
                    full_title: full_title,
                    description: description,
                    call_uri: page_uri,
                    results: resultsArray,
                    req_uri: _req_uri,
                    prevurl: prevurl,
                    nexturl: nexturl,
                    search_prev: search_prev,
                    multiChannel: multiChannel,
                    active_ch: currentChannelId,
                    active_svr: currentServerId,
                    active_pt: currentClassification,
                    nsfwEnabled: req.session.nsfwEnabled,
                    pageinatorEnable: req.session.pageinatorEnable,
                    server: req.session.server_list,
                    download: req.session.discord.servers.download,
                    manage_channels: req.session.discord.channels.manage,
                    write_channels: req.session.discord.channels.write,
                    discord: req.session.discord,
                    user: req.session.user,
                    albums: (req.session.albums && req.session.albums.length > 0) ? req.session.albums : [],
                    device: ua,
                    folderInfo
                }
                printLine('GetIndex', `"${req.session.discord.user.username}" => "${page_title}" - ${resultsArray.length} Returned (${_req_uri})`, 'info', {
                    ttitle: page_title,
                    full_title: full_title,
                    description: description,
                    req_uri: _req_uri,
                    call_uri: page_uri,
                    prevurl: prevurl,
                    nexturl: nexturl,
                    search_prev: search_prev,
                    multiChannel: multiChannel,
                    active_ch: currentChannelId,
                    active_svr: currentServerId,
                    active_pt: currentClassification,
                    nsfwEnabled: req.session.nsfwEnabled,
                    pageinatorEnable: req.session.pageinatorEnable,
                    server: req.session.server_list,
                    download: req.session.discord.servers.download,
                    manage_channels: req.session.discord.channels.manage,
                    write_channels: req.session.discord.channels.write,
                    discord: req.session.discord,
                    user: req.session.user,
                    albums: (req.session.albums && req.session.albums.length > 0) ? req.session.albums : [],
                    device: ua,
                    folderInfo
                })
                next();


            }
            if (sqlResult && sqlResult.rows.length > 0) {
                parseResults(sqlResult.rows)
            } else {
                printLine('GetIndex', `No Results were returned`, 'warn');
                res.locals.response = {
                    call_uri: page_uri,
                    search_prev: search_prev,
                    multiChannel: multiChannel,
                    server: req.session.server_list,
                    download: req.session.discord.servers.download,
                    req_uri: req.originalUrl,
                    manage_channels: req.session.discord.channels.manage,
                    write_channels: req.session.discord.channels.write,
                    discord: req.session.discord,
                    user: req.session.user,
                    albums: (req.session.albums && req.session.albums.length > 0) ? req.session.albums : [],
                    device: ua,
                }
                next();
            }

        }

    }
}
