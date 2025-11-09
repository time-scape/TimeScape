import * as d3 from 'd3';
import Tick from "./timeline-tick";
import Label from "./timeline-label";
import { ScaleTime, SubTimelineGroup } from "../types";

interface TimelineProps {
    /** 时间轴名称，用于区分不同时间轴 */
    name: string | null,
    /** 时间轴分组 */
    groupId: string,
    /** 时间轴分组对象 */
    group: SubTimelineGroup,
    /** 比例尺，会随着交互而改变 */
    scale: ScaleTime | null,
    /** 原始比例尺，数值不会改变 */
    originScale: ScaleTime | null,
    /** 刷选的时间域，会随着交互改变 */
    brushDomain: [Date, Date] | null,
    /** 坐标 */
    translateX: number,
    translateY: number,
    // transform: string,
    /** 时间轴宽度 */
    width: number,
    /** 时间轴高度 */
    height: number,
    /** 自定义初始化（返回结果会写入SubTimeline的context中） */
    init?: () => any,
    /** 刻度如何显示，从上往下level逐渐增高。如果置为空数组则不采用刻度 */
    ticks: Tick[],
    /** 自定义的渲染刻度函数（优先级高于ticks） */
    ticksRenderer?: (this: SingleLine, ctx: CanvasRenderingContext2D, scale: d3.ScaleTime<number, number>) => void,
    /** 标签如何显示，从上往下level逐渐增高。如果为空数组则不采用标签 */
    labels: Label[][],
    /** 自定义的渲染标签函数（优先级高于labels） */
    labelsRenderer?: (this: SingleLine, ctx: CanvasRenderingContext2D, scale: d3.ScaleTime<number, number>) => void,
    /** 是否可缩放 */
    scalable: boolean,
    /** 显示刷选框。不显示无法进行刷选交互 */
    showBrush: boolean,
    /** 为当前显示范围增加阴影 */
    showMask: boolean,
    /** 如何绘制阴影（brush表示当前brushDomain，domain表示当前组设置了showBrush=true的元素的brushDomain） */
    maskType: "brush" | "domain",
    /** 时间轴粗细。设置为undefined则采用默认的 */
    timelineStrokeWidth?: number,
    /** 前景颜色 */
    color: string,
    /** 背景颜色 */
    bgcolor: string,
    /** 基准画线粗细 */
    baseStrokeWidth: number,
    /** 刷选框粗细 */
    brushHeight: number,
}
interface Emit {
    brush(name: string | null, domain: [Date, Date] | null, type: "drag" | "end"): void,
}

interface Accessor {
    getSingleTimeline(name: string): SingleLine | undefined,
}

export default class SingleLine {

    props: TimelineProps;

    /** 放大倍数 */
    k: number = 1;
    /** 是否阻止zoom事件的传播 */
    stopPropagation: boolean = false;
    /** zoom对象 */
    zoom: d3.ZoomBehavior<Element, any> | null = null;
    /** 消息发送 */
    emit: Emit;
    /** 渲染上下文 */
    ctx: CanvasRenderingContext2D | null = null;

    /** 自定义上下文 */
    context: any = {};

    /** 访问器 */
    accessor: Accessor;

    constructor(props: Partial<TimelineProps>, emit: Emit, accessor: Accessor) {
        this.props = Object.assign({
            name: '',
            groupId: '',
            group: {} as any,
            scale: null,
            originScale: null,
            brushDomain: null,
            translateX: 0,
            translateY: 0,
            width: 300,
            height: 80,
            ticks: [],
            labels: [],
            scalable: true,
            showBrush: false,
            showMask: true,
            maskType: 'brush',
            // timelineStrokeWidth: null,
            color: '#6f4922',
            bgcolor: '#ab8c70',
            baseStrokeWidth: 1,
            brushHeight: 6,
        }, props);
        
        this.emit = emit;
        this.accessor = accessor;
        this.context = this.props.init?.call(this);

        this.calculateTicksVisible();
        this.calculateLabelsVisible();
    }

