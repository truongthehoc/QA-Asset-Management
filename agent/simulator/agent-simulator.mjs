/**
 * IT Asset Management - Live Windows Agent Simulator (Node.js 22+)
 * Cho phép kiểm thử trực tiếp luồng: Enroll -> Inventory Snapshot -> Heartbeat -> Hardware/Software Drift
 * Usage:
 *   node agent/simulator/agent-simulator.mjs
 *   node agent/simulator/agent-simulator.mjs --host QA-DEMO-PC-01 --token ENROLL-ITAM-2026-INTERNAL
 */
import os from 'os';
import crypto from 'crypto';

const args = process.argv.slice(2);
const getArg = (flag, fallback) => {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
};

const BASE_URL = getArg('--url', 'http://localhost:3001');
const ENROLL_TOKEN = getArg('--token', 'ENROLL-ITAM-2026-INTERNAL');
const HOSTNAME = getArg('--host', `${os.hostname()}-SIM`);

function collectLocalHardware() {
  const cpus = os.cpus();
  const totalRamGb = Math.round((os.totalmem() / 1024 ** 3) * 10) / 10;
  const nics = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const iface of list || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        nics.push({
          name,
          macAddress: iface.mac.toUpperCase(),
          ipAddress: iface.address,
          speedMbps: 1000,
          status: 'UP',
          isVirtual: /vEthernet|Loopback|Virtual|WSL/i.test(name),
        });
      }
    }
  }
  return {
    computerName: HOSTNAME,
    hostname: HOSTNAME,
    smbiosUuid: crypto.createHash('md5').update(HOSTNAME).digest('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5').toUpperCase(),
    serialNumber: `SIM-${crypto.createHash('sha1').update(HOSTNAME).digest('hex').slice(0, 8).toUpperCase()}`,
    manufacturer: 'Dell Inc.',
    model: 'OptiPlex 7020 Micro (Live Agent)',
    mainboardMfg: 'Dell Inc.',
    mainboardProduct: '0V4X9K',
    mainboardSerial: `MB-${HOSTNAME}`,
    biosMfg: 'Dell Inc.',
    biosVersion: '1.18.0',
    biosReleaseDate: '2026-09-01',
    totalRamGb,
    totalDiskGb: 512,
    processors: [
      {
        name: cpus[0]?.model?.trim() || 'Intel(R) Core(TM) i7-13700',
        manufacturer: 'GenuineIntel',
        cores: Math.max(2, Math.floor(cpus.length / 2)),
        logicalProcessors: cpus.length,
        maxClockMhz: cpus[0]?.speed || 3200,
      },
    ],
    memoryModules: [
      {
        slot: 'DIMM1',
        capacityGb: totalRamGb,
        memoryType: 'DDR5',
        speedMhz: 4800,
        manufacturer: 'SK Hynix',
      },
    ],
    disks: [
      {
        model: 'Samsung PM9B1 NVMe 512GB',
        serialNumber: `NVME-${HOSTNAME}`,
        mediaType: 'NVMe SSD',
        sizeGb: 512,
        freeGb: 320,
      },
    ],
    networkAdapters: nics.length
      ? nics
      : [{ name: 'Ethernet0', macAddress: 'D4:BE:D9:88:11:22', ipAddress: '192.168.10.199', speedMbps: 1000, status: 'UP', isVirtual: false }],
    graphics: [{ name: 'Intel UHD Graphics 770', vramMb: 1024 }],
    operatingSystem: {
      productName: 'Windows 11 Pro',
      edition: 'Professional',
      version: '24H2',
      buildNumber: os.release(),
      architecture: os.arch() === 'x64' ? '64-bit' : os.arch(),
      activationStatus: 'ACTIVATED',
      licenseChannel: 'OEM',
      partialProductKey: '7K9M2',
    },
    software: [
      { displayName: 'Google Chrome', publisher: 'Google LLC', displayVersion: '130.0.6723.92', architecture: 'x64' },
      { displayName: 'Microsoft Office LTSC 2021', publisher: 'Microsoft Corporation', displayVersion: '16.0.14332', architecture: 'x64' },
      { displayName: '7-Zip 24.08 (x64)', publisher: 'Igor Pavlov', displayVersion: '24.08', architecture: 'x64' },
    ],
  };
}

async function main() {
  const hw = collectLocalHardware();
  const primaryNic = hw.networkAdapters.find((n) => !n.isVirtual) || hw.networkAdapters[0];

  console.log(`[Agent] Enrolling ${HOSTNAME} against ${BASE_URL}...`);
  const enrollRes = await fetch(`${BASE_URL}/api/v1/agent/enroll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      enrollmentToken: ENROLL_TOKEN,
      hostname: hw.hostname,
      computerName: hw.computerName,
      smbiosUuid: hw.smbiosUuid,
      biosSerial: hw.serialNumber,
      primaryMac: primaryNic?.macAddress,
      ipAddress: primaryNic?.ipAddress,
      manufacturer: hw.manufacturer,
      model: hw.model,
      osSummary: `${hw.operatingSystem.productName} ${hw.operatingSystem.version}`,
      agentVersion: '1.2.0',
    }),
  });
  const enrollData = await enrollRes.json();
  if (!enrollRes.ok) {
    console.error('[Agent] Enroll failed:', enrollData);
    process.exit(1);
  }
  console.log('[Agent] Enrolled OK:', { agentUid: enrollData.agentUid, status: enrollData.status });

  const headers = {
    'Content-Type': 'application/json',
    'X-Agent-Id': enrollData.agentUid,
    'X-Agent-Token': enrollData.agentToken,
  };

  console.log('[Agent] Submitting initial inventory snapshot...');
  const snapRes = await fetch(`${BASE_URL}/api/v1/agent/inventory`, {
    method: 'POST',
    headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({ ...hw, source: 'INITIAL' }),
  });
  console.log('[Agent] Snapshot response:', await snapRes.json());

  console.log('[Agent] Sending heartbeat...');
  const hbRes = await fetch(`${BASE_URL}/api/v1/agent/heartbeat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ipAddress: primaryNic?.ipAddress, agentVersion: '1.2.0', cpuLoadPercent: 18.4, ramUsedPercent: 42.1 }),
  });
  console.log('[Agent] Heartbeat response:', await hbRes.json());
  console.log('\n=> Thiết bị đã xuất hiện tại mục "Khám phá thiết bị -> Thiết bị chờ duyệt" trên Web App!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
