if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('/js/serviceWorker.js')
            .then(reg => console.log('Service Worker: Registered'))
            .catch(err => console.log(`Service Worker: Error: ${err}`));
    });
}

let config = new URLSearchParams(location.search);
config.delete('history');
config.set('json', 'true');

let lastURL = '';
let displayMode = [];
let failCount = 0;
let _quotes, _weather
let _night = undefined;
let _dssT1C = false;
let _dssT2C = false;
let nextImageTimer = null;
let displayConfiguration = {
    refreshTime: 15,
    displaySysInfo: 1,
    displayImageInfo: 1,
    displayClock: 1,
    displayDate: 1,
    displayOverlay: 1,
    displayLogo: 1,
    enableScale: 1,
    displayAspectCorrect: 1,
    darkImages: 0,
    darkOverlay: 0,
    taskbarPosition: 0,
    weatherFeelLike: 0,
    weatherFormat: 0,
    weatherDisplay: 0,
    quoteEnable: 0,
}

const _sysHeight = window.innerHeight * window.devicePixelRatio;
const _sysWidth = window.innerWidth * window.devicePixelRatio;
const month = [ "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" ];
const days = ["Sun", "Mon", "Tues", "Wednes", "Thurs", "Fri", "Satur"]

if (typeof overides !== 'undefined') {
    displayConfiguration = {...displayConfiguration, ...overides};
}
if (!config.has('displayname')) { config.set('displayname', 'Untitled') }

function dct() {
    const d = new Date();
    let h = d.getHours()
    let m = d.getMinutes();
    if (displayConfiguration.displayClock === 2) {
        h = h % 12;
        h = h ? h : 12; // the hour '0' should be '12'
        h = h < 10 ? '0' + h : h;
    } else {
        if (h < 10) { h = `0${h}` }
    }
    if (m < 10) { m = `0${m}` }
    document.getElementById('time').innerHTML = `${h}:${m}`;
    dc();
}
function ddt() {
    const d = new Date();
    let mth = month[d.getMonth()];
    let dy = d.getDate();
    document.getElementById('date').innerHTML = ` ${mth} ${dy}`;
    dd();
}
function ddwt() {
    const d = new Date();
    let dow = days[d.getDay()];
    document.getElementById('day').innerHTML = `${dow}day`;
    ddw();
}

// Time
function dc(){
    setTimeout(dct,1000)
}
// Date
function dd(){
    setTimeout(ddt,5000)
}
// Day
function ddw(){
    setTimeout(ddwt,5000)
}

