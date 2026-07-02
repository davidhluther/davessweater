// One shared gate for the whole site: how many scored days a forecaster needs
// before its accuracy is presented as an established track record rather than a
// provisional running average. Under this bar a source is still shown, just
// labeled "gathering data", so a thin sample is never dressed up as a record.
// Lowered 14 → 9 on 2026-07-02 (owner call: the expanded roster ships to the
// main boards once it crosses 9 scored days).
export const MIN_SCORED_DAYS = 9;

// The headline rivalry, shown in the main Season Scoreboard (Open-Meteo vs
// Ray's, with Apple alongside). Everything else is "the rest of the field".
export const HEADLINE_SOURCES = new Set(["openmeteo", "raysweather", "apple_weather"]);

export const isProvisional = (days: number): boolean => days < MIN_SCORED_DAYS;
