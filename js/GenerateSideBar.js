const webconfig = require("../web.config.json");

module.exports = async (req, res, next) => {
    const thisUser = res.locals.thisUser
    if (!thisUser)
        res.status(403).send('User account can not correlated to a valid user!')

    if (req.headers && !req.headers['x-requested-page'] && !req.originalUrl.split('/')[1].split('?')[0].length === 0) {
        next();
    } else if (thisUser.master && thisUser.master.sidebar) {
        if (req.headers['x-requested-page'] === 'SeqSidebar') {
            res.render('sidebar', {
                url: req.url,
                sidebar: thisUser.master.sidebar,
                albums: (thisUser.master.albums && thisUser.master.albums.length > 0) ? thisUser.master.albums : [],
                artists: (thisUser.master.artists && thisUser.master.artists.length > 0) ? thisUser.master.artists : [],
                theaters: (thisUser.master.media_groups && thisUser.master.media_groups.length > 0) ? thisUser.master.media_groups : [],
                next_episode: thisUser.master.kongou_next_episode,
                applications_list: thisUser.master.applications_list,
                server: thisUser.master.server_list,
                download: thisUser.master.discord.servers.download,
                manage_channels: thisUser.master.discord.channels.manage,
                write_channels: thisUser.master.discord.channels.write,
                disabled_channels: thisUser.master.disabled_channels,
                discord: thisUser.master.discord,
                exchange_list: thisUser,
                active_exchange_id: (!req.headers['x-sequenzia-exchange']) ? req.session.active_exchange : 'master',
                active_exchange: (req.session.active_exchange && !req.headers['x-sequenzia-exchange']) ? thisUser[req.session.active_exchange] : thisUser.master,
                user: thisUser.master.user,
                login_source: req.session.login_source,
                webconf: webconfig
            })
        } else {
            next();
        }
    } else {
        res.status(500).send('Missing Sidebar View Cache, Server may be missing its user data cache!');
    }
}
