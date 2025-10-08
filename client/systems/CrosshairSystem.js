// client/systems/CrosshairSystem.js
export default class CrosshairSystem {
  constructor(el = document.getElementById('crosshair')) {
    this.el = el;
  }
  setSpread() {
    // TODO: 依武器後座力調整準星擴散
  }
  show() {
    if (this.el) this.el.classList.add('visible');
  }
  hide() {
    if (this.el) this.el.classList.remove('visible');
  }
}