    /** 时间轴左右的padding（受刷选框的圆点大小影响） */
    get padding() {
        return this.props.showBrush ? this.props.brushHeight * 0.5 : this.props.baseStrokeWidth * 0.5;
    }
    /** 时间轴占据的宽度（受刷选框的圆点大小影响） */
    get innerWidth() {
        return this.props.width;
    }
    /** 时间轴占据的高度（受刷选框的圆点大小影响） */
    get innerHeight() {
        return this.props.height - this.props.baseStrokeWidth;
    }
    /** 当前刷选框的范围 */
    get brushRange() {
        if (this.props.scale === null) {
            return [0, this.innerWidth];
        }
        if (this.props.brushDomain === null) {
            return [0, this.innerWidth];
        }
        return this.props.brushDomain!.map(d => this.props.scale!(d));
    }
    /** 刷选框的最大范围 */
    get brushMaxRange() {
        return [0, this.innerWidth];
    }
    /** 可显示的ticks */
    calculateTicksVisible() {
        let scale = this.props.originScale;
        if (scale === null) {
            return [];
        }
        return Tick.visibleThreshold(this.props.ticks, scale);
    }
    /** 可显示的labels */
    calculateLabelsVisible() {
        let scale = this.props.originScale;
        if (scale === null) {
            return [];
        }
        if (this.props.labels.length === 0) return [];
        // this.props.labels[0][0].
        return this.props.labels.map(labels => Label.visibleThreshold(
            labels, scale!, [], [1, Infinity]
        ));
    }

    setContext(ctx: CanvasRenderingContext2D) {
        this.ctx = ctx;
        return this;
    }

    brushEvent(domain: [Date, Date] | null, type: "drag" | "end" = "end") {
        this.props.brushDomain = domain;
        this.props.showMask && this.renderMask();
        this.emit["brush"](this.props.name, domain, type);
    }

    renderTicks() {
        const ctx = this.ctx;
        if (ctx === null) return;

        ctx.save();

        const scale = this.props.scale;
        if (scale === null) throw new Error('scale is null');

        if (this.props.ticksRenderer) {
            this.props.ticksRenderer.call(this, ctx, scale!);
            ctx.restore();
            return;
        }

        const ticks = this.props.ticks;
        if (ticks.length === 0) {
            ctx.restore();
            return;
        }
        const k = this.k;
        const [t1, t2] = scale.domain();
        for (let level = 0, nLevel = ticks.length; level < nLevel; level++) {
            const tickLevel = ticks[level];
            const tickVisible = tickLevel.tickVisibleK <= k;
            if (!tickVisible) continue;
            const data = tickLevel.getTicks(scale.domain() as [Date, Date]);
            let s = 0, e = data.length;
            if (data.length > 0) {
                s = Math.max(0, this._binarySearchLeft(data, t1));
                e = Math.min(data.length, this._binarySearchRight(data, t2));
            }

            for (let i = s; i < e; i++) {
                const t = data[i];
                const tickLength = tickLevel.tickLength();
                const color = this.props.color;
                const strokeWidth = this.props.baseStrokeWidth;
                ctx.save();
                ctx.translate(scale(t), 0);
                ctx.strokeStyle = color;
                ctx.lineWidth = strokeWidth;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(0, tickLength);
                ctx.stroke();
                ctx.closePath();

                if (tickLevel.textVisibleK <= k && tickLevel.fontsize() > 0) {
                    const text = tickLevel.tickFormat()(t);
                    ctx.fillStyle = color;
                    ctx.font = `${tickLevel.fontsize()}px Source`;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "hanging";
                    ctx.fillText(text, 0, tickLength);
                }

                ctx.restore();
            }
        }

        ctx.restore();
    }