if (config.has('displayname')) {
    if (config.has('displayswap') && config.getAll('displayswap').pop().split('-').length > 1) {
        const _dsT1 = config.getAll('displayswap').pop().split('-')[0];
        const _dsT2 = config.getAll('displayswap').pop().split('-')[1];

        const _displayName = config.getAll('displayname').pop().split('-')[0];
        const _displayNameAlt = config.getAll('displayname').pop().split('-')[1];

        console.log(`Using Remote Configuration using named display: "${_displayName}" and "${_displayNameAlt}"`);

        let _dssT1 = undefined;
        let _dssT2 = undefined;
        let _dssT1B = undefined;
        let _dssT2B = undefined;
        let _dsT1_1 = undefined;
        let _dsT2_1 = undefined;
        let _dsT1_2 = undefined;
        let _dsT2_2 = undefined;
        if (_dsT1 && _dsT2) {
            if (_dsT1.includes('.') && _dsT2.includes('.')) {
                _dsT1_1 = parseInt(_dsT1.split('.')[0]);
                _dsT1_2 = parseInt(_dsT1.split('.')[1]);
                _dsT2_1 = parseInt(_dsT2.split('.')[0]);
                _dsT2_2 = parseInt(_dsT2.split('.')[1]);
                if(!isNaN(_dsT1_1) && !isNaN(_dsT1_2) && !isNaN(_dsT2_1) && !isNaN(_dsT2_2)) {
                    _dssT1B = moment().hours(_dsT1_1).minutes(_dsT1_2).seconds(0).milliseconds(0).valueOf();
                    _dssT2B = moment().hours(_dsT2_1).minutes(_dsT2_2).seconds(0).milliseconds(0).valueOf();
                    if (Date.now() >= _dssT1B) {
                        _dssT1 = moment().add(1, 'day').hours(_dsT1_1).minutes(_dsT1_2).seconds(0).milliseconds(0).valueOf();
                        _dssT2 = moment().add(1, 'day').hours(_dsT2_1).minutes(_dsT2_2).seconds(0).milliseconds(0).valueOf();
                    } else {
                        _dssT1 = moment().hours(_dsT1_1).minutes(_dsT1_2).seconds(0).milliseconds(0).valueOf();
                        _dssT2 = moment().add(1, 'day').hours(_dsT2_1).minutes(_dsT2_2).seconds(0).milliseconds(0).valueOf();
                    }
                } else {
                    console.error(`Failed to parse display swap times : Input must be a number like 17.30-05.00`);
                    document.getElementById('errorBanner').classList = 'warningBanner'
                    setTimeout(() => {
                        if (!(document.getElementById('errorBanner').classList.contains('errorBanner'))) {
                            document.getElementById('errorBanner').classList = '';
                        }
                    }, 180000)
                    config.set('displayname', _displayName);
                }
            } else {
                _dsT1_1 = parseInt(_dsT1);
                _dsT1_2 = 0;
                _dsT2_1 = parseInt(_dsT2);
                _dsT2_2 = 0;
                if(!isNaN(_dsT1_1) && !isNaN(_dsT2_1)) {
                    _dssT1B = moment().hours(_dsT1_1).minutes(_dsT1_2).seconds(0).milliseconds(0).valueOf();
                    _dssT2B = moment().hours(_dsT2_1).minutes(_dsT2_2).seconds(0).milliseconds(0).valueOf();
                    if (Date.now() >= _dssT1B) {
                        _dssT1 = moment().add(1, 'day').hours(_dsT1_1).minutes(_dsT1_2).seconds(0).milliseconds(0).valueOf();
                        _dssT2 = moment().add(1, 'day').hours(_dsT2_1).minutes(_dsT2_2).seconds(0).milliseconds(0).valueOf();
                    } else if (Date.now() <= _dssT2B) {
                        _dssT1 = moment().hours(_dsT1_1).minutes(_dsT1_2).seconds(0).milliseconds(0).valueOf();
                        _dssT2 = moment().hours(_dsT2_1).minutes(_dsT2_2).seconds(0).milliseconds(0).valueOf();
                    } else {
                        _dssT1 = moment().add(1, 'day').hours(_dsT1_1).minutes(_dsT1_2).seconds(0).milliseconds(0).valueOf();
                        _dssT2 = moment().hours(_dsT2_1).minutes(_dsT2_2).seconds(0).milliseconds(0).valueOf();
                    }
                } else {
                    console.error(`Failed to parse display swap times : Input must be a number like 17-05`);
                    document.getElementById('errorBanner').classList = 'warningBanner'
                    setTimeout(() => {
                        if (!(document.getElementById('errorBanner').classList.contains('errorBanner'))) {
                            document.getElementById('errorBanner').classList = '';
                        }
                    }, 180000)
                    config.set('displayname', _displayName);
                }
            }
        } else {
            console.error(`Failed to parse display swap times : Missing Required Data`);
            document.getElementById('errorBanner').classList = 'warningBanner'
            setTimeout(() => {
                if (!(document.getElementById('errorBanner').classList.contains('errorBanner'))) {
                    document.getElementById('errorBanner').classList = '';
                }
            }, 180000)
            config.set('displayname', _displayName);
        }

        if (_dssT1 && _dssT2) {
            if (Date.now() >= _dssT1B || Date.now() <= _dssT2B) {
                config.set('displayname', _displayNameAlt);
                _dssT1C = true;
            } else {
                config.set('displayname', _displayName);
                _dssT2C = true;
            }
            console.log(`Setting Active Display Name ${config.getAll('displayname').pop()}`);

            console.log(`Registered Display Switch Time: ${_dssT1}:${_dssT2} - Now: ${Date.now()}`)
            setInterval(() => {
                if ((Date.now() > _dssT1 || Date.now() < _dssT2B) && !_dssT1C) {
                    config.set('displayname', _displayNameAlt);
                    _dssT1C = true;
                    if (config.has('swapreload')) {
                        location.reload();
                    } else {
                        getNextImage();
                    }
                } else if (Date.now() > _dssT2 && !_dssT2C) {
                    config.set('displayname', _displayName);
                    _dssT2C = true;
                    if (config.has('swapreload')) {
                        location.reload();
                    } else {
                        getNextImage();
                    }
                }
            }, 30 * 1000);
        } else {
            console.error(`Failed to setup display auto swap : No time setup`);
            document.getElementById('errorBanner').classList = 'warningBanner'
            setTimeout(() => {
                if (!(document.getElementById('errorBanner').classList.contains('errorBanner'))) {
                    document.getElementById('errorBanner').classList = '';
                }
            }, 180000)
        }
    } else {
        _displayName = config.getAll('displayname').pop();
        console.log(`Using Remote Configuration using named display: "${config.getAll('displayname').pop()}"`);
        document.getElementById('errorBanner').classList = 'warningBanner'
        setTimeout(() => {
            if (!(document.getElementById('errorBanner').classList.contains('errorBanner'))) {
                document.getElementById('errorBanner').classList = '';
            }
        }, 180000)
    }
} else {
    console.log('Using Default Display Configuration')
}

