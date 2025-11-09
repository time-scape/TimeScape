import { re } from "mathjs";

type SVGTextManagerAttributes = Pick<SVGTextManager, "multiline" | "fontSize" | "fontFamily" | "lineHeight" | "mode" | "text">;

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

export default class SVGTextManager {
    /** 是否多行文本 */
    multiline: boolean = false;
    /** 字体大小 */
    fontSize = 12;
    /** 字体 */
    fontFamily = "FZQINGKBYSJF";
    /** 行高（计算多行文本高度时会使用） */
    lineHeight = 15;
    /** 模式，默认为“speed” */
    mode: "speed" | "precision" = "speed";
    /** 文本 */
    text: string = "";

    private lens: number[] = [];
    private heights: number[] = [];
    private offsets: number[] = [];
    private ellipsisWidths: {
      [key: string]: number;
    } = {};
    private chineseCharWidth: number | null = null;
    private isChinese: RegExp = /[\u4e00-\u9fa5]/;

    constructor(text: string, fontSize: number = 12, fontFamily: string = "sans-serif") {
      if (unicodeWidth.dict === null) {
        throw new Error("dict not loaded");
      }
      this.fontSize = fontSize;
      this.fontFamily = fontFamily;
      this.setText(text);
      this.updateCache();
    }


    attr<T extends keyof SVGTextManagerAttributes>(property: T, value: this[T]): this;
    attr<T extends keyof SVGTextManagerAttributes>(property: T): this[T];
    attr<T extends keyof SVGTextManagerAttributes>(property: T, value?: this[T]) {
        if (value === undefined) return this[property];
        if (property === 'multiline') {
            throw new Error(`Property ${property} is read-only`);
        }
        if (this[property] === value) return this;
        this[property] = value;
        if (property === 'text') this.setText(value as string);
        this.updateCache();
        return this;
    }

    visualWidth(start: number = 0, end: number = this.text.length) {
        return (this.lens[end - 1] || 0) - (this.lens[start - 1] || 0);
    }
    visualHeight() {
        return this.heights.reduce((a, b) => Math.max(a, b), this.lineHeight);
    }

    // /**
    //  * 计算文本的理想矩形大小
    //  * @param r 理想宽高比
    //  * @param singleLineWidth 单行文本宽度（当文字较少时，忽略宽高比而使用此宽度）
    //  */
    // idealRectangle(r: number = 0.33, singleLineWidth: number = 100) {
    //     const totalWidth = this.visualWidth();
    //     const lineHeight = this.lineHeight;
    //     let idealWidth, idealHeight;

    //     if (totalWidth < singleLineWidth) {
    //         idealWidth = totalWidth;
    //         idealHeight = lineHeight;
    //     }
    //     else {
    //         idealWidth = Math.sqrt((totalWidth * lineHeight) / r);
    //         idealHeight = this.wrap(idealWidth, Infinity).length * lineHeight;
    //     }
    //     return {
    //         width: idealWidth,
    //         height: idealHeight,
    //     };
    // }

    /**
     * 计算理想矩形
     * @param r 理想宽高比
     * @param maxWidth 最大宽度
     * @param maxHeight 最大高度
     * @returns 理想矩形的宽高
     */
    idealRectangle(r: number, maxWidth: number, maxHeight: number) {
        const totalWidth = this.visualWidth();
        const lineHeight = this.lineHeight;
        const r0 = totalWidth / lineHeight;
        if (r0 < r) {
            const lines = this.wrap(maxWidth, Infinity).length;
            return {
                width: lines > 1 ? maxWidth : totalWidth,
                height: Math.min(lines * lineHeight, maxHeight)
            }
        }
        const area = totalWidth * lineHeight;
        let idealWidth = Math.sqrt(area / r);
        let idealHeight = this.wrap(idealWidth, Infinity).length * lineHeight;

        if (idealWidth <= maxWidth && idealHeight <= maxHeight) {
            return {
                width: idealWidth,
                height: idealHeight
            }
        }
        else if (idealWidth > maxWidth) {
            idealWidth = maxWidth;
            idealHeight = this.wrap(idealWidth, Infinity).length * lineHeight;
            if (idealHeight <= maxHeight) {
                return {
                    width: idealWidth,
                    height: idealHeight
                }
            }
            else {
                return {
                    width: maxWidth,
                    height: maxHeight
                }
            }
        }
        else if (idealHeight > maxHeight) {
            idealHeight = maxHeight;
            idealWidth = Math.ceil((area / idealHeight) * r);
            if (idealWidth <= maxWidth) {
                return {
                    width: idealWidth,
                    height: idealHeight
                };
            }
            else {
                return {
                    width: maxWidth,
                    height: maxHeight
                };
            }
        }
        return {
            width: idealWidth,
            height: idealHeight
        };
    }

