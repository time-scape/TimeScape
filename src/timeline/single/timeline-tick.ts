import * as d3 from "d3";
import { ScalableRectangle, overlapX } from "../utils/bounding-box";
import SVGTextLength from '../utils/SVGTextLength';
import { ScaleTime } from "../types";

const svgTextLength = new SVGTextLength();

export default class Tick {
    static counter: number = 0;
    static iterate: {
        [key in "y" | "m" | "d" | "h" | "M" | "s"]: (t: Date, num?: number) => void
    } = {
        y: (t, num=1) => t.setFullYear(t.getFullYear() + num),
        m: (t, num=1) => t.setMonth(t.getMonth() + num),
        d: (t, num=1) => t.setDate(t.getDate() + num),
        h: (t, num=1) => t.setHours(t.getHours() + num),
        M: (t, num=1) => t.setMinutes(t.getMinutes() + num),
        s: (t, num=1) => t.setSeconds(t.getSeconds() + num),
    };

    readonly id: number = Tick.counter++;

    /** 所有刻度的列表 */
    private _ticks: Date[] | null = null;

    /** 通过every设置如何选择刻度 */
    private _every?: string;

    /** 通过filter和granularity设置如何选择刻度 */
    /** 过滤器，筛选出符合条件的刻度 */
    private _filter?: (time: Date) => boolean;
    /** 刻度选取粒度，例如：1y", "10d"，支持的单位与Tick.iterate的keys相同 */
    private _granularity?: string;

    /** 直接指定ticks */
    private _values?: Date[];

    /** 刻度线长度 */
    private _tickLength: number = 10;
    /** 字体大小，置为null则不显示刻度文字 */
    private _fontsize: number = 12;
    /** 字体显示格式 */
    private _tickFormat: (time: Date) => string = d3.timeFormat("%Y-%m-%d");

    /** 放大多少倍可以显示出来刻度 */
    tickVisibleK: number = 0;

    /** 放大多少倍可以显示出来文本 */
    textVisibleK: number = 0;

    private constructor() {}
    static create(){
        return new Tick();
    }

    /**参数 */

    /** 每多长时间 */
    every(value: string): this;
    every(): string;
    every(value?: string){
        if(value === undefined){
            return this._every
        }
        this._every = value;
        this._ticks = null;
        return this;
    }

    /**
     * 哪些年份（月份、日期）属于这一等级的ticks。优先级高于every
     * @param filter 在当前粒度的所有时间中，筛选出哪些时间属于这一等级的ticks
     * @param granularity 时间选取粒度
     */
    is (filter: (time: Date) => boolean, granularity: string): this {
        return this.filter(filter).granularity(granularity);
    }

    granularity(value: string): this;
    granularity(): string;
    granularity(value?: string){
        if(value === undefined){
            return this._granularity;
        }
        this._parseGranularity(value);
        this._granularity = value;
        this._ticks = null;
        return this;
    }

    filter(value: (time: Date) => boolean): this;
    filter(): (time: Date) => boolean;
    filter(value?: (time: Date) => boolean){
        if(value === undefined){
            return this._filter;
        }
        this._filter = value;
        this._ticks = null;
        return this;
    }

    /** 直接指定ticks */
    values(value?: Date[]): this;
    values(): Date[];
    values(value?: Date[]){ // [], 直接指定ticks。优先级高于is
        if(value === undefined){
            return this._values;
        }
        this._values = value;
        this._ticks = null;
        return this;
    }


    /** 刻度线长度 */
    tickLength(value: number): this;
    tickLength(): number;
    tickLength(value?: number){ // Number, 刻度长度
        if(value === undefined){
            return this._tickLength
        }
        this._tickLength = value
        return this
    }

    /** 字体大小，置为null则不显示刻度文字 */
    fontsize(value: number): this;
    fontsize(): number;
    fontsize(value?: number){ // Number, 字体大小，置为null则不显示刻度文字
        if(value === undefined){
            return this._fontsize;
        }
        this._fontsize = value;
        return this;
    }

    /** 字体显示格式 */
    tickFormat(value: (time: Date) => string): this;
    tickFormat(): (time: Date) => string;
    tickFormat(value?: (time: Date) => string){
        if(value === undefined){
            return this._tickFormat;
        }
        this._tickFormat = value;
        return this;
    }

