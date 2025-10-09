import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import Game from './game.js';
import WeaponSystem from './systems/WeaponSystem.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});
app.use(cors({ origin: '*' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/favicon.ico', (req, res) => res.status(204).end());

app.post('/api/login', async (req, res) => {
  console.log('[AUTH BYPASS] /api/login called, returning dummy token.');
  const { username } = req.body;
  return res.json({ message: '登入成功 (Bypassed)', token: `dummy-token-for-${username}`, username: username || 'test-user' });
});

app.post('/api/register', async (req, res) => {
    res.json({ message: 'Registration is disabled.' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const rooms = {};
const roomHosts = {};
const weaponSystem = new WeaponSystem();

io.on('connection', (socket) => {
  socket.username = socket.handshake.query.username || `User_${Math.floor(Math.random() * 1000)}`;
  console.log(`User connected: ${socket.username}`);
  socket.emit('me', { username: socket.username });

  socket.on('createRoom', (data) => {
    const { mode = 'skirmish', roundLimit = 10 } = data;
    const roomId = Math.random().toString(36).substring(2, 9);
    const game = new Game(roomId, mode, 0, roundLimit);
    game.addPlayer(socket.username);
    rooms[roomId] = game;
    roomHosts[roomId] = socket.username;
    socket.join(roomId);
    socket.emit('roomCreated', { roomId, host: socket.username });
    io.to(roomId).emit('updatePlayers', game.players);
  });

  socket.on('joinRoom', (roomId) => {
    const game = rooms[roomId];
    if (game && game.players.length < 10) {
      game.addPlayer(socket.username);
      socket.join(roomId);
      socket.emit('roomJoined', { roomId, host: roomHosts[roomId] });
      io.to(roomId).emit('updatePlayers', game.players);
    } else {
      socket.emit('roomFull');
    }
  });

  socket.on('requestPlayerList', (roomId) => {
    const game = rooms[roomId];
    if (game) {
      io.to(roomId).emit('updatePlayers', game.players);
    }
  });

  socket.on('startGame', (roomId) => {
    const game = rooms[roomId];
    if (game && socket.username === roomHosts[roomId]) {
      if (game.players.length < 2) {
        return socket.emit('error', '需要至少兩名玩家才能開始遊戲。');
      }
      game.startNewRound(true);
      io.to(roomId).emit('roundStart', game.gameState);
    }
  });

  socket.on('playerUpdate', (data) => {
    const { roomId, position, rotation } = data;
    const game = rooms[roomId];
    if (game) {
      const playerState = game.gameState.players[socket.username];
      if (playerState && playerState.isAlive) {
        playerState.position = position;
        playerState.rotation = rotation;
        socket.to(roomId).emit('playerMoved', { username: socket.username, position, rotation });
      }
    }
  });

  socket.on('playerHit', (data) => {
    const { roomId, targetUsername, damage, killerUsername } = data;
    const game = rooms[roomId];
    if (!game) return;

    const targetPlayer = game.gameState.players[targetUsername];
    if (targetPlayer && targetPlayer.isAlive) {
      const result = game.takeDamage(targetUsername, damage);
      io.to(roomId).emit('gameStateUpdate', game.gameState);

      if (result.died) {
        io.to(roomId).emit('playerDied', { username: targetUsername, killer: killerUsername });
        const winResult = game.checkWinCondition();
        if (winResult) {
           if (winResult.type === 'game') {
              io.to(roomId).emit('gameEnd', { winner: winResult.winner, score: winResult.score });
              delete rooms[roomId];
              delete roomHosts[roomId];
            } else if (winResult.type === 'round') {
              io.to(roomId).emit('roundEnd', { winner: winResult.winner, score: winResult.score });
              setTimeout(() => {
                game.startNewRound(false);
                io.to(roomId).emit('roundStart', game.gameState);
              }, 5000);
            }
        }
      }
    }
  });

  socket.on('shoot', (data) => {
    const { roomId, point, weaponId } = data;
    const game = rooms[roomId];
    if (!game) return;
    const result = weaponSystem.handleShoot({ socket, game, point, weaponId });
    if (result.ok && result.broadcast) {
      io.to(roomId).emit(result.broadcast.event, result.broadcast.payload);
    } else if (!result.ok) {
      socket.emit('shootRejected', { reason: result.reason || 'unknown' });
    }
  });

  const handleDisconnect = () => {
    console.log(`User disconnected: ${socket.username}`);
    for (const roomId in rooms) {
      const game = rooms[roomId];
      if (!game) continue;

      const playerIndex = game.players.indexOf(socket.username);
      if (playerIndex > -1) {
        game.players.splice(playerIndex, 1);

        const wasAlive = game.gameState.players[socket.username]?.isAlive;
        delete game.gameState.players[socket.username];

        if (game.players.length === 0) {
          delete rooms[roomId];
          delete roomHosts[roomId];
        } else {
          io.to(roomId).emit('playerDisconnected', { username: socket.username, gameState: game.gameState });
          if (wasAlive && (game.gameState.mode === 'skirmish' || game.gameState.mode === '5v5')) {
            const winResult = game.checkWinCondition();
            if (winResult) {
               if (winResult.type === 'game') {
                  io.to(roomId).emit('gameEnd', { winner: winResult.winner, score: winResult.score });
                  delete rooms[roomId];
                  delete roomHosts[roomId];
                } else if (winResult.type === 'round') {
                  io.to(roomId).emit('roundEnd', { winner: winResult.winner, score: winResult.score });
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
  };

  socket.on('leaveRoom', handleDisconnect);
  socket.on('disconnect', handleDisconnect);
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Server running on port ${port}`));