import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import cors from 'cors'; // Add cors for client-server communication
import path from 'path'; // Import path module
import fs from 'fs';
import { fileURLToPath } from 'url'; // Import fileURLToPath for __dirname equivalent
import User from './models/User.js'; // Import User model
import { AuthSystem } from './systems/AuthSystem.js';
import Game from './game.js';
import WeaponSystem from './systems/WeaponSystem.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

const app = express();
app.use(express.json());
// 簡單請求日誌，協助定位前端是否載入 bundle 與登入請求是否送達
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});
app.use(cors({ origin: '*' }));
app.use(express.static(path.join(__dirname, '..', 'public'))); // Serve ONLY from the public directory

// 快速處理 favicon，避免 404 噪音（如需圖標，將 favicon.ico 放到 public/ 即可）
app.get('/favicon.ico', (req, res) => res.status(204).end());

// ---- ViewModel overrides persistence helpers ----
const overridesFile = path.join(__dirname, '..', 'configs', 'viewmodel-overrides.json');
function readOverrides() {
  try {
    if (!fs.existsSync(overridesFile)) return {};
    const raw = fs.readFileSync(overridesFile, 'utf-8');
    const json = JSON.parse(raw || '{}');
    return json && typeof json === 'object' ? json : {};
  } catch (e) {
    console.error('[VM OVERRIDE] read error:', e.message);
    return {};
  }
}
function writeOverrides(data) {
  try {
    fs.mkdirSync(path.dirname(overridesFile), { recursive: true });
    fs.writeFileSync(overridesFile, JSON.stringify(data || {}, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('[VM OVERRIDE] write error:', e.message);
    return false;
  }
}

// --- 註冊 API ---
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await AuthSystem.registerUser({ username, password });
        return res.status(result.status).json({ message: result.message });
    } catch (error) {
        return res.status(500).json({ message: '伺服器錯誤' });
    }
});

// JSON 錯誤處理（避免 body 解析失敗無回應）
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    console.error('JSON parse error:', err.message);
    return res.status(400).json({ message: '請求格式錯誤' });
  }
  next(err);
});

// --- 登入 API ---
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await AuthSystem.loginUser({ username, password, jwtSecret: process.env.JWT_SECRET });
        if (!result.ok) return res.status(result.status).json({ message: result.message });
        return res.json({ message: result.message, token: result.token });
    } catch (error) {
        return res.status(500).json({ message: '伺服器錯誤' });
    }
});

// ---- ViewModel overrides APIs ----
app.get('/api/viewmodel-overrides', (req, res) => {
  try {
    const data = readOverrides();
    return res.json(data);
  } catch (e) {
    console.error('[VM OVERRIDE] GET error:', e.message);
    return res.status(500).json({ message: '讀取失敗' });
  }
});

app.post('/api/viewmodel-overrides/set', (req, res) => {
  try {
    const { weaponId, skinIndex, partial } = req.body || {};
    const si = Number(skinIndex);
    if (!weaponId || !Number.isInteger(si)) {
      return res.status(400).json({ message: '缺少 weaponId 或 skinIndex' });
    }

    const allow = ['scale', 'position', 'rotation', 'muzzleOffset', 'muzzleSpace', 'muzzleScreen', 'muzzleScreenPx', 'muzzleDepth'];
    const upd = {};
    if (partial && typeof partial === 'object') {
      allow.forEach(k => { if (k in partial) upd[k] = partial[k]; });
    }

    const all = readOverrides();
    const byWeapon = all[weaponId] || {};
    const bySkin = byWeapon[si] || {};
    const nextSkin = { ...bySkin, ...upd };
    byWeapon[si] = nextSkin;
    all[weaponId] = byWeapon;

    if (!writeOverrides(all)) return res.status(500).json({ message: '寫入失敗' });
    return res.json({ ok: true, overrides: all });
  } catch (e) {
    console.error('[VM OVERRIDE] SET error:', e.message);
    return res.status(500).json({ message: '寫入失敗' });
  }
});

