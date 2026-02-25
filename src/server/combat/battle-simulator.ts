import type { BoardUnitPlacement, BoardUnitType } from "../../shared/room-messages";
import { getStarCombatMultiplier } from "../star-level-config";
import { SKILL_DEFINITIONS } from "./skill-definitions";

/**
 * アクションインターフェース
 * 戦闘中のユニットアクションを表現
 */
export interface Action {
  unit: BattleUnit;
  actionTime: number;
  type: "attack" | "skill";
}

/**
 * 戦闘シミュレーション用ユニット
 * 戦闘中のユニット状態を表現
 */
export interface BattleUnit {
  id: string;
  type: BoardUnitType;
  starLevel: number;
  hp: number;
  maxHp: number;
  attackPower: number;
  attackSpeed: number; // 1秒あたりの攻撃回数（0.5 = 2秒に1回攻撃）
  attackRange: number; // 1 = 近接, 2+ = 遠距離
  cell: number; // 0-7 のボード位置
  isDead: boolean;
  attackCount: number; // スキルトリガー用の攻撃回数トラッキング
  defense: number; // ベース防御力（被ダメージを軽減）
  buffModifiers: {
    attackMultiplier: number; // デフォルト 1.0
    defenseMultiplier: number; // デフォルト 1.0
    attackSpeedMultiplier: number; // デフォルト 1.0
  };
}

/**
 * 戦闘結果
 * 戦闘の結果を含む情報
 */
export interface BattleResult {
  winner: "left" | "right" | "draw";
  leftSurvivors: BattleUnit[];
  rightSurvivors: BattleUnit[];
  combatLog: string[]; // デバッグ用
  durationMs: number;
}

/**
 * ユニットタイプ別の基本ステータス
 */
interface BaseUnitStats {
  hp: number;
  attack: number;
  attackSpeed: number;
  range: number;
}

const BASE_STATS: Readonly<Record<BoardUnitType, BaseUnitStats>> = {
  vanguard: { hp: 80, attack: 4, attackSpeed: 0.5, range: 1 },
  ranger: { hp: 50, attack: 5, attackSpeed: 0.8, range: 3 },
  mage: { hp: 40, attack: 6, attackSpeed: 0.6, range: 2 },
  assassin: { hp: 45, attack: 5, attackSpeed: 1.0, range: 1 },
};

/**
 * BattleUnit を作成するヘルパー関数
 * BoardUnitPlacement から BattleUnit を生成し、星レベルに応じたステータスを適用
 */
export function createBattleUnit(
  placement: BoardUnitPlacement,
  side: "left" | "right",
  index: number,
): BattleUnit {
  const { unitType, starLevel = 1, cell } = placement;
  const baseStats = BASE_STATS[unitType];
  const starMultiplier = getStarCombatMultiplier(starLevel);

  const scaledHp = baseStats.hp * starMultiplier;
  const scaledAttack = baseStats.attack * starMultiplier;

  return {
    id: `${side}-${unitType}-${index}`,
    type: unitType,
    starLevel,
    hp: scaledHp,
    maxHp: scaledHp,
    attackPower: scaledAttack,
    attackSpeed: baseStats.attackSpeed,
    attackRange: baseStats.range,
    cell,
    isDead: false,
    attackCount: 0,
    defense: unitType === "vanguard" ? 3 : 0, // Vanguard はタフなので防御力が高い
    buffModifiers: {
      attackMultiplier: 1.0,
      defenseMultiplier: 1.0,
      attackSpeedMultiplier: 1.0,
    },
  };
}

/**
 * セル間の距離を計算
 * ボード上の2つのセル間の距離（絶対値の差）を計算
 */
export function calculateCellDistance(cell1: number, cell2: number): number {
  return Math.abs(cell1 - cell2);
}

/**
 * ターゲット選択ロジック
 * 攻撃者に対して、射程内の最も近い生きている敵ユニットを返す
 * @param attacker 攻撃者
 * @param enemies 敵ユニット配列
 * @returns ターゲットユニット（射程内に有効なターゲットがない場合は null）
 */
