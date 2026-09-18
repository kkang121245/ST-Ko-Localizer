import {addLocaleData, getCurrentLocale} from '/scripts/i18n.js';
import {extensionNames, extension_settings} from '/scripts/extensions.js';
import {saveSettings, saveSettingsDebounced, eventSource, event_types} from '/script.js';
// Synchronous locale registration must finish before later extensions initialize.
import helperLocale from './locales/JS-Slash-Runner.json' with {type: 'json'};
import memoryLocale from './locales/st-memory-enhancement.json' with {type: 'json'};
import baiLocale from './locales/ST-BaiBai-Tools.json' with {type: 'json'};
import {CATALOG, SETTINGS_KEY, readSettings, installedExtensions, activeExtensions, enabledExtensions, mountSettings} from './settings.js';
import {createTranslator, hasChinese} from './translator.js';
import {createRuntime} from './runtime.js';
import {translateDataManagerString} from './dictionaries/st-data-manager.js';
import {translatePersonaTagsString} from './dictionaries/persona-tags.js';

if (!globalThis.__stKoUiLocalizerLoaded) {
  globalThis.__stKoUiLocalizerLoaded = true;
  const installed = installedExtensions(extensionNames);
  const active = activeExtensions(extensionNames, extension_settings.disabledExtensions);
  const settings = readSettings(extension_settings[SETTINGS_KEY]);
  // Settings edits are applied on reload, including early i18n and fetch hooks.
  const enabled = enabledExtensions(settings, active);
  const locales = new Map([
    ['JS-Slash-Runner', helperLocale], ['st-memory-enhancement', memoryLocale], ['ST-BaiBai-Tools', baiLocale],
  ]);
  const blockedKeys = new Set();
  for (const [id, data] of locales) {
    if (installed.has(id) && !enabled.has(id)) for (const key of Object.keys(data)) blockedKeys.add(key);
  }
  const merged = {};
  for (const [id, data] of locales) {
    if (enabled.has(id)) for (const [key, value] of Object.entries(data)) {
      if (!blockedKeys.has(key) && typeof value === 'string') merged[key] = value;
    }
  }
  if (Object.keys(merged).length) addLocaleData(getCurrentLocale(), merged);

  // This extension requests a locale unsupported by its own bundled resources.
  // Install the compatibility hook only when its translation is enabled.
  if (enabled.has('st-memory-enhancement') && typeof globalThis.fetch === 'function') {
    const nativeFetch = globalThis.fetch.bind(globalThis);
    const localePath = '/scripts/extensions/third-party/st-memory-enhancement/assets/locales/';
    const fallback = new URL('./locales/st-memory-enhancement.json', import.meta.url).href;
    globalThis.fetch = function (input, init) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url;
      if (typeof url === 'string' && url.includes(localePath)) {
        const locale = url.slice(url.indexOf(localePath) + localePath.length).match(/^([^/]+)\.json(?:[?#]|$)/)?.[1]?.toLowerCase();
        if (locale && !['en', 'zh-cn', 'zh-tw'].includes(locale)) return nativeFetch(fallback, init);
      }
      return nativeFetch(input, init);
    };
  }

  function showSettings() {
    return mountSettings({settings, installed, active,
      save(value) { extension_settings[SETTINGS_KEY] = value; saveSettingsDebounced(); },
      async reload() {
        const button = document.querySelector('#st-ko-localizer-settings [data-role="apply"]');
        const status = document.querySelector('#st-ko-localizer-settings [data-role="status"]');
        button.disabled = true;
        status.textContent = '설정을 저장하는 중…';
        let saved = false;
        const confirmSaved = () => { saved = true; };
        eventSource.on(event_types.SETTINGS_UPDATED, confirmSaved);
        try {
          await saveSettings();
          if (saved) location.reload();
          else {
            status.textContent = '저장이 완료되지 않았습니다. 진행 중인 작업이나 연결 상태를 확인한 뒤 다시 적용해 주세요.';
            button.disabled = false;
          }
        } finally { eventSource.removeListener(event_types.SETTINGS_UPDATED, confirmSaved); }
      },
    });
  }

  async function loadDictionary(file) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL(`./dictionaries/${file}`, import.meta.url).href;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`번역 사전 로드 실패: ${file}`));
      document.head.append(script);
    });
  }

  async function start() {
    if (!showSettings()) eventSource.once(event_types.APP_READY, showSettings);
    if (!enabled.size) return; // Manual all-off: no DOM observers, dictionaries or native hooks.
    const files = CATALOG.filter(x => enabled.has(x.id) && x.file).map(x => x.file);
    files.push('extension-names.js');
    const results = await Promise.allSettled(files.map(loadDictionary));
    for (const result of results) if (result.status === 'rejected') console.warn('[ST-Ko-Localizer]', result.reason);
    const store = globalThis.__stKoLocalizerDictStore || {};
    const translators = new Map();
    for (const item of CATALOG) {
      if (!enabled.has(item.id)) continue;
      if (item.id === 'st-data-manager') translators.set(item.id, translateDataManagerString);
      else if (item.id === 'persona-tags') translators.set(item.id, translatePersonaTagsString);
      else {
        const dictionary = store[item.id] || {};
        // Scoped fallback for shared locale keys intentionally withheld from global i18n.
        const exactEntries = [...Object.entries(locales.get(item.id) || {}), ...(dictionary.exactEntries || [])];
        translators.set(item.id, createTranslator({...dictionary, exactEntries}));
      }
    }
    const runtime = createRuntime({catalog: CATALOG, translators,
      namesTranslator: createTranslator(store['extension-names'] || {})});
    runtime.start();
    globalThis.__stKoLocalizerRuntime = runtime;

    // Only the currently focused extension can supply translations to native dialogs.
    // No global merged dictionary or document-wide detector scan per dialog.
    for (const name of ['alert', 'confirm', 'prompt']) {
      const original = globalThis[name];
      if (typeof original !== 'function') continue;
      globalThis[name] = function (message, ...rest) {
        const focus = document.activeElement;
        if (focus && hasChinese(message)) {
          try { message = runtime.translate(focus, message); }
          catch (error) { console.warn('[ST-Ko-Localizer] 확인창 번역 실패', error); }
        }
        return original.call(globalThis, message, ...rest);
      };
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => void start(), {once: true});
  else void start();
}
