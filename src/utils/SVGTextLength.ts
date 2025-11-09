/** 字体大小字典的文件路径 */
const binFile = "./font/unicode_width.bin";
/** 在全局对象上挂载UnicodeWidth对象（这样多个请求可以共用一个） */
const key = "UnicodeWidth";

interface UnicodeWidth {
    __dict: Float32Array | null;
    dict: Float32Array;
    load: () => Promise<void>;
    charWidth: (char: string, fontsize: number) => number;
    stringWidth: (str: string, fontsize: number) => number;
};

function createUnicodeWidth() {
    return {
        __dict: null,
        get dict(): Float32Array {
            if (this.__dict === null) {
                throw new Error("dict not loaded");
            }
            return this.__dict;
        },
        async load() {
            if (this.__dict !== null) {
                return;
            }
            const response = await fetch(binFile);
            const buffer = await response.arrayBuffer();
            this.__dict = new Float32Array(buffer);
            console.log("dict loaded", this.__dict);
        },
        charWidth(char: string, fontsize: number) {
            if (this.__dict === null) {
                throw new Error("dict not loaded");
            }
            const code = char.codePointAt(0)!;
            return (this.__dict[code] ?? 0) * fontsize / 10;
        },
        stringWidth(str: string, fontsize: number) {
            if (this.__dict === null) {
                throw new Error("dict not loaded");
            }
            let width = 0;
            for (let i = 0; i < str.length; i++) {
                const code = str.codePointAt(i)!;
                width += (this.__dict[code] ?? 0) * fontsize / 10;
            }
            return width;
        }
    } as UnicodeWidth;
}

const unicodeWidth = (() => {
    if ((globalThis as any)[key] === undefined) {
        (globalThis as any)[key] = createUnicodeWidth();
        (globalThis as any)[key].load();
    }
    return (globalThis as any)[key] as UnicodeWidth;
})();

/**
 * SVGTextLength.js：SVG文本长度计算类
 */
const config: {
    svg: SVGElement | null;
} = {
    svg: null,
}

export default class SVGTextLength {

    /** 字体大小，单位为px */
    fontSize!: number;
    /** 字体 */
    fontFamily!: string;
    /** 测量标尺 */
    private ruler!: SVGTextElement;

    constructor(fontSize: number = 12, fontFamily: string = 'sans-serif') {
        // if (UnicodeWidth.dict === null) {
        //     throw new Error('dict not loaded');
        // }
        this.fontSize = fontSize;
        this.fontFamily = fontFamily;
        this.ruler = this.getRuler();
    }

    /** 计算文本显示宽度 */
    visualWidth (text: string, fontSize?: number, fontFamily?: string): number {
        return unicodeWidth.stringWidth(text, fontSize || this.fontSize);
    }
    /** 计算文本显示高度 */
    visualHeight (text: string, fontSize?: number, fontFamily?: string): number {
        return this.fontSize;
    }
    /** 文本截断 */
    truncate (text: string, width: number, ellipsis?: string, fontSize?: number, fontFamily?: string): string {
        const textWidth = this.visualWidth(text, fontSize, fontFamily);
        if (textWidth <= width) {
            return text;
        }
        ellipsis = ellipsis || '...';
        const ellipsisWidth = this.visualWidth(ellipsis, fontSize, fontFamily);
        const len = this.truncate_index(text, width - ellipsisWidth, fontSize, fontFamily);
        if (len === 0) {
            return ellipsisWidth <= width ? ellipsis : '';
        }
        return text.slice(0, len) + ellipsis;
    }
    /** 文本换行 */
    wrap (text: string, width: number, maxLines: number, ellipsis?: string, fontSize?: number, fontFamily?: string): string[] {
        if (maxLines === 0) return [];
        ellipsis = ellipsis || '...';
        const ellipsisWidth = this.visualWidth(ellipsis, fontSize, fontFamily);

        let p = 0;
        const lines = [];
        while (p < text.length) {
            const textleft = text.slice(p);
            if (lines.length === maxLines - 1) {
                const subtext = this.truncate(textleft, width, ellipsis, fontSize, fontFamily);
                lines.push(subtext);
                break;
            }
            else {
                let len = this.truncate_index(textleft, width, fontSize, fontFamily);
                if (len === 0) {
                    if (ellipsisWidth <= width) {
                        lines.push(ellipsis);
                    }
                    break;
                }
                lines.push(textleft.slice(0, len));
                p += len;
            }
        }
        return lines;
    };
    /** 多行文本数组转SVG */
    lines2svg (lines: string[], lineHeight?: number) {
        let lh = lineHeight || this.fontSize * 1.2;
        return lines.map((line, i) => {
            return "<tspan x='0' dy='" + lh * Math.min(i, 1) + "'>" + line + "</tspan>";
        }).join('');
    }
    private getRuler() {
        const svg = config.svg || document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '0');
        svg.setAttribute('height', '0');
        svg.style.position = 'absolute';
        const ruler = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        svg.appendChild(ruler);
        if (config.svg === null) {
            document.body.insertBefore(svg, document.body.firstChild);
            config.svg = svg;
        }
        return ruler;
    }
    private setRuler(text: string, fontSize?: number, fontFamily?: string) {
        fontSize = fontSize || this.fontSize;
        fontFamily = fontFamily || this.fontFamily;
        this.ruler.style.fontSize = fontSize.toString();
        this.ruler.style.fontFamily = fontFamily;
        this.ruler.innerHTML = text;
    }
    private truncate_index(text: string, width: number, fontSize?: number, fontFamily?: string) { // 返回截断文本的长度
        if (width <= 0) return 0;
        this.setRuler(text, fontSize, fontFamily);
        let textWidth = this.ruler.getBoundingClientRect().width;

        // 边界条件判断
        if (textWidth <= width) {
            return text.length;
        }
        else if (this.ruler.getEndPositionOfChar(0).x > width) {
            return 0;
        }
        // 二分查找确定长度（此时保证了长度一定不小于1，且达不到最大长度）
        let start = 0;
        let end = text.length - 1;
        while (start < end) {
            const mid = Math.ceil((start + end) / 2);
            const newTextWidth = this.ruler.getEndPositionOfChar(mid).x;
            if (newTextWidth <= width) {
                start = mid;
            }
            else {
                end = mid - 1;
            }
        }
        return start + 1;
    }
}