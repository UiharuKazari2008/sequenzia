// Server Manager Code
let countdownTimer = 2;
let modeSelection = '';
let actionSelection = '';
let imageRotate = '';
let newFileName = '';
let oldFileName = '';
let pageType = $.history.url().split('?')[0].substring(1);

// File Name Update
function updateFileName(obj) {
    newFileName = obj.value;
    if (newFileName.split('.') && newFileName.split('.').length > 1 && newFileName !== oldFileName ) {
        singlePostBtn.classList.remove("disabled");
    } else {
        newFileName = '';
        singlePostBtn.classList.add("disabled");
    }
}

// Post Mangement
function proccessPost(alt) {
    disableGallerySelect();
    $('#actionModel').modal('hide');
    if (actionSelection !== '' && postsActions.length > 0) {
        postsActions.forEach((post, i, a) => {
            let confirm = true;
            if (a.length !== 1 && i + 1 !== a.length) {
                confirm = false
            }
            if (actionSelection === 'CompileSF') {
                if (post.file === false || post.file === true) {
                    sendDownloadRequest(post.serverid, post.channelid, post.messageid, !(postsActions.filter(e => e.file === true ||  e.file === false).length > 1));
                }
                if (confirm) {
                    postsActions = [];
                    $.snack('success', `Requested to Compile ${(postsActions.length > 1) ? postsActions.filter(e => e.file === true ||  e.file === false).length + " Files" : "File"}`, 5000)
                }
            } else if (actionSelection === 'Report' || actionSelection === 'RemoveReport') {
                if (alt) {
                    sendBasic(post.channelid, post.messageid, alt, confirm);
                } else {
                    sendBasic(post.channelid, post.messageid, actionSelection, confirm);
                }
            } else {
                let data = undefined
                if (actionSelection === 'RenamePost') { data = newFileName  } else if (actionSelection === 'RotatePost') { data = imageRotate } else if (actionSelection === 'MovePost') { data = postsDestination } else { data = null }
                if (alt) {
                    sendAction(post.serverid, post.channelid, post.messageid, alt, data, confirm);
                } else {
                    sendAction(post.serverid, post.channelid, post.messageid, actionSelection, data, confirm);
                }
            }
        })
    };
}
function openActionMenu(mode) {
    if (postsActions.length > 0) {
        pageType = $.history.url().split('?')[0].substring(1)
        modeSelection = (mode) ? 'multi' : 'single';
        actionModel.querySelector('#selectedMenu').classList.remove('d-none');
        actionModel.querySelector('#selectedAction').classList.add('d-none');
        actionModel.querySelector('#finalButton').classList.add('d-none');
        actionModel.querySelector("#postID").innerText = `Manage ${(postsActions.length > 1) ? postsActions.length + ' Items' : postsActions[0].messageid}`;

        if (pageType.includes('file') || pageType.includes('cards')) {
            if (postsActions.length === 1) {
                actionModel.querySelector('#actionModelRename').classList.remove('d-none');
                actionModel.querySelector('#actionModelRename').classList.add('d-flex');
            } else {
                actionModel.querySelector('#actionModelRename').classList.add('d-none');
                actionModel.querySelector('#actionModelRename').classList.remove('d-flex');
            }
        } else {
            actionModel.querySelector('#actionModelRename').classList.add('d-none');
            actionModel.querySelector('#actionModelRename').classList.remove('d-flex');
        }
        const fileCompileable = postsActions.filter(e => e.file === true || e.file === false)
        if (fileCompileable.length > 0) {
            actionModel.querySelector('#actionModelCompile').classList.remove('d-none');
            actionModel.querySelector('#actionModelCompile').classList.add('d-flex');
        } else {
            actionModel.querySelector('#actionModelCompile').classList.add('d-none');
            actionModel.querySelector('#actionModelCompile').classList.remove('d-flex');
        }
        if (pageType.includes('gallery')) {
            actionModel.querySelector('#actionModelRotate').classList.remove('d-none');
            actionModel.querySelector('#actionModelRotate').classList.add('d-flex');
            actionModel.querySelector('#actionModelThumb').classList.remove('d-none');
            actionModel.querySelector('#actionModelThumb').classList.add('d-flex');
        } else {
            actionModel.querySelector('#actionModelRotate').classList.add('d-none');
            actionModel.querySelector('#actionModelRotate').classList.remove('d-flex');
            actionModel.querySelector('#actionModelThumb').classList.add('d-none');
            actionModel.querySelector('#actionModelThumb').classList.remove('d-flex');
        }
        $('#actionModel').modal('show');
    } else {
        $.snack('warning', `No Items Selected`, 1500);
    }
}
function selectedActionMenu(action) {
    if (postsActions.length > 0) {
        actionModel.querySelector('#finalButton').classList.remove('d-none');
        actionModel.querySelector('#selectedMenu').classList.add('d-none');
        actionModel.querySelector('#selectedAction').classList.remove('d-none');
        actionSelection = action;

        if (actionSelection === 'MovePost') {
            actionModel.querySelector("#ActionName").innerText = 'Move'
            actionModel.querySelector("#postID").innerText = `Move ${(postsActions.length > 1) ? postsActions.length + ' Items': postsActions[0].messageid}`
            actionModel.querySelector("#sectionMovePost").classList.remove("hidden")
            actionModel.querySelector('#sectionIcon i').classList.add('fa-cut')
        } else if (actionSelection === 'ArchivePost') {
            countdownTimer = 2;
            actionModel.querySelector("#ActionName").innerText = 'Archive'
            actionModel.querySelector("#postID").innerText = `Archive ${(postsActions.length > 1) ? postsActions.length + ' Items': postsActions[0].messageid}`
            actionModel.querySelector("#sectionArchivePost").classList.remove("hidden")
            actionModel.querySelector("#deleteButton").classList.remove("hidden")
            actionModel.querySelector('#sectionIcon i').classList.add('fa-archive')
        } else if (actionSelection === 'RotatePost') {
            actionModel.querySelector("#ActionName").innerText = 'Rotate'
            actionModel.querySelector("#postID").innerText = `Rotate ${(postsActions.length > 1) ? postsActions.length + ' Items': postsActions[0].messageid}`
            actionModel.querySelector("#sectionRotatePost").classList.remove("hidden")
            actionModel.querySelector('#sectionIcon i').classList.add('fa-undo')
        } else if (actionSelection === 'RenamePost') {
            actionModel.querySelector("#ActionName").innerText = 'Rename'
            actionModel.querySelector("#postID").innerText = `Rename ${(postsActions.length > 1) ? postsActions.length + ' Items': postsActions[0].messageid}`
            actionModel.querySelector("#sectionRenamePost").classList.remove("hidden")
            oldFileName = $(`#message-${postsActions[0].messageid}`)[0].querySelector('.align-middle').innerText
            actionModel.querySelector('#sectionIcon i').classList.add('fa-pencil-alt')
            actionModel.querySelector('#newName').value = oldFileName
        } else if (actionSelection === 'Report') {
            countdownTimer = 2;
            actionModel.querySelector("#ActionName").innerText = 'Clear'
            actionModel.querySelector("#postID").innerText = `Clear ${(postsActions.length > 1) ? postsActions.length + ' Items': postsActions[0].messageid}`
            actionModel.querySelector("#sectionArchivePost").classList.remove("hidden")
            actionModel.querySelector('#sectionIcon i').classList.add('fa-flag')
            actionModel.querySelector("#postButton").classList.remove("disabled");
        } else if (actionSelection === 'Thumbnail') {
            countdownTimer = 2;
            actionModel.querySelector("#ActionName").innerText = 'Generate'
            actionModel.querySelector("#postID").innerText = `Generate ${(postsActions.length > 1) ? postsActions.length + ' Items': postsActions[0].messageid} Thumbnail`
            actionModel.querySelector("#sectionGeneratePost").classList.remove("hidden")
            actionModel.querySelector('#sectionIcon i').classList.add('fa-image')
            actionModel.querySelector("#postButton").classList.remove("disabled");
        } else if (actionSelection === 'CompileSF') {
            actionModel.querySelector("#ActionName").innerText = 'Compile'
            actionModel.querySelector("#postID").innerText = `Compile ${(postsActions.length > 1) ? postsActions.length + ' Files': postsActions[0].messageid}`
            actionModel.querySelector("#sectionGeneratePost").classList.remove("hidden")
            actionModel.querySelector('#sectionIcon i').classList.add('fa-box-open')
            actionModel.querySelector("#postButton").classList.remove("disabled");
        }
        actionModel.querySelector('#selectedMenu').classList.add('d-none');
        actionModel.querySelector('#selectedAction').classList.remove('d-none');

        if (actionSelection !== 'MovePost' && actionSelection !== 'RenamePost' && actionSelection !== 'RotatePost') {
            try {
                if ((imageRotate === '' && actionSelection === 'RotatePost') || actionSelection !== 'RotatePost') {
                    actionModel.querySelector("#postButton").classList.add("disabled");
                } else {
                    actionModel.querySelector("#postButton").classList.remove("disabled");
                }
                actionModel.querySelector("#deleteButton").classList.add("disabled");
            } catch (e) {
                console.log(e);
            }
            window.setTimeout(buttonCountdown, 1000);
        }
    }
    return false;
}
// Multiple Post
function enableGallerySelect() {
    pageType = $.history.url().split('?')[0].substring(1)
    if (pageType.includes('gallery')) {
        [].forEach.call(document.getElementsByClassName('select-item'), function (el) {
            el.classList.remove("hidden");
        });
        [].forEach.call(document.getElementsByClassName('text-container'), function (el) {
            el.classList.add("hidden");
        });
        [].forEach.call(document.getElementsByClassName('image-container'), function (el) {
            el.classList.add("hidden");
        });
        [].forEach.call(document.getElementsByClassName('icon-container'), function (el) {
            el.classList.add("hidden");
        });
        [].forEach.call(document.getElementsByClassName('links-container'), function (el) {
            el.classList.add("hidden");
        });
        [].forEach.call(document.getElementsByClassName('internal-lightbox'), function (el) {
            el.style.display = "block";
            el.classList.add("no-bg");
        });
    } else if (pageType.includes('file') || pageType.includes('card')) {
        [].forEach.call(document.getElementsByClassName('file-tools'), function (el) {
            el.classList.add("hidden");
        });
        [].forEach.call(document.getElementsByClassName('file-select'), function (el) {
            el.classList.remove("hidden");
        });
    }
    document.getElementById('doneBtns').classList.remove("hidden")
    document.getElementById('editBtns').classList.add("hidden");
}
function disableGallerySelect() {
    pageType = $.history.url().split('?')[0].substring(1)
    modeSelection = 'none';
    if (pageType.includes('gallery')) {
        [].forEach.call(document.getElementsByClassName('select-item'), function (el) {
            el.classList.add("hidden");
        });
        [].forEach.call(document.getElementsByClassName('text-container'), function (el) {
            el.classList.remove("hidden");
        });
        [].forEach.call(document.getElementsByClassName('image-container'), function (el) {
            el.classList.remove("hidden");
        });
        [].forEach.call(document.getElementsByClassName('icon-container'), function (el) {
            el.classList.remove("hidden");
        });
        [].forEach.call(document.getElementsByClassName('links-container'), function (el) {
            el.classList.remove("hidden");
        });
        [].forEach.call(document.getElementsByClassName('internal-lightbox'), function (el) {
            el.removeAttribute("style", 'display')
            el.classList.remove("no-bg");
        });
        [].forEach.call(document.getElementsByClassName('select-item'), function (el) {
            el.querySelector('#checkItem').classList.remove('hidden')
            el.querySelector('#unCheckItem').classList.add('hidden')
        });
    } else if (pageType.includes('file') || pageType.includes('card')) {} {
        [].forEach.call(document.getElementsByClassName('file-tools'), function (el) {
            el.classList.remove("hidden");
        });
        [].forEach.call(document.getElementsByClassName('file-select'), function (el) {
            el.classList.add("hidden");
        });
        [].forEach.call(document.getElementsByClassName('file-select'), function (el) {
            el.querySelector('#checkItem').classList.remove('hidden');
            el.querySelector('#unCheckItem').classList.add('hidden');
        });
    }
    try {
        document.getElementById('editBtns').classList.remove("hidden");
        document.getElementById('doneBtns').classList.add("hidden");
    } catch (e) {
        console.log('Failed to reset button groups')
    }
}
function selectPostToMode(serverid, channelid, messageid, modeType, fileStatus) {
    pageType = $.history.url().split('?')[0].substring(1)

    if (postsActions.length === 0) {
        try {
            const _post = document.getElementById(`message-${messageid}`);
            const _movepostImage = actionModel.querySelector("#postImage");
            if (pageType.includes('gallery')) {
                _movepostImage.src = _post.querySelector('#postImage').style.backgroundImage.split('"')[1];
            } else if (pageType.includes('file')) {
                if (_post.querySelector('.preview-holder a div') !== null && _post.querySelector('.preview-holder a div').style) {
                    _movepostImage.src = _post.querySelector('.preview-holder a div').style.backgroundImage.split('"')[1]
                    actionModel.querySelector('#sectionIcon').classList.add('hidden')
                    actionModel.querySelector('#sectionImage').classList.remove('hidden')
                } else {
                    actionModel.querySelector('#sectionIcon').classList.remove('hidden')
                    actionModel.querySelector('#sectionImage').classList.add('hidden')
                }
            } else if (pageType.includes('card')) {
                if (_post.querySelector('.card-img') !== null && _post.querySelector('.card-img').src) {
                    _movepostImage.src = _post.querySelector('.card-img').src
                    actionModel.querySelector('#sectionIcon').classList.add('hidden')
                    actionModel.querySelector('#sectionImage').classList.remove('hidden')
                } else {
                    actionModel.querySelector('#sectionIcon').classList.remove('hidden')
                    actionModel.querySelector('#sectionImage').classList.add('hidden')
                }
            }
        } catch (e) {
            console.log('Can not reset post mode')
        }
    }
    if (postsActions.length >= 1) {
        postsActions.push({messageid: messageid, channelid: channelid, serverid: serverid, file: fileStatus});
    } else {
        postsActions = [
            {
                messageid: messageid,
                channelid: channelid,
                serverid: serverid,
                file: fileStatus
            }
        ]
    }

    if (modeType) {
        try {
            document.getElementById('message-' + messageid).querySelector('#checkItem').classList.add('hidden');
            document.getElementById('message-' + messageid).querySelector('#unCheckItem').classList.remove('hidden');
        } catch (e) {
            console.log('Failed to reset check buttons');
        }
        try {
            $('#deSelectAll1')[0].classList.remove('hidden');
            $('#deSelectAll2')[0].classList.remove('hidden');
        } catch (e) {
            console.log('Failed to reset selection button');
        }
    }
    return false;
}
function deselectPostToMode(messageid) {
    if (postsActions.length === 0) {
        clearactionModel();
    }
    postsActions = postsActions.filter(function (value) {
        return value.messageid !== messageid;
    });
    document.getElementById('message-' + messageid).querySelector('#unCheckItem').classList.add('hidden')
    document.getElementById('message-' + messageid).querySelector('#checkItem').classList.remove('hidden')
    return false;
}
// Select and Deselect All Posts
function selectAllPoststoMode() {
    const selectButtons = document.querySelectorAll('.selectPostToMode:not(.hidden)');
    selectButtons.forEach(div => { div.click(); });
    $('#selectAll1')[0].classList.add('hidden');
    $('#selectAll2')[0].classList.add('hidden');
    $('#deSelectAll1')[0].classList.remove('hidden');
    $('#deSelectAll2')[0].classList.remove('hidden');
}
function deselectAllPoststoMode() {
    const selectButtons = document.querySelectorAll('.deselectPostToMode:not(.hidden)');
    selectButtons.forEach(div => { div.click(); });
    $('#selectAll1')[0].classList.remove('hidden');
    $('#selectAll2')[0].classList.remove('hidden');
    $('#deSelectAll1')[0].classList.add('hidden');
    $('#deSelectAll2')[0].classList.add('hidden');
}

