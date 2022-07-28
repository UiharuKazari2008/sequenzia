_originalURL = (() => {
    try {
        if ($.history) { return $.history.url() }
        if (window.location.hash.substring(1).length > 0) { return window.location.hash.substring(1).split('://' + window.location.host).pop() }
        return undefined
    } catch (e) {
        if (window.location.hash.substring(1).length > 0) { return window.location.hash.substring(1).split('://' + window.location.host).pop() }
        return undefined
    }
})()

$(document).ready(function () {
    registerURLHandlers();
    registerUserMenuHandlers();
    registerDateHandlers();
    registerLazyLoader();
})
if (initalPageLoad) {
    IPHL = history.length
    initalPageLoad = false;
    console.log(`Registering inital page history (IPHL) as ${IPHL}`)
}
