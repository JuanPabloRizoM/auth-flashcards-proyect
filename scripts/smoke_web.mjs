#!/usr/bin/env node
// Smoke: arranca el servidor web de Expo y comprueba que responde sin errores de arranque.
import { spawn } from 'node:child_process';

const PORT = Number(process.env.SMOKE_PORT ?? 8082);
const URL = `http://localhost:${PORT}`;
const TIMEOUT_MS = 180_000;

const server = spawn('npx', ['expo', 'start', '--web', '--port', String(PORT)], {
  env: { ...process.env, CI: '1', BROWSER: 'none' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
server.stdout.on('data', (chunk) => {
  output += chunk;
});
server.stderr.on('data', (chunk) => {
  output += chunk;
});

const stop = () => {
  if (!server.killed) {
    server.kill('SIGTERM');
  }
};

process.on('exit', stop);
process.on('SIGINT', () => {
  stop();
  process.exit(130);
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const deadline = Date.now() + TIMEOUT_MS;
  let status = 0;

  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`El servidor web terminó con código ${server.exitCode}:\n${output}`);
    }
    try {
      const response = await fetch(URL);
      status = response.status;
      if (status === 200) {
        const html = await response.text();
        if (!html.includes('<div id="root">')) {
          throw new Error(`La respuesta no contiene el contenedor raíz:\n${html.slice(0, 500)}`);
        }
        break;
      }
    } catch {
      // el servidor aún no acepta conexiones
    }
    await wait(1000);
  }

  if (status !== 200) {
    throw new Error(`El servidor web no respondió 200 en ${TIMEOUT_MS} ms:\n${output}`);
  }

  const failures = output
    .split('\n')
    .filter((line) => /(Failed to|Unable to resolve|Error:|SyntaxError)/.test(line));

  if (failures.length > 0) {
    throw new Error(`Errores durante el arranque web:\n${failures.join('\n')}`);
  }

  console.log(`SMOKE WEB: OK (${URL} -> ${status})`);
}

main()
  .then(() => {
    stop();
    process.exit(0);
  })
  .catch((error) => {
    console.error(`SMOKE WEB: FAIL\n${error.message}`);
    stop();
    process.exit(1);
  });