// Move Model Management
function selectedChannel(chid, chname) {
    actionModel.querySelector("#channelSelector").classList.remove('btn-secondary')
    actionModel.querySelector("#channelSelector").classList.add('btn-success')
    actionModel.querySelector("#selectedChannel").innerText = chname;
    if (_lastChannelSelection === '') {
        actionModel.querySelector("#destination-" + chid).classList.add('active')
    } else {
        actionModel.querySelector("#destination-" + _lastChannelSelection).classList.remove('active')
        actionModel.querySelector("#destination-" + chid).classList.add('active')
    }
    actionModel.querySelector("#postButton").classList.remove('disabled')
    _lastChannelSelection = chid
    postsDestination = chid;
    try {
        setCookie("postsDestination", chid);
        setCookie("lastpostsDestination", chid);
    } catch (e) {
        console.error("Failed to save cookie for destinations");
        console.error(e)
    }
    return false;
}
function selectedRotate(rotate) {
    actionModel.querySelector("#rotateSelector").classList.remove('btn-secondary')
    actionModel.querySelector("#rotateSelector").classList.add('btn-success')
    actionModel.querySelector("#selectedRotate").innerText = rotate;
    actionModel.querySelector("#postImage").style.transform = 'rotate(' + rotate + 'deg)';
    if (imageRotate === '') {
        actionModel.querySelector("#rotateImage" + rotate).classList.add('active')
    } else {
        actionModel.querySelector("#rotateImage" + imageRotate).classList.remove('active')
        actionModel.querySelector("#rotateImage" + rotate).classList.add('active')
    }
    actionModel.querySelector("#postButton").classList.remove('disabled')

    imageRotate = rotate;
    return false;
}
function clearactionModel() {
    countdownTimer = -1;
    disableGallerySelect();
    actionModel.querySelector("#postID").innerText = 'NaN';
    if (postsDestination === '') {
        actionModel.querySelector("#postButton").classList.add("disabled");
        actionModel.querySelector("#deleteButton").classList.add("disabled");
    }
    actionModel.querySelector("#deleteButton").classList.add("hidden");
    actionModel.querySelector("#CountDownTimer").innerText = "";
    actionModel.querySelector("#ActionName").innerText = "";
    actionModel.querySelector("#postImage").style.transform = 'rotate(0deg)';
    actionModel.querySelector("#sectionMovePost").classList.add("hidden");
    actionModel.querySelector("#sectionRotatePost").classList.add("hidden");
    actionModel.querySelector("#sectionArchivePost").classList.add("hidden");
    actionModel.querySelector("#sectionGeneratePost").classList.add("hidden");
    actionModel.querySelector("#sectionRenamePost").classList.add("hidden");
    actionModel.querySelector('#selectedMenu').classList.remove('d-none');
    actionModel.querySelector('#selectedAction').classList.add('d-none');
    actionModel.querySelector('#finalButton').classList.add('d-none');

    try {
        $('#selectAll1')[0].classList.remove('hidden');
        $('#selectAll2')[0].classList.remove('hidden');
        $('#deSelectAll1')[0].classList.add('hidden');
        $('#deSelectAll2')[0].classList.add('hidden');
    } catch (e) {
        console.log('Could not reset the selection buttons')
    }

    actionSelection = '';
    postsActions = [];
    modeSelection = 'none'
    return false;
}
function buttonCountdown () {
    if ($('#actionModel').is(':visible')) {
        timerText.innerText = ` (${countdownTimer})`;
        if (countdownTimer <= 0) {
            singlePostBtn.classList.remove("disabled");
            deletePostBtn.classList.remove("disabled");
            timerText.innerText = "";
        } else {
            window.setTimeout(buttonCountdown, 1000);
        }
        countdownTimer -= 1;
    } else {
        countdownTimer = 0;
    }
}

