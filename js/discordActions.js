const global = require('../config.json')
const config = require('../host.config.json')
const { printLine } = require("./logSystem");
const { sendData } = require('./mqAccess');
const { sqlSafe } = require('../js/sqlClient');

module.exports = (req, res, next) => {
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
            switch (req.body.action) {
                case 'MovePost':
                    printLine("ActionParser", `Request to Move ${req.body.messageid} from ${req.body.channelid} to ${req.body.data}`, 'info', req.body)
                    sqlSafe(`SELECT * FROM kanmi_records
                         WHERE id = ?
                           AND channel = ?
                         LIMIT 1`, [req.body.messageid, req.body.channelid], (err, results) => {
                        if (err) {
                            printLine("ActionParser", `Unable to complete update from ${req.body.messageid}:${req.body.channelid} to ${req.body.data}: ${err.sqlMessage}`, 'error', err)
                            res.status(500).send('Database Error');
                        } else if (results.length > 0) {
                            sendRequest({
                                fromClient: `return.Sequenzia.${config.system_name}`,
                                messageReturn: false,
                                messageID: req.body.messageid,
                                messageChannelID: req.body.channelid,
                                messageServerID: req.body.serverid,
                                messageType: 'command',
                                messageAction: 'MovePost',
                                messageData: req.body.data
                            })
                            res.status(200).send(`Message Moved to ${req.body.data}`);
                        } else {
                            printLine("ActionParser", `No Results for ${req.body.messageid}:${req.body.channelid} to move`, 'error')
                            res.status(404).send('Message not found');
                        }
                    });
                    break;
                case 'RotatePost':
                    printLine("ActionParser", `Request to Rotate ${req.body.messageid}`, 'info', req.body)
                    sendRequest({
                        fromClient: `return.Sequenzia.${config.system_name}`,
                        messageReturn: false,
                        messageID: req.body.messageid,
                        messageChannelID: req.body.channelid,
                        messageServerID: req.body.serverid,
                        messageType: 'command',
                        messageAction: 'RotatePost',
                        messageData: req.body.data
                    })
                    res.status(200).send(`Requested to Rotate Image`);
                    break;
                case 'ArchivePost':
                    printLine("ActionParser", `Request to Archive ${req.body.messageid} from ${req.body.channelid}`, 'info', req.body)
                    sendRequest({
                        fromClient: `return.Sequenzia.${config.system_name}`,
                        messageReturn: false,
                        messageID: req.body.messageid,
                        messageChannelID: req.body.channelid,
                        messageServerID: req.body.serverid,
                        messageType: 'command',
                        messageAction: 'ArchivePost'
                    })
                    res.status(200).send(`Requested to Archive Message`);
                    break;
                case 'RemovePost':
                    printLine("ActionParser", `Request to Delete ${req.body.messageid} from ${req.body.channelid}`, 'info', req.body)
                    sendRequest({
                        fromClient: `return.Sequenzia.${config.system_name}`,
                        messageReturn: false,
                        messageID: req.body.messageid,
                        messageChannelID: req.body.channelid,
                        messageServerID: req.body.serverid,
                        messageType: 'command',
                        messageAction: 'RemovePost'
                    })
                    res.status(200).send(`Requested to Delete Message`);
                    break;
                case 'Thumbnail':
                    printLine("ActionParser", `Request to Generate Thumbnail ${req.body.messageid} from ${req.body.channelid}`, 'info', req.body)
                    sendRequest({
                        fromClient: `return.Sequenzia.${config.system_name}`,
                        messageReturn: false,
                        messageID: req.body.messageid,
                        messageChannelID: req.body.channelid,
                        messageServerID: req.body.serverid,
                        messageType: 'command',
                        messageAction: 'CacheImage'
                    })
                    res.status(200).send(`Requested to Cache Image`);
                    break;
                case 'RenamePost':
                    printLine("ActionParser", `Request to Rename File ${req.body.messageid} to "${req.body.data}"`, 'info', req.body)
                    sendRequest({
                        fromClient: `return.Sequenzia.${config.system_name}`,
                        messageReturn: false,
                        messageID: req.body.messageid,
                        messageChannelID: req.body.channelid,
                        messageData: req.body.data,
                        messageType: 'command',
                        messageAction: 'RenamePost'
                    })
                    res.status(200).send(`Requested to Rename Message`);
                    break;
                case 'RequestFile':
                    printLine("ActionParser", `Request to Download File ${req.body.messageid}:${req.body.channelid}"`, 'info', req.body)
                    sqlSafe(`SELECT *
                         FROM kanmi_records
                         WHERE id = ?
                           AND channel = ?
                         LIMIt 1`, [req.body.messageid, req.body.channelid], (err, foundMessages) => {
                        if (err) {
                            printLine("ActionParser", `Unable to request download for ${req.body.messageid}:${req.body.channelid} : ${err.sqlMessage}`, 'error', err)
                            res.status(500).send('Database Error');
                        } else if (foundMessages && foundMessages.length > 0) {
                            sendRequest({
                                fromClient: `return.Sequenzia.${config.system_name}`,
                                messageReturn: false,
                                messageID: foundMessages[0].id,
                                messageChannelID: foundMessages[0].channel,
                                itemFileUUID: foundMessages[0].fileid,
                                messageType: 'command',
                                messageAction: 'RequestDownload'
                            })
                            res.status(200).send(`Request Fetch, please wait...`);
                        } else {
                            printLine("ActionParser", `Unable to request download for ${req.body.messageid}:${req.body.channelid} : Not Found`, 'error');
                            res.status(404).send('Message not found');
                        }
                    })
                    break;
                case 'DownloadLink':
                    if (!(req.session.discord.servers.download && req.session.discord.servers.download.length > 0)) {
                        printLine("ActionParser", `Missing Static Configuration Value : Cannot "${req.body.action}", You dont have any servers that your allowed to download to`, 'error', req.body)
                    } else {
                        printLine("ActionParser", `Request to Download URL ${req.body.url}"`, 'info', req.body)
                        let url = req.body.url.substring(0, 1900);
                        if (req.body.url.includes("twitter.com") && req.body.url.includes('/photo')) {
                            url = url.split('/photo')[0];
                        }
                        let messageText = 'REQUEST ' +  url;
                        if (req.body.channelid) {
                            messageText += ` _DEST_ ${req.body.channelid}`
                        }

                        sendRequest({
                            fromClient: `return.Sequenzia.${config.system_name}`,
                            messageReturn: false,
                            messageType: 'stext',
                            messageChannelID: req.session.discord.servers.download.filter(e => e.serverid === req.body.serverid)[0].channelid,
                            messageText: messageText
                        })
                        res.status(200).send(`Requested Download`);
                    }
                    break;
                case 'textMessage':
                    printLine("ActionParser", `Send Text Message to ${req.body.channelid}`, 'info', req.body)
                    sendRequest({
                        fromClient: `return.Sequenzia.${config.system_name}`,
                        messageReturn: false,
                        messageType: 'stext',
                        messageChannelID: req.body.channelid,
                        messageUserID: req.session.discord.user.id,
                        messageText: req.body.text.substring(0, 1900)
                    })
                    res.status(200).send(`Text Message Sent`);
                    break;
                default:
                    printLine("ActionParser", `Unknown Action : "${req.body.action}"`, 'error', req.body)
                    res.status(400).send(`Invalid Request`);
                    break;
            }
        } else {
            printLine("ActionParser", `Insecure Session attempted to access API by ${req.session.user.username}`, 'critical');
            res.status(401).send('Session was not authenticated securely! You CAN NOT use a Static Login Key or Blind Token to preform enhanced actions! Logout and Login with a secure login meathod.');
        }
    } catch (err) {
        printLine("ActionParser", `Caught Error in Action Parser : ${err.message}`, 'error', err)
        res.status(500).send(err.message);
    }
};