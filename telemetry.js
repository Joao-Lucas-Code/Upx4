/* Pure telemetry rules, shared by the browser and dependency-free Node tests. */
(function (root) {
  'use strict';
  const LIMIT = 120;
  const LABELS = { NORMAL: 'Normal', ATENCAO: 'Atenção', CRITICO: 'Crítico', UNKNOWN: 'Não reconhecido' };
  function classify(status) {
    if (typeof status !== 'string') return 'UNKNOWN';
    const normalized = status.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
    // Explicit vocabulary only; unknown text must never imply safety.
    // Normalize separators before filtering: NBSP, tabs and line breaks must
    // not join words ("DO\u00a0NIVEL" used to become "DONIVEL").
    const clean = normalized.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
      .replace(/[^A-Z0-9]+/g, ' ').trim();
    if (['CRITICO', 'ALERTA', 'RISCO', 'ALERTA CRITICO', 'RISCO DE ALAGAMENTO', 'RISCO DE ENCHENTE', 'ALERTA CRITICO RISCO DE ENCHENTE'].includes(clean)) return 'CRITICO';
    if (['ATENCAO', 'NIVEL DE ATENCAO', 'ESTADO DE ATENCAO', 'ATENCAO ELEVACAO DO NIVEL'].includes(clean)) return 'ATENCAO';
    if (['NORMAL', 'NIVEL NORMAL'].includes(clean)) return 'NORMAL';
    return 'UNKNOWN';
  }
  function validate(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Registro ausente ou inválido.');
    const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
    if (!number(data.distancia)) throw new Error('Distância inválida.');
    if (data.nivel_agua != null && !number(data.nivel_agua)) throw new Error('Nível da água inválido.');
    if (typeof data.status !== 'string' || !data.status.trim() || data.status.length > 160) throw new Error('Status ausente ou inválido.');
    return { distance: data.distancia, level: data.nivel_agua ?? null, risk: classify(data.status), rawStatus: data.status };
  }
  function createState() {
    return { reading: null, receivedAt: null, available: false, error: '', history: [], events: [], transition: null, acknowledged: false };
  }
  function event(state, message, at, risk = 'UNKNOWN') {
    state.events.unshift({ message, at, risk });
    state.events.length = Math.min(state.events.length, 50);
  }
  function ingest(state, payload, at) {
    const reading = validate(payload);
    if (state.transition !== reading.risk) {
      const detail = reading.risk === 'UNKNOWN' ? ` Status recebido: ${reading.rawStatus}` : '';
      event(state, `Classificação recebida: ${LABELS[reading.risk]}.${detail}`, at, reading.risk);
      state.acknowledged = false;
    }
    state.transition = reading.risk;
    state.reading = reading;
    state.receivedAt = at;
    state.available = true;
    state.error = '';
    state.history.push({ at, level: reading.level });
    if (state.history.length > LIMIT) state.history.shift();
  }
  function fail(state, message, at) {
    if (state.transition !== 'OFFLINE') event(state, message, at);
    state.transition = 'OFFLINE';
    state.available = false;
    state.error = message;
  }
  const api = { LIMIT, LABELS, classify, validate, createState, event, ingest, fail };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SentinelaTelemetry = api;
})(globalThis);
