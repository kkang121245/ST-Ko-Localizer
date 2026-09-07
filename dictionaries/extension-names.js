(() => {
  const store = (globalThis.__stKoLocalizerDictStore ??= {});
  store["extension-names"] = {
  "exactEntries": [
    [
      "酒馆助手",
      "태번 헬퍼"
    ],
    [
      "鸡尾酒",
      "칵테일"
    ],
    [
      "世界书大扫除🧹",
      "월드 인포 대청소🧹"
    ],
    [
      "记忆增强表格",
      "기억 강화 테이블"
    ],
    [
      "Horae - 时光记忆",
      "Horae - 시간의 기억"
    ],
    [
      "柏宝箱",
      "바이바이 보물상자"
    ],
    [
      "MiniMax语音",
      "MiniMax 음성"
    ],
    [
      "美化管理",
      "뷰티 매니저"
    ],
    [
      "柏柏",
      "바이바이"
    ],
    [
      "羽吻奈",
      "위원나"
    ],
    [
      "世界书统一管理家政服务",
      "월드 인포 통합 관리 도우미"
    ],
    [
      "MiniMax TTS 语音播放 + 语音通话（悬浮球一键打电话）。",
      "MiniMax TTS 음성 재생 + 음성 통화 (플로팅 버튼으로 바로 전화)."
    ]
  ],
  "overrideEntries": [],
  "regexRules": [
    {
      "pattern": "^美化管理 v(.+)$",
      "flags": "",
      "replace": "뷰티 매니저 v$1"
    },
    {
      "pattern": "^v(\\S+): 修复 TauriTavern 纯前端环境 metadata 无法保存，保留原生酒馆严格数据安全校验$",
      "flags": "",
      "replace": "v$1: TauriTavern 순수 프런트엔드 환경에서 metadata가 저장되지 않던 문제 수정, 태번 기본의 엄격한 데이터 안전 검증은 유지"
    }
  ]
};
})();