let lastMessageAlbum = undefined;
// Album Management
$('#albumItemModal').on('hidden.bs.modal', function (e) {
    lastMessageAlbum = undefined;
    $(`#albumItemBody`).html('<span>Please Wait...</span>');
})
function refreshAlbumsList(messageid) {
    if (messageid)
        lastMessageAlbum = messageid;
    $.ajax({async: true,
        url: `/albums?command=getAll${(lastMessageAlbum) ? '&messageid=' + lastMessageAlbum : '&manage=true'}`,
        type: "GET", data: '',
        processData: false,
        contentType: false,
        headers: {
            'X-Requested-With': 'SequenziaXHR'
        },
        success: function (response, textStatus, xhr) {
            if (xhr.status < 400) {
                $(`#albumItemBody`).html(response);
            } else {
                $(`#albumItemBody`).html('<span>Failed to get valid albums list via AJAX</span>');
            }
        },
        error: function (xhr) {
            $(`#albumItemBody`).html('<span>Failed to get albums list via AJAX</span>');
        }
    });
    $('#albumItemModal').modal('show');
}
function createNewAlbum() {
    const newAlbumNameText = document.querySelector("#albumNameText");
    const newAlbumTypeSelect = document.querySelector("#albumTypeSelect");
    const newAlbumPrivacySelect = document.querySelector("#albumPrivacySelect");
    if (newAlbumNameText.value.length > 1 && newAlbumNameText.value.trim().length > 1) {
        $.ajax({async: true,
            url: `/actions/v1`,
            type: "post",
            data: {
                'album_name': newAlbumNameText.value.trim(),
                'album_uri': newAlbumTypeSelect.value,
                'album_privacy': newAlbumPrivacySelect.value,
                'action': 'CollCreate'
            },
            cache: false,
            headers: {
                'X-Requested-With': 'SequenziaXHR'
            },
            success: function (response, textStatus, xhr) {
                if (xhr.status < 400) {
                    $(`#newAlbumForm`).collapse('hide');
                    refreshAlbumsList();
                    newAlbumNameText.value = '';
                } else {
                    $.toast({
                        type: 'error',
                        title: 'Failed to create album',
                        subtitle: 'Now',
                        content: `Server Error`,
                        delay: 5000,
                    });
                }
            },
            error: function (xhr) {
                $.toast({
                    type: 'error',
                    title: 'Failed to create album',
                    subtitle: 'Now',
                    content: `${xhr.responseText}`,
                    delay: 5000,
                });
            }
        })
    } else {
        $.snack('error', `Album name must contain text`, 1500);
    }
}
function updateAlbum(aid) {
    try {
        const albumName = document.querySelector(`#album-${aid}-Text`).value;
        const albumType = document.querySelector(`#album-${aid}-Type`).value;
        const albumPrivacy = document.querySelector(`#album-${aid}-Privacy`).value;
        if (albumName.length > 1 && albumName.trim().length > 1) {
            $.ajax({async: true,
                url: `/actions/v1`,
                type: "post",
                data: {
                    'albumid': aid,
                    'album_name': albumName,
                    'album_uri': albumType,
                    'album_privacy': albumPrivacy,
                    'action': 'CollUpdate'
                },
                cache: false,
                headers: {
                    'X-Requested-With': 'SequenziaXHR'
                },
                success: function (response, textStatus, xhr) {
                    if (xhr.status < 400) {
                        refreshAlbumsList();
                    } else {
                        $.toast({
                            type: 'error',
                            title: 'Failed to update album',
                            subtitle: 'Now',
                            content: `Failed to update album due to an error`,
                            delay: 5000,
                        });
                    }
                },
                error: function (xhr) {
                    $.toast({
                        type: 'error',
                        title: 'Failed to update album',
                        subtitle: 'Now',
                        content: `Server Error: ${xhr.responseText}`,
                        delay: 5000,
                    });
                }
            })
        } else {
            $.snack('error', `Album name must contain text`, 1500);
        }
    } catch (e) {
        $.toast({
            type: 'error',
            title: 'Failed update album',
            subtitle: 'Now',
            content: `Client Error: ${e.message}`,
            delay: 5000,
        });
    }
}
function deleteAlbum(aid) {
    try {
        $.ajax({async: true,
            url: `/actions/v1`,
            type: "post",
            data: {
                'albumid': aid,
                'action': 'CollDelete'
            },
            cache: false,
            headers: {
                'X-Requested-With': 'SequenziaXHR'
            },
            success: function (response, textStatus, xhr) {
                if (xhr.status < 400) {
                    refreshAlbumsList();
                } else {
                    $.toast({
                        type: 'error',
                        title: 'Failed to delete album',
                        subtitle: 'Now',
                        content: `Failed to delete album due to an error`,
                        delay: 5000,
                    });
                }
            },
            error: function (xhr) {
                $.toast({
                    type: 'error',
                    title: 'Failed to delete album',
                    subtitle: 'Now',
                    content: `Does not exist`,
                    delay: 5000,
                });
            }
        })
    } catch (e) {
        $.toast({
            type: 'error',
            title: 'Failed to delete album',
            subtitle: 'Now',
            content: `Client Error: ${e.message}`,
            delay: 5000,
        });
    }
}
function toggleAlbumItem(aid, eid) {
    bypassSidebarRefresh = true;
    $.ajax({async: true,
        url: `/actions/v1`,
        type: "post",
        data: {
            'albumid': aid,
            'messageid': eid,
            'action': 'CollItemToggle'
        },
        cache: false,
        headers: {
            'X-Requested-With': 'SequenziaXHR'
        },
        success: function (response, textStatus, xhr) {
            if (xhr.status < 400) {
                $(`#albumItemModal`).modal('hide');
            } else {
                $(`#albumItemModal`).modal('hide');
                $.toast({
                    type: 'error',
                    title: 'Failed to manage album',
                    subtitle: 'Now',
                    content: `Failed to add manage album due to error`,
                    delay: 5000,
                });
            }
        },
        error: function (xhr) {
            $(`#albumItemModal`).modal('hide');
            $.toast({
                type: 'error',
                title: 'Failed to manage album',
                subtitle: 'Now',
                content: `Server Error: ${xhr.responseText}`,
                delay: 5000,
            });
        }
    });
}

