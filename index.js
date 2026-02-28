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

  // dictionaries/ 폴더의 각 확장 JS 파일들이 이 store에 데이터를 등록함
  const store = (globalThis.__stKoLocalizerDictStore ??= {});

  // store에 등록된 모든 사전 데이터를 병합해서 Map/Array를 빌드
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

    for (const [dictName, dict] of Object.entries(store)) {
      if (!activeDictionaries.has(dictName)) continue;

      // exactEntries: [[중국어, 한국어], ...]
      for (const entry of dict.exactEntries ?? []) {
        if (Array.isArray(entry) && entry.length >= 2 && entry[0] && entry[1]) {
          exact.set(entry[0], entry[1]);
        }
      }
      // overrideEntries: [[중국어, 한국어], ...]  (exact보다 우선순위 높음)
      for (const entry of dict.overrideEntries ?? []) {
        if (Array.isArray(entry) && entry.length >= 2 && entry[0] && entry[1]) {
          override.set(entry[0], entry[1]);
        }
      }
      // regexRules: [{pattern, flags, replace}, ...]
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

  // 현재 활성 Map (init 전에는 비어있음, 이후 주기적으로 갱신됨)
  let EXACT_MAP = new Map();
  let OVERRIDE_MAP = new Map();
  let REGEX_RULES = [];

  // store 키 수를 추적해서 새 파일이 로드됐을 때만 재빌드
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
      return true; // 갱신됨
    }
    return false;
  }

  const ATTR_NAMES = ["title", "placeholder", "aria-label"];

  const SKIP_TEXT_SELECTORS = ["script", "style", "code", "pre", "textarea", '[contenteditable="true"]', ".mes", ".mes_text", ".mes_block", "#chat", ".swipe_right", ".swipe_left"].join(",");
  const SKIP_ATTR_SELECTORS = ["script", "style", "code", "pre", ".mes", ".mes_text", ".mes_block", "#chat", ".swipe_right", ".swipe_left"].join(",");

  function hasChinese(str) {
    return /[\u3400-\u9FFF]/.test(str);
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
    // chat-history-backup 사용 지침 팝업 내부는 code/pre 포함 번역 허용
    if (el.closest(".backup_help_popup")) return true;
    // Horae 메시지 패널은 채팅 영역 내부여도 번역 허용
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
      const translated = OVERRIDE_MAP.get(core) || OVERRIDE_MAP.get(coreTrimmed) || EXACT_MAP.get(core) || EXACT_MAP.get(coreTrimmed);
      if (translated) return leading + translated + trailing;
    }

    for (const rule of REGEX_RULES) {
      if (rule.re.test(input)) {
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

  function startObserver() {
    const observeRoot = document.documentElement || document.body;
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "characterData") {
          translateTree(m.target);
          continue;
        }
        if (m.type === "childList") {
          for (const node of m.addedNodes) translateTree(node);
        }
        if (m.type === "attributes" && m.target instanceof Element) {
          translateAttributes(m.target);
        }
      }
    });

    observer.observe(observeRoot, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTR_NAMES, "value"],
    });

    setInterval(() => {
      try {
        const updated = refreshMapsIfNeeded();
        if (updated) translateTree(observeRoot);
      } catch (e) {
        console.warn(`[${EXTENSION_NAME}] translateTree 오류:`, e);
      }
    }, 2000);
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

    refreshMapsIfNeeded();
    translateTree(document.documentElement);
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
