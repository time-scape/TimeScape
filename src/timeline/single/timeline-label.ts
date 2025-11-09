import { ScalableRectangle, overlapX, BoundingBox, BoundingBoxWithTruncated } from "../utils/bounding-box";
import { ScaleTime } from "../types";
import LabelVisibleThreshold from "./LabelVisibleThreshold";

type LabelAttributes = Pick<Label, "description" | "scale" | "time" | "offsetX" | "offsetY" | "width" | "height" | "alignment" | "paddingX" | "paddingY" | "importance" | "minK" | "maxK" | "boundingBox">

export default class Label {
    static counter: number = 0;

    /** 标签id */
    readonly id: number = Label.counter++;

    idx?: number;

    /** 标签描述，用于debug */
    description?: string;
    /** 比例尺 */
    scale!: ScaleTime;
    /** 标签对应的时间，时间点事件为Date，时间段事件为[Date, Date] */
    time!: [Date, Date] | Date;
    /** 布局横坐标偏移量 */
    offsetX: number = 0;
    /** 布局纵坐标偏移量 */
    offsetY: number = 0;
    /** 标签宽度 */
    width: number = 0;
    /** 标签高度 */
    height: number = 0;
    /** 对齐方式（当为时间点事件时使用） */
    alignment: "left" | "center" | "right" = "center";
    /** 标签横向padding */
    paddingX: number = 0;
    /** 标签纵向padding */
    paddingY: number = 0;
    /** 标签重要性 */
    importance: number = 1;
    /** 标签可见的放大倍数上界（实际上可能比这个小） */
    maxK: number = Infinity;
    /** 标签可见的放大倍数下界（实际上可能比这个大） */
    minK: number = 0;
    /** 布局的BoundingBox */
    boundingBox: (scale: ScaleTime) => ScalableRectangle = (scale) => {
        let offsetX = this.attr('offsetX');
        let offsetY = this.attr('offsetY');
        let height = this.attr('height');
        let time = this.attr('time');

        /**计算boundingBox */
        let boundingbox: ScalableRectangle;
        if(time instanceof Array) {
            const width = this.attr("width");
            if (width === 0) {
                boundingbox = [
                    [scale(time[0]) + offsetX, offsetY],
                    [scale(time[1]) + offsetX, offsetY + height],
                    [true, false],
                ];
            }
            else {
                let x1 = scale(time[0]) + offsetX;
                let x2 = scale(time[1]) + offsetX;
                let cx = (x1 + x2) * 0.5;
                boundingbox = [
                    [cx - width * 0.5, offsetY],
                    [cx + width * 0.5, offsetY + height],
                    [true, false],
                ];
            }
        }
        else {
            let cx = scale(time)
            let width = this.attr('width');
            let alignment = this.attr('alignment');
            switch (alignment) {
                case "center":
                    boundingbox = [
                        [cx - width * 0.5 + offsetX, offsetY],
                        [cx + width * 0.5 + offsetX, offsetY + height],
                        [false, false],
                    ];
                    break;
                case "left":
                    boundingbox = [
                        [cx + offsetX, offsetY],
                        [cx + width + offsetX, offsetY + height],
                        [false, false],
                    ];
                    break;
                case "right":
                    boundingbox = [
                        [cx - width + offsetX, offsetY],
                        [cx + offsetX, offsetY + height],
                        [false, false],
                    ];
                    break;
                default:
                    throw new Error("unknown alignment");
            }
        }
        return boundingbox;
    }

    get t(): Date {
        if (this.time instanceof Array) {
            return new Date((this.time[0].getTime() + this.time[1].getTime()) / 2);
        }
        return this.time;
    }

    /** 标签的刻度渲染方法 */
    private _tick!: (ctx: CanvasRenderingContext2D, scale: ScaleTime, label: this, context?: any) => void;
    /** 标签的内容渲染方法 */
    private _content!: (ctx: CanvasRenderingContext2D, scale: ScaleTime, label: this, context?: any) => void;
    /** 子节点 */
    children: Label[] = [];

    /** 标签实际可见的放大倍数（在只有一行时） */
    visibleK: [number, number] = [0, Infinity];
    /** 存在于多行时的visibleK。其中第一个数时所在的行数（时间轴下方为正，上方为负），后两个数是[minK, maxK] */
    visibleKList: [number, number, number][] = [];

    protected constructor(){}
    static create(){
        return new Label()
    }

    attr<T extends keyof LabelAttributes>(property: T, value: this[T]): this;
    attr<T extends keyof LabelAttributes>(property: T): this[T];
    attr<T extends keyof LabelAttributes>(property: T, value?: this[T]){
        if(value === undefined){
            return this[property];
        }
        this[property] = value;
        return this;
    }

