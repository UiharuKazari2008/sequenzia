const global = require('../config.json');
const config = require('../host.config.json');
const { printLine } = require("./logSystem");
const { sqlSimple, sqlSafe, sqlPromiseSimple, sqlPromiseSafe } = require('../js/sqlClient');
const moment = require('moment');

module.exports = async (req, res) => {
    if (req.query.command) {
        if (req.query.command === 'getAll') {
            sqlSafe("SELECT * FROM (SELECT * FROM (SELECT sequenzia_display_history.name AS display_name, sequenzia_display_history.screen AS screen_id, sequenzia_display_history.date AS display_date, kanmi_channels.nsfw, kanmi_records.eid, kanmi_records.channel, kanmi_records.server, kanmi_records.filecached,  kanmi_records.fileid,  kanmi_records.real_filename, kanmi_records.cache_proxy, kanmi_records.attachment_hash, kanmi_records.attachment_name, kanmi_records.colorR, kanmi_records.colorG, kanmi_records.colorB, kanmi_records.sizeH, kanmi_records.sizeW, kanmi_records.sizeR FROM kanmi_records, kanmi_channels, sequenzia_display_history WHERE sequenzia_display_history.name != 'PageResults' AND sequenzia_display_history.user = ? AND kanmi_records.eid = sequenzia_display_history.eid AND kanmi_channels.channelid = kanmi_records.channel) x LEFT OUTER JOIN (SELECT name AS config_name, nice_name AS config_nice FROM sequenzia_display_config WHERE user = ?) y ON (x.display_name = y.config_name)) x LEFT OUTER JOIN (SELECT eid AS fav_id, date AS fav_date FROM sequenzia_favorites WHERE userid = ?) y ON x.eid = y.fav_id ORDER BY display_name, display_date DESC", [req.session.discord.user.id, req.session.discord.user.id, req.session.discord.user.id], (err, history) => {
                if (err) {
                    res.render('display_history', { user: req.session.user} );
                    printLine('SQL', `Fail to get display history - ${err.message}`, 'error');
                } else if (history.length > 0) {
                    let displayNames = history.reduce(
                        function(unique_arr, obj) {
                            if(!unique_arr.some(x => x.display_name === obj.display_name)) {
                                if (unique_arr.indexOf(obj.display_name) === -1)
                                    unique_arr.push(obj.display_name)
                            }
                            return unique_arr;
                        }, [])
                    const initList = [ 'ADSEmbed-Untitled', 'Untitled', 'ADSMobile-Untitled', 'ADSMicro-Untitled', 'WebExtension', 'Homepage'];
                    Array.from(initList).forEach(f => {
                        displayNames.sort(function(x,y){ return x === f ? -1 : y === f ? 1 : 0; });
                    });
                    let displayResults = [];
                    [
                        ...displayNames.filter(e => initList.indexOf(e) !== -1),
                        ...displayNames.filter(e => initList.indexOf(e) === -1 && e.startsWith('ADSEmbed-')),
                        ...displayNames.filter(e => initList.indexOf(e) === -1 && !e.startsWith('ADS')),
                        ...displayNames.filter(e => initList.indexOf(e) === -1 && e.startsWith('ADSWidget-')),
                        ...displayNames.filter(e => initList.indexOf(e) === -1 && e.startsWith('ADSMobile-')),
                        ...displayNames.filter(e => initList.indexOf(e) === -1 && e.startsWith('ADSMicro-')),
                    ].forEach(dn => {
                        let displayHistory = [];
                        let displayQuery = [];
                        let screenMain = history.filter(x => {return x.display_name === dn && x.screen_id.toString() === '0'})
                        let screenSec = history.filter(x => {return x.display_name === dn && x.screen_id.toString() !== '0'})
                        if (screenSec.length > 0) {
                            displayQuery.push(screenMain[0]);
                            displayQuery.push(screenSec[0]);
                            displayQuery.push(screenMain.splice(1));
                            displayQuery.push(screenSec.splice(1));
                        } else {
                            displayQuery = screenMain;
                        }
                        let nice_name = null;
                        displayQuery.splice(0,(req.query.json && req.query.json === 'true') ? 75 : 2).forEach((x, index) => {
                            if (index === 0 && x.config_nice) { nice_name = x.config_nice; };
                            function getimageSizeParam() {
                                if (x.sizeH && x.sizeW && (x.sizeH > 512 || x.sizeW > 512)) {
                                    let ih = 512;
                                    let iw = 512;
                                    if (x.sizeW >= x.sizeH) {
                                        iw = (x.sizeW * (512 / x.sizeH)).toFixed(0)
                                    } else {
                                        ih = (x.sizeH * (512 / x.sizeW)).toFixed(0)
                                    }
                                    return `?width=${iw}&height=${ih}`
                                } else {
                                    return ''
                                }
                            }
                            displayHistory.push({
                                preview: (x.cache_proxy !== null) ? x.cache_proxy : `https://media.discordapp.net/attachments/` + ((x.attachment_hash.includes('/')) ? `${x.attachment_hash}${getimageSizeParam()}` : `${x.channel}/${x.attachment_hash}/${x.attachment_name}${getimageSizeParam()}`),
                                full: (x.filecached) ? `/stream/${x.fileid}/${x.real_filename}` : `https://cdn.discordapp.com/attachments/` + ((x.attachment_hash.includes('/')) ? x.attachment_hash : `${x.channel}/${x.attachment_hash}/${x.attachment_name}`),
                                id: x.id,
                                eid: x.eid,
                                screen: x.screen_id,
                                channel: x.channel,
                                server: x.server,
                                nsfw: x.nsfw,
                                fav: (x.fav_date !== null),
                                color: [x.colorR, x.colorG, x.colorB],
                                ratio: x.sizeR,
                                date: moment(x.display_date).format('MM/DD/YY HH:mm')
                            })
                        })
                        displayResults.push({
                            display: dn,
                            name: (nice_name) ? nice_name : dn,
                            images: displayHistory
                        })
                    })
                    if (req.query.json && req.query.json === 'true') {
                        res.json(displayResults);
                    } else {
                        res.render('display_history', { displayResults, user: req.session.user });
                    }
                } else {
                    res.render('display_history', { noResults: true, user: req.session.user } );
                }
            })
        } else
        if (req.query.command === 'getAllNames') {
            sqlSafe('SELECT DISTINCT name FROM sequenzia_display_history WHERE user = ? ORDER BY name DESC', [req.session.discord.user.id], (err, history) => {
                if (err) {
                    res.render('display_history', { user: req.session.user} );
                    printLine('SQL', `Fail to get display history - ${err.message}`, 'error');
                } else if (history.length > 0) {
                    let displayNames = history;
                    const initList = ['ADSEmbed-Untitled', 'ADSMobile-Untitled', 'ADSMicro-Untitled', 'WebExtension'];
                    Array.from(initList).forEach(f => {
                        displayNames.sort(function(x,y){ return x === f ? -1 : y === f ? 1 : 0; });
                    });
                    if (req.query.json && req.query.json === 'true') {
                        res.json({
                            displays: [
                                ...displayNames.filter(e => e.name && initList.indexOf(e) !== -1).map(e => e.name),
                                ...displayNames.filter(e => e.name && initList.indexOf(e) === -1 && e.name.startsWith('ADSEmbed-')).map(e => e.name),
                                ...displayNames.filter(e => e.name && initList.indexOf(e) === -1 && !e.name.startsWith('ADS')).map(e => e.name),
                                ...displayNames.filter(e => e.name && initList.indexOf(e) === -1 && e.name.startsWith('ADSWidget-')).map(e => e.name),
                                ...displayNames.filter(e => e.name && initList.indexOf(e) === -1 && e.name.startsWith('ADSMobile-')).map(e => e.name),
                                ...displayNames.filter(e => e.name && initList.indexOf(e) === -1 && e.name.startsWith('ADSMicro-')).map(e => e.name),
                            ]
                        });
                    } else {
                        res.send('Invalid Request');
                    }
                } else {
                    if (req.query.json && req.query.json === 'true') {
                        res.json({
                            displays: []
                        });
                    } else {
                        res.send('Invalid Request');
                    }
                }
            })
        } else
        if (req.query.command === 'get' && req.query.displayname) {
            sqlSafe('SELECT * FROM (SELECT sequenzia_display_history.name AS display_name, sequenzia_display_history.date AS display_date, sequenzia_display_history.screen AS screen_id, kanmi_channels.nsfw, kanmi_records.eid, kanmi_records.channel, kanmi_records.server, kanmi_records.cache_proxy, kanmi_records.attachment_name, kanmi_records.attachment_hash, kanmi_records.colorR, kanmi_records.colorG, kanmi_records.colorB, kanmi_records.sizeH, kanmi_records.sizeW, kanmi_records.sizeR FROM kanmi_records, kanmi_channels, sequenzia_display_history WHERE sequenzia_display_history.user = ? AND sequenzia_display_history.name = ? AND kanmi_records.eid = sequenzia_display_history.eid AND kanmi_records.channel = kanmi_channels.channelid) x LEFT OUTER JOIN (SELECT eid AS fav_id, date AS fav_date FROM sequenzia_favorites WHERE userid = ?) y ON x.eid = y.fav_id ORDER BY display_name, display_date DESC LIMIT 75', [req.session.discord.user.id, req.query.displayname, req.session.discord.user.id], (err, history) => {
                if (err) {
                    res.render('display_history', { user: req.session.user} );
                    printLine('SQL', `Fail to get display history for "${req.query.displayname}" - ${err.message}`, 'error');
                } else if (history.length > 0) {
                    let displayHistory = [];
                    history.forEach(x => {
                        let image
                        if (x.cache_proxy !== null) {
                            image = x.cache_proxy.startsWith('http') ? x.cache_proxy : `https://media.discordapp.net/attachments${x.cache_proxy}`
                        } else {
                            function getimageSizeParam() {
                                if (x.sizeH && x.sizeW && (x.sizeH > 512 || x.sizeW > 512)) {
                                    let ih = 512;
                                    let iw = 512;
                                    if (x.sizeW >= x.sizeH) {
                                        iw = (x.sizeW * (512 / x.sizeH)).toFixed(0)
                                    } else {
                                        ih = (x.sizeH * (512 / x.sizeW)).toFixed(0)
                                    }
                                    return `?width=${iw}&height=${ih}`
                                } else {
                                    return ''
                                }
                            }
                            image = `https://media.discordapp.net/attachments/` + ((x.attachment_hash.includes('/')) ? `${x.attachment_hash}${getimageSizeParam()}` : `${x.channel}/${x.attachment_hash}/${x.attachment_name}${getimageSizeParam()}`);
                        }
                        displayHistory.push({
                            preview: image,
                            id: x.id,
                            eid: x.eid,
                            screen: x.screen_id,
                            channel: x.channel,
                            server: x.server,
                            fav: (x.fav_date !== null),
                            color: [x.colorR, x.colorG, x.colorB],
                            ratio: x.sizeR,
                            nsfw: x.nsfw,
                            date: moment(x.display_date).format('MM/DD/YY HH:mm')
                        })
                    })
                    if (req.query.json && req.query.json === 'true') {
                        res.json({
                            display: history[0].display_name,
                            images: displayHistory,
                            user: req.session.user
                        });
                    } else {
                        res.render('display_history', { displayResults: [{
                                display: history[0].display_name,
                                images: displayHistory
                            }], user: req.session.user });
                    }
                } else {
                    res.render('display_history', { noResults: true, user: req.session.user } );
                }
            })
        } else
        if (req.query.command === 'timeSync' && req.query.displayname) {
            let screenID = "0";
            if (req.query.screen) {
                if (typeof req.query.screen === 'string') {
                    screenID = req.query.screen;
                } else {
                    screenID = req.query.screen.pop();
                }
            }
            sqlSafe('SELECT sequenzia_display_history.date, sequenzia_display_config.refreshTime FROM sequenzia_display_history, sequenzia_display_config WHERE sequenzia_display_history.user = ? AND sequenzia_display_config.user = ? AND sequenzia_display_history.name = ? AND sequenzia_display_config.name = ? AND sequenzia_display_history.screen = ? ORDER BY sequenzia_display_history.date DESC LIMIT 1', [req.session.discord.user.id, req.session.discord.user.id, req.query.displayname, req.query.displayname, screenID], (err, history) => {
                if (err) {
                    res.status(500);
                    printLine('SQL', `Fail to get display history for "${req.query.displayname}" - ${err.message}`, 'error');
                } else if (history.length > 0) {
                    let shown_date = undefined;
                    let displayed_date = undefined;
                    if (history[0].date) {
                        displayed_date = parseInt(moment(Date.parse(history[0].date)).format('x'));
                        shown_date = displayed_date - new Date();
                    }
                    if (req.query.json && req.query.json === 'true') {
                        res.json({
                            shown: displayed_date,
                            delta: shown_date,
                            interval: history[0].refreshTime
                        });
                    } else {
                        res.status(200).send(shown_date);
                    }
                } else {
                    res.status(404);
                }
            })
        } else
        if (req.query.command === 'set' && req.query.displayname && req.query.imageid) {
            const isExsists = await sqlPromiseSafe(`SELECT * FROM sequenzia_display_history WHERE eid = ? AND user = ?`, [req.query.imageid, req.session.discord.user.id]);
            if (isExsists.error) {
                printLine('SQL', `Error adding messages to display history - ${isExsists.error.sqlMessage}`, 'error', isExsists.error)
                res.status(500).send('FAULT');
            } else if (isExsists.rows.length > 0) {
                const updateHistoryItem = await sqlPromiseSafe(`UPDATE sequenzia_display_history SET screen = ?, name = ?, date = ? WHERE eid = ? AND user = ?`, [(req.query.screen) ? parseInt(req.query.screen) : 0, req.query.displayname, moment().format('YYYY-MM-DD HH:mm:ss'), req.query.imageid, req.session.discord.user.id])
                if (updateHistoryItem.error) {
                    printLine('SQL', `Error updating messages in display history - ${updateHistoryItem.error.sqlMessage}`, 'error', updateHistoryItem.error)
                    res.status(500).send('FAULT');
                } else {
                    printLine('DisplayHistory', `Updating Image "${req.query.imageid}" in Display History for "${req.query.displayname}"`, 'debug')
                    res.status(200).send('OK');
                }
            } else {
                const updateHistoryItem = await sqlPromiseSafe(`INSERT INTO sequenzia_display_history SET ${(req.query.displayname.includes('WebExtension') ? 'messageid' : 'eid')} = ?, name = ?, screen = ?, user = ?, date = ?`, [req.query.imageid, req.query.displayname, (req.query.screen) ? parseInt(req.query.screen) : 0, req.session.discord.user.id, moment().format('YYYY-MM-DD HH:mm:ss')])
                if (updateHistoryItem.error) {
                    printLine('SQL', `Error adding messages to display history - ${updateHistoryItem.error.sqlMessage}`, 'error', updateHistoryItem.error)
                    res.status(500).send('FAULT');
                } else {
                    printLine('DisplayHistory', `Saving Image "${req.query.imageid}" to Display History for "${req.query.displayname}"`, 'debug')
                    res.status(200).send('OK');
                }
            }
            let deleteCount = 250
            sqlSafe(`DELETE a FROM sequenzia_display_history a LEFT JOIN (SELECT eid AS keep_eid, date FROM sequenzia_display_history WHERE user = ? AND name = ? ORDER BY date DESC LIMIT ?) b ON (a.eid = b.keep_eid) WHERE b.keep_eid IS NULL AND a.user = ? AND a.name = ?;`, [req.session.discord.user.id, req.query.displayname, deleteCount, req.session.discord.user.id, req.query.displayname], (err, completed) => {
                if (err) {
                    printLine('SQL', `Error deleting from display history - ${err.sqlMessage}`, 'error', err)
                }
            })
        } else
        if (req.query.command === 'getConfig' && req.query.displayname) {
            sqlSafe('SELECT * FROM sequenzia_display_config WHERE user = ? AND name = ? LIMIT 1', [req.session.discord.user.id, req.query.displayname], (err, displayConfig) => {
                if (err) {
                    res.status(500).send('Internal server error');
                    printLine('SQL', `Fail to get display configuration for "${req.query.displayname}" - ${err.message}`, 'error');
                } else if (displayConfig.length > 0) {
                    const _configuration = Object.assign({}, displayConfig.pop())
                    if (req.query.json && req.query.json === 'true') {
                        res.json({
                            configuration: _configuration,
                        })
                    } else {
                        res.render('display_config', {
                            configuration: _configuration, user: req.session.user
                        })
                    }
                } else {
                    if (req.query.json && req.query.json === 'true') {
                        res.json({
                            configuration: {name: req.query.displayname, refreshTime: null}, user: req.session.user
                        })
                    } else {
                        res.render('display_config', {
                            configuration: {name: req.query.displayname, refreshTime: null}, user: req.session.user
                        })
                    }
                }
            })
        } else
        if (req.query.command === 'setConfig' && req.query.displayname) {
            req.body.user = req.session.discord.user.id;
            req.body.name = req.query.displayname;
            if (req.query.update && req.query.update === 'true') {
                sqlSafe('INSERT INTO sequenzia_display_config SET ? ON DUPLICATE KEY UPDATE ?', [{ uid: `${req.session.discord.user.id}-${req.query.displayname}`, ...req.body}, req.body], (err, displayConfig) => {
                    if (err) {
                        res.status(500).send('Internal server error');
                        printLine('SQL', `Fail to update display configuration for "${req.query.displayname}" - ${err.message}`, 'error');
                    } else if (displayConfig.affectedRows > 0) {
                        if (req.query.json && req.query.json === 'true') {
                            res.status(200)
                        } else {
                            res.status(200).send('Updated configuration OK')
                        }
                    } else {
                        res.status(200).send('Updated configuration?')
                    }
                })
            } else {
                req.body.uid = `${req.session.discord.user.id}-${req.query.displayname}`;
                sqlSafe('REPLACE INTO sequenzia_display_config SET ?', [req.body], (err, displayConfig) => {
                    if (err) {
                        res.status(500).send('Internal server error');
                        printLine('SQL', `Fail to update display configuration for "${req.query.displayname}" - ${err.message}`, 'error');
                    } else if (displayConfig.affectedRows > 0) {
                        if (req.query.json && req.query.json === 'true') {
                            res.status(200)
                        } else {
                            res.status(200).send('Updated configuration OK')
                        }
                    } else {
                        res.status(200).send('Updated configuration?')
                    }
                })
            }
        } else
        if (req.query.command === 'delete') {
            if (req.query.displayname) {
                sqlSafe('DELETE FROM sequenzia_display_history WHERE user = ? AND name = ?', [req.session.discord.user.id, req.query.displayname], (err, completed) => {
                    if (err) {
                        res.render('display_history', {user: req.session.user} );
                        printLine('SQL', `Fail to delete display history for "${req.query.displayname}" - ${err.message}`, 'error');
                    } else if (completed.affectedRows > 0) {
                        res.render('display_history', { deleted: completed.affectedRows, user: req.session.user } );
                    } else {
                        res.render('display_history', { nothingDeleted: true, user: req.session.user } );
                    }
                })
                sqlSafe('DELETE FROM sequenzia_display_config WHERE user = ? AND name = ?', [req.session.discord.user.id, req.query.displayname], (err, completed) => {
                    if (err) {
                        printLine('SQL', `Fail to delete display configuration for "${req.query.displayname}" - ${err.message}`, 'error');
                    }
                })
            } else {
                sqlSafe('DELETE FROM sequenzia_display_history WHERE user = ?', [req.session.discord.user.id], (err, completed) => {
                    if (err) {
                        res.render('display_history', {} );
                        printLine('SQL', `Fail to delete display all history - ${err.message}`, 'error');
                    } else if (completed.affectedRows > 0) {
                        res.render('display_history', { deleted: completed.affectedRows, user: req.session.user } );
                    } else {
                        res.render('display_history', { nothingDeleted: true, user: req.session.user } );
                    }
                })
                sqlSafe('DELETE FROM sequenzia_display_config WHERE user = ?', [req.session.discord.user.id], (err, completed) => {
                    if (err) {
                        printLine('SQL', `Fail to delete all display configurations - ${err.message}`, 'error');
                    }
                })
            }
        }
        else {
            res.send('Bad Command');
        }
    } else {
        res.send('Missing Command');
    }
}
