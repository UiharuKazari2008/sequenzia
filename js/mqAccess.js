const config = require('../host.config.json');
const global = require('../config.json');
const amqp = require('amqplib/callback_api');
const { printLine } = require('./logSystem');
const { Cache9, Cache9dot1, Cache5, Cache3, CacheRemove, CacheColor, updateFileName } = require('./cacheMaster');
const { sqlSimple, sqlSafe } = require('../js/sqlClient');
const RateLimiter = require('limiter').RateLimiter;
const limiter1 = new RateLimiter(1, 1000);
const sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));
let amqpConn = null;
let pubChannel = null;

function start() {
    amqp.connect(`amqp://${config.mq_user}:${config.mq_pass}@${config.mq_host}/?heartbeat=60`, function(err, conn) {
        if (err) {
            printLine("KanmiMQ", "Initialization Error", "critical", err)
        }
        conn.on("error", function(err) {
            if (err.message !== "Connection closing") {
                printLine("KanmiMQ", "Initialization Connection Error", "emergency", err)
            }
        });
        conn.on("close", function() {
            printLine("KanmiMQ", "Attempting to Reconnect...", "debug")
            return setTimeout(start, 1000);
        });
        printLine("KanmiMQ", `Connected to Kanmi Exchange as ${config.system_name}!`, "info")
        amqpConn = conn;
        whenConnected();
    });
}
start();