app.post('/api/viewmodel-overrides/clear', (req, res) => {
  try {
    const { weaponId, skinIndex, keys } = req.body || {};
    const si = Number(skinIndex);
    if (!weaponId || !Number.isInteger(si)) {
      return res.status(400).json({ message: '缺少 weaponId 或 skinIndex' });
    }
    const all = readOverrides();
    const byWeapon = all[weaponId] || {};
    const current = byWeapon[si] || {};

    if (Array.isArray(keys) && keys.length) {
      const next = { ...current };
      keys.forEach(k => { delete next[k]; });
      if (Object.keys(next).length === 0) delete byWeapon[si];
      else byWeapon[si] = next;
    } else {
      delete byWeapon[si];
    }

    if (Object.keys(byWeapon).length === 0) delete all[weaponId];
    else all[weaponId] = byWeapon;

    if (!writeOverrides(all)) return res.status(500).json({ message: '寫入失敗' });
    return res.json({ ok: true, overrides: all });
  } catch (e) {
    console.error('[VM OVERRIDE] CLEAR error:', e.message);
    return res.status(500).json({ message: '清除失敗' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const rooms = {}; // { [roomId]: Game }
const roomHosts = {}; // { [roomId]: hostUsername }
const weaponSystem = new WeaponSystem();

io.use((socket, next) => AuthSystem.verifySocketJWT(socket, next, process.env.JWT_SECRET));

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.username}`);
  // 將目前使用者名稱告知前端
  socket.emit('me', { username: socket.username });

  socket.on('createRoom', (data) => { // data = { mode: 'deathmatch', killLimit: 40 }
    const { mode = '5v5', killLimit = 0 } = data; // Default values
    const roomId = Math.random().toString(36).substring(7);
    const game = new Game(roomId, mode, killLimit); // Pass mode and killLimit
    game.addPlayer(socket.username);
    rooms[roomId] = game; // Store game instance only
    roomHosts[roomId] = socket.username; // Track host separately
    socket.join(roomId);
    socket.emit('roomCreated', { roomId, host: socket.username });
    // 立即廣播玩家列表，讓房主 UI 立即顯示
    io.to(roomId).emit('updatePlayers', game.players);
  });

  socket.on('joinRoom', (roomId) => {
    const game = rooms[roomId];
    if (game && game.players.length < 10) { // Max 10 players
      game.addPlayer(socket.username);
      socket.join(roomId);
      socket.emit('roomJoined', { roomId, host: roomHosts[roomId] });
      io.to(roomId).emit('updatePlayers', game.players);
    } else {
      socket.emit('roomFull');
    }
  });

  socket.on('startGame', (roomId) => {
    const game = rooms[roomId];
    if (game) {
      // Check if the user starting the game is the host
      if (socket.username !== roomHosts[roomId]) {
        socket.emit('error', '只有房主才能開始遊戲。');
        return;
      }

      // Check if there are enough players (e.g., at least 2 for multiplayer)
      if (game.players.length < 2) {
        socket.emit('error', '需要至少兩名玩家才能開始遊戲。');
        return;
      }

      game.startNewRound(true);
      io.to(roomId).emit('roundStart', game.gameState);
    }
  });

  socket.on('startTraining', () => {
    const roomId = "training_" + Math.random().toString(36).substring(7);
    const game = new Game(roomId);
    game.addPlayer(socket.username);
    game.addPlayer('trainingBot');
    game.gameState.mode = 'training';
    rooms[roomId] = game;
    socket.join(roomId);
    game.startNewRound(true);
    io.to(roomId).emit('trainingStarted', { roomId, gameState: game.gameState });
  });

  socket.on('startRobotBattle', () => {
    console.log(`Server received startRobotBattle from ${socket.username}`);
    const roomId = "robot_" + Math.random().toString(36).substring(7);
    const game = new Game(roomId);
    game.addPlayer(socket.username);
    game.addPlayer('robot1');
    game.addPlayer('robot2');
    game.gameState.mode = 'robotBattle';
    rooms[roomId] = game;
    socket.join(roomId);
    game.startNewRound(true);
    io.to(roomId).emit('robotBattleStarted', { roomId, gameState: game.gameState });
  });

  socket.on('playerUpdate', (data) => { // { roomId, position, rotation }
    const { roomId, position, rotation } = data;
    const game = rooms[roomId];
    if (game) {
      const playerState = game.gameState.players[socket.username];
      if (playerState && playerState.isAlive) {
        playerState.position = position;
        playerState.rotation = rotation;

        // Broadcast to others
        socket.to(roomId).emit('playerMoved', {
          username: socket.username,
          position: position,
          rotation: rotation
        });

        // Send authoritative position back to the sender
        socket.emit('authoritativePosition', { position, rotation });
      }
    }
  });

  socket.on('playerHit', (data) => {
    const { roomId, targetUsername, damage, killerUsername } = data;
    const game = rooms[roomId];
    if (!game) return;

    const targetPlayer = game.gameState.players[targetUsername];
    if (!targetPlayer || !targetPlayer.isAlive) return;

    targetPlayer.health -= damage;
    io.to(roomId).emit('gameStateUpdate', game.gameState);

    if (targetPlayer.health <= 0) {
      targetPlayer.health = 0;
      io.to(roomId).emit('playerDied', { username: targetUsername, killer: killerUsername });

      const result = game.handleKill(killerUsername, targetUsername);
      if (result) {
        if (result.gameWinner) {
          io.to(roomId).emit('gameEnd', { winner: result.gameWinner, reason: result.reason, score: result.score });
          if (game.gameState.bomb && game.gameState.bomb.timer) clearTimeout(game.gameState.bomb.timer);
          delete rooms[roomId];
          delete roomHosts[roomId];
        } else if (result.roundWinner) {
          io.to(roomId).emit('roundEnd', { winner: result.roundWinner, reason: result.reason, score: result.score });
          setTimeout(() => {
            game.startNewRound(false);
            io.to(roomId).emit('roundStart', game.gameState);
          }, 5000);
        }
      }
    }
  });

  socket.on('plantBomb', (data) => {
    const { roomId, position } = data;
    const game = rooms[roomId];
    if (game && game.gameState.mode === '5v5' && game.gameState.bomb && !game.gameState.bomb.planted && game.gameState.teams[socket.username] === 'teamA') {
      game.gameState.bomb.planted = true;
      game.gameState.bomb.position = position;
      io.to(roomId).emit('bombPlanted', { position });

      game.gameState.bomb.timer = setTimeout(() => {
        const result = game.checkWinCondition('bomb_exploded');
        if (result) {
          if (result.gameWinner) {
            io.to(roomId).emit('gameEnd', { winner: result.gameWinner, reason: result.reason, score: result.score });
            delete rooms[roomId];
            delete roomHosts[roomId];
          } else if (result.roundWinner) {
            io.to(roomId).emit('roundEnd', { winner: result.roundWinner, reason: result.reason, score: result.score });
            setTimeout(() => {
              game.startNewRound(false);
              io.to(roomId).emit('roundStart', game.gameState);
            }, 5000);
          }
        }
      }, 45000); // 45s timer
    }
  });

  socket.on('defuseBomb', (data) => {
    const { roomId } = data;
    const game = rooms[roomId];
    if (!game) return;

    const result = game.defuseBomb(); // This now returns a win condition result
    if (result) {
      io.to(roomId).emit('bombDefused');
      if (result.gameWinner) {
        io.to(roomId).emit('gameEnd', { winner: result.gameWinner, reason: result.reason, score: result.score });
        delete rooms[roomId];
        delete roomHosts[roomId];
      } else if (result.roundWinner) {
        io.to(roomId).emit('roundEnd', { winner: result.roundWinner, reason: result.reason, score: result.score });
        setTimeout(() => {
          game.startNewRound(false);
          io.to(roomId).emit('roundStart', game.gameState);
        }, 5000);
      }
    }
  });

  socket.on('shoot', (data) => {
    const { roomId, point, weaponId } = data;
    const game = rooms[roomId];
    
    const result = weaponSystem.handleShoot({ socket, game, roomId, point, weaponId });
    if (result.ok && result.broadcast) {
      io.to(roomId).emit(result.broadcast.event, result.broadcast.payload);
    } else if (!result.ok) {
      socket.emit('shootRejected', { reason: result.reason || 'unknown' });
    }
  });

  function handlePlayerLeave(socket, roomId) {
    const game = rooms[roomId];
    if (!game) return;

    const playerIndex = game.players.indexOf(socket.username);
    if (playerIndex > -1) {
      const wasAlive = game.gameState.players[socket.username]?.isAlive;
      game.players.splice(playerIndex, 1);
      delete game.gameState.players[socket.username];
      socket.leave(roomId);

      if (game.players.length === 0) {
        if (game.gameState.bomb && game.gameState.bomb.timer) clearTimeout(game.gameState.bomb.timer);
        delete rooms[roomId];
        delete roomHosts[roomId];
        console.log(`Room ${roomId} closed.`);
      } else {
        io.to(roomId).emit('playerDisconnected', { username: socket.username, gameState: game.gameState });
        if (wasAlive && game.gameState.mode !== 'deathmatch') {
          const result = game.checkWinCondition();
          if (result) {
            if (result.gameWinner) {
              io.to(roomId).emit('gameEnd', { winner: result.gameWinner, reason: 'player_left', score: result.score });
              if (game.gameState.bomb && game.gameState.bomb.timer) clearTimeout(game.gameState.bomb.timer);
              delete rooms[roomId];
              delete roomHosts[roomId];
            } else if (result.roundWinner) {
              io.to(roomId).emit('roundEnd', { winner: result.roundWinner, reason: 'player_left', score: result.score });
              setTimeout(() => {
                game.startNewRound(false);
                io.to(roomId).emit('roundStart', game.gameState);
              }, 5000);
            }
          }
        }
      }
    }
  }

  socket.on('leaveRoom', (roomId) => {
    handlePlayerLeave(socket, roomId);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.username}`);
    for (const roomId in rooms) {
      if (rooms[roomId].players.includes(socket.username)) {
        handlePlayerLeave(socket, roomId);
      }
    }
  });
});

server.listen(process.env.PORT || 3000, () => console.log(`Server running on port ${process.env.PORT || 3000}`));
