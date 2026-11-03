const SAFE_FIELDS = Object.freeze([
  "requestId",
  "action",
  "outcome",
  "errorCode",
  "durationMs",
  "status",
  "method",
]);

function safePrimitive(value) {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

export function createStructuredLogger({ sink, clock = Date.now }) {
  if (typeof sink !== "function") throw new TypeError("A structured log sink is required");

  return Object.freeze({
    log(event, fields = {}) {
      if (typeof event !== "string" || !/^[a-z0-9_.-]{1,80}$/.test(event)) {
        throw new TypeError("Log event must be a bounded identifier");
      }

      const entry = {
        timestamp: new Date(clock()).toISOString(),
        event,
      };
      for (const key of SAFE_FIELDS) {
        if (Object.hasOwn(fields, key) && safePrimitive(fields[key])) entry[key] = fields[key];
      }
      sink(Object.freeze(entry));
    },
  });
}
