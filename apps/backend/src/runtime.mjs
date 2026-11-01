export const SURFACE = "backend";

export function runtimeInfo(environment = process.env.MEDSUP_ENV ?? "local") {
  return Object.freeze({ surface: SURFACE, environment });
}
