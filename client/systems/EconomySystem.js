// client/systems/EconomySystem.js
import { EconomyEvents } from '../network';

export default class EconomySystem {
  constructor(socket) {
    this.socket = socket;
    this.money = 0;
    this.onMoneyUpdateCallback = null;
    this.onPurchaseResponseCallback = null;

    this.setupNetworkListeners();
  }

  setupNetworkListeners() {
    // 監聽金錢更新
    this.socket.on(EconomyEvents.MONEY_UPDATED, (data) => {
      this.money = data.money;
      if (this.onMoneyUpdateCallback) {
        this.onMoneyUpdateCallback(this.money);
      }
    });

    // 監聽購買響應
    this.socket.on(EconomyEvents.PURCHASE_RESPONSE, (response) => {
      if (this.onPurchaseResponseCallback) {
        this.onPurchaseResponseCallback(response);
      }
    });
  }

  // 註冊金錢更新回調
  onMoneyUpdate(callback) {
    this.onMoneyUpdateCallback = callback;
  }

  // 註冊購買響應回調
  onPurchaseResponse(callback) {
    this.onPurchaseResponseCallback = callback;
  }

  // 發送購買請求
  requestPurchase(itemId) {
    return new Promise((resolve, reject) => {
      this.socket.emit(EconomyEvents.PURCHASE_REQUEST, { itemId }, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.message || '購買失敗'));
        }
      });
    });
  }

  // 獲取當前金錢
  getCurrentMoney() {
    return this.money;
  }

  // 更新UI顯示
  updateMoneyDisplay() {
    const moneyDisplay = document.querySelector('.money-display');
    if (moneyDisplay) {
      moneyDisplay.textContent = `$${this.money}`;
    }
  }

  // 檢查是否有足夠金錢購買
  canAfford(price) {
    return this.money >= price;
  }
}