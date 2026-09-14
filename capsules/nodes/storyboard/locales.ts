export const storyboardTranslations = {
  en: {
    'node.storyboard': 'Storyboard', 'node.desc.storyboard': 'The plan of a video in HyperFrames\' STORYBOARD.md: one frame per scene, its narration, and the components it shows on which word.',
    'error.STORYBOARD_INVALID': 'The storyboard does not read',
    'node.storyboardPlaceholder': '## Frame 1 — Title\n- voiceover: "What is said over this scene."\n- transition_in: cut\n\n```json\n[{ "component": "headline-card", "box": "top", "values": { "line1": "…" }, "at": "@word" }]\n```',
    'node.storyboardSummary': '{frames} frames · {spoken} spoken · {mounts} mounts',
  },
  vi: {
    'node.storyboard': 'Storyboard', 'node.desc.storyboard': 'Kế hoạch video theo STORYBOARD.md của HyperFrames: mỗi cảnh một frame, lời đọc của cảnh, và các component hiện ra khi đọc tới từ nào.',
    'error.STORYBOARD_INVALID': 'Storyboard chưa đọc được',
    'node.storyboardPlaceholder': '## Frame 1 — Tiêu đề\n- voiceover: "Lời đọc của cảnh này."\n- transition_in: cut\n\n```json\n[{ "component": "headline-card", "box": "top", "values": { "line1": "…" }, "at": "@từ" }]\n```',
    'node.storyboardSummary': '{frames} frame · {spoken} có lời · {mounts} component',
  },
};
