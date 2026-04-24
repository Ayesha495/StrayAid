const fs = require('fs');
const path = require('path');

try {
  const localIp = '192.168.1.13';
  const envPath = path.join(__dirname, '.env');
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
    // Replace the IP line
    envContent = envContent.replace(/IP=.*/, `IP=http://${localIp}:8000`);
  } else {
    envContent = `IP=http://${localIp}:8000\n`;
  }
  fs.writeFileSync(envPath, envContent);
  console.log(`Updated IP to http://${localIp}:8000`);
} catch (error) {
  console.error('Failed to update IP:', error);
}