// Channel Visibility Management
function recalculateChannelFilter() {
    const _i = document.getElementById('hiddenChannelModel').querySelectorAll('div.dropdown-menu > .dropdown-item > i.fas.fa-minus-circle').length;
    const _t = document.getElementById('disabledChannelsCount').innerText = _i.toString();
}
function toggleChannelFilter(e) {
    const _s = document.getElementById('chFilter-' + e);
    const _i = _s.querySelector('i');
    const _u = _s.classList;
    if (_i.classList.contains('fa-minus-circle')) {
        _i.classList.remove('fa-minus-circle');
        _u.remove('text-danger');
        _u.add('text-success');
    } else {
        _i.classList.add('fa-minus-circle');
        _u.add('text-danger');
        _u.remove('text-success');    }
    recalculateChannelFilter();
}
function sendChannelFilter() {
    const _v = [...document.getElementById('hiddenChannelModel').querySelectorAll('div.dropdown-menu > .dropdown-item')].filter(e => e.querySelector('i.fas.fa-minus-circle')).map(f => f.id.split('-').pop())
    const postData = {
        disabled_channels: _v
    }
    $('#hiddenChannelModel').modal('hide');
    $.ajax({
        async: true,
        url: '/discord/persistent/settings',
        type: "POST",
        processData: false,
        contentType: 'application/json',
        dataType: 'json',
        data: JSON.stringify(postData),
        headers: {
            'X-Requested-With': 'SequenziaXHR'
        },
        success: function () {
            $.snack('success', `Now Hiding ${_v.length} Channels from Results`, 5000);
        },
        error: function () {
            $.snack('error',"Settings Upload Failed", 5000);
        }
    });
}
function toggleVChannelFilter(e) {
    document.getElementById('hiddenChannelModel').querySelectorAll('.vcid-' + e).forEach(f => toggleChannelFilter(f.id.split('-')[1]));

}
function cancelChannelFilter() {
    recalculateChannelFilter();
}