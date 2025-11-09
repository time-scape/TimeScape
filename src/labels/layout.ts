import * as d3 from "d3";
import Label from "./label";
import { $figuresClicked, $figureContexts, $figures, $figuresSelected } from "../store";
import { Zoom2D } from "./utils/zoom2D";
import { domainX, domainY } from "../constants";
import stringToRandom from "./utils/random";

type SizeConfig = {
    /** 整个布局高度 */
    height: number;
    /** 单个标签的高度（auto表示自适应填满整个屏幕） */
    labelHeight: number | "auto";
    /** 单个标签的行高（auto表示自适应填满整个屏幕） */
    labelLineHeight: number | "auto";
    /** 获得横坐标的范围 */
    getX: (label: Label) => [number, number];
}

/** 人物布局的位置 */
interface Position {
    x1: number;
    x2: number;
    y1: number;
    y2: number;
}

/** 人物布局相对于某个人物的位置（主要是纵坐标是相对的），用于对选中人物的个人中心布局 */
interface DPosition {
    x1: number;
    x2: number;
    dy1: number;
    dy2: number;
}

type LineItem = {
    label: Label;
    x1: number;
    x2: number;
}
type Line = LineItem[];

type FuncOrder = (labelA: Label, iA: number, labelB: Label, iB: number, totalIndex: number) => number;
type FuncKey = (label: Label, i: number, totalIndex: number) => number;

export default class Layout {

    /** 曾经参与过布局的所有标签 */
    allLabels: readonly Label[];
    /** 布局中所有标签 */
    labels: Label[];

    internalScaleX: d3.ScaleTime<number, number>;
    internalScaleY: d3.ScaleLinear<number, number>;

    /** 标签id到index的映射，方便检索 */
    id2index: Map<number, number>;

    /** 布局大小相关参数 */
    size: SizeConfig;

    /** 全局布局允许行编号偏离数据顺序的程度 */
    globalLineNumber: (label: Label) => number = () => 1;

    /** 个人中心布局允许行编号偏离数据顺序的程度 */
    singleLineNumber: (label: Label) => number = () => Infinity;

    /** 顺序 */
    /** 通过比较定义顺序 */
    order?: FuncOrder;
    /** 通过数值定义顺序 */
    key?: FuncKey;

    Tx: number;
    Ty: number;

    /** 全局布局结果 */
    globalPositions: Map<number, Position>;

    /** 个人中心布局结果 */
    singlePositions: Map<number, DPosition>[];

    /** 聚焦视图布局结果 */
    focusedPositions: Map<number, Position>;

    /** 全局布局导出参数 */
    globalConfig: {
        /** 总行数 */
        lineNumber: number;
        /** 总分配高度（与size的定义相同） */
        height: number;
        /** 单个标签的高度 */
        labelHeight: number;
        /** 单个标签的行高 */
        labelLineHeight: number;
        /** 实际布局总高度 */
        totalHeight: number;
    }

    /** 聚焦视图总高度 */
    focusedTotalHeight: number = 0;

    constructor(
        labels: Label[],
        realWidth: number,
        realHeight: number,
        sizeConfig: SizeConfig,
        globalLineNumber?: (label: Label) => number,
        singleLineNumber?: (label: Label) => number,
        order?: FuncOrder,
        key?: FuncKey,
    ) {
        this.labels = labels;
        this.allLabels = labels;
        this.id2index = new Map<number, number>();
        labels.forEach((label, index) => {
            this.id2index.set(label.datum.id, index);
        });
        this.Tx = 2;
        this.Ty = 100;
        this.internalScaleX = d3.scaleTime()
            .domain(domainX)
            .range([0, realWidth]);
        this.internalScaleY = d3.scaleLinear()
            .domain(domainY)
            .range([0, realHeight]);
        this.size = sizeConfig;
        globalLineNumber && (this.globalLineNumber = globalLineNumber);
        singleLineNumber && (this.singleLineNumber = singleLineNumber);
        this.order = order;
        this.key = key;
        if (order === undefined && key === undefined) {
            throw new Error("Either order or key must be defined");
        }

        this.globalPositions = new Map<number, Position>();
        this.singlePositions = [];
        this.focusedPositions = new Map<number, Position>();
        this.globalConfig = {} as any;
        this.solve_global();
    }

