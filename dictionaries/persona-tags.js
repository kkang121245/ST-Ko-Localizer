// Scoped UI dictionary; no global rules, hooks, timers or observers.
export const PERSONA_TAGS_ROOTS = [
  '#persona-position-editor', '#persona-tags-editor-section',
  '#persona-tags-view-mode', '#persona-tags-filter-area', '#persona-batch-toolbar',
  '.persona-batch-overlay', '.persona-empty-placeholder',
  'dialog.persona-cn-done', 'dialog.persona-dupe-modified',
].join(',');

export const PERSONA_TAGS_CONTENT = [
  '.persona-tag-filter-btn', '.persona-batch-tag-pill', '.persona-card-tag',
  '.persona-popup-info', '.persona-card-drag-ghost',
].join(',');

export function isPersonaTagsElement(el) {
  if (el.closest(PERSONA_TAGS_ROOTS)) return true;
  // The extension marks the selection list, not the surrounding native popup.
  return Boolean(el.closest('dialog.popup')?.querySelector('.persona-list.persona-popup-enhanced'));
}

const exact = new Map([
  ['排序位置', '정렬 위치'], ['移动到第', '이동할 위치:'], ['位', '번째'], ['移动', '이동'],
  ['人设标签', '페르소나 태그'], ['请先选择一个人设', '먼저 페르소나를 선택하세요.'],
  ['暂无标签，在下方输入添加', '태그가 없습니다. 아래에 입력해 추가하세요.'],
  ['移除标签', '태그 제거'], ['输入标签，逗号分隔可批量添加', '태그 입력 (쉼표로 구분하여 여러 개 추가)'],
  ['仅显示与当前角色卡绑定的人设', '현재 캐릭터에 연결된 페르소나만 표시'],
  ['当前角色', '현재 캐릭터'], ['显示所有人设', '모든 페르소나 표시'], ['全部人设', '모든 페르소나'],
  ['批量编辑', '일괄 편집'], ['批量', '일괄 작업'], ['刷新人设列表', '페르소나 목록 새로고침'],
  ['暂无人设', '페르소나가 없습니다.'], ['暂无匹配的人设', '조건에 맞는 페르소나가 없습니다.'],
  ['无角色卡', '선택된 캐릭터 없음'], ['标签筛选', '태그 필터'], ['重置', '초기화'],
  ['正', '포함'], ['反', '제외'],
  ['当前：正向筛选（只显示匹配标签）', '현재: 포함 필터 (태그가 일치하는 페르소나만 표시)'],
  ['当前：反向筛选（隐藏匹配标签）', '현재: 제외 필터 (태그가 일치하는 페르소나 숨기기)'],
  ['全选', '전체 선택'], ['取消', '취소'], ['打标签', '태그 추가'], ['删标签', '태그 제거'],
  ['删除', '삭제'], ['批量打标签', '태그 일괄 추가'], ['批量删标签', '태그 일괄 제거'],
  ['批量删除', '일괄 삭제'], ['标签1, 标签2, ...', '태그1, 태그2, ...'],
  ['确定', '확인'], ['移除选中', '선택한 태그 제거'], ['确定删除', '삭제 확인'],
  ['复制人设', '페르소나 복제'], ['复制标签', '태그 복사'], ['复制绑定关系', '연결 관계 복사'],
  ['复制', '복제'], ['选择人设', '페르소나 선택'],
  ['当前角色卡绑定了多个人设，请选择一个用于本次聊天。', '현재 캐릭터에 여러 페르소나가 연결되어 있습니다. 이번 채팅에 사용할 페르소나를 선택하세요.'],
  ['移除所有绑定', '모든 연결 해제'], ['重命名人设', '페르소나 이름 변경'],
  ['请输入人设名称：', '페르소나 이름을 입력하세요:'],
  ['人设标题（可选，仅用于显示）', '페르소나 호칭 (선택 사항, 표시용)'],
  ['人设标签（可选，逗号分隔多个）', '페르소나 태그 (선택 사항, 쉼표로 구분)'],
  ['如果只是上传头像可以取消。', '아바타만 업로드하려면 취소해도 됩니다.'],
  ['之后还可以修改。', '나중에 변경할 수 있습니다.'], ['删除人设', '페르소나 삭제'],
  ['确定要删除这个头像吗？', '이 아바타를 삭제할까요?'],
  ['关联的人设信息将全部丢失。', '연결된 페르소나 정보가 모두 삭제됩니다.'],
  ['请输入人设描述：', '페르소나 설명을 입력하세요:'], ['保存', '저장'],
]);

const rules = [
  [/^当前 #(\d+)（共 (\d+)）$/, (_, position, count) => `현재 #${position} (총 ${count}개)`],
  [/^已选 (\d+) 个$/, (_, count) => `${count}개 선택됨`],
  [/^给 (\d+) 个人设添加标签（逗号分隔多个）：$/, (_, count) => `${count}개 페르소나에 추가할 태그 (쉼표로 구분):`],
  [/^从 (\d+) 个人设中移除标签：$/, (_, count) => `${count}개 페르소나에서 제거할 태그:`],
  [/^确定要删除 (\d+) 个人设吗？此操作不可撤销！$/, (_, count) => `${count}개 페르소나를 삭제할까요? 이 작업은 되돌릴 수 없습니다!`],
];

export function translatePersonaTagsString(input) {
  if (typeof input !== 'string' || !/[\u3400-\u9FFF]/.test(input)) return input;
  const core = input.trim();
  let translated = exact.get(core);
  if (translated === undefined) {
    for (const [pattern, replace] of rules) {
      if (!pattern.test(core)) continue;
      translated = core.replace(pattern, replace);
      break;
    }
  }
  if (translated === undefined) return input;
  const start = input.indexOf(core);
  return input.slice(0, start) + translated + input.slice(start + core.length);
}
