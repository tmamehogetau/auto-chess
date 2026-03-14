import type { BoardUnitPlacement } from "../shared/room-messages";
import type { SharedBoardRoom } from "./rooms/shared-board-room";
import type { MatchRoomController } from "./match-room-controller";
import {
  combatCellToRaidBoardIndex,
  raidBoardIndexToCombatCell,
  COMBAT_CELL_MIN_INDEX,
  COMBAT_CELL_MAX_INDEX,
  RAID_BOARD_WIDTH,
  RAID_BOARD_HEIGHT,
} from "../shared/board-geometry";

/**
 * SharedBoardとのshadow比較結果
 */
export interface ShadowDiffResult {
  /** 検知時刻（Unix epoch ms） */
  timestamp: number;
  /** shadow観測状態 */
  status: "ok" | "mismatch" | "degraded" | "unavailable";
  /** 不整合数（status=mismatch時） */
  mismatchCount: number;
  /** 不整合セル一覧（最大10件） */
  mismatchedCells: Array<{
    combatCell: number;
    gameUnitType: string | null;
    sharedUnitType: string | null;
  }>;
  /** 最後のエラーメッセージ（失敗時） */
  lastError?: string;
}

/**
 * GameRoomとSharedBoardRoom間のshadow比較を管理
 * Feature Flag制御下で動作し、game本体には影響を与えない
 */
export class SharedBoardShadowObserver {
  private readonly controller: MatchRoomController;

  private sharedBoardRoom: SharedBoardRoom | null = null;

  private lastDiffResult: ShadowDiffResult | null = null;

  private consecutiveErrors = 0;

  private readonly maxConsecutiveErrors = 3;

  private lastObservationTime = 0;

  private readonly minObservationIntervalMs = 100;

  private readonly sharedCellCount = RAID_BOARD_WIDTH * RAID_BOARD_HEIGHT;

  constructor(controller: MatchRoomController) {
    this.controller = controller;
  }

  /**
   * SharedBoardルームを接続（read-only）
   * @param room SharedBoardRoomインスタンス
   */
  public attachSharedBoard(room: SharedBoardRoom): void {
    this.sharedBoardRoom = room;
    this.consecutiveErrors = 0;
    this.lastObservationTime = 0;
    this.lastDiffResult = null;
  }

  /**
   * SharedBoardルーム接続を解除
   */
  public detachSharedBoard(): void {
    this.sharedBoardRoom = null;
    this.lastDiffResult = null;
    this.lastObservationTime = 0;
  }

  /**
   * 現在のshadow観測結果を取得
   */
  public getLastDiffResult(): ShadowDiffResult | null {
    return this.lastDiffResult;
  }

  /**
   * 全プレイヤーの配置状態を比較
   * @returns 差分検知結果
   */
  public observeAndCompare(): ShadowDiffResult {
    const now = Date.now();

    // 最低観測間隔の制限（負荷軽減）
    if (now - this.lastObservationTime < this.minObservationIntervalMs) {
      return (
        this.lastDiffResult ?? {
          timestamp: now,
          status: "ok",
          mismatchCount: 0,
          mismatchedCells: [],
        }
      );
    }

    this.lastObservationTime = now;

    // SharedBoard未接続
    if (!this.sharedBoardRoom) {
      const result: ShadowDiffResult = {
        timestamp: now,
        status: "unavailable",
        mismatchCount: 0,
        mismatchedCells: [],
        lastError: "SharedBoard room not attached",
      };
      this.lastDiffResult = result;
      return result;
    }

    try {
      const mismatches: ShadowDiffResult["mismatchedCells"] = [];

      // game側の全プレイヤーの配置を取得
      const playerIds = this.controller.getPlayerIds?.() ?? [];

      for (const playerId of playerIds) {
        const gamePlacements = this.controller.getBoardPlacementsForPlayer?.(playerId) ?? [];

        // shared_board側の対応セルを検証
        for (const placement of gamePlacements) {
          const combatCell = placement.cell;
          const sharedIndex = combatCellToRaidBoardIndex(combatCell);
          const sharedCell = this.sharedBoardRoom.state.cells.get(String(sharedIndex));

          if (!sharedCell) {
            mismatches.push({
              combatCell,
              gameUnitType: placement.unitType,
              sharedUnitType: null,
            });
            continue;
          }

          // ユニット存在確認（ownerIdが一致するか）
          const hasMatchingUnit = sharedCell.unitId && sharedCell.ownerId === playerId;

          if (!hasMatchingUnit) {
            mismatches.push({
              combatCell,
              gameUnitType: placement.unitType,
              sharedUnitType: sharedCell.unitId ? "occupied_by_other" : null,
            });
          }
        }

        // shared_board側に余分なユニットがないか確認（逆方向チェック）
        for (let sharedIndex = 0; sharedIndex < this.sharedCellCount; sharedIndex++) {
          const combatCellOpt = raidBoardIndexToCombatCell(sharedIndex);
          if (combatCellOpt === null) continue;

          const combatCell = combatCellOpt;
          const sharedCell = this.sharedBoardRoom.state.cells.get(String(sharedIndex));

          if (!sharedCell?.unitId) continue;
          if (sharedCell.ownerId !== playerId) continue;

          // game側に対応する配置があるか
          const hasGamePlacement = gamePlacements.some((p) => p.cell === combatCell);

          if (!hasGamePlacement) {
            mismatches.push({
              combatCell,
              gameUnitType: null,
              sharedUnitType: "exists_in_shared_only",
            });
          }
        }
      }

      const result: ShadowDiffResult = {
        timestamp: now,
        status: mismatches.length > 0 ? "mismatch" : "ok",
        mismatchCount: mismatches.length,
        mismatchedCells: mismatches.slice(0, 10), // 最大10件に制限
      };

      this.lastDiffResult = result;
      this.consecutiveErrors = 0;
      return result;
    } catch (error) {
      this.consecutiveErrors++;

      const result: ShadowDiffResult = {
        timestamp: now,
        status: this.consecutiveErrors >= this.maxConsecutiveErrors ? "degraded" : "unavailable",
        mismatchCount: 0,
        mismatchedCells: [],
        lastError: error instanceof Error ? error.message : String(error),
      };

      this.lastDiffResult = result;
      return result;
    }
  }

