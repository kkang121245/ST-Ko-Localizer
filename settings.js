import {DATA_MANAGER_ROOTS} from './dictionaries/st-data-manager.js';
import {PERSONA_TAGS_ROOTS} from './dictionaries/persona-tags.js';

export const SETTINGS_KEY = 'stKoLocalizer';
export const CATALOG = [
  {id: 'JS-Slash-Runner', label: '태번 헬퍼', roots: '#tavern_helper', titles: ['酒馆助手', '태번 헬퍼'], url: 'https://github.com/N0VI028/JS-Slash-Runner'},
  {id: 'cocktail', label: '칵테일', file: 'cocktail.js', roots: '#cocktail_drawer,#cocktail_settings_root,#cocktail_plus_intro_modal', titles: ['鸡尾酒', '칵테일'], url: 'https://github.com/Lianues/cocktail'},
  {id: 'ST-Extension-Cleanup-World-Lorebook', label: '월드 인포 대청소', file: 'ST-Extension-Cleanup-World-Lorebook.js', roots: '.world-info-cleanup-settings,#world-cleanup-dialog,#preload-popup,#world_info_cleanup_enabled,#world_info_cleanup_manual', titles: ['世界书大扫除🧹', '월드 인포 대청소🧹'], url: 'https://github.com/Nythyl/ST-Extension-Cleanup-World-Lorebook'},
  {id: 'st-memory-enhancement', label: '기억 강화 테이블', file: 'st-memory-enhancement.js', roots: '.memory_enhancement_container,#memory_enhancement_settings_inline_drawer_content,#table_database_settings_drawer,#table_manager_container,#table_editor_container,#open_table,.dataBankAttachments,#push_to_chat_style_edit_guide,#push_to_chat_alternate_options,#push_to_chat_regex_options', titles: ['记忆增强表格', '기억 강화 테이블'], url: 'https://github.com/muyoou/st-memory-enhancement'},
  {id: 'minimax-quote-tts', label: 'MiniMax 음성', file: 'minimax-tts.js', roots: '#mm_wand_item,#mm-config-mask,#vc-fab,#vc-dialog,#mm-vrm-frame,#mm-vrm-info', titles: ['MiniMax语音', 'MiniMax 음성'], url: 'https://github.com/dream-ice/minimax-quote-tts'},
  {id: 'ST-BaiBai-Tools', label: '바이바이 보물상자', file: 'ST-BaiBai-Tools.js', roots: '#bai_bai_toolkit_container,[id^="bai_bai_toolkit_"],.bai-bai-preset-vue-list-host,.bai-bai-preset-global-library-dialog-layer,.bai-bai-wi-global-selector,.bai-bai-wi-popup-header,.bai-bai-wi-search-replace-panel,.bai-bai-wi-mobile-expanded-extra,.bai-bai-regex-vue-list,.bai-bai-floor-overlay,.bai-bai-save-generate-display,#world_editor_select,#send_but,#option_regenerate', titles: ['柏宝箱', '바이바이 보물상자'], url: 'https://github.com/baibai-git/ST-BaiBai-Tools'},
  {id: 'theme-mgr', label: '뷰티 매니저', file: 'theme-mgr.js', roots: '.tm-overlay,.tm-sheet-overlay,.tm-lightbox,#tm-fab-main,#theme-mgr-ext-btn', titles: ['美化管理', '美化管理器', '뷰티 매니저'], url: 'https://github.com/wenshui012/theme-mgr'},
  {id: 'Silly-Game', label: '실리 게임', file: 'Silly-Game.js', roots: '#st-mini-game-center,#st-mini-game-center-launcher,#st-mini-game-center-restore,#stgc-extension-settings', titles: ['小游戏中心', '미니게임 센터'], url: 'https://github.com/akari-taomini/Silly-Game'},
  {id: 'st-data-manager', label: '데이터 관리자', roots: DATA_MANAGER_ROOTS + ',.stdm-popup', titles: ['数据管家', '데이터 관리자'], url: 'https://github.com/ghostboyfriends/st-data-manager'},
  {id: 'persona-tags', label: '페르소나 태그', roots: PERSONA_TAGS_ROOTS + ',.persona-list.persona-popup-enhanced', titles: [], url: 'https://github.com/XiaoBai20001212/persona-tags'},
];

export function readSettings(value) {
  return {
    mode: value?.mode === 'manual' ? 'manual' : 'auto',
    enabled: Object.fromEntries(CATALOG.map(({id}) => [id, value?.enabled?.[id] === true])),
  };
}

