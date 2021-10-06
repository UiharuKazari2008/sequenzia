const config = require('../host.config.json');
const express = require('express');
const { printLine } = require('../js/logSystem');
const { sessionVerification } = require('./discord');
const { sqlSimple, sqlSafe } = require('../js/sqlClient');
const request = require('request');
const router = express.Router();
const weather_icons = {
    "01d": '/static/img/weather/clear-day.png',
    "01n": '/static/img/weather/clear-night.png',
    "02d": '/static/img/weather/partly-cloudy.png',
    "02n": '/static/img/weather/partly-cloudy-night.png',
    "03d": '/static/img/weather/mostly-cloudy.png',
    "03n": '/static/img/weather/mostly-cloudy-night.png',
    "04d": '/static/img/weather/cloudy-weather.png',
    "04n": '/static/img/weather/cloudy-weather.png',
    "09d": '/static/img/weather/rainy-day.png',
    "09n": '/static/img/weather/rainy-night.png',
    "10d": '/static/img/weather/rainy-day.png',
    "10n": '/static/img/weather/rainy-night.png',
    "11d": '/static/img/weather/storm-weather-day.png',
    "11n": '/static/img/weather/storm-weather-night.png',
    "13d": '/static/img/weather/snow-day.png',
    "13n": '/static/img/weather/snow-night.png',
    "50d": '/static/img/weather/haze-day.png',
    "50n": '/static/img/weather/haze-night.png',
}

router.get('/weather', sessionVerification, async (req, res) => {
    try {
        if (req.query && req.query.address) {
            let unitFormat = 'metric'
            if (req.query.imperial) {
                unitFormat = 'imperial'
            }
            request ({
                url: `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(req.query.address)}&units=${unitFormat}&appid=${config.weather_key}`,
                json: true
            },(error,response,body) => {
                if(!error && response.statusCode === 200)
                {
                    const code = body.weather[0].id;
                    const nightTime = body.weather[0].icon.substr(2,1) === 'n';
                    let icon;
                    if (nightTime) {
                        icon = 'night-' + code;
                    } else {
                        icon = 'day-' + code;
                    }

                    res.json({
                        weather_icon_class: 'wi-owm-' + icon,
                        weather_name: body.weather[0].main,
                        temperature: body.main.temp,
                        temperature_feel: body.main.feels_like,
                        temperature_min: body.main.temp_min,
                        temperature_max: body.main.temp_max,
                        sunrise: body.sys.sunrise,
                        sunset: body.sys.sunset,
                        sys_night: body.weather[0].icon.substr(2,1) === 'n'
                    });
                }
                else {
                    res.status(500).send(response.body.message);
                }
            });
        } else {
            res.status(400).send('Invalid Request');
        }
    } catch {
        res.status(500).send('Internal Server Error');
    }
});
router.get('/quote', sessionVerification, async (req, res) => {
    try {
        let _where
        if (req.query && req.query.tag) {
            sqlSafe(`SELECT * FROM sequenzia_quotes WHERE tags LIKE ? ORDER BY RAND() LIMIT 1`, ['%' + req.query.tag + '%'], (err, results) => {
                if (err) {
                    res.status(500).send('Internal Server Error');
                } else if (results && results.length > 0) {
                    res.json({
                        text: results[0].quote,
                        author: results[0].author,
                        tags: results[0].tags
                    });
                } else {
                    res.status(404).send('No Results');
                }
            })
        } else {
            sqlSimple(`SELECT * FROM sequenzia_quotes ORDER BY RAND() LIMIT 1`, (err, results) => {
                if (err) {
                    res.status(500).send('Internal Server Error');
                } else if (results && results.length > 0) {
                    res.json({
                        text: results[0].quote,
                        author: results[0].author,
                        tags: results[0].tags
                    });
                } else {
                    res.status(404).send('No Results');
                }
            })
        }
    } catch {
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
