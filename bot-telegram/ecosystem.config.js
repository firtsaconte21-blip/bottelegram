const webhookUrl = process.env.WEBHOOK_URL;

module.exports = {
    apps: [
        {
            name: "mile-finder-bot",
            script: "npm",
            args: "run start",
            cwd: "./",
            watch: false,
            env: {
                NODE_ENV: "production",
            }
        },
        {
            name: "ngrok-tunnel",
            script: "ngrok",
            args: "http 3000 --log=stdout",
            cwd: "./",
            merge_logs: true
        }
    ]
};
