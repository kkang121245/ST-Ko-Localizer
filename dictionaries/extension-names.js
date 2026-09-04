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
    ]
  ],
  "overrideEntries": [],
  "regexRules": [
    {
      "pattern": "^美化管理 v(.+)$",
      "flags": "",
      "replace": "뷰티 매니저 v$1"
    }
  ]
};
})();
