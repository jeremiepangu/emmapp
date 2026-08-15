import EmbeddedPostgres from 'embedded-postgres';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dataDir = path.join(root, '.pgdata');

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'emmapp',
  password: 'emmapp_secret',
  port: 5432,
  persistent: true,
});

console.log('Demarrage PostgreSQL embarque...');
const alreadyInit = fs.existsSync(path.join(dataDir, 'PG_VERSION'));
if (!alreadyInit) {
  await pg.initialise();
} else {
  const pidFile = path.join(dataDir, 'postmaster.pid');
  if (fs.existsSync(pidFile)) {
    const pid = Number(String(fs.readFileSync(pidFile, 'utf8')).split(/\r?\n/)[0]);
    let alive = false;
    if (Number.isFinite(pid) && pid > 0) {
      try {
        process.kill(pid, 0);
        alive = true;
      } catch {
        alive = false;
      }
    }
    if (!alive) {
      fs.unlinkSync(pidFile);
    }
  }
}
await pg.start();
console.log('PostgreSQL pret sur 127.0.0.1:5432');

const dbUrl = 'postgresql://emmapp:emmapp_secret@127.0.0.1:5432/emmapp?schema=public';

const push = spawn('npx', ['prisma', 'db', 'push'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, DATABASE_URL: dbUrl },
});
await new Promise((resolve, reject) => {
  push.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`db push exit ${code}`))));
});

const seed = spawn('npx', ['ts-node', 'prisma/seed.ts'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, DATABASE_URL: dbUrl },
});
await new Promise((resolve, reject) => {
  seed.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`seed exit ${code}`))));
});

console.log('Base initialisee. Comptes: admin@emmapure.cd / admin@emmapp.cd - password123');
console.log('PostgreSQL reste actif. Lancez: npm run start:dev');

process.on('SIGINT', async () => {
  await pg.stop();
  process.exit(0);
});