  /**
   * 特定プレイヤーの配置を比較（軽量版）
   * @param playerId プレイヤーID
   * @returns 差分検知結果
   */
  public observePlayer(playerId: string): ShadowDiffResult {
    const now = Date.now();

    if (!this.sharedBoardRoom) {
      return {
        timestamp: now,
        status: "unavailable",
        mismatchCount: 0,
        mismatchedCells: [],
        lastError: "SharedBoard room not attached",
      };
    }

    try {
      const gamePlacements = this.controller.getBoardPlacementsForPlayer?.(playerId) ?? [];
      const mismatches: ShadowDiffResult["mismatchedCells"] = [];

      for (const placement of gamePlacements) {
        const sharedIndex = combatCellToRaidBoardIndex(placement.cell);
        const sharedCell = this.sharedBoardRoom.state.cells.get(String(sharedIndex));

        const hasMatchingUnit = sharedCell?.unitId && sharedCell.ownerId === playerId;

        if (!hasMatchingUnit) {
          mismatches.push({
            combatCell: placement.cell,
            gameUnitType: placement.unitType,
            sharedUnitType: sharedCell?.unitId ? "occupied_by_other" : null,
          });
        }
      }

      for (let sharedIndex = 0; sharedIndex < this.sharedCellCount; sharedIndex++) {
        const combatCellOpt = raidBoardIndexToCombatCell(sharedIndex);
        if (combatCellOpt === null) continue;

        const combatCell = combatCellOpt;
        const sharedCell = this.sharedBoardRoom.state.cells.get(String(sharedIndex));

        if (!sharedCell?.unitId) continue;
        if (sharedCell.ownerId !== playerId) continue;

        const hasGamePlacement = gamePlacements.some((placement) => placement.cell === combatCell);

        if (!hasGamePlacement) {
          mismatches.push({
            combatCell,
            gameUnitType: null,
            sharedUnitType: "exists_in_shared_only",
          });
        }
      }

      const result: ShadowDiffResult = {
        timestamp: now,
        status: mismatches.length > 0 ? "mismatch" : "ok",
        mismatchCount: mismatches.length,
        mismatchedCells: mismatches.slice(0, 10),
      };

      this.consecutiveErrors = 0;
      this.lastDiffResult = result;
      return result;
    } catch (error) {
      this.consecutiveErrors++;

      const result: ShadowDiffResult = {
        timestamp: now,
        status: this.consecutiveErrors >= this.maxConsecutiveErrors ? "degraded" : "unavailable",
        mismatchCount: 0,
        mismatchedCells: [],
        lastError: error instanceof Error ? error.message : String(error),
      };

      this.lastDiffResult = result;
      return result;
    }
  }
}
