const global = require('../config.json')
let config = require('../host.config.json')

if (process.env.SYSTEM_NAME && process.env.SYSTEM_NAME.trim().length > 0)
    config.system_name = process.env.SYSTEM_NAME.trim()

const { printLine } = require("./logSystem")();
const { sendData } = require('./mqAccess');
const { redisRetrieve } = require('../js/redisClient');
const { sqlPromiseSafe } = require('../js/sqlClient');
const app = require("../app");
const {md5} = require("request/lib/helpers");

async function getCacheData(key, isJson, local) {
    if (global.shared_cache) {
        if (local && app.get(local))
            return app.get(local)
        const result = await redisRetrieve(key)
        const parsed = (isJson) ? JSON.parse(result) : result
        if (local)
            app.set(local, parsed)
        return parsed
    }
    return app.get(key)
}

module.exports = async (req, res, next) => {
    function sendRequest(MessageBody, queue) {
        sendData(queue || `${global.mq_discord_out}.sequenzia`, MessageBody, function (callback) {})
    }
    try {
        const thisUser = res.locals.thisUser

        if (thisUser.master && thisUser.master.user && (req.session.login_source < 900 || (req.headers && req.headers['x-bypass-warning'] && req.headers['x-bypass-warning'] === 'appIntent'))) {
            let requestResults = {}
            let movedResults = {}
            let removedResults = {}
            await (((req.body.batch) ? [...req.body.batch] : [{...req.body}]).map(async (job, index, array) => {
                let _return = 500;
                switch (job.action)  {
                    case 'MovePost':
                        printLine("ActionParser", `Request to Move ${job.messageid} from ${job.channelid} to ${job.data}`, 'info', job)
                        const results = await sqlPromiseSafe(`SELECT * FROM kanmi_records WHERE id = ? AND channel = ? LIMIT 1`, [job.messageid, job.channelid])
                        if (results.rows.length > 0) {
                            sendRequest({
                                fromClient: `return.Sequenzia.${config.system_name}`,
                                messageReturn: false,
                                messageID: job.messageid,
                                messageChannelID: job.channelid,
                                messageServerID: job.serverid,
                                messageType: 'command',
                                messageAction: 'MovePost',
                                messageData: job.data
                            })
                            if (req.body.batch) {
                                _return = 200
                            } else {
                                res.status(200).send(`Message Moved to ${job.data}`);
                            }
                            await sqlPromiseSafe(`UPDATE kanmi_records SET n_channel = ? WHERE id = ? AND channel = ?`, [job.data.dest, job.messageid, job.channelid])
                        } else {
                            printLine("ActionParser", `No Results for ${job.messageid}:${job.channelid} to move`, 'error')
                            if (req.body.batch) {
                                _return = 404
                            } else {
                                res.status(404).send('Message not found');
                            }
                        }
                        break;
                    case 'RotatePost':
                        printLine("ActionParser", `Request to Rotate ${job.messageid}`, 'info', job)
                        sendRequest({
                            fromClient: `return.Sequenzia.${config.system_name}`,
                            messageReturn: false,
                            messageID: job.messageid,
                            messageChannelID: job.channelid,
                            messageServerID: job.serverid,
                            messageType: 'command',
                            messageAction: 'RotatePost',
                            messageData: job.data
                        })
                        if (req.body.batch) {
                            _return = 200
                        } else {
                            res.status(200).send(`Requested to Rotate Image`);
                        }
                        break;
                    case 'ArchivePost':
                        printLine("ActionParser", `Request to Archive ${job.messageid} from ${job.channelid}`, 'info', job)
                        sendRequest({
                            fromClient: `return.Sequenzia.${config.system_name}`,
                            messageReturn: false,
                            messageID: job.messageid,
                            messageChannelID: job.channelid,
                            messageServerID: job.serverid,
                            messageType: 'command',
                            messageAction: 'ArchivePost'
                        })
                        if (req.body.batch) {
                            _return = 200
                        } else {
                            res.status(200).send(`Requested to Archive Message`);
                        }
                        break;
                    case 'RemovePost':
                        printLine("ActionParser", `Request to Delete ${job.messageid} from ${job.channelid}`, 'info', job)
                        if (!global.disable_fast_delete) {
                            sendRequest({
                                fromClient: `return.Sequenzia.${config.system_name}`,
                                messageReturn: false,
                                messageID: job.messageid,
                                messageChannelID: job.channelid,
                                messageServerID: job.serverid,
                                messageType: 'command',
                                messageAction: 'RemovePost'
                            }, global.mq_discord_out + '.backlog')
                        }
                        await sqlPromiseSafe(`UPDATE kanmi_records SET hidden = 1 WHERE id = ? AND channel = ?`, [job.messageid, job.channelid])
                        if (req.body.batch) {
                            _return = 200
                        } else {
                            res.status(200).send(`Requested to Delete Message`);
                        }
                        break;
                    case 'RemoveResults':
                        printLine("ActionParser", `Request to all results based on cache ${job.cache}`, 'info', job)
                        const meta = await getCacheData(`meta-${thisUser.master.discord.user.id}-${job.cache}`, true)
                        if (meta && meta.count && meta.count !== 0) {
                            _return = await getCacheData(`query-${thisUser.master.discord.user.id}-${job.cache}`, true, meta.key);
                            if (_return) {
                                const delete_ids = _return.rows.filter(l => thisUser.master.discord.channels.manage.indexOf(l.channel) !== -1);
                                function splitArray(array, chunkSize) {
                                    const result = [];
                                    for (let i = 0; i < array.length; i += chunkSize) {
                                        result.push(array.slice(i, i + chunkSize));
                                    }
                                    return result;
                                }
                                await splitArray(delete_ids, 500).reduce((promiseChain, batch, i, a) => {
                                    return promiseChain.then(() => new Promise(async (resolve) => {
                                        await sqlPromiseSafe(`UPDATE kanmi_records SET hidden = 1 WHERE id IN (${batch.map(e => e.id).join(', ')})`, []);
                                        printLine("Clean", `Deleted [${batch.map(e => e.id).join(', ')}]`, "info");
                                        resolve();
                                    }))
                                }, Promise.resolve());
                                printLine("RemoveResults", `Delete ${_return.rows.filter(l => thisUser.master.discord.channels.manage.indexOf(l.channel) !== -1).length} Files`, 'warn')
                                res.status(200).send(`Requested to Delete Results`);
                            } else {
                                res.status(500).send(`Data is missing or empty`);
                            }
                        } else {
                            res.status(500).send(`Cache is missing or empty`);
                        }
                        break;
                    case 'Thumbnail':
                    case 'VideoThumbnail':
                        printLine("ActionParser", `Request to Generate Thumbnail ${job.messageid} from ${job.channelid}`, 'info', job)
                        sendRequest({
                            fromClient: `return.Sequenzia.${config.system_name}`,
                            messageReturn: false,
                            messageID: job.messageid,
                            messageChannelID: job.channelid,
                            messageServerID: job.serverid,
                            messageType: 'command',
                            messageAction: (job.action === 'Thumbnail') ? 'CacheImage' : 'CacheVideo'
                        }, global.mq_discord_out + '.backlog')
                        if (req.body.batch) {
                            _return = 200
                        } else {
                            res.status(200).send(`Requested to Cache Image`);
                        }
                        break;
                    case 'RenamePost':
                        printLine("ActionParser", `Request to Rename File ${job.messageid} to "${job.data}"`, 'info', job)
                        sendRequest({
                            fromClient: `return.Sequenzia.${config.system_name}`,
                            messageReturn: false,
                            messageID: job.messageid,
                            messageChannelID: job.channelid,
                            messageData: job.data,
                            messageType: 'command',
                            messageAction: 'RenamePost'
                        })
                        if (req.body.batch) {
                            _return = 200
                        } else {
                            res.status(200).send(`Requested to Rename Message`);
                        }
                        break;
                    case 'EditTextPost':
                        printLine("ActionParser", `Request to Edit Contents ${job.messageid} to "${job.data}"`, 'info', job)
                        sendRequest({
                            fromClient: `return.Sequenzia.${config.system_name}`,
                            messageReturn: false,
                            messageID: job.messageid,
                            messageChannelID: job.channelid,
                            messageData: job.data.substring(0,2000),
                            messageType: 'command',
                            messageAction: 'EditTextPost'
                        })
                        if (req.body.batch) {
                            _return = 200
                        } else {
                            res.status(200).send(`Requested to edit Message Contenst`);
                        }
                        break;
                    case 'RequestFile':
                    case 'DeCacheFile':
                        printLine("ActionParser", `Request to ${(job.action === 'RequestFile') ? 'Download' : 'Decache'} File ${job.messageid}:${job.channelid}"`, 'info', job)
                        if (global.mq_master_cdn) {
                            const foundMessages = await sqlPromiseSafe(`SELECT eid FROM kanmi_records WHERE id = ? AND channel = ? LIMIt 1`, [job.messageid, job.channelid])
                            if (foundMessages.rows && foundMessages.rows.length > 0) {
                                sendData(global.mq_master_cdn, {
                                    fromClient: `return.Sequenzia.${config.system_name}`,
                                    messageData: {
                                        ...foundMessages.rows[0]
                                    },
                                    messageUpdate: {},
                                    messageIntent: (job.action === 'RequestFile') ? 'DownloadMaster' : 'RemoveMaster'
                                }, function (callback) {
                                    if (callback) {
                                        printLine("KanmiMQ", `Sent to ${global.mq_master_cdn}`, 'info')
                                    } else {
                                        printLine("KanmiMQ", `Failed to send to ${global.mq_master_cdn}`, 'error')
                                    }
                                })
                                if (req.body.batch) {
                                    _return = 200
                                } else {
                                    res.status(200).send((job.action === 'RequestFile') ? `Request Fetch, please wait...` : 'Requested to remove cache')
                                }
                            } else {
                                printLine("ActionParser", `Unable to request download for ${job.messageid}:${job.channelid} : Not Found`, 'error');
                                if (req.body.batch) {
                                    _return = 404
                                } else {
                                    res.status(404).send('Message not found');
                                }
                            }
                        } else {
                            if (req.body.batch) {
                                _return = 500
                            } else {
                                res.status(500).send(`Server is not configured for CDN Master File storage`);
                            }
                        }
                        break;
                    case 'DownloadLink':
                        if (!(thisUser.master.discord.servers.download && thisUser.master.discord.servers.download.length > 0)) {
                            printLine("ActionParser", `Missing Static Configuration Value : Cannot "${job.action}", You dont have any servers that your allowed to download to`, 'error', job);
                            if (req.body.batch) {
                                _return = 500
                            } else {
                                res.status(500).send(`Missing Static Configuration Value : Cannot "${job.action}", You dont have any servers that your allowed to download to`);
                            }
                        } else {
                            printLine("ActionParser", `Request to Download URL ${job.url}"`, 'info', job)
                            let url = job.url.substring(0, 1900);
                            if (job.url.includes("x.com") && job.url.includes('/photo')) {
                                url = url.split('/photo')[0];
                            }
                            let messageText = 'REQUEST ' +  url;
                            if (job.channelid) {
                                messageText += ` _DEST_ ${job.channelid}`
                            }

                            sendRequest({
                                fromClient: `return.Sequenzia.${config.system_name}`,
                                messageReturn: false,
                                messageType: 'stext',
                                messageChannelID: thisUser.master.discord.servers.download.filter(e => e.serverid === job.serverid)[0].channelid,
                                messageText: messageText
                            })
                            if (req.body.batch) {
                                _return = 200
                            } else {
                                res.status(200).send(`Requested Download`);
                            }
                        }
                        break;
                    case 'textMessage':
                        printLine("ActionParser", `Send Text Message to ${job.channelid}`, 'info', job)
                        sendRequest({
                            fromClient: `return.Sequenzia.${config.system_name}`,
                            messageReturn: false,
                            messageType: 'stext',
                            messageChannelID: job.channelid,
                            messageUserID: thisUser.master.discord.user.id,
                            messageText: job.text.substring(0, 1900)
                        })
                        if (req.body.batch) {
                            _return = 200
                        } else {
                            res.status(200).send(`Text Message Sent`);
                        }
                        break;
                    case 'followPixiv':
                        if (thisUser.master.discord && thisUser.master.discord.permissions.specialPermissions.indexOf('interact')) {
                            printLine("ActionParser", `Requested Pixiv to follow use ${job.id}`, 'info', job)
                            sendRequest({
                                fromClient: `return.Sequenzia.${config.system_name}`,
                                messageReturn: false,
                                postID: job.id,
                                messageID: job.messageid,
                                messageChannelID: job.channelid,
                                messageServerID: job.serverid,
                                messageAction: 'add',
                                messageIntent: 'Follow'
                            }, global.mq_pixiv_in || 'inbox.pixiv')
                            if (req.body.batch) {
                                _return = 200
                            } else {
                                res.status(200).send(`Follow request sent to Pixiv`);
                            }
                        } else {
                            if (req.body.batch) {
                                _return = 400
                            } else {
                                res.status(400).send(`Not Authorised`);
                            }
                        }
                        break;
                    case 'pixivDownloadUser':
                        if (thisUser.master.discord && thisUser.master.discord.permissions.specialPermissions.indexOf('interact')) {
                            const downloadChannel = thisUser.master.discord.servers.download.filter(e => e.serverid === job.serverid);
                            if (downloadChannel.length > 0) {
                                printLine("ActionParser", `Requested Pixiv to download images from user ${job.id}`, 'info', job)
                                sendRequest({
                                    fromClient: `return.Sequenzia.${config.system_name}`,
                                    messageReturn: false,
                                    postID: job.id,
                                    messageID: job.messageid,
                                    messageChannelID: downloadChannel[0].channelid,
                                    messageServerID: job.serverid,
                                    messageAction: 'add',
                                    messageIntent: 'DownloadUser'
                                }, global.mq_pixiv_in || 'inbox.pixiv')
                                if (req.body.batch) {
                                    _return = 200
                                } else {
                                    res.status(200).send(`Downloading posts from user, this make take some time.<br/>Results will be in the servers downloads folder.`);
                                }
                            } else {
                                if (req.body.batch) {
                                    _return = 404
                                } else {
                                    res.status(404).send(`Downloads channel was not found for this server!`);
                                }
                            }
                        } else {
                            if (req.body.batch) {
                                _return = 400
                            } else {
                                res.status(400).send(`Not Authorised`);
                            }
                        }
                        break;
                    case 'pixivExpand':
                        if (thisUser.master.discord && thisUser.master.discord.permissions.specialPermissions.indexOf('interact')) {
                            const downloadChannel = thisUser.master.discord.servers.download.filter(e => e.serverid === job.serverid);
                            if (downloadChannel.length > 0) {
                                printLine("ActionParser", `Requested Pixiv to expand search for post ${job.id}`, 'info', job)
                                sendRequest({
                                    fromClient: `return.Sequenzia.${config.system_name}`,
                                    messageReturn: false,
                                    postID: job.id,
                                    messageID: job.messageid,
                                    messageChannelID: downloadChannel[0].channelid,
                                    messageServerID: job.serverid,
                                    messageAction: 'add',
                                    messageIntent: 'ExpandSearch'
                                }, global.mq_pixiv_in || 'inbox.pixiv')
                                if (req.body.batch) {
                                    _return = 200
                                } else {
                                    res.status(200).send(`Started Search, this make take some time.<br/>Results will be in the servers downloads folder.`);
                                }
                            } else {
                                    if (req.body.batch) {
                                        _return = 404
                                    } else {
                                        res.status(404).send(`Downloads channel was not found for this server!`);
                                    }
                                }
                        } else {
                            if (req.body.batch) {
                                _return = 400
                            } else {
                                res.status(400).send(`Not Authorised`);
                            }
                        }
                        break;
                    case 'twitterDownloadUser':
                        if (thisUser.master.discord && thisUser.master.discord.permissions.specialPermissions.indexOf('interact')) {
                            const downloadChannel = thisUser.master.discord.servers.download.filter(e => e.serverid === job.serverid);
                            if (downloadChannel.length > 0) {
                                printLine("ActionParser", `Requested Twitter to download user ${job.id}`, 'info', job)
                                sendRequest({
                                    fromClient: `return.Sequenzia.${config.system_name}`,
                                    messageReturn: false,
                                    userID: job.id,
                                    messageChannelID: downloadChannel[0].channelid,
                                    messageDestinationID: downloadChannel[0].channelid,
                                    messageAction: 'add',
                                    messageIntent: 'DownloadUser'
                                }, global.mq_twitter_in || 'inbox.twitter')
                                if (req.body.batch) {
                                    _return = 200
                                } else {
                                    res.status(200).send(`Started Download, this make take some time.<br/>Results will be in the servers downloads folder.`);
                                }
                            } else {
                                if (req.body.batch) {
                                    _return = 404
                                } else {
                                    res.status(404).send(`Downloads channel was not found for this server!`);
                                }
                            }
                        } else {
                            if (req.body.batch) {
                                _return = 400
                            } else {
                                res.status(400).send(`Not Authorised`);
                            }
                        }
                        break;
                    case 'twitterAction':
                        if (thisUser.master.discord && thisUser.master.discord.permissions.specialPermissions.indexOf('interact')) {
                            printLine("ActionParser", `Requested Pixiv to expand search for post ${job.id}`, 'info', job)
                            sendRequest({
                                fromClient: `return.Sequenzia.${config.system_name}`,
                                messageReturn: false,
                                userID: job.id,
                                messageChannelID: downloadChannel[0].channelid,
                                messageDestinationID: downloadChannel[0].channelid,
                                messageAction: job.remote_action,
                                messageIntent: job.remote_intent,
                                messageText: "" + body,
                                accountID: parseInt(job.remote_account.toString())
                            }, global.mq_twitter_in || 'inbox.twitter')
                            if (req.body.batch) {
                                _return = 200
                            } else {
                                res.status(200).send(`Action Reqested`);
                            }
                        } else {
                            if (req.body.batch) {
                                _return = 400
                            } else {
                                res.status(400).send(`Not Authorised`);
                            }
                        }
                        break;
                    default:
                        printLine("ActionParser", `Unknown Action : "${job.action}"`, 'error', job)
                        if (req.body.batch) {
                            _return = 400
                        } else {
                            res.status(400).send(`Invalid Request`);
                        }
                        break;
                }
                requestResults[job.messageid + ''] = _return
                return false;
            }))
            if (req.body.batch) {
                const failed = Object.values(requestResults).filter(e => e >= 400)
                res.status(202).json({
                    results: requestResults,
                    status: `Completed ${req.body.batch.length} Requests${(failed.length > 0) ? ', ' + failed.length + ' Actions Failed' : ''}`
                })
            }
        } else {
            printLine("ActionParser", `Insecure Session attempted to access API by ${thisUser.master.user.username}`, 'critical');
            res.status(401).send('Session was not authenticated securely! You CAN NOT use a Static Login Key or Blind Token to preform enhanced actions! Logout and Login with a externally verified login method.');
        }
    } catch (err) {
        printLine("ActionParser", `Caught Error in Action Parser : ${err.message}`, 'error', err)
        res.status(500).send(err.message);
    }
};
