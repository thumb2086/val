export default class Game {
  constructor(roomId, mode = 'skirmish', map = 'valorant_training', killLimit = 0, roundLimit = 10) {
    this.roomId = roomId;
    this.players = [];
    this.gameState = {
      mode: mode,
      map: map,
      killLimit: killLimit, // Kept for other potential modes
      roundLimit: roundLimit,
      round: 0,
      score: { teamA: 0, teamB: 0 },
      teams: {},
      players: {},
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
        this.gameState.players[username] = {
            ...this.gameState.players[username], // Preserve kills and other stats
            position: spawnPoint,
            rotation: { x: 0, y: 0, z: 0 },
            health: 100,
            isAlive: true,
            team: team,
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

    // Check for overall game winner
    if (score.teamA >= roundLimit) {
      return { winner: 'teamA', type: 'game', score: score };
    }
    if (score.teamB >= roundLimit) {
      return { winner: 'teamB', type: 'game', score: score };
    }

    // Return round winner info
    return { winner: roundWinner, type: 'round', score: score };
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