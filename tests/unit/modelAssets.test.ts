import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

for (const [filename, triangles] of [['planet-06.glb', 1598], ['satellite-01.glb', 914]] as const) {
  describe(filename, () => {
    it('is a self-contained glTF 2 model under 150 KB with the selected geometry', () => {
      const bytes = readFileSync(new URL(`../../public/models/${filename}`, import.meta.url));
      expect(bytes.toString('utf8', 0, 4)).toBe('glTF');
      expect(bytes.readUInt32LE(4)).toBe(2);
      expect(bytes.readUInt32LE(8)).toBe(bytes.length);
      expect(bytes.length).toBeLessThanOrEqual(150_000);
      const json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
      expect(json.buffers.every((b: { uri?: string }) => !b.uri)).toBe(true);
      expect(json.images.every((i: { uri?: string; bufferView?: number }) => !i.uri && i.bufferView !== undefined)).toBe(true);
      const indices = json.meshes.flatMap((m: { primitives: { indices: number }[] }) => m.primitives).reduce((sum: number, p: { indices: number }) => sum + json.accessors[p.indices].count, 0);
      expect(indices / 3).toBe(triangles);
    });
  });
}
