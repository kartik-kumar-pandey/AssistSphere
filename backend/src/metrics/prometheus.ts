import client from 'prom-client';

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const activeSessionsGauge = new client.Gauge({
  name: 'active_sessions_total',
  help: 'Number of active support sessions',
  registers: [register],
});

export const connectedParticipantsGauge = new client.Gauge({
  name: 'connected_participants_total',
  help: 'Number of connected participants across all sessions',
  registers: [register],
});

export const errorsCounter = new client.Counter({
  name: 'errors_total',
  help: 'Total number of application errors',
  registers: [register],
});

export function incrementErrors() {
  errorsCounter.inc();
}
