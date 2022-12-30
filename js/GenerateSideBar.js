const webconfig = require("../web.config.json");

module.exports = async (req, res, next) => {
    const thisUser = res.locals.thisUser
    if (!thisUser)
        res.status(403).send('User account can not correlated to a valid user!')

    if (req.headers && !req.headers['x-requested-page'] && !req.originalUrl.split('/')[1].split('?')[0].length === 0) {
        next();
    } else if (thisUser.sidebar) {
        if (req.headers['x-requested-page'] === 'SeqSidebar') {
            res.render('sidebar', {
                url: req.url,
                sidebar: thisUser.sidebar,
                albums: (thisUser.albums && thisUser.albums.length > 0) ? thisUser.albums : [],
                artists: (thisUser.artists && thisUser.artists.length > 0) ? thisUser.artists : [],
                theaters: (thisUser.media_groups && thisUser.media_groups.length > 0) ? thisUser.media_groups : [],
                next_episode: thisUser.kongou_next_episode,
                applications_list: thisUser.applications_list,
                server: thisUser.server_list,
                download: thisUser.discord.servers.download,
                manage_channels: thisUser.discord.channels.manage,
                write_channels: thisUser.discord.channels.write,
                disabled_channels: thisUser.disabled_channels,
                discord: thisUser.discord,
                user: thisUser.user,
                login_source: req.session.source,
                webconfig: webconfig
            })
        } else {
            next();
        }
    } else {
        res.status(500).send('Missing Sidebar View Cache, Server may be missing its user data cache!');
    }
}
