import type { BoardUnitPlacement, BoardUnitType } from "../../shared/room-messages";
import { getStarCombatMultiplier } from "../star-level-config";
import { SKILL_DEFINITIONS } from "./skill-definitions";
import { SYNERGY_DEFINITIONS, calculateSynergyDetails, SynergyTier } from "./synergy-definitions";
import { ITEM_DEFINITIONS, ItemType } from "./item-definitions";
import { getScarletMansionUnitById } from "../../data/scarlet-mansion-units";

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
  isBoss?: boolean; // ボスフラグ（ボス戦時のみ）
  attackCount: number; // スキルトリガー用の攻撃回数トラッキング
  defense: number; // ベース防御力（被ダメージを軽減）
  critRate: number; // 0.0-1.0, クリティカルヒット率
  critDamageMultiplier: number; // 1.5 = 150% クリティカルダメージ
  physicalReduction: number | undefined; // 物理ダメージ軽減率（0-100）
  magicReduction: number | undefined; // 魔法ダメージ軽減率（0-100）
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
  damageDealt: {
    left: number;   // 左チームが与えた合計ダメージ
    right: number;  // 右チームが与えた合計ダメージ
  };
  bossDamage?: number;  // ボスが受けたダメージ（ボス戦時のみ）
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
 * Scarlet Mansionユニットの場合は特殊ステータスを適用
 * ボス（remilia）の場合はボスステータスを適用
 */
