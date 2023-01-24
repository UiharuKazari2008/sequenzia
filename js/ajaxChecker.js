const web = require("../web.config.json");
const config = require('../host.config.json');
const {sqlPromiseSafe} = require("./sqlClient");

module.exports = async (req, res, next) => {
    const thisUser = res.locals.thisUser
    if (!thisUser)
        res.status(403).send('User account can not correlated to a valid user!')

    if (thisUser.master && thisUser.master.discord && thisUser.master.cache && thisUser.master.cache.channels_view) {
        const call_uri = req.originalUrl.split('/')[1].split('?')[0]
        if (req.session && req.session.lite_mode === true) {
            next();
        } else if (req.query && req.query['lite_mode'] === 'true') {
            req.session.lite_mode = true
            next();
        } else if (call_uri === 'juneOS') {
            const history_urls = await sqlPromiseSafe(`SELECT * FROM sequenzia_navigation_history WHERE user = ? ORDER BY saved DESC, date DESC`, [ thisUser.master.discord.user.id ]);
            res.render('init-layout', {
                server: thisUser.master.server_list,
                download: thisUser.master.discord.servers.download,
                manage_channels: thisUser.master.discord.channels.manage,
                write_channels: thisUser.master.discord.channels.write,
                discord: thisUser.master.discord,
                user: thisUser.master.user,
                login_source: req.session.login_source,
                webconf: web,
                albums: (thisUser.master.albums && thisUser.master.albums.length > 0) ? thisUser.master.albums : [],
                artists: (thisUser.master.artists && thisUser.master.artists.length > 0) ? thisUser.master.artists : [],
                theaters: (thisUser.master.media_groups && thisUser.master.media_groups.length > 0) ? thisUser.master.media_groups : [],
                next_episode: thisUser.master.kongou_next_episode,
                sidebar: thisUser.master.sidebar,
                applications_list: thisUser.master.applications_list,
                history: history_urls.rows
            })
        } else if (req.headers && req.headers['x-requested-with'] && req.headers['x-requested-with'] === 'SequenziaXHR' && req.headers['x-requested-page'] || (req.query && (req.query.json || req.query.responseType))) {
            next();
        } else if ( call_uri === 'home' || call_uri === '' ) {
            res.render('home_lite', {
                url: req.url,
                server: thisUser.master.server_list,
                download: thisUser.master.discord.servers.download,
                manage_channels: thisUser.master.discord.channels.manage,
                write_channels: thisUser.master.discord.channels.write,
                discord: thisUser.master.discord,
                user: thisUser.master.user,
                login_source: req.session.login_source,
                sidebar: thisUser.master.sidebar,
                albums: (thisUser.master.albums && thisUser.master.albums.length > 0) ? thisUser.master.albums : [],
                artists: (thisUser.master.artists && thisUser.master.artists.length > 0) ? thisUser.master.artists : [],
                theaters: (thisUser.master.media_groups && thisUser.master.media_groups.length > 0) ? thisUser.master.media_groups : [],
                next_episode: thisUser.master.kongou_next_episode,
                applications_list: thisUser.master.applications_list,
            })
        } else {
            res.redirect(`/juneOS#${req.originalUrl}`);
        }
    } else if (thisUser.master.discord) {
        res.redirect('/discord/refresh')
    } else {
        res.end();
    }
}
