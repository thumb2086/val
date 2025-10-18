// client/graphics/WeaponIconGenerator.js

export class WeaponIconGenerator {
    static createIconCanvas(width = 128, height = 128) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }

    static generateClassicIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        
        // 基本樣式設定
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        
        // 畫槍身
        ctx.beginPath();
        ctx.moveTo(30, 64);
        ctx.lineTo(90, 64);
        ctx.stroke();
        
        // 畫槍把
        ctx.beginPath();
        ctx.moveTo(75, 64);
        ctx.lineTo(75, 90);
        ctx.stroke();
        
        // 畫槍管
        ctx.beginPath();
        ctx.moveTo(90, 64);
        ctx.lineTo(98, 60);
        ctx.stroke();

        return canvas.toDataURL();
    }

    static generateVandalIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        
        // 畫槍身
        ctx.beginPath();
        ctx.moveTo(20, 64);
        ctx.lineTo(100, 64);
        ctx.stroke();
        
        // 畫彈匣
        ctx.beginPath();
        ctx.moveTo(50, 64);
        ctx.lineTo(50, 90);
        ctx.stroke();
        
        // 畫槍托
        ctx.beginPath();
        ctx.moveTo(20, 64);
        ctx.lineTo(30, 70);
        ctx.lineTo(30, 80);
        ctx.stroke();

        // 畫瞄準鏡底座
        ctx.beginPath();
        ctx.moveTo(60, 64);
        ctx.lineTo(60, 55);
        ctx.stroke();

        return canvas.toDataURL();
    }

    static generatePhantomIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        
        // 畫槍身
        ctx.beginPath();
        ctx.moveTo(20, 64);
        ctx.lineTo(90, 64);
        ctx.stroke();
        
        // 畫消音器
        ctx.beginPath();
        ctx.moveTo(90, 64);
        ctx.lineTo(100, 64);
        ctx.arc(100, 64, 4, 0, Math.PI * 2);
        ctx.stroke();
        
        // 畫彈匣
        ctx.beginPath();
        ctx.moveTo(50, 64);
        ctx.lineTo(50, 90);
        ctx.stroke();

        return canvas.toDataURL();
    }

    static generateGhostIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        
        // 畫槍身
        ctx.beginPath();
        ctx.moveTo(30, 64);
        ctx.lineTo(85, 64);
        ctx.stroke();
        
        // 畫消音器
        ctx.beginPath();
        ctx.moveTo(85, 64);
        ctx.lineTo(95, 64);
        ctx.arc(95, 64, 3, 0, Math.PI * 2);
        ctx.stroke();
        
        // 畫槍把
        ctx.beginPath();
        ctx.moveTo(70, 64);
        ctx.lineTo(70, 85);
        ctx.stroke();

        return canvas.toDataURL();
    }

    static generateSpectreIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        
        // 畫槍身
        ctx.beginPath();
        ctx.moveTo(25, 64);
        ctx.lineTo(95, 64);
        ctx.stroke();
        
        // 畫消音器
        ctx.beginPath();
        ctx.moveTo(95, 62);
        ctx.lineTo(100, 62);
        ctx.moveTo(95, 66);
        ctx.lineTo(100, 66);
        ctx.stroke();
        
        // 畫彈匣
        ctx.beginPath();
        ctx.moveTo(60, 64);
        ctx.lineTo(60, 85);
        ctx.stroke();

        return canvas.toDataURL();
    }
}