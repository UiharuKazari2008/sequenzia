function sendDownloadRequest(serverid, channelid, messageid, wait, create) {
    if (fileWorking === false || !wait || !create) {
        $.ajax({async: true,
            type: "post",
            url: "/actions/v2",
            data:
                {
                    'serverid': serverid,
                    'channelid': channelid,
                    'messageid': messageid,
                    'action': (create) ? 'RequestFile' : 'DeCacheFile'
                },
            cache: false,
            headers: {
                'X-Requested-With': 'SequenziaXHR'
            },
            success: function (html) {
                if (create) {
                    try {
                        $('#sectionRequestText')[0].classList.remove('hidden');
                    } catch (e) {
                        console.error(e)
                    }
                    if (wait) {
                        refreshFileStatus(messageid)
                        count = 0;
                        console.log('Message Sent')
                    }
                } else {

                }
            },
            error: function (html) {
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
let count = 0;
function refreshFileStatus(messageid) {
    if (count <= 12) {
        requestText.innerText = "Request Timeout"
    } else if (fileWorking === false) {
        $('#requestModel').modal('show');
        fileWorking = true
        let worker = setInterval(function () {
            count++
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
