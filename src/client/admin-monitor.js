/**
 * Admin Monitor モジュール
 * サーバーブリッジ監視・シャドー差分のUI制御
 */

import { createCorrelationId, shortPlayerId } from "./utils/pure-utils.js";

/**
 * @typedef {Object} MonitorDOMRefs
 * @property {HTMLElement|null} monitorRefreshBtn
 * @property {HTMLElement|null} monitorEventsValue
 * @property {HTMLElement|null} monitorFailureValue
 * @property {HTMLElement|null} monitorConflictValue
 * @property {HTMLElement|null} monitorLatencyValue
 * @property {HTMLElement|null} monitorShadowStatusValue
 * @property {HTMLElement|null} monitorShadowMismatchValue
 * @property {HTMLElement|null} monitorAlertValue
 * @property {HTMLElement|null} monitorTopErrorsValue
 * @property {HTMLElement|null} monitorTraceValue
 * @property {HTMLElement|null} monitorLogList
 */

/**
 * @typedef {Object} MonitorDependencies
 * @property {() => object|null} getActiveRoom アクティブルーム取得関数
 * @property {(message: string, type: string) => void} addCombatLogEntry ログ追加関数
 * @property {(correlationId: string) => void} setTraceId トレースID設定関数
 */

const CLIENT_MESSAGE_TYPES = {
  ADMIN_QUERY: "admin_query",
};

const SERVER_MESSAGE_TYPES = {
  ADMIN_RESPONSE: "admin_response",
};

/** @type {MonitorDOMRefs} */
let domRefs = {
  monitorRefreshBtn: null,
  monitorEventsValue: null,
  monitorFailureValue: null,
  monitorConflictValue: null,
  monitorLatencyValue: null,
  monitorShadowStatusValue: null,
  monitorShadowMismatchValue: null,
  monitorAlertValue: null,
  monitorTopErrorsValue: null,
  monitorTraceValue: null,
  monitorLogList: null,
};

/** @type {MonitorDependencies} */
let deps = {
  getActiveRoom: () => null,
  addCombatLogEntry: () => {},
  setTraceId: () => {},
};

/** @type {number|null} */
let monitorPollingInterval = null;

/** @type {string} */
let lastShadowDiffSignature = "";

/**
 * モニター初期化
 * @param {MonitorDOMRefs} refs DOM参照
 * @param {MonitorDependencies} dependencies 依存関数
 */
export function initAdminMonitor(refs, dependencies) {
  domRefs = { ...domRefs, ...refs };
  deps = { ...deps, ...dependencies };

  if (domRefs.monitorRefreshBtn) {
    domRefs.monitorRefreshBtn.addEventListener("click", () => {
      requestAdminMonitorSnapshot();
    });
  }
}

/**
 * ポーリング開始
 */
export function startMonitorPolling() {
  stopMonitorPolling();

  monitorPollingInterval = setInterval(() => {
    requestAdminMonitorSnapshot();
  }, 2000);
}

/**
 * ポーリング停止
 */
export function stopMonitorPolling() {
  if (monitorPollingInterval !== null) {
    clearInterval(monitorPollingInterval);
    monitorPollingInterval = null;
  }
}

/**
 * スナップショット要求
 */
export function requestAdminMonitorSnapshot() {
  const activeRoom = deps.getActiveRoom();
  if (!activeRoom || !isRoomConnectionOpen(activeRoom)) {
    return;
  }

  const windowMs = 120000;
  sendAdminQuery("dashboard", { windowMs });
  sendAdminQuery("alerts", {
    thresholds: {
      windowMs,
      minEventCount: 5,
      maxFailureRate: 0.2,
      maxConflictRate: 0.1,
      maxP95LatencyMs: 200,
    },
  });
  sendAdminQuery("top_errors", {
    windowMs,
    limit: 3,
  });
  sendAdminQuery("logs", { limit: 8 });
}