export function findTarget(attacker: BattleUnit, enemies: BattleUnit[]): BattleUnit | null {
  if (!enemies || enemies.length === 0) {
    return null;
  }

  const livingEnemies = enemies.filter((enemy) => !enemy.isDead);

  if (livingEnemies.length === 0) {
    return null;
  }

  let closestTarget: BattleUnit | null = null;
  let minDistance = Infinity;

  for (const enemy of livingEnemies) {
    const distance = calculateCellDistance(attacker.cell, enemy.cell);

    if (distance <= attacker.attackRange && distance < minDistance) {
      minDistance = distance;
      closestTarget = enemy;
    }
  }

  return closestTarget;
}

/**
 * チームの戦力を計算（HPと攻撃力の合計）
 */
function calculateTeamPower(units: BattleUnit[]): number {
  return units.reduce((total, unit) => {
    if (unit.isDead) {
      return total;
    }
    return total + unit.hp + unit.attackPower;
  }, 0);
}

/**
 * ユニット名を生成（戦闘ログ用）
 */
function generateUnitName(unit: BattleUnit): string {
  const sideLabel = unit.id.startsWith("left") ? "Left" : "Right";
  const typeLabel = unit.type.charAt(0).toUpperCase() + unit.type.slice(1);
  return `${sideLabel} ${typeLabel} (cell ${unit.cell})`;
}

/**
 * 生存中のユニットが存在するかを確認
 */
function hasLivingUnits(units: BattleUnit[]): boolean {
  return units.some((unit) => !unit.isDead);
}

/**
 * 戦闘シミュレーター
 * ターン制戦闘ループを実装
 */
export class BattleSimulator {
  /**
   * 戦闘をシミュレート
   * ターゲット選択ロジックとターン制戦闘ループを使用して戦闘をシミュレート
   * @param leftUnits 左側チームのユニット（セル 0-3）
   * @param rightUnits 右側チームのユニット（セル 4-7）
   * @param maxDurationMs 最大戦闘時間（ミリ秒）
   * @returns 戦闘結果
   */
  simulateBattle(
    leftUnits: BattleUnit[],
    rightUnits: BattleUnit[],
    maxDurationMs: number,
  ): BattleResult {
    const combatLog: string[] = [];
    combatLog.push("Battle started");
    combatLog.push(`Left units: ${leftUnits.length}`);
    combatLog.push(`Right units: ${rightUnits.length}`);

    const allUnits = [...leftUnits, ...rightUnits];
    const actionQueue: Action[] = [];
    let currentTime = 0;

    // 全ユニットの初期アクションをキューに追加
    for (const unit of allUnits) {
      actionQueue.push({
        unit,
        actionTime: 0,
        type: "attack",
      });
    }

    actionQueue.sort((a, b) => a.actionTime - b.actionTime);

    // 戦闘ループ
    while (currentTime < maxDurationMs && hasLivingUnits(leftUnits) && hasLivingUnits(rightUnits)) {
      const action = actionQueue.shift();

      if (!action) {
        break;
      }

      if (action.unit.isDead) {
        continue;
      }

      currentTime = action.actionTime;

      if (action.type === "attack") {
        const enemies = action.unit.id.startsWith("left") ? rightUnits : leftUnits;
        const target = findTarget(action.unit, enemies);

        if (target) {
          // 防御力とバフモディファイアを適用したダメージ計算
          const actualDamage = Math.max(1, Math.floor(
            action.unit.attackPower * action.unit.buffModifiers.attackMultiplier -
            target.defense * target.buffModifiers.defenseMultiplier
          ));
          target.hp -= actualDamage;

          combatLog.push(
            `${generateUnitName(action.unit)} attacks ${generateUnitName(target)} for ${actualDamage} damage (HP: ${target.hp}/${target.maxHp})`,
          );

          if (target.hp <= 0) {
            target.isDead = true;
            combatLog.push(`${generateUnitName(target)} has been defeated!`);
          }

          // 攻撃カウントを増加
          action.unit.attackCount++;

          // スキルトリガーのチェック
          const skillDef = SKILL_DEFINITIONS[action.unit.type];
          if (skillDef && skillDef.triggerType === 'on_attack_count' &&
              action.unit.attackCount % skillDef.triggerCount === 0) {
            // スキルを即座にスケジュール
            actionQueue.push({
              unit: action.unit,
              actionTime: currentTime,
              type: 'skill'
            });
          }

          // 次の攻撃をスケジュール（0でない場合）
          if (action.unit.attackSpeed > 0) {
            const nextAttackTime = currentTime + (1000 / (action.unit.attackSpeed * action.unit.buffModifiers.attackSpeedMultiplier));
            actionQueue.push({
              unit: action.unit,
              actionTime: nextAttackTime,
              type: "attack",
            });
          }
        } else {
          // 攻撃カウントを増加（ターゲットが見つからない場合も）
          action.unit.attackCount++;

          // 次の攻撃をスケジュール
          if (action.unit.attackSpeed > 0) {
            const nextAttackTime = currentTime + (1000 / (action.unit.attackSpeed * action.unit.buffModifiers.attackSpeedMultiplier));
            actionQueue.push({
              unit: action.unit,
              actionTime: nextAttackTime,
              type: "attack",
            });
          }
        }
      } else if (action.type === "skill") {
        const skillDef = SKILL_DEFINITIONS[action.unit.type];
        if (skillDef) {
          // ユニットのサイドに基づいて味方と敵を決定
          const isLeftSide = leftUnits.includes(action.unit);
          const allies = isLeftSide ? leftUnits : rightUnits;
          const enemies = isLeftSide ? rightUnits : leftUnits;

          skillDef.execute(action.unit, allies, enemies, combatLog);

          // スキルによる死亡をチェック
          for (const enemy of enemies) {
            if (enemy.hp <= 0 && !enemy.isDead) {
              enemy.isDead = true;
              combatLog.push(`${generateUnitName(enemy)} has been defeated!`);
            }
          }
        }
      }

      actionQueue.sort((a, b) => a.actionTime - b.actionTime);
    }

    const result = this.determineBattleResult(leftUnits, rightUnits, currentTime, maxDurationMs, combatLog);

    return result;
  }