function getNextImage() {
    clearTimeout(nextImageTimer);
    nextImageTimer = null;
    let imageURL = ''
    if (displayConfiguration.darkImages === 1 && _night !== undefined) {
        if (_night) {
            config.set('dark', 'true');
        } else {
            config.set('dark', 'false');
        }
    }
    $.ajax({async: true,
        url: `/ambient-remote-refresh?${config.toString()}`,
        type: "GET", data: '',
        processData: false,
        contentType: false,
        headers: {
            'X-Requested-With': 'SequenziaXHR'
        },
        success: async function (response) {
            if (response.randomImagev2 && response.randomImagev2.length > 0) {
                if (response.randomImagev2[0].fullImage !== lastURL) {
                    if (response.configuration && response.configuration.refreshTime && response.configuration.refreshTime >= 1) {
                        console.log(response.configuration)
                        if (typeof overides !== 'undefined') {
                            displayConfiguration = {...response.configuration, ...overides};
                        } else {
                            displayConfiguration = response.configuration;
                        }
                        await syncDisplaySettings();
                    } else {
                        console.error('No remote configuration available at this time')
                    }
                    if (failCount <= 5) {
                        await pullImage(response);
                    }
                } else {
                    console.log('getImage Same Image');
                }

                let nextRefreshTime = (displayConfiguration.refreshTime) ? Math.abs(parseInt(displayConfiguration.refreshTime.toString()) * 60000) : 900000;
                if (response.randomImagev2[0].sync_delta) {
                    const calculatedRefreshTime = (((displayConfiguration.refreshTime) ? displayConfiguration.refreshTime * 60000 : 900000) + response.randomImagev2[0].sync_delta);
                    console.log(`Got Sync Pulse : ${calculatedRefreshTime / 60000} Minutes`);
                    if (calculatedRefreshTime > 0) {
                        nextRefreshTime = calculatedRefreshTime + 30000;
                    } else {
                        nextRefreshTime = 3 * 60000;
                        console.log('Unacceptable Sync Delta, Master is offline or did not report in time. Using Default Time')
                        setTimeout(() => {
                            document.getElementById('data3').innerText = 'STANDBY MODE';
                            document.getElementById('data1').innerText = 'Master Unavailable';
                            document.getElementById('errorBanner').classList = 'warningBanner'
                        }, 10000)
                        document.getElementById('errorBanner').classList = '';
                    }
                }
                if (failCount <= 5 && nextRefreshTime >= 1000) {
                    console.log(`Next Pull in ${(nextRefreshTime / 60000).toFixed(1)} Minutes`)
                    nextImageTimer = setTimeout(getNextImage, nextRefreshTime);
                    document.getElementById('errorBanner').classList = '';
                    console.log('getImage OK');
                } else {
                    console.log(`Next Pull in 1 Minutes : Bad Timer Value`)
                    nextImageTimer = setTimeout(getNextImage, 60000);
                    document.getElementById('errorBanner').classList = 'errorBanner'
                }
            } else {
                if (failCount <= 5) {
                    clearTimeout(nextImageTimer);
                    nextImageTimer = null;

                    console.log(response);
                    nextImageTimer = setTimeout(getNextImage, 60000);
                    document.getElementById('data3').innerText = 'SYSTEM RETRY';
                    document.getElementById('data1').classList.remove('hidden-on-boot')
                    document.getElementById('data1').innerText = 'No Data Available';
                    document.getElementById('errorBanner').classList = 'warningBanner'
                    failCount++;
                } else {
                    clearTimeout(nextImageTimer);
                    nextImageTimer = null;

                    console.log(response);
                    document.getElementById('data3').innerText = 'SYSTEM LOCKOUT';
                    document.getElementById('data1').classList.remove('hidden-on-boot')
                    document.getElementById('data1').innerText = 'No Response after 5 retries';
                    document.getElementById('data2').classList.remove('d-none');
                    document.getElementById('data2').innerText = response.responseText;
                    document.getElementById('errorBanner').classList = 'errorBanner'
                    setTimeout(function () {
                        location.reload();
                    }, 300000);
                }
            }
        },
        error: function (response) {
            if (failCount <= 5) {
                clearTimeout(nextImageTimer);
                nextImageTimer = null;

                console.log(response);
                nextImageTimer = setTimeout(getNextImage, 60000);
                document.getElementById('data3').innerText = 'SYSTEM RETRY';
                document.getElementById('data1').classList.remove('hidden-on-boot')
                document.getElementById('data1').innerText = 'Data Processing Error';
                document.getElementById('errorBanner').classList = 'warningBanner'
                failCount++;
            } else {
                clearTimeout(nextImageTimer);
                nextImageTimer = null;

                console.error('getImage Failed');
                document.getElementById('data3').innerText = 'SYSTEM LOCKOUT';
                document.getElementById('data1').classList.remove('hidden-on-boot')
                document.getElementById('data1').innerText = 'Data Processing Error';
                document.getElementById('data2').classList.remove('d-none');
                document.getElementById('data2').innerText = response.responseText;
                document.getElementById('errorBanner').classList = 'errorBanner'
                console.log(response);
                nextImageTimer = setTimeout(function () {
                    location.reload();
                }, 300000);
            }
        }
    });
}
function checkLogin() {
    $.ajax({async: true,
        url: '/device-login?checklogin=true',
        type: "GET", data: '',
        processData: false,
        contentType: false,
        headers: {
            'X-Requested-With': 'SequenziaXHR'
        },
        success: function (response) {
            if (response === 'true') {
                location.reload();
            }
        },
        error: function (response) {
        }
    });
}
function getImageDimensions(file) {
    return new Promise (function (resolved, rejected) {
        const i = new Image()
        i.onload = function(){
            resolved({w: i.width, h: i.height})
        };
        i.src = file
    })
}
function pullImage(data) {
    let _imageURL = `${data.randomImagev2[0].fullImage}?mh=${_sysHeight}&mw=${_sysWidth}`;
    if (displayConfiguration.imageFormat && displayConfiguration.imageFormat.length >= 3) {
        _imageURL += `&format=${displayConfiguration.imageFormat}`
    }
    console.log(`Image URL: ${_imageURL}`);
    $.ajax({async: true,
        url: _imageURL,
        type: "GET", data: '',
        processData: false,
        contentType: false,
        responseType: "arraybuffer",
        headers: {
            'X-Requested-With': 'SequenziaXHR'
        },
        success: async function (response,  textStatus, xhr) {
            if (xhr.status < 400) {
                failCount = 0;
                const dimensions = await getImageDimensions(response)
                const aspectRatio = dimensions.h / dimensions.w
                let element_to = '';
                let element_from = '';
                if (document.getElementById("bg2").style.opacity === '0') {
                    element_to = 'bg2';
                    element_from = 'bg1';
                } else {
                    element_to = 'bg1';
                    element_from = 'bg2';
                }
                if (aspectRatio > 0.97 && displayConfiguration.displayAspectCorrect === 1) {
                    document.getElementById(element_to + 'port').src = response;
                    document.getElementById(element_to).classList.add('blur-this');
                }
                document.getElementById(element_to).style.backgroundImage = "url('" + response + "')";
                if (displayConfiguration.displayImageInfo !== 0) {
                    setTimeout(function () {
                        document.getElementById('data1').innerText = `${data.randomImagev2[0].className} / ${data.randomImagev2[0].channelName}`;
                        document.getElementById('data3').innerText = data.randomImagev2[0].date;
                        if (data.randomImagev2[0].pinned) {
                            if (config.has('displayname')) {
                                document.getElementById('dataFav').classList.remove('d-none')
                                document.getElementById('dataFav').classList.add('mr-2')
                            } else {
                                document.getElementById('dataFav').classList.remove('d-none')
                                document.getElementById('dataFav').classList.remove('mr-2')
                            }
                        } else {
                            document.getElementById('dataFav').classList.add('d-none')
                            document.getElementById('dataFav').classList.remove('mr-2')
                        }
                        if (config.has('displayname')) {
                            document.getElementById('data2').classList.add('d-none');
                            document.getElementById('dataIcon').classList.add('d-none');
                        } else {
                            document.getElementById('data2').innerText = data.randomImagev2[0].eid;
                            if (data.randomImagev2[0].pinned) {
                                document.getElementById('dataIcon').classList.add('d-none')
                            } else {
                                document.getElementById('dataIcon').classList.remove('d-none')
                            }
                        }
                    }, 700)
                }
                if (element_to === 'bg1') {
                    $('#' + element_to).animate({ opacity: 1 }, 1500);
                    if (aspectRatio > 0.97 && displayConfiguration.displayAspectCorrect === 1) {
                        $('#' + element_to + 'port').animate({opacity: 1}, 1500);
                    }
                } else {
                    document.getElementById(element_to).style.opacity = '1';
                    if (aspectRatio > 0.97 && displayConfiguration.displayAspectCorrect === 1) {
                        document.getElementById(element_to + 'port').style.opacity = '1';
                    }
                    $('#' + element_from).animate({ opacity: 0 }, 1500);
                    $('#' + element_from + 'port').animate({ opacity: 0 }, 1500);
                }
                console.log('setImage OK')
                setTimeout(function () {
                    document.getElementById(element_from).style.opacity = '0';
                    document.getElementById(element_from).style.backgroundImage = '';
                    document.getElementById(element_from).classList.remove('blur-this');
                    document.getElementById(element_from + 'port').src = '';
                    document.getElementById(element_from + 'port').style.opacity = '0';
                    $('.hidden-on-boot').removeClass('hidden-on-boot')
                }, 1700);
                lastURL = data.randomImagev2[0].fullImage;
            } else {
                console.log(response);
                failCount++
            }
        },
        error: function (response) {
            console.error('setImage Failed')
            if (failCount !== 5) {
                document.getElementById('data3').innerText = 'SYSTEM LOCKOUT';
                document.getElementById('data1').innerText = 'After 5 failed attempts, was unable to get a valid response';
                document.getElementById('data1').classList.remove('hidden-on-boot')
                document.getElementById('data2').classList.remove('d-none');
                document.getElementById('data2').innerText = response.responseText;
                document.getElementById('errorBanner').classList = 'errorBanner'
                setTimeout(function () {
                    location.reload();
                }, 300000);
            }
            failCount++
        }
    });
}

