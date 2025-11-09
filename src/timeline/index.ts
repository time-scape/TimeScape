import SingleLine from "./single";
import * as d3 from 'd3';
import { SubTimelineDatum, SubTimelineGroup, Transform } from "./types";
import gsap from "gsap";
import { bgcolor, color, GROUP_LABEL } from "../constants";
import { $emitter, $timeSelected } from "../store";
import Transform2D from "../labels/utils/transform2D";

interface Props {
    /** 时间轴标题 */
    title?: string;
    /** 时间轴子标题 */
    subtitle?: string;
    /** 时间轴布局总宽度 */
    totalWidth: number;
    /** 时间轴布局总高度（side === "bottom"的会沿着totalHeight最下方开始对齐） */
    totalHeight: number;
    /** 在侧边栏显示每个时间轴的名称 */
    showName: boolean;
    /** 时间轴参数 */
    timelines: SubTimelineDatum[];
    /** 时间轴分组 */
    groups: SubTimelineGroup[];
    /** 前景颜色 */
    color: string;
    /** 背景颜色 */
    bgcolor: string;
    /** 横坐标 */
    x: number;
    /** 纵坐标 */
    y: number;
    /** 侧边栏宽度 */
    nameListWidth: number;
    /** 侧边栏与时间轴的间距 */
    nameListInterval: number;
}

interface Emit {
    zoom(domain: [Date, Date]): void;
    brush(domain: [Date, Date] | null, type: "drag" | "end"): void;
}

export default class Timeline {
    
    private props: Props;
    private emit: Emit | null = null;

    private root: HTMLDivElement | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private svg: SVGSVGElement | null = null;
    private subTimelines: SingleLine[] = [];

    private groupDict: Record<string, number> = {};

    private stopPropagation: boolean = false;
    private zoomObj: d3.ZoomBehavior<any, unknown> | null = null;

    constructor(props: Partial<Props>) {
        this.props = Object.assign({
            title: '',
            subtitle: '',
            totalWidth: 600,
            totalHeight: 600,
            showName: false,
            timelines: [],
            groups: [],
            color: '#6f4922',
            bgcolor: '#ab8c70',
            x: 0,
            y: 0,
            nameListWidth: 0,
            nameListInterval: 0,
        }, props);

        this.initialize();
    }

    get height() {
        return this.props.timelines
            .map(t => t.height)
            .reduce((acc, d) => acc + d, 0);
    }

    get baseStrokeWidth() {
        return 1; // Math.max(1, this.width * 0.001)
    }

    get padding() {
        return this.baseStrokeWidth * 6;
    }

    // get prepared() {
    //     return this.props.timelines.length > 0 && this.props.groups.length > 0;
    // }

    get nameListBottom() {
        let timeline = this.props.timelines[this.props.timelines.length - 1];
        if (timeline === undefined) {
            return 0;
        } else if (timeline.name === null) {
            return this.getY(this.props.timelines.length - 1) + 1
                + (timeline.showBrush ? this.padding * 0.5 : 0);
        }
        return this.getY(this.props.timelines.length) + (timeline.showBrush ? this.padding * 0.5 : 0);
    }

    get timelineX() {
        if (this.props.showName) {
            return this.props.nameListWidth + this.props.nameListInterval;
        }
        return 0;
    }

    get timelineWidth() {
        return this.props.totalWidth - (this.props.showName ? (this.props.nameListWidth + this.props.nameListInterval) : 0);
    }

    public setRoot(root: HTMLDivElement) {
        this.root = root;
        let canvas = this.root.querySelector("canvas");
        if (canvas === null) {
            canvas = document.createElement("canvas");
            canvas.style.position = "absolute";
            this.root.appendChild(canvas);
        }
        this.canvas = canvas;

        let svg = this.root.querySelector("svg");
        if (svg === null) {
            svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.style.position = "absolute";
            this.root.appendChild(svg);
        }
        this.svg = svg;

        this.listenZoom();
        return this;
    }
    
    public setEmit(emit: Emit) {
        this.emit = emit;
        return this;
    }