    /**私有方法，不建议在外部调用 */
    private _year2date(year: number){ // 年份转化为Date对象，输入年份为Number类型
        let minus = year < 0;
        let year_str = Math.abs(year).toString();
        let date = new Date(
            (minus ? '-' : '') +
            '0'.repeat((minus ? 6 : 4) - year_str.length).concat(year_str)
        );
        date.setHours(0, 0, 0, 0);
        return date;
    }

    /**根据精度重新圈定范围 */
    private _updateDomain([t1, t2]: [Date, Date], num: number, unit: keyof typeof Tick.iterate, mode: "internal" | "external" = "internal"): [Date, Date]{
        t1 = new Date(t1);
        t2 = new Date(t2);

        if(unit.startsWith('y')){
            t1.setHours(0, 0, 0, 0);
            t2.setHours(0, 0, 0, 0);
            const y1 = mode === "internal" ? num * Math.ceil(t1.getFullYear()/num) : num * Math.floor(t1.getFullYear()/num);
            const y2 = mode === "internal" ? num * Math.ceil(t2.getFullYear()/num) : num * Math.floor(t2.getFullYear()/num);
            t1 = this._year2date(y1);
            t2 = this._year2date(y2);
        }
        else if(unit.startsWith('m')){
            t1 = new Date(
                t1.getFullYear(),
                t1.getMonth() + t1.getDate() === 1 ? 0 : 1,
                1,
                0,0,0,0
            );
            t2 = new Date(
                t2.getFullYear(),
                t2.getMonth(),
                1,
                0,0,0,0
            );
        }
        else if(unit.startsWith('d')){
            t1 = new Date(
                t1.getFullYear(),
                t1.getMonth(),
                t1.getDate(),
                0,0,0,0
            );
            t2 = new Date(
                t2.getFullYear(),
                t2.getMonth(),
                t2.getDate(),
                0,0,0,0
            );
        }
        else if(unit.startsWith('h')){
            t1 = new Date(
                t1.getFullYear(),
                t1.getMonth(),
                t1.getDate(),
                t1.getHours(),
                0,0,0
            );
            t2 = new Date(
                t2.getFullYear(),
                t2.getMonth(),
                t2.getDate(),
                t2.getHours(),
                0,0,0
            );
        }
        else if(unit.startsWith('M')){
            t1 = new Date(
                t1.getFullYear(),
                t1.getMonth(),
                t1.getDate(),
                t1.getHours(),
                t1.getMinutes(),
                0,0
            );
            t2 = new Date(
                t2.getFullYear(),
                t2.getMonth(),
                t2.getDate(),
                t2.getHours(),
                t2.getMinutes(),
                0,0
            );
        }
        else if(unit.startsWith('s')){
            t1 = new Date(
                t1.getFullYear(),
                t1.getMonth(),
                t1.getDate(),
                t1.getHours(),
                t1.getMinutes(),
                t1.getSeconds(),
                0
            );
            t2 = new Date(
                t2.getFullYear(),
                t2.getMonth(),
                t2.getDate(),
                t2.getHours(),
                t2.getMinutes(),
                t2.getSeconds(),
                0
            );
        }
        else{
            throw(`Invalid unit ${unit}`)
        }
        return [t1, t2];
    }

    /** 解析granularity */
    private _parseGranularity(granularity: string): [number, keyof typeof Tick.iterate] {
        let result = /([\.\d]+)([^\d]+)/.exec(granularity);
        if (result === null) {
            throw new Error("Code should never reach here");
        }
        let [_, _num, unit] = result;
        unit = unit.toLowerCase();
        if (!Object.keys(Tick.iterate).includes(unit)) {
            throw new Error(`Invalid granularity unit: ${unit}`);
        }
        let num = Number.parseFloat(_num);
        return [num, unit] as [number, keyof typeof Tick.iterate];
    }

