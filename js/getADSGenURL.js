const config = require("../host.config.json");
const {sqlPromiseSafe} = require("./sqlClient");
module.exports = async (req, res, next) => {
    try {
        if ((res.locals.response && res.locals.response.randomImagev2.length > 0 && res.locals.response.randomImagev2[0].fullImage) || req.params.eid) {
            let eid = (req.params.eid) ? req.params.eid.split('.')[0] : undefined;
            let user = (req.params.user) ? req.params.user : undefined;
            if (res.locals.response && res.locals.response.randomImagev2.length > 0 && res.locals.response.randomImagev2[0].fullImage && res.locals.response.randomImagev2[0].fullImage.startsWith('/wallpaper/')) {
                user = res.locals.response.randomImagev2[0].fullImage.split('/wallpaper/').pop().split('/')[0]
                const en = res.locals.response.randomImagev2[0].fullImage.split('/wallpaper/').pop().split('/')[1].split('?')
                eid = en[0];
            }
            const selectCDN = `SELECT *
                               FROM kanmi_records_cdn
                               WHERE (full = 1 OR mfull = 1) ${(config.local_cdn_list && config.local_cdn_list.length > 0) ? 'AND (' + config.local_cdn_list.map(e => 'host = ' + e.id).join(' OR ') + ')' : ''}`
            const q = `SELECT IF(rec.attachment_auth_ex > NOW() + INTERVAL 8 HOUR, 1, 0) AS auth_valid,
                              rec.*,
                              cdn.host                                                   AS cdn_host,
                              cdn.path_hint,
                              cdn.mfull_hint,
                              cdn.full_hint,
                              cdn.preview_hint,
                              cdn.ext_0_hint
                       FROM (SELECT * FROM kanmi_records WHERE eid = ?) rec
                                LEFT OUTER JOIN (${selectCDN}) cdn ON (rec.eid = cdn.eid)`;
            const record = await sqlPromiseSafe(q, [eid])
            if (record.rows.length !== 0) {
                const image = record.rows[0]
                let returnedUrl = '';
                let data = {
                    s: image.server,
                    c: image.channel,
                    m: image.master_hint,
                    n: image.attachment_name,
                    u: user,
                    e: image.eid,
                }
                let opts = {}
                if (image.colorR && image.colorG && image.colorB)
                    opts.tint = {r: image.colorR, g: image.colorG, b: image.colorB, d: image.dark_color}
                if (image.cdn_host !== null && config.local_cdn_list.filter(e => e.id === image.cdn_host).length > 0 && image.full_hint) {
                    const cdn_host = config.local_cdn_list.filter(e => e.id === image.cdn_host)[0]
                    returnedUrl = cdn_host.gen_access_url + 'ads-gen/'
                    data.t = 0;
                    data.p = image.path_hint;
                    data.f = image.full_hint;
                    data.m = image.master_hint;
                    if (image.real_filename)
                        data.n = image.real_filename
                } else {
                    returnedUrl = config.local_cdn_list.filter(e => !!e.gen_access_url)[0].gen_access_url + 'ads-gen/'
                    data.t = 1;
                    if ((image.attachment_hash.includes('/'))) {
                        const a = image.attachment_hash.split('/')
                        data.c = a[0];
                        data.p = a[1];
                        data.n = a[2];
                    } else {
                        data.p = image.attachment_hash;
                    }
                    if (image.auth_valid)
                        data.a = image.attachment_auth
                }
                if (req.query.format)
                    opts.format = req.query.format;
                if (req.query.base64)
                    data.r = true;
                if (req.query.width && req.query.height) {
                    data.w = req.query.width;
                    data.h = req.query.height;
                }
                data.o = opts;
                const query = Buffer.from(JSON.stringify(data)).toString('base64');
                returnedUrl += `${encodeURIComponent(query)}/${(image.real_filename || image.attachment_name).split('.')[0]}.png${(req.query.noDownload) ? '?noDownload=true' : ''}`;
                res.locals.ads_url = returnedUrl;
            } else if (!req.originalUrl.includes('/ambient-get')) {
                res.status(404).send('Unknown Item');
            } else {
                res.end();
            }
            next();
        } else {
            next();
        }
    } catch (err) {
        if (!req.originalUrl.includes('/ambient-get')) {
            res.status(500).json({
                state: 'HALTED',
                message: err.message,
            });
        } else {
            res.end();
        }
    }
}
