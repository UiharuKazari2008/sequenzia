const global = require('../config.json')
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const mv = require('mv');
const yauzl = require("yauzl");
const rimraf = require('rimraf');
const path = require("path");
const crypto = require('crypto');
const { sqlSafe, sqlSimple} = require("../js/sqlClient");
const { sendData } = require('../js/mqAccess')
const { printLine } = require("../js/logSystem");
const { sessionVerification, writeValidation } = require('./discord')
const router = express.Router();
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, global.tmp_folder)
    },
    filename: function (req, file, cb) {
        cb(null, `SEQUENZIA-${crypto.randomBytes(16).toString("hex")}`)
    }
})
const upload = multer({
    storage: storage,
    dest: global.tmp_folder,
    limits: {
        fieldSize: 10 * 1073741824 // 10GB Limit
    }
});
const ActiveMQ = true

router.post('/files', sessionVerification, writeValidation, upload.array('files'), async (req, res) => {
    try {
        const thisUser = res.locals.thisUser
        const files = req.files;
        if (!files) {
            res.status(400).send(`No Files`);
            printLine('Upload', `Incomplete Request or Missing Files`, 'error')
        } else {
            // Common Filenames to block from upload
            const blocked_filenames = ['.db', 'macosx', '.config', '.DS_Store', 'thumb', '.ini', 'AlbumArt', 'Folder.', '.app']

            function parseUpload(fileType) {
                if (!fileType) {
                    res.status(500).send('Failed to get channel data');
                    printLine('Upload', `Failed to get a valid list of approved file types`, 'error');
                } else {
                    printLine('Upload', `Approved File Types - ${fileType}`, 'debug', {
                        filetypes: fileType
                    });
                    files.map(async (p, i, arr) => {
                        if (arr.length === 1 && p.originalname.split('.').length > 1 && p.originalname.split('.').pop().toLowerCase().includes('zip') && req.query && req.query.package && req.query.package === 'true') {
                            printLine('Upload', `Incoming Package Upload`, 'info')
                            try {
                                yauzl.open(p.path, {autoClose: true, lazyEntries: false, decodeStrings: true, validateEntrySizes: true, strictFileNames: false}, function(err, zipfile) {
                                    if (err) {
                                        printLine('Unpack', `Error occurred while opening package - ${err.message}`, 'error');
                                        res.status(500).send(err);
                                    } else {
                                        zipfile.on("entry", function(entry) {
                                            if (/\/$/.test(entry.fileName)) {
                                            } else {
                                                // file entry
                                                zipfile.openReadStream(entry, function(err, readStream) {
                                                    if (err) {
                                                        printLine('Unpack', `Error occurred while unpacking item from package - ${err.message}`, 'error');
                                                        res.status(500).send(err);
                                                    } else {
                                                        const real_filename = entry.fileName.split('/').pop();
                                                        if (fileType && fileType === 'all' || (fileType && entry.fileName.split('.').length > 1 && fileType.includes(entry.fileName.split('.').pop()) && entry.fileName.substring(0,1) !== '.' )) {
                                                            if (blocked_filenames.filter((e) => {return entry.fileName.toLowerCase().includes(e.toLowerCase())}).length === 0) {
                                                                sendThisFile()
                                                            } else {
                                                                printLine('Unpack', `Illegal File Detected - ${entry.fileName}`, 'warn');
                                                            }
                                                        }
                                                        function sendThisFile() {
                                                            const local_filename = `SEQPACK-${crypto.randomBytes(16).toString("hex")}`
                                                            const fileWriter = fs.createWriteStream(path.join(global.upload_folder, local_filename))
                                                            readStream.pipe(fileWriter);
                                                            fileWriter.on('finish', function () {
                                                                if (fs.existsSync(path.join(global.upload_folder, local_filename))) {
                                                                    const MessageBody = {
                                                                        Type: 'Remote',
                                                                        ChannelID: req.query.channelid,
                                                                        UserID: thisUser.discord.user.id,
                                                                        MessageText: '',
                                                                        FileName: real_filename,
                                                                        FilePath: `${global.fw_path}${local_filename}`
                                                                    }
                                                                    if (ActiveMQ) {
                                                                        sendData(global.mq_fileworker_in, MessageBody, function (callback) {
                                                                            if (callback) {
                                                                                printLine('Unpack', `File Uploaded to worker - ${local_filename}`, 'info');
                                                                            } else {
                                                                                printLine('Unpack', `Filed to upload file to worker - ${local_filename}`, 'error');
                                                                            }
                                                                        })
                                                                    } else {
                                                                        console.log(MessageBody)
                                                                    }
                                                                }
                                                            });
                                                            fileWriter.on('error', (fser) => {
                                                                printLine('Unpack', `Filed to write file to filesystem - ${local_filename} - ${fser}`, 'error');
                                                            })
                                                        }
                                                    }
                                                });
                                            }
                                        });
                                        zipfile.on('end', function() {
                                            printLine('Unpack', `Unpacking completed!`, 'info');
                                            res.status(200).send('Upload Complete');
                                        })
                                        zipfile.on('error', function(err) {
                                            printLine('Unpack', `Error occurred while opening package - ${err.message}`, 'error');
                                            res.status(500).send('Failure during unpacking');
                                        })
                                    }
                                });
                            } catch (err) {
                                res.status(500).send(err);
                            }
                        } else {
                            printLine('Upload', `Incoming File Upload`, 'info')
                            if (fileType && fileType === 'all' || (fileType && p.originalname.split('.').length > 1 && fileType.includes(p.originalname.split('.').pop()) && p.originalname.substring(0,1) !== '.' )) {
                                if (blocked_filenames.filter((e) => {return p.originalname.toLowerCase().includes(e)}).length === 0) {
                                    sendThisFile()
                                } else {
                                    printLine('Upload', `Illegal File Detected - ${entry.fileName}`, 'warn');
                                }
                            } else {
                                rimraf(p.path, (error) => { if (error) { printLine('Upload', `Filed to erasing uploaded file - ${p.path} - ${error.message}`, 'error'); }});
                                if (arr.length === i + 1) {
                                    printLine('Upload', `Failed to get approved files`, 'error');
                                    res.status(400).send(`Upload Issues`);
                                }
                            }
                            function sendThisFile() {
                                mv(p.path, path.join(global.upload_folder, p.filename), {mkdirp: true, clobber: true}, function (err) {
                                    if (err) {
                                        printLine('Upload', `Error saving file to fileworker folder - ${err}`, 'error');
                                    } else {
                                        if (fs.existsSync(path.join(global.upload_folder, p.filename))) {
                                            const MessageBody = {
                                                Type: 'Remote',
                                                ChannelID: req.query.channelid,
                                                UserID: thisUser.discord.user.id,
                                                MessageText: '',
                                                FileName: p.originalname,
                                                FilePath: `${global.fw_path}${p.filename}`
                                            }
                                            if (ActiveMQ) {
                                                sendData(global.mq_fileworker_in, MessageBody, function (callback) {
                                                    if (callback) {
                                                        printLine('Upload', `File Uploaded to worker - ${p.filename}`, 'info');
                                                        if (arr.length === i + 1) {
                                                            res.status(200).send(`Upload Success`);
                                                        }
                                                    } else {
                                                        printLine('Upload', `Filed to upload file to worker - ${p.filename}`, 'error');
                                                        if (arr.length === i + 1) {
                                                            res.status(400).send(`Upload Error`);
                                                        }
                                                    }
                                                })
                                            } else {
                                                if (arr.length === i + 1) {
                                                    printLine('Upload', `Upload completed!`, 'info');
                                                    res.status(200).send(`Upload Success`);
                                                }
                                            }
                                        } else {
                                            if (arr.length === i + 1) {
                                                printLine('Upload', `Upload failed because file was not found!`, 'error');
                                                res.status(400).send(`File Not Found`);
                                            }
                                        }
                                    }
                                });
                            }
                        }
                    });
                }
            }

            sqlSafe(`SELECT * FROM kanmi_channels WHERE channelid = ?`, [req.query.channelid], (err, ch) => {
                if (err) {
                    printLine('SQL', `Failed to get Channel list - ${err.message}`, 'error');
                    parseUpload();
                } else if (ch && ch.length > 0) {
                    let fileType
                    let classList = []
                    ch[0].classification.split(' ').filter((c) => {
                        return c !== ' ' && c !== ''
                    }).forEach((c) => {
                        classList.push(`class = '${c}'`)
                    })
                    sqlSimple(`SELECT * FROM sequenzia_class WHERE (${classList.join(' OR ')})`, (err, cl) => {
                        if (err) {
                            printLine('SQL', `Failed to get Classifications list - ${err.message}`, 'error');
                            parseUpload();
                        } else if (cl.length > 0) {
                            let _ft = ''
                            cl.forEach((c) => {
                                if (c.filetypes === null) {
                                    _ft = '-all-'
                                } else {
                                    _ft += `${c.filetypes} `
                                }
                            })
                            if (_ft.includes('-all-')) {
                                fileType = 'all'
                            } else {
                                fileType = _ft
                            }
                            parseUpload(fileType);
                        } else {
                            parseUpload();
                        }
                    })
                }
            })
        }
    } catch (err) {
        printLine('Upload', `Unknown Error occurred - ${err}`, 'error');
        res.status(500).send(err);
    }
});

module.exports = router;
