/**
 * utils.js — Calculs environnementaux
 *
 * Sources & hypothèses :
 * - ~0.001 kWh par requête IA standard (Goldman Sachs, 2024 : ~10x une recherche Google)
 * - Mix électrique mondial moyen : 475 gCO₂eq/kWh (IEA 2023)
 * - Consommation eau datacenter : ~1.8L par kWh (Google Environmental Report 2023)
 * - Un arbre absorbe ~21 kg CO₂/an → 21000/365 = ~57.5 gCO₂/jour
 * - Voiture essence : 120 gCO₂/km (moyenne européenne)
 * - Recharge smartphone : ~0.012 kWh (iPhone 15 batterie 3.5Wh, rendement 70%)
 */

// Énergie par requête en kWh selon le modèle détecté
const ENERGY_PER_REQUEST = {
  // GPT-4 class (très gourmand)
  "chatgpt":    0.0029,
  "gpt-4":      0.0029,
  // Claude (Anthropic, ~similaire)
  "claude":     0.0025,
  // Gemini Pro
  "gemini":     0.0025,
  // Mistral (plus léger)
  "mistral":    0.0008,
  // Perplexity (inclut recherche web)
  "perplexity": 0.0035,
  // Copilot (GPT-4 based)
  "copilot":    0.0029,
  // Grok
  "grok":       0.0025,
  // HuggingFace (variable, on prend moyen)
  "huggingface":0.0015,
  // Poe (variable)
  "poe":        0.0020,
  // Défaut
  "default":    0.0020,
};

// Constantes
const CO2_PER_KWH       = 475;    // gCO₂/kWh (IEA 2023, mix mondial)
const WATER_PER_KWH     = 1800;   // mL/kWh
const CO2_TREE_DAY      = 57.53;  // gCO₂ absorbé par un arbre par jour
const CO2_PER_KM_CAR    = 120;    // gCO₂/km (voiture essence, moyenne EU)
const KWH_SMARTPHONE    = 0.012;  // kWh pour une recharge complète

/**
 * Détecte la plateforme IA depuis l'URL
 */
export function detectPlatform(url) {
  if (!url) return "default";
  if (url.includes("chatgpt.com") || url.includes("chat.openai.com")) return "chatgpt";
  if (url.includes("claude.ai"))        return "claude";
  if (url.includes("gemini.google.com"))return "gemini";
  if (url.includes("mistral.ai"))       return "mistral";
  if (url.includes("perplexity.ai"))    return "perplexity";
  if (url.includes("copilot.microsoft"))return "copilot";
  if (url.includes("grok.x.ai") || url.includes("x.com/i/grok")) return "grok";
  if (url.includes("huggingface.co"))   return "huggingface";
  if (url.includes("poe.com"))          return "poe";
  return "default";
}

/**
 * Énergie consommée en kWh pour N requêtes sur une plateforme
 */
export function calcEnergy(requests, platform = "default") {
  const kwh = ENERGY_PER_REQUEST[platform] ?? ENERGY_PER_REQUEST.default;
  return requests * kwh;
}

/**
 * Retourne tous les équivalents environnementaux
 */
export function calcImpacts(requests, platform = "default") {
  const energyKwh   = calcEnergy(requests, platform);
  const co2g        = energyKwh * CO2_PER_KWH;
  const waterMl     = energyKwh * WATER_PER_KWH;
  const treeDays    = co2g / CO2_TREE_DAY;
  const carKm       = co2g / CO2_PER_KM_CAR;
  const smartphones = energyKwh / KWH_SMARTPHONE;

  return {
    requests,
    platform,
    energyKwh:    round(energyKwh, 5),
    co2g:         round(co2g, 2),
    co2kg:        round(co2g / 1000, 5),
    waterMl:      round(waterMl, 1),
    waterL:       round(waterMl / 1000, 3),
    treeDays:     round(treeDays, 3),
    carKm:        round(carKm, 3),
    smartphones:  round(smartphones, 2),
  };
}

/**
 * Calcul des impacts cumulés depuis un objet stats stocké
 * stats = { [platform]: count, ... }
 */
export function calcTotalImpacts(stats) {
  let totalRequests  = 0;
  let totalEnergyKwh = 0;
  let totalCo2g      = 0;
  let totalWaterMl   = 0;

  for (const [platform, count] of Object.entries(stats)) {
    if (platform === "_total") continue;
    const energy = calcEnergy(count, platform);
    totalRequests  += count;
    totalEnergyKwh += energy;
    totalCo2g      += energy * CO2_PER_KWH;
    totalWaterMl   += energy * WATER_PER_KWH;
  }

  const treeDays   = totalCo2g / CO2_TREE_DAY;
  const carKm      = totalCo2g / CO2_PER_KM_CAR;
  const smartphones = totalEnergyKwh / KWH_SMARTPHONE;

  return {
    requests:    totalRequests,
    energyKwh:   round(totalEnergyKwh, 5),
    co2g:        round(totalCo2g, 2),
    co2kg:       round(totalCo2g / 1000, 5),
    waterMl:     round(totalWaterMl, 1),
    waterL:      round(totalWaterMl / 1000, 3),
    treeDays:    round(treeDays, 4),
    carKm:       round(carKm, 3),
    smartphones: round(smartphones, 2),
  };
}

function round(n, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}
