let config = require('../host.config.json');

if (process.env.SYSTEM_NAME)
    config.system_name = process.env.SYSTEM_NAME
if (process.env.MQ_HOST)
    config.mq_host = process.env.MQ_HOST
if (process.env.RABBITMQ_DEFAULT_USER)
    config.mq_user = process.env.RABBITMQ_DEFAULT_USER
if (process.env.RABBITMQ_DEFAULT_PASS)
    config.mq_pass = process.env.RABBITMQ_DEFAULT_PASS

const amqp = require('amqplib/callback_api');
const { printLine } = require('./logSystem');
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
function whenConnected() {
    startPublisher();
}

module.exports = { sendData };
