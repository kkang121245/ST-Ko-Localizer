import {addLocaleData, getCurrentLocale} from "/scripts/i18n.js";
// 정적 import 로 읽는다. fetch 를 쓰면 top-level await 가 생기고, 모듈 스크립트의 load 이벤트는
// top-level await 완료 전에 발생하기 때문에 SillyTavern 이 다음 확장(酒馆助手 등)을 먼저
// 로드해버려 번역이 주입되기 전에 패널이 중국어로 렌더링된다.
import jsSlashRunnerLocale from "./locales/JS-Slash-Runner.json" with {type: "json"};
import memoryEnhancementLocale from "./locales/st-memory-enhancement.json" with {type: "json"};
import baiBaiToolsLocale from "./locales/ST-BaiBai-Tools.json" with {type: "json"};

const EXTENSION_NAME = "ST-Ko-Localizer";
const EXTENSION_FOLDER = "ST-Ko-Localizer";
const BASE_PATH = `/scripts/extensions/third-party/${EXTENSION_FOLDER}`;

if (globalThis.__stKoUiLocalizerLoaded) {
  console.debug(`[${EXTENSION_NAME}] 이미 로드됨, 중복 초기화를 건너뜁니다.`);
} else {
  globalThis.__stKoUiLocalizerLoaded = true;


  const LOCALE_DATA = [
    ["locales/JS-Slash-Runner.json", jsSlashRunnerLocale],
    ["locales/st-memory-enhancement.json", memoryEnhancementLocale],
    ["locales/ST-BaiBai-Tools.json", baiBaiToolsLocale],
  ];


  const MEM_ENH_LOCALE_RE =
    /\/scripts\/extensions\/third-party\/st-memory-enhancement\/assets\/locales\/([^/]+)\.json(?:[?#]|$)/;
  const MEM_ENH_SHIPPED_LOCALES = new Set(["en", "zh-cn", "zh-tw"]);
  const MEM_ENH_LOCALE_URL = `${BASE_PATH}/locales/st-memory-enhancement.json`;

  function installMemoryEnhancementLocaleHook() {
    if (typeof globalThis.fetch !== "function") return;
    const nativeFetch = globalThis.fetch.bind(globalThis);

    globalThis.fetch = function (input, init) {
      try {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input instanceof Request
                ? input.url
                : "";
        const match = url && MEM_ENH_LOCALE_RE.exec(url);


        if (match && !MEM_ENH_SHIPPED_LOCALES.has(match[1].toLowerCase())) {
          return nativeFetch(MEM_ENH_LOCALE_URL, init);
        }
      } catch {

      }
      return nativeFetch(input, init);
    };
  }


  installMemoryEnhancementLocaleHook();

  function injectLocaleData() {
    const locale = getCurrentLocale();
    const merged = {};
    let loaded = 0;

    for (const [relativePath, data] of LOCALE_DATA) {
      if (!data || typeof data !== "object") {
        console.warn(`[${EXTENSION_NAME}] 로케일 파일이 비어 있습니다: ${relativePath}`);
        continue;
      }
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === "string") merged[key] = value;
      }
      loaded += 1;
    }

    addLocaleData(locale, merged);
    console.debug(
      `[${EXTENSION_NAME}] 로케일 주입 완료: locale=${locale}, files=${loaded}/${LOCALE_DATA.length}, keys=${Object.keys(merged).length}`
    );
  }


  const DICTIONARY_FILES = [
    "dictionaries/cocktail.js",
    "dictionaries/ST-Extension-Cleanup-World-Lorebook.js",
    "dictionaries/st-memory-enhancement.js",
    "dictionaries/minimax-tts.js",
    "dictionaries/ST-BaiBai-Tools.js",
    "dictionaries/theme-mgr.js",
    "dictionaries/extension-names.js",
  ];

  const DICT_DETECTORS = {
    cocktail: () =>
      Boolean(
        document.getElementById("cocktail_drawer") ||
          document.getElementById("cocktail_settings_root")
      ),
    "ST-Extension-Cleanup-World-Lorebook": () =>
      Boolean(
        document.querySelector(".world-info-cleanup-settings") ||
          document.getElementById("world-cleanup-dialog") ||
          document.getElementById("world_info_cleanup_enabled") ||
          document.getElementById("world_info_cleanup_manual")
      ),
    "ST-BaiBai-Tools": () =>
      Boolean(
        document.getElementById("bai_bai_toolkit_container") ||
          document.querySelector('[id^="bai_bai_toolkit_"]')
      ),
    "extension-names": () => Boolean(document.querySelector(".extensions_info")),
    "st-memory-enhancement": () =>
      Boolean(
        document.querySelector(".memory_enhancement_container") ||
          document.getElementById("memory_enhancement_settings_inline_drawer_content") ||
          document.getElementById("table_database_settings_drawer") ||
          document.getElementById("table_manager_container") ||
          document.getElementById("table_editor_container")
      ),
    "theme-mgr": () =>
      Boolean(
        document.querySelector(".tm-overlay") ||
          document.getElementById("tm-fab-main") ||
          document.getElementById("theme-mgr-ext-btn")
      ),
    "minimax-quote-tts": () =>
      Boolean(
        document.getElementById("mm_wand_item") ||
          document.getElementById("mm-config-mask") ||
          document.getElementById("vc-fab") ||
          document.getElementById("vc-dialog")
      ),
  };

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


  const translationMemo = new Map();
  const MEMO_LIMIT = 4000;


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

      translationMemo.clear();
      return true;
    }
    return false;
  }

  const ATTR_NAMES = ["title", "placeholder", "aria-label", "label"];


  const TRANSLATION_ROOT_SELECTOR = [
    "#cocktail_drawer",
    "#cocktail_settings_root",
    "#cocktail_plus_intro_modal",
    ".world-info-cleanup-settings",
    "#world-cleanup-dialog",
    "#preload-popup",
    ".extensions_info",
    "#dialogue_popup",
    ".memory_enhancement_container",
    "#memory_enhancement_settings_inline_drawer_content",
    "#table_database_settings_drawer",
    "#table_manager_container",
    "#table_editor_container",
    "#open_table",
    ".dataBankAttachments",
    "#push_to_chat_style_edit_guide",
    "#push_to_chat_alternate_options",
    "#push_to_chat_regex_options",
    "#mm_wand_item",
    "#mm-config-mask",
    "#vc-fab",
    "#vc-dialog",
    "#mm-vrm-frame",
    "#mm-vrm-info",
    "#bai_bai_toolkit_container",
    "#bai_bai_toolkit_preset_interface_collapse_wrapper",
    "#bai_bai_toolkit_preset_backup_preview",
    "#bai_bai_toolkit_regex_vue_manager_root",
    "#bai_bai_toolkit_floor_directory_wand_container",
    ".bai-bai-preset-vue-list-host",
    ".bai-bai-preset-global-library-dialog-layer",
    ".bai-bai-wi-global-selector",
    ".bai-bai-wi-popup-header",
    ".bai-bai-wi-search-replace-panel",
    ".bai-bai-wi-mobile-expanded-extra",
    ".bai-bai-regex-vue-list",
    ".bai-bai-floor-overlay",
    ".bai-bai-save-generate-display",
    "#world_editor_select",
    "#send_but",
    "#option_regenerate",

    ".tm-overlay",
    ".tm-sheet-overlay",
    ".tm-lightbox",
    "#tm-fab-main",
    "#theme-mgr-ext-btn",

    "#toast-container",
    "dialog.popup",
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

  function shouldTranslateElement(el) {
    if (!(el instanceof Element)) return false;
    return !el.closest(SKIP_TEXT_SELECTORS);
  }

  function translateString(input) {
    if (typeof input !== "string" || input.length === 0) return input;

    const memoized = translationMemo.get(input);
    if (memoized !== undefined) return memoized;

    const result = computeTranslation(input);

    if (translationMemo.size >= MEMO_LIMIT) translationMemo.clear();
    translationMemo.set(input, result);
    return result;
  }

  function computeTranslation(input) {
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

    const fromInput = applyRegexRules(input);
    if (fromInput !== null) return fromInput;


    if (match) {
      const [, leading, core, trailing] = match;
      if (core !== input) {
        const fromCore = applyRegexRules(core);
        if (fromCore !== null) return leading + fromCore + trailing;
      }
    }

    return input;
  }


  function applyRegexRules(text) {
    for (const rule of REGEX_RULES) {


      rule.re.lastIndex = 0;
      if (rule.re.test(text)) {
        rule.re.lastIndex = 0;
        return text.replace(rule.re, (...args) => {
          let end = args.length - 2;
          const last = args[args.length - 1];
          if (last && typeof last === "object") end -= 1;
          return expandReplacement(rule.replace, args.slice(1, end), text);
        });
      }
    }

    return null;
  }


  let replacementDepth = 0;
  const MAX_REPLACEMENT_DEPTH = 3;


  function expandReplacement(replacement, groups, original) {
    return replacement.replace(/\$(\$|\d{1,2})/g, (token, key) => {
      if (key === "$") return "$";
      const value = groups[Number(key) - 1];
      if (typeof value !== "string") return token;


      if (!hasChinese(value) || value === original || replacementDepth >= MAX_REPLACEMENT_DEPTH) {
        return value;
      }

      replacementDepth += 1;
      try {
        return translateString(value);
      } finally {
        replacementDepth -= 1;
      }
    });
  }

  function translateDialogMessage(message) {
    if (typeof message !== "string" || !hasChinese(message)) return message;

    refreshMapsIfNeeded();

    const whole = translateString(message);
    if (whole !== message) return whole;
    if (!message.includes("\n")) return message;

    return message
      .split("\n")
      .map((line) => translateString(line))
      .join("\n");
  }

  function installNativeDialogHook() {
    for (const name of ["alert", "confirm", "prompt"]) {
      const native = globalThis[name];
      if (typeof native !== "function" || native.__stKoLocalizerWrapped) continue;

      const wrapped = function (message, ...rest) {
        let translated = message;
        try {
          translated = translateDialogMessage(message);
        } catch (e) {
          console.warn(`[${EXTENSION_NAME}] 네이티브 대화상자 번역 실패`, e);
          translated = message;
        }
        return native.call(globalThis, translated, ...rest);
      };

      wrapped.__stKoLocalizerWrapped = true;
      globalThis[name] = wrapped;
    }
  }

  function translateTextNode(textNode) {
    if (!(textNode instanceof Text)) return;
    const parent = textNode.parentElement;
    if (!parent || !shouldTranslateElement(parent)) return;

    const before = textNode.nodeValue;
    if (!before || !hasChinese(before)) return;

    const after = translateString(before);
    if (after !== before) textNode.nodeValue = after;
  }

  function translateAttributes(el) {
    if (!(el instanceof Element)) return;
    if (el.closest(SKIP_ATTR_SELECTORS)) return;

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

  function flushPendingTranslations() {
    if (!flushScheduled) return;
    flushScheduled = false;
    const nodes = [...pendingNodes];
    pendingNodes.clear();
    for (const pending of nodes) {
      if (pending instanceof Node && pending.isConnected) translateTree(pending);
    }
  }

  function queueTranslation(node) {
    if (!node) return;
    pendingNodes.add(node);
    if (flushScheduled) return;
    flushScheduled = true;


    requestAnimationFrame(flushPendingTranslations);
    setTimeout(flushPendingTranslations, 100);
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

  const DISCOVERY_SKIP_SELECTOR = "#chat";

  function isInsideSkippedContainer(node) {
    return node instanceof Element && Boolean(node.closest(DISCOVERY_SKIP_SELECTOR));
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
        if (mutation.addedNodes.length === 0) continue;
        if (isInsideSkippedContainer(mutation.target)) continue;
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

  async function initDomTranslator() {
    if (!document.documentElement) return;

    await loadDictionaries();
    if (Object.keys(store).length === 0) {
      console.warn(
        `[${EXTENSION_NAME}] 사전이 로드되지 않았습니다. 설치 폴더명/경로를 확인하세요. candidates=`,
        [BASE_PATH]
      );
    }

    startObserver();
    installNativeDialogHook();

    console.debug(
      `[${EXTENSION_NAME}] DOM 번역기 시작, dictionaries=${Object.keys(store).length}, active=${lastActiveDictSignature || "(없음)"}, keys=${Object.keys(store).join(", ") || "(없음)"}`
    );
  }


  injectLocaleData();


  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        void initDomTranslator();
      },
      {once: true}
    );
  } else {
    void initDomTranslator();
  }
}
