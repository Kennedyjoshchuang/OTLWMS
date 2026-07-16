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
  console.log('Connected to VPS.');
  try {
    // 1. Read and fix Nginx configuration
    console.log('Reading remote Nginx config /etc/nginx/sites-available/otlwms...');
    const nginxResult = await runCommand('cat /etc/nginx/sites-available/otlwms');
    if (nginxResult.code !== 0) throw new Error('Failed to read Nginx config file');
    
    let nginxContent = nginxResult.output;

    // Clean up any trailing 'EOF' from the previous failed write (case-insensitive and trailing whitespace tolerant)
    if (/EOF\s*$/.test(nginxContent)) {
      nginxContent = nginxContent.replace(/EOF\s*$/, '');
      console.log('Cleaned up trailing "EOF" from Nginx config.');
    }
    
    // Normalize newlines for matching
    let normalizedNginx = nginxContent.replace(/\r\n/g, '\n').trim();

    const targetNginxStr = 'proxy_set_header Host $host;\n        proxy_cache_bypass $http_upgrade;';
    const replacementNginxStr = 'proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n        proxy_cache_bypass $http_upgrade;';
    
    if (normalizedNginx.includes('proxy_set_header X-Forwarded-Proto $scheme;')) {
      console.log('Nginx config already has proxy headers.');
    } else if (normalizedNginx.includes(targetNginxStr)) {
      normalizedNginx = normalizedNginx.replace(targetNginxStr, replacementNginxStr);
      console.log('Added proxy headers to Nginx config.');
    } else {
      throw new Error('Target Nginx configuration string not found');
    }

    console.log('Writing clean Nginx config file...');
    // Ensure we have a clean newline before EOF delimiter
    const writeNginxCmd = `cat << 'EOF' > /etc/nginx/sites-available/otlwms\n${normalizedNginx}\nEOF`;
    const writeNginxResult = await runCommand(writeNginxCmd);
    if (writeNginxResult.code !== 0) throw new Error('Failed to write Nginx config file');
    console.log('Nginx config file updated successfully!');

    // 2. Test Nginx Configuration
    console.log('Testing Nginx configuration...');
    const testResult = await runCommand('nginx -t');
    if (testResult.code !== 0) throw new Error('Nginx configuration test failed!');
    console.log('Nginx configuration test passed.');

    // 3. Reload Nginx
    console.log('Reloading Nginx...');
    const reloadResult = await runCommand('nginx -s reload');
    if (reloadResult.code !== 0) throw new Error('Failed to reload Nginx');
    console.log('Nginx reloaded successfully.');

    // 4. Restart PM2 process
    console.log('Restarting PM2 OTLWMS app...');
    const pm2Result = await runCommand('pm2 restart OTLWMS');
    if (pm2Result.code !== 0) throw new Error('Failed to restart PM2 process');
    console.log('PM2 process restarted successfully.');

    console.log('--- ALL UPDATES COMPLETED SUCCESSFULLY ---');

  } catch (err) {
    console.error('Error during updates:', err);
    process.exit(1);
  } finally {
    conn.end();
  }
}).connect({
  host: '76.13.196.51',
  port: 22,
  username: 'root',
  password: ';Z\'8.anj(ttkX.+59\'hO',
  readyTimeout: 99999
});
