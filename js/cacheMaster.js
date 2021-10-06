const global = require('../config.json');
const webconfg = require('../web.config.json');
const { sqlSimple, sqlSafe } = require('../js/sqlClient');
const fetch = require('node-fetch');
const sizeOf = require('image-size');
const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');
const util = require('util');
const crypto = require('crypto');
const sharp = require('sharp');
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
            dir: `${global.cache_serve}t9`,
            days: (global.cache_preview_max_life) ? global.cache_preview_max_life : 180,
            type: 1,
            time: 1
        },
        {
            dir: `${global.cache_serve}t5`,
            days: (global.cache_full_max_life) ? global.cache_full_max_life : 180,
            type: 1,
            time: 1
        },
        {
            dir: `${global.cache_serve}t3`,
            days: (global.cache_full_max_life) ? global.cache_full_max_life : 180,
            type: 1,
            time: 1
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
                files.forEach(function(file, index) {
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
                                        if (type.type < 2) {
                                            if (type.type === 0) {
                                                sqlSafe(`UPDATE kanmi_records SET cache_url = null WHERE cache_url = ?`, [`${webconfg.cds_url}${file}`], (err, results) => {
                                                    if (err) {
                                                        printLine('SQL', `Fail to clear file ${file} - ${err.message}`, 'error');
                                                    } else if (results.affectedRows && results.affectedRows > 0) {
                                                        printLine('cleanCache', `Successfully deleted file ${file}`, 'info');
                                                    }
                                                })
                                            } else if (type.type === 1) {
                                                sqlSafe(`UPDATE kanmi_records SET cache_proxy = null WHERE cache_proxy = ?`, [`${webconfg.cdn_url}t9${file}`], (err, results) => {
                                                    if (err) {
                                                        printLine('SQL', `Fail to clear file ${file} - ${err.message}`, 'error');
                                                    } else if (results.affectedRows && results.affectedRows > 0) {
                                                        printLine('cleanCache', `Successfully deleted file ${file}`, 'info');
                                                    }
                                                })
                                            }
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
async function validateCache() {
    sqlSimple(`SELECT * FROM kanmi_records WHERE ( cache_url LIKE '%t3%' OR cache_url LIKE '%t5%' OR cache_proxy LIKE '%PROXY-%' )`, async (err, files) => {
        if (err) {
            printLine('SQL', `Failed to fetch for dead files - ${err.message}`, 'error');
        } else if (files && files.length > 0) {
            printLine('CacheVerification', `Soft Verifying the integrity of ${files.length} items...`, 'debug');
            await files.forEach(async file => {
                if (file.cache_url !== null && global.enable_cds_full_request) {
                    let filenameT5
                    if (file.cache_url.includes(webconfg.cds_url)) {
                        filenameT5 = `${global.fw_serve}${file.cache_url.split(webconfg.cds_url).pop()}`
                    } else {
                        filenameT5 = `${global.cache_serve}${file.cache_url.split(webconfg.cdn_url).pop()}`
                    }
                    await fs.stat(filenameT5, async function (err, stat) {
                        if (err && err.code === 'ENOENT') {
                            sqlSafe(`UPDATE kanmi_records SET cache_url = null WHERE id = ?`, [file.id], (err, results) => {
                                if (err) {
                                    printLine('SQL', `Fail to reset T5 file ${file.id} - ${err.message}`, 'error');
                                } else if (results.affectedRows && results.affectedRows > 0) {
                                    printLine('ResetCache', `Reset T5 Dead File ${file.id} - ${filenameT5}`, 'debug');
                                }
                            })
                        }
                    })
                }
                if (file.cache_proxy !== null && global.enable_cds_proxy_request) {
                    const filenameT9 = `${global.cache_serve}${file.cache_proxy.split(webconfg.cdn_url).pop()}`
                    await fs.stat(filenameT9, async function (err, stat) {
                        if (err && err.code === 'ENOENT') {
                            sqlSafe(`UPDATE kanmi_records SET cache_proxy = null WHERE id = ?`, [file.id], (err, results) => {
                                if (err) {
                                    printLine('SQL', `Fail to reset T9 file ${file.id} - ${err.message}`, 'error');
                                } else if (results.affectedRows && results.affectedRows > 0) {
                                    printLine('ResetCache', `Reset T9 Dead File ${file.id} - ${filenameT9}`, 'debug');
                                }
                            })
                        }
                    })
                }
            })
            printLine('cleanCache', `Completed Soft Validation of the CDS Files`, 'info');
        }
    })
    sqlSimple(`UPDATE kanmi_records SET cache_url = null WHERE cache_url = 'inprogress'`, (err, results) => {
        if (err) {
            printLine('SQL', `Fail to reset T5/T3 deadlocked files - ${err.message}`, 'error');
        } else if (results.affectedRows && results.affectedRows > 0) {
            printLine('ResetCache', `Reset ${results.affectedRows} deadlocked T5/T3 files`, 'debug');
        }
    })
    sqlSimple(`UPDATE kanmi_records SET cache_proxy = null WHERE cache_proxy = 'inprogress'`, (err, results) => {
        if (err) {
            printLine('SQL', `Fail to reset T9 deadlocked files - ${err.message}`, 'error');
        } else if (results.affectedRows && results.affectedRows > 0) {
            printLine('ResetCache', `Reset ${results.affectedRows} deadlocked T9 files`, 'debug');
        }
    })
    printLine('cleanCache', `Completed Removal of deadlocked files`, 'info');
}

if (global.enable_cds === true && (!process.env.ID || process.env.ID === "0" )) {
    cleanCache();
    validateCache();
    setInterval(cleanCache, 3600000);
    setInterval(validateCache, 14400000);
    //setInterval(validateFiles, 43200000);
}
async function optimize (url, filename, cb) {
    const response = await fetch(url)
    if (!response.ok) {
        cb(false)
    } else {
        const file = await response.buffer()
        const dimensions = sizeOf(file);
        const scaleSize = 512 // Lets Shoot for 2100?
        let resizeParam = {
            fit: sharp.fit.inside,
            withoutEnlargement: true
        }
        if (dimensions.width > dimensions.height) { // Landscape Resize
            resizeParam.width = scaleSize
        } else { // Portrait or Square Image
            resizeParam.height = scaleSize
        }
        sharp(file)
            .resize(resizeParam)
            .toFormat('jpeg', {
                quality: 50
            })
            .withMetadata()
            .toFile(filename, function(err){
                if(err){
                    cb(false)
                    printLine('CacheDownload', `Fail to resize image for cache (${url}) - ${err.message}`, 'error');
                } else {
                    cb(true)
                }
            })
    }
}
async function optimizedot1 (url, filename, cb) {
    const response = await fetch(url)
    if (!response.ok) {
        cb(false)
    } else {
        const file = await response.buffer()
        const dimensions = sizeOf(file);
        const scaleSize = 800
        let resizeParam = {
            fit: sharp.fit.inside,
            withoutEnlargement: true
        }
        if (dimensions.width > dimensions.height) { // Landscape Resize
            resizeParam.width = scaleSize
        } else { // Portrait or Square Image
            resizeParam.height = scaleSize
        }
        sharp(file)
            .resize(resizeParam)
            .blur(10)
            .modulate({
                saturation: 1.5
            })
            .toFormat('jpeg', {
                quality: 50
            })
            .withMetadata()
            .toFile(filename, function(err){
                if(err){
                    cb(false)
                    printLine('CacheDownload', `Fail to resize image for cache (${url}) - ${err.message}`, 'error');
                } else {
                    cb(true)
                }
            })
    }
}
async function download (url, filename, cb) {
    const response = await fetch(url)
    if (!response.ok) {
        cb(false);
    } else {
        const file = await response.buffer()
        await fs.writeFile(filename, file, function (err) {
            if (err) {
                cb(false);
            } else {
                cb(true);
            }
        });
    }
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
async function Cache9(message, cb) {
    if (message && message.id && !isNaN(parseInt(message.id.toString())) && message.url && message.url !== '') {
        if (message.extra && message.extra === true && message.extraData && message.extraData.length > 0) {
            cb(true);
        } else {
            const filename = `t9/PROXY-${crypto.randomBytes(16).toString("hex")}.jpg`;
            await optimize(message.url, `${global.cache_serve}${filename}`, async function (results) {
                if (results) {
                    const url = `${webconfg.cdn_url}${filename}`
                    sqlSafe(`UPDATE kanmi_records SET cache_proxy = ? WHERE id = ?`, [url, message.id.toString()], (err, results) => {
                        if (err) {
                            printLine('SQL', `Failed to save cache for ${message.id}`, 'error');
                            cb(false);
                        } else if (results.affectedRows && results.affectedRows > 0) {
                            printLine('Cache9', `Successfully cached ${message.id} to "${webconfg.cdn_url}${filename}"`, 'debug');
                            cb(true);
                        }
                    })
                } else {
                    const altfilename = `t9/PROXY-${crypto.randomBytes(16).toString("hex")}.${message.url.split('.').pop()}`;
                    const url = `${webconfg.cdn_url}${altfilename}`
                    await download(message.url, `${global.cache_serve}${altfilename}`, async function (results) {
                        sqlSafe(`UPDATE kanmi_records SET cache_proxy = ? WHERE id = ?`, [url, message.id.toString()], (err, results) => {
                            if (err) {
                                printLine('SQL', `Failed to save cache for ${message.id}`, 'error');
                                cb(false);
                            } else if (results.affectedRows && results.affectedRows > 0) {
                                printLine('Cache9', `Successfully cached ${message.id} to "${webconfg.cdn_url}${altfilename}"`, 'debug');
                                cb(true);
                            }
                        })
                    })
                }
            })
        }
    } else {
        cb(true);
    }
}
async function Cache9dot1(message, cb) {
    if (message && message.id && !isNaN(parseInt(message.id.toString())) && message.url && message.url !== '') {
        if (message.extra && message.extra === true && message.extraData && message.extraData.length > 0) {
            cb(true);
        } else {
            const filename = `t9.1/PROXY-${crypto.randomBytes(16).toString("hex")}.jpg`;
            await optimizedot1(message.url, `${global.cache_serve}${filename}`, async function (results) {
                if (results) {
                    const url = `${webconfg.cdn_url}${filename}`
                    sqlSafe(`UPDATE kanmi_records SET cache_proxy = ? WHERE id = ?`, [url, message.id.toString()], (err, results) => {
                        if (err) {
                            printLine('SQL', `Failed to save cache for ${message.id}`, 'error');
                            cb(false);
                        } else if (results.affectedRows && results.affectedRows > 0) {
                            printLine('Cache9dot1', `Successfully cached ${message.id} to "${webconfg.cdn_url}${filename}"`, 'debug');
                            cb(true);
                        }
                    })
                } else {
                    printLine('Cache9dot1', `Failed to save cache for ${message.id}`, 'error');
                    cb(false);
                }
            })
        }
    } else {
        cb(true);
    }
}
async function Cache5(message, cb) {
    if (message && message.id && !isNaN(parseInt(message.id.toString())) && message.url && message.url !== '') {
        if (message.extra && message.extra === true && message.extraData && message.extraData.length > 0) {
            cb(true);
        } else {
            const filename = `t5/${message.id}-${message.url.split('/').pop()}`;
            await download(message.url, `${global.cache_serve}${filename}`, async function (results) {
                if (results) {
                    const url = `${webconfg.cdn_url}${filename}`
                    sqlSafe(`UPDATE kanmi_records SET cache_url = ? WHERE id = ?`, [url, message.id.toString()], (err, results) => {
                        if (err) {
                            printLine('SQL', `Failed to save cache for ${message.id}`, 'error');
                            cb(false);
                        } else if (results.affectedRows && results.affectedRows > 0) {
                            printLine('Cache5', `Successfully cached ${message.id} to "${webconfg.cdn_url}${filename}"`, 'debug');
                            cb(true);
                        }
                    })
                } else {
                    cb(true);
                }
            })
        }
    } else {
        cb(true);
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
async function Cache3(message, cb) {
    if (message && message.id && !isNaN(parseInt(message.id.toString())) && message.url && message.url !== '') {
        if (message.extra && message.extra === true && message.extraData && message.extraData.length > 0) {
            cb(true);
        } else {
            const filename = `t3/${message.url.split('/').pop()}`;
            await download(message.url, `${global.cache_serve}${filename}`, async function (results) {
                if (results) {
                    const url = `${webconfg.cdn_url}${filename}`
                    sqlSafe(`UPDATE kanmi_records SET cache_url = ? WHERE id = ?`, [url, message.id.toString()], (err, results) => {
                        if (err) {
                            printLine('SQL', `Failed to save cache for ${message.id}`, 'error');
                            cb(false);
                        } else if (results.affectedRows && results.affectedRows > 0) {
                            printLine('Cache3', `Successfully cached ${message.id} to "${webconfg.cdn_url}${filename}"`, 'debug');
                            cb(true);
                        }
                    })
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

module.exports = { Cache9, Cache9dot1, Cache5, Cache3, CacheRemove, CacheColor, updateFileName };
