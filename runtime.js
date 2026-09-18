import {hasChinese} from './translator.js';
import {DATA_MANAGER_CONTENT} from './dictionaries/st-data-manager.js';
import {PERSONA_TAGS_CONTENT} from './dictionaries/persona-tags.js';

const ATTRS = ['title', 'placeholder', 'aria-label', 'label'];
const PRUNE = ['#chat', '.mes', 'script', 'style', 'code', 'pre', '#st-ko-localizer-settings', DATA_MANAGER_CONTENT, PERSONA_TAGS_CONTENT].join(',');
const NO_TEXT = 'textarea,[contenteditable="true"]';
const BOUNDARIES = 'dialog.popup,#toast-container > div,.extensions_info';

export function createRuntime({catalog, translators, namesTranslator, document: doc = document,
  MutationObserver: Observer = MutationObserver, requestFrame = requestAnimationFrame,
  cancelFrame = cancelAnimationFrame, setTimer = setTimeout, clearTimer = clearTimeout,
  now = () => performance.now()}) {
  const allRoots = catalog.map(x => x.roots).filter(Boolean).join(',');
  const enabled = catalog.filter(x => translators.has(x.id));
  const activeRoots = enabled.map(x => x.roots).filter(Boolean).join(',');
  const discoverySelector = [activeRoots, BOUNDARIES].filter(Boolean).join(',');
  const titleOwners = new Map(enabled.flatMap(x => (x.titles || []).map(title => [title, x.id])));
  const byId = new Map(catalog.map(x => [x.id.toLowerCase(), x.id]));
  const observers = new Map();
  const discoveries = new Set();
  const pending = new Map();
  const ownText = new WeakMap();
  const ownAttrs = new WeakMap();
  let popupCache = new WeakMap();
  let active = null;
  let cleanup = false;
  let scheduled = false;
  let stopped = false;
  let frame, timer, globalObserver;
  const stats = {frames: 0, visited: 0, popupLookups: 0, translations: 0, discoveryVisits: 0};

  function directOwner(el) {
    const root = allRoots && el.closest(allRoots);
    if (!root) return undefined;
    const entry = catalog.find(x => x.roots && root.matches(x.roots));
    return entry && translators.has(entry.id) ? entry.id : null;
  }
  function owner(el) {
    const row = el.closest('.extensions_info .extension_block[data-name]');
    if (row) {
      const folder = (row.dataset.name || '').replace(/\\/g, '').split('/').pop().toLowerCase();
      const id = byId.get(folder);
      return id && translators.has(id) ? `name:${id}` : null;
    }
    const direct = directOwner(el);
    if (direct !== undefined) return direct;
    const boundary = el.closest('dialog.popup,#toast-container > div');
    if (!boundary) return null;
    if (popupCache.has(boundary)) return popupCache.get(boundary);
    stats.popupLookups++;
    let id = null;
    if (boundary.matches('dialog.popup')) {
      const marker = allRoots && boundary.querySelector(allRoots);
      if (marker) id = directOwner(marker);
    } else {
      const title = boundary.querySelector('.toast-title')?.textContent?.trim();
      id = titleOwners.get(title) || null;
    }
    popupCache.set(boundary, id);
    return id;
  }
  function translate(el, input) {
    if (!hasChinese(input)) return input;
    const id = owner(el);
    if (!id) return input;
    return id.startsWith('name:') ? namesTranslator(input) : translators.get(id)(input);
  }
  function attributes(el, only) {
    if (el.matches('.persona-tag-item') || el.closest(PRUNE)) return;
    const attrs = only ? [only] : ATTRS;
    for (const attr of attrs) {
      if (attr === 'value' && !el.matches('input[type="button"],input[type="submit"],input[type="reset"]')) continue;
      const before = el.getAttribute(attr);
      if (!hasChinese(before)) continue;
      const after = translate(el, before);
      if (before !== after) {
        const writes = ownAttrs.get(el) || new Map();
        writes.set(attr, after);
        ownAttrs.set(el, writes);
        el.setAttribute(attr, after);
        stats.translations++;
      }
    }
  }
  function text(node) {
    const before = node.nodeValue;
    if (!hasChinese(before)) return;
    const el = node.parentElement;
    if (!el || el.matches('.persona-tag-item') || el.closest(PRUNE + ',' + NO_TEXT)) return;
    const after = translate(el, before);
    if (after !== before) {
      ownText.set(node, after);
      node.nodeValue = after;
      stats.translations++;
    }
  }
  function* tree(root, discover = false) {
    if (!root.isConnected) return;
    if (root.nodeType === 3) { text(root); yield; return; }
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.nodeType === 1 && root.closest(PRUNE)) return;
    // Manual DFS yields even for rejected nodes; TreeWalker FILTER_REJECT may skip
    // thousands of siblings in a single nextNode(), outside the frame budget.
    let node = root;
    while (node && root.isConnected) {
      const element = node.nodeType === 1;
      const skip = element && node.matches(PRUNE);
      let descend = !skip;
      if (!skip) {
        if (discover) {
          stats.discoveryVisits++;
          if (element && node.matches(discoverySelector)) {
            observe(node);
            descend = false; // Its observer owns descendant changes and translation.
          }
        } else {
          stats.visited++;
          if (element) {
            attributes(node);
            descend = !node.matches(NO_TEXT);
          } else if (node.nodeType === 3) text(node);
        }
      }
      yield;
      if (!node.isConnected || (node !== root && !root.contains(node))) return;
      if (descend && node.firstChild) { node = node.firstChild; continue; }
      while (node !== root && !node.nextSibling) node = node.parentNode;
      if (node === root) return;
      node = node.nextSibling;
    }
  }
  function queue(node, attr = null) {
    if (!node?.isConnected) return;
    if (node.nodeType === 3 && !hasChinese(node.nodeValue)) return;
    if (!pending.has(node)) pending.set(node, attr ? new Set([attr]) : null);
    else if (!attr) pending.set(node, null);
    else pending.get(node)?.add(attr);
    schedule();
  }
  function covered(node) {
    for (let el = node.nodeType === 1 ? node : node.parentElement; el; el = el.parentElement) {
      if (observers.has(el)) return true;
    }
    return false;
  }
  function observe(root) {
    if (covered(root)) return;
    for (const [nested, observer] of observers) {
      if (root.contains(nested)) { observer.disconnect(); observers.delete(nested); }
    }
    const observer = new Observer(records => {
      let structureChanged = false;
      for (const record of records) {
        if (record.type === 'childList') {
          structureChanged = true;
          for (const node of record.addedNodes) queue(node);
          if (record.removedNodes.length) cleanup = true;
        } else if (record.type === 'characterData') {
          if (ownText.get(record.target) === record.target.nodeValue) { ownText.delete(record.target); continue; }
          queue(record.target);
        } else if (record.attributeName === 'class') {
          // Only root/ownership marker changes affect scope. Ignore animation classes.
          if (record.target === root || record.target.matches('.persona-list')) {
            structureChanged = true;
            queue(root);
          }
        } else {
          const writes = ownAttrs.get(record.target);
          if (writes?.get(record.attributeName) === record.target.getAttribute(record.attributeName)) {
            writes.delete(record.attributeName);
            continue;
          }
          queue(record.target, record.attributeName);
        }
      }
      if (structureChanged) popupCache = new WeakMap();
      if (cleanup) schedule();
    });
    observer.observe(root, {childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: [...ATTRS, 'value', 'class']});
    observers.set(root, observer);
    queue(root);
  }
  function* jobs() {
    if (cleanup) {
      cleanup = false;
      for (const [root, observer] of observers) {
        if (!root.isConnected) { observer.disconnect(); observers.delete(root); }
        yield;
      }
    }
    if (discoveries.size) {
      const batch = new Set(discoveries);
      discoveries.clear();
      for (const root of batch) {
        let parent = root.parentNode;
        while (parent && !batch.has(parent)) parent = parent.parentNode;
        if (!parent && !covered(root)) yield* tree(root, true);
        yield;
      }
    }
    if (pending.size) {
      const batch = new Map(pending);
      pending.clear();
      for (const [node, attrs] of batch) {
        let parent = node.parentNode;
        while (parent && !(batch.has(parent) && batch.get(parent) === null)) parent = parent.parentNode;
        if (!parent && node.isConnected) {
          if (attrs) { for (const attr of attrs) { attributes(node, attr); yield; } }
          else yield* tree(node);
        }
        yield;
      }
    }
  }
  function flush() {
    if (!scheduled || stopped) return;
    scheduled = false;
    cancelFrame(frame); clearTimer(timer);
    stats.frames++;
    const start = now();
    for (let steps = 0; steps < 200; steps++) {
      active ||= jobs();
      if (active.next().done) { active = null; break; }
      if (now() - start >= 4) break;
    }
    if (active || discoveries.size || pending.size || cleanup) schedule();
  }
  function schedule() {
    if (scheduled || stopped) return;
    scheduled = true;
    frame = requestFrame(flush);
    timer = setTimer(flush, 100);
  }
  function start() {
    if (!enabled.length || globalObserver) return;
    globalObserver = new Observer(records => {
      for (const record of records) {
        // The callback is global, but chat and already-owned panels do no discovery work.
        if (record.target.nodeType === 1 && record.target.closest(PRUNE)) continue;
        if (record.removedNodes.length) cleanup = true;
        if (covered(record.target)) continue;
        for (const node of record.addedNodes) {
          if (node.nodeType === 1 && !node.matches(PRUNE)) discoveries.add(node);
        }
      }
      if (discoveries.size || cleanup) schedule();
    });
    globalObserver.observe(doc.documentElement, {childList: true, subtree: true});
    discoveries.add(doc.documentElement);
    schedule();
  }
  function stop() {
    stopped = true;
    globalObserver?.disconnect();
    for (const observer of observers.values()) observer.disconnect();
    observers.clear(); pending.clear(); discoveries.clear(); active = null;
    cancelFrame(frame); clearTimer(timer);
  }
  return {start, stop, translate, owner, flush, stats, observers};
}
