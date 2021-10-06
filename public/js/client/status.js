function sendDownloadRequest(serverid, channelid, messageid, wait) {
    const requestButton = $(`#request-${messageid}`)[0]
    if (fileWorking === false || !wait) {
        $.ajax({async: true,
            type: "post",
            url: "/actions/v2",
            data:
                {
                    'serverid': serverid,
                    'channelid': channelid,
                    'messageid': messageid,
                    'action': 'RequestFile'
                },
            cache: false,
            headers: {
                'X-Requested-With': 'SequenziaXHR'
            },
            success: function (html) {
                try {
                    $('#sectionRequestText')[0].classList.remove('hidden');
                    requestButton.setAttribute('onclick', '')
                    requestButton.querySelector('i').classList.remove('fa-box-open')
                    requestButton.querySelector('i').classList.add('fa-spinner')
                } catch (e) {
                    console.error(e)
                }
                if (wait) {
                    refreshFileStatus(messageid)
                    console.log('Message Sent')
                }
            },
            error: function (html) {
                try {
                    requestButton.setAttribute('onclick', '')
                    requestButton.querySelector('i').classList.remove('fa-box-open')
                    requestButton.querySelector('i').classList.add('fa-ban')
                } catch (e) {
                    console.error(e)
                }
                $.toast({
                    type: 'error',
                    title: 'Request Failed',
                    subtitle: 'Now',
                    content: `Failed to request that file to download. Please try again`,
                    delay: 5000,
                });
            }
        });
    } else {
        $.toast({
            type: 'warning',
            title: 'Request Already in Progress',
            subtitle: 'Now',
            content: `You must wait for the existing request to complete!`,
            delay: 5000,
        });
    }
    return false;
}
function refreshFileStatus(messageid) {
    const rawButton = $(`#request-${messageid}`)
    const downloadButton = $(`#request-download-${messageid}`)[0]
    const requestButton = rawButton[0]

    if (fileWorking === false) {
        $('#requestModel').modal('show');
        fileWorking = true
        let worker = setInterval(function () {
            $.ajax({async: true,
                type: "GET", data: '',
                url: `/status?request=FileStatus&item=${messageid}`,
                cache: false,
                headers: {
                    'X-Requested-With': 'SequenziaXHR'
                },
                success: function (html, textStatus, xhr) {
                    if (xhr.status === 201) {
                        requestText.innerText = "Waiting In Line..."
                    } else if (xhr.status === 202) {
                        requestText.innerText = "In progress..."
                    } else if (xhr.status === 200 && xhr.responseText && xhr.responseText.includes('http')) {
                        requestText.innerText = "Completed"
                        requestDownload.href = xhr.responseText
                        requestDownload.download = xhr.responseText.split('/').pop().split('.')[0];
                        if (!window.location.hash.substring(1).includes('card')) {
                            downloadButton.href = xhr.responseText
                            downloadButton.download = xhr.responseText.split('/').pop().split('.')[0];
                            downloadButton.classList.remove('d-none');
                        }
                        if (!window.location.hash.substring(1).includes('card') && xhr.responseText.toLowerCase() !== null && xhr.responseText.toLowerCase() !== '' && (xhr.responseText.toLowerCase().includes('.jp') || xhr.responseText.toLowerCase().includes('.png') || xhr.responseText.toLowerCase().includes('.gif'))) {
                            requestImage.src = xhr.responseText
                            requestIcon.classList.add('hidden');
                            requestImage.classList.remove('hidden');
                            requestButton.remove();
                        } else if (!window.location.hash.substring(1).includes('card') && xhr.responseText.toLowerCase() !== null && xhr.responseText.toLowerCase() !== '' && (xhr.responseText.toLowerCase().includes('.mp3') || xhr.responseText.toLowerCase().includes('.m4a') || xhr.responseText.toLowerCase().includes('.ogg') || xhr.responseText.toLowerCase().includes('.wav'))) {
                            requestIcon.classList.remove('hidden');
                            requestImage.classList.add('hidden');
                            requestPlay.classList.remove('hidden');
                            $('#requestPlay').attr('onclick', `$('#requestModel').modal('hide'); PlayTrack("${xhr.responseText}"); return false;`);
                            requestButton.href = '#'
                            requestButton.querySelector('i').classList.remove('fa-spinner');
                            if ($(`#play-${messageid}`).length > 0) {
                                $(`#play-${messageid}`).attr('onclick', `PlayTrack("${xhr.responseText}"); return false;`);
                                requestButton.querySelector('i').classList.add('fa-first-aid');
                            } else {
                                requestButton.classList.remove('btn-fav');
                                requestButton.classList.add('btn-switchmode');
                                rawButton.attr('onclick', `PlayTrack("${xhr.responseText}"); return false;`);
                                requestButton.querySelector('i').classList.add('fa-play');
                            }
                        } else if (!window.location.hash.substring(1).includes('card') && xhr.responseText.toLowerCase() !== null && xhr.responseText.toLowerCase() !== '' && (xhr.responseText.toLowerCase().includes('.mp4') || xhr.responseText.toLowerCase().includes('.webm') || xhr.responseText.toLowerCase().includes('.mov') || xhr.responseText.toLowerCase().includes('.m4v'))) {
                            requestIcon.classList.remove('hidden');
                            requestImage.classList.add('hidden');
                            requestPlay.classList.remove('hidden');
                            $('#requestPlay').attr('onclick', `$('#requestModel').modal('hide'); PlayVideo("${xhr.responseText}"); return false;`);
                            requestButton.href = '#'
                            requestButton.querySelector('i').classList.remove('fa-spinner');
                            if ($(`#play-${messageid}`).length > 0) {
                                $(`#play-${messageid}`).attr('onclick', `PlayVideo("${xhr.responseText}"); return false;`);
                                requestButton.querySelector('i').classList.add('fa-first-aid');
                            } else {
                                requestButton.classList.remove('btn-fav');
                                requestButton.classList.add('btn-switchmode');
                                rawButton.attr('onclick', `PlayVideo("${xhr.responseText}"); return false;`);
                                requestButton.querySelector('i').classList.add('fa-play');
                            }
                        } else {
                            requestIcon.classList.remove('hidden');
                            requestImage.classList.add('hidden');
                            if (window.location.hash.substring(1).includes('file')) {
                                requestButton.classList.remove('btn-fav');
                                requestButton.classList.add('btn-switchmode');
                                requestButton.href = xhr.responseText
                                rawButton.attr('target', `_blank`);
                                rawButton.attr('rel', `noopener noreferrer`);
                                requestButton.querySelector('i').classList.remove('fa-spinner');
                                requestButton.querySelector('i').classList.add('fa-download');
                            } else if (window.location.hash.substring(1).includes('card')) {
                                requestButton.classList.remove('btn-primary');
                                requestButton.classList.add('btn-success');
                                requestButton.href = xhr.responseText
                                rawButton.attr('target', `_blank`);
                                rawButton.attr('rel', `noopener noreferrer`);
                                requestButton.querySelector('i').classList.remove('fa-spinner');
                                requestButton.querySelector('i').classList.add('fa-download');
                                requestButton.querySelector('span').innerText = 'Download File'
                            } else {
                                requestButton.remove();
                            }
                        }
                        $('#sectionRequestText')[0].classList.add('hidden');
                        $('#sectionRequestResults')[0].classList.remove('hidden');
                    } else {
                        requestText.innerText = "Unknown Error"
                        console.log('Unknown Code')
                        console.log(xhr.status)
                    }
                },
                complete: function (xhr) {
                    if (xhr.status === 200) {
                        $('#requestModel').modal('show');
                        clearInterval(worker)
                        fileWorking = false
                    }
                },
                error: function (xhr) {
                    $.toast({
                        type: 'error',
                        title: 'Request Failed',
                        subtitle: 'Now',
                        content: `Failed to get file status update: ${xhr.responseText}`,
                        delay: 5000,
                    });
                }
            });
        }, 10000)

    }
    return null;
}

function clearRequestModel() {
    requestText.innerText = "Waiting..."
    $('#sectionRequestText')[0].classList.remove('hidden');
    $('#sectionRequestResults')[0].classList.add('hidden');
    $('#requestPlay')[0].classList.add('hidden');
}
