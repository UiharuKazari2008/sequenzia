module.exports = async (req, res, next) => {

    if (req.query.json && req.query.json === 'true') {
        res.json(res.locals.response)
    } else {
        if (res.locals.response.call_uri === '/artists') {
            res.render('index_artists', res.locals.response);
        } else {
            res.end();
        }
    }
    res.locals.response = undefined;
}
