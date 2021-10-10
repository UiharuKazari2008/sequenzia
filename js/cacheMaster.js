const global = require('../config.json');
const webconfg = require('../web.config.json');
const { sqlSafe } = require('../js/sqlClient');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');
const { printLine } = require("./logSystem");
const { getAverageColor } = require('fast-average-color-node');


function cleanCache() {
    [
        {
            dir: `${global.tmp_folder}`,
            days: 1,
            type: 2,
            time: 0
        },
        {
            dir: `${global.fw_serve}`,
            days: (global.fw_max_life) ? global.fw_max_life : 30,
            type: 0,
            time: 1
        }
    ].forEach(async function(type) {
        fs.readdir(type.dir, function(err, files) {
            if (files && files.length > 0) {
                files.filter(e => !(type.type === 0 && !e.startsWith('.'))).forEach(function(file, index) {
                    const filename = path.join(type.dir, file)
                    fs.stat(filename, function(err, stat) {
                        if (err) {
                            printLine('cleanCache', `Fail to read ${type.dir} directory for some reason - ${err.message}`, 'error');
                        } else {
                            const now = new Date().getTime();
                            let endTime = undefined
                            if ( type.time === 0) {
                                endTime = new Date(stat.ctime).getTime() + ( type.days * 86400000);
                            } else if (type.time === 1) {
                                endTime = new Date(stat.atime).getTime() + ( type.days * 86400000);
                            }
                            if (now > endTime) {
                                rimraf(filename, function(err) {
                                    if (err) {
                                        printLine('cleanCache', `Fail to delete file from ${type.dir} directory - ${err.message}`, 'error');
                                    } else {
                                        if (type.type === 0) {
                                            sqlSafe(`UPDATE kanmi_records SET filecached = 0 WHERE fileid = ?`, [`${file.substring(1)}`], (err, results) => {
                                                if (err) {
                                                    printLine('SQL', `Fail to clear file ${file} - ${err.message}`, 'error');
                                                } else if (results.affectedRows && results.affectedRows > 0) {
                                                    printLine('cleanCache', `Successfully deleted file ${file}`, 'info');
                                                }
                                            })
                                        }
                                    }
                                });
                            }
                        }
                    });

                });
            } else {
                printLine('cleanCache', `No files in ${type.dir} directory to check`, 'debug');
            }
        });
    })
}

if (global.enable_cds && (!process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === "0")) {
    cleanCache();
    setInterval(cleanCache, 3600000);
    //setInterval(validateFiles, 43200000);
}
async function buffer (url, cb) {
    const response = await fetch(url)
    if (!response.ok) {
        cb(false);
    } else {
        const file = await response.buffer()
        cb(file);
    }
}
async function CacheColor(message, cb) {
    if (message && message.id && !isNaN(parseInt(message.id.toString())) && message.url && message.url !== ''  && (message.url.split('.').pop().toLowerCase().includes('png') || message.url.split('.').pop().toLowerCase().includes('jpeg') || message.url.split('.').pop().toLowerCase().includes('jfif') || message.url.split('.').pop().toLowerCase().includes('jpg') || message.url.split('.').pop().toLowerCase().includes('gif'))) {
        if (message.extra && message.extra === true && message.extraData && message.extraData.length > 0) {
            cb(true);
        } else {
            await buffer(message.url, async function (data) {
                if (data) {
                    try {
                        await getAverageColor(data, {mode: 'precision'})
                            .then(async _color => {
                                sqlSafe(`UPDATE kanmi_records SET colorR = ?, colorG = ?, colorB = ?, dark_color = ? WHERE id = ?`, [_color.value[0], _color.value[1], _color.value[2], (_color.isDark) ? '1' : '0', message.id.toString()], (err, results) => {
                                    if (err) {
                                        printLine('SQL', `Failed to save color for ${message.id}`, 'error');
                                        cb(false);
                                    } else if (results.affectedRows && results.affectedRows > 0) {
                                        printLine('CacheColor', `Successfully Registered Average Color for ${message.id} to rgb(${_color.value[0]}, ${_color.value[1]}, ${_color.value[2]})`, 'debug');
                                        cb(true);
                                    }
                                })
                            })
                    } catch (e) {
                        console.error(e)
                        cb(true);
                    }
                } else {
                    cb(true);
                }
            })
        }
    } else {
        cb(true);
    }
}
async function CacheRemove(message, cb) {
    if (message && message.id && !isNaN(parseInt(message.id.toString())) && message.url && message.url !== '') {
        if (message.extra && message.extra === true && message.extraData && message.extraData.length > 0) {
            cb(true);
        } else {
            const filename = message.url.split(`${webconfg.cdn_url}`).pop();
            rimraf(`${global.cache_serve}${filename}`, error => {
                if (error) {
                    printLine('Cache', `Failed to delete cache for ${message.id} - "${global.cache_serve}${filename}"`, 'error');
                    cb(true);
                } else {
                    printLine('Cache', `Successfully deleted cache for ${message.id} - "${global.cache_serve}${filename}"`, 'debug');
                    cb(true);
                }
            })
        }
    } else {
        cb(true);
    }
}
async function updateFileName(message, ogfn, cb) {
    const orginalFilename = ogfn.split('/').pop();
    const url = `${webconfg.cds_url}${message.filename.split(' ').join('_')}`;
    fs.rename(`${global.fw_serve}${orginalFilename}`, `${global.fw_serve}${message.filename.split(' ').join('_')}`, (err) => {
        if (!err) {
            cb(url);
        } else {
            cb(false);
        }
    })
}

module.exports = { CacheRemove, CacheColor, updateFileName };
