/**
 * content.js v3 — Détection multi-stratégie par plateforme
 *
 * Pour chaque site, on utilise les vrais sélecteurs DOM connus,
 * avec fallback sur écoute bouton/clavier si l'observation DOM échoue.
 */

(function () {
  "use strict";

  if (window.__aiTrackerInjected) return;
  window.__aiTrackerInjected = true;

  function detectPlatform(url) {
    if (url.includes("chatgpt.com") || url.includes("chat.openai.com")) return "chatgpt";
    if (url.includes("claude.ai"))         return "claude";
    if (url.includes("gemini.google.com")) return "gemini";
    if (url.includes("mistral.ai"))        return "mistral";
    if (url.includes("perplexity.ai"))     return "perplexity";
    if (url.includes("copilot.microsoft")) return "copilot";
    if (url.includes("grok.x.ai") || url.includes("x.com/i/grok")) return "grok";
    if (url.includes("huggingface.co"))    return "huggingface";
    if (url.includes("poe.com"))           return "poe";
    return "default";
  }

  const platform = detectPlatform(window.location.href);

  // ── Sélecteurs DOM des messages utilisateur ──────────────────────────
  // Stratégie : détecter l'apparition d'un nouveau nœud = 1 message envoyé
  //
  // ChatGPT  : data-message-author-role="user"  (stable depuis 2023)
  // Claude   : [data-testid="user-message"]  OU  div.font-user-message
  //            OU les div dans le tour utilisateur :
  //            div[class*="Human"] dans la conversation
  // Gemini   : .conversation-turn .query-text  OU  user-query  OU
  //            div[class*="query"]
  // Mistral  : div[class*="UserMessage"]  OU  [data-role="user"]
  // Perplexity: [data-testid="query"]  OU  div[class*="UserMessage"]

  const USER_MSG_SELECTORS = {
    chatgpt: [
      '[data-message-author-role="user"]',
    ],
    claude: [
      '[data-testid="user-message"]',
      '.font-user-message',
      '[class*="HumanTurn"]',
      'div[class*="human-turn"]',
      // fallback large : tout div avec la classe contenant "user"
      'div[class*="User"][class*="Message"]',
    ],
    gemini: [
      'user-query',                        // custom element natif Gemini
      '.query-text',
      'div[class*="query-content"]',
      'div[class*="user-query"]',
      '[data-chunk-id]',                   // fallback chunks de requête
    ],
    mistral: [
      '[data-role="user"]',
      'div[class*="UserMessage"]',
      'div[class*="user-message"]',
    ],
    perplexity: [
      '[data-testid="query"]',
      'div[class*="UserMessage"]',
      'div[class*="human"]',
    ],
    copilot: [
      '[data-scenario="persona"][persona="user"]',
      'cib-chat-turn[data-author="user"]',
    ],
    grok: [
      '[class*="UserMessage"]',
      'div[data-testid*="human"]',
    ],
    huggingface: [
      '.from-human',
      '[class*="user-message"]',
      '[class*="UserMessage"]',
    ],
    poe: [
      '[class*="humanMessageBubble"]',
      '[class*="Message_human"]',
    ],
    default: [
      '[data-message-author-role="user"]',
      '[data-role="user"]',
      '.user-message',
    ],
  };

  // ── Sélecteurs bouton submit (fallback si DOM-watch échoue) ──────────
  const SUBMIT_SELECTORS = {
    chatgpt:    ['button[data-testid="send-button"]'],
    claude:     ['button[aria-label="Send Message"]', 'button[aria-label="Envoyer le message"]', 'button[data-testid="send-message"]'],
    gemini:     ['button[aria-label="Send message"]', 'button[aria-label="Envoyer"]', '.send-button'],
    mistral:    ['button[data-testid="send-button"]', 'button[type="submit"]'],
    perplexity: ['button[aria-label="Submit"]', 'button[type="submit"]'],
    copilot:    ['button[aria-label="Submit message"]'],
    grok:       ['button[type="submit"]'],
    huggingface:['button[type="submit"]'],
    poe:        ['button[class*="SendButton"]'],
    default:    ['button[type="submit"]', 'button[aria-label*="Send"]', 'button[aria-label*="Envoyer"]'],
  };

  // ── Sélecteurs textarea (fallback clavier) ────────────────────────────
  const TEXTAREA_SELECTORS = {
    chatgpt:    ['#prompt-textarea', 'div[contenteditable="true"]#prompt-textarea'],
    claude:     ['div[contenteditable="true"].ProseMirror', 'div[aria-label*="Message"][contenteditable="true"]'],
    gemini:     ['div[contenteditable="true"].ql-editor', 'rich-textarea div[contenteditable="true"]'],
    mistral:    ['textarea[id*="chat"]', 'textarea'],
    perplexity: ['textarea[placeholder*="Ask"]', 'textarea'],
    copilot:    ['cib-text-input textarea', 'textarea'],
    grok:       ['textarea'],
    huggingface:['textarea[id*="chat-input"]', 'textarea'],
    poe:        ['textarea[class*="GrowingTextArea"]', 'textarea'],
    default:    ['textarea', 'div[contenteditable="true"]'],
  };

  function getSelectors(map) {
    return map[platform] ?? map.default;
  }

  // ── Envoi au background ───────────────────────────────────────────────
  function notifyBackground(count = 1) {
    if (count <= 0) return;
    const msg = { type: "PROMPT_SENT", platform, url: window.location.href, count };
    if (typeof browser !== "undefined") {
      browser.runtime.sendMessage(msg).catch(() => {});
    } else {
      chrome.runtime.sendMessage(msg, () => { void chrome.runtime.lastError; });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // STRATÉGIE 1 — Observation DOM (principale)
  // Surveille l'apparition de nœuds "message utilisateur"
  // ════════════════════════════════════════════════════════════════════
  const seenMessages = new WeakSet();

  function scanNewUserMessages() {
    const selectors = getSelectors(USER_MSG_SELECTORS);
    let newCount = 0;
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((node) => {
        if (!seenMessages.has(node)) {
          seenMessages.add(node);
          newCount++;
        }
      });
    }
    return newCount;
  }

  // Scan initial : marquer les messages existants comme "déjà vus"
  // (on ne les compte pas, ils étaient là avant notre injection)
  function initialScan() {
    const selectors = getSelectors(USER_MSG_SELECTORS);
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((node) => seenMessages.add(node));
    }
  }

  let domScanTimeout = null;
  const domObserver = new MutationObserver(() => {
    clearTimeout(domScanTimeout);
    domScanTimeout = setTimeout(() => {
      const n = scanNewUserMessages();
      if (n > 0) notifyBackground(n);
    }, 400);
  });

  // ════════════════════════════════════════════════════════════════════
  // STRATÉGIE 2 — Bouton submit (fallback, debounce strict)
  // ════════════════════════════════════════════════════════════════════
  let lastSubmitTime = 0;
  const SUBMIT_DEBOUNCE = 3000;

  function onSubmitClick() {
    const now = Date.now();
    if (now - lastSubmitTime < SUBMIT_DEBOUNCE) return;
    lastSubmitTime = now;
    // On attend 500ms que le DOM se mette à jour,
    // et si la stratégie DOM n'a pas capté on envoie en fallback
    setTimeout(() => {
      const n = scanNewUserMessages();
      if (n > 0) notifyBackground(n);
      // Si toujours rien (sélecteur DOM inconnu), on compte 1 par clic
      else notifyBackground(1);
    }, 500);
  }

  function attachSubmitListeners() {
    const selectors = getSelectors(SUBMIT_SELECTORS);
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((btn) => {
        if (!btn.__aiTrackerBtn) {
          btn.__aiTrackerBtn = true;
          btn.addEventListener("click", onSubmitClick, true);
        }
      });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // STRATÉGIE 3 — Touche Entrée (fallback clavier, debounce strict)
  // ════════════════════════════════════════════════════════════════════
  let lastKeyTime = 0;

  function attachKeyListeners() {
    const selectors = getSelectors(TEXTAREA_SELECTORS);
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((el) => {
        if (!el.__aiTrackerKey) {
          el.__aiTrackerKey = true;
          el.addEventListener("keydown", (e) => {
            if (e.key !== "Enter" || e.shiftKey) return;
            const now = Date.now();
            if (now - lastKeyTime < SUBMIT_DEBOUNCE) return;
            lastKeyTime = now;
            setTimeout(() => {
              const n = scanNewUserMessages();
              if (n > 0) notifyBackground(n);
              else notifyBackground(1);
            }, 500);
          }, true);
        }
      });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // DÉMARRAGE
  // ════════════════════════════════════════════════════════════════════
  function start() {
    initialScan();

    // DOM observer toujours actif
    domObserver.observe(document.body, { childList: true, subtree: true });

    // Fallbacks clavier/bouton (re-attachés quand le DOM change)
    const fallbackObserver = new MutationObserver(() => {
      attachSubmitListeners();
      attachKeyListeners();
    });
    fallbackObserver.observe(document.body, { childList: true, subtree: true });

    attachSubmitListeners();
    attachKeyListeners();

    // Retry après 2s et 5s pour les SPA lentes
    setTimeout(() => { attachSubmitListeners(); attachKeyListeners(); }, 2000);
    setTimeout(() => { attachSubmitListeners(); attachKeyListeners(); }, 5000);
  }

  if (document.body) {
    start();
  } else {
    document.addEventListener("DOMContentLoaded", start);
  }

})();