export function switchMode(value, mode) {
  const result = readSettings(value);
  if (result.mode !== mode && mode === 'manual') {
    result.enabled = Object.fromEntries(CATALOG.map(({id}) => [id, false]));
  }
  result.mode = mode === 'manual' ? 'manual' : 'auto';
  return result;
}

export function installedExtensions(names) {
  const folders = new Set(names.map(name => String(name).replace(/\\/g, '/').split('/').pop().toLowerCase()));
  return new Set(CATALOG.filter(({id}) => folders.has(id.toLowerCase())).map(({id}) => id));
}

export function activeExtensions(names, disabledNames = []) {
  const installed = installedExtensions(names);
  const disabled = installedExtensions(disabledNames);
  return new Set([...installed].filter(id => !disabled.has(id)));
}

export function enabledExtensions(settings, installed) {
  return new Set(CATALOG.filter(({id}) => installed.has(id) && (settings.mode === 'auto' || settings.enabled[id])).map(({id}) => id));
}

export function mountSettings({settings, installed, active = installed, save, reload, document: doc = document}) {
  const host = doc.getElementById('extensions_settings') || doc.getElementById('extensions_settings2');
  if (!host || doc.getElementById('st-ko-localizer-settings')) return false;
  let draft = readSettings(settings);
  const initial = JSON.stringify(draft);
  const root = doc.createElement('div');
  root.id = 'st-ko-localizer-settings';
  root.className = 'inline-drawer';
  root.innerHTML = `
    <style>
      #st-ko-localizer-settings .stkl-repo-link { margin-inline-start: 6px; font-size: 0.85em; opacity: 0.5; }
      #st-ko-localizer-settings .stkl-repo-link:hover { opacity: 1; }
    </style>
    <div class="inline-drawer-toggle inline-drawer-header">
      <b>확장 UI 한국어 번역</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
    </div>
    <div class="inline-drawer-content">
      <label for="st-ko-localizer-mode">번역 적용 모드</label>
      <select id="st-ko-localizer-mode" class="text_pole">
        <option value="auto">자동 — 활성화된 확장 번역 켜기</option>
        <option value="manual">수동 — 직접 선택</option>
      </select>
      <div data-role="extensions"></div>
      <p data-role="status" role="status" aria-live="polite"></p>
      <button type="button" class="menu_button" data-role="apply">새로고침하여 적용</button>
    </div>`;
  const mode = root.querySelector('select');
  const list = root.querySelector('[data-role="extensions"]');
  const status = root.querySelector('[data-role="status"]');
  const apply = root.querySelector('[data-role="apply"]');
  const inputs = new Map();
  for (const {id, label, url} of CATALOG) {
    const row = doc.createElement('label');
    row.className = 'checkbox_label';
    const name = doc.createElement('span');
    name.textContent = `${label}${!installed.has(id) ? ' · 미설치' : ''}`;
    const input = doc.createElement('input');
    input.type = 'checkbox';
    input.dataset.extension = id;
    row.append(input, name);
    if (url) {
      const link = doc.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.title = `${label} GitHub 페이지 열기`;
      link.innerHTML = '<i class="fa-solid fa-share-nodes"></i>';
      link.className = 'stkl-repo-link';
      link.addEventListener('click', event => event.stopPropagation());
      row.append(link);
    }
    if (installed.has(id) && !active.has(id)) {
      const badge = doc.createElement('span');
      badge.textContent = '비활성화';
      badge.style.cssText = 'margin-inline-start: 6px; padding: 1px 6px; border-radius: 4px; background: color-mix(in srgb, var(--SmartThemeEmColor) 10%, transparent);';
      row.append(badge);
    }
    list.append(row);
    inputs.set(id, input);
    input.addEventListener('change', () => {
      draft.enabled[id] = input.checked;
      persist();
    });
  }
  function render() {
    mode.value = draft.mode;
    const enabled = enabledExtensions(draft, active);
    for (const [id, input] of inputs) {
      input.checked = enabled.has(id);
      input.disabled = draft.mode === 'auto' || !active.has(id);
    }
    const changed = initial !== JSON.stringify(draft);
    status.textContent = changed ? '저장됨 · 새로고침하면 변경 사항이 적용됩니다.' : `${enabled.size}개 확장 번역 적용 중`;
    apply.disabled = !changed;
  }
  function persist() { save(readSettings(draft)); render(); }
  mode.addEventListener('change', () => { draft = switchMode(draft, mode.value); persist(); });
  apply.addEventListener('click', reload);
  render();
  host.append(root);
  return true;
}
