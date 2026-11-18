// URL do Firebase Realtime Database
const FIREBASE_URL = "https://lixeira-inteligente-upx-default-rtdb.firebaseio.com/rio_sorocaba/status.json";

// 1. Coordenadas do Rio e Desvio
const coordsRioSorocaba = [
  [-23.5352, -47.4410], [-23.5320, -47.4428], [-23.5285, -47.4445], 
  [-23.5240, -47.4470], [-23.5195, -47.4490], [-23.5150, -47.4502], 
  [-23.5100, -47.4510], [-23.5055, -47.4515], [-23.5015, -47.4520], 
  [-23.4980, -47.4512], [-23.4940, -47.4498], [-23.4900, -47.4485], 
  [-23.4855, -47.4470], [-23.4810, -47.4452], [-23.4760, -47.4438], 
  [-23.4700, -47.4425], [-23.4630, -47.4410]
];

const coordsDesvioViasAltas = [
  [-23.5352, -47.4410], [-23.5280, -47.4520], [-23.5200, -47.4610], 
  [-23.5110, -47.4660], [-23.5020, -47.4620], [-23.4960, -47.4550], 
  [-23.4900, -47.4420], [-23.4820, -47.4360], [-23.4630, -47.4410]
];

// The geometry and Firebase URL above are preserved from the original project.
// All remote requests are read-only. No simulated value reaches this transport.
(() => {
  'use strict';
  const T = window.SentinelaTelemetry;
  const $ = id => document.getElementById(id);
  const real = T.createState();
  let demo = T.createState();
  let simulation = false;
  let playback = null;
  let playbackStep = 0;
  let pollTimer;
  let controller;
  let stopped = false;
  let failures = 0;
  let map;
  let monitored;
  let alternate;
  let renderedEvents = '';
  const colors = { NORMAL: '#64dca1', ATENCAO: '#ffda75', CRITICO: '#ff8c96', UNKNOWN: '#a3b4c8' };
  const current = () => simulation ? demo : real;
  const text = (id, value) => { $(id).textContent = value; };
  const formatTime = value => value == null ? '—' : new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const clock = value => new Date(value).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const number = value => value.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

  function setupMap() {
    if (!window.L) {
      $('map').textContent = 'Mapa indisponível: Leaflet não carregou. As medições e a simulação continuam disponíveis.';
      $('map').classList.add('map-fallback');
      return;
    }
    try {
      $('map').replaceChildren();
      map = L.map('map', { scrollWheelZoom: false }).setView([-23.4990, -47.4490], 13);
      map.fitBounds(L.latLngBounds([...coordsRioSorocaba, ...coordsDesvioViasAltas]), { padding: [25, 25] });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 19
      }).on('tileerror', () => {
        text('mapNotice', 'Alguns mapas de fundo não carregaram. Os traçados continuam sendo apenas ilustrativos.');
        $('mapNotice').classList.remove('hidden');
      }).addTo(map);
      L.circleMarker([-23.5015, -47.4520], { radius: 7, color: '#14253b', fillColor: '#4ed8ee', fillOpacity: 1, weight: 3 })
        .addTo(map).bindPopup('Ponto ilustrativo do protótipo. Localização real do ESP32 não confirmada.');
      monitored = L.polyline(coordsRioSorocaba, { color: colors.UNKNOWN, weight: 5, opacity: .85 }).addTo(map);
      alternate = L.polyline(coordsDesvioViasAltas, { color: '#4ed8ee', weight: 4, opacity: .45, dashArray: '8, 8' }).addTo(map);
      if (window.ResizeObserver) new ResizeObserver(() => map.invalidateSize()).observe($('map'));
    } catch {
      text('mapNotice', 'Falha ao inicializar o mapa. A telemetria permanece independente.');
      $('mapNotice').classList.remove('hidden');
    }
  }

  function metric(id, value) {
    const element = $(id);
    element.replaceChildren(document.createTextNode(value == null ? '—' : number(value)));
    if (value != null) {
      const unit = document.createElement('span');
      unit.className = 'unit';
      unit.textContent = ' cm';
      element.append(unit);
    }
  }

  function renderChart(state) {
    const svg = $('historyChart');
    svg.replaceChildren();
    const samples = state.history;
    const valid = samples.filter(item => item.level != null);
    text('historyCount', String(samples.length));
    text('chartCaption', simulation ? 'SIMULAÇÃO · nível fictício (cm) × horário' : 'Nível reportado (cm) × horário de consulta');
    function shape(tag, attributes, content) {
      const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
      Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
      if (content) node.textContent = content;
      svg.append(node);
      return node;
    }
    if (!valid.length) {
      shape('text', { x: 220, y: 85, fill: '#a3b4c8', 'text-anchor': 'middle', 'font-size': 13 }, 'Sem observações de nível nesta sessão');
      svg.setAttribute('aria-label', 'Sem observações de nível nesta sessão');
      text('chartSummary', 'Aguardando nível válido; distância não é altura da água.');
      return;
    }
    const max = Math.max(1, ...valid.map(item => item.level)) * 1.15;
    const start = samples[0].at;
    const end = samples[samples.length - 1].at;
    const x = item => 45 + (end === start ? .5 : (item.at - start) / (end - start)) * 375;
    const y = item => 125 - item.level / max * 100;
    [0, .5, 1].forEach(fraction => {
      const yPos = 125 - fraction * 100;
      shape('line', { x1: 45, x2: 420, y1: yPos, y2: yPos, stroke: '#2b4158', 'stroke-dasharray': '4 5' });
      shape('text', { x: 36, y: yPos + 4, fill: '#a3b4c8', 'text-anchor': 'end', 'font-size': 10 }, number(max * fraction));
    });
    // Missing levels and gaps in transport break the line; never interpolate outages.
    let path = '';
    let previous;
    samples.forEach(item => {
      if (item.level == null) { previous = null; return; }
      path += `${previous && item.at - previous.at <= 6000 ? 'L' : 'M'}${x(item).toFixed(2)},${y(item).toFixed(2)} `;
      previous = item;
    });
    shape('path', { d: path, fill: 'none', stroke: '#4ed8ee', 'stroke-width': 2.5 });
    valid.forEach(item => shape('circle', { cx: x(item), cy: y(item), r: 2, fill: '#4ed8ee' }));
    shape('text', { x: 45, y: 151, fill: '#a3b4c8', 'font-size': 10 }, clock(start));
    shape('text', { x: 420, y: 151, fill: '#a3b4c8', 'text-anchor': 'end', 'font-size': 10 }, clock(end));
    const summary = `${valid.length} observações · último nível: ${number(valid[valid.length - 1].level)} cm`;
    svg.setAttribute('aria-label', `${simulation ? 'Simulação. ' : 'Horários de consulta, não de medição. '}${summary}`);
    text('chartSummary', summary);
  }

  function renderEvents(state) {
    const signature = JSON.stringify([simulation, state.events]);
    if (signature === renderedEvents) return;
    renderedEvents = signature;
    const container = $('eventLog');
    container.replaceChildren();
    if (!state.events.length) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = 'Nenhum evento nesta fonte.';
      container.append(empty);
    }
    state.events.forEach(event => {
      const row = document.createElement('div');
      row.className = `event ${event.risk.toLowerCase()}`;
      const time = document.createElement('time');
      time.dateTime = new Date(event.at).toISOString();
      time.textContent = clock(event.at);
      const message = document.createElement('span');
      message.textContent = `${simulation ? '[SIMULAÇÃO] ' : ''}${event.message}`;
      row.append(time, message);
      container.append(row);
    });
  }

  function render() {
    const state = current();
    const reading = state.reading;
    const risk = state.available && reading ? reading.risk : 'UNKNOWN';
    const historicalCritical = !state.available && reading?.risk === 'CRITICO';
    document.body.classList.toggle('simulating', simulation);
    $('simulationPanel').classList.toggle('hidden', !simulation);
    $('toggleSimulation').setAttribute('aria-pressed', String(simulation));
    text('toggleSimulation', simulation ? 'Voltar aos dados reais' : 'Iniciar demonstração');
    text('sourceLabel', simulation ? 'MODO SIMULAÇÃO · DADOS FICTÍCIOS' : 'FONTE REAL · FIREBASE');
    // Real records always have unknown acquisition age under the existing contract.
    metric('distance', reading?.distance);
    metric('waterLevel', reading?.level);
    text('measurementContext', !reading ? 'Nenhuma leitura válida.' : !state.available ? 'Último registro válido · não é atual.' : simulation ? 'Leitura simulada.' : 'Registro consultado · idade não comprovada.');
    text('levelContext', simulation ? 'Altura calculada no cenário fictício' : 'Último nível informado pela fonte');
    text('calibrationNote', simulation ? 'Referência fictícia: 30 cm − distância.' : 'Calibração não verificada; sem percentual.');
    text('riskBadge', !state.available ? 'Indisponível' : T.LABELS[risk]);
    $('riskBadge').className = `risk ${risk.toLowerCase()}`;
    text('riskContext', !reading ? 'Sem leitura válida' : !state.available ? `Último registro: ${T.LABELS[reading.risk]}` : simulation ? 'Estado do cenário de demonstração' : `Status recebido: ${reading.rawStatus} · idade desconhecida`);
    text('connection', simulation ? state.available ? 'Conectado (simulado)' : 'Sem comunicação' : state.available ? 'Firebase acessível' : state.error ? 'Dados indisponíveis' : 'Aguardando');
    text('backendStatus', simulation ? 'Fonte local de demonstração' : state.available ? 'Consulta ao banco realizada com sucesso' : state.error || 'Consultando Firebase…');
    text('connectionDetail', simulation ? state.available ? 'Nenhum envio ao banco real.' : 'Desconexão simulada; último registro preservado.' : 'Conexão do ESP32 sem confirmação: o dispositivo não informa o horário da medição.');
    text('deviceId', simulation ? 'DEMO-01 · fictício' : 'rio_sorocaba/status · ID físico não informado');
    text('lastReceived', formatTime(state.receivedAt));
    text('lastMeasured', simulation ? formatTime(state.receivedAt) : 'Não fornecido pelo contrato verificado');
    text('freshnessNote', simulation ? 'Horários e valores pertencem somente à demonstração. Fuso: São Paulo.' : 'Horário acima é da consulta, não da medição. O registro pode ser antigo mesmo com o Firebase acessível. Fuso: São Paulo.');
    const critical = risk === 'CRITICO' || historicalCritical;
    $('criticalAlert').classList.toggle('hidden', !critical);
    text('alertTitle', `${simulation ? 'SIMULAÇÃO · ' : ''}${historicalCritical ? 'Último registro crítico · dados indisponíveis' : 'Condição crítica no registro recebido'}`);
    text('alertDescription', `${state.acknowledged ? 'Alerta reconhecido. ' : ''}${simulation ? 'Cenário fictício: observe o destaque da alternativa.' : 'Idade da medição desconhecida; verificar o protótipo. O registro não confirma alagamento ou interdição de vias.'}`);
    text('acknowledge', state.acknowledged ? 'Alerta reconhecido' : 'Reconhecer alerta');
    $('acknowledge').disabled = state.acknowledged;
    const routeMessages = {
      NORMAL: ['Traçado monitorado em observação', 'Classificação normal do registro; não atesta segurança ou liberação da via.'],
      ATENCAO: ['Atenção ao cenário monitorado', 'Alternativa ilustrativa disponível para avaliar a proposta de mobilidade preventiva.'],
      CRITICO: ['Sugestão conceitual de desvio', 'Alternativa destacada para demonstração. Percurso não validado para navegação.'],
      UNKNOWN: ['Sem avaliação atual das rotas', 'Não há dados suficientes para inferir condições de trânsito.']
    };
    text('routeTitle', routeMessages[risk][0]);
    text('routeDescription', routeMessages[risk][1]);
    monitored?.setStyle({ color: colors[risk], weight: risk === 'CRITICO' ? 7 : 5 });
    alternate?.setStyle({ opacity: risk === 'CRITICO' ? 1 : .45, weight: risk === 'CRITICO' ? 6 : 4, dashArray: '8, 8' });
    $('monitoredKey').style.borderColor = colors[risk];
    renderChart(state);
    renderEvents(state);
  }

  async function poll() {
    if (stopped) return;
    controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(FIREBASE_URL, { method: 'GET', cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error(`Firebase indisponível (HTTP ${response.status}).`);
      const payload = await response.json();
      T.ingest(real, payload, Date.now());
      failures = 0;
    } catch (error) {
      failures += 1;
      const message = error.name === 'AbortError' ? 'Tempo de consulta esgotado.' : error instanceof TypeError ? 'Falha de rede ao consultar Firebase.' : error instanceof SyntaxError ? 'Resposta JSON inválida.' : error.message;
      T.fail(real, message, Date.now());
    } finally {
      clearTimeout(timeout);
      if (!simulation) render();
      // Schedule only after completion: no overlapping requests; capped retry backoff.
      if (!stopped) pollTimer = setTimeout(poll, Math.min(30000, 2000 * 2 ** Math.min(failures, 4)));
    }
  }

  function stopPlayback() {
    clearInterval(playback);
    playback = null;
    text('playScenario', 'Reproduzir subida');
  }
  function scenario(name) {
    if (!simulation) return;
    if (name === 'OFFLINE') T.fail(demo, 'Dispositivo sem comunicação (cenário simulado).', Date.now());
    else {
      const level = { NORMAL: 5, ATENCAO: 16, CRITICO: 25 }[name];
      T.ingest(demo, { distancia: 30 - level, nivel_agua: level, status: name }, Date.now());
    }
    $('scenario').value = name;
    render();
  }
  $('toggleSimulation').addEventListener('click', () => {
    stopPlayback();
    simulation = !simulation;
    if (simulation) { demo = T.createState(); scenario('NORMAL'); }
    else render();
  });
  $('scenario').addEventListener('change', event => { stopPlayback(); scenario(event.target.value); });
  $('playScenario').addEventListener('click', () => {
    if (playback) { stopPlayback(); return; }
    playbackStep = 0;
    scenario('NORMAL');
    text('playScenario', 'Pausar subida');
    playback = setInterval(() => {
      playbackStep += 1;
      const level = 5 + playbackStep;
      // Storyboard states, not physical risk thresholds for the real device.
      const status = playbackStep < 8 ? 'NORMAL' : playbackStep < 16 ? 'ATENCAO' : 'CRITICO';
      T.ingest(demo, { distancia: 30 - level, nivel_agua: level, status }, Date.now());
      $('scenario').value = status;
      render();
      if (playbackStep >= 20) stopPlayback();
    }, 1000);
  });
  $('acknowledge').addEventListener('click', () => {
    const state = current();
    if (!state.acknowledged) {
      state.acknowledged = true;
      T.event(state, 'Alerta reconhecido nesta interface; nenhum acionamento externo.', Date.now(), 'CRITICO');
      render();
    }
  });
  $('clearLogs').addEventListener('click', () => { current().events = []; render(); });
  window.addEventListener('pagehide', () => { stopped = true; clearTimeout(pollTimer); controller?.abort(); stopPlayback(); });
  window.addEventListener('pageshow', event => { if (event.persisted) { stopped = false; poll(); } });
  setupMap();
  render();
  poll();
})();

