'use strict';
// Somente leitura: usa o mesmo endpoint e validador da dashboard.
const fs = require('node:fs');
const path = require('node:path');
const T = require('./telemetry.js');
const source = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
const url = source.match(/const FIREBASE_URL = "([^"]+)"/)[1];
const output = path.join(__dirname, 'monitoramento.jsonl');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const end = Date.now() + 120000;
  let previous;
  let success = 0;
  let failures = 0;
  console.log(`Monitorando por 2 minutos. Log: ${output}`);
  while (Date.now() < end) {
    const entry = { consulta: new Date().toISOString() };
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { 'Cache-Control': 'no-cache' } });
      entry.http = response.status;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      entry.payload = await response.json();
      entry.leitura = T.validate(entry.payload);
      const signature = JSON.stringify(entry.leitura);
      entry.alterado = previous === undefined ? null : previous !== signature;
      previous = signature;
      success++;
      console.log(`${entry.consulta} | distância=${entry.leitura.distance} cm | nível=${entry.leitura.level} cm | status=${JSON.stringify(entry.leitura.rawStatus)} | classificação=${entry.leitura.risk}`);
    } catch (error) {
      failures++;
      entry.erro = error.message;
      console.error(`${entry.consulta} | ERRO: ${error.message}`);
    }
    fs.appendFileSync(output, JSON.stringify(entry) + '\n', 'utf8');
    if (Date.now() < end) await delay(Math.min(2000, end - Date.now()));
  }
  console.log(`Concluído: ${success} consultas válidas, ${failures} falhas. Consultas não comprovam horário da medição nem conexão do ESP32.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
