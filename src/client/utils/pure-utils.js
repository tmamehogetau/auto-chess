/**
 * 純粋関数ユーティリティ
 * DOM操作なし、グローバルstateなし、副作用なしの関数群
 */

// 定数
export const CONNECTION_OPEN_STATE = 1;

export const PHASE_RESULT_LABELS = {
  pending: "Pending",
  success: "Success",
  failed: "Failed",
};

/**
 * Promiseにタイムアウトを設定
 * @param {Promise} promise 対象のPromise
 * @param {number} timeoutMs タイムアウト時間（ミリ秒）
 * @param {string} label エラーメッセージ用ラベル
 * @returns {Promise} タイムアウト付きPromise
 */
export function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      promise.finally(() => {
        clearTimeout(timeoutId);
      }).catch(() => {
        // handled by the race reject path
      });
    }),
  ]);
}

/**
 * ルーム接続が開いているか判定
 * @param {object|null} room ルームオブジェクト
 * @returns {boolean} 接続状態
 */
export function isRoomConnectionOpen(room) {
  if (!room) {
    return false;
  }

  const connection = room.connection;

  if (!connection) {
    return false;
  }

  if (typeof connection.isOpen === "boolean") {
    return connection.isOpen;
  }

  if (typeof connection.readyState === "number") {
    return connection.readyState === CONNECTION_OPEN_STATE;
  }

  if (connection.ws && typeof connection.ws.readyState === "number") {
    return connection.ws.readyState === CONNECTION_OPEN_STATE;
  }

  return true;
}

/**
 * フェーズ結果をパース
 * @param {unknown} value 文字列値
 * @returns {"pending"|"success"|"failed"} パース結果
 */
export function parsePhaseResult(value) {
  if (typeof value !== "string") {
    return "pending";
  }
  const normalized = value.toLowerCase();
  if (normalized === "success") return "success";
  if (normalized === "failed") return "failed";
  return "pending";
}

/**
 * プレイヤーIDを短縮表示
 * @param {string} value プレイヤーID
 * @returns {string} 短縮ID（先頭6文字）
 */
export function shortPlayerId(value) {
  if (!value || typeof value !== "string") {
    return "?????";
  }
  return value.slice(0, 6);
}

/**
 * フェーズ値を読み取り
 * @param {unknown} value フェーズ値
 * @returns {string} フェーズ名
 */
export function readPhase(value) {
  if (typeof value !== "string") {
    return "Waiting";
  }
  // 先頭文字を大文字に、残りを小文字に
  const normalized = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  return normalized;
}

/**
 * MapSchema風オブジェクトのエントリを取得
 * @param {object} mapLike MapSchema風オブジェクト
 * @returns {Array<[string, unknown]>} エントリ配列
 */
export function mapEntries(mapLike) {
  if (!mapLike) {
    return [];
  }

  // MapSchemaの場合は$itemsを使用
  if (mapLike.$items) {
    return Object.entries(mapLike.$items);
  }

  // 通常のMapの場合
  if (mapLike instanceof Map) {
    return Array.from(mapLike.entries());
  }

  // 通常のオブジェクトの場合
  if (typeof mapLike === "object") {
    return Object.entries(mapLike);
  }

  return [];
}

/**
 * MapSchema風オブジェクトから値を取得
 * @param {object} mapLike MapSchema風オブジェクト
 * @param {string} key キー
 * @returns {unknown} 値
 */
export function mapGet(mapLike, key) {
  if (!mapLike || !key) {
    return undefined;
  }

  // MapSchemaの場合は$itemsを使用
  if (mapLike.$items) {
    return mapLike.$items[key];
  }

  // 通常のMapの場合
  if (mapLike instanceof Map) {
    return mapLike.get(key);
  }

  // 通常のオブジェクトの場合
  if (typeof mapLike === "object") {
    return mapLike[key];
  }

  return undefined;
}

/**
 * セットIDを正規化
 * @param {string|null|undefined} value セットID値
 * @returns {string|null} 正規化されたセットID
 */
export function normalizeSetId(value) {
  if (!value || typeof value !== "string") {
    return null;
  }
  const normalized = value.toLowerCase().trim();
  return normalized || null;
}

/**
 * リジェクト理由のヒントを構築
 * @param {string} code リジェクトコード
 * @returns {string} ヒントテキスト
 */
export function buildRejectHint(code) {
  switch (code) {
    case "INVALID_PLACEMENT":
      return "配置位置が無効です。盤面内のマスを選択してください。";
    case "UNIT_NOT_FOUND":
      return "ユニットが見つかりません。ベンチまたは盤面を確認してください。";
    case "INSUFFICIENT_GOLD":
      return "ゴールドが足りません。ユニットを売却するか、次ラウンドまで待ってください。";
    case "BOARD_FULL":
      return "盤面がいっぱいです。最大8体まで配置可能です。";
    case "BENCH_FULL":
      return "ベンチがいっぱいです。最大8体まで保有可能です。";
    case "SHOP_SLOT_EMPTY":
      return "ショップのスロットが空です。リロードしてください。";
    case "ITEM_NOT_FOUND":
      return "アイテムが見つかりません。";
    case "ALREADY_EQUIPPED":
      return "既に装備しています。";
    case "TARGET_LOCKED":
      return "対象セルがロックされています。";
    case "TARGET_OCCUPIED":
      return "対象セルに他のユニットがいます。";
    case "NOT_ACTIVE_PLAYER":
      return "アクティブプレイヤーのみ操作可能です。";
    case "UNIT_NOT_OWNED":
      return "自分のユニットではありません。";
    default:
      return `操作が拒否されました: ${code}`;
  }
}

/**
 * ラウンドダメージランキングを構築
 * @param {Array} players プレイヤー情報配列
 * @returns {Array} ランキング配列
 */
export function buildRoundDamageRanking(players) {
  if (!Array.isArray(players)) {
    return [];
  }

  return players
    .map((player) => ({
      playerId: player.playerId,
      playerName: player.playerName || player.playerId,
      damageDealt: player.damageDealt || 0,
      damageTaken: player.damageTaken || 0,
      unitsRemaining: player.unitsRemaining || 0,
    }))
    .sort((a, b) => b.damageDealt - a.damageDealt);
}

/**
 * 相関IDを生成
 * @param {string} scope スコープ識別子
 * @param {number} [sequence=0] シーケンス番号
 * @returns {string} 相関ID
 */
export function createCorrelationId(scope, sequence = 0) {
  const nowMs = Date.now();
  const suffix = Math.random().toString(36).slice(2, 8);
  return `corr_${scope}_${sequence}_${nowMs}_${suffix}`;
}
