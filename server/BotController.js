const VISION_RANGE = 20; // Bot's sight range
const ATTACK_RANGE = 25; // Bot's shooting range
const ATTACK_INTERVAL = 1000; // Time between shots (ms)
const MOVEMENT_SPEED = 3; // Units per second
const UPDATE_INTERVAL = 250; // Bot thinks 4 times a second

export default class BotController {
  constructor(username, game, attackCallback) {
    this.username = username;
    this.game = game;
    this.attackCallback = attackCallback; // The function to call to perform an attack

    this.state = 'PATROLLING';
    this.target = null;
    this.lastActionTime = 0;
    this.patrolTargetPosition = null;

    console.log(`BotController for ${username} initialized.`);
    this.update();
  }

  update() {
    const botPlayer = this.game.gameState.players[this.username];
    if (!botPlayer || !botPlayer.isAlive) {
      // Bot is dead, it will be respawned by the game logic.
      // We just need to wait for the next update cycle after respawn.
      setTimeout(() => this.update(), UPDATE_INTERVAL);
      return;
    }

    // Always look for targets
    this.findTarget();

    switch (this.state) {
      case 'PATROLLING':
        this.patrol();
        break;
      case 'ATTACKING':
        this.attack();
        break;
    }

    // Schedule the next update
    setTimeout(() => this.update(), UPDATE_INTERVAL);
  }

  findTarget() {
    const botPlayer = this.game.gameState.players[this.username];
    let closestTarget = null;
    let minDistance = VISION_RANGE;

    for (const player of Object.values(this.game.gameState.players)) {
      // Bots in deathmatch mode target everyone except themselves
      if (player.team === this.username || !player.isAlive) {
        continue;
      }

      const distance = this.getDistance(botPlayer.position, player.position);

      if (distance < minDistance) {
        minDistance = distance;
        closestTarget = player;
      }
    }

    if (closestTarget) {
      this.target = closestTarget;
      this.state = 'ATTACKING';
    } else {
      if (this.state === 'ATTACKING') {
        this.target = null;
        this.state = 'PATROLLING';
        this.patrolTargetPosition = null; // Get a new patrol point
      }
    }
  }

  patrol() {
    const botPlayer = this.game.gameState.players[this.username];

    if (!this.patrolTargetPosition || this.getDistance(botPlayer.position, this.patrolTargetPosition) < 2) {
      this.patrolTargetPosition = this.game.getSpawnPoint();
    }

    this.moveTowards(this.patrolTargetPosition);
  }

  attack() {
    const botPlayer = this.game.gameState.players[this.username];
    if (!this.target || !this.game.gameState.players[this.target.team] || !this.game.gameState.players[this.target.team].isAlive) {
      this.state = 'PATROLLING';
      this.target = null;
      return;
    }

    const distance = this.getDistance(botPlayer.position, this.target.position);
    if (distance > ATTACK_RANGE) {
      // Target is out of range, chase them
      this.moveTowards(this.target.position);
    }

    const now = Date.now();
    if (now - this.lastActionTime > ATTACK_INTERVAL) {
      this.lastActionTime = now;
      if (this.attackCallback) {
        // In deathmatch, the target's username is stored in their 'team' property
        this.attackCallback(this.username, this.target.team);
      }
    }
  }

  moveTowards(targetPosition) {
    const botPlayer = this.game.gameState.players[this.username];
    const updateIntervalSeconds = UPDATE_INTERVAL / 1000;

    const dirX = targetPosition.x - botPlayer.position.x;
    const dirZ = targetPosition.z - botPlayer.position.z;

    const length = Math.sqrt(dirX * dirX + dirZ * dirZ);
    if (length < 1) return;

    const normDirX = dirX / length;
    const normDirZ = dirZ / length;

    botPlayer.position.x += normDirX * MOVEMENT_SPEED * updateIntervalSeconds;
    botPlayer.position.z += normDirZ * MOVEMENT_SPEED * updateIntervalSeconds;

    // Update rotation to face the target
    const angle = Math.atan2(normDirX, normDirZ);
    botPlayer.rotation = { x: 0, y: angle, z: 0 };
  }

  getDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}