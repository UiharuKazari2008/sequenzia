const global = require('../config.json')
let config = require('../host.config.json')

if (process.env.SYSTEM_NAME && process.env.SYSTEM_NAME.trim().length > 0)
    config.system_name = process.env.SYSTEM_NAME.trim()

const { printLine } = require("./logSystem");
const { sendData } = require('./mqAccess');
const { sqlPromiseSafe } = require('../js/sqlClient');

module.exports = async (req, res, next) => {
    function sendRequest(MessageBody) {
        sendData(global.mq_discord_out, MessageBody, function (callback) {
            if (callback) {
                printLine("KanmiMQ", `Sent to ${global.mq_discord_out + '.priority'}`, 'info', MessageBody)
            } else {
                printLine("KanmiMQ", `Failed to send to ${global.mq_discord_out + '.priority'}`, 'error', MessageBody)
            }
        })
    }
    try {
        if (req.session.user && (req.session.user.source < 900 || (req.headers && req.headers['x-bypass-warning'] && req.headers['x-bypass-warning'] === 'appIntent'))) {
            let requestResults = {}
            await (((req.body.batch) ? [...req.body.batch] : [{...req.body}]).map(async (job, index, array) => {
                let _return = 500;
                switch (job.action) {
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
                        sendRequest({
                            fromClient: `return.Sequenzia.${config.system_name}`,
                            messageReturn: false,
                            messageID: job.messageid,
                            messageChannelID: job.channelid,
                            messageServerID: job.serverid,
                            messageType: 'command',
                            messageAction: 'RemovePost'
                        })
                        if (req.body.batch) {
                            _return = 200
                        } else {
                            res.status(200).send(`Requested to Delete Message`);
                        }
                        break;
                    case 'Thumbnail':
                        printLine("ActionParser", `Request to Generate Thumbnail ${job.messageid} from ${job.channelid}`, 'info', job)
                        sendRequest({
                            fromClient: `return.Sequenzia.${config.system_name}`,
                            messageReturn: false,
                            messageID: job.messageid,
                            messageChannelID: job.channelid,
                            messageServerID: job.serverid,
                            messageType: 'command',
                            messageAction: 'CacheImage'
                        })
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
                    case 'RequestFile':
                        printLine("ActionParser", `Request to Download File ${job.messageid}:${job.channelid}"`, 'info', job)
                        if (global.mq_fileworker_cds) {
                            const foundMessages = await sqlPromiseSafe(`SELECT * FROM kanmi_records WHERE id = ? AND channel = ? LIMIt 1`, [job.messageid, job.channelid])
                            if (foundMessages.rows && foundMessages.rows.length > 0) {
                                sendData(global.mq_fileworker_cds, {
                                    fromClient: `return.Sequenzia.${config.system_name}`,
                                    fileUUID: foundMessages[0].fileid,
                                    messageType: 'command',
                                    messageAction: 'CacheSpannedFile'
                                }, function (callback) {
                                    if (callback) {
                                        printLine("KanmiMQ", `Sent to ${global.mq_fileworker_cds}`, 'info')
                                    } else {
                                        printLine("KanmiMQ", `Failed to send to ${global.mq_fileworker_cds}`, 'error')
                                    }
                                })
                                if (req.body.batch) {
                                    _return = 200
                                } else {
                                    res.status(200).send(`Request Fetch, please wait...`)
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
                                res.status(500).send(`Server is not configured for CDS based file building`);
                            }
                        }
                        break;
                    case 'DownloadLink':
                        if (!(req.session.discord.servers.download && req.session.discord.servers.download.length > 0)) {
                            printLine("ActionParser", `Missing Static Configuration Value : Cannot "${job.action}", You dont have any servers that your allowed to download to`, 'error', job);
                            if (req.body.batch) {
                                _return = 500
                            } else {
                                res.status(500).send(`Missing Static Configuration Value : Cannot "${job.action}", You dont have any servers that your allowed to download to`);
                            }
                        } else {
                            printLine("ActionParser", `Request to Download URL ${job.url}"`, 'info', job)
                            let url = job.url.substring(0, 1900);
                            if (job.url.includes("twitter.com") && job.url.includes('/photo')) {
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
                                messageChannelID: req.session.discord.servers.download.filter(e => e.serverid === job.serverid)[0].channelid,
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
                            messageUserID: req.session.discord.user.id,
                            messageText: job.text.substring(0, 1900)
                        })
                        if (req.body.batch) {
                            _return = 200
                        } else {
                            res.status(200).send(`Text Message Sent`);
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
            printLine("ActionParser", `Insecure Session attempted to access API by ${req.session.user.username}`, 'critical');
            res.status(401).send('Session was not authenticated securely! You CAN NOT use a Static Login Key or Blind Token to preform enhanced actions! Logout and Login with a externally verified login method.');
        }
    } catch (err) {
        printLine("ActionParser", `Caught Error in Action Parser : ${err.message}`, 'error', err)
        res.status(500).send(err.message);
    }
};
