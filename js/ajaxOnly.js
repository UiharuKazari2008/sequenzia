module.exports = async (req, res, next) => {
    if (req.session.loggedin) {
        if (req.session.lite_mode === "true") {
            next();
        } else if (req.query && req.query['lite_mode'] === 'true') {
            req.session.lite_mode = true
            next();
        } else if (req.headers && req.headers['x-requested-with'] && req.headers['x-requested-with'] === 'SequenziaXHR' || (req.query && (req.query.json || req.query.responseType))) {
            next();
        } else {
            res.status(401).send("You are not allowed to use this without using Sequenzia JuneOS Client");
        }
    } else {
        res.status(401).send("You are not allowed to use this without using Sequenzia JuneOS Client");
    }
}
