export const roughCutTranslations = {
  en: {
    'node.rough-cut': 'Rough Cut',
    'node.desc.rough-cut':
      'A recording laid out as a film: it cuts the clip into scenes where the speech itself stops, and marks the voice with the same boundaries so the Assemble node can measure them.',
    'error.ROUGH_CUT_NO_WORDS': 'This voice has no word timings: wire the Caption Sync node in first',
    'node.roughCutTarget': 'scene length',
    'node.roughCutMin': 'shortest scene',
    'node.roughCutPause': 'a pause that ends a scene',
    'node.roughCutHint': 'Nothing is dropped and nothing is reordered: the scenes are the recording, cut where it goes quiet.',
    'node.roughCutScenes': 'scenes',
  },
  vi: {
    'node.rough-cut': 'Rough Cut',
    'node.desc.rough-cut': 'Trải clip quay sẵn thành phim: cắt cảnh ngay chỗ lời nói ngừng, rồi đánh dấu giọng theo đúng các mốc đó để node Ghép Cảnh đo được.',
    'error.ROUGH_CUT_NO_WORDS': 'Giọng này chưa có mốc từng chữ: nối node Caption Sync vào trước',
    'node.roughCutTarget': 'độ dài mỗi cảnh',
    'node.roughCutMin': 'cảnh ngắn nhất',
    'node.roughCutPause': 'ngừng bao lâu thì cắt cảnh',
    'node.roughCutHint': 'Không bỏ gì, không đảo gì: các cảnh chính là clip, cắt ở chỗ lời nói ngừng.',
    'node.roughCutScenes': 'cảnh',
  },
};