    /**计算在指定scale下放大多少倍才能显示下ticks而不重叠 */
    _visibleThreshold(
        scale: ScaleTime, // 指定的scale
        existingBoundingBoxes: ScalableRectangle[]=[] // 已有的DOM元素的boundingBox。可以是前面level的ticks所形成的
    ){
        let ticks = this.getTicks(scale.domain() as any);
        let res: [number, number] = [0, 0];
        let rate = 1.5;
        let y = (this._tickLength as number) * rate;

        let lines: ScalableRectangle[] = ticks.map(tick=>{
            let x = scale(tick);
            return [
                [x, 0],
                [x, y],
                [false, false]
            ];
        });
        let texts: ScalableRectangle[] = ticks.map(tick=>{
            let cx = scale(tick);
            let width = svgTextLength.visualWidth(this._tickFormat(tick), this._fontsize);
            let height = svgTextLength.visualHeight(this._tickFormat(tick), this._fontsize);
            return [
                [cx - width / 2, 0],
                [cx + width / 2, height],
                [false, false]
            ];
        })

        /**如果最小的两个刻度之间的距离和刻度线长度之比大于一定值，则显示刻度线 */
        let minDistanceBetweenTicks = lines.length === 0 ?
            Infinity :
            Math.min(...new Array(lines.length - 1).fill(0).map((d,i)=>{
                return lines[i+1][0][0] - lines[i][0][0];
            }));
        res[0] = Math.max(this._tickLength * 0.3, 1) / Math.max(minDistanceBetweenTicks, 1e-6);

        /**如果文本之间有重叠，或者刻度不能显示，则文本不能显示 */
        let maxk = Math.max(
            ...texts.map((text, i)=>{
                let elements = existingBoundingBoxes;
                if(i > 0){
                    elements = elements.concat([texts[i-1]]);
                }
                if(i < texts.length - 1){
                    elements = elements.concat([texts[i+1]]);
                }
                return Math.max(...elements.map(elem=>overlapX(text, elem)));
            }),
            0
        )
        res[1] = Math.max(res[0], maxk);

        return {
            show: res,
            existingBoundingBoxes: lines.concat(texts).concat(existingBoundingBoxes)
        };
    }

    /**公有方法 */

    /**根据设定的参数获得实际的ticks值列表 */
    getTicks(domain: [Date, Date], mode: "internal" | "external" = "internal"){ // 获取ticks
        let [t1, t2] = domain;
        if(this._ticks !== null){
            return this._ticks;
        }
        else if(this._values !== undefined){
            let ticks = this._values
                .map(v => new Date(v))
                .filter(v => v >= t1 && v <= t2);
            return (this._ticks = ticks);
        }
        else if(this._filter !== undefined){
            let granularity = this._granularity || '1y';
            let [num, unit] = this._parseGranularity(granularity);
            let [t1, t2] = this._updateDomain(domain, num, unit, mode);
            let iter = Tick.iterate[unit];
            let ticks = []
            for(let t = t1; t <= t2; iter(t, num)){
                if(this._filter(t)){
                    ticks.push(new Date(t));
                }
            }
            return (this._ticks = ticks);
        }
        else if(this._every !== undefined){
            let [num, unit] = this._parseGranularity(this._every);
            let [t1, t2] = this._updateDomain(domain, num, unit, mode);
            let iter = Tick.iterate[unit];
            let ticks: Date[] = [];
            for(let t = t1; t <= t2; iter(t, num)){
                ticks.push(new Date(t));
            }
            return (this._ticks = ticks);
        }
        else{
            throw(`One of arguments "every", "filter", "values" must be configured`)
        }
    }

    /**计算ticks列表中这些ticks显示出来的放大倍数（后面ticks的放大倍数会强制不小于前面的） */
    static visibleThreshold(ticksList: Tick[], scale: ScaleTime){
        let existingBoundingBoxes: ScalableRectangle[] = []
        let resList: [number, number][] = [];
        let k = 0;
        ticksList.forEach((ticks, i)=>{
            let res = ticks._visibleThreshold(scale, existingBoundingBoxes);
            for(let i in res['show']){
                res['show'][i] = Math.max(res['show'][i], k);
                k = res['show'][i];

                ticks.tickVisibleK = res['show'][0];
                ticks.textVisibleK = k;
            }
            resList.push(res['show']);
            existingBoundingBoxes = existingBoundingBoxes.concat(res.existingBoundingBoxes);
        })
        return resList;
    }
}