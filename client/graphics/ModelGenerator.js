// 3D 模型生成器
export class ModelGenerator {
    // 生成立方體網格
    static generateCube(width = 1, height = 1, depth = 1) {
        const w = width / 2;
        const h = height / 2;
        const d = depth / 2;

        // 頂點座標
        const vertices = new Float32Array([
            // 前面
            -w, -h,  d,
             w, -h,  d,
             w,  h,  d,
            -w,  h,  d,
            // 後面
            -w, -h, -d,
            -w,  h, -d,
             w,  h, -d,
             w, -h, -d,
            // 上面
            -w,  h, -d,
            -w,  h,  d,
             w,  h,  d,
             w,  h, -d,
            // 底面
            -w, -h, -d,
             w, -h, -d,
             w, -h,  d,
            -w, -h,  d,
            // 右側
             w, -h, -d,
             w,  h, -d,
             w,  h,  d,
             w, -h,  d,
            // 左側
            -w, -h, -d,
            -w, -h,  d,
            -w,  h,  d,
            -w,  h, -d,
        ]);

        // 法線
        const normals = new Float32Array([
            // 前面
            0, 0, 1,   0, 0, 1,   0, 0, 1,   0, 0, 1,
            // 後面
            0, 0, -1,  0, 0, -1,  0, 0, -1,  0, 0, -1,
            // 上面
            0, 1, 0,   0, 1, 0,   0, 1, 0,   0, 1, 0,
            // 底面
            0, -1, 0,  0, -1, 0,  0, -1, 0,  0, -1, 0,
            // 右側
            1, 0, 0,   1, 0, 0,   1, 0, 0,   1, 0, 0,
            // 左側
            -1, 0, 0,  -1, 0, 0,  -1, 0, 0,  -1, 0, 0,
        ]);

        // UV 座標
        const uvs = new Float32Array([
            // 前面
            0, 1,  1, 1,  1, 0,  0, 0,
            // 後面
            1, 1,  1, 0,  0, 0,  0, 1,
            // 上面
            0, 1,  0, 0,  1, 0,  1, 1,
            // 底面
            1, 1,  0, 1,  0, 0,  1, 0,
            // 右側
            1, 1,  0, 1,  0, 0,  1, 0,
            // 左側
            0, 1,  1, 1,  1, 0,  0, 0,
        ]);

        // 索引
        const indices = new Uint16Array([
            0,  1,  2,    0,  2,  3,  // 前面
            4,  5,  6,    4,  6,  7,  // 後面
            8,  9,  10,   8,  10, 11, // 上面
            12, 13, 14,   12, 14, 15, // 底面
            16, 17, 18,   16, 18, 19, // 右側
            20, 21, 22,   20, 22, 23  // 左側
        ]);

        return {
            vertices,
            normals,
            uvs,
            indices
        };
    }

    // 生成圓柱體網格
    static generateCylinder(radius = 1, height = 1, segments = 32) {
        const vertices = [];
        const normals = [];
        const uvs = [];
        const indices = [];
        const h = height / 2;

        // 生成側面頂點
        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            const x = Math.cos(theta) * radius;
            const z = Math.sin(theta) * radius;

            // 頂點
            vertices.push(x, -h, z);  // 底部
            vertices.push(x, h, z);   // 頂部

            // 法線
            const nx = Math.cos(theta);
            const nz = Math.sin(theta);
            normals.push(nx, 0, nz);
            normals.push(nx, 0, nz);

            // UV
            const u = i / segments;
            uvs.push(u, 1);
            uvs.push(u, 0);

            // 索引
            if (i < segments) {
                const base = i * 2;
                indices.push(base, base + 1, base + 2);
                indices.push(base + 1, base + 3, base + 2);
            }
        }

        return {
            vertices: new Float32Array(vertices),
            normals: new Float32Array(normals),
            uvs: new Float32Array(uvs),
            indices: new Uint16Array(indices)
        };
    }

    // 生成武器模型
    static generateWeaponModel(type) {
        switch (type) {
            case 'pistol':
                return this.generatePistol();
            case 'rifle':
                return this.generateRifle();
            case 'smg':
                return this.generateSMG();
            case 'sniper':
                return this.generateSniper();
            default:
                return this.generateCube();
        }
    }

    // 生成手槍模型
    static generatePistol() {
        // 槍身
        const body = this.generateCube(0.3, 0.15, 0.8);
        // 槍把
        const grip = this.generateCube(0.2, 0.4, 0.15);
        // 合併網格...
        return this.mergeGeometries([body, grip]);
    }

    // 生成步槍模型
    static generateRifle() {
        // 槍身
        const body = this.generateCube(0.2, 0.15, 1.2);
        // 槍托
        const stock = this.generateCube(0.15, 0.25, 0.4);
        // 彈匣
        const magazine = this.generateCube(0.1, 0.3, 0.15);
        // 合併網格...
        return this.mergeGeometries([body, stock, magazine]);
    }

    // 合併幾何體
    static mergeGeometries(geometries) {
        // 簡單的合併實現，實際使用時需要更複雜的處理
        const vertices = [];
        const normals = [];
        const uvs = [];
        const indices = [];
        let indexOffset = 0;

        geometries.forEach(geo => {
            vertices.push(...geo.vertices);
            normals.push(...geo.normals);
            uvs.push(...geo.uvs);
            
            const offsetIndices = geo.indices.map(i => i + indexOffset);
            indices.push(...offsetIndices);
            
            indexOffset += geo.vertices.length / 3;
        });

        return {
            vertices: new Float32Array(vertices),
            normals: new Float32Array(normals),
            uvs: new Float32Array(uvs),
            indices: new Uint16Array(indices)
        };
    }
}