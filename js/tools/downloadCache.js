const global = require('../../config.json');
let config = require('../../host.config.json');

if (process.env.MQ_HOST)
    config.mq_host = process.env.MQ_HOST
if (process.env.RABBITMQ_DEFAULT_USER)
    config.mq_user = process.env.RABBITMQ_DEFAULT_USER
if (process.env.RABBITMQ_DEFAULT_PASS)
    config.mq_pass = process.env.RABBITMQ_DEFAULT_PASS

const { sqlSimple, sqlSafe, sqlPromiseSafe } = require('../sqlClient');

const amqp = require('amqplib/callback_api');
let amqpConn = null;
let pubChannel = null;
const fs = require('fs');
const rimraf = require('rimraf');
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
}
