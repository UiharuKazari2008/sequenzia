const global = require("../config.json")
const webconfig = require("../web.config.json")
const {printLine} = require("./logSystem");
const { sqlSimple, sqlPromiseSimple, sqlPromiseSafe } = require('../js/sqlClient');
const md5 = require("md5");

module.exports = async (req, res, next) => {
    if (req.headers && !req.headers['x-requested-page'] && !req.originalUrl.split('/')[1].split('?')[0].length === 0) {
        next();
    } else if (req.session.sidebar && !(req.query && req.query.refresh)) {
        if (req.headers['x-requested-page'] === 'SeqSidebar') {
            res.render('sidebar', {
                url: req.url,
                sidebar: req.session.sidebar,
                albums: (req.session.albums && req.session.albums.length > 0) ? req.session.albums : [],
                theaters: (req.session.media_groups && req.session.media_groups.length > 0) ? req.session.media_groups : [],
                applications_list: req.session.applications_list,
                server: req.session.server_list,
                download: req.session.discord.servers.download,
                manage_channels: req.session.discord.channels.manage,
                write_channels: req.session.discord.channels.write,
                disabled_channels: req.session.disabled_channels,
                discord: req.session.discord,
                user: req.session.user,
                webconfig: webconfig
            })
        } else {
            next();
        }
    } else {
        req.session.applications_list = [];

        if (global.web_applications) {
            const perms = [
                req.session.discord.permissions.read,
                req.session.discord.permissions.write,
                req.session.discord.permissions.manage,
                req.session.discord.permissions.specialPermissions
            ]
            req.session.applications_list.push(...Object.keys(global.web_applications).filter(k =>
                perms.filter(p => global.web_applications[k].read_roles.indexOf(p) === -1).length > 0
            ).map(k => {
                const app = global.web_applications[k];
                if (app.embedded) {
                    return {
                        type: 1,
                        id: k,
                        icon: app.icon,
                        name: app.name
                    }
                } else {
                    return {
                        type: 0,
                        id: k,
                        icon: app.icon,
                        name: app.name,
                        url: app.url
                    }
                }
            }))
        }

        let SidebarArray = [];
        const sidebarObject = await sqlPromiseSimple(`SELECT * FROM ${req.session.cache.sidebar_view}`)
        const customChannelObject = await sqlPromiseSimple(`SELECT * FROM sequenzia_custom_channels`)
        const userAlbums = await sqlPromiseSafe('SELECT x.aid, x.name, x.uri, x.owner, x.privacy, y.* FROM (SELECT x.*, y.eid FROM (SELECT DISTINCT * FROM sequenzia_albums WHERE owner = ? ORDER BY name ASC) AS x LEFT JOIN (SELECT *, ROW_NUMBER() OVER(PARTITION BY aid ORDER BY RAND()) AS RowNo FROM sequenzia_album_items) AS y ON x.aid = y.aid AND y.RowNo=1) x LEFT JOIN (SELECT eid, channel, attachment_hash, attachment_name, cache_proxy FROM kanmi_records) y ON y.eid = x.eid ORDER BY name ASC', [req.session.discord.user.id])
        const libraryLists = await sqlPromiseSimple(`SELECT g.* FROM (SELECT * FROM kongou_media_groups) g LEFT JOIN (SELECT media_group FROM ${req.session.cache.channels_view}) a ON (g.media_group = a.media_group) GROUP BY g.media_group`)

        if (sidebarObject && sidebarObject.rows.length > 0) {
            const superClasses = (e => {
                let unique = [];
                let distinct = [];
                for( let i = 0; i < e.length; i++ ){
                    if( !unique[e[i].super]){
                        distinct.push({
                            super: e[i].super,
                            super_name: e[i].super_name,
                            super_icon: e[i].super_icon,
                            super_uri: e[i].super_uri
                        });
                        unique[e[i].super] = 1;
                    }
                }
                return distinct
            })(sidebarObject.rows)
            const classes = (e => {
                let unique = [];
                let distinct = [];
                for( let i = 0; i < e.length; i++ ){
                    if( !unique[e[i].class]){
                        distinct.push({
                            class: e[i].class,
                            super: e[i].super,
                            class_name: e[i].class_name,
                            class_icon: e[i].class_icon,
                            class_uri: e[i].class_uri,
                        });
                        unique[e[i].class] = 1;
                    }
                }
                return distinct
            })(sidebarObject.rows)
            const virtualChannels = (e => {
                let unique = [];
                let distinct = [];
                for( let i = 0; i < e.length; i++ ){
                    if( e[i].virtual_channel_eid !== null && !unique[e[i].virtual_channel_eid] && e[i].virtual_channel_name !== null){
                        distinct.push({
                            id: e[i].virtual_channel_eid,
                            class: e[i].class,
                            super: e[i].super,
                            name: e[i].virtual_channel_name,
                            uri: e[i].virtual_channel_uri,
                            description: e[i].virtual_channel_description,
                        });
                        unique[e[i].virtual_channel_eid] = 1;
                    }
                }
                return distinct
            })(sidebarObject.rows)

            superClasses.forEach((thisSuper) => {
                let _items = []
                classes.filter(e => e.super === thisSuper.super ).forEach((thisClass) => {
                    const _channels = sidebarObject.rows.filter(e => e.class === thisClass.class && e.virtual_channel_eid === null).map((thisChannel) => {
                        let channelName = ''
                        if (thisChannel.channel_nice === null) {
                            thisChannel.channel_name.split('-').forEach((wd, i, a) => {
                                channelName += wd.substring(0, 1).toUpperCase() + wd.substring(1, wd.length)
                                if (i + 1 < a.length) {
                                    channelName += ' '
                                }
                            })
                        } else { channelName = thisChannel.channel_nice }

                        return ({
                            type: 0,
                            id: thisChannel.channelid,
                            eid: thisChannel.channel_eid,
                            name: channelName,
                            image: (thisChannel.channel_image) ? (thisChannel.channel_image.startsWith('http')) ? thisChannel.channel_image : `https://media.discordapp.net/attachments/${thisChannel.channel_image}`: null,
                            channel_title: thisChannel.channel_title,
                            short_name: thisChannel.channel_short_name.split('-').join(' '),
                            server: thisChannel.serverid,
                            server_short_name: thisChannel.server_short.toUpperCase(),
                            nsfw: (thisChannel.channel_nsfw === 1),
                            uri: thisChannel.channel_uri,
                            description: thisChannel.channel_description,
                        })
                    })
                    let _mergedChannels = [];
                    virtualChannels.forEach((vcid) => {
                        let _vc_entities = [];
                        let _vc_nsfw = false;
                        sidebarObject.rows.filter(e => e.class === thisClass.class && vcid.class === thisClass.class && e.virtual_channel_eid !== null && e.virtual_channel_eid === vcid.id).map((thisChannel) => {
                            let channelName = ''
                            if (thisChannel.channel_nice === null) {
                                thisChannel.channel_name.split('-').forEach((wd, i, a) => {
                                    channelName += wd.substring(0, 1).toUpperCase() + wd.substring(1, wd.length)
                                    if (i + 1 < a.length) {
                                        channelName += ' '
                                    }
                                })
                            } else {
                                channelName = thisChannel.channel_nice
                            }
                            if (thisChannel.channel_nsfw === 1) { _vc_nsfw = true; }

                            _vc_entities.push({
                                id: thisChannel.channelid,
                                eid: thisChannel.channel_eid,
                                name: channelName,
                                short_name: thisChannel.channel_short_name.split('-').join(' '),
                                server: thisChannel.serverid,
                                server_short_name: thisChannel.server_short.toUpperCase(),
                                uri: thisChannel.channel_uri,
                                nsfw: (thisChannel.channel_nsfw === 1),
                                description: thisChannel.channel_description,
                            })
                        })
                        if (_vc_entities.length > 0) {
                            _mergedChannels.push({
                                type: 2,
                                id: vcid.id,
                                name: vcid.name,
                                description: vcid.description,
                                uri: vcid.uri,
                                nsfw: _vc_nsfw,
                                entities: _vc_entities
                            })
                        }
                    })
                    const _customs = customChannelObject.rows.filter((e) => e.class === thisClass.class).map((thisChannel) => {
                        const channelName = thisChannel.name;
                        const urlSearch = thisChannel.search + `&title=${channelName}`;
                        return ({
                            type: 1,
                            id: md5(urlSearch),
                            url: urlSearch,
                            name: channelName,
                            nsfw: urlSearch.includes('nsfw=true'),
                        })
                    })

                    if (_channels.length > 0) {
                        _items.push({
                            id: thisClass.class,
                            name: thisClass.class_name,
                            icon: thisClass.class_icon,
                            uri: thisClass.class_uri,
                            entities: [..._channels, ..._mergedChannels, ..._customs]
                        })
                    }
                })
                if (_items.length > 0) {
                    SidebarArray.push({
                        id: thisSuper.super,
                        name: thisSuper.super_name,
                        icon: thisSuper.super_icon,
                        uri: thisSuper.super_uri,
                        entities: _items
                    })
                }
            })

            req.session.sidebar = SidebarArray;

            if (userAlbums && userAlbums.rows.length > 0) {
                req.session.albums = userAlbums.rows.map(e => {
                    let ranImage = ( e.cache_proxy) ? e.cache_proxy.startsWith('http') ? e.cache_proxy : `https://media.discordapp.net/attachments${e.cache_proxy}` : (e.attachment_hash && e.attachment_name) ? `https://media.discordapp.net/attachments/` + ((e.attachment_hash.includes('/')) ? e.attachment_hash : `${e.channel}/${e.attachment_hash}/${e.attachment_name}`) : undefined
                    return {
                        ...e,
                        image: ranImage
                    }
                });
            }
            if (libraryLists && libraryLists.rows.length > 0) {
                req.session.media_groups = libraryLists.rows
            }


            if (req.headers['x-requested-page'] === 'SeqSidebar') {
                res.render('sidebar', {
                    url: req.url,
                    sidebar: req.session.sidebar,
                    albums: (req.session.albums && req.session.albums.length > 0) ? req.session.albums : [],
                    theaters: (req.session.media_groups && req.session.media_groups.length > 0) ? req.session.media_groups : [],
                    applications_list: req.session.applications_list,
                    server: req.session.server_list,
                    download: req.session.discord.servers.download,
                    manage_channels: req.session.discord.channels.manage,
                    write_channels: req.session.discord.channels.write,
                    disabled_channels: req.session.disabled_channels,
                    discord: req.session.discord,
                    user: req.session.user,
                    webconfig: webconfig
                })
            } else {
                next();
            }
        } else {
            res.status(500).send('Missing Sidebar View Cache, Refresh Account!');
        }
    }
}
