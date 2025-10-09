// client/graphics/HUDGenerator.js
export class HUDGenerator {
    constructor(canvas) {
        this.canvas = canvas || document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
    }

    // 生成準心
    generateCrosshair(options = {}) {
        const {
            size = 10,
            thickness = 2,
            gap = 4,
            dotSize = 2,
            color = '#ffffff',
            outline = true,
            outlineColor = '#000000'
        } = options;

        this.canvas.width = size * 2 + gap * 2;
        this.canvas.height = size * 2 + gap * 2;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const center = size + gap;

        // 繪製外框（如果啟用）
        if (outline) {
            // 中央點
            if (dotSize > 0) {
                this.ctx.fillStyle = outlineColor;
                this.ctx.fillRect(
                    center - dotSize - 1,
                    center - dotSize - 1,
                    dotSize * 2 + 2,
                    dotSize * 2 + 2
                );
            }

            // 四條線的外框
            this.ctx.fillStyle = outlineColor;
            // 上
            this.ctx.fillRect(center - thickness - 1, 0, thickness + 2, size);
            // 下
            this.ctx.fillRect(center - thickness - 1, center + gap, thickness + 2, size);
            // 左
            this.ctx.fillRect(0, center - thickness - 1, size, thickness + 2);
            // 右
            this.ctx.fillRect(center + gap, center - thickness - 1, size, thickness + 2);
        }

        // 繪製準心主體
        this.ctx.fillStyle = color;

        // 中央點
        if (dotSize > 0) {
            this.ctx.fillRect(
                center - dotSize,
                center - dotSize,
                dotSize * 2,
                dotSize * 2
            );
        }

        // 四條線
        // 上
        this.ctx.fillRect(center - thickness / 2, 0, thickness, size);
        // 下
        this.ctx.fillRect(center - thickness / 2, center + gap, thickness, size);
        // 左
        this.ctx.fillRect(0, center - thickness / 2, size, thickness);
        // 右
        this.ctx.fillRect(center + gap, center - thickness / 2, size, thickness);

        return this.canvas.toDataURL();
    }

    // 生成血量條
    generateHealthBar(options = {}) {
        const {
            width = 200,
            height = 20,
            borderSize = 2,
            backgroundColor = '#333333',
            borderColor = '#000000',
            gradient = ['#ff0000', '#00ff00']
        } = options;

        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx.clearRect(0, 0, width, height);

        // 繪製外框
        this.ctx.fillStyle = borderColor;
        this.ctx.fillRect(0, 0, width, height);

        // 繪製背景
        this.ctx.fillStyle = backgroundColor;
        this.ctx.fillRect(
            borderSize,
            borderSize,
            width - borderSize * 2,
            height - borderSize * 2
        );

        // 創建漸層
        const grd = this.ctx.createLinearGradient(0, 0, width, 0);
        gradient.forEach((color, index) => {
            grd.addColorStop(index / (gradient.length - 1), color);
        });

        // 繪製血量條背景（用於遮罩）
        this.ctx.fillStyle = grd;
        this.ctx.fillRect(
            borderSize,
            borderSize,
            width - borderSize * 2,
            height - borderSize * 2
        );

        return this.canvas.toDataURL();
    }

    // 生成彈藥圖示
    generateAmmoIcon(options = {}) {
        const {
            width = 30,
            height = 10,
            color = '#ffcc00'
        } = options;

        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx.clearRect(0, 0, width, height);

        // 繪製子彈形狀
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(0, height/2);
        this.ctx.lineTo(width * 0.7, height/2);
        this.ctx.lineTo(width * 0.8, 0);
        this.ctx.lineTo(width, 0);
        this.ctx.lineTo(width, height);
        this.ctx.lineTo(width * 0.8, height);
        this.ctx.lineTo(width * 0.7, height/2);
        this.ctx.closePath();
        this.ctx.fill();

        return this.canvas.toDataURL();
    }

    // 生成擊殺確認標記
    generateKillMarker(options = {}) {
        const {
            size = 40,
            color = '#ff0000',
            thickness = 3
        } = options;

        this.canvas.width = size;
        this.canvas.height = size;
        this.ctx.clearRect(0, 0, size, size);

        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = thickness;

        // 繪製 X
        this.ctx.beginPath();
        this.ctx.moveTo(size * 0.2, size * 0.2);
        this.ctx.lineTo(size * 0.8, size * 0.8);
        this.ctx.moveTo(size * 0.8, size * 0.2);
        this.ctx.lineTo(size * 0.2, size * 0.8);
        this.ctx.stroke();

        return this.canvas.toDataURL();
    }

    // 生成雷達圖示
    generateRadarIcon(options = {}) {
        const {
            size = 8,
            color = '#ff0000'
        } = options;

        this.canvas.width = size;
        this.canvas.height = size;
        this.ctx.clearRect(0, 0, size, size);

        // 繪製三角形
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(size/2, 0);
        this.ctx.lineTo(size, size);
        this.ctx.lineTo(0, size);
        this.ctx.closePath();
        this.ctx.fill();

        return this.canvas.toDataURL();
    }

    // 生成計分板背景
    generateScoreboardBackground(options = {}) {
        const {
            width = 400,
            height = 300,
            backgroundColor = 'rgba(0, 0, 0, 0.8)',
            borderColor = '#444444',
            headerColor = '#666666'
        } = options;

        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx.clearRect(0, 0, width, height);

        // 繪製背景
        this.ctx.fillStyle = backgroundColor;
        this.ctx.fillRect(0, 0, width, height);

        // 繪製邊框
        this.ctx.strokeStyle = borderColor;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(0, 0, width, height);

        // 繪製標題欄
        this.ctx.fillStyle = headerColor;
        this.ctx.fillRect(0, 0, width, 40);

        return this.canvas.toDataURL();
    }

    // 生成武器選擇圖標背景
    generateWeaponSlotBackground(options = {}) {
        const {
            width = 60,
            height = 30,
            backgroundColor = 'rgba(0, 0, 0, 0.5)',
            borderColor = '#444444',
            selectedColor = '#00ff00'
        } = options;

        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx.clearRect(0, 0, width, height);

        // 繪製背景
        this.ctx.fillStyle = backgroundColor;
        this.ctx.fillRect(0, 0, width, height);

        // 繪製邊框
        this.ctx.strokeStyle = borderColor;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(0, 0, width, height);

        // 繪製選中標記
        this.ctx.strokeStyle = selectedColor;
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(2, 2, width-4, height-4);

        return this.canvas.toDataURL();
    }
}