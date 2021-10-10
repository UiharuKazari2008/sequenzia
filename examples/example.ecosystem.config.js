module.exports = {
    apps : [
        {
            name   : "Sequenzia",
            namespace: "seq-web",
            script : "./start.js",
            watch: true,
            ignore_watch: ['node_modules','examples','temp','tmp', "[\\/\\\\]\\.\\(md\\|csv\\)", "public", ".*", "js/tools"],
            watch_delay: 1000,
            instances: 2,
            cron_restart: '0 4 * * *',
            stop_exit_codes: [0],
            restart_delay: 5000,
            kill_timeout : 3000,
            exp_backoff_restart_delay: 100,
            max_memory_restart: "1500M",
            wait_ready: true,
            env: {
                NODE_ENV: 'production'
            },
            env_production: {
                NODE_ENV: 'production'
            }
        },
        {
            name   : "IntelliDex",
            namespace: "seq-dps",
            script : "./js/tools/channel-indexer.js",
            watch_delay: 1000,
            stop_exit_codes: [0],
            restart_delay: 5000,
            kill_timeout : 3000,
            exp_backoff_restart_delay: 100,
            wait_ready: true,
            env: {
                NODE_ENV: 'production'
            },
            env_production: {
                NODE_ENV: 'production'
            }
        }
    ]
}