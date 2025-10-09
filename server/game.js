export default class Game {
  constructor(roomId, mode = 'skirmish', killLimit = 0, roundLimit = 10) {
    this.roomId = roomId;
    this.players = [];
    this.gameState = {
      mode: mode,
      killLimit: killLimit, // Kept for other potential modes
      roundLimit: roundLimit,
      round: 0,
      score: { teamA: 0, teamB: 0 },
      teams: {},
      players: {},
      economy: {
        roundStartMoney: 800,    // 回合開始時的基本金錢
        killReward: 200,         // 擊殺獎勵
        roundWinReward: 3000,    // 贏得回合的獎勵
        roundLoseReward: 1900,   // 輸掉回合的獎勵
        maxMoney: 16000,         // 最大金錢上限
        loseBonusBase: 1900,     // 連續失敗的基礎獎勵
        loseBonusIncrement: 500  // 每次連續失敗增加的獎勵
      }
    };
  }

  addPlayer(username) {
    if (!this.players.includes(username)) {
      this.players.push(username);
    }
  }

  startNewRound(isFirstRound) {
    if (isFirstRound) {
      this.gameState.round = 1;
      this.gameState.score = { teamA: 0, teamB: 0 };
      // Team assignment for team-based modes
      if (this.gameState.mode === 'skirmish' || this.gameState.mode === '5v5') {
        let teamA_count = 0;
        let teamB_count = 0;
        Object.values(this.gameState.teams).forEach(t => {
          if (t === 'teamA') teamA_count++;
          else if (t === 'teamB') teamB_count++;
        });

        this.players.forEach((player) => {
          if (!this.gameState.teams[player]) {
            const team = (teamA_count <= teamB_count) ? 'teamA' : 'teamB';
            this.gameState.teams[player] = team;
            if (team === 'teamA') teamA_count++;
            else teamB_count++;
          }
        });
      }
    } else {
      this.gameState.round++;
    }

    // Reset player states for the new round
    for (const username of this.players) {
        const team = this.gameState.teams[username];
        const spawnPoint = this._getSpawnPoint(team);
        const previousState = this.gameState.players[username] || {};
        
        this.gameState.players[username] = {
            ...previousState, // Preserve kills and other stats
            position: spawnPoint,
            rotation: { x: 0, y: 0, z: 0 },
            health: 100,
            isAlive: true,
            team: team,
            money: isFirstRound ? this.gameState.economy.roundStartMoney : (previousState.money || 0),
            loseBonusCount: isFirstRound ? 0 : (previousState.loseBonusCount || 0)
        };
    }
  }

  _getSpawnPoint(team) {
    // Simple spawn logic, can be improved with actual map data
    if (team === 'teamA') {
      return { x: -25, y: 2, z: 0 };
    } else {
      return { x: 25, y: 2, z: 0 };
    }
  }

  handleKill(killerUsername, victimUsername) {
    const killer = this.gameState.players[killerUsername];
    const victim = this.gameState.players[victimUsername];

    if (killer && victim && victim.isAlive) {
      // Ensure we don't count friendly fire for score, but still mark as dead
      if (killer.team !== victim.team) {
        killer.kills = (killer.kills || 0) + 1;
        // 添加擊殺獎勵
        const currentMoney = killer.money || 0;
        killer.money = Math.min(
          currentMoney + this.gameState.economy.killReward,
          this.gameState.economy.maxMoney
        );
      }
      victim.isAlive = false;
      victim.health = 0;
    }

    // Check for round/game end condition after every kill
    return this.checkWinCondition();
  }

  takeDamage(username, damageAmount) {
    const player = this.gameState.players[username];
    if (player && player.isAlive) {
      player.health -= damageAmount;
      if (player.health <= 0) {
        player.health = 0;
        player.isAlive = false;
        return { died: true, health: 0 };
      }
      return { died: false, health: player.health };
    }
    return { died: false, health: player ? player.health : 0 };
  }

  updateTeamEconomy(winningTeam) {
    const { economy } = this.gameState;
    
    Object.entries(this.gameState.players).forEach(([username, player]) => {
      if (!player) return;

      // 獲勝隊伍獲得勝利獎勵
      if (player.team === winningTeam) {
        player.money = Math.min(
          (player.money || 0) + economy.roundWinReward,
          economy.maxMoney
        );
        player.loseBonusCount = 0; // 重置連敗獎勵計數
      } 
      // 失敗隊伍獲得失敗獎勵 + 連敗獎勵
      else {
        player.loseBonusCount = (player.loseBonusCount || 0) + 1;
        const loseBonus = economy.loseBonusBase + 
          (player.loseBonusCount - 1) * economy.loseBonusIncrement;
        
        player.money = Math.min(
          (player.money || 0) + loseBonus,
          economy.maxMoney
        );
      }
    });
  }

  checkWinCondition() {
    const { players, mode, score, roundLimit } = this.gameState;

    if (mode !== 'skirmish') {
      return null;
    }

    const alivePlayers = Object.values(players).filter(p => p.isAlive);
    const aliveTeamA = alivePlayers.filter(p => p.team === 'teamA').length;
    const aliveTeamB = alivePlayers.filter(p => p.team === 'teamB').length;

    let roundWinner = null;
    if (aliveTeamA > 0 && aliveTeamB === 0) {
      roundWinner = 'teamA';
      score.teamA++;
    } else if (aliveTeamB > 0 && aliveTeamA === 0) {
      roundWinner = 'teamB';
      score.teamB++;
    } else if (aliveTeamA === 0 && aliveTeamB === 0) {
      // This can happen if the last two players kill each other simultaneously
      roundWinner = 'draw';
    }

    if (!roundWinner) {
      return null; // Round is still in progress
    }

    // 更新經濟系統
    if (roundWinner !== 'draw') {
      this.updateTeamEconomy(roundWinner);
    } else {
      // 平局情況下，雙方都獲得失敗獎勵
      Object.values(players).forEach(player => {
        if (player) {
          player.money = Math.min(
            (player.money || 0) + this.gameState.economy.loseBonusBase,
            this.gameState.economy.maxMoney
          );
        }
      });
    }

    // Check for overall game winner
    if (score.teamA >= roundLimit) {
      return { 
        winner: 'teamA', 
        type: 'game', 
        score: score,
        economy: { 
          players: Object.fromEntries(
            Object.entries(players).map(([name, p]) => [name, { money: p.money }])
          )
        }
      };
    }
    if (score.teamB >= roundLimit) {
      return { 
        winner: 'teamB', 
        type: 'game', 
        score: score,
        economy: { 
          players: Object.fromEntries(
            Object.entries(players).map(([name, p]) => [name, { money: p.money }])
          )
        }
      };
    }

    // Return round winner info with economy state
    return { 
      winner: roundWinner, 
      type: 'round', 
      score: score,
      economy: { 
        players: Object.fromEntries(
          Object.entries(players).map(([name, p]) => [name, { money: p.money }])
        )
      }
    };
  }

  switchTeam(username) {
    if (this.gameState.mode !== 'skirmish') return null;
    const currentTeam = this.gameState.teams[username];
    const nextTeam = currentTeam === 'teamA' ? 'teamB' : 'teamA';
    this.gameState.teams[username] = nextTeam;
    if (this.gameState.players[username]) {
      this.gameState.players[username].team = nextTeam;
    }
    return this.gameState.teams;
  }
}