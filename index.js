(() => {
  const EXTENSION_NAME = "ST-Ko-Localizer";
  const EXTENSION_FOLDER = "ST-Ko-Localizer";
  const BASE_PATH = `/scripts/extensions/third-party/${EXTENSION_FOLDER}`;
  const DICTIONARY_FILES = [
    "dictionaries/cocktail.js",
    "dictionaries/JS-Slash-Runner.js",
    "dictionaries/ST-Extension-Cleanup-World-Lorebook.js",
    "dictionaries/chat-history-backup.js",
    "dictionaries/st-memory-enhancement.js",
    "dictionaries/minimax-tts.js",
    "dictionaries/horae.js"
  ];
  const DICT_DETECTORS = {
    cocktail: () =>
      Boolean(
        document.getElementById("cocktail_drawer") ||
          document.getElementById("cocktail_settings_root")
      ),
    "JS-Slash-Runner": () =>
      Boolean(
        document.getElementById("tavern_helper") ||
          document.querySelector("#extensions_settings #tavern_helper, #extensions_settings2 #tavern_helper")
      ),
    "ST-Extension-Cleanup-World-Lorebook": () =>
      Boolean(
        document.getElementById("world_info_cleanup_enabled") ||
          document.getElementById("world_info_cleanup_manual")
      ),
    "chat-history-backup": () =>
      Boolean(
        document.getElementById("chat_auto_backup_settings") ||
          document.getElementById("chat_backup_list") ||
          document.getElementById("chat_backup_manual_backup")
      ),
    "st-memory-enhancement": () =>
      Boolean(
        document.querySelector(".memory_enhancement_container") ||
          document.getElementById("memory_enhancement_settings_inline_drawer_content") ||
          document.getElementById("table_manager_container") ||
          document.getElementById("inline_drawer_header_content")
      ),
    "minimax-quote-tts": () =>
      Boolean(
        document.getElementById("mm_wand_item") ||
          document.getElementById("mm-config-mask") ||
          document.getElementById("vc-fab")
      ),
    "SillyTavern-Horae": () =>
      Boolean(
        document.getElementById("horae_drawer") ||
          document.getElementById("horae_drawer_icon") ||
          document.querySelector('[id^="horae-tab-"]')
      ),
  };

  if (globalThis.__stKoUiLocalizerLoaded) return;
  globalThis.__stKoUiLocalizerLoaded = true;

  const store = (globalThis.__stKoLocalizerDictStore ??= {});

  function getActiveDictionaryNames() {
    const active = new Set();

    for (const dictName of Object.keys(store)) {
      const detector = DICT_DETECTORS[dictName];
      if (!detector) {
        active.add(dictName);
        continue;
      }

      let enabled = false;
      try {
        enabled = Boolean(detector());
      } catch {
        enabled = false;
      }

      if (enabled) active.add(dictName);
    }

    return active;
  }

  function buildMaps(activeDictionaries) {
    const exact = new Map();
    const override = new Map();
    const regex = [];

    function addLookupEntry(map, source, translated) {
      map.set(source, translated);
      const normalized = normalizeLookupKey(source);
      if (normalized && normalized !== source) map.set(normalized, translated);
    }

    for (const [dictName, dict] of Object.entries(store)) {
      if (!activeDictionaries.has(dictName)) continue;

      
      for (const entry of dict.exactEntries ?? []) {
        if (Array.isArray(entry) && entry.length >= 2 && entry[0] && entry[1]) {
          addLookupEntry(exact, entry[0], entry[1]);
        }
      }
      
      for (const entry of dict.overrideEntries ?? []) {
        if (Array.isArray(entry) && entry.length >= 2 && entry[0] && entry[1]) {
          addLookupEntry(override, entry[0], entry[1]);
        }
      }
      
      for (const rule of dict.regexRules ?? []) {
        if (rule.pattern && rule.replace) {
          try {
            regex.push({
              re: new RegExp(rule.pattern, rule.flags ?? ""),
              replace: rule.replace,
            });
          } catch (e) {
            console.warn(`[${EXTENSION_NAME}] 잘못된 정규식 패턴 무시:`, rule.pattern, e);
          }
        }
      }
    }

    return {exact, override, regex};
  }

  
  let EXACT_MAP = new Map();
  let OVERRIDE_MAP = new Map();
  let REGEX_RULES = [];

  
  let lastStoreSize = 0;
  let lastActiveDictSignature = "";

  async function loadDictionaries() {
    async function loadOne(relativePath) {
      const src = `${BASE_PATH}/${relativePath}`;

      if (document.querySelector(`script[data-st-ko-localizer-dict="${src}"]`)) {
        return true;
      }

      const loaded = await new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = src;
        script.async = false;
        script.dataset.stKoLocalizerDict = src;
        script.onload = () => resolve(true);
        script.onerror = () => {
          script.remove();
          resolve(false);
        };
        document.head.appendChild(script);
      });

      if (!loaded) {
        console.warn(`[${EXTENSION_NAME}] 사전 파일 로드 실패: ${relativePath}`);
      }
      return loaded;
    }

    await Promise.all(DICTIONARY_FILES.map((file) => loadOne(file)));
  }

  function refreshMapsIfNeeded() {
    const currentSize = Object.keys(store).length;
    const activeDicts = getActiveDictionaryNames();
    const activeSignature = [...activeDicts].sort().join("|");

    if (currentSize !== lastStoreSize || activeSignature !== lastActiveDictSignature) {
      lastStoreSize = currentSize;
      lastActiveDictSignature = activeSignature;
      const {exact, override, regex} = buildMaps(activeDicts);
      EXACT_MAP = exact;
      OVERRIDE_MAP = override;
      REGEX_RULES = regex;
      return true; 
    }
    return false;
  }

  const ATTR_NAMES = ["title", "placeholder", "aria-label"];

  
  
  const TRANSLATION_ROOT_SELECTOR = [
    "#cocktail_drawer",
    "#cocktail_settings_root",
    "#tavern_helper",
    "#world_info_cleanup_enabled",
    "#world_info_cleanup_manual",
    "#chat_auto_backup_settings",
    "#chat_backup_list",
    "#chat_backup_manual_backup",
    ".backup_help_popup",
    "#dialogue_popup",
    ".memory_enhancement_container",
    "#memory_enhancement_settings_inline_drawer_content",
    "#table_manager_container",
    "#inline_drawer_header_content",
    "#mm_wand_item",
    "#mm-config-mask",
    "#vc-fab",
    "#horae_drawer",
    "#horae_drawer_icon",
    '[id^="horae-tab-"]',
    ".horae-message-panel",
  ].join(",");

  const SKIP_TEXT_SELECTORS = ["script", "style", "code", "pre", "textarea", '[contenteditable="true"]', ".mes", ".mes_text", ".mes_block", "#chat", ".swipe_right", ".swipe_left"].join(",");
  const SKIP_ATTR_SELECTORS = ["script", "style", "code", "pre", ".mes", ".mes_text", ".mes_block", "#chat", ".swipe_right", ".swipe_left"].join(",");

  function hasChinese(str) {
    return /[\u3400-\u9FFF]/.test(str);
  }

  function normalizeLookupKey(str) {
    if (typeof str !== "string") return "";
    return str.replace(/\s+/g, " ").trim();
  }

  function isHoraeElement(el) {
    if (!(el instanceof Element)) return false;
    return Boolean(
      el.closest(".horae-message-panel") ||
        el.closest('[id^="horae-"]') ||
        el.closest('[class*="horae"]')
    );
  }

  function shouldTranslateElement(el) {
    if (!(el instanceof Element)) return false;
    
    if (el.closest(".backup_help_popup")) return true;
    
    if (isHoraeElement(el)) return true;
    if (el.closest(SKIP_TEXT_SELECTORS)) return false;
    return true;
  }

  function translateString(input) {
    if (typeof input !== "string" || input.length === 0) return input;

    if (input.includes("当前版本") && input.includes("最新版本") && input.includes("是否现在更新")) {
      return input
        .replace(/当前版本[:：]\s*/g, "현재 버전: ")
        .replace(/最新版本[:：]\s*/g, "최신 버전: ")
        .replace(/是否现在更新[？?]?/g, "지금 업데이트하시겠습니까?");
    }

    const match = input.match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (match) {
      const [, leading, core, trailing] = match;
      const coreTrimmed = core.trim();
      const coreNormalized = normalizeLookupKey(core);
      const translated =
        OVERRIDE_MAP.get(core) ||
        OVERRIDE_MAP.get(coreTrimmed) ||
        OVERRIDE_MAP.get(coreNormalized) ||
        EXACT_MAP.get(core) ||
        EXACT_MAP.get(coreTrimmed) ||
        EXACT_MAP.get(coreNormalized);
      if (translated) return leading + translated + trailing;
    }

    for (const rule of REGEX_RULES) {
      
      
      rule.re.lastIndex = 0;
      if (rule.re.test(input)) {
        rule.re.lastIndex = 0;
        return input.replace(rule.re, rule.replace);
      }
    }

    return input;
  }

  function translateTextNode(textNode) {
    if (!(textNode instanceof Text)) return;
    const parent = textNode.parentElement;
    if (!parent || !shouldTranslateElement(parent)) return;
    const isHelpPopup = Boolean(parent.closest(".backup_help_popup"));

    const before = textNode.nodeValue;
    if (!before || (!hasChinese(before) && !isHelpPopup)) return;

    const after = translateString(before);
    if (after !== before) textNode.nodeValue = after;
  }

  function translateAttributes(el) {
    if (!(el instanceof Element)) return;
    if (
      !el.closest(".backup_help_popup") &&
      !isHoraeElement(el) &&
      el.closest(SKIP_ATTR_SELECTORS)
    ) return;

    for (const attr of ATTR_NAMES) {
      const before = el.getAttribute(attr);
      if (!before || !hasChinese(before)) continue;
      const after = translateString(before);
      if (after !== before) el.setAttribute(attr, after);
    }

    if (el instanceof HTMLInputElement) {
      const type = (el.getAttribute("type") || "").toLowerCase();
      if (type === "button" || type === "submit" || type === "reset") {
        const before = el.value;
        if (before && hasChinese(before)) {
          const after = translateString(before);
          if (after !== before) el.value = after;
        }
      }
    }
  }

  function translateTree(root) {
    if (!root) return;

    if (root instanceof Text) {
      translateTextNode(root);
      return;
    }

    if (!(root instanceof Element) && !(root instanceof DocumentFragment) && !(root instanceof Document)) return;

    if (root instanceof Element) {
      translateAttributes(root);
      for (const child of root.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) translateTextNode(child);
      }
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.nodeType === Node.TEXT_NODE) translateTextNode(node);
      else if (node.nodeType === Node.ELEMENT_NODE) translateAttributes(node);
    }
  }

  
  
  const rootObservers = new Map();
  const pendingNodes = new Set();
  let flushScheduled = false;

  function queueTranslation(node) {
    if (!node) return;
    pendingNodes.add(node);
    if (flushScheduled) return;
    flushScheduled = true;
    requestAnimationFrame(() => {
      flushScheduled = false;
      const nodes = [...pendingNodes];
      pendingNodes.clear();
      for (const pending of nodes) {
        if (pending instanceof Node && pending.isConnected) translateTree(pending);
      }
    });
  }

  function observeTranslationRoot(root) {
    if (!(root instanceof Element) || rootObservers.has(root)) return;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          for (const node of mutation.addedNodes) queueTranslation(node);
        } else if (mutation.type === "characterData") {
          queueTranslation(mutation.target);
        } else if (mutation.type === "attributes") {
          queueTranslation(mutation.target);
        }
      }
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTR_NAMES, "value"],
    });
    rootObservers.set(root, observer);
    refreshMapsIfNeeded();
    queueTranslation(root);
  }

  function discoverTranslationRoots(node) {
    if (!(node instanceof Element) && !(node instanceof Document)) return;
    if (node instanceof Element && node.matches(TRANSLATION_ROOT_SELECTOR)) {
      observeTranslationRoot(node);
    }
    node.querySelectorAll(TRANSLATION_ROOT_SELECTOR).forEach(observeTranslationRoot);
  }

  function startObserver() {
    const observeRoot = document.documentElement || document.body;
    discoverTranslationRoots(document);

    const discoveryObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) discoverTranslationRoots(node);
      }

      
      for (const [root, observer] of rootObservers) {
        if (!root.isConnected) {
          observer.disconnect();
          rootObservers.delete(root);
        }
      }
    });

    discoveryObserver.observe(observeRoot, {childList: true, subtree: true});
  }

  async function init() {
    if (!document.documentElement) return;

    await loadDictionaries();
    if (Object.keys(store).length === 0) {
      console.warn(
        `[${EXTENSION_NAME}] 사전이 로드되지 않았습니다. 설치 폴더명/경로를 확인하세요. candidates=`,
        [BASE_PATH]
      );
    }

    startObserver();

    console.debug(
      `[${EXTENSION_NAME}] loaded, dictionaries=${Object.keys(store).length}, active=${lastActiveDictSignature || "(없음)"}, keys=${Object.keys(store).join(", ") || "(없음)"}`
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        void init();
      },
      {once: true}
    );
  } else {
    void init();
  }
})();
