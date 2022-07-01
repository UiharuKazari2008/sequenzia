let config = require('../host.config.json');
if (process.env.DATABASE_HOST)
    config.sql_host = process.env.DATABASE_HOST
if (process.env.DATABASE_NAME)
    config.sql_database = process.env.DATABASE_NAME
if (process.env.DATABASE_USERNAME)
    config.sql_user = process.env.DATABASE_USERNAME
if (process.env.DATABASE_PASSWORD)
    config.sql_pass = process.env.DATABASE_PASSWORD

const mysql = require('mysql2');
const { printLine } = require('./logSystem');
const sqlConnection = mysql.createPool({
    host: config.sql_host,
    user: config.sql_user,
    password: config.sql_pass,
    database: config.sql_database,
    charset : 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    debug: false
});

const sqlPromise = sqlConnection.promise();

function sqlSimple(sql_q, callback, nolog) {
    if (!nolog && config.log_sql_console)
        console.log(sql_q)
    sqlConnection.query(sql_q, function (err, rows) {
        if (err) { printLine("SQL", err.sqlMessage, "error", err); console.error(sql_q);}
        callback(err, rows);
    });
}
function sqlSafe(sql_q, inputs, callback, nolog) {
    if (!nolog && config.log_sql_console)
        console.log(mysql.format(sql_q, inputs))
    sqlConnection.query(mysql.format(sql_q, inputs), function (err, rows) {
        if (err) { printLine("SQL", err.sqlMessage, "error", err); console.error(sql_q); console.error(inputs); }
        callback(err, rows);
    });
}
async function sqlPromiseSimple(sql_q, nolog) {
    if (!nolog && config.log_sql_console)
        console.log(sql_q)
    try {
        const [rows,fields] = await sqlPromise.query(sql_q);
        return {
            rows, fields, sql_q
        }
    } catch (err) {
        printLine("SQL", err.message, "error", err);
        console.error(sql_q);
        console.error(err);
        return {
            rows: [], fields: [], sql_q, error: err
        }
    }
}
async function sqlPromiseSafe(sql_q, inputs, nolog) {
    if (!nolog && config.log_sql_console)
        console.log(mysql.format(sql_q, inputs))
    try {
        const [rows,fields] = await sqlPromise.query(sql_q, inputs);
        return {
            rows, fields, sql_q, inputs
        }
    } catch (err) {
        printLine("SQL", err.message, "error", err);
        console.error(sql_q);
        console.error(inputs);
        console.error(err);
        return {
            rows: [], fields: [], sql_q, inputs, error: err
        }
    }
}

process.on('uncaughtException', function(err) {
    printLine("uncaughtException", err.sqlMessage, "critical", err);
    process.exit(1)
});

module.exports = { sqlSimple, sqlSafe, sqlPromiseSimple, sqlPromiseSafe };