    updateConfig(
        globalLineNumber?: (label: Label) => number,
        singleLineNumber?: (label: Label) => number,
        order?: FuncOrder,
        key?: FuncKey
    ) {
        globalLineNumber !== undefined && (this.globalLineNumber = globalLineNumber);
        singleLineNumber !== undefined && (this.singleLineNumber = singleLineNumber);
        this.order = order;
        this.key = key;
        if (order === undefined && key === undefined) {
            throw new Error("Either order or key must be defined");
        }
        this.solve_global();
    }

    /**
     * 计算全局布局
     * 布局结果保存在globalPositions中
     * 布局的参数保存在globalConfig中
     */
    solve_global() {
        const labels = this.labels;
        const lines: Line[] = [];

        /** 根据给定的排序方法进行排序 */
        let data: Label[];
        if (this.order !== undefined) {
            const fn = this.order,
                n = labels.length;
            data = labels.slice().sort((a, b) => fn(a, 0, b, 0, n));
        }
        else {
            const fn = this.key!,
                n = labels.length,
                values = labels.map((label, i) => fn(label, i, n));
            data = new Array<number>(n).fill(0).map((_, i) => i)
                .sort((a, b) => values[a] - values[b])
                .map(i => labels[i]);
        }

        /** 贪心法给每个元素分配行序号 */
        const getLineNumber = this.globalLineNumber;
        const getX = this.size.getX;
        data.forEach((label) => {
            const [x1, x2] = getX(label);
            const n = lines.length;
            const lineNum =  Math.min(n, getLineNumber(label));
            let placed = false;
            for (let i = n - lineNum, line; i < n; i++) {
                line = lines[i];
                if (line.every(l => l.x1 > x2 || l.x2 < x1)) {
                    line.push({ label, x1, x2 });
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                lines.push([{ label, x1, x2 }]);
            }
        });

        const height = this.size.height;
        const labelLineHeight = this.size.labelLineHeight === "auto" ? height / lines.length : this.size.labelLineHeight;
        const labelHeight = this.size.labelHeight === "auto" ? labelLineHeight * 0.8 : this.size.labelHeight;

        const globalPositions = this.globalPositions;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const y = height - (i + 1) * labelLineHeight;
            const h = labelHeight;
            for (const { label, x1, x2 } of line) {
                globalPositions.set(label.datum.id, {
                    x1,
                    x2,
                    y1: y,
                    y2: y + h,
                });
            }
        }

        this.globalConfig = {
            lineNumber: lines.length,
            height,
            labelHeight,
            labelLineHeight,
            totalHeight: labelLineHeight * lines.length,
        };
    }