function getWeather() {
    if (displayConfiguration.location) {
        let weatherOptions = new URLSearchParams();
        weatherOptions.set('address', displayConfiguration.location);
        if (displayConfiguration.weatherFormat === 1) {
            document.getElementById('weatherFormat').classList.add('wi-fahrenheit')
            document.getElementById('weatherFormat').classList.remove('wi-celsius')
            weatherOptions.set('imperial', 'true');
        } else {
            document.getElementById('weatherFormat').classList.add('wi-celsius')
            document.getElementById('weatherFormat').classList.remove('wi-fahrenheit')
        }
        $.ajax({async: true,
            url: `/acc/weather?${weatherOptions.toString()}`,
            type: "GET", data: '',
            processData: false,
            contentType: false,
            headers: {
                'X-Requested-With': 'SequenziaXHR'
            },
            success: function (response) {
                if (response.temperature !== undefined) {
                    document.getElementById('weatherInfo').classList.remove('hidden');
                    document.getElementById('weatherDataCond').innerText = response.weather_name;
                    let _temp
                    if (displayConfiguration.weatherFeelLike === 1) {
                        _temp = parseInt(response.temperature_feel.toFixed(0).toString());
                    } else {
                        _temp = parseInt(response.temperature.toFixed(0).toString());
                    }
                    document.getElementById('weatherIconMin').classList = `wi ${response.weather_icon_class}`;
                    document.getElementById('weatherDataTemp').innerText = _temp;
                    document.getElementById('weatherDataLo').innerText = `LO ${parseInt(response.temperature_min.toFixed(0).toString())}`;
                    document.getElementById('weatherDataHi').innerText = `HI ${parseInt(response.temperature_max.toFixed(0).toString())}`;

                    if (displayConfiguration.darkOverlay === 1) {
                        if (response.sys_night) {
                            document.getElementById('overlayCycle').classList = `night-overlay`;
                            _night = true;
                        } else {
                            document.getElementById('overlayCycle').classList = `day-overlay`;
                            _night = false;
                        }
                    } else {
                        document.getElementById('overlayCycle').classList = "";
                    }

                    console.log('Weather OK');
                } else {
                    console.error('Weather ERROR');
                    console.log(response);
                }
            },
            error: function (response) {
                console.error('Weather ERROR');
                console.log(response);
            }
        });
    } else {
        console.log('No Weather Location');
    }
}
function getQuote() {
    let reqURL = `/acc/quote`
    if (displayConfiguration.quoteTag) {
        reqURL += `?tag=${displayConfiguration.quoteTag}`
    }
    $.ajax({async: true,
        url: reqURL,
        type: "GET", data: '',
        processData: false,
        contentType: false,
        headers: {
            'X-Requested-With': 'SequenziaXHR'
        },
        success: function (response) {
            if (response.text !== undefined) {
                document.getElementById('quoteContainer').classList.remove('d-none')
                document.getElementById('quoteText').innerText = response.text;
                if (response.author) {
                    document.getElementById('quoteAuthor').innerText = response.author;
                } else {
                    document.getElementById('quoteAuthor').innerText = '';
                }

                console.log('Quote OK');
            } else {
                console.log('Quote ERROR');
                console.log(response);
            }
        },
        error: function (response) {
            console.log('Quote Failed');
            console.log(response);
        }
    });
}
function syncDisplaySettings() {
    try {
        let _ui = $('#userInfo');
        let _di = $('#displayInfo');
        switch (parseInt(displayConfiguration.displaySysInfo.toString())) {
            case 2:
                _ui.addClass('d-none').removeClass('d-flex');
                _di.addClass('d-flex').removeClass('d-none');
                document.getElementById('displayName').innerText = (displayConfiguration.nice_name) ? displayConfiguration.nice_name : displayConfiguration.name;
                break;
            case 0:
                _ui.addClass('d-none').removeClass('d-flex');
                _di.addClass('d-none').removeClass('d-flex');
                break;
            default:
                _ui.addClass('d-flex').removeClass('d-none');
                _di.addClass('d-none').removeClass('d-flex');
                break;
        }
    } catch (e) {
        console.error(`Failed to setup Image Info: ${e.message}`);
        document.getElementById('errorBanner').classList = 'warningBanner'
        setTimeout(() => {
            if (!(document.getElementById('errorBanner').classList.contains('errorBanner'))) {
                document.getElementById('errorBanner').classList = '';
            }
        }, 180000)
    }
    try {
        let _di = $('#dataInfo');
        switch (parseInt(displayConfiguration.displayImageInfo.toString())) {
            case 0:
                _di.addClass('d-none').removeClass('d-flex');
                break;
            default:
                _di.addClass('d-flex').removeClass('d-none');
                break;
        }
    } catch (e) {
        console.error(`Failed to setup Display Info: ${e.message}`);
        document.getElementById('errorBanner').classList = 'warningBanner'
        setTimeout(() => {
            if (!(document.getElementById('errorBanner').classList.contains('errorBanner'))) {
                document.getElementById('errorBanner').classList = '';
            }
        }, 180000)
    }
    try {
        let _di = $('#timeInfo');
        switch (displayConfiguration.displayClock) {
            case 0:
                _di.addClass('d-none').removeClass('d-flex');
                break;
            default:
                _di.addClass('d-flex').removeClass('d-none');
                break;
        }
    } catch (e) {
        console.error(`Failed to setup Time: ${e.message}`);
        document.getElementById('errorBanner').classList = 'warningBanner'
        setTimeout(() => {
            if (!(document.getElementById('errorBanner').classList.contains('errorBanner'))) {
                document.getElementById('errorBanner').classList = '';
            }
        }, 180000)
    }
    try {
        let _di = $('#dateInfo');
        let _dw = $('#day');
        let _df = $('#date');
        switch (parseInt(displayConfiguration.displayDate.toString())) {
            // Day Of The Week Disabled
            case 3:
                _di.addClass('d-flex').removeClass('d-none');
                _dw.addClass('d-none');
                _df.removeClass('d-none');
                break;
            // Full Date Disabled
            case 2:
                _di.addClass('d-flex').removeClass('d-none');
                _dw.removeClass('d-none');
                _df.addClass('d-none');
                break;
            // All Off
            case 0:
                _di.addClass('d-none').removeClass('d-flex');
                _dw.addClass('d-none');
                _df.addClass('d-none');
                break;
            default:
                _di.addClass('d-flex').removeClass('d-none');
                _dw.removeClass('d-none');
                _df.removeClass('d-none');
                break;
        }
    } catch (e) {
        console.error(`Failed to setup Date: ${e.message}`);
        document.getElementById('errorBanner').classList = 'warningBanner'
        setTimeout(() => {
            if (!(document.getElementById('errorBanner').classList.contains('errorBanner'))) {
                document.getElementById('errorBanner').classList = '';
            }
        }, 180000)
    }
    try {
        let _db = $('#overlayBg');
        let _dl = $('#overlayLeft');
        let _di = $('.shadow-item');
        let _dt = $('.shadow-txt');
        switch (parseInt(displayConfiguration.displayOverlay.toString())) {
            case 2:
                _db.addClass('d-none').removeClass('d-flex');
                _dl.removeClass('d-none')
                _di.addClass('shadow-blk')
                _dt.addClass('shadow-text')
                break;
            case 0:
                _db.addClass('d-none').removeClass('d-flex');
                _di.addClass('shadow-blk')
                _dt.addClass('shadow-text')
                break;
            default:
                _db.addClass('d-flex').removeClass('d-none');
                _di.removeClass('shadow-blk')
                _dt.removeClass('shadow-text')
                break;
        }
    } catch (e) {
        console.error(`Failed to setup Overlay: ${e.message}`);
        document.getElementById('errorBanner').classList = 'warningBanner'
        setTimeout(() => {
            if (!(document.getElementById('errorBanner').classList.contains('errorBanner'))) {
                document.getElementById('errorBanner').classList = '';
            }
        }, 180000)
    }
    try {
        let _ll = $('#logoStart');
        let _lt = $('#logoTop');
        let _lb = $('#logoEnd');
        switch (parseInt(displayConfiguration.displayLogo.toString())) {
            case 2:
                _ll.addClass('d-none');
                _lb.addClass('d-none');
                _lt.removeClass('d-none').addClass('d-flex').addClass('shadow-blk');
                break;
            case 0:
                _ll.addClass('d-none');
                _lt.addClass('d-none').removeClass('shadow-blk');
                _lb.removeClass('d-none');
                break;
            default:
                _ll.removeClass('d-none');
                _lt.addClass('d-none').removeClass('shadow-blk');
                _lb.addClass('d-none');
                break;
        }
    } catch (e) {
        console.error(`Failed to setup Logo: ${e.message}`);
        document.getElementById('errorBanner').classList = 'warningBanner'
        setTimeout(() => {
            if (!(document.getElementById('errorBanner').classList.contains('errorBanner'))) {
                document.getElementById('errorBanner').classList = '';
            }
        }, 180000)
    }
    try {
        let _di = $('#content-wrapper')[0];
        switch (parseInt(displayConfiguration.enableScale.toString())) {
            case 0:
                _di.style.zoom = '1';
                break;
            default:
                _di.style.zoom = undefined;
                break;
        }
    } catch (e) {
        console.error(`Failed to setup Scaling: ${e.message}`);
        document.getElementById('errorBanner').classList = 'warningBanner'
        setTimeout(() => {
            if (!(document.getElementById('errorBanner').classList.contains('errorBanner'))) {
                document.getElementById('errorBanner').classList = '';
            }
        }, 180000)
    }
    try {
        let _wc = $('#weatherDataCond');
        let _whl = $('#weatherLoHi');
        let _wi = $('#weatherIcon');
        let _wd = $('#weatherData');
        switch (parseInt(displayConfiguration.weatherDisplay.toString())) {
            case 6:
                _wc.addClass('hidden');
                _wi.remove('hidden');
                _whl.addClass('hidden');
                _wd.addClass('hidden').removeClass('t2x');
                break;
            case 5:
                _wc.removeClass('hidden');
                _wi.addClass('hidden');
                _whl.addClass('hidden');
                _wd.removeClass('hidden').addClass('t2x');
                break;
            case 4:
                _wc.removeClass('hidden');
                _whl.removeClass('hidden');
                _wi.addClass('hidden');
                _wd.removeClass('hidden').addClass('t2x');
                break;
            case 3:
                _wc.removeClass('hidden');
                _whl.removeClass('hidden');
                _wi.removeClass('hidden');
                _wd.removeClass('hidden').removeClass('t2x');
                break;
            case 2:
                _whl.removeClass('hidden');
                _wi.removeClass('hidden');
                _wc.addClass('hidden');
                _wd.removeClass('hidden').removeClass('t2x');
                break;
            case 1:
                _wc.addClass('hidden');
                _wi.removeClass('hidden');
                _whl.addClass('hidden');
                _wd.removeClass('hidden').removeClass('t2x');
                break;
            default:
                _wc.addClass('hidden');
                _whl.addClass('hidden');
                _wi.addClass('hidden');
                _wd.addClass('hidden').removeClass('t2x');
                break;
        }
    } catch (e) {
        console.error(`Failed to setup Weather Display: ${e.message}`);
        document.getElementById('errorBanner').classList = 'warningBanner'
        setTimeout(() => {
            if (!(document.getElementById('errorBanner').classList.contains('errorBanner'))) {
                document.getElementById('errorBanner').classList = '';
            }
        }, 180000)
    }
    try {
        switch (parseInt(displayConfiguration.quoteEnable.toString())) {
            case 0:
                clearInterval(_quotes);
                _quotes = undefined;
                break;
            default:
                if (!_quotes) {
                    getQuote();
                    _quotes = setInterval(getQuote, 900000);
                }
                break;
        }
    } catch (e) {
        console.error(`Failed to setup Quotes Settings: ${e.message}`);
        document.getElementById('errorBanner').classList = 'warningBanner'
        setTimeout(() => {
            if (!(document.getElementById('errorBanner').classList.contains('errorBanner'))) {
                document.getElementById('errorBanner').classList = '';
            }
        }, 180000)
    }
    try {
        let _di = $('#BottomSestion')
        switch (parseInt(displayConfiguration.taskbarPosition.toString())) {
            case 0:
                _di.removeClass('taskbar-bottom');
                break;
            default:
                _di.addClass('taskbar-bottom');
                break;
        }
    } catch (e) {
        console.error(`Failed to setup Taskbar Position: ${e.message}`);
        document.getElementById('errorBanner').classList = 'warningBanner'
        setTimeout(() => {
            if (!(document.getElementById('errorBanner').classList.contains('errorBanner'))) {
                document.getElementById('errorBanner').classList = '';
            }
        }, 180000)
    }
    try {
        if (displayConfiguration.location) {
            if (!_weather) {
                _weather = setInterval(getWeather, 900000);
                getWeather();
            }
        } else {
            clearInterval(_weather);
            _weather = undefined;
        }
    } catch (e) {
        console.error(`Failed to setup Weather Runtime: ${e.message}`)
        document.getElementById('errorBanner').classList = 'warningBanner'
        setTimeout(() => {
            if (!(document.getElementById('errorBanner').classList.contains('errorBanner'))) {
                document.getElementById('errorBanner').classList = '';
            }
        }, 180000)
    }
}

