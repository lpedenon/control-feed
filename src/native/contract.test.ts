import { describe, expect, it } from 'vitest';
import { buildRuntimeContract, buildTestContract, renderSwiftContract } from './contract';
import { PROTOCOL_VERSION, parseSyncResponse } from './protocol';

const KIT = '../../ios/Packages/NoBrainrotKit';

describe('iOS contract', () => {
  it('matches the Swift source the app compiles (pnpm ios:contract to update)', async () => {
    await expect(renderSwiftContract()).toMatchFileSnapshot(
      `${KIT}/Sources/NoBrainrotKit/ContractData.swift`,
    );
  });

  it('matches the vectors the Swift tests replay (pnpm ios:contract to update)', async () => {
    await expect(`${JSON.stringify(buildTestContract(), null, 2)}\n`).toMatchFileSnapshot(
      `${KIT}/Tests/NoBrainrotKitTests/Resources/contract-vectors.json`,
    );
  });

  it('describes the protocol this extension speaks', () => {
    expect(buildRuntimeContract().protocolVersion).toBe(PROTOCOL_VERSION);
    expect(buildTestContract().protocolVersion).toBe(PROTOCOL_VERSION);
  });

  it('embeds the same JSON that is generated', () => {
    const swift = renderSwiftContract();
    const json = swift.slice(swift.indexOf('#"""\n') + 5, swift.lastIndexOf('\n"""#'));
    expect(JSON.parse(json)).toEqual(JSON.parse(JSON.stringify(buildRuntimeContract())));
  });

  it('gives the app examples of answers this extension accepts', () => {
    const { syncResponseExample, syncRefusalExample } = buildTestContract();
    expect(parseSyncResponse(syncResponseExample)).toMatchObject({
      ok: true,
      settingsUpdatedAt: syncResponseExample.settingsUpdatedAt,
    });
    expect(parseSyncResponse(syncRefusalExample)).toEqual({
      ok: false,
      error: 'unsupported-protocol',
    });
  });

  it('exercises every editing operation and every kind of bad input', () => {
    const { vectors } = buildTestContract();
    const operations = new Set(vectors.edits.flatMap((edit) => edit.operations.map((o) => o.op)));
    expect([...operations].sort()).toEqual([
      'feature',
      'filters',
      'site',
      'topicAdd',
      'topicKeywords',
      'topicRemove',
    ]);
    expect(vectors.parseSettings.length).toBeGreaterThanOrEqual(10);
  });

  it('does not lose an edit to a rejected patch', () => {
    const repaired = buildTestContract().vectors.edits.find((edit) =>
      edit.name.startsWith('a bad'),
    );
    expect(repaired?.expected.youtubeFilters.topicMode).toBe('off');
  });
});