export function createBattleUnit(
  placement: BoardUnitPlacement,
  side: "left" | "right",
  index: number,
  isBoss: boolean = false,
): BattleUnit {
  const { unitType, starLevel = 1, cell, archetype } = placement;
  const baseStats = BASE_STATS[unitType];

  // Scarlet Mansionユニットの特殊ステータスをチェック
  let finalHp: number;
  let finalAttack: number;
  let finalAttackSpeed: number;
  let finalRange: number;
  let finalDefense: number;
  let finalPhysicalReduction: number | undefined = undefined;
  let finalMagicReduction: number | undefined = undefined;

  if (isBoss && archetype === "remilia") {
    // ボス（remilia）の場合、ボスステータスを適用
    finalHp = 3200;
    finalAttack = 280;
    finalAttackSpeed = 0.95;
    finalRange = 3;
    finalDefense = 0; // ボスは reduction を使用
    finalPhysicalReduction = 15;
    finalMagicReduction = 10;
  } else if (archetype && ["meiling", "sakuya", "patchouli"].includes(archetype)) {
    // Scarlet Mansionユニットの場合、特殊ステータスを適用
    const scarletUnit = getScarletMansionUnitById(archetype);
    if (scarletUnit) {
      finalHp = scarletUnit.hp;
      finalAttack = scarletUnit.attack;
      finalAttackSpeed = scarletUnit.attackSpeed;
      finalRange = scarletUnit.range;
      // 物理軽減と魔法軽減の平均を防御力として適用
      finalDefense = (scarletUnit.physicalReduction + scarletUnit.magicReduction) / 2;
      finalPhysicalReduction = scarletUnit.physicalReduction;
      finalMagicReduction = scarletUnit.magicReduction;
    } else {
      // フォールバック: 通常ステータスを使用
      const starMultiplier = isBoss ? 1.0 : getStarCombatMultiplier(starLevel);
      finalHp = baseStats.hp * starMultiplier;
      finalAttack = baseStats.attack * starMultiplier;
      finalAttackSpeed = baseStats.attackSpeed;
      finalRange = baseStats.range;
      finalDefense = unitType === "vanguard" ? 3 : 0;
    }
  } else {
    // 通常ユニット: 星レベル倍率を適用
    const starMultiplier = isBoss ? 1.0 : getStarCombatMultiplier(starLevel);
    finalHp = baseStats.hp * starMultiplier;
    finalAttack = baseStats.attack * starMultiplier;
    finalAttackSpeed = baseStats.attackSpeed;
    finalRange = baseStats.range;
    finalDefense = unitType === "vanguard" ? 3 : 0;
  }

  return {
    id: `${side}-${unitType}-${index}`,
    type: unitType,
    starLevel,
    hp: finalHp,
    maxHp: finalHp,
    attackPower: finalAttack,
    attackSpeed: finalAttackSpeed,
    attackRange: finalRange,
    cell,
    isDead: false,
    isBoss,
    attackCount: 0,
    defense: finalDefense,
    critRate: 0,
    critDamageMultiplier: 1.5,
    physicalReduction: finalPhysicalReduction,
    magicReduction: finalMagicReduction,
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
 * ボスパッシブ「紅色の世界」が有効かどうかを判定
 * 条件: ボスユニットかつ HP ≥ 70%
 * @param unit ユニット
 * @returns パッシブが有効な場合は true
 */
function isBossPassiveActive(unit: BattleUnit): boolean {
  if (!unit.isBoss) {
    return false;
  }
  return unit.hp >= unit.maxHp * 0.7;
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
 * シナジーバフをユニットに適用
 * @param units ユニット配列
 * @param boardPlacements ボード配置情報
 */
function applySynergyBuffs(
  units: BattleUnit[],
  boardPlacements: BoardUnitPlacement[]
): void {
  const synergyDetails = calculateSynergyDetails(boardPlacements);

  for (const unit of units) {
    const tier = synergyDetails.activeTiers[unit.type];
    if (tier === 0) continue;

    const def = SYNERGY_DEFINITIONS[unit.type];
    const idx = tier - 1; // tier 1 -> index 0

    // Apply defense buff
    if (def.effects.defense) {
      const defenseValue = def.effects.defense[idx];
      if (defenseValue !== undefined) {
        unit.defense += defenseValue;
      }
    }

    // Apply HP multiplier
    if (def.effects.hpMultiplier) {
      const multiplier = def.effects.hpMultiplier[idx];
      if (multiplier !== undefined) {
        unit.maxHp = Math.floor(unit.maxHp * multiplier);
        unit.hp = Math.floor(unit.hp * multiplier);
      }
    }

    // Apply attack power buff
    if (def.effects.attackPower) {
      const attackPowerValue = def.effects.attackPower[idx];
      if (attackPowerValue !== undefined) {
        unit.attackPower += attackPowerValue;
      }
    }

    // Apply attack speed multiplier
    if (def.effects.attackSpeedMultiplier) {
      const attackSpeedValue = def.effects.attackSpeedMultiplier[idx];
      if (attackSpeedValue !== undefined) {
        unit.buffModifiers.attackSpeedMultiplier *= attackSpeedValue;
      }
    }

    // Apply crit rate
    if (def.effects.critRate) {
      const critRateValue = def.effects.critRate[idx];
      if (critRateValue !== undefined) {
        unit.critRate += critRateValue;
      }
    }

    // Apply crit damage multiplier
    if (def.effects.critDamageMultiplier) {
      const critDamageValue = def.effects.critDamageMultiplier[idx];
      if (critDamageValue !== undefined) {
        unit.critDamageMultiplier = Math.max(
          unit.critDamageMultiplier,
          critDamageValue
        );
      }
    }
  }
}

/**
 * アイテム効果をユニットに適用
 * @param unit ユニット
 * @param items 装備されているアイテムの配列
 */
function applyItemEffects(unit: BattleUnit, items: ItemType[]): void {
  for (const itemType of items) {
    const itemDef = ITEM_DEFINITIONS[itemType];

    if (!itemDef || !itemDef.effects) {
      console.warn(`Invalid item definition for: ${itemType}`);
      continue;
    }

    if (itemDef.effects.attackPower !== undefined) {
      unit.attackPower += itemDef.effects.attackPower;
    }
    if (itemDef.effects.defense !== undefined) {
      unit.defense += itemDef.effects.defense;
    }
    if (itemDef.effects.attackSpeedMultiplier !== undefined) {
      unit.buffModifiers.attackSpeedMultiplier += itemDef.effects.attackSpeedMultiplier;
    }
    if (itemDef.effects.critRate !== undefined) {
      unit.critRate += itemDef.effects.critRate;
    }
    if (itemDef.effects.hpMultiplier !== undefined) {
      const multiplier = 1 + itemDef.effects.hpMultiplier;
      unit.maxHp = Math.floor(unit.maxHp * multiplier);
      unit.hp = Math.floor(unit.hp * multiplier);
    }
  }
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
   * @param leftPlacements 左側チームのユニット配置（シナジー・アイテム計算用）
   * @param rightPlacements 右側チームのユニット配置（シナジー・アイテム計算用）
   * @param maxDurationMs 最大戦闘時間（ミリ秒）
   * @returns 戦闘結果
   */
  simulateBattle(
    leftUnits: BattleUnit[],
    rightUnits: BattleUnit[],
    leftPlacements: BoardUnitPlacement[] = [],
    rightPlacements: BoardUnitPlacement[] = [],
    maxDurationMs: number = 30000,
  ): BattleResult {
    try {
      // Bug #3 fix: Validate input teams
      if (!leftUnits || leftUnits.length === 0 || !rightUnits || rightUnits.length === 0) {
        console.warn("Battle simulation with empty teams");
        const isBothEmpty = (!leftUnits || leftUnits.length === 0) && (!rightUnits || rightUnits.length === 0);
        const result: BattleResult = {
          winner: leftUnits.length > 0 ? "left" : rightUnits.length > 0 ? "right" : "draw",
          leftSurvivors: leftUnits.filter(u => !u.isDead),
          rightSurvivors: rightUnits.filter(u => !u.isDead),
          combatLog: isBothEmpty ? ["Draw (all units defeated)"] : ["Battle with empty teams"],
          durationMs: 0,
          damageDealt: {
            left: 0,
            right: 0,
          },
        };
        return result;
      }

      const combatLog: string[] = [];
      combatLog.push("Battle started");
      combatLog.push(`Left units: ${leftUnits.length}`);
      combatLog.push(`Right units: ${rightUnits.length}`);

      // シナジーバフを適用
      applySynergyBuffs(leftUnits, leftPlacements);
      applySynergyBuffs(rightUnits, rightPlacements);

      // アイテム効果を適用
      for (let i = 0; i < leftUnits.length; i++) {
        const unit = leftUnits[i];
        if (unit) {
          const items = leftPlacements[i]?.items || [];
          applyItemEffects(unit, items);
        }
      }
      for (let i = 0; i < rightUnits.length; i++) {
        const unit = rightUnits[i];
        if (unit) {
          const items = rightPlacements[i]?.items || [];
          applyItemEffects(unit, items);
        }
      }

      const allUnits = [...leftUnits, ...rightUnits];
      const actionQueue: Action[] = [];
      let currentTime = 0;

      // ダメージ追跡用変数
      let damageDealtLeft = 0;  // 左チームが与えたダメージ
      let damageDealtRight = 0; // 右チームが与えたダメージ
      let bossDamage = 0;       // ボスが受けたダメージ

      // 全ユニットの初期アクションをキューに追加
      for (const unit of allUnits) {
        actionQueue.push({
          unit,
          actionTime: 0,
          type: "attack",
        });
      }

      actionQueue.sort((a, b) => a.actionTime - b.actionTime);

      // Bug #3 fix: Add iteration counter to prevent infinite loops
      let iterationCount = 0;
      const MAX_ITERATIONS = 10000;

      // 戦闘ループ
      while (currentTime < maxDurationMs && hasLivingUnits(leftUnits) && hasLivingUnits(rightUnits)) {
        iterationCount++;
        if (iterationCount > MAX_ITERATIONS) {
          console.error("Battle simulation exceeded max iterations");
          break;
        }
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
          // クリティカルヒット判定
          const isCrit = Math.random() < action.unit.critRate;
          const critMultiplier = isCrit ? action.unit.critDamageMultiplier : 1.0;

          // ボスパッシブ「紅色の世界」の判定とATKバフ適用
          const bossPassiveActive = isBossPassiveActive(action.unit);
          const bossAtkMultiplier = bossPassiveActive ? 1.1 : 1.0;

          // 防御力とバフモディファイアとクリティカルとボスパッシブを適用したダメージ計算
          const baseDamage = action.unit.attackPower * action.unit.buffModifiers.attackMultiplier * critMultiplier * bossAtkMultiplier;
          const defense = target.defense * target.buffModifiers.defenseMultiplier;
          let actualDamage = Math.max(1, Math.floor(baseDamage - defense));

          // 物理軽減と魔法軽減を適用（ボスユニットの場合）
          if (action.unit.type === "mage" && target.magicReduction !== undefined) {
            // 魔法攻撃の場合は魔法軽減を適用
            actualDamage = Math.max(1, Math.floor(actualDamage * (1 - target.magicReduction / 100)));
          } else if (target.physicalReduction !== undefined) {
            // 物理攻撃の場合は物理軽減を適用
            actualDamage = Math.max(1, Math.floor(actualDamage * (1 - target.physicalReduction / 100)));
          }

          target.hp -= actualDamage;

          // ボスパッシブ「紅色の世界」の回復効果（与えたダメージの5%回復）
          if (bossPassiveActive && actualDamage > 0) {
            const healAmount = Math.floor(actualDamage * 0.05);
            action.unit.hp = Math.min(action.unit.maxHp, action.unit.hp + healAmount);
            if (healAmount > 0) {
              combatLog.push(
                `${generateUnitName(action.unit)} Boss Passive heals for ${healAmount} HP (${action.unit.hp}/${action.unit.maxHp})`,
              );
            }
          }

          // ダメージ追跡
          const isAttackerLeft = action.unit.id.startsWith("left");
          if (isAttackerLeft) {
            damageDealtLeft += actualDamage;
          } else {
            damageDealtRight += actualDamage;
          }

          // ボスダメージ記録
          if (target.isBoss) {
            bossDamage += actualDamage;
          }

          if (isCrit) {
            combatLog.push(
              `${generateUnitName(action.unit)} CRITICAL HIT on ${generateUnitName(target)} for ${actualDamage} damage!`,
            );
          } else {
            combatLog.push(
              `${generateUnitName(action.unit)} attacks ${generateUnitName(target)} for ${actualDamage} damage (${target.hp}/${target.maxHp})`,
            );
          }

          if (target.hp <= 0) {
            target.isDead = true;
            combatLog.push(`${generateUnitName(target)} has been defeated!`);
          }

          // 攻撃カウントを増加
      action.unit.attackCount++;

      // スキルトリガーのチェック
      const skillDef = SKILL_DEFINITIONS[action.unit.type];
      if (skillDef && skillDef.triggerType === 'on_attack_count' &&
          skillDef.triggerCount !== undefined &&
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
        if (skillDef && skillDef.execute) {
          // ユニットのサイドに基づいて味方と敵を決定
          const isLeftSide = leftUnits.includes(action.unit);
          const allies = isLeftSide ? leftUnits : rightUnits;
          const enemies = isLeftSide ? rightUnits : leftUnits;

          try {
            skillDef.execute(action.unit, allies, enemies, combatLog);
          } catch (error) {
            console.error(`Error executing skill for ${action.unit.type}:`, error);
            combatLog.push(`Error executing skill for ${action.unit.type}`);
          }

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

    const result = this.determineBattleResult(
      leftUnits, 
      rightUnits, 
      currentTime, 
      maxDurationMs, 
      combatLog,
      damageDealtLeft, 
      damageDealtRight,
      bossDamage
    );

    return result;
    } catch (error) {
      console.error("Battle simulation error:", error);
      // Return a draw result on error (Bug #3 fix)
      const result: BattleResult = {
        winner: "draw",
        leftSurvivors: leftUnits ? leftUnits.filter(u => !u.isDead) : [],
        rightSurvivors: rightUnits ? rightUnits.filter(u => !u.isDead) : [],
        combatLog: ["Battle error occurred"],
        durationMs: 0,
        damageDealt: {
          left: 0,
          right: 0,
        },
      };
      return result;
    }
  }

  /**
   * 戦闘結果を判定
   * @param leftUnits 左側ユニット
   * @param rightUnits 右側ユニット
   * @param currentTime 現在の戦闘時間
   * @param maxDurationMs 最大戦闘時間
   * @param combatLog 戦闘ログ
   * @param damageDealtLeft 左チームが与えたダメージ
   * @param damageDealtRight 右チームが与えたダメージ
   * @param bossDamage ボスが受けたダメージ
   * @returns 戦闘結果
   */
  private determineBattleResult(
    leftUnits: BattleUnit[],
    rightUnits: BattleUnit[],
    currentTime: number,
    maxDurationMs: number,
    combatLog: string[],
    damageDealtLeft: number,
    damageDealtRight: number,
    bossDamage: number = 0,
  ): BattleResult {
    // BattleResult の基本オブジェクトを作成（bossDamage は条件付きで追加）
    const createResult = (winner: "left" | "right" | "draw"): BattleResult => {
      const leftSurvivors = leftUnits.filter((unit) => !unit.isDead);
      const rightSurvivors = rightUnits.filter((unit) => !unit.isDead);
      const baseResult = {
        winner,
        leftSurvivors,
        rightSurvivors,
        combatLog,
        durationMs: currentTime,
        damageDealt: {
          left: damageDealtLeft,
          right: damageDealtRight,
        },
      };
      
      // bossDamage が 0 より大きい場合のみ追加
      if (bossDamage > 0) {
        return { ...baseResult, bossDamage };
      }
      return baseResult;
    };
    const leftSurvivors = leftUnits.filter((unit) => !unit.isDead);
    const rightSurvivors = rightUnits.filter((unit) => !unit.isDead);

    if (leftSurvivors.length === 0 && rightSurvivors.length === 0) {
      combatLog.push("Battle ended: Draw (all units defeated)");
      return createResult("draw");
    }

    if (leftSurvivors.length === 0) {
      combatLog.push("Battle ended: Right wins");
      return createResult("right");
    }

    if (rightSurvivors.length === 0) {
      combatLog.push("Battle ended: Left wins");
      return createResult("left");
    }

    // 時間制限に達した場合
    if (currentTime >= maxDurationMs) {
      const leftTotalHp = leftSurvivors.reduce((sum, unit) => sum + unit.hp, 0);
      const rightTotalHp = rightSurvivors.reduce((sum, unit) => sum + unit.hp, 0);

      if (leftTotalHp > rightTotalHp) {
        combatLog.push(`Battle ended: Left wins (HP: ${leftTotalHp} vs ${rightTotalHp})`);
        return createResult("left");
      } else if (rightTotalHp > leftTotalHp) {
        combatLog.push(`Battle ended: Right wins (HP: ${rightTotalHp} vs ${leftTotalHp})`);
        return createResult("right");
      } else {
        combatLog.push(`Battle ended: Draw (HP: ${leftTotalHp} vs ${rightTotalHp})`);
        return createResult("draw");
      }
    }

    combatLog.push("Battle ended: Unexpected termination");
    return createResult("draw");
  }
}

/**
 * ボスダメージ結果を計算
 * ボス戦のダメージに基づいて成功判定とオーバーキル量を計算
 * @param bossMaxHp ボスの最大HP
 * @param damageDealt ボスに与えたダメージ
 * @returns 成功判定とオーバーキル量
 */
export function calculateBossDamageResult(
  bossMaxHp: number,
  damageDealt: number,
): { success: boolean; overkill: number } {
  if (damageDealt >= bossMaxHp) {
    return {
      success: true,
      overkill: damageDealt - bossMaxHp,
    };
  } else {
    return {
      success: false,
      overkill: 0,
    };
  }
}
