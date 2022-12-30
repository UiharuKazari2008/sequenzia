const web = require("../web.config.json");
const config = require('../host.config.json');
const {sqlPromiseSafe} = require("./sqlClient");

module.exports = async (req, res, next) => {
    const thisUser = res.locals.thisUser
    if (!thisUser)
        res.status(403).send('User account can not correlated to a valid user!')

    if (thisUser.discord && thisUser.cache && thisUser.cache.channels_view) {
        const call_uri = req.originalUrl.split('/')[1].split('?')[0]
        if (req.session.lite_mode === "true") {
            next();
        } else if (req.query && req.query['lite_mode'] === 'true') {
            req.session.lite_mode = true
            next();
        } else if (call_uri === 'juneOS') {
            const history_urls = await sqlPromiseSafe(`SELECT * FROM sequenzia_navigation_history WHERE user = ? ORDER BY saved DESC, date DESC`, [ thisUser.discord.user.id ]);
            res.render('init-layout', {
                server: thisUser.server_list,
                download: thisUser.discord.servers.download,
                manage_channels: thisUser.discord.channels.manage,
                write_channels: thisUser.discord.channels.write,
                discord: thisUser.discord,
                user: thisUser.user,
                login_source: req.session.source,
                webconfig: web,
                albums: (thisUser.albums && thisUser.albums.length > 0) ? thisUser.albums : [],
                artists: (thisUser.artists && thisUser.artists.length > 0) ? thisUser.artists : [],
                theaters: (thisUser.media_groups && thisUser.media_groups.length > 0) ? thisUser.media_groups : [],
                next_episode: thisUser.kongou_next_episode,
                sidebar: thisUser.sidebar,
                applications_list: thisUser.applications_list,
                history: history_urls.rows
            })
        } else if (req.headers && req.headers['x-requested-with'] && req.headers['x-requested-with'] === 'SequenziaXHR' && req.headers['x-requested-page'] || (req.query && (req.query.json || req.query.responseType))) {
            next();
        } else if ( call_uri === 'home' || call_uri === '' ) {
            res.render('home_lite', {
                url: req.url,
                server: thisUser.server_list,
                download: thisUser.discord.servers.download,
                manage_channels: thisUser.discord.channels.manage,
                write_channels: thisUser.discord.channels.write,
                discord: thisUser.discord,
                user: thisUser.user,
                login_source: req.session.source,
                sidebar: thisUser.sidebar,
                albums: (thisUser.albums && thisUser.albums.length > 0) ? thisUser.albums : [],
                artists: (thisUser.artists && thisUser.artists.length > 0) ? thisUser.artists : [],
                theaters: (thisUser.media_groups && thisUser.media_groups.length > 0) ? thisUser.media_groups : [],
                next_episode: thisUser.kongou_next_episode,
                applications_list: thisUser.applications_list,
            })
        } else {
            res.redirect(`/juneOS#${req.originalUrl}`);
        }
    } else if (thisUser.discord) {
        res.redirect('/discord/refresh')
    } else {
        res.end();
    }
}
