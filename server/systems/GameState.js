// server/systems/GameState.js
// 權威遊戲狀態管理：分數、回合、模式、玩家快照、炸彈等
export default class GameState {
  constructor(mode = '5v5', killLimit = 0) {
    this.mode = mode;
    this.killLimit = killLimit;
    this.round = 0;
    this.score = { teamA: 0, teamB: 0 };
    this.teams = {};      // username -> team
    this.players = {};    // username -> { health, isAlive, kills, position, rotation, team, role }
    this.bomb = { planted: false, position: null, timer: null, defused: false };
    
    // 特務系統相關
    this.roles = {
      ASSAULT: '突擊手',     // 前排戰鬥
      SCOUT: '偵查兵',      // 具有偵查敵人位置能力
      SUPPORT: '支援兵',     // 可以治療隊友
      SENTINEL: '哨兵',     // 可以設置陷阱和障礙物
      CONTROLLER: '控場手'   // 可以使用煙霧彈等控制場地
    };
    
    this.abilities = {
      HEAL: '治療',
      SCAN: '偵查',
      SMOKE: '煙霧',
      FLASH: '閃光',
      TRAP: '陷阱',
      WALL: '屏障'
    };
  }
}
