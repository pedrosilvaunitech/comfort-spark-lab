module.exports = {
  apps: [
    {
      name: "senhas-frontend",
      script: "npx",
      args: "vite preview --host 0.0.0.0 --port 3001",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
      },
      autorestart: true,
      watch: false,
      max_memory_restart: "256M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "./logs/frontend-error.log",
      out_file: "./logs/frontend-out.log",
      merge_logs: true,
    },
    {
      name: "senhas-print-server",
      script: "print-server.mjs",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PRINT_SERVER_PORT: 3002,
      },
      autorestart: true,
      watch: false,
      max_memory_restart: "128M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "./logs/print-server-error.log",
      out_file: "./logs/print-server-out.log",
      merge_logs: true,
    },
  ],
};