function clone(obj) {
    if (null == obj || "object" != typeof obj) return obj;
    let copy = obj.constructor();
    for (let attr in obj) {
        if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
    }
    return copy;
}
function publish(exchange, routingKey, content, callback) {
    try {
        pubChannel.publish(exchange, routingKey, content, { persistent: true },
            function(err, ok) {
                if (err) {
                    printLine("KanmiMQ", "Failed to Publish Message", "critical", err)
                    pubChannel.connection.close();
                    callback(false)
                } else {
                    callback(true)
                }
            });
    } catch (e) {
        printLine("KanmiMQ", "Publish Error", "error", e)
        console.error(e);
        callback(false)
    }
}
function sendData(client, content, ok) {
    let exchange = "kanmi.exchange";
    let cleanObject = clone(content)
    if ( content.hasOwnProperty('itemFileData' ) ) {
        delete cleanObject.itemFileData
    }
    publish(exchange, client, new Buffer.from(JSON.stringify(content), 'utf-8'), function (callback) {
        if (callback) {
            ok(true);
            if (client !== config.mq_inbox) {
                printLine("KanmiMQ", `Sent message to ${client}`, "info", cleanObject)
            }
        } else {
            ok(false)
        }
    });
}
function closeOnErr(err) {
    if (!err) return false;
    printLine("KanmiMQ", "Connection Closed due to error", "error", err)
    amqpConn.close();
    return true;
}
function startPublisher() {
    amqpConn.createConfirmChannel(function(err, ch) {
        if (closeOnErr(err)) return;
        ch.on("error", function(err) {
            printLine("KanmiMQ", "Channel Error", "error", err)
        });
        ch.on("close", function() {
            printLine("KanmiMQ", "Channel Closed", "critical", {
                message: "null"
            })
        });
        pubChannel = ch;
    });
}
const accepted_cache_types = ['jpeg','jpg','jfif', 'png', 'webp', 'tiff']
function work(msg, cb) {
    const MessageContents = JSON.parse(Buffer.from(msg.content).toString('utf-8'));
    if (MessageContents.url && MessageContents.url.split('.').length > 0 && accepted_cache_types.indexOf(MessageContents.url.split('.').pop().toLowerCase()) !== -1) {
        sqlSafe(`SELECT * FROM kanmi_records WHERE id = ? LIMIT 1`, [MessageContents.id], (err, results) => {
            if (err) {
                printLine('SQL', `SQL Error when checking cache for message ${MessageContents.id} - ${err.sqlMessage}`, 'error', err)
                cb(true);
            } else if (results.length > 0) {
                limiter1.removeTokens(1, async function () {
                    switch(MessageContents.command) {
                        case 'cache9':
                            if (results[0].cache_proxy === null && global.enable_cds_proxy_request) {
                                if (MessageContents && MessageContents.id && !isNaN(parseInt(MessageContents.id.toString())) && MessageContents.url && MessageContents.url !== '') {
                                    sqlSafe(`UPDATE kanmi_records
                                             SET cache_proxy = 'inprogress'
                                             WHERE id = ?`, [MessageContents.id], async (err, results) => {
                                        if (err) {
                                            printLine('CacheMaster', `Failed to cache item for message ${MessageContents.id} - ${err.sqlMessage}`, 'error', err)
                                            cb(true);
                                        } else if (results.affectedRows && results.affectedRows > 0) {
                                            await Cache9(MessageContents, async function (result) {
                                                if (result) {
                                                    cb(true);
                                                } else {
                                                    cb(true);
                                                    sqlSimple(`UPDATE kanmi_records
                                                               SET cache_proxy = null
                                                               WHERE id = ?`, [MessageContents.id], async (err, results) => {
                                                    })
                                                }
                                            })
                                        } else {
                                            printLine('SQL', `Nothing to update for ${MessageContents.id}`, 'warning');
                                            cb(true);
                                        }
                                    })
                                } else {
                                    printLine('SQL', `Nothing to update for ${MessageContents.id}`, 'warning');
                                    cb(true);
                                }
                            } else {
                                cb(true);
                            }
                            break;
                        case 'cacheColor':
                            if (MessageContents && MessageContents.id && !isNaN(parseInt(MessageContents.id.toString())) && MessageContents.url && MessageContents.url !== '') {
                                await CacheColor(MessageContents, async function (result) {
                                    if (result) {
                                        cb(true);
                                    } else {
                                        cb(true);
                                    }
                                })
                            } else {
                                cb(true);
                            }
                            break;
                        case 'cache5':
                            if (results[0].cache_url === null && results[0].fileid === null && global.enable_cds_full_request) {
                                sqlSafe(`UPDATE kanmi_records SET cache_url = 'inprogress' WHERE id = ?`, [MessageContents.id], async (err, results) => {
                                    if (err) {
                                        printLine('CacheMaster', `Failed to cache item for message ${MessageContents.id} - ${err.sqlMessage}`, 'error', err)
                                        cb(true);
                                    } else if (results.affectedRows && results.affectedRows > 0) {
                                        await Cache5(MessageContents, async function (result) {
                                            if (result) {
                                                cb(true);
                                            } else {
                                                cb(true);
                                                sqlSimple(`UPDATE kanmi_records SET cache_url = null WHERE id = ?`, [MessageContents.id], async (err, results) => { })
                                            }
                                        })
                                    } else {
                                        printLine('SQL', `Nothing to update for ${MessageContents.id}`, 'warning');
                                        cb(true);
                                    }
                                })
                            } else {
                                cb(true);
                            }
                            break;
                        case 'remove':
                            if (results[0].cache_url !== null || results[0].cache_proxy !== null) {
                                await CacheRemove(MessageContents, async function (result) {
                                    if (result) {
                                        cb(true);
                                    } else {
                                        cb(true);
                                    }
                                })
                            } else {
                                cb(true);
                            }
                            break;
                        default:
                            printLine('Cache', `Unknown Command : ${MessageContents.command}`, 'error');
                            cb(true);
                            break;
                    }
                })
            } else {
                printLine('SQL', `No Results for ${MessageContents.id}`, 'warning');
                cb(true);
            }
        })
    } else if (MessageContents.url && MessageContents.url.split('.').length > 0) {
        sqlSafe(`SELECT * FROM kanmi_records WHERE id = ? LIMIT 1`, [MessageContents.id], (err, results) => {
            if (err) {
                printLine('SQL', `SQL Error when checking cache for message ${MessageContents.id} - ${err.sqlMessage}`, 'error', err)
                cb(true);
            } else if (results.length > 0) {
                limiter1.removeTokens(1, async function () {
                    switch(MessageContents.command) {
                        case 'cache5':
                        case 'cache3':
                            if (results[0].cache_url === null && results[0].fileid === null && global.enable_cds_full_request) {
                                if (MessageContents && MessageContents.id && !isNaN(parseInt(MessageContents.id.toString())) && MessageContents.url && MessageContents.url !== '') {
                                    sqlSafe(`UPDATE kanmi_records SET cache_url = 'inprogress' WHERE id = ?`, [MessageContents.id], async (err, results) => {
                                        if (err) {
                                            printLine('CacheMaster', `Failed to cache item for message ${MessageContents.id} - ${err.sqlMessage}`, 'error', err)
                                            cb(true);
                                        } else if (results.affectedRows && results.affectedRows > 0) {
                                            await Cache3(MessageContents, async function (result) {
                                                if (result) {
                                                    cb(true);
                                                } else {
                                                    cb(true);
                                                    sqlSafe('UPDATE kanmi_records SET cache_url = null WHERE id = ?', [MessageContents.id], (err, results) => { })
                                                }
                                            })
                                        } else {
                                            printLine('SQL', `Nothing to update for ${MessageContents.id}`, 'warning');
                                            cb(true);
                                        }
                                    })
                                } else { cb(true); }
                            } else { cb(true); }
                            break;
                        case 'remove':
                            if (results[0].cache_url !== null || results[0].cache_proxy !== null) {
                                await CacheRemove(MessageContents, async function (result) {
                                    if (result) {
                                        cb(true);
                                    } else {
                                        cb(true);
                                    }
                                })
                            } else {
                                cb(true);
                            }
                            break;
                        default:
                            printLine('Cache', `Unknown Command : ${MessageContents.command}`, 'error');
                            cb(true);
                            break;
                    }
                })
            } else {
                printLine('SQL', `No Results for ${MessageContents.id}`, 'warning');
                cb(true);
            }
        })
    } else if (MessageContents.filename && MessageContents.filename.split('.').length > 0) {
        sqlSafe(`SELECT * FROM kanmi_records WHERE id = ? LIMIT 1`, [MessageContents.id], (err, results) => {
            if (err) {
                printLine('SQL', `SQL Error when checking cache for message ${MessageContents.id} - ${err.sqlMessage}`, 'error', err)
                cb(true);
            } else if (results.length > 0) {
                limiter1.removeTokens(1, async function () {
                    switch(MessageContents.command) {
                        case 'update':
                            if (results.length > 0 && results[0].cache_url !== null) {
                                limiter1.removeTokens(1, async function() {
                                    if (MessageContents && MessageContents.id && !isNaN(parseInt(MessageContents.id.toString())) && MessageContents.filename && MessageContents.filename !== '') {
                                        await updateFileName(MessageContents, results[0].cache_url,async function (result) {
                                            if (result) {
                                                sqlSafe(`UPDATE kanmi_records SET cache_url = ? WHERE id = ?`, [result, MessageContents.id], (err, results) => {
                                                    if (err) {
                                                        printLine('CacheMaster', `Failed to cache item for message ${MessageContents.id} - ${err.sqlMessage}`, 'error', err)
                                                    } else if (results.affectedRows && results.affectedRows > 0) {
                                                        printLine('CacheMaster', `Updated file URL for ${MessageContents.id} - ${result}`, 'info')
                                                    } else {
                                                        printLine('SQL', `Nothing to update for ${MessageContents.id}`, 'warning');
                                                    }
                                                })
                                                cb(true);
                                            } else {
                                                cb(true);
                                                printLine('CacheMaster',`Failed to update filename on message ${MessageContents.id}`, 'error')
                                            }
                                        })
                                    } else { cb(true); }
                                });
                            } else { cb(true); }
                            break;
                        default:
                            printLine('Cache', `Unknown Command : ${MessageContents.command}`, 'error');
                            cb(true);
                            break;
                    }
                })
            } else {

            }
        })
    } else {
        console.error(`Bad Message`)
        console.error(MessageContents)
        cb(true);
    }
}
function startWorker() {
    amqpConn.createChannel(function(err, ch2) {
        if (closeOnErr(err)) return;
        ch2.on("error", function(err) {
            printLine("KanmiMQ", "Channel 1 Error (Standard)", "error", err)
            console.log(err)
        });
        ch2.on("close", function() {
            printLine("KanmiMQ", "Channel 1 Closed (Standard)", "critical" )
            start();
        });
        ch2.prefetch(10);
        ch2.assertQueue(config.mq_inbox, { durable: true }, function(err, _ok) {
            if (closeOnErr(err)) return;
            ch2.consume(config.mq_inbox, processMsg, { noAck: true });
            printLine("KanmiMQ", "Channel 1 Worker Ready (Standard)", "debug")
        });
        function processMsg(msg) {
            work(msg, function(ok) {
                try {
                    //if (ok)
                        //ch2.ack(msg);
                    //else
                        //ch2.reject(msg, true);
                } catch (e) {
                    closeOnErr(e);
                }
            });
        }
    });
}
function whenConnected() {
    startPublisher();
    sleep(1000).then(() => {
        printLine("Init", "Sequenzia Server MQ worker has started!", "info");
        if (global.enable_cds === true && (!process.env.ID || process.env.ID === "0" )) {
            printLine('Init', 'CDS Caching is enabled on this Sequenzia instance, now accepting requests', 'debug');
            startWorker();
        }
    })
}

module.exports = { sendData };
