import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nextCli = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
const phpServer = spawn('php', ['-S', '127.0.0.1:8001', '-t', '.'], {
  cwd: projectRoot,
  env: { ...process.env, APP_ORIGIN: process.env.APP_ORIGIN ?? 'http://localhost:3000' },
  stdio: 'inherit',
});
const nextServer = spawn(process.execPath, [nextCli, 'dev', '--hostname', '0.0.0.0'], {
  cwd: projectRoot,
  stdio: 'inherit',
});
let stopping = false;

function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  if (phpServer.exitCode === null && phpServer.signalCode === null) phpServer.kill('SIGTERM');
  if (nextServer.exitCode === null && nextServer.signalCode === null) nextServer.kill('SIGTERM');
}

phpServer.on('error', (error) => {
  console.error('Unable to start the local PHP API server.', error);
  stop(1);
});
nextServer.on('error', (error) => {
  console.error('Unable to start the Next.js development server.', error);
  stop(1);
});
phpServer.on('exit', (code) => {
  if (!stopping) {
    console.error(`The local PHP API server exited unexpectedly (${code ?? 'terminated'}).`);
    stop(code ?? 1);
  }
});
nextServer.on('exit', (code) => {
  if (!stopping) stop(code ?? 1);
});
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