    zoomEvent(value: Transform | [Date, Date], duration: number = 0) {
        let domain: [Date, Date];

        // transform
        if (value instanceof Array) {
            domain = value as [Date, Date];
        }
        // domain
        else { // if (value instanceof Array) {
            domain = this._transform2domain(value)!;
        }

        if (duration === 0) {
            this._scaleEvent(domain);
        }
        else {
            let group = this.props.groups.find(g => g.effect === GROUP_LABEL);
            if (group === undefined) return;
            let oldDomain = group.scale.domain();
            d3.transition()
                .duration(duration)
                .tween('zoom', () => {
                    let i0 = d3.interpolateDate(oldDomain[0], domain[0]);
                    let i1 = d3.interpolateDate(oldDomain[1], domain[1]);
                    return (t: number) => {
                        this._scaleEvent([i0(t), i1(t)]);
                    }
                })
        }
    }

    /** 外部缩放事件 */
    public zoom(value: Transform | [Date, Date]) {
        this.stopPropagation = true;
        this.zoomObj!.transform(d3.select(this.root!), value instanceof Array ? this._domain2transform(value)! : value);
    }

    listenZoom() {
        const width = this.props.totalWidth;
        const height = this.props.totalHeight;
        this.zoomObj = d3.zoom<any, unknown>()
                    .scaleExtent([1, Infinity])
                    .extent([[0, 0], [width, height]])
                    .translateExtent([[0, 0], [width, height]]) 
                    .on('zoom', (event) => {
                        this.zoomEvent(event.transform);
                        if (!this.stopPropagation) this.emit?.["zoom"](this._transform2domain(event.transform)!);
                        this.stopPropagation = false;
                    })
        d3.select(this.root!)
            .call(this.zoomObj);

        $emitter.on("book-mark", ((transform: Transform2D) => {
            const tf = d3.zoomIdentity
                .translate(transform.x, transform.y)
                .scale(transform.kx);
            const tf0 = d3.zoomTransform(this.root!);
            const tl = gsap.timeline();
            const outer = this;
            tl.to(tf0, {
                ...tf,
                duration: 0.8,
                onUpdate() {
                    const domainX = outer._transform2domain(tf0)!;
                    outer._scaleEvent(domainX);
                }
            });
        }) as any);
    }

    /** 初始化。主要是更新初始刷选状态和构建子时间轴类的实例 */
    public initialize() {
        this._initializeState();
        this._initializeSubTimelines();
        this._initializeGroupDict();
    }

    public updateContainer() {
        const root = this.root!;
        const canvas = this.canvas!;
        const svg = this.svg!;
        const scale = 2; // window.devicePixelRatio || 1;
        
        root.style.transform = `translate(${this.props.x}px, ${this.props.y}px)`;
        canvas.width = this.props.totalWidth * scale;
        canvas.height = this.props.totalHeight * scale;
        canvas.style.width = `${this.props.totalWidth}px`;
        canvas.style.height = `${this.props.totalHeight}px`;

        /** 特殊判断 */
        const h = Math.max(8, this.props.totalHeight * 0.007);
        svg.style.top = this.getY(0) - h * 0.5 + "px";
        svg.style.width = `${this.props.totalWidth}px`;
        svg.style.height = `${h}px`;


        const ctx = canvas.getContext('2d')!;
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
    }

    public renderSubTimeline(ctx: CanvasRenderingContext2D, subTimeline: SingleLine) {
        subTimeline.setContext(ctx).render();
    }

    public render() { 
        const canvas = this.canvas;
        if (canvas === null) {
            return;
        }
        const ctx = canvas.getContext('2d')!;
        this.updateContainer();

        const subTimelines = this.subTimelines;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (let i = 0, n = subTimelines.length; i < n; ++i) {
            const subTimeline = subTimelines[i];
            const props = subTimeline.props;
            ctx.save();
            ctx.translate(props.translateX, props.translateY);
            this.renderSubTimeline(ctx, subTimeline);
            ctx.restore();
        }
    }

