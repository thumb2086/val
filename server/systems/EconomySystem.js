// server/systems/EconomySystem.js
const EconomyEvents = {
  MONEY_UPDATED: 'money_updated',
  PURCHASE_REQUEST: 'purchase_request',
  PURCHASE_RESPONSE: 'purchase_response'
};

class EconomySystem {
  constructor(io, game) {
    this.io = io;
    this.game = game;
    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      // 處理購買請求
      socket.on(EconomyEvents.PURCHASE_REQUEST, (data, callback) => {
        this.handlePurchaseRequest(socket, data, callback);
      });
    });
  }

  // 處理購買請求
  handlePurchaseRequest(socket, data, callback) {
    const { itemId } = data;
    const username = socket.username;
    
    if (!username || !this.game.gameState.players[username]) {
      callback({ success: false, message: '無效的用戶' });
      return;
    }

    const player = this.game.gameState.players[username];
    const item = this.getItemDetails(itemId);

    if (!item) {
      callback({ success: false, message: '無效的物品' });
      return;
    }

    if (player.money < item.price) {
      callback({ success: false, message: '資金不足' });
      return;
    }

    // 扣除金錢並更新玩家狀態
    player.money -= item.price;
    this.updatePlayerInventory(player, item);

    // 發送更新通知
    socket.emit(EconomyEvents.MONEY_UPDATED, { money: player.money });
    callback({ 
      success: true, 
      money: player.money,
      item: item
    });
  }

  // 獲取物品詳情
  getItemDetails(itemId) {
    // 這裡可以從配置文件中讀取物品詳情
    const weapons = {
      ak47: { id: 'ak47', price: 2700, type: 'rifle' },
      m4a1: { id: 'm4a1', price: 3100, type: 'rifle' },
      awp: { id: 'awp', price: 4750, type: 'sniper' },
      // ... 其他武器
    };

    const armor = {
      vest: { id: 'vest', price: 650, type: 'armor' },
      fullArmor: { id: 'fullArmor', price: 1000, type: 'armor' },
      // ... 其他裝備
    };

    return weapons[itemId] || armor[itemId];
  }

  // 更新玩家庫存
  updatePlayerInventory(player, item) {
    // 根據物品類型更新玩家狀態
    switch(item.type) {
      case 'rifle':
      case 'sniper':
      case 'smg':
      case 'pistol':
        player.weapon = item.id;
        break;
      case 'armor':
        player.armor = item.id;
        break;
      // ... 其他類型的處理
    }
  }

  // 廣播金錢更新給所有玩家
  broadcastMoneyUpdate() {
    Object.entries(this.game.gameState.players).forEach(([username, player]) => {
      const socket = Array.from(this.io.sockets.sockets.values())
        .find(s => s.username === username);
      
      if (socket) {
        socket.emit(EconomyEvents.MONEY_UPDATED, { money: player.money });
      }
    });
  }
}

module.exports = EconomySystem;