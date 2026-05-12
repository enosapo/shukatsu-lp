/**
 * Intake Payload Builder — LP → /api/submit → CRM /api/lp/intake への payload 構築共通モジュール。
 *
 * 設計方針:
 *   - 「予約語以外の全クエリパラメータを転送」する汎用設計
 *   - 新しい媒体（Google Ads / 新 ASP / 新 SNS）が増えても LP 側コード変更不要
 *   - CRM 側 (extractAspParams) が予約語以外を utm_params.asp_params に自動保存する（Phase 27-C）
 *
 * 使い方（LP 側 HTML 内）:
 *   <script src="../_shared/intake-payload.js"></script>
 *   <script>
 *     const queryParams = (window.IntakePayload && window.IntakePayload.collectQueryParams)
 *       ? window.IntakePayload.collectQueryParams()
 *       : {};
 *     const payload = {
 *       ...queryParams,            // ← 先に展開し、以降の固有フィールドが必ず優先される
 *       source: 'saitan',
 *       name, phone, email, prefecture, applicationId,
 *     };
 *     fetch('/api/submit', { method: 'POST', body: JSON.stringify(payload), ... });
 *   </script>
 *
 *   ※ queryParams を必ず spread の「先頭」に置くこと。後ろに置くと ?source=xxx 等の
 *     URL 改ざんで LP 固有フィールドが上書きされる。LP 側で並び順を守るのが防御の責務。
 *
 * セキュリティ（多層防御の LP 側担当分）:
 *   - キー名は英数字 + _ - . のみ許可（記号注入防止）
 *   - 値は String 化 + 最大 500 文字に切り詰め
 *   - 最大 30 パラメータまで（payload 肥大化防止）
 *   - LP 内部制御パラメータはブラックリストで除外
 *
 * バリデーションの責務分担:
 *   - LP 側 (このモジュール): 最低限のサニタイズ、攻撃面の縮小
 *   - api/submit.ts:           なし（req.text() で生取得し中身を見ずに転送）
 *   - CRM /api/lp/intake:      zod による厳格バリデーション + extractAspParams で予約語以外を分離保存
 */
(function (global) {
  'use strict';

  // ============================================================================
  // LP 内部制御パラメータ（CRM に送らない）
  // ============================================================================
  // ここに列挙したキーは CRM 側に転送されない。
  // 例: ?debug=1, ?preview=true 等の LP 内部用パラメータ。
  // 新しい LP 内部パラメータを追加したら、ここに足す。
  const LP_INTERNAL_PARAMS = new Set([
    'debug',
    'preview',
    'lp_preview',
    'no_cache',
    'cache_bust',
    // 将来の LP 内部用パラメータをここに追加
  ]);

  // ============================================================================
  // セキュリティ制限値
  // ============================================================================
  const MAX_PARAMS = 30;
  const MAX_VALUE_LENGTH = 500;
  const VALID_KEY_REGEX = /^[a-zA-Z0-9_\-.]+$/;
  const MAX_KEY_LENGTH = 100;

  // ============================================================================
  // 既知の転送対象パラメータ（参考リスト、転送ロジックには直接影響しない）
  // ============================================================================
  // このリストは「現状認識している媒体マクロ一覧」のメモ用。
  // ここに無いパラメータも自動で転送される（汎用設計）。
  // 新媒体追加時、ここを更新する必要はない（CRM マスタ追加のみで OK）。
  const KNOWN_FORWARDED_REFERENCE = {
    utm: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'],
    a8: ['a8'],
    valuecommerce: ['sid', 'pid'],
    meta: [
      'fb_adset_id', 'fb_ad_id', 'fb_placement',
      'fb_campaign_id', 'fb_campaign_name',
      'fb_adset_name', 'fb_ad_name',
    ],
    google_ads: [
      'gclid', 'device', 'network', 'matchtype',
      'creative', 'campaignid', 'adgroupid',
    ],
  };

  // ============================================================================
  // 値のサニタイズ
  // ============================================================================

  /**
   * 値を安全な文字列に変換する。
   * null/undefined/空文字は除外、長すぎる値は切り詰め。
   *
   * @param {unknown} rawValue
   * @returns {string|null} サニタイズ後の文字列、または null（無視すべき値）
   */
  function sanitizeValue(rawValue) {
    if (rawValue === null || rawValue === undefined) return null;

    let s;
    try {
      s = String(rawValue);
    } catch (e) {
      return null;
    }

    s = s.trim();
    if (s.length === 0) return null;

    // 長さ制限（A8 の siteid 等を考慮し最大 500 文字に切り詰め）
    if (s.length > MAX_VALUE_LENGTH) {
      s = s.slice(0, MAX_VALUE_LENGTH);
    }

    return s;
  }

  /**
   * キー名が許可された文字種で構成されているか確認する。
   *
   * @param {string} key
   * @returns {boolean}
   */
  function isValidKey(key) {
    if (typeof key !== 'string') return false;
    if (key.length === 0 || key.length > MAX_KEY_LENGTH) return false;
    return VALID_KEY_REGEX.test(key);
  }

  // ============================================================================
  // メイン: クエリパラメータ収集
  // ============================================================================

  /**
   * 現在のページの URL クエリパラメータを収集し、payload に含められる形で返す。
   *
   * 除外ルール:
   *   1. LP_INTERNAL_PARAMS に含まれるキーは除外
   *   2. キー名が VALID_KEY_REGEX を満たさない場合は除外
   *   3. 値が空 / 不正な場合は除外
   *   4. 同名キーが複数ある場合は先に出現した方を採用
   *   5. 30 個を超える分は除外（先に取得した順に優先）
   *
   * @param {string} [search] テスト用に query string を明示指定（省略時は window.location.search）
   * @returns {Object<string, string>} payload にマージ可能なオブジェクト
   */
  function collectQueryParams(search) {
    let query = search;
    if (query === undefined) {
      if (typeof window === 'undefined' || !window.location) return {};
      query = window.location.search;
    }

    let params;
    try {
      params = new URLSearchParams(query);
    } catch (e) {
      return {};
    }

    const result = {};
    let count = 0;

    for (const entry of params.entries()) {
      const rawKey = entry[0];
      const rawValue = entry[1];

      // 個数制限
      if (count >= MAX_PARAMS) break;

      // LP 内部パラメータは除外
      if (LP_INTERNAL_PARAMS.has(rawKey)) continue;

      // キー名検証
      if (!isValidKey(rawKey)) continue;

      // 同名キーは先勝ち（既に追加済みなら skip）
      if (Object.prototype.hasOwnProperty.call(result, rawKey)) continue;

      // 値のサニタイズ
      const value = sanitizeValue(rawValue);
      if (value === null) continue;

      result[rawKey] = value;
      count++;
    }

    return result;
  }

  // ============================================================================
  // エクスポート（ブラウザグローバル + CommonJS 両対応）
  // ============================================================================

  const api = {
    collectQueryParams,
    // 内部テスト用エクスポート（本番では使わない）
    _sanitizeValue: sanitizeValue,
    _isValidKey: isValidKey,
    _LP_INTERNAL_PARAMS: LP_INTERNAL_PARAMS,
    _KNOWN_FORWARDED_REFERENCE: KNOWN_FORWARDED_REFERENCE,
  };

  // CommonJS（node でのユニットテスト等）
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  // ブラウザグローバル
  if (typeof global !== 'undefined') {
    global.IntakePayload = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