  /**
   * 戦闘結果を判定
   * @param leftUnits 左側ユニット
   * @param rightUnits 右側ユニット
   * @param currentTime 現在の戦闘時間
   * @param maxDurationMs 最大戦闘時間
   * @param combatLog 戦闘ログ
   * @returns 戦闘結果
   */
  private determineBattleResult(
    leftUnits: BattleUnit[],
    rightUnits: BattleUnit[],
    currentTime: number,
    maxDurationMs: number,
    combatLog: string[],
  ): BattleResult {
    const leftSurvivors = leftUnits.filter((unit) => !unit.isDead);
    const rightSurvivors = rightUnits.filter((unit) => !unit.isDead);

    if (leftSurvivors.length === 0 && rightSurvivors.length === 0) {
      combatLog.push("Battle ended: Draw (all units defeated)");
      return {
        winner: "draw",
        leftSurvivors: [],
        rightSurvivors: [],
        combatLog,
        durationMs: currentTime,
      };
    }

    if (leftSurvivors.length === 0) {
      combatLog.push("Battle ended: Right wins");
      return {
        winner: "right",
        leftSurvivors: [],
        rightSurvivors,
        combatLog,
        durationMs: currentTime,
      };
    }

    if (rightSurvivors.length === 0) {
      combatLog.push("Battle ended: Left wins");
      return {
        winner: "left",
        leftSurvivors,
        rightSurvivors: [],
        combatLog,
        durationMs: currentTime,
      };
    }

    // 時間制限に達した場合
    if (currentTime >= maxDurationMs) {
      const leftTotalHp = leftSurvivors.reduce((sum, unit) => sum + unit.hp, 0);
      const rightTotalHp = rightSurvivors.reduce((sum, unit) => sum + unit.hp, 0);

      if (leftTotalHp > rightTotalHp) {
        combatLog.push(`Battle ended: Left wins (HP: ${leftTotalHp} vs ${rightTotalHp})`);
        return {
          winner: "left",
          leftSurvivors,
          rightSurvivors,
          combatLog,
          durationMs: currentTime,
        };
      } else if (rightTotalHp > leftTotalHp) {
        combatLog.push(`Battle ended: Right wins (HP: ${rightTotalHp} vs ${leftTotalHp})`);
        return {
          winner: "right",
          leftSurvivors,
          rightSurvivors,
          combatLog,
          durationMs: currentTime,
        };
      } else {
        combatLog.push(`Battle ended: Draw (HP: ${leftTotalHp} vs ${rightTotalHp})`);
        return {
          winner: "draw",
          leftSurvivors,
          rightSurvivors,
          combatLog,
          durationMs: currentTime,
        };
      }
    }

    combatLog.push("Battle ended: Unexpected termination");
    return {
      winner: "draw",
      leftSurvivors,
      rightSurvivors,
      combatLog,
      durationMs: currentTime,
    };
  }
}
