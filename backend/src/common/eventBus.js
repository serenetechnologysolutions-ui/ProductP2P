const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const { logger } = require('./logger');

// Procurement OS event backbone — deliberately the simplest thing that
// works: a durable event_log row (so "did X happen" survives a restart and
// is queryable/reportable) plus an in-process EventEmitter for dispatch. No
// broker (Kafka/RabbitMQ) by explicit product direction — this is a single
// Node process against a single database, and a broker would add
// operational complexity with no corresponding benefit here. Swappable for
// one later without touching any call site, since callers only ever see
// emitEvent()/onEvent().
const emitter = new EventEmitter();
emitter.setMaxListeners(100);

// Tracked separately from the emitter's own internals purely for the
// Module 8 "see what subscribes to what" visibility requirement — getEventSubscribers()
// reads this, not the emitter, so it stays a plain, inspectable array.
const subscriberRegistry = [];

async function emitEvent(eventType, payload = {}, conn) {
  const c = conn || pool;
  const id = uuidv4();
  try {
    await c.query(
      'INSERT INTO event_log (id, event_type, module_name, record_id, payload, status) VALUES (?, ?, ?, ?, ?, ?)',
      [id, eventType, payload.module_name || null, payload.record_id || null, JSON.stringify(payload), 'processed']
    );
  } catch (err) {
    logger.error('Failed to persist event_log row', { eventType, error: err.message });
  }
  emitter.emit(eventType, payload);
  return id;
}

// handlerName is purely descriptive (for the subscriber registry below) —
// the dispatch itself is keyed on eventType, same as any EventEmitter.
function onEvent(eventType, handlerName, handler) {
  subscriberRegistry.push({ event_type: eventType, handler_name: handlerName });
  emitter.on(eventType, (payload) => {
    // A subscriber's failure (sync throw or rejected promise) must never
    // propagate back through emit() into the business logic that called
    // emitEvent() — one bad listener shouldn't be able to fail a PR approval.
    try {
      Promise.resolve(handler(payload)).catch(err => {
        logger.error('Event subscriber threw', { eventType, handlerName, error: err.message });
      });
    } catch (err) {
      logger.error('Event subscriber threw synchronously', { eventType, handlerName, error: err.message });
    }
  });
}

function getEventSubscribers() {
  return subscriberRegistry;
}

module.exports = { emitEvent, onEvent, getEventSubscribers };