    /**
     * 计算个人中心布局
     * 布局结果保存在localPositions中
     */
    solve_single() {
        const figuresSelected = $figuresClicked.get();
        const maps: Map<number, DPosition>[] = new Array(figuresSelected.length);
        if (figuresSelected.length === 0) {
            this.singlePositions = maps;
            return;
        }

        const figureContexts = $figureContexts.get()!.slice();
        const labels = this.labels;
        const globalPositions = this.globalPositions;
        const labelLineHeight = this.globalConfig.labelLineHeight;
        const indices = new Array(labels.length).fill(0).map((_, i) => i);

        for (let i = 0; i < figuresSelected.length; ++i) {
            const map = new Map<number, DPosition>();
            const center = figuresSelected[i];
            const p0 = globalPositions.get(center.id)!;
            const lineCenter = [{ label: center, x1: p0.x1, x2: p0.x2 }];
            const lineUp: Line[] = [];
            const lineDown: Line[] = [];

            indices.sort((a, b) => (figureContexts[b]?.[i].weight ?? 0) - (figureContexts[a]?.[i].weight ?? 0));

            for (let j = 0; j < figureContexts.length; ++j) {
                const idx = indices[j];
                const context = figureContexts[idx];
                if (context[i].weight === 0) {
                    break;
                }
                const label = labels[idx];
                const id = label.datum.id;
                const p = globalPositions.get(id)!;
                const [x1, x2] = this.size.getX(label);
                if (figuresSelected.find(f => f.id === id)) {
                    map.set(id, {
                        x1: x1,
                        x2: x2,
                        dy1: p.y1 - p0.y1,
                        dy2: p.y2 - p0.y2,
                    });
                    continue;
                }
                let dindex: number;
                if (p.y1 < p0.y1) {
                    dindex = - this._add_in_lines(label, lineUp) - 1;
                }
                else if (p.y1 > p0.y1) {
                    dindex = this._add_in_lines(label, lineDown) + 1;
                }
                else {
                    if (lineCenter.every(l => l.x1 > x2 || l.x2 < x1)) {
                        lineCenter.push({ label: label.datum, x1, x2 });
                        dindex = 0;
                    }
                    else {
                        dindex = this._add_in_lines(label, lineDown) + 1;
                    }
                }
                const dy = dindex * labelLineHeight;
                map.set(id, {
                    x1: x1,
                    x2: x2,
                    dy1: dy,
                    dy2: dy,
                });
            }
            maps[i] = map;
        }

        this.singlePositions = maps;
    }

