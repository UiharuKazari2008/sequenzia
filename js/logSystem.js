const config = require('../host.config.json')
const graylog2 = require("graylog2");
const colors = require('colors');
const {hostname} = require("os");
const sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));

let logger1 = undefined
let logger2 = undefined
let remoteLogging1 = false
let remoteLogging2 = false

if (config.log_host && config.log_host.length > 0) {
    if (config.log_host.length >= 1) {
        remoteLogging1 = true
        logger1 = new graylog2.graylog({
            servers: [config.log_host[0]],
            hostname: hostname(), // the name of this host
            facility: 'Sequenzia-Server',     // the facility for these log messages
            bufferSize: 1350         // max UDP packet size, should never exceed the
                                     // MTU of your system (optional, default: 1400)
        });
        logger1.on('error', (error) => { console.error('Error while trying to write to graylog host 1:'.red, error) });

        logger1.debug(`Init : Forwarding logs to Graylog Server 1`, { process: 'Init' });
        console.log(`[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}][Init] Forwarding logs to Graylog Server 1 - Sequenzia`.gray);
    }
    if (config.log_host.length >= 2) {
        remoteLogging2 = true
        logger2 = new graylog2.graylog({
            servers: [config.log_host[1]],
            hostname: hostname(), // the name of this host
            facility: 'Sequenzia-Server',     // the facility for these log messages
            bufferSize: 1350         // max UDP packet size, should never exceed the
                                     // MTU of your system (optional, default: 1400)
        });
        logger2.on('error', (error) => { console.error('Error while trying to write to graylog host 2:'.red, error) });

        logger2.debug(`Init : Forwarding logs to Graylog Server 2`, { process: 'Init' });
        console.log(`[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}][Init] Forwarding logs to Graylog Server 2 - Sequenzia`.gray);
    }
}

async function printLine(proccess, text, level, object, object2) {
    let logObject = {}
    let logClient = "Unknown"
    if (proccess) {
        logClient = proccess
    }
    logObject.process = logClient
    let logString =  `${logClient} : ${text}`
    //console.log(typeof object)
    //console.log(typeof object2)
    if (typeof object !== 'undefined' || object) {
        if ( (typeof (object) === 'string' || typeof (object) === 'number' || object instanceof String) ) {
            logString += ` : ${object}`
        } else if (typeof(object) === 'object') {
            logObject = Object.assign({}, logObject, object)
            if (object.hasOwnProperty('message')) {
                logString += ` : ${object.message}`
            } else if (object.hasOwnProperty('sqlMessage')) {
                logString += ` : ${object.sqlMessage}`
            } else if (object.hasOwnProperty('itemFileData')) {
                delete logObject.itemFileData
                logObject.itemFileData = object.itemFileData.length
            }
        }
    }
    if (typeof object2 !== 'undefined' || object2) {
        if (typeof(object2) === 'string' || typeof(object2) === 'number' || object2 instanceof String) {
            logObject.extraMessage = object2.toString()
        } else if (typeof(object2) === 'object') {
            logObject = Object.assign({}, logObject, object2)
            if (object2.hasOwnProperty('itemFileData')) {
                delete logObject.itemFileData
                logObject.itemFileData = object2.itemFileData.length
            }
        }
    }
    if (level === "warn") {
        if (remoteLogging1) { logger1.warning(logString, logObject) } else { console.error(logObject) }
        if (remoteLogging2) { logger2.warning(logString, logObject) }
        console.log(`[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}][${proccess}] ${text}`.black.bgYellow)
    } else if (level === "error") {
        if (remoteLogging1) { logger1.error(logString, logObject) } else { console.error(logObject) }
        if (remoteLogging2) { logger2.error(logString, logObject) }
        console.log(`[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}][${proccess}] ${text}`.black.bgRed)
    } else if (level === "critical") {
        if (remoteLogging1) { logger1.critical(logString, logObject) } else { console.error(logObject) }
        if (remoteLogging2) { logger2.critical(logString, logObject) }
        console.log(`[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}][${proccess}] ${text}`.bgMagenta)
    } else if (level === "alert") {
        if (remoteLogging1) { logger1.alert(logString, logObject) } else { console.log(logObject) }
        if (remoteLogging2) { logger2.alert(logString, logObject) }
        console.log(`[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}][${proccess}] ${text}`.red)
    } else if (level === "emergency") {
        if (remoteLogging1) { logger1.emergency(logString, logObject) } else { console.error(logObject) }
        if (remoteLogging2) { logger2.emergency(logString, logObject) }
        console.log(`[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}][${proccess}] ${text}`.bgMagenta)
        sleep(250).then(() => {
            process.exit(4);
        })
    } else if (level === "notice") {
        if (remoteLogging1) { logger1.notice(logString, logObject) } else { console.log(logObject) }
        if (remoteLogging2) { logger2.notice(logString, logObject) }
        console.log(`[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}][${proccess}] ${text}`.green)
    } else if (level === "alert") {
        if (remoteLogging1) { logger1.alert(logString, logObject) } else { console.log(logObject) }
        if (remoteLogging2) { logger2.alert(logString, logObject) }
        console.log(`[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}][${proccess}] ${text}`.green)
    } else if (level === "debug") {
        if (remoteLogging1) { logger1.debug(logString, logObject) } else { console.log(logObject) }
        if (remoteLogging2) { logger2.debug(logString, logObject) }
        console.log(`[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}][${proccess}] ${text}`.gray)
    } else if (level === "info") {
        if (remoteLogging1) { logger1.info(logString, logObject) } else { console.log(logObject) }
        if (remoteLogging2) { logger2.info(logString, logObject) }
        if (text.includes("Sent message to ") || text.includes("Connected to Kanmi Exchange as ")) {
            console.log(`[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}][${proccess}] ${text}`.gray)
        } else {
            console.log(`[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}][${proccess}] ${text}`.blue)
        }
    } else {
        if (remoteLogging1) { logger1.error(logString, logObject) } else { console.log(logObject) }
        if (remoteLogging2) { logger2.error(logString, logObject) }
        console.log(`[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}][${proccess}] ${text}`)
    }
}

process.on('uncaughtException', function(err) {
    printLine("uncaughtException", err.message, "critical", err)
    console.log(err)
});

module.exports = { printLine };
