const { Client } = require('ssh2');

const conn = new Client();

const runCommand = (cmd) => {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let output = '';
      stream.on('close', (code, signal) => {
        resolve({ code, output });
      }).on('data', (data) => {
        output += data.toString();
        process.stdout.write(data.toString());
      }).stderr.on('data', (data) => {
        output += data.toString();
        process.stderr.write(data.toString());
      });
    });
  });
};

conn.on('ready', async () => {
  console.log('Client :: ready');
  try {
    const deployScript = `
      cd /var/www/OTLWMS
      echo "--> Pulling latest changes..."
      git pull origin master
      
      echo "--> Installing dependencies..."
      npm install
      
      echo "--> Generating Prisma Client..."
      npx prisma generate
      
      echo "--> Building Next.js app..."
      npm run build
      
      echo "--> Restarting PM2 process..."
      pm2 restart OTLWMS
    `;
    
    let res = await runCommand(deployScript);
    console.log('--- DEPLOYMENT RESULT ---');
    console.log('Exit Code:', res.code);

  } catch (err) {
    console.error(err);
  } finally {
    conn.end();
  }
}).connect({
  host: '76.13.196.51',
  port: 22,
  username: 'root',
  password: ';Z\'8.anj(ttkX.+59\'hO'
});