    /**
     * 计算聚焦视图的布局
     * 实时计算
     * @param scaleX X轴缩放比例尺
     * @param scaleY Y轴缩放比例尺
     */
    solve_focused (
        scaleX: d3.ScaleTime<number, number>,
        scaleY: d3.ScaleLinear<number, number>,
    ) {
        const [X0, X1] = scaleX.range();
        const [Y0, Y1] = scaleY.range();
        const windowHeight = Y1 - Y0;

        const kx = (domainX[1].getTime() - domainX[0].getTime()) / (scaleX.domain()[1].getTime() - scaleX.domain()[0].getTime());
        const dx = Math.max(1, (kx - 50) / 5);

        const allLabels = this.allLabels;
        const id2index = this.id2index;

        const figuresClicked = $figuresClicked.get().slice()
            .sort((a, b) => this.id2index.get(b.id)! - this.id2index.get(a.id)!);
        const N = figuresClicked.length;
        if (N === 0) {
            throw new Error('No figures clicked');
        }
        // 聚焦人物的归一化高度（显示高度为200px）
        const focusedHeight = 160;
        // 其他相关人物的归一化高度（显示高度为16px）
        const relatedHeight = 12;
        const marginY = 5;

        /**
         * STEP1: 将所有的人物分成不同的块
         */
        const figuresSelected = $figuresSelected.get();
        const figuresClickedIndices = figuresClicked.map(f => figuresSelected.findIndex(sf => sf.id === f.id));
        const figuresClickedSet = new Set(figuresClicked.map(f => f.id));
        const figures = $figures.get();
        const labels = figures.map(f => allLabels[id2index.get(f.id)!]);
        const contexts = $figureContexts.get()!;
        const globalPositions = this.globalPositions;
        const heights = labels.map(label => Label.getBaseSize(label));

        const y0 = globalPositions.get(figuresClicked.at(0)!.id)!.y1;
        const y1 = globalPositions.get(figuresClicked.at(-1)!.id)!.y1;
        const cy = (y0 + y1) / 2;

        const blocks: Array<number[]> = new Array(figuresClicked.length + 1)
            .fill(0 as any).map(() => []);

        for (let i = 0, n = figures.length; i < n; ++i) {
            const figure = figures[i];
            if (figuresClickedSet.has(figure.id)) {
                continue;
            }
            const context = contexts[i];
            const weights = figuresClickedIndices.map(index => {
                return context[index].weight;
            });
            const wsum = weights.reduce((a, b) => a + b, 0);
            weights.forEach((w, i) => weights[i] = wsum === 0 ? 0 : w / wsum);

            let y = weights.reduce((acc, w, i) => {
                return acc + w * (i + 1);
            }, 0);

            let blockIndices: number;
            if (y === 0 || (Math.abs(y - 1) < 1e-6 && N === 1)) {
                const _y = globalPositions.get(figure.id)!.y1;
                if (_y < cy) {
                    blockIndices = 0;
                }
                else {
                    blockIndices = N;
                }
            }
            else if (Math.abs(y - 1) < 1e-6) {
                blockIndices = 0;
            }
            else if (Math.abs(y - N) < 1e-6) {
                blockIndices = N;
            }
            else {
                blockIndices = Math.floor(y);
            }
            // console.log(blockIndices, blocks.length, N);
            blocks[blockIndices].push(i);
        }

        // for (let i = 0, n = figures.length; i < n; ++i) {
        //     const figure = figures[i];
        //     if (figuresClickedSet.has(figure.id)) {
        //         continue;
        //     }
        //     const y = ys[i];
        // }

        /**
         * STEP2: 计算各个相关人物的横坐标、纵坐标
         */
        // const svgTextLength = new SVGTextLength(relatedFigureFontSize);
        // const widths = new Float64Array(figures.length);
        // figures.forEach((d, i) => {
        //     widths[i] = (svgTextLength.visualWidth(d.name) + relatedFigureFontSize * 1.5) * 0.1;
        // });
        const xs = new Float64Array(figures.length);
        const ys = new Float64Array(figures.length);
        for (let i = 0, n = blocks.length; i < n; ++i) {
            const block = blocks[i];

            for (let j = 0, m = block.length; j < m; ++j) {
                const index = block[j];
                const figure = figures[index];
                const context = contexts[index];
                const weights = figuresClickedIndices.map(idx => context[idx].weight + 1);
                const y = i === 0 ?
                    figuresClickedIndices.reduce((acc, idx, k) => {
                        return acc - weights[k] * (k + 1);
                    }, 0)
                    :
                    figuresClickedIndices.reduce((acc, idx, k) => {
                        return acc + weights[k] * (k + 1); // (Math.max(Math.min(k, i), i - 1) - i + 1);
                    }, 0);
                ys[index] = y;

                const f = (d: number) => 1 / (1 + Math.abs(d));

                let x = 0;
                let s = 0;
                let inWindow = false;
                figuresClickedIndices.forEach((idx) => {
                    let acc = 0;
                    context[idx].events.forEach(event => {
                        if (event.time === null) return;
                        const _x = scaleX(event.time!) + (stringToRandom(figure.name) - 0.5) * 20 * dx;
                        let factor: number;
                        if (_x >= X0 && _x <= X1) {
                            factor = 1.0;
                            s += factor;
                            acc += _x * factor;
                            inWindow = true;
                        }
                        else if (_x < X0) {
                            factor = f(X0 - _x);
                            s += factor;
                            acc += _x * factor;
                        }
                        else {
                            factor = f(_x - X1);
                            s += factor;
                            acc += _x * factor;
                        }
                    });
                    x += acc;
                });
                if (!inWindow) {
                    x = Number.NaN;
                }
                else if (s > 0) {
                    x /= s;
                }
                else {
                    x = (scaleX(figure.time[0]) + scaleX(figure.time[1])) / 2;
                }

                xs[index] = x;
            }
        }

        let y = marginY;
        const positions = new Array<Position>(figures.length);
        for (let i = 0, n = blocks.length; i < n; ++i) {
            // 先分配block的位置
            const block = blocks[i];
            const maxRelatedFigureHeight = Math.max(...block.map(index => heights[index]));
            const blockHeight = Math.max(Math.min(block.length * relatedHeight * 0.15, windowHeight * 0.4), maxRelatedFigureHeight);

            const maxY = Math.max(...block.map(index => ys[index]));
            const minY = Math.min(...block.map(index => ys[index]));

            for (const index of block) {
                const cx = xs[index];
                const ty = (ys[index] - minY) / Math.max(maxY - minY, 1e-12);
                const cy =  y + heights[index] / 2 + ty * (blockHeight - heights[index] / 2);
                positions[index] = {
                    x1: cx,
                    y1: cy,
                    x2: cx,
                    y2: cy,
                };
            }
            y += blockHeight + marginY;

            // 再分配figure的位置
            if (i < blocks.length - 1) {
                const figureClicked = figuresClicked[i];
                positions[figures.findIndex(f => f.id === figureClicked.id)] = {
                    x1: scaleX(figureClicked.time[0]),
                    y1: y,
                    x2: scaleX(figureClicked.time[1]),
                    y2: y + focusedHeight,
                };
                y += focusedHeight + marginY;
            }
        }

        if (y < windowHeight) {
            const dy = (windowHeight - y) * 0.5;
            for (const position of positions) {
                position.y1 += dy;
                position.y2 += dy;
            }
            y = windowHeight;
        }

        const focusedPositions = this.focusedPositions;
        for (let i = 0, n = figures.length; i < n; ++i) {
            const position = positions[i];
            // const label = labels[i];
            position.x1 = scaleX.invert(position.x1).getTime();
            position.x2 = scaleX.invert(position.x2).getTime();
            position.y1 = scaleY.invert(position.y1);
            position.y2 = scaleY.invert(position.y2);

            focusedPositions.set(figures[i].id, position);
            // label.initialPosition = position;
        }

        this.focusedTotalHeight = y / windowHeight;

        // figures.forEach((_, i) => {
        //     const context = contexts[i];
        //     const relations = [];
        //     for (const index of figuresClickedIndices) {
        //         relations.push(...context[index].relations.relations.filter(d => d.time !== null));
        //     }
        //     if (relations.length === 0) {
        //         const figure = figures[i];
        //         return (scaleX(figure.time[0]) + scaleX(figure.time[1])) / 2;
        //     }
        //     xs[i] = relations.reduce((acc, d) => acc +  scaleX(d.time!), 0) / relations.length;
        // });

        // /**
        //  * STEP3: 对于每个块，应用贪心法计算布局
        //  */
        // const blockLines: { index: number, x0: number, x1: number }[][][] = new Array(blocks.length).fill(0).map(() => []);
        // const lineNum = Infinity;
        // for (let i = 0, n = blocks.length; i < n; ++i) {
        //     const block = blocks[i];
        //     const lines = blockLines[i];
        //     const sign = i < n - 1 ? 1 : -1;
        //     block.sort((a, b) => {
        //         const { index: ai, v: av, w: aw } = a;
        //         const { index: bi, v: bv, w: bw } = b;
        //         return av - bv || sign * (aw - bw) || (globalPositions.get(figures[ai].id)!.y1 - globalPositions.get(figures[bi].id)!.y1);
        //     });
        //     for (const { index } of block) {
        //         const cx = cxs[index];
        //         const width = widths[index];
        //         const x0 = cx - width / 2;
        //         const x1 = cx + width / 2;
        //         const n = lines.length;
        //         let allocated = false;
        //         for (let i = Math.max(0, n - lineNum); i < n; ++i) {
        //             const line = lines[i];
        //             if (line.some(({ x0: _x0, x1: _x1 }) => {
        //                 return _x0 < x1 && _x1 > x0;
        //             })) {
        //                 continue;
        //             }
        //             line.push({ index, x0, x1 });
        //             allocated = true;
        //             break;
        //         }
        //         if (!allocated) {
        //             lines.push([{ index, x0, x1 }]);
        //         }
        //     }
        // }

        // /**
        //  * STEP4: 给每个块和选中人物分配位置
        //  */
        // const map = new Map<number, Position>();
        // let y = marginY;
        // for (let i = 0, n = blocks.length; i < n; ++i) {
        //     const blockLine = blockLines[i];
        //     // 给块中的每个人物分配位置
        //     for (let j = 0, m = blockLine.length; j < m; ++j) {
        //         const line = blockLine[j];
        //         for (const { index, x0, x1 } of line) {
        //             map.set(figures[index].id, {
        //                 x1: scaleX.invert(x0).getTime(),
        //                 x2: scaleX.invert(x1).getTime(),
        //                 y1: y,
        //                 y2: y + relatedHeight,
        //             } as any);
        //         }
        //         y += relatedHeight + marginY;
        //     }
        //     // 给figureClicked分配位置
        //     if (i < N) {
        //         map.set(figuresClicked[i].id, {
        //             x1: figuresClicked[i].time[0].getTime(),
        //             x2: figuresClicked[i].time[1].getTime(),
        //             y1: y,
        //             y2: y + focusedHeight,
        //         });
        //         y += focusedHeight + marginY;
        //     }
        // }
        // // y -= marginY;
        // this.focusedTotalHeight = y;
        // this.focusedPositions = map;
    }

