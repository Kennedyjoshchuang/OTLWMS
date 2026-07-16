const { Client } = require('ssh2');
const conn = new Client();

const cmd = process.argv.slice(2).join(' ') || 'nginx -T';

console.log(`Connecting to VPS and running: "${cmd}"...`);
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error(err);
      conn.end();
      return;
    }
    stream.on('close', (code, signal) => {
      console.log(`\n--- COMMAND EXITED WITH CODE ${code} ---`);
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}).connect({
  host: '76.13.196.51',
  port: 22,
  username: 'root',
  password: ';Z\'8.anj(ttkX.+59\'hO',
  readyTimeout: 99999
});