    truncate(width: number, ellipsis?: string) {
        const textWidth = this.visualWidth();
        if (textWidth <= width) {
            return this.text;
        }
        ellipsis = ellipsis || '...';
        const ellipsisWidth = this.ellipsisWidths[ellipsis] || this.setEllipsisWidth(ellipsis);
        const len = this.truncate_index(width - ellipsisWidth, 0, this.text.length - 1);
        if (len === 0) {
            return ellipsisWidth <= width ? ellipsis : '';
        }
        return this.text.slice(0, len) + ellipsis;
    }

    wrap(width: number, height: number, ellipsis?: string) {
        const maxLines = Math.max(0, Math.floor(height / this.lineHeight));
        return this.multiline ?
            this.wrapMultiParagraph(this.text, width, maxLines, ellipsis) :
            this.wrapSingleParagraph(this.text, 0, this.text.length, width, maxLines, ellipsis);
    }

    lines2svg(lines: string[]) {
        return lines.map((line, i) => {
            return "<tspan x='0' dy='" + this.lineHeight * Math.min(i, 1) + "'>" + line + "</tspan>";
        }).join('');
    }

    private setEllipsisWidth(ellipsis: string) {
        return this.ellipsisWidths[ellipsis] = unicodeWidth.stringWidth(ellipsis, this.fontSize);
    }

    private truncate_index(width: number, start: number, end: number) {
        if (width <= 0) return 0;
        let textWidth = this.lens[end] - (this.lens[start - 1] || 0) - this.offsets[start];
        start = start || 0;
        end = end || this.text.length - 1;

        // 边界条件判断
        if (textWidth <= width) {
            return end;
        }
        else if (this.lens[0] > width) {
            return 0;
        }
        // 二分查找确定长度（此时保证了长度一定不小于1，且达不到最大长度）
        let offset = (this.lens[start - 1] || 0) - this.offsets[start];

        while (start < end) {
            const mid = Math.ceil((start + end) / 2);
            const newTextWidth = this.lens[mid] - offset;
            if (newTextWidth <= width) {
                start = mid;
            }
            else {
                end = mid - 1;
            }
        }
        return start + 1;
    }

    private wrapSingleParagraph(text: string, start: number, end: number, width: number, maxLines: number, ellipsis?: string) {
        if (maxLines === 0) return [];
        maxLines = maxLines || Infinity;
        ellipsis = ellipsis || '...';
        const ellipsisWidth = this.ellipsisWidths[ellipsis] || this.setEllipsisWidth(ellipsis);
        let p = start;
        const lines = [];
        while (p < end) {
            let p1 = this.truncate_index(width, p, end);
            if (p1 - p === 0) {
                if (ellipsisWidth <= width) {
                    lines.push(ellipsis);
                }
                break;
            }
            lines.push(text.slice(p, p1));
            p = p1;
            if (lines.length === maxLines) {
                break;
            }
        }
        if (p < end && lines.length > 0) {
            let p0 = p - lines[lines.length - 1].length;
            if (width <= ellipsisWidth) {
                lines[lines.length - 1] = ellipsis;
            }
            else {
                let p1 = this.truncate_index(width - ellipsisWidth, p0, end);
                lines[lines.length - 1] = text.slice(p0, p1) + ellipsis;
            }
        }
        return lines;
    }

    private wrapMultiParagraph(text: string, width: number, maxLines: number, ellipsis?: string) {
        if (maxLines === 0) return [];
        maxLines = maxLines || Infinity;
        ellipsis = ellipsis || '...';
        let p = 0;
        const lines = [];
        let end = null;
        while ((end = text.indexOf('\n', p)) !== -1) {
            const ls = this.wrapSingleParagraph(text, p, end, width, maxLines, ellipsis);
            if (maxLines - ls.length === 0) {
                lines.push(...ls);
                maxLines -= ls.length;
                break;
            }
            lines.push(...ls, " ");
            maxLines -= ls.length + 1;
            p = end + 1;
        }
        if (end < text.length && maxLines > 0) {
            const ls = this.wrapSingleParagraph(text, p, text.length, width, maxLines, ellipsis);
            lines.push(...ls);
        }
        return lines;
    }

    private updateCache() {
      this.mode === 'speed' ? this.updateCacheModeSpeed() : this.updateCacheModePrecision();
    }

    private updateCacheModePrecision() {
      return this.updateCacheModeSpeed();
    }

    private updateCacheModeSpeed() {
        const o = 0;
      for (let i = 0; i < this.text.length; i++) {
        this.offsets[i] = o;
        this.lens[i] = (this.lens[i - 1] || 0) + unicodeWidth.charWidth(this.text[i], this.fontSize) + o;
      }
    }

    private setText(text: string) {
      if (text === null || text === undefined) {
        this.text = "";
        return;
      }
      this.text = text.trim()
          .replace(/[ ]+/g, ' ')
          .replace(/\n+/g, '\n');
      if (this.text.length === 0) this.text = " ";
      this.multiline = this.text.includes('\n');
    }
}