    getTotalHeight(mode: "global" | "focused") {
        if (mode === "global") {
            return this.globalConfig.totalHeight;
        }
        return this.focusedTotalHeight;
    }

    /**
     * 获得各个选中人物在布局中的权重（归一化）
     */
    getSelectedFigureWeights(cx: number, cy: number) {
        const figuresSelected = $figuresClicked.get();
        const globalPositions = this.globalPositions;
        const centers = figuresSelected.map(f => globalPositions.get(f.id)!);

        cx = this.internalScaleX(cx);
        cy = this.internalScaleY(cy);

        /** 计算距离的倒数作为初始权重分配 */
        const w0 = centers.map(center => {
            const x = this.internalScaleX((center.x1 + center.x2) / 2);
            const y = this.internalScaleY((center.y1 + center.y2) / 2);
            let v = Math.hypot(x - cx, y - cy);
            return 1 / Math.max(v, 1e-12);
        });
        
        /** 初始权重归一化 */
        let wsum = w0.reduce((a, b) => a + b, 0);
        w0.forEach((w, i) => w0[i] = w / wsum);

        /** 映射到 w^β / (w^β + (1 - w)^β) */
        const beta = 4;
        w0.forEach((w, i) => {
            const v1 = Math.pow(w, beta);
            const v2 = Math.pow(1 - w, beta);
            w0[i] = v1 / (v1 + v2);
        });
        // /** 映射到6t^5 - 15t^4 + 10t^3 */
        // w0.forEach((w, i) => w0[i] = w * w * w * (w * (w * 6 - 15) + 10));
        wsum = w0.reduce((a, b) => a + b, 0);
        w0.forEach((w, i) => w0[i] = w / wsum);

        return w0;
    }
    
