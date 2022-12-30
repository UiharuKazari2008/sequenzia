const global = require('../config.json');
const config = require('../host.config.json');
const { printLine } = require("./logSystem");
const { sendData } = require('./mqAccess');
const { sqlSafe, sqlPromiseSimple } = require('../js/sqlClient');

module.exports = async (req, res, next) => {
    try {
        const thisUser = res.locals.thisUser

        if (thisUser.user && (req.session.login_source < 900 || (req.body.action && (req.body.action === "Pin" || req.body.action === "SetWatchHistory") && req.body && req.body.bypass && req.body.bypass === "appIntent"))) {
            switch (req.body.action) {
                case 'Pin':
                case 'Unpin':
                    sqlSafe(`SELECT * FROM sequenzia_favorites WHERE eid = ? AND userid = ? LIMIT 1`, [req.body.messageid, thisUser.discord.user.id], (err, found) => {
                        if (err) {
                            printLine("ActionParser", `Unable to update ${req.body.messageid}:${req.body.channelid} to ${req.body.data}: ${err.sqlMessage}`, 'error', err)
                            res.status(500).send('Database Error');
                        } else {
                            switch (req.body.action) {
                                case 'Pin':
                                    printLine("ActionParser", `Request to Pin ${req.body.messageid}`, 'info', req.body)
                                    if (found.length === 0) {
                                        sqlSafe(`INSERT INTO sequenzia_favorites SET eid = ?, userid = ?`, [req.body.messageid, thisUser.discord.user.id], (err, result) => {
                                            if (err) {
                                                printLine("ActionParser", `Unable to update ${req.body.messageid}:${req.body.channelid}:${thisUser.discord.user.id} to ${req.body.data}: ${err.sqlMessage}`, 'error', err)
                                                res.status(500).send('Database Error');
                                            } else if (result.affectedRows && result.affectedRows > 0) {
                                                res.status(200).send(`Favorite Saved`);
                                            } else {
                                                res.status(500).send(`Favorite Failed`);
                                            }
                                        })
                                    } else {
                                        res.status(200).send(`Message Already Favoured!`);
                                    }
                                    break;
                                case 'Unpin':
                                    printLine("ActionParser", `Request to UnPin ${req.body.messageid}`, 'info', req.body)
                                    if (found.length !== 0) {
                                        sqlSafe(`DELETE FROM sequenzia_favorites WHERE eid = ? AND userid = ?`, [req.body.messageid, thisUser.discord.user.id], (err, result) => {
                                            if (err) {
                                                printLine("ActionParser", `Unable to update ${req.body.messageid}:${req.body.channelid}:${thisUser.discord.user.id} to ${req.body.data}: ${err.sqlMessage}`, 'error', err)
                                                res.status(500).send('Database Error');
                                            } else if (result.affectedRows && result.affectedRows > 0) {
                                                res.status(200).send(`Favorite Deleted`);
                                            } else {
                                                res.status(500).send(`Removal Failed`);
                                            }
                                        })
                                    } else {
                                        res.status(200).send(`Message Not Favoured!`);
                                    }
                                    break;
                                default:
                                    res.status(400).send(`Unknown Request`);
                                    break;
                            }
                        }
                    })
                    break;
                case 'PinHistory':
                case 'UnpinHistory':
                    printLine("ActionParser", `Request to Pin History ${req.body.messageid}`, 'info', req.body)
                    sqlSafe(`UPDATE sequenzia_navigation_history SET saved = ? WHERE \`index\` = ? AND user = ?`, [(req.body.action === 'PinHistory'), req.body.messageid, thisUser.discord.user.id], (err, result) => {
                        if (err) {
                            printLine("ActionParser", `Unable to update history save status for ${req.body.messageid}: ${err.sqlMessage}`, 'error', err)
                            res.status(500).send('Database Error');
                        } else if (result.affectedRows && result.affectedRows > 0) {
                            res.status(200).send(`Favorite Saved`);
                        } else {
                            res.status(500).send(`Favorite Failed`);
                        }
                    })
                    break;
                case 'RemoveHistory':
                    printLine("ActionParser", `Request to Remove History Item ${req.body.messageid}`, 'info', req.body)
                    sqlSafe(`DELETE FROM sequenzia_navigation_history WHERE \`index\` = ? AND user = ?`, [req.body.messageid, thisUser.discord.user.id], (err, result) => {
                        if (err) {
                            printLine("ActionParser", `Unable to remove history item ${req.body.messageid}: ${err.sqlMessage}`, 'error', err)
                            res.status(500).send('Database Error');
                        } else if (result.affectedRows && result.affectedRows > 0) {
                            res.status(200).send(`Item Deleted`);
                        } else {
                            res.status(500).send(`Failed to delete`);
                        }
                    })
                    break;
                case 'RemoveHistoryAll':
                    printLine("ActionParser", `Request to dump History`, 'info', req.body)
                    sqlSafe(`DELETE FROM sequenzia_navigation_history WHERE user = ? AND saved = 0`, [thisUser.discord.user.id], (err, result) => {
                        if (err) {
                            printLine("ActionParser", `Unable to remove all history: ${err.sqlMessage}`, 'error', err)
                            res.status(500).send('Database Error');
                        } else if (result.affectedRows && result.affectedRows > 0) {
                            res.status(200).send(`History Deleted`);
                        } else {
                            res.status(500).send(`Failed to delete history`);
                        }
                    })
                    break;
                case 'SetWatchHistory':
                    printLine("ActionParser", `Request to set watch History`, 'info', req.body)
                    if (req.body.viewed === 0) {
                        sqlSafe(`DELETE FROM kongou_watch_history WHERE usereid = ?`, [`${thisUser.discord.user.id}-${req.body.eid}`], (err, result) => {
                            if (err) {
                                printLine("ActionParser", `Unable to update watch history: ${err.sqlMessage}`, 'error', err)
                                res.status(500).send('Database Error');
                            } else if (result.affectedRows && result.affectedRows > 0) {
                                res.status(200).send(`History Reset`);
                            } else {
                                res.status(500).send(`Failed to save history`);
                            }
                        })
                    } else {
                        sqlSafe(`INSERT INTO kongou_watch_history SET usereid = ?, user = ?, eid = ?, viewed  = ? ON DUPLICATE KEY UPDATE viewed = ?, date = NOW()`, [`${thisUser.discord.user.id}-${req.body.eid}`, thisUser.discord.user.id, req.body.eid, req.body.viewed, req.body.viewed], (err, result) => {
                            if (err) {
                                printLine("ActionParser", `Unable to update watch history: ${err.sqlMessage}`, 'error', err)
                                res.status(500).send('Database Error');
                            } else if (result.affectedRows && result.affectedRows > 0) {
                                res.status(200).send(`History Saved`);
                            } else {
                                res.status(500).send(`Failed to save history`);
                            }
                        })
                    }
                    const tempLastEpisode = await sqlPromiseSimple(`SELECT Max(y.eid) AS eid, MAX(y.show_id) AS show_id FROM (SELECT * FROM kanmi_system.kongou_watch_history WHERE user = '${thisUser.discord.user.id}' ORDER BY date DESC LIMIT 1) x LEFT JOIN (SELECT * FROM kanmi_system.kongou_episodes) y ON (x.eid = y.eid);`)
                    if (tempLastEpisode.rows.length > 0) {
                        const nextEpisodeView = await sqlPromiseSimple(`SELECT * FROM  (SELECT * FROM kanmi_system.kongou_episodes WHERE eid > ${tempLastEpisode.rows[0].eid} AND show_id = ${tempLastEpisode.rows[0].show_id} AND season_num > 0 ORDER BY season_num ASC, episode_num ASC LIMIT 1) x LEFT JOIN (SELECT * FROM kanmi_system.kongou_shows) y ON (x.show_id = y.show_id);`)
                        console.log(nextEpisodeView.rows)
                        thisUser.kongou_next_episode = nextEpisodeView.rows[0];
                    } else {
                        thisUser.kongou_next_episode = {};
                    }
                    break;
                case 'GetWatchHistory':
                    printLine("ActionParser", `Request to get watch History`, 'info')
                    sqlSafe(`SELECT * FROM kongou_watch_history WHERE user = ?`, [thisUser.discord.user.id], (err, result) => {
                        if (err) {
                            printLine("ActionParser", `Unable to deliver watch history: ${err.sqlMessage}`, 'error', err)
                            res.status(500).send('Database Error');
                        } else if (result && result.length > 0) {
                            res.status(200).json({
                                history: result.map(row => {
                                    return {
                                        eid: row.eid,
                                        viewed: row.viewed,
                                    }
                                })
                            });
                        } else {
                            res.status(500).send(`Failed to get history`);
                        }
                    })
                    break;
                case 'PinUser':
                case 'UnpinUser':
                    sqlSafe(`SELECT * FROM sequenzia_artists_favorites WHERE id = ? AND userid = ? LIMIT 1`, [req.body.messageid, thisUser.discord.user.id], (err, found) => {
                        if (err) {
                            printLine("ActionParser", `Unable to update ${req.body.messageid} to ${req.body.data}: ${err.sqlMessage}`, 'error', err)
                            res.status(500).send('Database Error');
                        } else {
                            switch (req.body.action) {
                                case 'PinUser':
                                    printLine("ActionParser", `Request to Pin ${req.body.messageid}`, 'info', req.body)
                                    if (found.length === 0) {
                                        sqlSafe(`INSERT INTO sequenzia_artists_favorites SET id = ?, userid = ?`, [req.body.messageid, thisUser.discord.user.id], (err, result) => {
                                            if (err) {
                                                printLine("ActionParser", `Unable to update ${req.body.messageid}:${thisUser.discord.user.id} to ${req.body.data}: ${err.sqlMessage}`, 'error', err)
                                                res.status(500).send('Database Error');
                                            } else if (result.affectedRows && result.affectedRows > 0) {
                                                res.status(200).send(`Favorite Saved`);
                                            } else {
                                                res.status(500).send(`Favorite Failed`);
                                            }
                                        })
                                    } else {
                                        res.status(200).send(`Message Already Favoured!`);
                                    }
                                    break;
                                case 'UnpinUser':
                                    printLine("ActionParser", `Request to UnPin ${req.body.messageid}`, 'info', req.body)
                                    if (found.length !== 0) {
                                        sqlSafe(`DELETE FROM sequenzia_artists_favorites WHERE id = ? AND userid = ?`, [req.body.messageid, thisUser.discord.user.id], (err, result) => {
                                            if (err) {
                                                printLine("ActionParser", `Unable to update ${req.body.messageid}:${thisUser.discord.user.id} to ${req.body.data}: ${err.sqlMessage}`, 'error', err)
                                                res.status(500).send('Database Error');
                                            } else if (result.affectedRows && result.affectedRows > 0) {
                                                res.status(200).send(`Favorite Deleted`);
                                            } else {
                                                res.status(500).send(`Removal Failed`);
                                            }
                                        })
                                    } else {
                                        res.status(200).send(`Message Not Favoured!`);
                                    }
                                    break;
                                default:
                                    res.status(400).send(`Unknown Request`);
                                    break;
                            }
                        }
                    })
                    break;
                case 'Report':
                    sqlSafe(`UPDATE kanmi_records SET flagged = 1 WHERE id = ? AND channel = ? LIMIT 1`, [req.body.messageid, req.body.channelid], (err, results) => {
                        if (err) {
                            printLine("ActionParser", `Unable to complete update from ${req.body.messageid}:${req.body.channelid} to ${req.body.data}: ${err.sqlMessage}`, 'error', err);
                            res.status(500).send('Database Error');
                        } else if (results.affectedRows && results.affectedRows > 0) {
                            printLine("ActionParser", `Flagged ${req.body.messageid}:${req.body.channelid} for review`, 'error')
                            res.status(200).send(`Flagged for Verification`);
                        } else {
                            printLine("ActionParser", `No Results for ${req.body.messageid}:${req.body.channelid} when attempting to flag`, 'error')
                            res.status(404).send('Message not found');
                        }
                    });
                    break;
                case 'RemoveReport':
                    sqlSafe(`UPDATE kanmi_records SET flagged = 0 WHERE id = ? AND channel = ? LIMIT 1`, [req.body.messageid, req.body.channelid], (err, results) => {
                        if (err) {
                            printLine("ActionParser", `Unable to complete update from ${req.body.messageid}:${req.body.channelid} to ${req.body.data}: ${err.sqlMessage}`, 'error', err);
                            res.status(500).send('Database Error');
                        } else if (results.affectedRows && results.affectedRows > 0) {
                            printLine("ActionParser", `Removed flag for post ${req.body.messageid}:${req.body.channelid}`, 'error')
                            res.status(200).send(`Flag Removed`);
                        } else {
                            printLine("ActionParser", `No Results for ${req.body.messageid}:${req.body.channelid} when attempting to remove flag`, 'error')
                            res.status(404).send('Message not found');
                        }
                    });
                    break;
                case 'CollItemAdd':
                case 'CollItemRemove':
                case 'CollItemToggle':
                    sqlSafe(`SELECT DISTINCT * FROM sequenzia_album_items, sequenzia_albums WHERE sequenzia_album_items.eid = ? AND sequenzia_album_items.aid = ?  AND sequenzia_albums.aid = sequenzia_album_items.aid AND sequenzia_albums.owner = ? LIMIT 1`, [req.body.messageid, req.body.albumid, thisUser.discord.user.id], (err, found) => {
                        if (err) {
                            printLine("ActionParser", `Unable to update ${req.body.messageid}:${req.body.channelid} to ${req.body.data}: ${err.sqlMessage}`, 'error', err)
                            res.status(500).send('Database Error');
                        } else {
                            switch (req.body.action) {
                                case 'CollItemAdd':
                                    printLine("ActionParser", `Request to Add ${req.body.messageid} to Album ${req.body.albumid}`, 'info', req.body)
                                    if (found.length === 0) {
                                        sqlSafe(`INSERT INTO sequenzia_album_items SET eid = ?, aid = ?`, [req.body.messageid, req.body.albumid], (err, result) => {
                                            if (err) {
                                                printLine("ActionParser", `Unable to update ${req.body.messageid}:${req.body.channelid}:${thisUser.discord.user.id} to ${req.body.data}: ${err.sqlMessage}`, 'error', err)
                                                res.status(500).send('Database Error');
                                            } else if (result.affectedRows && result.affectedRows > 0) {
                                                res.status(200).send(`Added to album`);
                                            } else {
                                                res.status(500).send(`Unable to add to album`);
                                            }
                                        })
                                    } else {
                                        res.status(200).send(`Already added to album!`);
                                    }
                                    break;
                                case 'CollItemRemove':
                                    printLine("ActionParser", `Request to Remove ${req.body.messageid} from Album ${req.body.albumid}`, 'info', req.body)
                                    if (found.length !== 0) {
                                        sqlSafe(`DELETE FROM sequenzia_album_items WHERE eid = ? AND aid = ?`, [req.body.messageid,  req.body.albumid], (err, result) => {
                                            if (err) {
                                                printLine("ActionParser", `Unable to update ${req.body.messageid}:${req.body.channelid}:${thisUser.discord.user.id} to ${req.body.data}: ${err.sqlMessage}`, 'error', err)
                                                res.status(500).send('Database Error');
                                            } else if (result.affectedRows && result.affectedRows > 0) {
                                                res.status(200).send(`Removed from Album`);
                                            } else {
                                                res.status(500).send(`Unable to remove from album`);
                                            }
                                        })
                                    } else {
                                        res.status(200).send(`Nothing to Remove!`);
                                    }
                                    break;
                                 case 'CollItemToggle':
                                    printLine("ActionParser", `Request to Remove ${req.body.messageid} from Album ${req.body.albumid}`, 'info', req.body)
                                    if (found.length !== 0) {
                                        sqlSafe(`DELETE FROM sequenzia_album_items WHERE eid = ? AND aid = ?`, [req.body.messageid,  req.body.albumid], (err, result) => {
                                            if (err) {
                                                printLine("ActionParser", `Unable to update ${req.body.messageid}:${req.body.channelid}:${thisUser.discord.user.id} to ${req.body.data}: ${err.sqlMessage}`, 'error', err)
                                                res.status(500).send('Database Error');
                                            } else if (result.affectedRows && result.affectedRows > 0) {
                                                res.status(200).send(`Removed from Album`);
                                            } else {
                                                res.status(500).send(`Unable to remove from album`);
                                            }
                                        })
                                    } else {
                                        sqlSafe(`INSERT INTO sequenzia_album_items SET eid = ?, aid = ?`, [req.body.messageid, req.body.albumid], (err, result) => {
                                            if (err) {
                                                printLine("ActionParser", `Unable to update ${req.body.messageid}:${req.body.channelid}:${thisUser.discord.user.id} to ${req.body.data}: ${err.sqlMessage}`, 'error', err)
                                                res.status(500).send('Database Error');
                                            } else if (result.affectedRows && result.affectedRows > 0) {
                                                res.status(200).send(`Added to album`);
                                            } else {
                                                res.status(500).send(`Unable to add to album`);
                                            }
                                        })
                                    }
                                    break;
                                default:
                                    res.status(400).send(`Unknown Request`);
                                    break;
                            }
                        }
                    })
                    break;
                case 'CollUpdate':
                    sqlSafe(`SELECT DISTINCT * FROM sequenzia_albums WHERE sequenzia_albums.aid = ? AND sequenzia_albums.owner = ? LIMIT 1`, [req.body.albumid, thisUser.discord.user.id], (err, found) => {
                        if (err) {
                            res.status(500).send('Database Error');
                        } else {
                            let uri = ''
                            switch (req.body.album_uri.toString()) {
                                case '0':
                                    uri = 'gallery';
                                    break;
                                case '1':
                                    uri = 'files';
                                    break;
                                case '2':
                                    uri = 'cards';
                                    break;
                                default:
                                    break;
                            }
                            if (found.length !== 0) {
                                sqlSafe(`UPDATE sequenzia_albums SET name = ?, uri = ?, privacy = ?, owner = ? WHERE aid = ?`, [req.body.album_name, uri,  req.body.album_privacy, thisUser.discord.user.id, req.body.albumid], (err, result) => {
                                    if (err) {
                                        res.status(500).send('Database Error');
                                    } else if (result.affectedRows && result.affectedRows > 0) {
                                        res.status(200).send(`Album Created`);
                                    } else {
                                        res.status(500).send(`Unable to create album`);
                                    }
                                })
                            } else {
                                res.status(500).send(`Album does not exist`);
                            }
                        }
                    })
                    break;
                case 'CollCreate':
                    sqlSafe(`SELECT DISTINCT * FROM sequenzia_albums WHERE sequenzia_albums.name = ? AND sequenzia_albums.owner = ? LIMIT 1`, [req.body.album_name, thisUser.discord.user.id], (err, found) => {
                        if (err) {
                            res.status(500).send('Database Error');
                        } else {
                            let uri = ''
                            switch (req.body.album_uri.toString()) {
                                case '0':
                                    uri = 'gallery';
                                    break;
                                case '1':
                                    uri = 'files';
                                    break;
                                case '2':
                                    uri = 'cards';
                                    break;
                                default:
                                    break;
                            }
                            if (found.length === 0) {
                                sqlSafe(`INSERT INTO sequenzia_albums SET name = ?, uri = ?, privacy = ?, owner = ?`, [req.body.album_name, uri,  req.body.album_privacy, thisUser.discord.user.id], (err, result) => {
                                    if (err) {
                                        res.status(500).send('Database Error');
                                    } else if (result.affectedRows && result.affectedRows > 0) {
                                        res.status(200).send(`Album Created`);
                                    } else {
                                        res.status(500).send(`Unable to create album`);
                                    }
                                })
                            } else {
                                res.status(200).send(`Album already exists!`);
                            }
                        }
                    })
                    break;
                case 'CollDelete':
                    sqlSafe(`SELECT DISTINCT * FROM sequenzia_albums WHERE aid = ? AND owner = ? LIMIT 1`, [req.body.albumid, thisUser.discord.user.id], (err, found) => {
                        if (err) {
                            res.status(500).send('Database Error');
                        } else {
                            if (found.length !== 0) {
                                sqlSafe(`DELETE FROM sequenzia_albums WHERE aid = ? AND owner = ?`, [req.body.albumid, thisUser.discord.user.id], (err, result) => {
                                    if (err) {
                                        res.status(500).send('Database Error');
                                    } else if (result.affectedRows && result.affectedRows > 0) {
                                        res.status(200).send(`Album Deleted`);
                                    } else {
                                        res.status(500).send(`Unable to delete album`);
                                    }
                                })
                            } else {
                                res.status(404).send(`Album Not does not exist!`);
                            }
                        }
                    })
                    break;
                default:
                    printLine("ActionParser", `Unknown Action : "${req.body.action}"`, 'error', req.body);
                    res.status(400).send(`Invalid Request`);
                    break;
            }
        } else {
            printLine("GeneralActionParser", `Insecure Session attempted to access API by ${thisUser.user.username}`, 'critical');
            res.status(401).send('Session was not authenticated securely! You CAN NOT use a Static Login Key or Blind Token o preform enhanced actions! Logout and Login with a secure login meathod.');
        }
    } catch (err) {
        printLine("GeneralActionParser", `Caught Error in General Action Parser : ${err.message}`, 'error', err)
        res.status(500).send(err.message);
    }
};
