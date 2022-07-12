// Server Manager Code
let countdownTimer = 2;
let modeSelection = '';
let actionSelection = '';
let imageRotate = '';
let newFileName = '';
let oldFileName = '';
let newContents = '';
let oldContents = '';

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
// Contents Update
function updateTextContents(obj) {
    newContents = obj.value;
    if (newContents.length <= 2000 && newContents !== oldContents ) {
        singlePostBtn.classList.remove("disabled");
    } else {
        newContents = '';
        singlePostBtn.classList.add("disabled");
    }
}

// Post Mangement
function proccessPost(alt) {
    if (!inReviewMode)
        disableGallerySelect();
    $('#actionModel').modal('hide');
    if (actionSelection !== '' && postsActions.length > 0) {
        postsActions.forEach((post, i, a) => {
            let confirm = true;
            if (a.length !== 1 && i + 1 !== a.length) {
                confirm = false
            }
            if (actionSelection === 'CompileSF' || actionSelection === 'DecompileSF') {
                if (post.file !== undefined) {
                    sendDownloadRequest(post.serverid, post.channelid, post.messageid, !(postsActions.filter(e => e.file !== undefined).length > 1), (actionSelection === 'CompileSF'));
                }
                if (confirm) {
                    postsActions = [];
                    $.snack('success', `Requested to ${(actionSelection === 'CompileSF') ? 'Generate' : 'Remove'} Cache ${(postsActions.length > 1) ? postsActions.filter(e => e.file !== undefined).length + " Files" : "File"}`, 5000)
                }
            } else if (actionSelection === 'Report' || actionSelection === 'RemoveReport') {
                if (alt) {
                    sendBasic(post.channelid, post.messageid, alt, confirm);
                } else {
                    sendBasic(post.channelid, post.messageid, actionSelection, confirm);
                }
            } else {
                let data = undefined
                if (actionSelection === 'RenamePost') { data = newFileName  } else if (actionSelection === 'EditTextPost') { data = newContents  } else if (actionSelection === 'RotatePost') { data = imageRotate } else if (actionSelection === 'MovePost') { data = postsDestination } else { data = null }
                if (actionSelection === 'MovePost' || actionSelection === 'RemovePost' || actionSelection === 'ArchivePost') {
                    document.getElementById(`message-${post.messageid}`).classList.add('hidden')
                }
                queueAction(post.serverid, post.channelid, post.messageid, (alt) ? alt : actionSelection, data)
            }
        })
    };
    shiftRecentPostDestinations();
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
        const fileCompileable = postsActions.filter(e => e.file !== undefined)
        if (fileCompileable.length > 0) {
            actionModel.querySelector('#actionModelCompile').classList.remove('d-none');
            actionModel.querySelector('#actionModelCompile').classList.add('d-flex');
            actionModel.querySelector('#actionModelDeCompile').classList.remove('d-none');
            actionModel.querySelector('#actionModelDeCompile').classList.add('d-flex');
        } else {
            actionModel.querySelector('#actionModelCompile').classList.add('d-none');
            actionModel.querySelector('#actionModelCompile').classList.remove('d-flex');
            actionModel.querySelector('#actionModelDeCompile').classList.add('d-none');
            actionModel.querySelector('#actionModelDeCompile').classList.remove('d-flex');
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
        updateRecentPostDestinations();
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
            actionModel.querySelector("#sectionMovePostRecents").classList.remove("hidden")
            actionModel.querySelector('#sectionIcon i').classList.add('fa-cut')
        } else if (actionSelection === 'EditTextPost') {
            actionModel.querySelector("#ActionName").innerText = 'Edit Contents'
            actionModel.querySelector("#postID").innerText = `Edit ${(postsActions.length > 1) ? postsActions.length + ' Items': postsActions[0].messageid}`
            oldContents = document.getElementById(`message-${postsActions[0].messageid}`).getAttribute('data-msg-bodyraw');
            oldContents = oldContents.split('<br/>')
            if (oldContents[0].includes('**🧩 File'))
                oldContents = oldContents.slice(2)
            oldContents = oldContents.join('\n')
            actionModel.querySelector('#newContents').value = oldContents
            actionModel.querySelector('#sectionIcon i').classList.add('fa-pen-line')
            actionModel.querySelector("#sectionEditPost").classList.remove("hidden")
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
            oldFileName = document.getElementById(`message-${postsActions[0].messageid}`).getAttribute('data-msg-filename');
            actionModel.querySelector('#sectionIcon i').classList.add('fa-pencil-alt')
            actionModel.querySelector('#newName').value = oldFileName
        } else if (actionSelection === 'RemoveReport') {
            countdownTimer = 2;
            actionModel.querySelector("#ActionName").innerText = 'Clear'
            actionModel.querySelector("#postID").innerText = `Clear ${(postsActions.length > 1) ? postsActions.length + ' Items': postsActions[0].messageid}`
            actionModel.querySelector("#sectionReportPost").classList.remove("hidden")
            actionModel.querySelector('#sectionIcon i').classList.add('fa-flag')
            actionModel.querySelector("#postButton").classList.remove("disabled");
        } else if (actionSelection === 'Thumbnail' || actionSelection === 'VideoThumbnail') {
            countdownTimer = 2;
            actionModel.querySelector("#ActionName").innerText = 'Generate'
            actionModel.querySelector("#postID").innerText = `Generate ${(postsActions.length > 1) ? postsActions.length + ' Items': postsActions[0].messageid} Thumbnail`
            actionModel.querySelector("#sectionGeneratePost").classList.remove("hidden")
            actionModel.querySelector('#sectionIcon i').classList.add('fa-image')
            actionModel.querySelector("#postButton").classList.remove("disabled");
        } else if (actionSelection === 'CompileSF') {
            actionModel.querySelector("#ActionName").innerText = 'Compile'
            actionModel.querySelector("#postID").innerText = `Compile Fast Access Cache ${(postsActions.length > 1) ? postsActions.length + ' Files': postsActions[0].messageid}`
            actionModel.querySelector("#sectionGeneratePost").classList.remove("hidden")
            actionModel.querySelector('#sectionIcon i').classList.add('fa-cloud-check')
            actionModel.querySelector("#postButton").classList.remove("disabled");
        } else if (actionSelection === 'DecompileSF') {
            actionModel.querySelector("#ActionName").innerText = 'Remove'
            actionModel.querySelector("#postID").innerText = `Remove Cache ${(postsActions.length > 1) ? postsActions.length + ' Files': postsActions[0].messageid}`
            actionModel.querySelector("#sectionGeneratePost").classList.remove("hidden")
            actionModel.querySelector('#sectionIcon i').classList.add('fa-cloud-xmark')
            actionModel.querySelector("#postButton").classList.remove("disabled");
        }
        actionModel.querySelector('#selectedMenu').classList.add('d-none');
        actionModel.querySelector('#selectedAction').classList.remove('d-none');

        if (actionSelection !== 'MovePost' && actionSelection !== 'RenamePost' && actionSelection !== 'EditTextPost' && actionSelection !== 'RotatePost') {
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
        $('#actionModel').modal('show');
    }
    return false;
}
// Multiple Post
function enableGallerySelect() {
    pageType = $.history.url().split('?')[0].substring(1)
    if (pageType.includes('gallery')) {
        $('.select-panel').collapse('show');
        [].forEach.call(document.getElementsByClassName('overlay-icons'), function (el) {
            el.classList.add("hidden");
        });
        [].forEach.call(document.getElementsByClassName('internal-lightbox'), function (el) {
            el.style.display = "block";
            el.classList.add("no-bg");
        });
        [].forEach.call(document.getElementsByClassName('lightbox'), function (el) {
            el.classList.add("disabled-pointer");
            el.querySelector('#postImage').classList.add("show-full");
        });
    } else if (pageType.includes('file') || pageType.includes('card')) {
        [].forEach.call(document.getElementsByClassName('file-tools'), function (el) {
            el.classList.add("hidden");
        });
        [].forEach.call(document.getElementsByClassName('file-select'), function (el) {
            el.classList.remove("hidden");
        });
    }
    try {
        $('.done-btns').removeClass("hidden");
        $('.edit-btns').addClass("hidden");
    } catch (e) {
        console.log('Failed to set button groups')
    }
}
function disableGallerySelect() {
    pageType = $.history.url().split('?')[0].substring(1)
    modeSelection = 'none';
    if (pageType.includes('gallery')) {
        $('.main-panel').collapse('show');
        [].forEach.call(document.getElementsByClassName('overlay-icons'), function (el) {
            el.classList.remove("hidden");
        });
        [].forEach.call(document.getElementsByClassName('internal-lightbox'), function (el) {
            el.removeAttribute("style", 'display')
            el.classList.remove("no-bg");
        });
        [].forEach.call(document.getElementsByClassName('lightbox'), function (el) {
            el.classList.remove("disabled-pointer");
            el.querySelector('#postImage').classList.remove("show-full");
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
        $('.done-btns').addClass("hidden");
        $('.edit-btns').removeClass("hidden");
    } catch (e) {
        console.log('Failed to reset button groups')
    }
}
function selectPostToMode(messageid, modeType) {
    const _post = document.getElementById(`message-${messageid}`);
    const channelid = _post.getAttribute('data-msg-channel');
    const serverid = _post.getAttribute('data-msg-server');
    const _fileStatus = _post.getAttribute('data-msg-fileid');
    const fileStatus = (_fileStatus && _fileStatus.length > 5) ? _fileStatus : undefined
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
    $('#deSelectAll1')[0].classList.remove('hidden');
}
function deselectAllPoststoMode() {
    const selectButtons = document.querySelectorAll('.deselectPostToMode:not(.hidden)');
    selectButtons.forEach(div => { div.click(); });
    $('#selectAll1')[0].classList.remove('hidden');
    $('#deSelectAll1')[0].classList.add('hidden');
}

// Fast Review
function setupReviewMode(bypass) {
    if (reviewDestination !== '') {
        setupReviewModel.querySelector("#destination-" + reviewDestination).classList.add('active')
        setupReviewModel.querySelector("#channelSelector").classList.remove('btn-secondary')
        setupReviewModel.querySelector("#channelSelector").classList.add('btn-success')
        setupReviewModel.querySelector("#selectedChannel").innerText = setupReviewModel.querySelector("#destination-" + reviewDestination).getAttribute('data-ch-name')
    }
    const cleanURL = params(['nsfwEnable', 'pageinatorEnable', 'limit', 'responseType', 'key', 'blind_key', 'nsfw', 'offset', 'sort', 'search', 'color', 'date', 'displayname', 'history', 'pins', 'cached', 'history_screen', 'newest', 'displaySlave', 'flagged', 'datestart', 'dateend', 'history_numdays', 'fav_numdays', 'numdays', 'ratio', 'minres', 'dark', 'filesonly', 'nocds', 'setscreen', 'screen', 'nohistory', 'reqCount'], [])
    if (!bypass && reviewDestinationMap[`${encodeURIComponent(cleanURL)}`] !== undefined) {
        enableReviewMode();
    } else {
        //recentDestionations
        inReviewMode = false;
        const rdest = recentReviewDestination.filter(e => e.length > 1 && !isNaN(parseInt(e)) && setupReviewModel.querySelector("#destination-" + e)).map(e => {
            const n = setupReviewModel.querySelector("#destination-" + e).getAttribute('data-ch-name')
            if (n) {
                return `<div class="btn btn-info mr-1 mb-1" href="#" style="background-color: ${n.toRGB()}" onclick="setReviewChannel('${e}'); enableReviewMode(true); return false">` +
                `    <span>${n}</span>` +
                `</div>`
            }
            return ''
        }).join('\n')
        setupReviewModel.querySelector('#recentDestionations').innerHTML = (rdest.length > 0) ? rdest : '<span>No Recents</span>'
        $('#setupReviewModel').modal('show');
    }
    return false;
}
function enableReviewMode(setFromDialog) {
    const cleanURL = params(['nsfwEnable', 'pageinatorEnable', 'limit', 'responseType', 'key', 'blind_key', 'nsfw', 'offset', 'sort', 'search', 'color', 'date', 'displayname', 'history', 'cached', 'pins', 'history_screen', 'newest', 'displaySlave', 'flagged', 'datestart', 'dateend', 'history_numdays', 'fav_numdays', 'numdays', 'ratio', 'minres', 'dark', 'filesonly', 'nocds', 'setscreen', 'screen', 'nohistory', 'reqCount'], [])
    if (reviewDestinationMap[`${encodeURIComponent(cleanURL)}`])
        setReviewChannel(reviewDestinationMap[`${encodeURIComponent(cleanURL)}`], true);
    if (reviewDestination && reviewDestination.length > 1) {
        if (setFromDialog) {
            try {
                if (recentReviewDestination.indexOf(reviewDestination) !== -1) {
                    recentReviewDestination.sort(function(x,y){ return x == reviewDestination ? -1 : y == reviewDestination ? 1 : 0; });
                } else {
                    recentReviewDestination.unshift(reviewDestination)
                }
                recentReviewDestination = recentReviewDestination.slice(0,5).filter(e => e.length > 8)
                setCookie('recentReviewDestination', JSON.stringify(recentReviewDestination));
            } catch (e) {
                console.error("Failed to save recent destinations")
                console.error(e)
            }
        }
        inReviewMode = true;
        pageType = $.history.url().split('?')[0].substring(1)
        if (pageType.includes('gallery')) {
            $('.review-item-panel').collapse('show');
            [].forEach.call(document.getElementsByClassName('overlay-icons'), function (el) {
                el.classList.add("hidden");
            });
            [].forEach.call(document.getElementsByClassName('internal-lightbox'), function (el) {
                el.style.display = "block";
                el.classList.add("no-bg");
            });
            [].forEach.call(document.getElementsByClassName('lightbox'), function (el) {
                el.classList.add("disabled-pointer");
                el.querySelector('#postImage').classList.add("show-full");
            });
        } else if (pageType.includes('file') || pageType.includes('card')) {
            [].forEach.call(document.getElementsByClassName('file-tools'), function (el) {
                el.classList.add("hidden");
            });
            [].forEach.call(document.getElementsByClassName('file-select'), function (el) {
                el.classList.add("hidden");
            });
        }
        $('.edit-btns').removeClass("hidden");
        $('.done-btns').addClass("hidden");
        $('.hide-review').addClass("hidden");
        document.getElementById("reviewDestinationName").innerText = setupReviewModel.querySelector("#selectedChannel").innerText;
        document.getElementById('reviewBtns').classList.remove("hidden");
        $('#setupReviewModel').modal('hide');
    } else {
        setupReviewMode(true);
    }
    return false;
}
function disableReviewMode() {
    inReviewMode = false;
    pageType = $.history.url().split('?')[0].substring(1)
    modeSelection = 'none';
    if (pageType.includes('gallery')) {
        $('.main-panel').collapse('show');
        [].forEach.call(document.getElementsByClassName('overlay-icons'), function (el) {
            el.classList.remove("hidden");
        });
        [].forEach.call(document.getElementsByClassName('internal-lightbox'), function (el) {
            el.removeAttribute("style", 'display')
            el.classList.remove("no-bg");
        });
        [].forEach.call(document.getElementsByClassName('lightbox'), function (el) {
            el.classList.remove("disabled-pointer");
            el.querySelector('#postImage').classList.remove("show-full");
        });
    } else if (pageType.includes('file') || pageType.includes('card')) {} {
        [].forEach.call(document.getElementsByClassName('file-tools'), function (el) {
            el.classList.remove("hidden");
        });
        [].forEach.call(document.getElementsByClassName('file-select'), function (el) {
            el.classList.add("hidden");
        });
    }
    try {
        $('.hide-review').removeClass("hidden");
        $('.edit-btns').removeClass("hidden");
        $('.done-btns').addClass("hidden");
        document.getElementById('reviewBtns').classList.add("hidden");
    } catch (e) {
        console.log('Failed to reset button groups')
    }
}
function acceptItem(serverid, channelid, messageid, direct, fileStatus) {
    if (reviewDestination && reviewDestination.length > 1) {
        pageType = $.history.url().split('?')[0].substring(1)
        if (direct) {
            document.getElementById(`message-${messageid}`).classList.add('hidden')
            queueAction(serverid, channelid, messageid, 'MovePost', reviewDestination, true)
        } else {
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
            postsActions = [
                {
                    messageid: messageid,
                    channelid: channelid,
                    serverid: serverid,
                    file: fileStatus
                }
            ]
            updateRecentPostDestinations();
            selectedActionMenu("MovePost");
            $('#actionModel').modal('show');
        }
    }
    return false;
}
function exitPanel(messageid) {
    if (inReviewMode) {
        $(`#imageFastReview-${messageid}`).collapse('show');
    } else {
        $(`#imageCover-${messageid}`).collapse('show');
    }
    return false;
}
function acceptMenu(serverid, channelid, messageid, fileStatus) {
    if (recentPostDestination && recentPostDestination.length > 0) {
        const destinationMenu = document.getElementById(`imageMove-${messageid}`).querySelector('.move-content')
        let rdest = recentPostDestination.filter(e => e.length > 1 && !isNaN(parseInt(e)) && actionModel.querySelector("#destination-" + e)).map(e => {
            const n = actionModel.querySelector("#destination-" + e).getAttribute('data-ch-name')
            if (n) {
                return `<li class="list-group-item p-2" href="#" style="font-size: small; background-color: ${n.toRGB()}" onclick="queueAction('${serverid}', '${channelid}', '${messageid}', 'MovePost', '${e}'); document.getElementById('message-${messageid}').classList.add('hidden'); shiftRecentPostDestinations(); return false">` +
                    `    <span style="">${n}</span>` +
                    `</li>`
            }

        })
        if (rdest.length > 0) {
            destinationMenu.innerHTML = ['<div class="card"><ul class="list-group list-group-flush" style="overflow-y: scroll;">', ...rdest, '</ul></div>'].join('\n')
            $(`#imageMove-${messageid}`).collapse('show');
        } else {
            acceptItem(serverid, channelid, messageid, false, fileStatus);
        }
    } else {
        acceptItem(serverid, channelid, messageid, false, fileStatus);
    }
    return false;
}
function rejectItem(serverid, channelid, messageid) {
    document.getElementById(`message-${messageid}`).classList.add('hidden');
    queueAction(serverid, channelid, messageid, 'RemovePost', null, true);
    return false;
}
function rejectAllItems(direction, id) {
    let pageItems = Array.from(document.querySelectorAll('[data-msg-id].col-image:not(.hidden)'))
    switch (direction) {
        case 1:
            if (id) {
                const index = pageItems.map(e => e.id).indexOf(`message-${id}`)
                pageItems = pageItems.slice(index)
            } else {
                pageItems = []
            }
            break;
        case 2:
            if (id) {
                const index = pageItems.map(e => e.id).indexOf(`message-${id}`)
                pageItems = pageItems.slice(0, index + 1)
            } else {
                pageItems = []
            }
            break;
        default:
            break;
    }
    //document.querySelector('#LoadNextPage > div').click();
    if (reviewDestination && reviewDestination.length > 1) {
        let itemCount = [];
        pageItems.forEach(el => {
            const serverid = el.getAttribute('data-msg-server')
            const channelid = el.getAttribute('data-msg-channel')
            const messageid = el.getAttribute('data-msg-id')
            if (serverid && channelid && messageid) {
                document.getElementById(`message-${messageid}`).classList.add('hidden');
                queueAction(serverid, channelid, messageid, 'RemovePost', null, true, true);
                itemCount.push(messageid)
            }
        })
        undoActions.push(itemCount);
    }
    return false;
}
function acceptAllItems(direction, id) {
    let pageItems = Array.from(document.querySelectorAll('[data-msg-id].col-image:not(.hidden)'))
    switch (direction) {
        case 1:
            if (id) {
                const index = pageItems.map(e => e.id).indexOf(`message-${id}`)
                pageItems = pageItems.slice(index)
            } else {
                pageItems = []
            }
            break;
        case 2:
            if (id) {
                const index = pageItems.map(e => e.id).indexOf(`message-${id}`)
                pageItems = pageItems.slice(0, index + 1)
            } else {
                pageItems = []
            }
            break;
        default:
            break;
    }
    //document.querySelector('#LoadNextPage > div').click();
    if (reviewDestination && reviewDestination.length > 1) {
        let itemCount = [];
        pageItems.forEach(el => {
            const serverid = el.getAttribute('data-msg-server')
            const channelid = el.getAttribute('data-msg-channel')
            const messageid = el.getAttribute('data-msg-id')
            if (serverid && channelid && messageid) {
                document.getElementById(`message-${messageid}`).classList.add('hidden');
                queueAction(serverid, channelid, messageid, 'MovePost', reviewDestination, true, true);
                itemCount.push(messageid)
            }
        })
        undoActions.push(itemCount);
    }
    return false;
}
function moveAllItems() {
    if (postsDestination !== '') {
        actionModel.querySelector("#destination-" + postsDestination).classList.add('active')
        actionModel.querySelector("#channelSelector").classList.remove('btn-secondary')
        actionModel.querySelector("#channelSelector").classList.add('btn-success')
        actionModel.querySelector("#selectedChannel").innerText = actionModel.querySelector("#destination-" + postsDestination).getAttribute('data-ch-name')
    }
    if (reviewDestination && reviewDestination.length > 1) {
        const pageItems = document.querySelectorAll('[data-msg-id].col-image:not(.hidden)');
        //document.querySelector('#LoadNextPage > div').click();
        postsActions = [];
        [].forEach.call(pageItems, function (el) {
            const serverid = el.getAttribute('data-msg-server')
            const channelid = el.getAttribute('data-msg-channel')
            const messageid = el.getAttribute('data-msg-id')
            if (serverid && channelid && messageid) {
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
                postsActions.push({messageid: messageid, channelid: channelid, serverid: serverid, file: fileStatus});
            }
        });
        updateRecentPostDestinations();
        selectedActionMenu("MovePost");
        $('#actionModel').modal('show');
    }
    return false;
}
function setReviewChannel(chid, noSave) {
    const chname = setupReviewModel.querySelector("#destination-" + chid).getAttribute('data-ch-name')
    setupReviewModel.querySelector("#channelSelector").classList.remove('btn-secondary')
    setupReviewModel.querySelector("#channelSelector").classList.add('btn-success')
    setupReviewModel.querySelector("#selectedChannel").innerText = chname;
    if (_lastReviewChannelSelection === '') {
        setupReviewModel.querySelector("#destination-" + chid).classList.add('active')
    } else {
        setupReviewModel.querySelector("#destination-" + _lastReviewChannelSelection).classList.remove('active')
        setupReviewModel.querySelector("#destination-" + chid).classList.add('active')
    }
    setupReviewModel.querySelector("#postButton").classList.remove('disabled')
    _lastReviewChannelSelection = chid
    reviewDestination = chid;
    try {
        setCookie("reviewDestination", chid);
        setCookie("lastReviewDestination", chid);
    } catch (e) {
        console.error("Failed to save cookie for destinations");
        console.error(e)
    }
    if (!noSave) {
        try {
            const cleanURL = params(['nsfwEnable', 'pageinatorEnable', 'limit', 'responseType', 'key', 'blind_key', 'nsfw', 'offset', 'sort', 'search', 'color', 'date', 'displayname', 'history', 'cached', 'pins', 'history_screen', 'newest', 'displaySlave', 'flagged', 'datestart', 'dateend', 'history_numdays', 'fav_numdays', 'numdays', 'ratio', 'minres', 'dark', 'filesonly', 'nocds', 'setscreen', 'screen', 'nohistory', 'reqCount'], [])
            reviewDestinationMap[`${encodeURIComponent(cleanURL)}`] = chid
            setCookie('reviewDestinationMap', JSON.stringify(reviewDestinationMap));
        } catch (e) {
            console.error(e)
            console.error('Failed to save review destination map')
        }
    }
    return false;
}

// Move Model Management
function updateRecentPostDestinations() {
    let rdest = recentPostDestination.filter(e => e.length > 1 && !isNaN(parseInt(e)) && actionModel.querySelector("#destination-" + e)).map(e => {
        const n = actionModel.querySelector("#destination-" + e).getAttribute('data-ch-name')
        if (n) {
            return `<div class="btn btn-info mr-1 mb-1" href="#" style="background-color: ${n.toRGB()}" onclick="selectedChannel('${e}'); proccessPost(); return false">` +
                `    <span>${n}</span>` +
                `</div>`
        }
    }).join('\n')
    actionModel.querySelector('#recentDestionations').innerHTML = (rdest.length > 0) ? rdest : '<span>No Recents</span>'
}
function shiftRecentPostDestinations() {
    try {
        if (recentPostDestination.indexOf(postsDestination) !== -1) {
            recentPostDestination.sort(function (x, y) {
                return x == postsDestination ? -1 : y == postsDestination ? 1 : 0;
            });
        } else {
            recentPostDestination.unshift(postsDestination)
        }
        recentPostDestination = recentPostDestination.slice(0,10).filter(e => e.length > 8)
        setCookie('recentPostDestination', JSON.stringify(recentPostDestination));
    } catch (e) {
        console.error("Failed to save recent destinations")
        console.error(e)
    }
}
function selectedChannel(chid) {
    const chname = actionModel.querySelector("#destination-" + chid).getAttribute('data-ch-name')
    actionModel.querySelector("#channelSelector").classList.remove('btn-secondary')
    actionModel.querySelector("#channelSelector").style.backgroundColor = chname.toRGB();
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
    if (!inReviewMode)
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
    actionModel.querySelector("#sectionEditPost").classList.add("hidden");
    actionModel.querySelector("#sectionMovePost").classList.add("hidden");
    actionModel.querySelector("#sectionMovePostRecents").classList.add("hidden");
    actionModel.querySelector("#sectionRotatePost").classList.add("hidden");
    actionModel.querySelector("#sectionArchivePost").classList.add("hidden");
    actionModel.querySelector("#sectionGeneratePost").classList.add("hidden");
    actionModel.querySelector("#sectionReportPost").classList.add("hidden");
    actionModel.querySelector("#sectionRenamePost").classList.add("hidden");
    actionModel.querySelector('#selectedMenu').classList.remove('d-none');
    actionModel.querySelector('#selectedAction').classList.add('d-none');
    actionModel.querySelector('#finalButton').classList.add('d-none');

    try {
        $('#selectAll1')[0].classList.remove('hidden');
        $('#deSelectAll1')[0].classList.add('hidden');
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
function getAlbumDirectory() {
    $.ajax({async: true,
        url: `/albums?command=getDirectory`,
        type: "GET", data: '',
        processData: false,
        contentType: false,
        headers: {
            'X-Requested-With': 'SequenziaXHR'
        },
        success: function (response, textStatus, xhr) {
            if (xhr.status < 400) {
                $(`#albumDirectoryBody`).html(response);
            } else {
                $(`#albumDirectoryBody`).html('<span>Failed to get valid albums list via AJAX</span>');
            }
        },
        error: function (xhr) {
            $(`#albumDirectoryBody`).html('<span>Failed to get albums list via AJAX</span>');
        }
    });
    $('#albumDirectoryModal').modal('show');
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
                    getSidebar(true);
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
                        getSidebar(true);
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
                    getSidebar(true);
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
