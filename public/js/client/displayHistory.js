function getDisplayHistory(command) {
    $.ajax({async: true,
        url: `/ambient-history?${command}`,
        type: "GET", data: '',
        processData: false,
        contentType: false,
        headers: {
            'X-Requested-With': 'SequenziaXHR'
        },
        success: function (response, textStatus, xhr) {
            if (xhr.status < 400) {
                $('#displayHistoryBody').html(response);
            } else {
                $('#displayHistoryBody').html('<span>Failed to get valid history via AJAX</span>');
            }
        },
        error: function (xhr) {
            $('#displayHistoryBody').html('<span>Failed to get history via AJAX</span>');
        }
    });
}
function getDisplayConfig(name, index) {
    $.ajax({async: true,
        url: `/ambient-history?command=getConfig&displayname=${name}`,
        type: "GET", data: '',
        processData: false,
        contentType: false,
        headers: {
            'X-Requested-With': 'SequenziaXHR'
        },
        success: function (response, textStatus, xhr) {
            if (xhr.status < 400) {
                $(`#settings-${index}-body`).html(response);
            } else {
                $(`#settings-${index}-body`).html('<span>Failed to get display settings via AJAX</span>');
            }
        },
        error: function (xhr) {
            $(`#settings-${index}-body`).html('<span>Failed to get display settings via AJAX</span>');
        }
    });
}

function showDisplayHistory() {
    getDisplayHistory("command=getAll");
    $('#displayHistoryModal').modal('show');
}
function toggleHistoryViewOption(item) {
    if (item.classList.contains('btn-danger')) {
        item.classList.add('btn-success')
        item.classList.remove('btn-danger')
        item.querySelector('i').classList.add('fa-eye')
        item.querySelector('i').classList.remove('fa-eye-slash')
    } else {
        item.classList.add('btn-danger')
        item.classList.remove('btn-success')
        item.querySelector('i').classList.add('fa-eye-slash')
        item.querySelector('i').classList.remove('fa-eye')
    }
}

