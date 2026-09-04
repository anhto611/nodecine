import { describe, expect, it } from 'vitest';
import { detectLanguage } from '../text/detect-language';

describe('detectLanguage', () => {
  it('reports Latin text without Vietnamese markers as English', () => {
    expect(detectLanguage('Meet NodeCine. Build short videos from a node graph, not a timeline.')).toBe('en');
    expect(detectLanguage('Café, résumé and naïve are still English here.')).toBe('en');
  });

  it('recognises Vietnamese by its unique letters and tone marks', () => {
    expect(detectLanguage('Gặp NodeCine. Dựng video ngắn từ đồ thị khối, không phải timeline.')).toBe('vi');
    expect(detectLanguage('Hà Nội mùa thu')).toBe('vi');
  });

  it('recognises the major non-Latin scripts', () => {
    expect(detectLanguage('ノードグラフから短い動画を作る。')).toBe('ja');
    expect(detectLanguage('从节点图构建短视频。')).toBe('zh');
    expect(detectLanguage('노드 그래프로 짧은 영상을 만듭니다.')).toBe('ko');
    expect(detectLanguage('Создавайте короткие видео из графа узлов.')).toBe('ru');
    expect(detectLanguage('สร้างวิดีโอสั้นจากกราฟโหนด')).toBe('th');
  });

  it('is not fooled by a few foreign characters inside English text', () => {
    expect(detectLanguage('The repo is called 東京 but the script is in English throughout the whole video.')).toBe('en');
  });

  it('defaults to English for empty input', () => {
    expect(detectLanguage('')).toBe('en');
    expect(detectLanguage('   \n')).toBe('en');
  });
});