    tick(value: (ctx: CanvasRenderingContext2D, scale: ScaleTime, label: this, context?: any) => void): this;
    tick(): (ctx: CanvasRenderingContext2D, scale: ScaleTime, label: this, context?: any) => void;
    tick(tick?: (ctx: CanvasRenderingContext2D, scale: ScaleTime, label: this, context?: any) => void){ // 设置tick的内容
        if(tick === undefined){
            return this._tick;
        }
        this._tick = tick;
        return this;
    }

    content(value: (ctx: CanvasRenderingContext2D, scale: ScaleTime, label: this, context?: any) => void): this;
    content(): (ctx: CanvasRenderingContext2D, scale: ScaleTime, label: this, context?: any) => void;
    content(content?: (ctx: CanvasRenderingContext2D, scale: ScaleTime, label: this, context?: any) => void){ // 设置text和group的内部内容
        if(content === undefined){
            return this._content;
        }
        this._content = content;
        return this;
    }

    addChild(...labels: Label[]): this {
        this.children.push(...labels);
        return this;
    }
    addChildren(...labels: Label[]): this {
        this.children.push(...labels);
        return this;
    }

    render(ctx: CanvasRenderingContext2D, scale: ScaleTime, context?: any) {
        this._content(ctx, scale, this, context);
    }

    static visibleThreshold(
        labels: Label[],
        scale: ScaleTime,
        borderLabels: Label[] = [],
        krange: [number, number] = [0, Infinity],
    ){
        return Label._visibleThreshold(labels, scale, borderLabels, krange);
    }

    /**
     * 新算法思路：
     * （1）先计算所有标签对之间在缩放到多大时会重叠，形成一个二维数组k_{i,j}
     * （2）从最小的k_{i,j}开始依次遍历。对于每个k = k_{i,j}，取出所有数组中小于等于k的元素，组成一个约束图。图中的边表示在缩放到k时，相应两个元素之间是否会重叠。
     * （3）可以使用暴力搜索找到保证不重叠的情况下能够达到最大权重的标签组合。组合需要时嵌套的关系（就是如果上一层选了一个标签，那么下一层也必须选这个）。
     * @param labels 标签列表
     * @param scale 时间轴的scale
     * @param borderLabels 边界标签，用来规定显示范围的边界
     * @param kRange 可以显示的放大倍数范围
     * @param debug 是否开启debug模式
     */

    private static _visibleThreshold(
        labels: Label[],
        scale: ScaleTime,
        borderLabels: Label[] = [],
        kRange: [number, number] = [0, Infinity],
        debug: boolean = false,
    ): void {

        const calculator = LabelVisibleThreshold.create()
            .data(labels)
            .attr("scale", scale)
            .attr("borders", borderLabels)
            .attr("kRange", kRange);

        calculator.calculate();
    }

    /**
     *  获得当前的边界框
     *  @param scale 时间轴的scale
     */
    getBoundingBox(scale: ScaleTime): BoundingBox;
    /**
     *  获得当前的边界框
     *  @param scale 时间轴的scale
     *  @param xExtent 可以显示的范围xExtent
     */
    getBoundingBox(scale: ScaleTime, xExtent: [number, number]): BoundingBoxWithTruncated;

    getBoundingBox(scale: ScaleTime, xExtent?: [number, number]): BoundingBox | BoundingBoxWithTruncated {
        const origin = this.boundingBox(scale);
        const [x1, y1] = origin[0];
        const [x2, y2] = origin[1];
        const boundingBox = {
            x: x1,
            y: y1,
            width: x2 - x1,
            height: y2 - y1,
        };

        if (xExtent === undefined) {
            return boundingBox;
        }
        /** [x1, x2]包含在xExtent中 */
        if (x1 >= xExtent[0] && x2 <= xExtent[1]) {
            return Object.assign(boundingBox, {
                truncatedX1: false,
                truncatedX2: false,
            });
        }
        /** [x1, x2]与xExtent无交集 */
        else if (x2 < xExtent[0] || x1 > xExtent[1]) {
            return Object.assign(boundingBox, {
                truncatedX1: true,
                truncatedX2: true,
            });
        }
        else {
            const truncatedX1 = x1 < xExtent[0];
            const truncatedX2 = x2 > xExtent[1];
            const x = truncatedX1 ? xExtent[0] : x1;
            const width = truncatedX2 ? xExtent[1] - x : x2 - x;
            return Object.assign(boundingBox, {
                x,
                width,
                truncatedX1,
                truncatedX2,
            });
        }
    }

}