    customInterpolate(
        labels: Label[],
        positionMap1: Map<number, Position>,
        positionMap2: Map<number, Position>,
        t: number
    ) {
        for (const label of labels) {
            let pos1 = positionMap1.get(label.datum.id);
            let pos2 = positionMap2.get(label.datum.id);
            if(!pos1 && !pos2) continue;
            if (!pos1) pos2 = pos1;
            else if (!pos2) pos1 = pos2;
            label.initialPosition = {
                x1: this._interpolateNumber(pos1!.x1, pos2!.x1, t),
                x2: this._interpolateNumber(pos1!.x2, pos2!.x2, t),
                y1: this._interpolateNumber(pos1!.y1, pos2!.y1, t),
                y2: this._interpolateNumber(pos1!.y2, pos2!.y2, t),
            };
        }
    }

    interpolate(zoom: Zoom2D | null, [cx, cy]: [number, number], mode: "global" | "focused" = "global") {
        if (mode === "focused") {
            const globalPositions = this.globalPositions;
            const focusedPositions = this.focusedPositions;
            for (const label of this.labels) {
                const pos = focusedPositions.get(label.datum.id) ?? globalPositions.get(label.datum.id)!;
                label.initialPosition = pos;
            }
            return;
        }

        const transform = zoom === null ? null : zoom.getTransform();
        const tx = transform === null ? 0 : this._scaleX(transform.kx);
        const ty = transform === null ? 0 : this._scaleY(transform.ky);
        const globalPositions = this.globalPositions;
        const singlePositions = this.singlePositions;
        const figuresSelected = $figuresClicked.get();
        const centers = figuresSelected.map(f => globalPositions.get(f.id)!);

        const ws = this.getSelectedFigureWeights(cx, cy);

        for (const label of this.labels) {
            /** 在全局布局中的位置 */
            const { x1: gx1, x2: gx2, y1: gy1, y2: gy2 } = globalPositions.get(label.datum.id)!;
            
            /**
             * 在个人中心布局中的平均位置
             * @description 这里没有根据人物权重加权，是因为选中的人物被认为同等重要
             */
            let sx1 = 0, sx2 = 0, sy1 = 0, sy2 = 0;
            let count = 0;
            let wsum = 0;
            for (let j = 0, dpos, center, w; j < singlePositions.length; ++j) {
                dpos = singlePositions[j].get(label.datum.id);
                if (dpos === undefined) {
                    continue;
                }
                center = centers[j];
                w = ws[j];
                sx1 += dpos.x1;
                sx2 += dpos.x2;
                sy1 += (center.y1 + dpos.dy1) * w;
                sy2 += (center.y2 + dpos.dy2) * w;
                count++;
                wsum += w;
            }
            if (count > 0) {
                sx1 /= count;
                sx2 /= count;
                sy1 /= wsum;
                sy2 /= wsum;
            }
            else {
                sx1 = gx1;
                sx2 = gx2;
                sy1 = gy1;
                sy2 = gy2;
            }

            /** 插值构建最终的实际布局位置 */
            const pos = {
                x1: this._interpolateNumber(gx1, sx1, tx),
                x2: this._interpolateNumber(gx2, sx2, tx),
                y1: this._interpolateNumber(gy1, sy1, ty),
                y2: this._interpolateNumber(gy2, sy2, ty),
            };

            /** 直接写入 */
            label.initialPosition = pos;
        }
    }

