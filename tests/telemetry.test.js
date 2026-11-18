'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const T = require('../telemetry.js');
const payload = (status = 'NORMAL') => ({ distancia: 20, nivel_agua: 10, porcentagem: 99, status });

test('normaliza estados e não usa percentual não calibrado', () => {
  assert.equal(T.validate(payload()).risk, 'NORMAL');
  assert.equal(T.classify(' atenção '), 'ATENCAO');
  assert.equal(T.classify('🚨 ALERTA CRÍTICO'), 'CRITICO');
  for (const status of ['sem risco', 'anormal', 'sensor com falha', 'desconhecido']) assert.equal(T.classify(status), 'UNKNOWN');
});
test('reconhece os três textos do firmware com variações de caixa e acentos', () => {
  const statuses = [
    ['Nível Normal', 'NORMAL'],
    ['Atenção: Elevação do Nível', 'ATENCAO'],
    ['ALERTA CRÍTICO: RISCO DE ENCHENTE!', 'CRITICO']
  ];
  for (const [status, risk] of statuses) {
    for (const variant of [status, status.toLowerCase(), status.toUpperCase(), status.normalize('NFD').replace(/[\u0300-\u036f]/g, ''), `  ${status}  `, status.replace(/ /g, '\u00a0'), status.replace(/ /g, '\u202f'), status.replace(/ /g, '\t'), status.replace(/ /g, '\n'), status.replace(/:/g, ':\u200b'), status.replace(/: /g, ':')]) {
      assert.equal(T.validate(payload(variant)).risk, risk, variant);
    }
  }
  assert.equal(T.classify('Sem ALERTA CRÍTICO: RISCO DE ENCHENTE!'), 'UNKNOWN');
});

test('rejeita dados inválidos sem converter null/string em zero', () => {
  for (const value of [null, [], {}, { ...payload(), distancia: '10' }, { ...payload(), distancia: -1 }, { ...payload(), distancia: NaN }, { ...payload(), nivel_agua: Infinity }, { ...payload(), status: null }]) assert.throws(() => T.validate(value));
  assert.equal(T.validate({ distancia: 0, status: 'NORMAL' }).level, null);
});

test('status desconhecido preserva texto recebido no evento para diagnóstico', () => {
  const state = T.createState();
  T.ingest(state, payload('Estado não documentado'), 1);
  assert.equal(state.reading.risk, 'UNKNOWN');
  assert.equal(state.events[0].message, 'Classificação recebida: Não reconhecido. Status recebido: Estado não documentado');
  T.ingest(state, payload('Estado não documentado'), 2);
  assert.equal(state.events.length, 1);
});
test('alertas por transição, reconhecimento e limite de memória', () => {
  const state = T.createState();
  T.ingest(state, payload('CRITICO'), 1);
  state.acknowledged = true;
  for (let i = 2; i < 200; i++) T.ingest(state, payload('CRITICO'), i);
  assert.equal(state.events.length, 1);
  assert.equal(state.acknowledged, true);
  assert.equal(state.history.length, 120);
  T.ingest(state, payload('NORMAL'), 200);
  T.ingest(state, payload('CRITICO'), 201);
  assert.equal(state.events.length, 3);
  assert.equal(state.acknowledged, false);
});
test('falha preserva último registro sem disponibilidade e recupera', () => {
  const state = T.createState();
  T.ingest(state, payload(), 10);
  T.fail(state, 'sem comunicação', 20);
  T.fail(state, 'sem comunicação', 30);
  assert.equal(state.available, false);
  assert.equal(state.receivedAt, 10);
  assert.equal(state.history.length, 1);
  assert.equal(state.events.length, 2);
  T.ingest(state, payload(), 40);
  assert.equal(state.available, true);
  assert.equal(state.error, '');
  assert.equal(state.receivedAt, 40);
});
test('fontes não compartilham histórico, leitura ou eventos', () => {
  const real = T.createState();
  const demo = T.createState();
  T.ingest(real, payload(), 10);
  const snapshot = JSON.stringify(real);
  T.ingest(demo, payload('CRITICO'), 20);
  T.fail(demo, 'desconectado', 30);
  assert.equal(JSON.stringify(real), snapshot);
});
