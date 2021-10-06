const global = require('../config.json');
const config = require('../host.config.json');
const { printLine } = require("./logSystem");
const { sqlPromiseSimple, sqlPromiseSafe } = require('../js/sqlClient');

module.exports = async (req, res) => {
    if (req.query.command) {
        if (req.query.command === 'getAll') {
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
