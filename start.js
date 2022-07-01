const config = require("./host.config.json");
(async () => {
    const app = require('./app');
    const config = require('./config.json');
    let host = require('./host.config.json');

    if (process.env.SYSTEM_NAME && process.env.SYSTEM_NAME.trim().length > 0)
        host.system_name = process.env.SYSTEM_NAME.trim()

    const request = require("request");
    const fs = require("fs");
    const { printLine } = require('./js/logSystem');
    const {sqlPromiseSafe} = require("./js/sqlClient");
    const path = require("path");
    const rimraf = require("rimraf");

    if (!fs.existsSync(config.tmp_folder)) { fs.mkdirSync(config.tmp_folder); }
    if (config.upload_folder && !fs.existsSync(config.upload_folder)) { fs.mkdirSync(config.upload_folder); }

    if (host.watchdog_host && host.watchdog_id) {
        setInterval(() => {
            request.get(`http://${host.watchdog_host}/watchdog/ping?id=${host.watchdog_id}&entity=Sequenzia-${host.system_name}${(process.env.NODE_APP_INSTANCE) ? '-' + process.env.NODE_APP_INSTANCE : ''}`, async (err, res) => {
                if (err || res && res.statusCode !== undefined && res.statusCode !== 200) {
                    console.error(`Failed to ping watchdog server ${host.watchdog_host} as Sequenzia:${host.watchdog_id}${(process.env.NODE_APP_INSTANCE) ? ':' + process.env.NODE_APP_INSTANCE : ''}`);
                }
            })
        }, 60000);
        request.get(`http://${host.watchdog_host}/watchdog/init?id=${host.watchdog_id}&entity=Sequenzia-${host.system_name}${(process.env.NODE_APP_INSTANCE) ? '-' + process.env.NODE_APP_INSTANCE : ''}`, async (err, res) => {
            if (err || res && res.statusCode !== undefined && res.statusCode !== 200) {
                console.error(`Failed to init watchdog server ${host.watchdog_host} as Sequenzia:${host.watchdog_id}${(process.env.NODE_APP_INSTANCE) ? ':' + process.env.NODE_APP_INSTANCE : ''}`);
            }
        })
    }

    if (!process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE == 0) {
        // Bootup Maintenance
        if (config.enable_maintenance) {
            await sqlPromiseSafe(`DELETE s1 FROM sequenzia_display_history s1, sequenzia_display_history s2 WHERE s1.date < s2.date AND s1.eid = s2.eid AND s1.name = s2.name AND s1.user = s2.user`);
            await sqlPromiseSafe(`DELETE s1 FROM sequenzia_favorites s1, sequenzia_favorites s2 WHERE s1.date < s2.date AND s1.eid = s2.eid AND s1.userid = s2.userid`);
        }
        // Clean out old files
        async function cleanCache() {
            if ((config.fw_serve || config.spanned_cache) && config.spanned_cache_max_age) {
                const directory = ((config.fw_serve) ? config.fw_serve : config.spanned_cache)
                await Promise.all(fs.readdirSync(directory)
                    .filter(e => e.startsWith('.'))
                    .map(async (e) => {
                        const fileData = (await sqlPromiseSafe(`SELECT eid, real_filename FROM kanmi_records WHERE fileid = ?`, [e.substring(1)], true)).rows
                        if ((new Date().getTime()) > ((new Date((fs.statSync(path.join(directory, e))).atime).getTime()) + (config.spanned_cache_max_age * 86400000)) || fs.statSync(path.join(directory, e)).size < 10 ) {
                            rimraf(path.join(directory, e), error => {})
                            if (fileData.length > 0) {
                                rimraf(path.join(directory, `${fileData[0].eid}-${fileData[0].real_filename}`), error => {
                                })
                                await sqlPromiseSafe(`UPDATE kanmi_records SET filecached = 0 WHERE fileid = ?`, [e.substring(1)])
                            }
                            printLine('cleanCache', `Successfully deleted file ${e.substring(1)}`, 'info');
                        }
                    }))
            }
            if (config.upload_folder) {
                fs.readdirSync(config.upload_folder)
                    .filter(e => ((new Date().getTime()) > ((new Date((fs.statSync(path.join(config.upload_folder, e))).mtime).getTime()) + 86400000)))
                    .map(async (e) => {
                        rimraf(path.join(config.upload_folder, e), (error) => {
                        })
                    });
            }
            fs.readdirSync(config.tmp_folder)
                .filter(e => ((new Date().getTime()) > ((new Date((fs.statSync(path.join(config.tmp_folder, e))).mtime).getTime()) + 86400000)) )
                .map(async (e) => {
                    rimraf(path.join(config.tmp_folder, e), (error) => {})
                });
            setTimeout(cleanCache, 3600000)
        }
        await cleanCache();
    }

    const server = app.listen((process.env.NODE_APP_INSTANCE) ? parseInt(process.env.NODE_APP_INSTANCE.toString()) + parseInt(config.http_port.toString()) : config.http_port, (newServer) => {
        printLine('ExpressInit', `Web server is running on port ${server.address().port}`, 'debug');
        if (process.hasOwnProperty("send"))
            process.send('ready');
    });
})()
