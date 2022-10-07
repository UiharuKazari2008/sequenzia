$(document).ready(function () {
    registerURLHandlers();
    registerUserMenuHandlers();
    registerDateHandlers();
    registerLazyLoader();
    if (initalPageLoad) {
        IPHL = history.length
        initalPageLoad = false;
        console.log(`Registering inital page history (IPHL) as ${IPHL}`)
    }
})

