module.exports = {
    apps : [
        {
            name   : "Sequenzia",
            namespace: "seq-0",
            script : "./start.js",
            watch: ['js','public','routes','views'],
            watch_delay: 1000,
            args   : "",
            instances: 1,
            cron_restart: '0 4 * * *',
            stop_exit_codes: [0],
            restart_delay: 5000,
            kill_timeout : 3000,
            exp_backoff_restart_delay: 100,
            wait_ready: true,
            env: {
                NODE_ENV: 'production',
                PORT: "3000",
                ID: "0"
            },
            env_production: {
                NODE_ENV: 'production'
            }
        },
        {
            name   : "IntelliDex",
            namespace: "seq-1",
            script : "./js/tools/channel-indexer.js",
            watch: ['js/tools'],
            watch_delay: 1000,
            args   : "",
            instances: 1,
            cron_restart: '0 4 * * *',
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