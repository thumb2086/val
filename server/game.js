
export default class Game {
  constructor(roomId, mode = '5v5', killLimit = 0) {
    this.roomId = roomId;
    this.players = [];
    this.gameState = {
      mode: mode,
      killLimit: killLimit,
      roundLimit: mode === 'skirmish' ? 10 : 13, // Skirmish wins at 10 rounds, 5v5 at 13
      round: 0,
      score: { teamA: 0, teamB: 0 },
      teams: {},
      players: {},
      bomb: null // Will be initialized in startNewRound if needed
    };
  }

  addPlayer(username) {
    this.players.push(username);
  }

  startNewRound(isFirstRound) {
    if (isFirstRound) {
      this.gameState.round = 1;
      this.gameState.score = { teamA: 0, teamB: 0 };
      // Only assign teams if not deathmatch
      if (this.gameState.mode !== 'deathmatch') {
        // 保留既有隊伍，只為未分配的玩家做平衡分配
        let a = 0, b = 0;
        Object.values(this.gameState.teams).forEach(t => {
          if (t === 'teamA') a++; else if (t === 'teamB') b++;
        });
        this.players.forEach((player) => {
          if (!this.gameState.teams[player]) {
            const team = (a <= b) ? 'teamA' : 'teamB';
            this.gameState.teams[player] = team;
            if (team === 'teamA') a++; else b++;
          }
        });
      } else {
        // For deathmatch, each player is their own 'team' conceptually
        this.players.forEach(player => {
          this.gameState.teams[player] = player; // Player's username is their team
        });
      }
    } else {
      this.gameState.round++;
    }

    // Initialize bomb only for '5v5' mode
    if (this.gameState.mode === '5v5') {
      this.gameState.bomb = { planted: false, position: null, timer: null, defused: false };
    } else {
      this.gameState.bomb = null;
    }

    for (const username of this.players) {
      this.gameState.players[username] = {
        position: { x: 0, y: 0, z: 0 }, // Will need proper spawn points later
        rotation: { x: 0, y: 0, z: 0 },
        health: 100,
        weapon: 'pistol',
        isAlive: true,
        team: this.gameState.teams[username], // Use assigned team
        kills: 0 // Initialize kills for each player
      };
    }
  }

  handleKill(killerUsername, victimUsername) {
    const killer = this.gameState.players[killerUsername];
    const victim = this.gameState.players[victimUsername];

    if (!killer || !victim || !victim.isAlive) return null;

    killer.kills = (killer.kills || 0) + 1;
    victim.isAlive = false;

    // For deathmatch, check for game win and handle respawn
    if (this.gameState.mode === 'deathmatch') {
      if (killer.kills >= this.gameState.killLimit) {
        return { gameWinner: killerUsername, reason: 'kill_limit' };
      }
      // Respawn logic
      setTimeout(() => {
        victim.health = 100;
        victim.isAlive = true;
        // TODO: Use proper spawn points
        victim.position = { x: Math.random() * 10 - 5, y: 2, z: Math.random() * 10 - 5 };
      }, 3000);
      return null; // No game winner yet, round continues
    }

    // For team-based modes, check if the round is won
    return this.checkWinCondition();
  }

  defuseBomb() {
    if (this.gameState.bomb && this.gameState.bomb.planted && !this.gameState.bomb.defused) {
      this.gameState.bomb.defused = true;
      // When defuse is successful, it's a win condition
      return this.checkWinCondition('bomb_defused');
    }
    return null;
  }

  checkWinCondition(reason = null) {
    let roundWinner = null;
    let winReason = reason;

    const { players, bomb, mode, roundLimit, score } = this.gameState;

    if (mode === 'deathmatch') return null;

    const alivePlayers = Object.values(players).filter(p => p.isAlive);
    const aliveTeamA = alivePlayers.filter(p => p.team === 'teamA').length;
    const aliveTeamB = alivePlayers.filter(p => p.team === 'teamB').length;

    if (reason === 'bomb_exploded') {
        roundWinner = 'teamA';
    } else if (reason === 'bomb_defused') {
        roundWinner = 'teamB';
    } else if (aliveTeamB === 0) {
        roundWinner = 'teamA';
        winReason = 'elimination';
    } else if (aliveTeamA === 0) {
        if (mode !== '5v5' || !bomb || !bomb.planted) {
            roundWinner = 'teamB';
            winReason = 'elimination';
        }
    }

    if (roundWinner) {
      if (roundWinner === 'teamA') {
        score.teamA++;
      } else {
        score.teamB++;
      }

      if (winReason !== 'bomb_exploded' && bomb && bomb.timer) {
        clearTimeout(bomb.timer);
        this.gameState.bomb.timer = null;
      }

      if (score.teamA >= roundLimit || score.teamB >= roundLimit) {
        return { gameWinner: roundWinner, reason: 'score_limit', score: this.gameState.score };
      }

      return { roundWinner, reason: winReason, score: this.gameState.score };
    }

    return null;
  }

  // 切換玩家隊伍（僅非死鬥）
  switchTeam(username) {
    if (this.gameState.mode === 'deathmatch') return null;
    const cur = this.gameState.teams[username];
    const next = cur === 'teamA' ? 'teamB' : 'teamA';
    this.gameState.teams[username] = next;
    if (this.gameState.players[username]) {
      this.gameState.players[username].team = next;
    }
    return this.gameState.teams;
  }
}
