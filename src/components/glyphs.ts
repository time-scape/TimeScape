import SharedTexture from "../utils/SharedTexture";
import * as PIXI from "pixi.js";

function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number) {

    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

export class FigureTypeGlyph {

    private static size = 200;
    static init() {
        FigureTypeGlyph.generateTexture("background", FigureTypeGlyph.getBackground());
        for (const key in FigureTypeGlyph.type_dict) {
            const canvas = FigureTypeGlyph.getTypeGlyph(key as keyof typeof FigureTypeGlyph.type_dict);
            FigureTypeGlyph.generateTexture(key as keyof typeof FigureTypeGlyph.type_dict, canvas);
        }
    }

    /** 人物類型圖標 */
    static type_dict = {
        "皇帝": "皇",
        "文官": "文",
        "武將": "武",
        "宗室": "宗",
        "后妃": "妃",
        "宦官": "宦",
        "僧道": "僧",
        "學者": "學",
        "布衣": "布",
        "其他": "?",
    } as const;
    static key_dict = {
        "皇帝": "emperor",
        "文官": "official",
        "武將": "general",
        "宗室": "royal",
        "后妃": "consort",
        "宦官": "eunuch",
        "僧道": "monk",
        "學者": "scholar",
        "布衣": "commoner",
        "其他": "other",
    } as const;

    static getBackground() {
        const canvas = document.createElement("canvas");
        const size = FigureTypeGlyph.size;
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext("2d")!;

        // 背景填充
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 摳出圓角
        ctx.globalCompositeOperation = 'destination-in';
        roundRect(ctx, 10, 10, canvas.width - 20, canvas.height - 20, 30);
        ctx.fill();

        return canvas;
    }

    static getTypeGlyph(type: keyof typeof FigureTypeGlyph.type_dict) {
        const canvas = document.createElement("canvas");
        const size = FigureTypeGlyph.size;
        const fontSize = size * 0.7;
        const char = FigureTypeGlyph.type_dict[type];
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext("2d")!;

        // 背景填充
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 摳出圓角
        ctx.globalCompositeOperation = 'destination-in';
        roundRect(ctx, 10, 10, canvas.width - 20, canvas.height - 20, 30);
        ctx.fill();

        // 摳出文字
        ctx.globalCompositeOperation = 'destination-out';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${fontSize}px Source-heavy`;
        ctx.fillText(char, canvas.width / 2, canvas.height / 2);

        return canvas;
    }

    static generateTexture(key: string, canvas: HTMLCanvasElement) {
        SharedTexture.generateFromCanvas(`type-glyph-${key}`, canvas);
    }
    
    static draw(
        container: PIXI.Container,
        key: keyof typeof FigureTypeGlyph.type_dict,
        size: number,
        color: string,
        forceFlush: boolean = false,
    ) {
        let label = "type-glyph";
        let background = container.getChildByLabel("type-glyph-background") as PIXI.Container | null;
        if (background === null || forceFlush) {
            background = SharedTexture.instance(`type-glyph-background`);
            background.label = "type-glyph-background";
            container.addChild(background);
        }
        let glyph = container.getChildByLabel(label) as PIXI.Container | null;
        if (glyph === null || forceFlush) {
            glyph = SharedTexture.instance(`type-glyph-${key}`);
            glyph.label = label;
            container.addChild(glyph);
        }
        background.x = size * 0.5;
        background.y = size * 0.5;
        background.scale = size / FigureTypeGlyph.size;
        background.tint = 0xffffff;

        glyph.x = size * 0.5;
        glyph.y = size * 0.5;
        glyph.scale = size / FigureTypeGlyph.size;
        glyph.tint = Number.parseInt(color.slice(1), 16);
    }

    static drawOnCanvas(
        canvas: HTMLCanvasElement,
        key: keyof typeof FigureTypeGlyph.type_dict,
        size: number,
        color: string,
    ) {
        const ctx = canvas.getContext("2d")!;
        const glyph = FigureTypeGlyph.getTypeGlyph(key);
        ctx.drawImage(glyph, 0, 0, size, size);
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, size, size);
    }
}

export class EventTypeGlyph {
    private static size = 200;
    static typeFunctions = {
        "教育": EventTypeGlyph.getEducationGlyph,
        "入仕": EventTypeGlyph.getEntryGlyph,
        "升職": EventTypeGlyph.getPromotionGlyph,
        "降職": EventTypeGlyph.getDemotionGlyph,
        "平調": EventTypeGlyph.getTransferGlyph,
        "特殊官職": EventTypeGlyph.getSpecialPostGlyph,
        "最高官職": EventTypeGlyph.getHighestPostGlyph,
        "罷官": EventTypeGlyph.getDismissalGlyph,
        "成就": EventTypeGlyph.getAchievementGlyph,
        "其他": EventTypeGlyph.getOtherGlyph,
        "相關人物": EventTypeGlyph.getRelatedFigureGlyph,
    } as const;
    static needBackground: (keyof typeof EventTypeGlyph.typeFunctions)[] = ["升職", "降職", "平調", "特殊官職", "最高官職"];

    static init() {
        EventTypeGlyph.generateTexture("hexagon-background", EventTypeGlyph.getHexagonBackground());
        for (const key in EventTypeGlyph.typeFunctions) {
            EventTypeGlyph.generateTexture(key as any, EventTypeGlyph.typeFunctions[key as keyof typeof EventTypeGlyph.typeFunctions]());
        }
    }

    static generateTexture(key: string, canvas: HTMLCanvasElement) {
        SharedTexture.generateFromCanvas(`event-glyph-${key}`, canvas);
    }

    static draw(
        container: PIXI.Container,
        key: keyof typeof EventTypeGlyph.typeFunctions,
        size: number,
        color: string,
        forceFlush: boolean = false,
    ) {
        const label = "event-glyph";
        const needBackground = EventTypeGlyph.needBackground.includes(key);
        let background = container.getChildByLabel("event-glyph-background") as PIXI.Container | null;
        if (background === null || forceFlush) {
            if (needBackground) {
                background = SharedTexture.instance(`event-glyph-hexagon-background`);
                background.label = "event-glyph-background";
                container.addChild(background);
            }
        }
        if (needBackground) {
            background!.x = size * 0.5;
            background!.y = size * 0.5;
            background!.scale = size / EventTypeGlyph.size;
        }

        let glyph = container.getChildByLabel(label) as PIXI.Container | null;
        if (glyph === null || forceFlush) {
            glyph = SharedTexture.instance(`event-glyph-${key}`);
            glyph.label = label;
            container.addChild(glyph);
        }
        glyph.x = size * 0.5;
        glyph.y = size * 0.5;
        glyph.scale = size / EventTypeGlyph.size;
        glyph.tint = Number.parseInt(color.slice(1), 16);
    }

    static drawOnCanvas(
        canvas: HTMLCanvasElement,
        key: keyof typeof EventTypeGlyph.typeFunctions,
        size: number,
        color: string,
    ) {
        const ctx = canvas.getContext("2d")!;
        const glyph = EventTypeGlyph.typeFunctions[key]();
        ctx.drawImage(glyph, 0, 0, size, size);
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, size, size);
    }

    static getHexagonBackground() {
        const canvas = document.createElement("canvas");
        const size = EventTypeGlyph.size;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;

        // 背景填充
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.moveTo(size * 0.5, 0);
        ctx.lineTo(size, size * 0.25);
        ctx.lineTo(size, size * 0.75);
        ctx.lineTo(size * 0.5, size);
        ctx.lineTo(0, size * 0.75);
        ctx.lineTo(0, size * 0.25);
        ctx.closePath();
        ctx.fill();

        return canvas;
    }

    // 教育
    static getEducationGlyph() {
        const canvas = document.createElement("canvas");
        const size = EventTypeGlyph.size;
        const fontSize = size * 0.8;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;

        // 背景填充
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 摳出邊框（圓形）
        ctx.globalCompositeOperation = 'destination-in';
        ctx.arc(canvas.width / 2, canvas.height / 2, fontSize * 0.5, 0, Math.PI * 2);
        ctx.fill();
        
        return canvas;
    }

    // 入仕
    static getEntryGlyph() {
        const canvas = document.createElement("canvas");
        const size = EventTypeGlyph.size;
        const width = size * 0.5;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        const dw = width * 0.3;

        // 背景填充
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 摳出邊框（矩形+右小箭头）
        ctx.globalCompositeOperation = 'destination-in';
        ctx.beginPath();
        ctx.moveTo((size - width) / 2, 0);
        ctx.lineTo((size - width) / 2, size);
        ctx.lineTo((size + width) / 2 - dw, size);
        ctx.lineTo((size + width) / 2 + dw, size / 2);
        ctx.lineTo((size + width) / 2 - dw, 0);
        ctx.closePath();
        // ctx.fillRect((size - width) / 2, 0, width, size);
        ctx.fill();

        return canvas;
    }

    // 升職
    static getPromotionGlyph() {
        const canvas = document.createElement("canvas");
        const size = EventTypeGlyph.size;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;

        // 背景填充
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 摳出邊框（六邊形）
        ctx.globalCompositeOperation = 'destination-in';
        ctx.beginPath();
        ctx.moveTo(size * 0.5, 0);
        ctx.lineTo(size, size * 0.25);
        ctx.lineTo(size, size * 0.75);
        ctx.lineTo(size * 0.5, size);
        ctx.lineTo(0, size * 0.75);
        ctx.lineTo(0, size * 0.25);
        ctx.closePath();
        ctx.fill();

        // 摳出一個向上的箭頭
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = size * 0.1;
        ctx.beginPath();
        ctx.moveTo(size * 0.5, size * 0.8);
        ctx.lineTo(size * 0.5, size * 0.2);
        ctx.moveTo(size * 0.15, size * 0.5);
        ctx.lineTo(size * 0.5, size * 0.2);
        ctx.lineTo(size * 0.85, size * 0.5);
        ctx.stroke();

        return canvas;
    }

    // 降職
    static getDemotionGlyph() {
        const canvas = document.createElement("canvas");
        const size = EventTypeGlyph.size;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;

        // 背景填充
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 摳出邊框（六邊形）
        ctx.globalCompositeOperation = 'destination-in';
        ctx.beginPath();
        ctx.moveTo(size * 0.5, 0);
        ctx.lineTo(size, size * 0.25);
        ctx.lineTo(size, size * 0.75);
        ctx.lineTo(size * 0.5, size);
        ctx.lineTo(0, size * 0.75);
        ctx.lineTo(0, size * 0.25);
        ctx.closePath();
        ctx.fill();

        // 摳出一個向下的箭頭
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = size * 0.1;
        ctx.beginPath();
        ctx.moveTo(size * 0.5, size * 0.2);
        ctx.lineTo(size * 0.5, size * 0.8);
        ctx.moveTo(size * 0.15, size * 0.5);
        ctx.lineTo(size * 0.5, size * 0.8);
        ctx.lineTo(size * 0.85, size * 0.5);
        ctx.stroke();

        return canvas;
    }

    // 平調
    static getTransferGlyph() {
        const canvas = document.createElement("canvas");
        const size = EventTypeGlyph.size;
        const r = size * 0.15;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;

        // 背景填充
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 摳出邊框（六邊形）
        ctx.globalCompositeOperation = 'destination-in';
        ctx.beginPath();
        ctx.moveTo(size * 0.5, 0);
        ctx.lineTo(size, size * 0.25);
        ctx.lineTo(size, size * 0.75);
        ctx.lineTo(size * 0.5, size);
        ctx.lineTo(0, size * 0.75);
        ctx.lineTo(0, size * 0.25);
        ctx.closePath();
        ctx.fill();

        // 摳出一個圓形
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(size * 0.5, size * 0.5, r, 0, Math.PI * 2);
        ctx.fill();

        return canvas;
    }

    // 特殊官職
    static getSpecialPostGlyph() {
        const canvas = document.createElement("canvas");
        const size = EventTypeGlyph.size;
        const fontSize = size * 0.8;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;

        // 背景填充
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 摳出邊框（六邊形）
        ctx.globalCompositeOperation = 'destination-in';
        ctx.beginPath();
        ctx.moveTo(size * 0.5, 0);
        ctx.lineTo(size, size * 0.25);
        ctx.lineTo(size, size * 0.75);
        ctx.lineTo(size * 0.5, size);
        ctx.lineTo(0, size * 0.75);
        ctx.lineTo(0, size * 0.25);
        ctx.closePath();
        ctx.fill();

        // 摳出一個感歎號
        ctx.globalCompositeOperation = 'destination-out';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${fontSize}px Source`;
        ctx.fillText("!", size * 0.5, size * 0.5);

        return canvas;
    }

    // 最高官職
    static getHighestPostGlyph() {
        const canvas = document.createElement("canvas");
        const size = EventTypeGlyph.size;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;

        // 背景填充
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 摳出邊框（六邊形+兩道槓）
        const mask = document.createElement('canvas');
        mask.width = size;
        mask.height = size;
        const mctx = mask.getContext('2d')!;
        mctx.clearRect(0, 0, size, size);
        const h = size * 0.1;
        const gap = size * 0.07;
        const dh = (h + gap) * 2;
        
        mctx.fillStyle = "#fff";
        mctx.beginPath();
        mctx.moveTo(size * 0.5, dh);
        mctx.lineTo(size, dh + (size - dh) * 0.25);
        mctx.lineTo(size, dh + (size - dh) * 0.75);
        mctx.lineTo(size * 0.5, size);
        mctx.lineTo(0, dh + (size - dh) * 0.75);
        mctx.lineTo(0, dh + (size - dh) * 0.25);
        mctx.closePath();
        mctx.fill();

        for (let i = 0; i < 2; ++i) {
            let h0 = (h + gap) * i;
            let delta = h0 + (size - dh) * 0.25;
            mctx.beginPath();
            mctx.moveTo(size * 0.5, h0);
            mctx.lineTo(size, delta);
            mctx.lineTo(size, delta + h);
            mctx.lineTo(size * 0.5, h0 + h);
            mctx.lineTo(0, delta + h);
            mctx.lineTo(0, delta);
            mctx.closePath();
            mctx.fill();
        }

        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(mask, 0, 0);

        return canvas;
    }

    // 罷官
    static getDismissalGlyph() {
        const canvas = document.createElement("canvas");
        const size = EventTypeGlyph.size;
        const width = size * 0.5;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        const dw = width * 0.3;

        // 背景填充
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 摳出邊框（矩形+左小箭头）
        ctx.globalCompositeOperation = 'destination-in';
        ctx.beginPath();
        ctx.moveTo((size + width) / 2, 0);
        ctx.lineTo((size + width) / 2, size);
        ctx.lineTo((size - width) / 2 + dw, size);
        ctx.lineTo((size - width) / 2 - dw, size / 2);
        ctx.lineTo((size - width) / 2 + dw, 0);
        ctx.closePath();
        // ctx.fillRect((size - width) / 2, 0, width, size);
        ctx.fill();

        return canvas;
    }

    // 成就
    static getAchievementGlyph() {
        const canvas = document.createElement("canvas");
        const size = EventTypeGlyph.size;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;

        // 背景填充
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 摳出邊框（五角星（尖端朝上）
        ctx.globalCompositeOperation = 'destination-in';
        ctx.beginPath();
        const spikes = 5;
        const outerRadius = size * 0.4;
        const innerRadius = size * 0.2;
        for (let i = 0; i < spikes; i++) {
            const angle = (i / spikes) * Math.PI * 2 - Math.PI / 2;
            const x = Math.cos(angle) * outerRadius + size / 2;
            const y = Math.sin(angle) * outerRadius + size / 2;
            ctx.lineTo(x, y);
            const innerAngle = ((i + 0.5) / spikes) * Math.PI * 2 - Math.PI / 2;
            const innerX = Math.cos(innerAngle) * innerRadius + size / 2;
            const innerY = Math.sin(innerAngle) * innerRadius + size / 2;
            ctx.lineTo(innerX, innerY);
        }
        ctx.closePath();
        ctx.fill();

        return canvas;
    }

    // 其他
    static getOtherGlyph() {
        const canvas = document.createElement("canvas");
        const size = EventTypeGlyph.size;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;

        // 背景填充
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 摳出邊框（圓形）
        ctx.globalCompositeOperation = 'destination-in';
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size * 0.4, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();

        return canvas;
    }

    // 相關人物
    static getRelatedFigureGlyph() {
        const canvas = document.createElement("canvas");
        const size = EventTypeGlyph.size;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;

        // 背景填充
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 摳出邊框（圓形）
        ctx.globalCompositeOperation = 'destination-in';
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size * 0.4, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();

        return canvas;
    }
}