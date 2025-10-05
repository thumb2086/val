// server/systems/GameState.js
// 權威遊戲狀態管理：分數、回合、模式、玩家快照、炸彈等
export default class GameState {
  constructor(mode = '5v5', killLimit = 0) {
    this.mode = mode;
    this.killLimit = killLimit;
    this.round = 0;
    this.score = { teamA: 0, teamB: 0 };
    this.teams = {};      // username -> team
    this.players = {};    // username -> { health, isAlive, kills, position, rotation, team }
    this.bomb = { planted: false, position: null, timer: null, defused: false };
  }
}