    renderLabels() {
        const ctx = this.ctx;
        if (ctx === null) return;

        ctx.save();

        const scale = this.props.scale;
        if (scale === null) throw new Error('scale is null');

        if (this.props.labelsRenderer) {
            this.props.labelsRenderer.call(this, ctx as any, scale!);
            ctx.restore();
            return;
        }

        const labels = this.props.labels;
        const k = this.k;
        for (let level = 0, nLevel = labels.length; level < nLevel; level++) {
            const labelList = labels[level];
            for (let i = 0, nLabel = labelList.length; i < nLabel; i++) {
                const label = labelList[i];
                const visibleK = label.visibleK;
                const tickFunc = label.tick();
                const visible = visibleK[0] <= k && k <= visibleK[1];
                tickFunc?.(ctx, scale, label, { opacity: visible ? 1 : 0.3 });
                if (visible) {
                    label.render(ctx, scale);
                }
            }
        }

        ctx.restore();
    }

    renderMask() {
        if (this.props.showMask === false) return;

        const ctx = this.ctx;
        if (ctx === null) return;

        ctx.save();
        
        let x1: number, x2: number;
        if (this.props.maskType === 'brush') {
            [x1, x2] = this.brushRange;
        }
        else { // this.props.maskType === 'domain'
            const t = this.props.group.timelines.find(t => t.showMask);
            if (t === undefined) {
                throw new Error('no timeline with showMask = true');
            }
            const timeline = this.accessor.getSingleTimeline(t.name!)!;
            if (timeline.props.brushDomain === null) {
                ctx.restore();    
                return;
            }
            [x1, x2] = timeline.brushRange;
        }
        ctx.fillStyle = this.props.bgcolor;
        ctx.globalAlpha = 0.1;
        ctx.fillRect(x1, 0, x2 - x1, this.innerHeight);

        ctx.restore();
    }

    renderBackground() {
        const ctx = this.ctx;
        if (ctx === null) return;
        ctx.save();
        
        /** 背景 */
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, this.props.width, this.props.height);

        /** 时间线 */
        ctx.strokeStyle = this.props.color;
        ctx.lineWidth = this.props.timelineStrokeWidth || this.props.baseStrokeWidth;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(this.innerWidth, 0);
        ctx.stroke();

        ctx.restore();
    }

    render(initialize: boolean = true) {

        const ctx = this.ctx;
        if (ctx === null) return;

        ctx.save();
        ctx.clearRect(0, 0, this.props.width, this.props.height);
        /** 渲染时间线和背景 */
        this.renderBackground();

        /** 渲染刻度 */
        this.renderTicks();

        /** 渲染标签 */
        initialize && this.renderLabels();

        /** 渲染刷选框 */
        this.props.showMask && this.renderMask();

        ctx.restore();
    }

    updateScale(scale: ScaleTime) {
        let d1 = scale.domain().map(d => Number(d));
        let d2 = this.props.scale!.domain().map(d => Number(d));
        if(d1[0] === d2[0] && d1[1] === d2[1]) {
            return;
        }
        this.props.scale = scale;

        let originDomain = this.props.originScale!.domain();
        let domain = this.props.scale!.domain();
        this.k = (originDomain[1].getTime() - originDomain[0].getTime()) / (domain[1].getTime() - domain[0].getTime());
    }

    private _domain2transform(domain: [Date, Date]) {
        let x = domain.map(d => this.props.originScale!(d));
        let y = this.props.originScale!.range();

        let k = (y[1] - y[0]) / (x[1] - x[0]);
        let b = (y[0] + y[1] - k * (x[0] + x[1])) / 2;

        return d3.zoomIdentity
            .translate(b, 0)
            .scale(k);
    }

    /** 找到小于等于target的最大索引 */
    private _binarySearchLeft<T>(arr: T[], target: T) {
        let left = 0;
        let right = arr.length - 1;
        let ans = -1;
        while (left <= right) {
            let mid = Math.floor((left + right) / 2);
            if (arr[mid] <= target) {
                ans = mid;
                left = mid + 1;
            }
            else {
                right = mid - 1;
            }
        }
        return ans;
    }
    /** 找到大于等于target的最小索引 */
    private _binarySearchRight<T>(arr: T[], target: T) {
        let left = 0;
        let right = arr.length - 1;
        let ans = arr.length;
        while (left <= right) {
            let mid = Math.floor((left + right) / 2);
            if (arr[mid] < target) {
                left = mid + 1;
            }
            else {
                ans = mid;
                right = mid - 1;
            }
        }
        return ans;
    }
}