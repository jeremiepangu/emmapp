import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dbUrl = 'postgresql://emmapp:emmapp_secret@localhost:5432/emmapp?schema=public';

console.log('1/2 — Base de données locale...');
const db = spawn('node', ['scripts/start-local-db.mjs'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});

await new Promise((resolve, reject) => {
  db.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`db setup exit ${code}`))));
});

console.log('2/2 — API NestJS...');
const api = spawn('npx', ['nest', 'start', '--watch'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, DATABASE_URL: dbUrl },
});

api.on('close', (code) => process.exit(code ?? 0));
