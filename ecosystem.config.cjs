module.exports = {
  apps: [
    {
      name: "avicola-don-ramon",
      cwd: __dirname,
      script: "./node_modules/next/dist/bin/next",
      args: "start -p 3201",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "750M",
      kill_timeout: 10_000,
      listen_timeout: 10_000,
      env: {
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
};
