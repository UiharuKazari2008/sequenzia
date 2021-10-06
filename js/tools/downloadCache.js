const global = require('../../config.json');
const config = require('../../host.config.json');
const { sqlSimple, sqlSafe, sqlPromiseSafe } = require('../sqlClient');

const amqp = require('amqplib/callback_api');
let amqpConn = null;
let pubChannel = null;
const fs = require('fs');
const rimraf = require('rimraf');
const {asyncForEach} = require("../../utils");
const accepted_cache_types = ['jpeg','jpg','jfif', 'png', 'webp', 'tiff']

amqp.connect(`amqp://${config.mq_user}:${config.mq_pass}@${config.mq_host}/?heartbeat=60`, function(err, conn) {
    if (err) {
        printLine("KanmiMQ", "Initialization Error", "critical", err)
    }
    conn.on("error", function(err) {
        if (err.message !== "Connection closing") {
            console.error('Error initialising!')
            console.error(err)
        }
    });
    conn.on("close", function() {
        console.warn("Attempting to reconnect...");
        //return setTimeout(start, 1000);
    });
    console.log('Ready')
    amqpConn = conn;
    whenConnected();
});

function publish(exchange, routingKey, content, callback) {
    try {
        pubChannel.publish(exchange, routingKey, content, { persistent: true },
            function(err, ok) {
                if (err) {
                    console.error(err)
                    pubChannel.connection.close();
                    callback(false)
                } else {
                    callback(true)
                }
            });
    } catch (e) {
        console.error(e);
        callback(false)
    }
}
function sendData(client, content, ok) {
    let exchange = "kanmi.exchange";
    publish(exchange, client, new Buffer.from(JSON.stringify(content), 'utf-8'), function (callback) {
        if (callback) {
            ok(true);
        } else {
            ok(false)
        }
    });
}
function closeOnErr(err) {
    if (!err) return false;
    console.error(err);
    amqpConn.close();
    return true;
}
function startPublisher() {
    amqpConn.createConfirmChannel(function(err, ch) {
        if (closeOnErr(err)) return;
        ch.on("error", function(err) {
            console.error(err);
        });
        ch.on("close", function() {
            console.error('Channel closed');
        });
        pubChannel = ch;
        //readyToDesuCache();
    });
}
async function whenConnected() {
    startPublisher();
    //setInterval(readyToDesuCache, 1200000)

    const completedSQL = await sqlPromiseSafe(`SELECT kanmi_records.id, kanmi_records.eid, sequenzia_display_history.user FROM kanmi_records, sequenzia_display_history WHERE sequenzia_display_history.eid = kanmi_records.id`)
    console.log(completedSQL.rows)
    await asyncForEach(completedSQL.rows, (async row => {
        await sqlPromiseSafe(`UPDATE sequenzia_display_history SET eid = ? WHERE user = ? AND eid = ?`, [row.eid, row.user, row.id]);
    }))

}