    public renderBrush() {
        const svg = d3.select(this.svg!);
        const timeSelected = $timeSelected.get();
        const scaleX = this.props.groups.find(g => g.effect === GROUP_LABEL)!.scale;
        const h = Math.max(8, this.props.totalHeight * 0.007);
        svg.style("cursor", "crosshair");

        let container = svg.select<SVGGElement>("g.brush-container");
        if (container.empty()) {
            container = svg.append("g").attr("class", "brush-container");
        }
        container.selectAll("*").remove();

        let x1: number, x2: number;
        const circleDrag = d3.drag<SVGCircleElement, number>()
            .on("drag", (event, d) => {
                console.log("drag", d);
                const cx = getX(event);
                d === 0 ? x1 = cx : x2 = cx;
                render([x1, x2]);
            })
            .on("end", (event, d) => {
                const cx = getX(event);
                d === 0 ? x1 = cx : x2 = cx;
                render([x1, x2]);
                if (x1 > x2) {
                    const temp = x1;
                    x1 = x2;
                    x2 = temp;
                }
                const ts = [x1, x2].map(x => scaleX.invert(x)) as [Date, Date];
                this.emit!["brush"](ts, "end");
            });
        const render = (xs?: [number, number]) => {
            const group = this.props.groups.find(g => g.effect === GROUP_LABEL)!;
            const ts = xs ? xs.map(x => scaleX.invert(x)) as [Date, Date] : null;
            group.brushDomain = ts;
            for (let t of group.timelines) {
                const timeline = this.subTimelines[t.idx];
                timeline.props.showMask = xs !== undefined;
                timeline.props.brushDomain = ts;
            }
            this.render();

            if (xs === undefined) {
                container.selectAll("*").remove();
                return null;
            }
            
            let rect = container.select<SVGRectElement>("rect.brush-rect");
            if (rect.empty()) {
                rect = container.append("rect").attr("class", "brush-rect");
                rect.attr("fill", bgcolor);
            }
            rect.attr("x", Math.min(xs[0], xs[1]))
                .attr("y", 0)
                .attr("width", Math.abs(xs[1] - xs[0]))
                .attr("height", h);
            return container.selectAll<SVGCircleElement, number>("circle.brush-handle")
                .data([0, 1])
                .join("circle")
                .attr("class", "brush-handle")
                .attr("fill", "#fff")
                .attr("stroke", bgcolor)
                .attr("stroke-width", "1")
                .attr("r", "4")
                .attr("cx", d => xs[d])
                .attr("cy", h / 2)
                .style("cursor", "pointer")
                .call(circleDrag);
        };

        if (timeSelected !== null) {
            x1 = scaleX(timeSelected[0]);
            x2 = scaleX(timeSelected[1]);
            render([x1, x2]);
        }

        const getX = (event: MouseEvent) => {
            return Math.min(Math.max(0, event.x), this.timelineWidth);
        };
        
        const drag = d3.drag<SVGSVGElement, unknown>()
            .on("start", (event) => {
                x1 = x2 = getX(event);
            })
            .on("drag", (event) => {
                x2 = getX(event);
                render([x1, x2]);
            })
            .on("end", (event) => {
                x2 = getX(event);
                if (x1 === x2) {
                    render(undefined);
                    this.emit!["brush"](null, "end");
                    return;
                }
                render([x1, x2]);
                if (x1 > x2) {
                    const temp = x1;
                    x1 = x2;
                    x2 = temp;
                }
                const ts = [scaleX.invert(x1), scaleX.invert(x2)] as [Date, Date];
                this.emit!["brush"](ts, "end");
            });
        svg.call(drag);
        // svg.on("click", () => {
        //     this.emit!["brush"](null, "end");
        // });
    }

    private getX(i: number) {
        return this.timelineX;
    }

    private getY(i: number) {
        let side = this.props.timelines[i].side;
        if (side === "top") {
            return this.props.timelines.slice(0, i)
                .filter(t => t.side === 'top')
                .map(d => d.height)
                .reduce((acc, d) => acc + d, 0);
        }
        else {
            return this.props.totalHeight -
                this.props.timelines.slice(i)
                    .filter(t => t.side === 'bottom')
                    .map(d => d.height)
                    .reduce((acc, d) => acc + d, 0);
        }
    }

    /** 内部刷选事件 */
    private _brushEvent(name: string, domain: [Date, Date] | null, type: "drag" | "end") {
        let timeline = this.props.timelines.find(t => t.name === name);
        if (timeline === undefined) return;

        // this.subTimelines[timeline.idx].updateBrushDomain(domain);

        /**改变被刷选的时间轴的scale */
        const group = timeline.g!;
        group.brushDomain = domain;
        group.timelines.forEach((t) => {
            this.subTimelines[t.idx].renderMask();
        });

        /**改变被刷选的时间轴的scale */
        // let group = timeline.g!;
        // group.scale = group.scale.copy().domain(domain);

        // /**更新刷选时间轴的brush和mask */
        // timeline.g!.brushDomain = domain;

        if (group.effect === GROUP_LABEL) {
            this.emit!["brush"](domain, type);
        }
    }