$(document).ready(function () {
    // Init Check
    let _refreshURL = '/discord/refresh'
    if (config.has('key')) {
        _refreshURL += `?key=${config.getAll('key').pop()}`
    }
    $.ajax({async: true,
        url: _refreshURL,
        type: "GET", data: '',
        processData: false,
        contentType: false,
        headers: {
            'X-Requested-With': 'SequenziaXHR'
        },
        success: function (res, txt, xhr) {
            if (xhr.status === 200) {
                document.getElementById('data3').innerText = "Configuring...";
                console.log("Getting first image...");
                getNextImage();

                dc();
                dd();
                ddw();
            } else {
                document.getElementById('data3').innerText = 'SYSTEM LOCKOUT';
                document.getElementById('data1').classList.remove('hidden-on-boot')
                document.getElementById('data1').innerText = 'Failed to validate login';
                document.getElementById('data2').classList.remove('d-none');
                document.getElementById('data2').innerText = res.responseText;
                document.getElementById('errorBanner').classList = 'errorBanner';
            }
        },
        error: function (res) {
            document.getElementById('data3').innerText = 'SYSTEM LOCKOUT';
            document.getElementById('data1').classList.remove('hidden-on-boot')
            document.getElementById('data1').innerText = 'Account Login Failure';
            document.getElementById('data2').classList.remove('d-none');
            document.getElementById('data2').innerText = res.responseText;
            document.getElementById('errorBanner').classList = 'errorBanner';
        }
    });
});
