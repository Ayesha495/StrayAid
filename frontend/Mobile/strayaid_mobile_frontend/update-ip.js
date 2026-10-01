const os = require('os');
const fs = require('fs');
const path = require('path');

const IGNORED_INTERFACE = /virtualbox|vmware|hyper-v|veth|docker|wsl|tailscale|vpn/i;

function detectLocalIp() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const [name, addresses] of Object.entries(interfaces)) {
    if (!addresses || IGNORED_INTERFACE.test(name)) continue;
    for (const addr of addresses) {
      if (addr.family === 'IPv4' && !addr.internal) {
        candidates.push(addr.address);
      }
    }
  }

  if (candidates.length === 0) {
    throw new Error('Could not auto-detect a LAN IPv4 address. Connect to Wi-Fi/Ethernet and try again.');
  }

  return candidates[0];
}

try {
  const localIp = detectLocalIp();
  const apiUrl = `http://${localIp}:8000`;
  const envPath = path.join(__dirname, '.env');

  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

  if (/^EXPO_PUBLIC_API_URL=.*$/m.test(envContent)) {
    envContent = envContent.replace(/^EXPO_PUBLIC_API_URL=.*$/m, `EXPO_PUBLIC_API_URL=${apiUrl}`);
  } else {
    if (envContent.length > 0 && !envContent.endsWith('\n')) envContent += '\n';
    envContent += `EXPO_PUBLIC_API_URL=${apiUrl}\n`;
  }

  fs.writeFileSync(envPath, envContent);
  console.log(`Detected local IP ${localIp} -> EXPO_PUBLIC_API_URL=${apiUrl}`);
} catch (error) {
  console.error('Failed to auto-update IP:', error.message);
  process.exit(1);
}
