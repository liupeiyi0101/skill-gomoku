import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HERO_STATIONS,
  SPIDER_MAN,
  SPIDER_PLACEMENT_STORYBOARD,
} from '../lib/heroes.ts';

void test('Xiaoguo keeps the latest workbook hero / talent / skill IDs and source descriptions', () => {
  assert.equal(SPIDER_MAN.id, 'Hero001');
  assert.equal(SPIDER_MAN.sourceName, '小果');
  assert.equal(SPIDER_MAN.talent.id, 'Talent001');
  assert.equal(SPIDER_MAN.talent.name, '蜘蛛感应');
  assert.equal(
    SPIDER_MAN.talent.description,
    '当对手落下的这颗棋后出现三连棋子时，Q版人物旁边出现一个叹号“！”',
  );
  assert.equal(SPIDER_MAN.skill.id, 'Skill001');
  assert.equal(SPIDER_MAN.skill.name, '蛛丝换位');
  assert.equal(
    SPIDER_MAN.skill.description,
    '蜘蛛侠可以发射一个蛛丝让任意一颗棋子换位',
  );
});

void test('standard mode forbids abilities; source omissions remain distinct from playable defaults', () => {
  assert.deepEqual(SPIDER_MAN.modePolicy.standard, {
    appearance: true,
    talent: false,
    skill: false,
  });
  assert.equal(SPIDER_MAN.talent.implemented, true);
  assert.equal(SPIDER_MAN.skill.implemented, true);
  assert.equal(SPIDER_MAN.skill.targetRule, null);
  assert.equal(SPIDER_MAN.skill.cooldown, null);
  assert.equal(SPIDER_MAN.skill.useLimit, null);
  assert.equal(SPIDER_MAN.skill.consumesNormalMove, null);
});

void test('hero stations have two distinct camera views and a complete placement storyboard', () => {
  assert.equal(HERO_STATIONS.A.position, 'bottom-left');
  assert.equal(HERO_STATIONS.B.position, 'top-right');
  assert.notEqual(HERO_STATIONS.A.view, HERO_STATIONS.B.view);
  assert.notEqual(HERO_STATIONS.A.facing, HERO_STATIONS.B.facing);
  assert.match(HERO_STATIONS.A.sprites, /actions-rear\.png$/);
  assert.match(HERO_STATIONS.B.sprites, /actions-front\.png$/);
  assert.deepEqual(SPIDER_PLACEMENT_STORYBOARD, [
    'idle',
    'anticipate',
    'shoot-web',
    'web-arrives',
    'token-forms',
    'recover',
  ]);
});