    /** 内部缩放事件 */
    private _zoomEvent(name: string, transform: Transform) {
        let timeline = this.props.timelines.find(t => t.name === name);
        if (timeline === undefined) return;
        let group = timeline.g!;

        let domain = transform.rescaleX(group.originScale as any).domain();

        group.scale = group.scale.copy().domain(domain);
        timeline.g!.timelines.forEach((t) => {
            this.subTimelines[t.idx].updateScale(group.scale);
            // this.subTimelines[t.idx].zoomEvent(transform, false);
        });
        if (group.effect === GROUP_LABEL) {
            this.emit!["zoom"](domain);
        }
    }

    private _scaleEvent(domain: [Date, Date]) {
        /** 改变直接相关的时间轴scale */
        let group = this.props.groups.find(g => g.effect === GROUP_LABEL);
        group!.scale = group!.scale.copy().domain(domain);

        /** 改变刷选相关的时间轴scale */
        let group2 = this.props.groups.find(g => g.effect === group!.id);
        if (group2 !== undefined) {
            group2.brushDomain = domain;
        }

        /** 渲染 */
        group!.timelines.forEach((t, i) => {
            this.subTimelines[t.idx].updateScale(group!.scale);
        });
        this.render();
        this.renderBrush();
    }

    private _transform2domain(transform: Transform, group?: SubTimelineGroup) {
        group = group || this.props.groups.find(g => g.effect === GROUP_LABEL);
        if (group === undefined) {
            return null;
        }
        return transform.rescaleX(group.originScale as any).domain();
        // return group.scale.range().map(d => {
        //     return transform.invertX(d);
        // }).map(d => {
        //     return group!.originScale.invert(d);
        // }) as [Date, Date];
    }

    private _domain2transform(domain: [Date, Date], group?: SubTimelineGroup) {
        group = group || this.props.groups.find(g => g.effect === GROUP_LABEL);
        if (group === undefined) {
            return null;
        }

        let x = domain.map(d => (group!.originScale as any)(d));
        let y = group!.originScale.range();

        let k = (y[1] - y[0]) / (x[1] - x[0]);
        let b = (y[0] + y[1] - k * (x[0] + x[1])) / 2;

        return d3.zoomIdentity
            .translate(b, 0)
            .scale(k);
    }

    private _initializeState() { // 初始状态下如果已经刷选，则更新到刷选状态
        this.props.groups.forEach((group: SubTimelineGroup, i) => {
            let [t1, t2] = group.scale.domain();
            let [t1p, t2p] = group.domain;
            if (t1.getTime() !== t1p.getTime() || t2.getTime() !== t2p.getTime()) {
                /**改变被刷选的时间轴的scale */
                group.scale = group.scale.copy().domain(group.domain);

                /**更新刷选时间轴的brush和mask */
                let gf = this.props.groups.find(g => g.effect === group.id);
                gf && (gf.brushDomain = group.domain)

                if (group.effect === GROUP_LABEL) {
                    this.emit!["zoom"](group.domain);
                }
            }
        });
    }

    private _initializeSubTimelines() {
        const outer = this;
        this.subTimelines = this.props.timelines.map((timeline, i) => {
            const d = {
                name: timeline.name,
                groupId: timeline.groupId,
                group: timeline.group,
                scale: timeline.g!.scale,
                originScale: timeline.g!.originScale,
                brushDomain: timeline.g!.brushDomain,
                width: this.timelineWidth,
                height: timeline.height,
                init: timeline.init,
                ticks: timeline.ticks,
                ticksRenderer: timeline.ticksRenderer,
                labels: timeline.labels,
                labelsRenderer: timeline.labelsRenderer,
                scalable: timeline.g!.scalable,
                showBrush: timeline.showBrush && timeline.g!.brush,
                showMask: false, // timeline.showMask || timeline.showMask === undefined,
                maskType: "brush",//timeline.maskType,
                translateX: this.getX(i),
                translateY: this.getY(i),
                // transform: this.getTransform(i),
                color: this.props.color,
                bgcolor: this.props.bgcolor,
                baseStrokeWidth: this.baseStrokeWidth,
                brushHeight: this.padding,
                brushWidth: this.padding,
            };
            return new SingleLine(d, {
                brush(name: string, domain: [Date, Date], type) {
                    outer._brushEvent.call(outer, name, domain, type);
                },
            }, {
                getSingleTimeline(name) {
                    return outer.subTimelines.find(t => t.props.name === name);
                }
            });
        });
    }

    private _initializeGroupDict() {
        this.props.groups.forEach((group, i) => {
            this.groupDict[group.id] = i;
        });
    }
}