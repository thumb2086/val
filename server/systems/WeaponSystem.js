// Server-side WeaponSystem
// 職責：驗證開火、處理冷卻、（未來）命中判定、計算傷害，
// 並回傳需廣播的事件資料給外部（server/server.js）去 emit。

import { WEAPONS } from '../../configs/weapons.js';

export default class WeaponSystem {
  constructor() {
    // 開火時間記錄：{ [username]: { [weaponId]: lastShotAtMs } }
    this.lastShotAt = new Map();
  }

  _getLastShot(username, weaponId) {
    const userMap = this.lastShotAt.get(username) || {};
    return userMap[weaponId] || 0;
  }

  _setLastShot(username, weaponId, ts) {
    const userMap = this.lastShotAt.get(username) || {};
    userMap[weaponId] = ts;
    this.lastShotAt.set(username, userMap);
  }

  canFire({ username, weaponId, nowMs = Date.now() }) {
    const weapon = WEAPONS[weaponId];
    if (!weapon) return false;
    const last = this._getLastShot(username, weaponId);
    return nowMs - last >= weapon.fireRate * 1000;
  }

  // 處理射擊請求（由 server/server.js 的 socket.on('shoot') 轉呼叫）
  // params: { roomId, point, weaponId }
  // returns: { ok, reason?, broadcast?: { event, payload } }
  handleShoot({ socket, game, roomId, point, weaponId }) {
    const username = socket.username;

    // 基本驗證：玩家存在、存活
    const player = game?.gameState?.players?.[username];
    if (!player || !player.isAlive) {
      return { ok: false, reason: 'player_invalid' };
    }

    // 武器與冷卻驗證
    if (!this.canFire({ username, weaponId })) {
      return { ok: false, reason: 'cooldown' };
    }

    // 記錄開火時間
    this._setLastShot(username, weaponId, Date.now());

    // TODO: 命中判定（之後用射線與地圖/玩家碰撞體進行精確計算）
    // 目前先不做真正判定，只廣播開火事件給其他客戶端同步特效。

    return {
      ok: true,
      broadcast: {
        event: 'playerShot',
        payload: { username, point, weaponId }
      }
    };
  }

  // 計算並套用傷害（若未來在伺服器集中處理命中）
  // returns: { died, targetUsername, killerUsername, damage }
  applyDamage({ game, targetUsername, killerUsername, damage }) {
    const target = game?.gameState?.players?.[targetUsername];
    if (!target || !target.isAlive) return { died: false, targetUsername, killerUsername, damage: 0 };

    target.health -= damage;
    if (target.health <= 0) {
      target.health = 0;
      const winResult = game.handleKill(killerUsername, targetUsername);
      return { died: true, targetUsername, killerUsername, damage, winResult };
    }
    return { died: false, targetUsername, killerUsername, damage };
  }
}
