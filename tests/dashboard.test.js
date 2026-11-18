'use strict';
// Integration harness: execute production scripts against a minimal DOM and fake network.
// This checks wiring and behavior; it does not replace browser layout verification.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

class Element {
  constructor() {
    this.textContent = ''; this.children = []; this.attributes = {}; this.style = {}; this.listeners = {};
    const classes = new Set();
    this.classList = { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x), toggle: (x, value) => value ? classes.add(x) : classes.delete(x) };
  }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(key, callback) { this.listeners[key] = callback; }
  click() { this.listeners.click?.({ target: this }); }
  change(value) { this.value = value; this.listeners.change?.({ target: this }); }
}
async function harness(responses = [{ distancia: 20, nivel_agua: 10, status: 'NORMAL' }]) {
  const ids = [...fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'unique DOM ids');
  const elements = Object.fromEntries(ids.map(id => [id, new Element()]));
  const timers = new Map(); const intervals = new Map(); const requests = []; let nextId = 0;
  const context = vm.createContext({
    console, AbortController, Date, TypeError, SyntaxError,
    document: { body: new Element(), getElementById: id => { assert.ok(elements[id], `missing DOM id ${id}`); return elements[id]; }, createElement: () => new Element(), createElementNS: () => new Element(), createTextNode: value => ({ textContent: value }) },
    setTimeout: (fn, delay) => { const id = ++nextId; timers.set(id, { fn, delay }); return id; }, clearTimeout: id => timers.delete(id),
    setInterval: fn => { const id = ++nextId; intervals.set(id, fn); return id; }, clearInterval: id => intervals.delete(id),
    addEventListener() {},
    fetch: async (url, options) => {
      requests.push({ url, options });
      const result = responses.length > 1 ? responses.shift() : responses[0];
      if (result instanceof Error) throw result;
      if (result?.http) return { ok: false, status: result.http };
      return { ok: true, json: async () => result };
    }
  });
  context.window = context;
  for (const file of ['telemetry.js', 'app.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
  await flush();
  const poll = async () => { const [id, timer] = [...timers].at(-1); timers.delete(id); await timer.fn(); await flush(); };
  return { elements, timers, intervals, requests, poll, flush };
}
test('inicializa sem Leaflet, informa idade desconhecida e mantém endpoint GET', async () => {
  const { elements: e, requests } = await harness();
  assert.equal(e.riskBadge.textContent, 'Normal');
  assert.equal(e.connection.textContent, 'Firebase acessível');
  assert.match(e.connectionDetail.textContent, /Conexão do ESP32 sem confirmação/);
  assert.match(e.measurementContext.textContent, /idade não comprovada/);
  assert.match(e.map.textContent, /Mapa indisponível/);
  assert.equal(requests[0].url, 'https://lixeira-inteligente-upx-default-rtdb.firebaseio.com/rio_sorocaba/status.json');
  assert.equal(requests[0].options.method, 'GET');
  assert.equal(requests[0].options.cache, 'no-store');
});
test('textos reais do ESP32 atualizam risco, alerta e sugestão de desvio', async () => {
  const h = await harness([
    { distancia: 30, nivel_agua: 10, status: 'Nível Normal' },
    { distancia: 28, nivel_agua: 12, status: 'Atenção: Elevação do Nível' },
    { distancia: 15, nivel_agua: 25, status: 'ALERTA CRÍTICO: RISCO DE ENCHENTE!' }
  ]);
  const e = h.elements;
  assert.equal(e.riskBadge.textContent, 'Normal');
  await h.poll();
  assert.equal(e.riskBadge.textContent, 'Atenção');
  assert.equal(e.criticalAlert.classList.contains('hidden'), true);
  await h.poll();
  assert.equal(e.riskBadge.textContent, 'Crítico');
  assert.equal(e.criticalAlert.classList.contains('hidden'), false);
  assert.match(e.routeTitle.textContent, /Sugestão conceitual de desvio/);
  assert.equal(e.eventLog.children.length, 3);
});

test('simulação normal/atenção/crítico/offline, reconhecimento e retorno isolado', async () => {
  const h = await harness(); const e = h.elements;
  const realTime = e.lastReceived.textContent;
  e.toggleSimulation.click();
  assert.match(e.sourceLabel.textContent, /MODO SIMULAÇÃO/);
  assert.equal(e.riskBadge.textContent, 'Normal');
  e.scenario.change('ATENCAO'); assert.equal(e.riskBadge.textContent, 'Atenção');
  e.scenario.change('CRITICO'); assert.equal(e.riskBadge.textContent, 'Crítico');
  assert.equal(e.criticalAlert.classList.contains('hidden'), false);
  assert.match(e.routeTitle.textContent, /Sugestão conceitual/);
  e.acknowledge.click(); assert.equal(e.acknowledge.disabled, true);
  e.clearLogs.click();
  assert.equal(e.acknowledge.disabled, true);
  assert.equal(e.criticalAlert.classList.contains('hidden'), false);
  e.scenario.change('OFFLINE');
  assert.equal(e.connection.textContent, 'Sem comunicação');
  assert.equal(e.riskBadge.textContent, 'Indisponível');
  assert.match(e.measurementContext.textContent, /não é atual/);
  e.toggleSimulation.click();
  assert.equal(e.riskBadge.textContent, 'Normal');
  assert.equal(e.lastReceived.textContent, realTime);
  assert.equal(e.historyCount.textContent, '1');
  assert.equal(h.requests.length, 1, 'simulation never calls remote writes');
});
test('falha HTTP, repetição sem spam e recuperação preservam último registro', async () => {
  const h = await harness([{ distancia: 5, nivel_agua: 25, status: 'CRITICO' }, { http: 403 }, { http: 403 }, { distancia: 20, nivel_agua: 10, status: 'NORMAL' }]);
  const e = h.elements;
  await h.poll();
  assert.equal(e.riskBadge.textContent, 'Indisponível');
  assert.match(e.backendStatus.textContent, /HTTP 403/);
  assert.match(e.measurementContext.textContent, /não é atual/);
  assert.match(e.alertTitle.textContent, /Último registro crítico/);
  const count = e.eventLog.children.length;
  await h.poll(); assert.equal(e.eventLog.children.length, count);
  await h.poll(); assert.equal(e.riskBadge.textContent, 'Normal');
  assert.equal(e.criticalAlert.classList.contains('hidden'), true);
});
test('JSON null, erro de rede e tipo inválido não exibem normal', async () => {
  for (const response of [null, new TypeError('Failed to fetch'), { distancia: '5', status: 'NORMAL' }]) {
    const h = await harness([response]);
    assert.equal(h.elements.riskBadge.textContent, 'Indisponível');
    assert.equal(h.elements.historyCount.textContent, '0');
  }
});
test('playback conclui subida e interrompe ao sair; polling real não contamina demo', async () => {
  const h = await harness(); const e = h.elements;
  e.toggleSimulation.click(); e.playScenario.click();
  const step = [...h.intervals.values()][0];
  for (let i = 0; i < 20; i++) step();
  assert.equal(e.riskBadge.textContent, 'Crítico');
  assert.equal(h.intervals.size, 0);
  const count = e.historyCount.textContent;
  await h.poll(); assert.equal(e.historyCount.textContent, count);
  e.playScenario.click(); e.toggleSimulation.click();
  assert.equal(h.intervals.size, 0);
  assert.equal(e.riskBadge.textContent, 'Normal');
  assert.equal(e.historyCount.textContent, '2');
  assert.ok(h.requests.every(request => request.options.method === 'GET'));
});
