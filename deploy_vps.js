const { Client } = require('ssh2');

const conn = new Client();

const commands = `
set -e
echo "Starting deployment at /var/www/OTLWMS..."
cd /var/www/OTLWMS

git config --global --add safe.directory /var/www/OTLWMS

echo "Resetting any local changes..."
git fetch origin master
git reset --hard origin/master

echo "Installing dependencies..."
npm install

echo "Building Next.js app..."
npm run build

echo "Restarting PM2 processes..."
pm2 restart all

echo "Deployment completed successfully!"
`;

console.log('Connecting to VPS...');
conn.on('ready', () => {
  console.log('Connected! Executing deployment script...');
  conn.exec(commands, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
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
