// 紋理生成器類別
export class TextureGenerator {
    constructor(canvas) {
        this.canvas = canvas || document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
    }

    // 生成噪點紋理
    generateNoise(width, height, alpha = 0.2) {
        this.canvas.width = width;
        this.canvas.height = height;
        const imageData = this.ctx.createImageData(width, height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const value = Math.floor(Math.random() * 256);
            data[i] = value;     // R
            data[i + 1] = value; // G
            data[i + 2] = value; // B
            data[i + 3] = Math.floor(alpha * 255); // A
        }

        this.ctx.putImageData(imageData, 0, 0);
        return this.canvas.toDataURL();
    }

    // 生成漸層紋理
    generateGradient(width, height, startColor, endColor, isVertical = false) {
        this.canvas.width = width;
        this.canvas.height = height;
        
        const gradient = isVertical
            ? this.ctx.createLinearGradient(0, 0, 0, height)
            : this.ctx.createLinearGradient(0, 0, width, 0);

        gradient.addColorStop(0, startColor);
        gradient.addColorStop(1, endColor);

        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, width, height);
        
        return this.canvas.toDataURL();
    }

    // 生成網格紋理
    generateGrid(width, height, gridSize = 10, color = 'rgba(255,255,255,0.1)') {
        this.canvas.width = width;
        this.canvas.height = height;
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 1;

        // 繪製垂直線
        for (let x = gridSize; x < width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }

        // 繪製水平線
        for (let y = gridSize; y < height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
        }

        return this.canvas.toDataURL();
    }

    // 生成點陣紋理
    generateDots(width, height, spacing = 10, dotSize = 2, color = 'rgba(255,255,255,0.2)') {
        this.canvas.width = width;
        this.canvas.height = height;
        
        this.ctx.fillStyle = color;

        for (let x = spacing; x < width; x += spacing) {
            for (let y = spacing; y < height; y += spacing) {
                this.ctx.beginPath();
                this.ctx.arc(x, y, dotSize, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }

        return this.canvas.toDataURL();
    }

    // 生成迷彩圖案
    generateCamo(width, height, colors = ['#2d5a27', '#4a7c3c', '#1f3d1c']) {
        this.canvas.width = width;
        this.canvas.height = height;
        
        // 背景色
        this.ctx.fillStyle = colors[0];
        this.ctx.fillRect(0, 0, width, height);

        // 生成不規則斑點
        for (let i = 1; i < colors.length; i++) {
            this.ctx.fillStyle = colors[i];
            
            for (let j = 0; j < 15; j++) {
                const x = Math.random() * width;
                const y = Math.random() * height;
                const size = 20 + Math.random() * 40;

                this.ctx.beginPath();
                this.ctx.moveTo(x, y);
                
                // 創建不規則形狀
                for (let angle = 0; angle < Math.PI * 2; angle += 0.2) {
                    const radius = size * (0.5 + Math.random() * 0.5);
                    const pointX = x + Math.cos(angle) * radius;
                    const pointY = y + Math.sin(angle) * radius;
                    
                    if (angle === 0) {
                        this.ctx.moveTo(pointX, pointY);
                    } else {
                        this.ctx.lineTo(pointX, pointY);
                    }
                }
                
                this.ctx.closePath();
                this.ctx.fill();
            }
        }

        return this.canvas.toDataURL();
    }

    // 生成金屬紋理
    generateMetal(width, height, baseColor = '#808080') {
        this.canvas.width = width;
        this.canvas.height = height;

        // 基礎金屬色
        this.ctx.fillStyle = baseColor;
        this.ctx.fillRect(0, 0, width, height);

        // 添加刮痕效果
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const length = 5 + Math.random() * 15;
            const angle = Math.random() * Math.PI * 2;

            this.ctx.strokeStyle = `rgba(255,255,255,${Math.random() * 0.1})`;
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(x, y);
            this.ctx.lineTo(
                x + Math.cos(angle) * length,
                y + Math.sin(angle) * length
            );
            this.ctx.stroke();
        }

        return this.canvas.toDataURL();
    }

    // 生成皮革紋理
    generateLeather(width, height, color = '#8B4513') {
        this.canvas.width = width;
        this.canvas.height = height;

        // 基礎顏色
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, width, height);

        // 添加皺褶效果
        for (let i = 0; i < 1000; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const size = 1 + Math.random() * 3;

            this.ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.1})`;
            this.ctx.beginPath();
            this.ctx.arc(x, y, size, 0, Math.PI * 2);
            this.ctx.fill();
        }

        return this.canvas.toDataURL();
    }
}