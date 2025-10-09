// 武器圖示系統
export const WeaponIcons = {
    // 手槍
    classic: `<svg viewBox="0 0 100 50" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 25h50M70 25h10l5-5v-5h-5l-5 5M30 20h30M30 30h30" 
              stroke="currentColor" fill="none" stroke-width="2"/>
        <path d="M65 22v6M25 20v10" stroke="currentColor" fill="none" stroke-width="2"/>
    </svg>`,

    ghost: `<svg viewBox="0 0 100 50" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 25h60M75 25h10l5-5v-5h-5l-5 5M25 20h40M25 30h40" 
              stroke="currentColor" fill="none" stroke-width="2"/>
        <path d="M70 20v10M20 22v6" stroke="currentColor" fill="none" stroke-width="2"/>
        <path d="M35 15v20" stroke="currentColor" fill="none" stroke-width="1"/>
    </svg>`,

    // 步槍
    vandal: `<svg viewBox="0 0 150 50" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 25h100M120 25h10l5-5v-5h-5l-5 5M30 20h80M30 30h80" 
              stroke="currentColor" fill="none" stroke-width="2"/>
        <path d="M100 15v20M40 15v20M70 18v14" 
              stroke="currentColor" fill="none" stroke-width="2"/>
        <path d="M115 22v6" stroke="currentColor" fill="none" stroke-width="2"/>
    </svg>`,

    phantom: `<svg viewBox="0 0 150 50" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 25h100M120 25h15M30 20h80M30 30h80" 
              stroke="currentColor" fill="none" stroke-width="2"/>
        <path d="M100 15v20M40 15v20M70 18v14" 
              stroke="currentColor" fill="none" stroke-width="2"/>
        <path d="M120 20v10" stroke="currentColor" fill="none" stroke-width="2"/>
        <circle cx="125" cy="25" r="5" stroke="currentColor" fill="none" stroke-width="2"/>
    </svg>`,

    // 狙擊槍
    operator: `<svg viewBox="0 0 150 50" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 25h110M130 25h10M30 20h90M30 30h90" 
              stroke="currentColor" fill="none" stroke-width="2"/>
        <path d="M110 15v20M40 15v20" stroke="currentColor" fill="none" stroke-width="2"/>
        <path d="M70 10v30" stroke="currentColor" fill="none" stroke-width="2"/>
        <circle cx="85" cy="25" r="8" stroke="currentColor" fill="none" stroke-width="1"/>
        <circle cx="85" cy="25" r="3" stroke="currentColor" fill="none" stroke-width="1"/>
    </svg>`,

    // 衝鋒槍
    spectre: `<svg viewBox="0 0 120 50" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 25h70M90 25h10M30 20h50M30 30h50" 
              stroke="currentColor" fill="none" stroke-width="2"/>
        <path d="M70 15v20M40 15v20" stroke="currentColor" fill="none" stroke-width="2"/>
        <path d="M85 20v10M95 22v6" stroke="currentColor" fill="none" stroke-width="1.5"/>
    </svg>`
};

// 創建武器圖示元素
export function createWeaponIcon(weaponId, className = '') {
    const iconSvg = WeaponIcons[weaponId];
    if (!iconSvg) return null;

    const div = document.createElement('div');
    div.className = `weapon-icon ${className}`;
    div.innerHTML = iconSvg;
    return div;
}

// 將 SVG 圖示轉換為 Data URL
export function getWeaponIconUrl(weaponId) {
    const svg = WeaponIcons[weaponId];
    if (!svg) return null;
    
    const encodedSvg = encodeURIComponent(svg);
    return `data:image/svg+xml;charset=utf-8,${encodedSvg}`;
}

// 將 SVG 圖示注入到元素中
export function injectWeaponIcon(element, weaponId) {
    if (!element || !WeaponIcons[weaponId]) return;
    element.innerHTML = WeaponIcons[weaponId];
}