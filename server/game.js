
export default class Game {
  constructor(roomId, mode = '5v5', killLimit = 0) {
    this.roomId = roomId;
    this.players = [];
    this.gameState = {
      mode: mode,
      killLimit: killLimit,
      round: 0,
      score: { teamA: 0, teamB: 0 },
      teams: {},
      players: {},
      bomb: {
        planted: false,
        position: null,
        timer: null,
        defused: false
      }
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

    this.gameState.bomb = { planted: false, position: null, timer: null, defused: false };

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

  // New method to handle a kill
  handleKill(killerUsername, victimUsername) {
    const killer = this.gameState.players[killerUsername];
    const victim = this.gameState.players[victimUsername];

    if (killer && victim) {
      killer.kills++; // Increment killer's kill count
      victim.isAlive = false; // Mark victim as dead

      // Respawn victim for deathmatch
      if (this.gameState.mode === 'deathmatch') {
        setTimeout(() => {
          victim.health = 100;
          victim.isAlive = true;
          // Need a proper respawn point here
          victim.position = { x: Math.random() * 10 - 5, y: 2, z: Math.random() * 10 - 5 }; // Temporary random respawn
          // Notify clients about respawn
          // io.to(this.roomId).emit('playerRespawned', { username: victimUsername, position: victim.position });
        }, 3000); // 3 second respawn timer
      }

      // Check win condition after a kill
      return this.checkWinCondition(killerUsername); // Pass killer to check win condition
    }
    return null;
  }

  takeDamage(username, damageAmount) {
    const player = this.gameState.players[username];
    if (player && player.isAlive) {
      player.health -= damageAmount;
      if (player.health <= 0) {
        player.health = 0;
        player.isAlive = false;
        // This is where you'd typically emit a 'playerDied' event to clients
        // For now, we'll assume handleKill is called separately or integrated here.
        return { died: true, health: player.health };
      }
      return { died: false, health: player.health };
    }
    return { died: false, health: player ? player.health : 0 }; // Return current health or 0 if player not found
  }

  defuseBomb() {
    if (this.gameState.bomb.planted && !this.gameState.bomb.defused) {
      this.gameState.bomb.defused = true;
      return true;
    }
    return false;
  }

  // Modified checkRoundWin to checkWinCondition
  checkWinCondition(killerUsername = null, reason = null) {
    const { players, bomb, mode, killLimit } = this.gameState;

    if (mode === 'deathmatch') {
      if (killerUsername && players[killerUsername].kills >= killLimit) {
        return { winner: killerUsername, type: 'kills' }; // Deathmatch winner
      }
      return null; // No winner yet
    } else { // Team-based modes
      let winner = null;
      const alivePlayers = Object.values(players).filter(p => p.isAlive);
      const aliveTeamA = alivePlayers.filter(p => p.team === 'teamA').length;
      const aliveTeamB = alivePlayers.filter(p => p.team === 'teamB').length;

      if (reason === 'bomb') {
        winner = 'teamA';
        this.gameState.score.teamA++;
      } else if (reason === 'defuse') {
        winner = 'teamB';
        this.gameState.score.teamB++;
      } else if (aliveTeamB === 0) {
        winner = 'teamA';
        this.gameState.score.teamA++;
        if (bomb.timer) clearTimeout(bomb.timer);
      } else if (aliveTeamA === 0 && !bomb.planted) {
        winner = 'teamB';
        this.gameState.score.teamB++;
      }
      return winner ? { winner, type: 'round' } : null; // Return winner and type for team modes
    }
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