function saveDisplayConfig(name, index) {
    const setthingsForm = document.getElementById(`settings-${index}-body`)
    let results = {};
    let requestOptions = new URLSearchParams();
    if (!name.startsWith('ADS') && setthingsForm.querySelector('#optionsDisplayOptsInput').value.length > 3) {
        requestOptions = new URLSearchParams(setthingsForm.querySelector('#optionsDisplayOptsInput').value);
        console.log(requestOptions.toString());
    }

    results.showHistory = (setthingsForm.querySelector('#optionsShowInHistory').classList.contains('btn-success')) ? 1 : 0;
    if (!name.startsWith('Homepage') && !name.endsWith('Untitled') && setthingsForm.querySelector('#optionsDisplayName').value.length > 2) {
        results.nice_name = setthingsForm.querySelector('#optionsDisplayName').value.trim()
    } else {
        results.nice_name = null;
    }

    if (!name.startsWith('ADS')) {
        if (setthingsForm.querySelector('#optionsDisplayChannelInput').value.length > 0) {
            switch (setthingsForm.querySelector('#optionsDisplaySearchInput').value) {
                case '3':
                    requestOptions.set('album', setthingsForm.querySelector('#optionsDisplayChannelInput').value);
                    requestOptions.delete('folder');
                    requestOptions.delete('channel');
                    break;
                case '2':
                    requestOptions.set('folder', setthingsForm.querySelector('#optionsDisplayChannelInput').value);
                    requestOptions.delete('album');
                    requestOptions.delete('channel');
                    break;
                case '1':
                    requestOptions.set('channel', setthingsForm.querySelector('#optionsDisplayChannelInput').value);
                    requestOptions.delete('album');
                    requestOptions.delete('folder');
                    break;
                case '0':
                    requestOptions.delete('album');
                    requestOptions.delete('folder');
                    requestOptions.delete('channel');
            }
        }

        if (setthingsForm.querySelector('#optionsPinsOnly').value.length > 0) {
            requestOptions.delete('pins');
            requestOptions.set('pins', setthingsForm.querySelector('#optionsPinsOnly').value);
        }
        if (setthingsForm.querySelector('#optionsRatio').value.length > 0) {
            requestOptions.delete('ratio');
            requestOptions.set('ratio', setthingsForm.querySelector('#optionsRatio').value);
        }
        if (setthingsForm.querySelector('#optionsResolution').value.length > 0) {
            requestOptions.delete('minres');
            requestOptions.set('minres', setthingsForm.querySelector('#optionsResolution').value);
        }
        if (setthingsForm.querySelector('#optionsSearchInput').value.length > 0) {
            requestOptions.delete('search');
            requestOptions.set('search', setthingsForm.querySelector('#optionsSearchInput').value);
        }
        if (setthingsForm.querySelector('#optionsNumDaysInput').value.length > 0) {
            requestOptions.delete('numdays');
            requestOptions.set('numdays', setthingsForm.querySelector('#optionsNumDaysInput').value);
        }
        if (setthingsForm.querySelector('#optionsColorInput').value.length > 0) {
            requestOptions.delete('color');
            requestOptions.set('color', setthingsForm.querySelector('#optionsColorInput').value);
        }
        if (setthingsForm.querySelector('#optionsNSFWInput').value.length > 0) {
            requestOptions.delete('nsfw');
            requestOptions.set('nsfw', setthingsForm.querySelector('#optionsNSFWInput').value);
        }
        if (setthingsForm.querySelector('#optionsNoDuplicates').value.length > 0) {
            requestOptions.delete('history');
            requestOptions.set('history', setthingsForm.querySelector('#optionsNoDuplicates').value);
        }
    }
    if (!name.startsWith('Homepage') && !name.startsWith('ADS') &&
        !isNaN(parseInt(setthingsForm.querySelector('#optionsDisplayTimeInput').value.toString()))) {
        results.refreshTime = parseInt(setthingsForm.querySelector('#optionsDisplayTimeInput').value.toString());
    } else {
        results.refreshTime = 15;
    }
    if (!name.startsWith('Homepage') && !name.startsWith('ADS')) {
        switch (setthingsForm.querySelector('#optionsDisplayFormatInput').value) {
            case '2':
                results.imageFormat = 'png';
                break;
            case '1':
                results.imageFormat = 'jpg';
                break;
            case '0':
                results.imageFormat = 'webm';
                break;
            default:
                results.imageFormat = 'png';
                break;
        }
    } else {
        results.imageFormat = 'jpg'
    }
    if (!name.startsWith('Homepage') && !name.startsWith('ADS') &&
        setthingsForm.querySelector('#optionsDisplayLocationInput').value.length > 2) {
        results.location = setthingsForm.querySelector('#optionsDisplayLocationInput').value.trim()
    } else {
        results.location = null;
    }
    if (!name.startsWith('Homepage') && !name.startsWith('ADS') &&
        !isNaN(parseInt(setthingsForm.querySelector('#optionsDisplaySys').value.toString()))) {
        results.displaySysInfo = parseInt(setthingsForm.querySelector('#optionsDisplaySys').value.toString());
    } else {
        results.displaySysInfo = 1;
    }
    if (!name.startsWith('Homepage') && !name.startsWith('ADS') &&
        !isNaN(parseInt(setthingsForm.querySelector('#optionsDisplayImageInfo').value.toString()))) {
        results.displayImageInfo = parseInt(setthingsForm.querySelector('#optionsDisplayImageInfo').value.toString());
    } else {
        results.displayImageInfo = 1;
    }
    if (!name.startsWith('Homepage') && !name.startsWith('ADS') &&
        !isNaN(parseInt(setthingsForm.querySelector('#optionsDisplayTime').value.toString()))) {
        results.displayClock = parseInt(setthingsForm.querySelector('#optionsDisplayTime').value.toString());
    } else {
        results.displayClock = 1;
    }
    if (!name.startsWith('Homepage') && !name.startsWith('ADS') &&
        !isNaN(parseInt(setthingsForm.querySelector('#optionsDisplayDate').value.toString()))) {
        results.displayDate = parseInt(setthingsForm.querySelector('#optionsDisplayDate').value.toString());
    } else {
        results.displayDate = 1;
    }
    if (!name.startsWith('Homepage') && !name.startsWith('ADS') &&
        !isNaN(parseInt(setthingsForm.querySelector('#optionsDisplayOverlay').value.toString()))) {
        results.displayOverlay = parseInt(setthingsForm.querySelector('#optionsDisplayOverlay').value.toString());
    } else {
        results.displayOverlay = 1;
    }
    if (!name.startsWith('Homepage') && !name.startsWith('ADS') &&
        !isNaN(parseInt(setthingsForm.querySelector('#optionsDisplayLogo').value.toString()))) {
        results.displayLogo = parseInt(setthingsForm.querySelector('#optionsDisplayLogo').value.toString());
    } else {
        results.displayLogo = 1;
    }
    if (!name.startsWith('Homepage') && !name.startsWith('ADS') &&
        !isNaN(parseInt(setthingsForm.querySelector('#optionsDisplayScale').value.toString()))) {
        results.enableScale = parseInt(setthingsForm.querySelector('#optionsDisplayScale').value.toString());
    } else {
        results.enableScale = 1;
    }
    if (!name.startsWith('Homepage') && !name.startsWith('ADS') &&
        !isNaN(parseInt(setthingsForm.querySelector('#optionsDisplayAspect').value.toString()))) {
        results.displayAspectCorrect = parseInt(setthingsForm.querySelector('#optionsDisplayAspect').value.toString());
    } else {
        results.displayAspectCorrect = 1;
    }
    if (!name.startsWith('Homepage') && !name.startsWith('ADS') &&
        !isNaN(parseInt(setthingsForm.querySelector('#optionsDisplayDarkImg').value.toString()))) {
        results.darkImages = parseInt(setthingsForm.querySelector('#optionsDisplayDarkImg').value.toString());
    } else {
        results.darkImages = 0;
    }
    if (!name.startsWith('Homepage') && !name.startsWith('ADS') &&
        setthingsForm.querySelector('#optionsDisplayDarkOverlay').value.length > 0 &&
        !isNaN(parseInt(setthingsForm.querySelector('#optionsDisplayDarkOverlay').value.toString()))) {
        results.darkOverlay = parseInt(setthingsForm.querySelector('#optionsDisplayDarkOverlay').value.toString());
    } else {
        results.darkOverlay = 0;
    }
    if (!name.startsWith('Homepage') && !name.startsWith('ADS') &&
        !isNaN(parseInt(setthingsForm.querySelector('#optionsDisplayTaskbar').value.toString()))) {
        results.taskbarPosition = parseInt(setthingsForm.querySelector('#optionsDisplayTaskbar').value.toString());
    } else {
        results.taskbarPosition = 0;
    }
    if (!name.startsWith('Homepage') && !name.startsWith('ADS') &&
        !isNaN(parseInt(setthingsForm.querySelector('#optionsDisplayWeather').value.toString()))) {
        results.weatherDisplay = parseInt(setthingsForm.querySelector('#optionsDisplayWeather').value.toString());
    } else {
        results.weatherDisplay = 0;
    }
    if (!name.startsWith('Homepage') && !name.startsWith('ADS') &&
        !isNaN(parseInt(setthingsForm.querySelector('#optionsDisplayWeatherFormat').value.toString()))) {
        results.weatherFormat = parseInt(setthingsForm.querySelector('#optionsDisplayWeatherFormat').value.toString());
    } else {
        results.weatherFormat = 0;
    }
    if (!name.startsWith('Homepage') && !name.startsWith('ADS') &&
        !isNaN(parseInt(setthingsForm.querySelector('#optionsDisplayWeatherFeelLike').value.toString()))) {
        results.weatherFeelLike = parseInt(setthingsForm.querySelector('#optionsDisplayWeatherFeelLike').value.toString());
    } else {
        results.weatherFeelLike = 0;
    }
    if (!name.startsWith('Homepage') && !name.startsWith('ADS') &&
        !isNaN(parseInt(setthingsForm.querySelector('#optionsDisplayQuote').value.toString()))) {
        results.quoteEnable = parseInt(setthingsForm.querySelector('#optionsDisplayQuote').value.toString());
    } else {
        results.quoteEnable = 0;
    }
    if (!name.startsWith('Homepage') && !name.startsWith('ADS') &&
        setthingsForm.querySelector('#optionsDisplayQuotesInput').value.length > 2) {
        results.quoteTag = setthingsForm.querySelector('#optionsDisplayQuotesInput').value.trim()
    } else {
        results.quoteTag = null;
    }

    if (requestOptions.toString().length > 3) {
        results.requestOptions = requestOptions.toString()
    } else {
        results.requestOptions = null;
    }

    const _results = JSON.stringify(results);
    $(`#settings-${index}-body`).html('<span>Sent Displays Configuration, Updates will apply on the displays refresh interval. Weather settings will not apply for up to 15 Minutes.</span>');
    $.ajax({async: true,
        url: `/ambient-history?command=setConfig&displayname=${name}`,
        type: 'post',
        contentType: 'application/json',
        data: _results,
        dataType: 'json',
        cache: false,
        headers: {
            'X-Requested-With': 'SequenziaXHR'
        },
    });
}
