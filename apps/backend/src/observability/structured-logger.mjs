import { ERROR_CODES } from "@medsup/contracts";

export const LOG_EVENTS = Object.freeze({
  IDENTITY_AUTHENTICATION_FAILED: "identity.authentication.failed",
});

export const LOG_ACTIONS = Object.freeze({
  AUTHENTICATE: "AUTHENTICATE",
});

export const LOG_OUTCOMES = Object.freeze({
  REJECTED: "REJECTED",
});

const VALUE_VALIDATORS = Object.freeze({
  action: (value) => Object.values(LOG_ACTIONS).includes(value),
  outcome: (value) => Object.values(LOG_OUTCOMES).includes(value),
  errorCode: (value) => Object.values(ERROR_CODES).includes(value),
  durationMs: (value) => Number.isSafeInteger(value) && value >= 0 && value <= 86_400_000,
});

const VALID_EVENTS = new Set(Object.values(LOG_EVENTS));

export function createStructuredLogger({ sink, clock = Date.now }) {
  if (typeof sink !== "function") throw new TypeError("A structured log sink is required");

  return Object.freeze({
    log(event, fields = {}) {
      if (!VALID_EVENTS.has(event)) {
        throw new TypeError("Log event is not allow-listed");
      }
      if (fields === null || typeof fields !== "object" || Array.isArray(fields)) {
        throw new TypeError("Structured log fields must be an object");
      }

      for (const [key, value] of Object.entries(fields)) {
        const validate = VALUE_VALIDATORS[key];
        if (!validate || !validate(value)) {
          throw new TypeError(`Structured log field is not allow-listed: ${key}`);
        }
      }

      sink(Object.freeze({
        timestamp: new Date(clock()).toISOString(),
        event,
        ...fields,
      }));
    },
  });
}
