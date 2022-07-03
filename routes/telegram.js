const config = require('../host.config.json')
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { roleGeneration, sessionVerification, loginPage } = require('./discord');
const { printLine } = require("../js/logSystem");
const { sqlSafe, sqlSimple } = require('../js/sqlClient');

function _encode(obj) {
    let string = "";
    for (const [key, value] of Object.entries(obj)) {
        if (!value) continue;
        string += `&${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    }
    return string.substring(1);
}

router.get('/callback', async (req, res) => {
    try {
        if (req.query.hash && req.query.hash.length > 60) {
            if (verifyDataHash(req.query) && (new Date(Date.now()).getTime() / 1000).toFixed(0) -  parseInt(req.query.auth_date) <= 900) {
                printLine('TelegramCallback', `Login callback response was valid and passed hash check`, 'debug');
                sqlSafe(`SELECT * FROM discord_users WHERE telegram_id = ? AND telegram_id IS NOT NULL LIMIT 1`, [`${req.query.id}`], async (err, users) => {
                    if (err) {
                        printLine("SQL", `Failed to get SQL data to generate login via telegram - ${err.message}`, 'error')
                        loginPage(req, res, { serverError: 'telegramSearch1', status: 500 });
                        resolve(false);
                    } else if (users.length > 0) {
                        await roleGeneration(users[0].id, res, req)
                            .then((config) => {
                                if (config) {
                                    req.session.loggedin = true;
                                    req.session.user = {
                                        id: users[0].id,
                                        source: 1,
                                        oauth_id: req.query.id,
                                        username: `${req.query.first_name} ${req.query.last_name}`,
                                        avatar: req.query.photo_url,
                                    };
                                    printLine("PassportCheck", `User @${req.query.username} (${users[0].id} <= ${req.query.id}) logged in!`, 'info', req.query);
                                    if (req.session.goto && req.session.goto !== '') {
                                        printLine('SessionTransfer', `Redirecting to previous page "${req.session.goto}"`, 'info');
                                        res.redirect(req.session.goto);
                                    } else {
                                        res.redirect('/');
                                    }
                                    req.session.goto = '';
                                } else {
                                    loginPage(req, res, { noLoginAvalible: 'noMember', status: 401 });
                                }
                            })
                    } else {
                        loginPage(req, res, { noLoginAvalible: 'notelegram', status: 401 });
                    }
                })
            } else {
                printLine('TelegramCallback', `Failed to validate the hash response from telegram to create session`, 'error');
                res.status(500).send('Remote data integrity failure! Possible attack!')
            }
        } else {
            printLine('TelegramCallback', `Failed to get valid response to create session`, 'error');
            res.status(500).send('Failed to get valid response hash')
        }
    } catch (err) {
        res.status(500).json({
            state: 'HALTED-TELEGRAM-CALLBACK',
            message: err.message,
        });
    }
});
router.get('/register', sessionVerification, async (req, res) => {
    try {
        if (req.query.hash && req.query.hash.length > 60) {
            if (verifyDataHash(req.query) && (new Date(Date.now()).getTime() / 1000).toFixed(0) -  parseInt(req.query.auth_date) <= 900) {
                printLine('TelegramCallback', `Login callback response was valid and passed hash check`, 'debug');
                sqlSafe(`UPDATE discord_users SET telegram_id = ? WHERE id = ? LIMIT 1`, [`${req.query.id}`, req.session.discord.user.id], async (err, users) => {
                    if (err) {
                        printLine("SQL", `Failed to get SQL data to generate login via telegram - ${err.message}`, 'error')
                        res.status(500).send('Failed to setup telegram account due to a database error!')
                        resolve(false);
                    } else {
                        req.session.user = {
                            id: req.session.discord.user.id,
                            source: 1,
                            oauth_id: req.query.id,
                            username: `${req.query.first_name} ${req.query.last_name}`,
                            avatar: req.query.photo_url,
                        };
                        res.redirect('/');
                    }
                })
            } else {
                printLine('TelegramCallback', `Failed to validate the hash response from telegram to create session`, 'error');
                res.status(500).send('Remote data integrity failure! Possible attack!')
            }
        } else {
            printLine('TelegramCallback', `Failed to get valid response to create session`, 'error');
            res.status(500).send('Failed to get valid response hash')
        }
    } catch (err) {
        res.status(500).json({
            state: 'HALTED-TELEGRAM-CALLBACK',
            message: err.message,
        });
    }
});
router.get('/remove', sessionVerification, async (req, res) => {
    try {
        sqlSafe(`UPDATE discord_users SET telegram_id = NULL WHERE id = ? AND telegram_id IS NOT NULL LIMIT 1`, [req.session.discord.user.id], async (err, users) => {
            if (err) {
                printLine("SQL", `Failed to set SQL data to generate login via telegram - ${err.message}`, 'error')
                res.status(500).send('Failed to remove telegram account due to a database error!')
                resolve(false);
            } else {
                if (users.affectedRows > 0) {
                    req.session.user = {
                        id: req.session.discord.user.id,
                        source: 100,
                        username: req.session.discord.user.username,
                        avatar: (req.session.discord.user.avatar) ? `https://cdn.discordapp.com/avatars/${req.session.discord.user.id}/${req.session.discord.user.avatar}.${(req.session.discord.user.avatar && req.session.discord.user.avatar.startsWith('a_')) ? 'gif' : 'jpg'}?size=4096` : `https://cdn.discordapp.com/embed/avatars/0.png?size=4096`,
                    };
                }
                res.redirect('/');
            }
        })
    } catch (err) {
        res.status(500).json({
            state: 'HALTED-TELEGRAM-CALLBACK',
            message: err.message,
        });
    }
});

function verifyDataHash(input) {
    try {
        const hash = input.hash;
        const secret_key = crypto.createHash('sha256').update(config.telegram_secret).digest();
        const dataString = Object.keys(input).filter(e => e !== 'hash').sort().map(key => (`${key}=${input[key]}`)).join('\n');
        const hmac = crypto.createHmac('sha256', secret_key).update(dataString).digest('hex');
        return hash === hmac
    } catch (e) {
        printLine('TelegramValidator', `Failed to validate the cryptographic hash from Telegram server : ${e.message}`, 'error', e);
        return false;
    }
}

module.exports = {
    verifyDataHash,
    router
}
