const web = require("../web.config.json");
const config = require('../host.config.json');

module.exports = async (req, res, next) => {
    if (req.session.discord && req.session.cache && req.session.cache.channels_view) {
        const call_uri = req.originalUrl.split('/')[1].split('?')[0]
        if (req.session.lite_mode === "true") {
            next();
        } else if (req.query && req.query['lite_mode'] === 'true') {
            req.session.lite_mode = true
            next();
        } else if (call_uri === 'juneOS') {
            res.render('init-layout', {
                server: req.session.server_list,
                download: req.session.discord.servers.download,
                manage_channels: req.session.discord.channels.manage,
                write_channels: req.session.discord.channels.write,
                discord: req.session.discord,
                user: req.session.user,
                webconfig: web,
                albums: (req.session.albums && req.session.albums.length > 0) ? req.session.albums : [],
                applications_list: req.session.applications_list,
                enableTelegram: (config.telegram_secret)
            })
        } else if (req.headers && req.headers['x-requested-with'] && req.headers['x-requested-with'] === 'SequenziaXHR' && req.headers['x-requested-page'] || (req.query && (req.query.json || req.query.responseType))) {
            next();
        } else if ( call_uri === 'home' ) {
            res.render('home_lite', {
                url: req.url,
                server: req.session.server_list,
                download: req.session.discord.servers.download,
                manage_channels: req.session.discord.channels.manage,
                write_channels: req.session.discord.channels.write,
                discord: req.session.discord,
                user: req.session.user,
            })
        } else {
            res.redirect(`/juneOS#${req.originalUrl}`);
        }
    } else if (req.session.discord) {
        res.redirect('/discord/refresh')
    } else {
        res.end();
    }
}