function readyToPublish() {
    let fileTypes = [];
    accepted_cache_types.forEach(function(type) {
        fileTypes.push(`attachment_name LIKE '%${type}%'`);
    })
    sqlSimple(`SELECT * FROM kanmi_records WHERE ((attachment_url IS NOT NULL AND cache_url IS NULL AND fileid IS NULL AND (${fileTypes.join(' OR ')})) OR (attachment_proxy IS NOT NULL AND cache_proxy IS NULL AND (${fileTypes.join(' OR ')}))) LIMIT 1000`, (err, files) => {
        if (err) {
            console.error( err )
        } else if (files && files.length > 0) {
            console.log(`Sending Request to Cache ${files.length} files`)
            files.forEach(function (file) {
                if (file.cache_url === null && file.fileid === null && file.attachment_url !== null) {
                    sendData(config.mq_inbox, {
                        id: file.id,
                        url: file.attachment_url,
                        extra: false,
                        command: 'cache5'
                    }, function (ok) { })
                }
                if (file.cache_proxy === null && file.attachment_proxy !== null) {
                    sendData(config.mq_inbox, {
                        id: file.id,
                        url: file.attachment_proxy,
                        extra: false,
                        command: 'cache9'
                    }, function (ok) { })
                }
            })
        }
    })
    sqlSimple(`SELECT * FROM kanmi_records WHERE (attachment_proxy IS NULL AND (${fileTypes.join(' OR ')}) AND (colorR IS NULL OR colorB IS NULL OR colorG IS NULL)) ORDER BY id DESC LIMIT 1000`, (err, files) => {
        if (err) {
            console.error( err );
        } else if (files && files.length > 0) {
            console.log(`Sending Request to Color ${files.length} files`)
            files.forEach(function (file) {
                sendData(config.mq_inbox, {
                    id: file.id,
                    url: file.attachment_proxy,
                    extra: false,
                    command: 'cacheColor'
                }, function (ok) { })
            })
        }
    })
}

function readyToDesuCache() {
    let fileTypes = [];
    accepted_cache_types.forEach(function(type) {
        fileTypes.push(`cache_proxy LIKE '%${type}%'`);
    })
    sqlSimple(`SELECT * FROM kanmi_records WHERE (cache_proxy IS NOT NULL AND cache_proxy LIKE '%seq.moe%' AND (${fileTypes.join(' OR ')})) ORDER BY id DESC LIMIT 50000`, (err, files) => {
        if (err) {
            console.error( err )
        } else if (files && files.length > 0) {
            console.log(`Sending ${files.length} cache files to Discord..`)
            let requests = files.reduce((promiseChain, file, i, a) => {
                const alength = a.length
                return promiseChain.then(() => new Promise(async(resolve) => {
                    let bufferData
                    try {
                        bufferData = fs.readFileSync(`${global.cache_serve}t9/${file.cache_proxy.split('/').pop()}`, {encoding: 'base64'});
                    } catch (err) {
                        console.error(`Failed to read cache file ${file.id} : ${global.cache_serve}t9/${file.cache_proxy.split('/').pop()}, Could already be in update MQ?`);
                        /*sqlSafe(`UPDATE kanmi_records SET cache_proxy = NULL WHERE id = ?`, [file.id], (err, completed) => {
                            if (err) {
                                console.err(`Failed to remove dead cache for ${file.id}`)
                            }
                        })*/
                        resolve();
                    }
                    if (bufferData) {
                        sendData(global.mq_discord_out + '.backlog', {
                            messageReturn: false,
                            fromClient : `return.Sequenzia.Polyfills.${config.system_name}`,
                            messageType: "sfile",
                            messageChannelID: '847335603543998474',
                            messageOriginalID: `${file.id}`,
                            messageText: '',
                            itemFileName: `${file.attachment_url.split('/').pop().split('.')[0]}-t9-preview.jpg`,
                            itemFileData: '' + bufferData,
                            itemFilePreview: false
                        }, function (ok) {
                            console.log(`(${i + 1}/${alength}) Sent cache file ${global.cache_serve}t9/${file.cache_proxy.split('/').pop()} successfully!`);
                            /*rimraf(`${global.cache_serve}t9/${file.cache_proxy.split('/').pop()}`, function(err) {
                                if (err) {
                                    console.error(`Failed to delete cache file ${global.cache_serve}t9/${file.cache_proxy.split('/').pop()}`);
                                }
                            });*/
                            resolve();
                        });
                    } else {
                        console.error(`Failed to read cache file ${global.cache_serve}t9/${file.cache_proxy.split('/').pop()}`);
                        resolve();
                    }
                    bufferData = null;
                }))
            }, Promise.resolve());
            requests.then(() => {
                console.log(`Completed cache upload for ${files.length}!`);
                files = null;
                //readyToDesuCache();
            });
        }
    });
}
