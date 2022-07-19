const global = require('../config.json');
let config = require('../host.config.json');

if (process.env.SYSTEM_NAME && process.env.SYSTEM_NAME.trim().length > 0)
    config.system_name = process.env.SYSTEM_NAME.trim()

let web = require('../web.config.json');
const { printLine } = require("./logSystem");
const { sqlPromiseSafe, sqlPromiseSimple } = require('../js/sqlClient');
const moment = require('moment');
const useragent = require('express-useragent');
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
        let execute = '';
        let limit = 100;
        let offset = 0;

        debugTimes.build_query = new Date();
        // Main Query
        let baseQ = ''
        let media_group = ''
        if (req.query.group) {
            media_group = req.query.group.trim()
        }

        const sqllimit = limit + 1;
        // Offset
        if (req.query.offset && !isNaN(parseInt(req.query.offset.toString()))) {
            offset = parseInt(req.query.offset.toString().substring(0,6))
        }
        let sqlFields, sqlTables, sqlWhere
        sqlFields = [
            'kanmi_records.*',
            `${req.session.cache.channels_view}.*`
        ].join(', ');
        sqlTables = [
            'kanmi_records',
            req.session.cache.channels_view
        ].join(', ');

        const kongouShows = `SELECT kms_ep.eid, kms_show.group_name, kms_show.description, kms_show.icon, kms_show.show_id, kms_ep.episode_num, kms_ep.episode_name AS kms_episode_name, kms_ep.season_num, kms_show.name AS kms_series_name, kms_show.original_name AS kms_series_original_name, kms_show.nsfw AS series_nsfw, kms_show.subtitled AS series_subtitled, kms_show.background, kms_show.poster FROM (SELECT eid, show_id, episode_num, episode_name, season_num, background, still FROM kongou_episodes) kms_ep LEFT OUTER JOIN (SELECT * FROM (SELECT show_id, media_group, name, original_name, nsfw, subtitled, genres, background, poster FROM kongou_shows ${(media_group.length > 0) ? "WHERE media_group = '" + media_group + "'" : ''}) s LEFT JOIN (SELECT media_group AS group_id, type, name AS group_name, description, icon FROM kongou_media_groups) g ON (s.media_group = g.group_id)) kms_show ON (kms_ep.show_id = kms_show.show_id)`

        let sqlCall = `SELECT kms_list.*, kms_data.series_data FROM (SELECT * FROM (SELECT kms.kms_series_name, kms.group_name, kms.icon, kms.series_nsfw, kms.series_subtitled, kms.background, kms.poster, kms.show_id FROM (SELECT ${sqlFields} FROM ${sqlTables} WHERE (kanmi_records.channel = ${req.session.cache.channels_view}.channelid)) main_records LEFT OUTER JOIN (${kongouShows}) kms ON (kms.eid = main_records.eid) WHERE kms_series_name IS NOT NULL GROUP BY kms.show_id) x ORDER BY x.kms_series_name) kms_list INNER JOIN (SELECT show_id, data AS series_data FROM kongou_shows) kms_data ON (kms_list.show_id = kms_data.show_id)`;

        debugTimes.build_query = (new Date() - debugTimes.build_query) / 1000
        // SQL Query Call and Results Rendering
        if (req.headers['x-requested-page'] && req.headers['x-requested-page'] === 'SeqPaginator' ) {
            if (req.session.pageinatorEnable && req.session.pageinatorEnable === true) {
                let sqlCountFeild = 'results.kms_series_name';
                debugTimes.sql_query_1 = new Date();
                let countResults = await sqlPromiseSimple(`SELECT COUNT(${sqlCountFeild}) AS total_count FROM (${sqlCall}) results`);
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
            console.log(`${sqlCall} LIMIT ${sqllimit + 10} OFFSET ${offset}`)
            const messageResults = await sqlPromiseSimple(`${sqlCall} LIMIT ${sqllimit + 10} OFFSET ${offset}`);
            debugTimes.sql_query = (new Date() - debugTimes.sql_query) / 1000;
            let pageTitle = 'Media Browser'
            let pageFullTitle = 'Theater'
            let activeIcon

            if (messageResults && messageResults.rows.length > 0) {
                ((messages) => {
                    let resultsArray = [];
                    debugTimes.post_proccessing = new Date();
                    messages.forEach(function (item, index) {
                        if (index + 1 <= limit) {
                            resultsArray.push({
                                ...item.series_data,
                                group: item.group_name,
                                group_icon: item.icon,
                                cache_background: item.background,
                                cache_poster: item.poster,
                                subtitled: item.series_subtitled,
                                nsfw: item.series_nsfw,
                            })
                        }
                    })
                    pageFullTitle = 'Theater'

                    if (resultsArray.length > 0) {
                        if (media_group.length > 0) {
                            pageFullTitle += ' / ' + resultsArray[0].group;
                            activeIcon = resultsArray[0].group_icon;
                        }
                        let prevurl = 'NA'
                        let nexturl = 'NA'
                        if (offset >= limit) {
                            if (realoffset < limit) {
                                prevurl = `['offset', "${offset - limit}"]`;
                            } else {
                                prevurl = `['offset', "${offset - messageResults.rows.length}"]`;
                            }
                        }
                        if (resultsArray.length >= limit) {
                            nexturl = `['offset', "${offset}"]`;
                        }

                        let _req_uri = req.protocol + '://' + req.get('host') + req.originalUrl;

                        debugTimes.post_proccessing = (new Date() - debugTimes.post_proccessing) / 1000;
                        res.locals.response = {
                            title: pageTitle,
                            full_title: pageFullTitle,
                            page_image: null,
                            description: '',
                            channel_url: null,
                            results: resultsArray,
                            prevurl: prevurl,
                            nexturl: nexturl,
                            req_limit: limit,
                            req_offset: offset,
                            call_uri: page_uri,
                            android_uri: android_uri.join("&"),
                            req_uri: _req_uri,
                            search_prev: search_prev,
                            multiChannel: false,
                            active_ch: null,
                            active_svr: null,
                            active_pt: null,
                            active_icon: activeIcon,
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
                            applications_list: req.session.applications_list,
                            device: ua,
                            folderInfo: null
                        }
                        printLine('GetData', `"${req.session.discord.user.username}" => "KMS Media Browser" - ${resultsArray.length} Returned (${_req_uri})`, 'info', {
                            title: pageTitle,
                            full_title: pageFullTitle,
                            page_image: null,
                            description: '',
                            channel_url: null,
                            num_images: resultsArray.length,
                            prevurl: prevurl,
                            nexturl: nexturl,
                            req_limit: limit,
                            req_offset: offset,
                            req_uri: _req_uri.split('?').pop(),
                            call_uri: page_uri,
                            search_prev: search_prev,
                            multiChannel: false,
                            active_ch: null,
                            active_svr: null,
                            active_pt: null,
                            active_icon: activeIcon,
                            username: req.session.discord.user.username,
                            folderInfo: null
                        })
                        console.log(debugTimes);
                        res.locals.debugTimes = debugTimes;
                        next();
                    } else {
                        printLine('GetImages', `No Results were returned`, 'warn');
                        res.locals.response = {
                            title: pageTitle,
                            full_title: pageFullTitle,
                            search_prev: search_prev,
                            multiChannel: false,
                            active_ch: null,
                            active_svr: null,
                            active_pt: null,
                            active_icon: activeIcon,
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
                    multiChannel: false,
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
                    applications_list: req.session.applications_list,
                    device: ua,
                }
                next();
            }
        }
    }
}
