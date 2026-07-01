// Display metadata for the independent forecasters that feed the Dave's Sweater
// Index. Logos live in /public/assets/forecasters and are shown small and
// uniform in the hero strip. Homepage links are rel="nofollow" (see
// ForecasterLogos) — we point at the sources without passing them link equity.
//
// Insertion order here is the display order in the strip.
export interface ForecasterMeta {
  label: string;
  homepage: string;
  logo: string; // path under /public
}

export const FORECASTERS: Record<string, ForecasterMeta> = {
  openmeteo: {
    label: "Open-Meteo",
    homepage: "https://open-meteo.com",
    logo: "/assets/forecasters/openmeteo.jpg",
  },
  nws: {
    label: "National Weather Service",
    homepage: "https://www.weather.gov",
    logo: "/assets/forecasters/nws.png",
  },
  metno: {
    label: "MET Norway",
    homepage: "https://www.met.no",
    logo: "/assets/forecasters/metno.png",
  },
  openweathermap: {
    label: "OpenWeather",
    homepage: "https://openweathermap.org",
    logo: "/assets/forecasters/openweathermap.png",
  },
  weatherapi: {
    label: "WeatherAPI",
    homepage: "https://www.weatherapi.com",
    logo: "/assets/forecasters/weatherapi.png",
  },
  visualcrossing: {
    label: "Visual Crossing",
    homepage: "https://www.visualcrossing.com",
    logo: "/assets/forecasters/visualcrossing.png",
  },
  tomorrowio: {
    label: "Tomorrow.io",
    homepage: "https://www.tomorrow.io",
    logo: "/assets/forecasters/tomorrowio.png",
  },
  googleweather: {
    label: "Google",
    homepage: "https://www.google.com/search?q=weather",
    logo: "/assets/forecasters/googleweather.svg",
  },
};
