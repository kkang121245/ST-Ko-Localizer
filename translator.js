export const hasChinese = text => typeof text === 'string' && /[\u3400-\u9FFF]/.test(text);

// Each extension owns its compiled patterns and bounded cache. Never merge dictionaries.
export function createTranslator(dictionary, limit = 1000) {
  const exact = new Map();
  for (const [source, translated] of [...(dictionary.exactEntries || []), ...(dictionary.overrideEntries || [])]) {
    exact.set(source, translated);
    exact.set(source.replace(/\s+/g, ' ').trim(), translated);
  }
  const rules = [];
  for (const rule of dictionary.regexRules || []) {
    try { rules.push({re: new RegExp(rule.pattern, rule.flags || ''), replace: rule.replace}); }
    catch (error) { console.warn('[ST-Ko-Localizer] 잘못된 번역 규칙', rule.pattern, error); }
  }
  const memo = new Map();
  function translate(input, depth = 0) {
    if (!hasChinese(input)) return input;
    if (memo.has(input)) return memo.get(input);
    const core = input.trim();
    const start = input.indexOf(core);
    let result = exact.get(core) ?? exact.get(core.replace(/\s+/g, ' '));
    if (result !== undefined) result = input.slice(0, start) + result + input.slice(start + core.length);
    else {
      for (const candidate of input === core ? [input] : [input, core]) {
        for (const {re, replace} of rules) {
          re.lastIndex = 0;
          if (!re.test(candidate)) continue;
          re.lastIndex = 0;
          const converted = candidate.replace(re, (...args) => {
            const end = args.length - (typeof args.at(-1) === 'object' ? 3 : 2);
            const groups = args.slice(1, end);
            return replace.replace(/\$(\$|\d{1,2})/g, (token, key) => {
              if (key === '$') return '$';
              const value = groups[Number(key) - 1];
              if (typeof value !== 'string') return token;
              return depth < 3 && value !== candidate ? translate(value, depth + 1) : value;
            });
          });
          result = candidate === input ? converted : input.slice(0, start) + converted + input.slice(start + core.length);
          break;
        }
        if (result !== undefined) break;
      }
    }
    // Evict just one oldest entry instead of discarding every useful cached string.
    result ??= input;
    if (memo.size >= limit) memo.delete(memo.keys().next().value);
    // Large error payloads and user data should not be retained by the cache.
    if (input.length <= 2048) memo.set(input, result);
    return result;
  }
  return translate;
}