    private _interpolateNumber(a: number, b: number, t: number) {
        t = Math.min(Math.max(t, 0), 1);
        return a + (b - a) * t;
    }

    /**
     * 根据x轴缩放因子找到对应的x轴插值系数
     * @description 映射公式：[1, thresX] -> [0, 1]，超出范围会截断
     * @param kx x轴缩放因子
     * @returns
     */
    private _scaleX(kx: number) {
        const a = 1, b = this.Tx; // 定义域[1,2]，左边界默认为1，即不放大的情况。
        // ab / (a - b) (1/x - 1/a)，反比例函数，确保值域为[0, 1]
        const t = b * (kx - a) / ((b - a) * kx);
        return Math.min(Math.max(t, 0), 1);
    }

    /**
     * 根据y轴缩放因子找到对应的y轴插值系数
     * @description 映射公式：[1, thresY] -> [0, 1]，超出范围会截断
     * @param ky y轴缩放因子
     * @returns
     */
    private _scaleY(ky: number) {
        const a = 1, b = this.Ty; // 定义域[1,100]，左边界默认为1，即不放大的情况。
        // ab / (a - b) (1/y - 1/a)，反比例函数，确保值域为[0, 1]
        const t = b * (ky - a) / ((b - a) * ky);
        return Math.min(Math.max(t, 0), 1);
    }

    /**
     * 将标签添加到指定的行中
     * @param label 要添加的标签
     * @param lines 行数组
     * @returns 添加的行索引
     */
    private _add_in_lines(label: Label, lines: Line[]) {
        const [x1, x2] = this.size.getX(label);
        const n = lines.length;
        const lineNum = Math.min(n, this.singleLineNumber(label));
        for (let i = n - lineNum, line; i < n; i++) {
            line = lines[i];
            if (line.every(l => l.x1 > x2 || l.x2 < x1)) {
                line.push({ label, x1, x2 });
                return i;
            }
        }
        lines.push([{ label, x1, x2 }]);
        return lines.length - 1;
    }
}