/**
 * 管理クエリ送信
 * @param {string} kind クエリ種別
 * @param {object} extraPayload 追加ペイロード
 */
function sendAdminQuery(kind, extraPayload = {}) {
  const activeRoom = deps.getActiveRoom();
  if (!activeRoom || !isRoomConnectionOpen(activeRoom)) {
    return;
  }

  const correlationId = createCorrelationId("admin");
  const payload = {
    kind,
    correlationId,
    ...extraPayload,
  };

  activeRoom.send(CLIENT_MESSAGE_TYPES.ADMIN_QUERY, payload);
  deps.setTraceId(correlationId);
  setMonitorText(domRefs.monitorTraceValue, correlationId);
}

/**
 * 管理レスポンス処理
 * @param {object} response レスポンスオブジェクト
 */
export function handleAdminResponse(response) {
  if (!response || typeof response !== "object") {
    return;
  }

  if (typeof response.correlationId === "string" && response.correlationId.length > 0) {
    deps.setTraceId(response.correlationId);
    setMonitorText(domRefs.monitorTraceValue, response.correlationId);
  }

  if (!response.ok) {
    const errorMessage = response.error || "Unknown admin query error";

    if (errorMessage === "SharedBoardBridge is not available") {
      return;
    }

    deps.addCombatLogEntry(`Monitor error: ${errorMessage}`, "lose");
    return;
  }

  switch (response.kind) {
    case "dashboard":
      renderMonitorDashboard(response.data);
      break;
    case "alerts":
      renderMonitorAlert(response.data);
      break;
    case "top_errors":
      renderMonitorTopErrors(response.data);
      break;
    case "logs":
      renderMonitorLogs(response.data);
      break;
    default:
      break;
  }
}

/**
 * シャドー差分処理
 * @param {object} message シャドー差分メッセージ
 */
export function handleShadowDiff(message) {
  if (!message || typeof message !== "object") {
    return;
  }

  const status = typeof message.status === "string" ? message.status : "unavailable";
  const mismatchCountValue = Number(message.mismatchCount);
  const mismatchCount = Number.isFinite(mismatchCountValue) ? Math.max(0, mismatchCountValue) : 0;

  setMonitorText(domRefs.monitorShadowStatusValue, status);
  setMonitorText(domRefs.monitorShadowMismatchValue, String(mismatchCount));

  const signature = `${status}:${mismatchCount}`;
  if (signature === lastShadowDiffSignature) {
    return;
  }
  lastShadowDiffSignature = signature;

  if (status === "ok") {
    deps.addCombatLogEntry("Shadow diff: OK", "info");
    return;
  }

  if (status === "mismatch") {
    const mismatchedCells = Array.isArray(message.mismatchedCells)
      ? message.mismatchedCells.slice(0, 3).map((cell) => cell?.combatCell).filter((cell) => Number.isInteger(cell))
      : [];
    const cellPreview = mismatchedCells.length > 0 ? ` cells=${mismatchedCells.join(",")}` : "";
    deps.addCombatLogEntry(`Shadow diff mismatch: ${mismatchCount}${cellPreview}`, "lose");
    return;
  }

  deps.addCombatLogEntry(`Shadow diff status: ${status}`, "lose");
}

/**
 * シャドー差分モニターリセット
 */
export function resetShadowDiffMonitor() {
  lastShadowDiffSignature = "";
  setMonitorText(domRefs.monitorShadowStatusValue, "-");
  setMonitorText(domRefs.monitorShadowMismatchValue, "0");
}

/**
 * ダッシュボード描画
 * @param {object} data ダッシュボードデータ
 */
