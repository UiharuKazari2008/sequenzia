const global = require('../config.json');
const config = require('../host.config.json');
const { printLine } = require("./logSystem");
const { sqlPromiseSimple, sqlPromiseSafe } = require('../js/sqlClient');

module.exports = async (req, res) => {
    if (req.query.command) {
        if (req.query.command === 'getDirectory') {
            const query = await sqlPromiseSafe('SELECT x.*, y.username, y.nice_name FROM (SELECT x.aid, x.name, x.uri, x.owner, x.privacy, y.* FROM (SELECT x.*, y.eid FROM (SELECT DISTINCT * FROM sequenzia_albums WHERE privacy = 0 ORDER BY name ASC) AS x LEFT JOIN (SELECT *, ROW_NUMBER() OVER(PARTITION BY aid ORDER BY RAND()) AS RowNo FROM sequenzia_album_items) AS y ON x.aid = y.aid AND y.RowNo=1) x LEFT JOIN (SELECT eid, channel, attachment_hash, attachment_name, cache_proxy FROM kanmi_records) y ON y.eid = x.eid ORDER BY name ASC) x LEFT JOIN (SELECT x.* FROM (SELECT * FROM discord_users) x LEFT JOIN (SELECT discord_servers.position, discord_servers.authware_enabled, discord_servers.name, discord_servers.serverid FROM discord_servers) y ON x.server = y.serverid ORDER BY y.authware_enabled, y.position, x.id) y ON x.owner = y.id', [])

            if (query && query.rows && query.rows.length > 0) {
                let rows_proccessed = [];
                let album_rows = [];
                query.rows.map(row => {
                    if (rows_proccessed.indexOf(row.aid) === -1) {
                        rows_proccessed.push(row.aid);
                        album_rows.push(row)
                    }
                });
                if (req.query.json && req.query.json === 'true') {
                    res.json({ albums: album_rows });
                } else {
                    const rows = album_rows.map(e => {
                        let ranImage = ( e.cache_proxy) ? e.cache_proxy.startsWith('http') ? e.cache_proxy : `https://media.discordapp.net/attachments${e.cache_proxy}` : (e.attachment_hash && e.attachment_name) ? `https://media.discordapp.net/attachments/` + ((e.attachment_hash.includes('/')) ? e.attachment_hash : `${e.channel}/${e.attachment_hash}/${e.attachment_name}`) : undefined
                        return {
                            ...e,
                            user: (e.nice_name) ? e.nice_name : e.username,
                            image: ranImage
                        }
                    });
                    res.render('album_directory', { albums: rows, manageMode: false, user: req.session.user });
                }
            } else {
                res.render('album_directory', { noResults: true, user: req.session.user } );
            }
        } else if (req.query.command === 'getAll') {
            let sqlQuery = `SELECT * FROM sequenzia_albums WHERE owner = '${req.session.discord.user.id}'`
            if (req.query.messageid) {
                sqlQuery = `SELECT x.*, y.found_aid FROM (${sqlQuery}) x LEFT OUTER JOIN (SELECT aid AS found_aid FROM sequenzia_album_items WHERE eid = '${req.query.messageid}') y ON (x.aid = y.found_aid)`
            }
            sqlQuery += ' ORDER BY name ASC'
            const query = await sqlPromiseSimple(sqlQuery);

            if (query && query.rows && query.rows.length > 0) {
                if (req.query.json && req.query.json === 'true') {
                    res.json({ albums: query.rows });
                } else {
                    res.render('album_list', { albums: query.rows, manageMode: (req.query.manage), id: (req.query.messageid) ? req.query.messageid : undefined, user: req.session.user });
                }
            } else {
                res.render('album_list', { noResults: true, user: req.session.user } );
            }
        } else if (req.query.command === 'get' && req.query.displayname) {

        } else {
            res.send('Bad Command');
        }
    } else {
        res.send('Missing Command');
    }
}
