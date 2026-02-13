/**
 * popup.js v3 — Vue d'ensemble + Stats (historique, courbe, semaine, top)
 */

const PLATFORM_ICONS = {
  chatgpt:"🤖", claude:"🌀", gemini:"✨", mistral:"🌬️",
  perplexity:"🔍", copilot:"🪟", grok:"𝕏", huggingface:"🤗",
  poe:"💬", default:"🧠",
};
const ENERGY = {
  chatgpt:0.0029, claude:0.0025, gemini:0.0025, mistral:0.0008,
  perplexity:0.0035, copilot:0.0029, grok:0.0025, huggingface:0.0015,
  poe:0.0020, default:0.0020,
};
const CO2_PER_KWH = 475;

const api = typeof browser !== "undefined" ? browser : chrome;

function sendMsg(msg) {
  return new Promise((resolve, reject) => {
    api.runtime.sendMessage(msg, (r) => {
      if (api.runtime.lastError) reject(api.runtime.lastError);
      else resolve(r);
    });
  });
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatTreeDays(d) {
  if (d < 0.001) return "0.000";
  if (d >= 1000) return Math.round(d).toLocaleString("fr-FR");
  if (d >= 10)   return d.toFixed(1);
  return d.toFixed(3);
}
function getTreeEmoji(d) {
  if (d >= 30) return "🌲🌲🌲";
  if (d >= 7)  return "🌳🌳";
  if (d >= 1)  return "🌳";
  if (d >= 0.1)return "🌱";
  return "🌿";
}
function labelEnergy(kwh) {
  const m = Math.round(kwh * 100 * 60);
  if (m < 1)  return "Moins d'une seconde d'ampoule";
  if (m < 60) return `Équiv. à ${m} min d'ampoule LED`;
  return `Équiv. à ${(kwh*100).toFixed(1)} h d'ampoule LED`;
}
function labelCo2(g) {
  const m = Math.round((g/120)*1000);
  if (m < 1)    return "Moins d'un mètre en voiture";
  if (m < 1000) return `Comme rouler ${m} m en voiture`;
  return `Comme rouler ${(m/1000).toFixed(1)} km en voiture`;
}
function labelWater(ml) {
  if (ml < 5)   return "Moins d'une goutte";
  if (ml < 30)  return "Quelques gorgées d'eau";
  if (ml < 250) return `Environ ${Math.round(ml/25)} cuillères à soupe`;
  if (ml < 500) return "Un grand verre d'eau";
  if (ml < 1500)return `${(ml/1000).toFixed(1)} L — une petite bouteille`;
  return `${(ml/1000).toFixed(1)} L d'eau de datacenter`;
}
function labelPhones(n) {
  if (n < 0.01) return "Une fraction de recharge";
  if (n < 1)    return `${Math.round(n*100)}% d'une recharge complète`;
  return `Recharger ${n.toFixed(1)}× votre téléphone`;
}
function formatDate(iso) {
  if (!iso) return "Depuis aujourd'hui";
  try {
    const d = new Date(iso);
    return "Depuis le " + d.toLocaleDateString("fr-FR",{day:"2-digit",month:"short"});
  } catch { return "Depuis aujourd'hui"; }
}

// ── Calculs historique ────────────────────────────────────────────────

/** Retourne la clé YYYY-MM-DD pour un décalage de N jours */
function dateKey(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Total de requêtes sur une plage de clés */
function sumHistory(history, keys) {
  let total = 0;
  for (const k of keys) {
    if (!history[k]) continue;
    for (const v of Object.values(history[k])) total += v;
  }
  return total;
}

/** Génère les clés des N derniers jours */
function lastNDays(n) {
  return Array.from({ length: n }, (_, i) => dateKey(-(n - 1 - i)));
}

/** Calcul CO₂ pour un ensemble de jours */
function co2ForKeys(history, keys) {
  let co2 = 0;
  for (const k of keys) {
    if (!history[k]) continue;
    for (const [platform, count] of Object.entries(history[k])) {
      const kwh = (ENERGY[platform] ?? ENERGY.default) * count;
      co2 += kwh * CO2_PER_KWH;
    }
  }
  return co2;
}

/** Lundi de la semaine courante */
function weekKeys(offsetWeeks = 0) {
  const now = new Date();
  const day = now.getDay() || 7; // 1=lun ... 7=dim
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day - 1) + offsetWeeks * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

/** Top plateformes sur un mois courant */
function topThisMonth(history) {
  const now = new Date();
  const prefix = now.toISOString().slice(0, 7); // "2025-06"
  const totals = {};
  for (const [day, platforms] of Object.entries(history)) {
    if (!day.startsWith(prefix)) continue;
    for (const [platform, count] of Object.entries(platforms)) {
      totals[platform] = (totals[platform] || 0) + count;
    }
  }
  return Object.entries(totals).sort(([,a],[,b]) => b - a);
}

// ── Rendu Vue d'ensemble ──────────────────────────────────────────────

function renderOverview(stats, impacts) {
  document.getElementById("treeVisual").textContent    = getTreeEmoji(impacts.treeDays);
  document.getElementById("heroTreeDays").textContent  = formatTreeDays(impacts.treeDays);
  const r = impacts.requests;
  document.getElementById("heroRequests").textContent  =
    r === 0 ? "0 requête envoyée" : r === 1 ? "1 requête IA envoyée" : `${r} requêtes IA envoyées`;

  document.getElementById("metricEnergy").textContent  = impacts.energyKwh.toFixed(5);
  document.getElementById("labelEnergy").textContent   = labelEnergy(impacts.energyKwh);

  const co2Big = impacts.co2g >= 1000;
  document.getElementById("metricCo2").textContent     = co2Big ? impacts.co2kg.toFixed(3) : impacts.co2g.toFixed(1);
  document.getElementById("unitCo2").textContent       = co2Big ? "kg de CO₂ émis" : "g de CO₂ émis";
  document.getElementById("labelCo2").textContent      = labelCo2(impacts.co2g);

  const waterBig = impacts.waterL >= 1;
  document.getElementById("metricWater").textContent   = waterBig ? impacts.waterL.toFixed(2) : impacts.waterMl.toFixed(0);
  document.getElementById("unitWater").textContent     = waterBig ? "litres d'eau utilisés" : "mL d'eau utilisés";
  document.getElementById("labelWater").textContent    = labelWater(impacts.waterMl);

  document.getElementById("metricPhones").textContent  = impacts.smartphones.toFixed(2);
  document.getElementById("labelPhones").textContent   = labelPhones(impacts.smartphones);

  // Plateformes
  const container = document.getElementById("platformsList");
  const platforms = Object.entries(stats)
    .filter(([k]) => !k.startsWith("_")).sort(([,a],[,b]) => b - a);
  if (!platforms.length) {
    container.innerHTML = '<div class="no-data">Aucune activité détectée.</div>'; return;
  }
  container.innerHTML = "";
  const total = platforms.reduce((s,[,n]) => s+n, 0);
  platforms.forEach(([platform, count]) => {
    const row = document.createElement("div");
    row.className = "platform-row";
    const pct = total > 0 ? Math.round((count/total)*100) : 0;
    row.innerHTML = `
      <span class="platform-icon">${PLATFORM_ICONS[platform]??PLATFORM_ICONS.default}</span>
      <span class="platform-name">${platform}</span>
      <span class="platform-count">${count} msg · ${pct}%</span>`;
    container.appendChild(row);
  });
}

// ── Rendu Statistiques ────────────────────────────────────────────────

function renderStats(history) {
  // ── Comparatif semaines ──
  const currKeys = weekKeys(0);
  const prevKeys = weekKeys(-1);
  const currSum  = sumHistory(history, currKeys);
  const prevSum  = sumHistory(history, prevKeys);
  const currCo2  = co2ForKeys(history, currKeys);
  const prevCo2  = co2ForKeys(history, prevKeys);

  document.getElementById("weekCurr").textContent    = currSum;
  document.getElementById("weekPrev").textContent    = prevSum;
  document.getElementById("weekCurrCo2").textContent = `${currCo2.toFixed(1)} g CO₂`;
  document.getElementById("weekPrevCo2").textContent = `${prevCo2.toFixed(1)} g CO₂`;

  const deltaEl = document.getElementById("weekDelta");
  if (prevSum === 0 && currSum === 0) {
    deltaEl.textContent = ""; deltaEl.className = "week-delta";
  } else if (prevSum === 0) {
    deltaEl.textContent = "Nouveau !"; deltaEl.className = "week-delta up";
  } else {
    const pct = Math.round(((currSum - prevSum) / prevSum) * 100);
    if (pct > 0) {
      deltaEl.textContent = `+${pct}%`; deltaEl.className = "week-delta up";
      document.getElementById("weekArrow").textContent = "↗";
    } else if (pct < 0) {
      deltaEl.textContent = `${pct}%`;  deltaEl.className = "week-delta down";
      document.getElementById("weekArrow").textContent = "↘";
    } else {
      deltaEl.textContent = "="; deltaEl.className = "week-delta same";
    }
  }

  // ── Courbe 14 jours ──
  const days14  = lastNDays(14);
  const values  = days14.map(k => sumHistory(history, [k]));
  renderChart(days14, values);

  // ── Top plateforme du mois ──
  renderTopPlatform(history);
}

function renderChart(days, values) {
  const svg    = document.getElementById("chartSvg");
  const labels = document.getElementById("chartLabels");
  const W = 288, H = 80, PAD = 8;
  const max = Math.max(...values, 1);
  const n   = values.length;

  // Points
  const pts = values.map((v, i) => {
    const x = PAD + (i / (n - 1)) * (W - PAD * 2);
    const y = PAD + (1 - v / max) * (H - PAD * 2);
    return [x, y];
  });

  // Zone remplie sous la courbe
  const areaPath = [
    `M ${pts[0][0]} ${H}`,
    ...pts.map(([x, y]) => `L ${x} ${y}`),
    `L ${pts[n-1][0]} ${H}`,
    "Z"
  ].join(" ");

  // Ligne
  const linePath = pts.map(([x,y],i) => `${i===0?"M":"L"} ${x} ${y}`).join(" ");

  svg.innerHTML = `
    <defs>
      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#4ade80" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#4ade80" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="${areaPath}" fill="url(#areaGrad)"/>
    <path d="${linePath}" fill="none" stroke="#4ade80" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${pts.map(([x,y], i) => values[i] > 0
      ? `<circle cx="${x}" cy="${y}" r="2.5" fill="#4ade80"/>`
      : ``).join("")}
  `;

  // Labels : afficher seulement le 1er, milieu, dernier
  labels.innerHTML = "";
  const showIdx = [0, Math.floor((n-1)/2), n-1];
  days.forEach((day, i) => {
    const lbl = document.createElement("span");
    lbl.className = "chart-lbl";
    lbl.textContent = showIdx.includes(i) ? day.slice(5) : ""; // "MM-DD"
    labels.appendChild(lbl);
  });
}

function renderTopPlatform(history) {
  const container = document.getElementById("topPlatform");
  const top = topThisMonth(history).slice(0, 3);
  if (!top.length) {
    container.innerHTML = '<div class="no-data">Pas encore de données ce mois-ci.</div>';
    return;
  }
  const maxCount = top[0][1];
  container.innerHTML = top.map(([platform, count], i) => `
    <div class="top-row">
      <span class="top-rank">#${i+1}</span>
      <span class="top-icon">${PLATFORM_ICONS[platform]??PLATFORM_ICONS.default}</span>
      <div class="top-info">
        <div class="top-name">${platform}</div>
        <div class="top-msgs">${count} message${count>1?"s":""} ce mois</div>
      </div>
      <div class="top-bar-wrap">
        <div class="top-bar-bg">
          <div class="top-bar-fill" style="width:${Math.round((count/maxCount)*100)}%"></div>
        </div>
      </div>
    </div>`).join("");
}

// ── Chargement principal ──────────────────────────────────────────────

async function loadData() {
  try {
    const resp = await sendMsg({ type: "GET_STATS" });
    if (!resp) return;
    const { stats, history, impacts, startDate } = resp;
    renderOverview(stats, impacts);
    renderStats(history);
    document.getElementById("startDate").textContent = formatDate(startDate);
  } catch (err) {
    console.error("[AI Tracker]", err);
  }
}

// ── Tabs ──────────────────────────────────────────────────────────────

function initTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    });
  });
}

// ── Reset ─────────────────────────────────────────────────────────────

function showResetModal() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <h3>Remettre à zéro ?</h3>
      <p>Toutes vos statistiques et l'historique seront effacés.</p>
      <div class="modal-btns">
        <button class="btn-cancel" id="cancelReset">Annuler</button>
        <button class="btn-confirm" id="confirmReset">Effacer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById("cancelReset").addEventListener("click", () => overlay.remove());
  document.getElementById("confirmReset").addEventListener("click", async () => {
    try { await sendMsg({ type:"RESET_STATS" }); overlay.remove(); await loadData(); }
    catch { overlay.remove(); }
  });
}

// ── Init ──────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  loadData();
  document.getElementById("btnReset").addEventListener("click", showResetModal);
});