function renderMonitorDashboard(data) {
  if (!data || typeof data !== "object") {
    return;
  }

  const eventCount = Number(data.windowEventCount) || 0;
  const failureRate = Number(data.failureRate) || 0;
  const conflictRate = Number(data.conflictRate) || 0;
  const avgLatencyMs = Number(data.avgLatencyMs) || 0;
  const p95LatencyMs = Number(data.p95LatencyMs) || 0;

  setMonitorText(domRefs.monitorEventsValue, String(eventCount));
  setMonitorText(domRefs.monitorFailureValue, `${(failureRate * 100).toFixed(1)}%`);
  setMonitorText(domRefs.monitorConflictValue, `${(conflictRate * 100).toFixed(1)}%`);
  setMonitorText(
    domRefs.monitorLatencyValue,
    `${avgLatencyMs.toFixed(1)}ms / p95 ${p95LatencyMs.toFixed(1)}ms`,
  );
}

/**
 * アラート描画
 * @param {object} data アラートデータ
 */
function renderMonitorAlert(data) {
  if (!data || typeof data !== "object") {
    return;
  }

  const hasAlert = Boolean(data.hasAlert);
  const rules = Array.isArray(data.triggeredRules)
    ? data.triggeredRules.filter((rule) => typeof rule === "string").join(", ")
    : "";

  if (hasAlert) {
    setMonitorText(domRefs.monitorAlertValue, `ALERT: ${rules || "triggered"}`);
    return;
  }

  setMonitorText(domRefs.monitorAlertValue, "OK: healthy");
}

/**
 * トップエラー描画
 * @param {object} data トップエラーデータ
 */
function renderMonitorTopErrors(data) {
  if (!Array.isArray(data)) {
    setMonitorText(domRefs.monitorTopErrorsValue, "-");
    return;
  }

  const topErrors = data
    .map((entry) => {
      const code = typeof entry?.errorCode === "string" ? entry.errorCode : "unknown";
      const count = Number(entry?.count);
      return Number.isFinite(count) ? `${code}(${count})` : code;
    })
    .filter((entry) => entry.length > 0)
    .slice(0, 3);

  setMonitorText(domRefs.monitorTopErrorsValue, topErrors.length > 0 ? topErrors.join(", ") : "-");
}

/**
 * ログ描画
 * @param {object} data ログデータ
 */
function renderMonitorLogs(data) {
  if (!domRefs.monitorLogList) {
    return;
  }

  domRefs.monitorLogList.innerHTML = "";

  const logs = Array.isArray(data) ? data : [];
  if (logs.length === 0) {
    const empty = document.createElement("div");
    empty.className = "log-entry";
    empty.textContent = "No monitor logs yet.";
    domRefs.monitorLogList.appendChild(empty);
    return;
  }

  const limitedLogs = logs.slice(-8).reverse();

  for (const log of limitedLogs) {
    const timestamp = Number(log?.timestamp);
    const eventType = typeof log?.eventType === "string" ? log.eventType : "unknown";
    const success = Boolean(log?.success);
    const correlation = typeof log?.correlationId === "string" ? log.correlationId : "-";

    const entry = document.createElement("div");
    entry.className = `log-entry ${success ? "win" : "lose"}`;
    const timeLabel = Number.isFinite(timestamp)
      ? new Date(timestamp).toLocaleTimeString()
      : "--:--:--";
    entry.textContent = `${timeLabel} ${eventType} corr=${correlation}`;
    domRefs.monitorLogList.appendChild(entry);
  }
}

/**
 * モニターテキスト設定
 * @param {HTMLElement|null} element 要素
 * @param {string} value 値
 */
function setMonitorText(element, value) {
  if (!element) {
    return;
  }

  element.textContent = value;
}

/**
 * ルーム接続が開いているか判定
 * @param {object|null} room ルームオブジェクト
 * @returns {boolean} 接続状態
 */
function isRoomConnectionOpen(room) {
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
    return connection.readyState === 1; // CONNECTION_OPEN_STATE
  }

  if (connection.ws && typeof connection.ws.readyState === "number") {
    return connection.ws.readyState === 1;
  }

  return true;
}
