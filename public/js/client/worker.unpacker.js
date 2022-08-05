let offlineContent;
let browserStorageAvailable = false;
const imageFiles = ['jpg','jpeg','jfif','png','webp','gif'];
const videoFiles = ['mp4','mov','m4v', 'webm'];
const audioFiles = ['mp3','m4a','wav', 'ogg', 'flac'];

const offlineContentDB = self.indexedDB.open("offlineContent", 3);
offlineContentDB.onerror = event => {
    console.error(event.errorCode);
    console.error(`IndexedDB Is Not Available: Offline Content will not be available!`)
};
offlineContentDB.onsuccess = event => {
    offlineContent = event.target.result;
    console.log('Offline Database is available');
    browserStorageAvailable = true;
};

let downloadSpannedController = new Map();
let activeSpannedJob = false;
async function openUnpackingFiles(object) {
    /*{
        id: ,
        name: ,
        size: ,
        channel: ,
        preemptive: ,
        offline: ,
        play:
    }*/
    if (object.id && object.id.length > 0) {
        if (downloadSpannedController.size === 0 && !activeSpannedJob) {
            downloadSpannedController.set(object.id, {
                ...object,
                pending: true,
                ready: true
            })
            postMessage({type: 'STATUS_UNPACK_STARTED', fileid: object.id});
            while (downloadSpannedController.size !== 0) {
                const itemToGet = Array.from(downloadSpannedController.keys())[0]
                activeSpannedJob = downloadSpannedController.get(itemToGet)
                if (activeSpannedJob.ready && activeSpannedJob.pending) {
                    const download = await unpackFile();
                    if (download) {
                        postMessage({type: 'STATUS_UNPACK_COMPLETED', fileid: object.id})
                    } else {
                        postMessage({type: 'STATUS_UNPACK_FAILED', fileid: object.id})
                    }
                }
                downloadSpannedController.delete(itemToGet);
                console.log(`Job Complete: ${downloadSpannedController.size} Jobs Left`)
            }
            activeSpannedJob = false;
        } else if (!downloadSpannedController.has(object.id)) {
            downloadSpannedController.set(object.id, {
                ...object,
                pending: true,
                ready: true
            })
            postMessage({type: 'STATUS_UNPACK_QUEUED', fileid: object.id})
        } else {
            postMessage({type: 'STATUS_UNPACK_DUPLICATE', fileid: object.id})
        }
    } else  {
        postMessage({type: 'STATUS_UNPACK_FAILED', fileid: object.id})
    }
}
async function unpackFile() {
    if (activeSpannedJob && activeSpannedJob.id && activeSpannedJob.pending && activeSpannedJob.ready) {
        console.log(`Downloading File ${activeSpannedJob.id}...`)
        const activeID = activeSpannedJob.id + '';
        activeSpannedJob.pending = false;
        let blobs = []
        postMessage({type: 'STATUS_UNPACKER_ACTIVE', action: 'GET_METADATA', fileid: activeID});
        return await new Promise(async (job) => {
            try {
                const response = await fetch( new Request(`/parity/${activeID}`, {
                    type: 'GET',
                    redirect: "follow",
                    headers: {
                        'X-Requested-With': 'SequenziaXHR',
                        'x-Requested-Page': 'SeqClientUnpacker'
                    }
                }))
                if (response.status < 300) {
                    try {
                        const object = JSON.parse((await response.text()).toString());
                        activeSpannedJob = {
                            ...object,
                            ...activeSpannedJob,
                            progress: '0%',
                            abort: new AbortController()
                        };

                        if (activeSpannedJob.parts && activeSpannedJob.parts.length > 0 && activeSpannedJob.expected_parts) {
                            if (activeSpannedJob.parts.length === activeSpannedJob.expected_parts) {
                                postMessage({type: 'STATUS_UNPACKER_ACTIVE', action: 'EXPECTED_PARTS', expected_parts: activeSpannedJob.expected_parts, fileid: activeID});
                                let pendingBlobs = {}
                                let retryBlobs = {}
                                activeSpannedJob.parts.map((e,i) => {
                                    pendingBlobs[i] = e;
                                    retryBlobs[i] = 0;
                                })
                                function calculatePercent() {
                                    const percentage = (Math.abs((Object.keys(pendingBlobs).length - activeSpannedJob.parts.length) / activeSpannedJob.parts.length)) * 100
                                    activeSpannedJob.progress = percentage.toFixed(0);
                                    postMessage({
                                        type: 'STATUS_UNPACKER_ACTIVE',
                                        action: 'FETCH_PARTS_PROGRESS',
                                        percentage: activeSpannedJob.progress,
                                        fetchedBlocks: blobs.length,
                                        pendingBlocks: activeSpannedJob.parts.length - blobs.length,
                                        totalBlocks: activeSpannedJob.parts.length,
                                        fileid: activeID});
                                }
                                while (Object.keys(pendingBlobs).length !== 0) {
                                    if (!(activeSpannedJob && activeSpannedJob.ready))
                                        break;
                                    let downloadKeys = Object.keys(pendingBlobs).slice(0,8)
                                    const results = await Promise.all(downloadKeys.map(async item => {
                                        return new Promise(async ok => {
                                            try {
                                                const block = await fetch(new Request(pendingBlobs[item], {
                                                    method: 'GET',
                                                    signal: activeSpannedJob.abort.signal
                                                }))
                                                if (block && (block.status === 200 || block.status === 0)) {
                                                    console.log(`Downloaded Parity ${item}`);
                                                    const blob = await block.blob()
                                                    if (blob.size > 5) {
                                                        blobs[item] = blob;
                                                        calculatePercent();
                                                        delete pendingBlobs[item];
                                                        ok(true);
                                                    } else {
                                                        if (activeSpannedJob)
                                                            activeSpannedJob.ready = false;
                                                        ok(false);
                                                    }
                                                } else if (block) {
                                                    console.error(`Failed Parity ${item} (Retry attempt #${retryBlobs[item]}) - ${block.status}`)
                                                    retryBlobs[item] = retryBlobs[item] + 1
                                                    if (retryBlobs[item] > 3) {
                                                        if (activeSpannedJob)
                                                            activeSpannedJob.ready = false;
                                                        ok(false);
                                                    } else {
                                                        ok(null);
                                                    }
                                                } else {
                                                    ok(false);
                                                }
                                            } catch (err) {
                                                console.error(`Failed Parity ${item} (Retry attempt #${retryBlobs[item]})`)
                                                retryBlobs[item] = retryBlobs[item] + 1
                                                if (retryBlobs[item] > 3) {
                                                    if (activeSpannedJob)
                                                        activeSpannedJob.ready = false;
                                                    ok(false);
                                                } else {
                                                    ok(null);
                                                }
                                            }
                                        })
                                    }))
                                    if (results.filter(e => e === false).length > 0)
                                        break;
                                }

                                if (activeSpannedJob && blobs.length === activeSpannedJob.expected_parts) {
                                    activeSpannedJob.progress = `100%`;
                                    let blobType = {}
                                    if (activeSpannedJob.play === 'video' || activeSpannedJob.play === 'kms-video' || videoFiles.indexOf(activeSpannedJob.filename.split('.').pop().toLowerCase().trim()) > -1)
                                        blobType.type = 'video/' + activeSpannedJob.filename.split('.').pop().toLowerCase().trim();
                                    if (activeSpannedJob.play === 'audio' || audioFiles.indexOf(activeSpannedJob.filename.split('.').pop().toLowerCase().trim()) > -1)
                                        blobType.type = 'audio/' + activeSpannedJob.filename.split('.').pop().toLowerCase().trim();

                                    const finalBlock = new Blob(blobs, blobType);
                                    if (browserStorageAvailable) {
                                        try {
                                            offlineContent.transaction([`spanned_files`], "readwrite").objectStore('spanned_files').put({
                                                ...activeSpannedJob,
                                                block: finalBlock,
                                                parts: undefined,
                                                expected_parts: undefined,
                                                pending: undefined,
                                                ready: undefined,
                                                blobs: undefined,
                                                abort: undefined,
                                                progress: undefined,
                                                offline: undefined,
                                            }).onsuccess = event => {
                                                console.log(`File Saved Offline!`);
                                            };
                                        } catch (e) {
                                            console.error(`Failed to save block ${activeID}`);
                                            console.error(e);
                                        }
                                    }


                                    postMessage({type: 'STATUS_UNPACKER_ACTIVE', action: 'BLOCKS_ACQUIRED', fileid: activeID});
                                    job(true);
                                } else {
                                    postMessage({type: 'STATUS_UNPACKER_FAILED', action: 'EXPECTED_FETCH_PARTS', fileid: activeID});
                                    job(false);
                                }
                            } else {
                                postMessage({type: 'STATUS_UNPACKER_FAILED', action: 'EXPECTED_PARTS', fileid: activeID});
                                job(false);
                            }
                        } else {
                            postMessage({type: 'STATUS_UNPACKER_FAILED', action: 'READ_METADATA', fileid: activeID});
                            job(false);
                        }
                    } catch (e) {
                        console.error(e);
                        postMessage({type: 'STATUS_UNPACKER_FAILED', action: 'UNCAUGHT_ERROR', message: e.message, fileid: activeID});
                        job(false);
                    }
                } else {
                    postMessage({type: 'STATUS_UNPACKER_FAILED', action: 'GET_METADATA', message: (await response.text()), fileid: activeID})
                    job(false);
                }
                if (activeSpannedJob) {
                    blobs = null;
                    activeSpannedJob.parts = null;
                    delete activeSpannedJob.parts;
                }
            } catch (err) {
                postMessage({type: 'STATUS_UNPACKER_FAILED', action: 'GET_METADATA', fileid: activeID})
                blobs = null;
                activeSpannedJob.parts = null;
                delete activeSpannedJob.parts;
                console.error(err);
                job(false);
            }
        })
    } else {
        return false
    }
}
async function stopUnpackingFiles(fileid) {
    if (downloadSpannedController.has(fileid)) {
        const _controller = downloadSpannedController.get(fileid)
        if (_controller.pending === true) {
            _controller.pending = false;
            _controller.ready = false;
            downloadSpannedController.delete(fileid)
        } else {
            activeSpannedJob.abort.abort();
            activeSpannedJob = null;
            downloadSpannedController.delete(fileid);
        }
    }
}

onmessage = function(event) {
    switch (event.data.type) {
        case 'UNPACK_FILE':
            openUnpackingFiles(event.data.object);
            break;
        case 'CANCEL_UNPACK_FILE':
            stopUnpackingFiles(event.data.fileid);
            break;
        case 'PING':
            postMessage({type: 'PONG'});
            break;
        default:
            console.log(event);
            console.log(event.data);
            console.log('Unknown Message');
            break;
    }
}
