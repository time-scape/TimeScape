import { EventTypeGlyph, FigureTypeGlyph, LocationIcon } from "../components";
import { bgcolor, capitals, color, domainX, getEmptyLocation, light_bgcolor, locationColorMap, resolution } from "../../constants";
import { Event, Figure, Location, Post, ScaleLinear, ScaleTime } from "../types";
import { $figuresClicked, $figureHovered, $locationSelected, $figureContexts, $figuresSelected, $figuresSelectedColorMap, $eventSelected, $timeSelected, $figureLocationInfos, $figuresTimeSelected, $figureId2index, $viewMode, $statusIcon, $locationLine } from "../../store";
import { Text, Container, Graphics } from "pixi.js";
import { figureContext } from "../../utils/similarity";
import * as ps from "../utils/pixi-selector";
import * as ks from "../utils/konva-selector";
import histogramYear from "../utils/pixi-selector/histogram";
import { Relation } from "../../types";
import Interval from "../utils/Interval";
import SVGTextManager from "../../utils/SVGTextManager";
import Konva from "konva";
import drag from "../utils/drag";
import Labels from "..";
import { SVGTextLength } from "../utils";
import PostParser from "../../utils/PostParser";
import * as d3 from "d3";
import EarthCoordinate from "../../utils/EarthCoordinate";

const svgTextLength = new SVGTextLength();

type PosX = {
    x: number;
    width: number;
}
type PosY = {
    y: number;
    height: number;
}
type RenderConfig = {
    mask: boolean;
    border?: boolean;
    name?: PosX & PosY & { context?: ReturnType<typeof figureContext> };
    selectedFiguresBar?: PosY & { context?: ReturnType<typeof figureContext> };
    statusIcon?: PosX & PosY & { forceFlush?: boolean };
    locationIcon?: PosX & PosY & { forceFlush?: boolean };
    line?: PosY;
    description?: PosY;
    locationAreaChart?: PosY;
    eventLine?: PosY;
    relationBar?: PosY;
    locationLine?: PosY & { forceFlush: boolean };
    postLine?: PosY;
    events?: PosY;
}

/** ==============测试用================= */
const LOG = console.log;
/** ==================================== */

const eventFontSize = 12;
const eventLineHeight = eventFontSize * 1.2;

/** 监听ctrlKey有没有被按下  */
let ctrlKey = false;
window.addEventListener("keydown", (e) => {
    if (e.key === "Control") {
        ctrlKey = true;
    }
});
window.addEventListener("keyup", (e) => {
    if (e.key === "Control") {
        ctrlKey = false;
    }
});


/**
 * 标签类
 * 
 * 标签的宽高有三种（以宽为例）：
 * @description this.position.x2 - this.position.x1: 在当前缩放尺度下的理论宽度，是由布局自然导出的；
 * @description this.idealWidth: 理想宽度，在当前缩放比例下当前标签希望被分配到的宽度，通常是线性递增的，由updateScale赋值；
 * @description this.width: 实际宽度，受到实际显示的内部内容影响，且一定不大于理想宽度。该值在不同的语义缩放等级之间并不一定是线性递增的，由语义缩放模块赋值；
 */
export default class Label {

    /** 人物数据 */
    datum: Figure;
    /** 人物在原始数据中的索引 */
    index: number;

    /**
     * 标签组类
     * @access 慎用该变量，可能破坏全局
     * @description 目前使用该变量的地方有：
     * @description 1. focus方法，用来在全局布局中定位并移动到该标签的实际位置
     */
    labels: Labels;

    /** PIXI对象 */
    container: Container;
    /** cpu context */
    group: Konva.Group;

    /** 
     * 初始布局位置
     * * 只会被布局算法设置
     * * 在应用scale之前设置，使用的是constants.domainX和constants.domainY范围内的值
     */
    initialPosition: {
        x1: number;
        x2: number;
        y1: number;
        y2: number;
    } = {} as any;

    /** 上一次布局位置
     * * 调用updateScale后会将之前的位置保存到这里，以便应用动画
     */
    lastPosition: {
        x1: number;
        x2: number;
        y1: number;
        y2: number;
    } = {} as any;
    /**
     * 布局位置
     * * x2和y2是理论位置，主要用来控制语义缩放，实际上的大小由this.width和this.height决定
     */
    position: {
        x1: number;
        x2: number;
        y1: number;
        y2: number;
    } = {} as any;

    /** 固定的位置和大小（针对不随缩放改变的元素） */
    fy?: number;
    fHeight?: number;

    /** 横向时间轴比例尺 */
    scaleX?: ScaleTime;

    /**
     * 渲染图层编号
     * * 由采样算法生成和赋值，主要决定了渲染在前景（0），还是只是当做背景（1+）暗示这里还有人物
     */
    level: number = 0;

    /** 不透明度 */
    get alpha() {
        return this.container.alpha;
    }
    set alpha(value: number) {
        this.container.alpha = value;
        this.group.opacity(value);
    }

    /** 是否可见 */
    get visible() {
        return this.container.visible;
    }
    set visible(value: boolean) {
        this.container.visible = value;
        this.group.visible(value);
    }

    /** 标签的实际权重（在0-1之间）  */
    weight: number = 0;

    __baseSize__?: number;

    static getBaseSize(label: Label) {
        return Math.max(Math.pow(label.weight, 0.3) * 25, 12);
    }
    /**
     * 基础大小
     * * 主要由人物的权重决定
     */
    get baseSize() {
        if (this.__baseSize__ === undefined) {
            this.__baseSize__ = Label.getBaseSize(this);
        }
        return this.__baseSize__;
    }

    /**
     * 理想宽度
     * * 即为在当前缩放比例下当前标签希望被分配到的宽度
     * * 最终实际宽度可能会受到内部元素的实际宽度的影响，但一定会小于等于这个值
     * * 由updateScale负责更新
     */
    idealWidth: number;
    /**
     * 理想高度
     * * 即为在当前缩放比例下当前标签希望被分配到的高度
     * * 最终实际高度可能会受到内部元素的实际高度的影响，但一定会小于等于这个值
     * * 由updateScale负责更新
     */
    idealHeight: number;

    /** 
     * 实际渲染宽度
     * * 由语义缩放模块计算并赋值
     * * 采样算法使用的是这个值
     */
    width: number;
    /**
     * 实际渲染高度
     * * 由语义缩放模块计算并赋值
     * * 采样算法使用的是这个值
     */
    height: number;

    /** 上一次的实际渲染宽度 */
    lastWidth: number;
    /** 上一次的实际渲染高度 */
    lastHeight: number;

    /** 其他数据 */
    locations: Location[];
    posts: Post[];
    relations: Relation[];
    events: Event[];
    texts: SVGTextManager[];
    shortTexts: SVGTextManager[];
    eventTextWidths: { w: number; ws: number }[];
    name: SVGTextManager;
    shortDescription: SVGTextManager;


    constructor(datum: Figure, index: number, labels: Labels) {
        this.datum = datum;
        this.index = index;
        this.labels = labels;

        const baseSize = this.baseSize;
        this.width = baseSize * this.datum.name.length;
        this.height = baseSize;
        this.idealWidth = this.width;
        this.idealHeight = this.height;
        this.lastWidth = this.width;
        this.lastHeight = this.height;
        this.container = new Container();
        this.group = new Konva.Group();

        this.locations = datum.locations.filter(location => location.time !== null);
        if (datum.birthplace && (this.locations.length === 0 || this.locations[0].id !== datum.birthplace.id)) {
            this.locations.unshift(datum.birthplace);
        }
        this.posts = datum.posts.filter(post => post.time !== null);
        this.relations = datum.relations.filter(relation => relation.time !== null);
        this.events = datum.events.filter(event => event.time !== null);
        this.texts = this.events.map(event => {
            const manager = new SVGTextManager(event.description, eventFontSize, "Source");
            manager.lineHeight = eventLineHeight;
            return manager;
        });
        this.shortTexts = this.events.map(event => {
            const manager = new SVGTextManager(event.short_description, eventFontSize, "Source");
            manager.lineHeight = eventLineHeight;
            return manager;
        });
        this.eventTextWidths = this.events.map((e, i) => {
            const t = this.texts[i];
            const { width: w } = t.idealRectangle(1.5, 200, Infinity);
            const ts = this.shortTexts[i];
            const { width: ws } = ts.idealRectangle(1.5, 200, Infinity);
            return {
                w,
                ws,
            };
        });

        this.shortDescription = new SVGTextManager(datum.description, baseSize, "Source");
        this.shortDescription.lineHeight = eventLineHeight - 1e-6;
        this.name = new SVGTextManager(datum.name, baseSize);
        this.initialize();
    }

    initialize() {}

    listenSelectInteraction(container: Container) {
        container.cursor = "pointer";
        container.on("mouseenter", (e) => {
            // 判断一下e.nativeEvent.target是不是一个canvas（似乎是pixi的bug）
            if (e.nativeEvent.target === null || (e.nativeEvent.target as any).tagName !== "CANVAS") {
                return;
            }
            if (this.level > 0) return;
            $figureHovered.set(this.datum);
        });
        container.on("mouseleave", (e) => {
            // 判断一下e.nativeEvent.target是不是一个canvas（似乎是pixi的bug）
            if (e.nativeEvent.target === null || (e.nativeEvent.target as any).tagName !== "CANVAS") {
                return;
            }
            if (this.level > 0) return;
            $figureHovered.set(null);
        });
        
        function onClick(this: Label) {
            const index = $figuresClicked.value.findIndex(figure => figure.id === this.datum.id);
            if (index === -1) {
                $figuresClicked.set([...$figuresClicked.value, this.datum]);
            }
            else {
                const newFigures = [...$figuresClicked.value];
                newFigures.splice(index, 1);
                if (newFigures.length === 0 && $viewMode.get() === "focused") {
                    $viewMode.set("global");
                }
                $figuresClicked.set(newFigures);
            }
        }

        function onDoubleClick(this: Label) {
            const index = $figuresClicked.get().findIndex(figure => figure.id === this.datum.id);
            if (index === -1) {
                $figuresClicked.set([...$figuresClicked.value, this.datum]);
            }
            $viewMode.set($viewMode.get() === "global" ? "focused" : "global");
        }

        let clickTimer: ReturnType<typeof setTimeout> | null = null;
        const delay = 300;
        container.on("click", (e) => {
            // if (this.level > 0) return;
            // 判断一下e.nativeEvent.target是不是一个canvas（似乎是pixi的bug）
            if (e.nativeEvent.target === null || (e.nativeEvent.target as any).tagName !== "CANVAS") {
                return;
            }
            if (clickTimer) {
                clearTimeout(clickTimer);
                clickTimer = null;
                onDoubleClick.call(this);
            }
            else {
                clickTimer = setTimeout(() => {
                    clickTimer = null;
                    onClick.call(this);
                }, delay);
            }
        });
        container.eventMode = "static";
    }

    public render(config: RenderConfig) {

        this.updatePosition();

        const statusIcon = $statusIcon.get();
        // this.renderMask(config.mask, config);
        this.renderRelatedFigureBackground();
        // this.renderDraggableBorder(config.mask);
        this.renderBorder(config.border);
        this.renderName(config.name);
        this.renderSelectedFiguresBar(config.selectedFiguresBar);
        this.renderStatusIcon(statusIcon === "status" ? config.statusIcon : undefined);
        this.renderLocationIcon(statusIcon === "location" ? config.statusIcon : undefined);
        this.renderLine(config.line);
        this.renderDescription(config.description);
        this.renderLocationAreaChart(config.locationAreaChart);
        this.renderEventLine(config.eventLine);
        this.renderRelationBar(config.relationBar);
        // this.renderLocationLine(config.locationLine);
        this.renderPostLine(config.postLine);
        this.renderEvents(config.events);
        this.alpha = this.getAlpha();
        // this.container.cursor = this.level === 0 ? "pointer" : "default";
    }

    public renderAsRelatedFigure() {
        this.updatePosition();
        const width = this.width;
        const height = this.height;
        const statusIcon = $statusIcon.get();
        const fontSize = this.baseSize;
        svgTextLength.fontSize = fontSize;
        const textWidth = svgTextLength.visualWidth(this.datum.name);
        const w = textWidth + fontSize * 1.5;
        const h = fontSize;
        const dx = (width - w) / 2;
        const dy = (height - h) / 2;

        const statusIconConfig = {
            x: dx + fontSize * 0.15,
            width: fontSize,
            y: dy,
            height: fontSize,
        };

        this.renderRelatedFigureBackground({
            x: dx + fontSize,
            y: dy,
            width: w - fontSize,
            height: h
        });
        this.renderDraggableBorder(false);
        this.renderBorder();
        this.renderName({
            x: dx + fontSize * 1.35,
            width: textWidth,
            y: dy - fontSize * 0.1,
            height: fontSize,
        });
        this.renderSelectedFiguresBar();
        this.renderStatusIcon(statusIcon === "status" ? statusIconConfig : undefined);
        this.renderLocationIcon(statusIcon === "location" ? statusIconConfig : undefined);
        this.renderLine();
        this.renderDescription();
        this.renderLocationAreaChart();
        this.renderEventLine();
        this.renderRelationBar();
        this.renderLocationLine();
        this.renderPostLine();
        this.renderEvents();

        this.alpha = 1;

        // this.alpha = this.getAlpha();
    }

    public updatePosition() {
        const x = this.position.x1;
        const y = this.fy ?? this.position.y1;
        this.container.x = x;
        this.container.y = y;
        this.group
            .x(x)
            .y(y);
        // this.container.scale.set(this.baseSize / 100, this.baseSize / 100);
        // this.container.scale.set(1, 1);
    }

    public getAlpha() {
        if (this.level > 0) {
            return 1 / this.level * 0.1;
        }
        const figureContexts = $figureContexts.get();
        const figuresSelected = $figuresSelected.get();
        const id = this.datum.id;
        if (figuresSelected.length && !figuresSelected.find(f => f.id === id)) {
            const contexts = figureContexts!;
            const index = $figureId2index.get().get(id)!;
            if (index === undefined) return 0;
            const context = contexts[index];
            if (context === null) return 1;
            const min = contexts.minWeight;
            const max = contexts.maxWeight;
            const r = (context.weight - min) / (max - min);
            return 0.3 + 0.7 * r;
        }
        return 1;
    }

    public updateScale(
        scaleX: ScaleTime,
        scaleY: ScaleLinear,
        kx: number,
        ky: number,
        rangeX: [number, number],
        rangeY: [number, number],
    ) {
        let x1 = scaleX(this.initialPosition.x1);
        let x2 = scaleX(this.initialPosition.x2);
        let y1 = scaleY(this.initialPosition.y1);
        let y2 = scaleY(this.initialPosition.y2);
        // let h = y2 - y1;
        // if (y1 < rangeY[0] && y1 + h > rangeY[0]) {
        //     y1 = rangeY[0];
        // } else if (y1 + h > rangeY[1] && y1 < rangeY[1]) {
        //     y1 = rangeY[1] - h;
        // }
        this.lastPosition.x1 = this.position.x1;
        this.lastPosition.x2 = this.position.x2;
        this.lastPosition.y1 = this.position.y1;
        this.lastPosition.y2 = this.position.y2;

        this.position.x1 = x1;
        this.position.x2 = x2;
        this.position.y1 = y1;
        this.position.y2 = y2;

        const baseSize = this.baseSize;
        let width = Math.max(
            x2 - x1,
            baseSize * this.datum.name.length * Math.sqrt(kx),
        );
        let height = y2 - y1;
        // Math.max(
        //     y2 - y1,
        //     baseSize * Math.sqrt(ky),
        // );
        this.idealWidth = width;
        this.idealHeight = height;

        this.scaleX = scaleX;
    }

    renderMask(config: boolean, args: RenderConfig) {
        let mask = this.container.getChildByLabel("mask") as Graphics | null;
        if (mask === null) {
            mask = new Graphics();
            mask.label = "mask";
            this.container.addChild(mask);
        }

        const visible = config;
        mask.visible = visible;
        if (!visible) {
            return;
        }

        mask.clear();

        const maskColor = "#fff",
              x1 = this.position.x1,
              y1 = this.position.y1,
              width = this.position.x2 - x1,
              height = this.position.y2 - y1;

        if (args.border) {
            const h = this.name.visualHeight();
            mask.rect(0, h, width, height - h)
                .fill(maskColor);
        }

        // 横向的：selectedFiguresBar + name + locationIcon
        let y: (number | undefined) = args.name!.y,
            h: (number | undefined) = args.name!.height + this.baseSize * 0.2, // 适当增加了一些
            x = 0,
            w = args.name!.x + args.name!.width;
        if (args.selectedFiguresBar) {
            x = -this.baseSize * 0.6;
            w += this.baseSize * 0.6;
        }
        mask.rect(x, y, w, h)
            .fill(maskColor);

        // 纵向的：relationBar + locationLine + postLine + events
        // x = 0,
        // y = undefined,
        // h = undefined;
        // // if (args.line)
        // if (args.relationBar) {
        //     const yp = args.relationBar.y,
        //           hp = args.relationBar.height;
        //     if (y === undefined) y = yp;
        //     h = hp + yp - y;
        // }
        // if (args.locationLine) {
        //     const yp = args.locationLine.y,
        //           hp = args.locationLine.height;
        //     if (y === undefined) y = yp;
        //     h = hp + yp - y;
        // }
        // if (args.postLine) {
        //     const yp = args.postLine.y,
        //           hp = args.postLine.height;
        //     if (y === undefined) y = yp;
        //     h = hp + yp - y;
        // }
        // if (args.events) {
        //     const yp = args.events.y,
        //           hp = args.events.height;
        //     if (y === undefined) y = yp;
        //     h = h === undefined ? h : Math.max(h, hp + yp - y);
        // }

        // if (y !== undefined && h !== undefined) {
        //     mask.rect(x, y, width, h)
        //         .fill(maskColor);
        // }
    }

    renderRelatedFigureBackground(config?: PosX & PosY) {
        const container = this.container;
        // const group = this.group;

        let background = container.getChildByLabel("related-figure-background") as Graphics | null;
        if (background === null) {
            background = new Graphics();
            background.label = "related-figure-background";
            container.addChild(background);
        }

        // let backgroundKonva = group.findOne<Konva.Rect>(".related-figure-background");
        // if (backgroundKonva === undefined) {
        //     backgroundKonva = new Konva.Rect();
        //     backgroundKonva.name("related-figure-background");
        //     group.children.push(backgroundKonva);
        //     backgroundKonva.parent = group;
        // }

        const visible = config !== undefined;
        background.visible = visible;
        if (!visible) {
            return;
        }

        const x = config.x,
              y = config.y,
              width = config.width * 1.1,
              height = config.height,
              r = Math.min(width, height) * 0.15;

        background.clear();
        background.roundRect(x, y, width, height, r)
            .fill(light_bgcolor);

        // backgroundKonva.x(x)
        //                 .y(y)
        //                 .width(width)
        //                 .height(height)
        //                 .cornerRadius(r)
        //                 .fill(light_bgcolor);
    }

    renderDraggableBorder(config: boolean) {
        let container = this.container,
            border = container.getChildByLabel("draggable-border") as Graphics | null,
            x0 = container.x,
            y0 = container.y;
        if (border === null) {
            border = new Graphics();
            border.label = "draggable-border";
            border.cursor = "move";
            border.eventMode = "static";
            this.container.addChild(border);

            let click_t: number = Date.now();
            border.on("click", () => {
                // 检测是不是双击
                const t = Date.now();
                if (t - click_t < 300) {
                    this.focus();
                }
                click_t = t;
            })
        }
        const visible = config;
        border.visible = visible;
        if (!visible) {
            return;
        }
        const name = this.name,
              group = this.group,
              x = 0,
              y = name.visualHeight(),
              nameWidth = name.visualWidth() + name.fontSize * 1.2,
              width = this.width,
              height = this.height - y;
        border.clear()
              .rect(x, y, width, height)
              .stroke({
                color,
                width: 1,
              })
              .fill("#fff")
              .rect(x, y - 2, nameWidth, 4)
              .fill("#fff");
        
        let background = group.findOne<Konva.Rect>(".background");
        if (background === undefined) {
            background = new Konva.Rect();
            background.name("background");
            group.children.unshift(background);
            background.parent = group;
        }
        // group.x(x0)
        //      .y(y0);
        
        background.x(x)
                  .y(y)
                  .width(width)
                  .height(height)
                  .fill("black")
                  .globalCompositeOperation("destination-out");
        
    }

    renderBorder(config?: boolean) {
        let border = this.container.getChildByLabel("border") as Graphics | null;
        if (border === null) {
            border = new Graphics();
            border.label = "border";
            this.container.addChild(border);
        }
        const visible = config ? true : false;
        border.visible = visible;
        if (!visible) {
            return;
        }
        border.clear()
            .rect(0, 0, this.position.x2 - this.position.x1, this.position.y2 - this.position.y1)
            .stroke({
                color: color,
                width: 1,
            });
    }
    
    renderSelectedFiguresBar(config?: PosY & { context?: ReturnType<typeof figureContext> }) {
        let bars = this.container.getChildByLabel("selected-figures-bar") as Graphics | null;
        if (bars === null) {
            bars = new Graphics();
            bars.label = "selected-figures-bar";
            this.container.addChild(bars);
        }
        const visible = config !== undefined;
        bars.visible = visible;
        if (!visible) {
            return;
        }
        bars.clear();

        const figuresSelected = $figuresSelected.get();
        if (figuresSelected.length === 0) {
            return;
        }

        let dh = 0;
        const baseSize = this.baseSize;
        const width = baseSize * 0.5;
        const x = - width * 1.2;
        const figuresSelectedColorMap = $figuresSelectedColorMap.get();
        const context = config.context;

        if (!context) return;

        for (let i = 0; i < context.length; ++i) {
            const item = context[i];
            const h = item.weight / Math.max(context.weight, 1e-6) * config.height;
            bars.rect(x, config.y + dh, width, h)
                .fill(figuresSelectedColorMap.get(figuresSelected[i].id));
            dh += h;
        }
    }

    renderName(config?: PosX & PosY & { context?: ReturnType<typeof figureContext> }) {
        let name = this.container.getChildByLabel("name") as Text | null;
        if (name === null) {
            name = new Text({
                text: this.datum.name,
                style: {
                   fontFamily: 'Source',
                   fill: color,
                   // align: 'center',
                },
            });
            name.label = "name";

            /** 通过增大字体大小再缩小可以一定程度上增加分辨率（但是仍然不能抗锯齿） */
            name.scale.set(0.5, 0.5);
            this.container.addChild(name);
            this.listenSelectInteraction(name);
        }
        const visible = config !== undefined;
        name.visible = visible;
        if (!visible) {
            return;
        }
        if (name.style.fontSize !== config.height * 2) {
            name.style.fontSize = config.height * 2; // baseSize * 2;
        }

        name.cursor = this.level === 0 ? "pointer" : "default";

        const figuresSelectedColorMap = $figuresSelectedColorMap.get();
        const figuresSelected = $figuresSelected.get();
        const id = this.datum.id;
        const c = figuresSelected.find(f => f.id === id) ?
            figuresSelectedColorMap.get(id)! : color;
        if (name.style.fill !== c) {
            name.style.fill = c;
        }

        name.x = config.x;
        name.y = config.y;
    }

    renderStatusIcon(config?: PosX & PosY & { forceFlush?: boolean }) {
        let icon = this.container.getChildByLabel("status-icon") as Container | null;
        if (icon === null) {
            icon = new Container();
            icon.label = "status-icon";
            this.container.addChild(icon);
        }
        const visible = config !== undefined;
        icon.visible = visible;
        if (!visible) {
            return;
        }
        const x = config.x ?? icon.x,
            y = config.y ?? icon.y,
            width = config.width ?? (icon as any).__width,
            height = config.height ?? (icon as any).__height;

        icon.x = x;
        icon.y = y;
        icon.width = width;
        icon.height = height;

        (icon as any).__width = width;
        (icon as any).__height = height;

        const color = PostParser.postColorMap[this.datum.status] ?? PostParser.postColorMap[0] as string;
        const type = this.datum.type;

        icon.scale.set(1, 1); // 玄学，要是不加会产生意想不到的缩放
        FigureTypeGlyph.draw(icon, type as any, width, color, config.forceFlush);

        icon.visible = this.level === 0;
    }

    renderLocationIcon(config?: PosX & PosY & { forceFlush?: boolean }) {
        let icon = this.container.getChildByLabel("icon") as Container | null;
        if (icon === null) {
            icon = new Container();
            icon.label = "icon";
            this.container.addChild(icon);
        }
        const visible = config !== undefined;
        icon.visible = visible;
        if (!visible) {
            return;
        }
        const x = config.x ?? icon.x,
            y = config.y ?? icon.y,
            width = config.width ?? (icon as any).__width,
            height = config.height ?? (icon as any).__height;

        icon.x = x;
        icon.y = y;
        icon.width = width;
        icon.height = height;

        (icon as any).__width = width;
        (icon as any).__height = height;

        const locationInfo = $figureLocationInfos.get().get(this.datum.id)!;
        const center = locationInfo.center;
        const locate = locationInfo.locate;

        icon.scale.set(1, 1); // 玄学，要是不加会产生意想不到的缩放
        LocationIcon.draw(icon, width, center, locate, config.forceFlush);
        // LocationIcon.updateColorMap(icon, locationSelected.location.coordinate, this.datum.birthplace?.coordinate ?? null);
        icon.visible = this.level === 0;
    }
    
    renderLine(config?: PosY) {
        let line = this.container.getChildByLabel("line") as Graphics | null;
        if (line === null) {
            line = new Graphics();
            line.label = "line";
            this.container.addChild(line);
        }
        const visible = config !== undefined;
        line.visible = visible;
        if (!visible) {
            return;
        }
        line.clear();
        line.rect(0, config.y, this.position.x2 - this.position.x1, config.height)
            .fill(color);
        line.alpha = 0.3;

        line.visible = this.level === 0;
    }

    renderDescription(config?: PosY) {
        let descriptionElem = this.group.findOne<Konva.Group>(".description");
        if (descriptionElem === undefined) {
            descriptionElem = new Konva.Group();
            descriptionElem.name("description");
            this.group.add(descriptionElem);
        }
        const visible = config !== undefined;
        descriptionElem.visible(visible);
        if (!visible) {
            return;
        }
        const y = config.y ?? descriptionElem.y;
        const width = this.width;
        const height = config.height ?? descriptionElem.height;
        const textManager = this.shortDescription;
        const lines = textManager.wrap(width, height, "...");

        descriptionElem.y(y).height(height);

        ks.select(descriptionElem)
            .selectAll(".line")
            .data(lines, d => d)
            .join("text")
            .each((d, i, nodes) => {
                const line = nodes[i] as Konva.Text;
                line.name("line")
                    .y(textManager.lineHeight * i)
                    .fontSize(textManager.fontSize)
                    .fill(color)
                    .text(d);
            });
        descriptionElem.visible(this.level === 0);
    }

    renderLocationAreaChart(config?: PosY) {
        if ($locationLine.get() === "icon") {
            return this.renderLocationLine(config as any);
        }
        let locationAreaChart = this.container.getChildByLabel("location-areaChart") as Graphics | null;
        if (locationAreaChart === null) {
            locationAreaChart = new Graphics();
            locationAreaChart.label = "location-areaChart";
            this.container.addChild(locationAreaChart);
        }
        const visible = config !== undefined;
        locationAreaChart.visible = visible;
        if (!visible) {
            return;
        }

        const datum = this.datum;
        const data = this.locations;
        const locationSelected = $locationSelected.get();
        const coordinateCapital = capitals.getCurrent(datum.time[0], datum.time[1]).coordinate;
        const center = locationSelected.location.id === -1 ? coordinateCapital : locationSelected.location.coordinate;
        const x0 = this.container.x;
        const y = config.y ?? locationAreaChart.y;
        const width = this.width;
        const height = config.height ?? locationAreaChart.height;
        const scaleX = this.scaleX!;
        const scaleY = d3.scaleLinear()
            .domain([0, 1000])
            .range([height, 0])
            .clamp(true);

        locationAreaChart.clear();
        locationAreaChart.y = y;
        locationAreaChart.height = height;
        locationAreaChart.beginPath();

        let predX = 0, predY = height;
        locationAreaChart.moveTo(predX, predY);
        for (let i = 0, n = data.length, d; i < n; ++i) {
            d = data[i];
            const x = scaleX(d.time!) - x0;
            const distance = EarthCoordinate.distanceBetween(d.coordinate, center);
            const y = scaleY(distance);
            // 贝塞尔曲线平滑地过渡
            locationAreaChart.bezierCurveTo(
                (predX + x) / 2, predY,
                (predX + x) / 2, y,
                x, y
            );
            predX = x;
            predY = y;
        }
        locationAreaChart
            .lineTo(width, predY)
            .lineTo(width, height);

        locationAreaChart.closePath();
        locationAreaChart.fillStyle = light_bgcolor;
        locationAreaChart.fill();

        locationAreaChart.visible = this.level === 0;
    }

    getEventLineY() {
        const eventLine = this.container.getChildByLabel("event-line") as Container | null;
        if (eventLine === null) {
            return [0, 0];
        }
        return [eventLine.y, eventLine.y + eventLine.height * 0.6] as [number, number];
    }

    renderEventLine(config?: PosY) {
        let eventLine = this.container.getChildByLabel("event-line") as Container | null;
        if (eventLine === null) {
            eventLine = new Container();
            eventLine.label = "event-line";
            this.container.addChild(eventLine);
        }
        let lineBrush = this.group.findOne<Konva.Rect>(".event-line-brush");
        if (lineBrush === undefined) {
            lineBrush = new Konva.Rect({
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                fill: color,
                opacity: 0.3,
                name: "event-line-brush"
            });
            this.group.add(lineBrush);
        }
        const visible = config !== undefined;
        eventLine.visible = visible;
        lineBrush.visible(visible);
        if (!visible) {
            return;
        }
        const y = config.y ?? eventLine.y;
        const width = this.width;
        const height = config.height ?? eventLine.height;
        const events = this.events;
        const indices = new Array(events.length).fill(0).map((_, i) => i).sort((i1, i2) => events[i1].importance - events[i2].importance);
        const scaleX = this.scaleX!;
        const x0 = this.container.x;
        const iconSize = height;
        const datum = this.datum;
        const figuresClicked = $figuresClicked.get();
        const figuresTimeSelected = $figuresTimeSelected.get();
        const brushX = figuresTimeSelected.get(datum.id);

        eventLine.y = y;
        eventLine.height = height;

        let background = eventLine.getChildByLabel("background") as Graphics | null;
        if (background === null) {
            background = new Graphics();
            background.label = "background";
            eventLine.addChild(background);
            drag({
                x1: 0,
                x2: 0,
                X: 0,
                x0: 0,
                width: 0,
                scaleX: 0 as any,
                lock: false,
            })
                .on("start", (e) => {
                    // 判断ctrl有没有被按下
                    e.context.lock = !ctrlKey;
                    if (e.context.lock) return;

                    e.context.x0 = this.container.x;
                    e.context.X = this.labels.root?.getBoundingClientRect().x ?? 0;
                    e.context.width = this.width;
                    e.context.scaleX = this.scaleX!;
                    const x = e.x - e.context.X;
                    e.context.x1 = e.context.x2 = x;

                    const x1 = Math.min(e.context.width, Math.max(0, x - e.context.x0));
                    lineBrush.x(x1).width(0);
                })
                .on("drag", (e) => {
                    if (!ctrlKey || e.context.lock) return;

                    const { X, x0, width } = e.context;
                    const x = e.x - X;

                    e.context.x2 = x;
                    const x1 = Math.min(width, Math.max(0, Math.min(e.context.x1, e.context.x2) - x0));
                    const x2 = Math.min(width, Math.max(0, Math.max(e.context.x1, e.context.x2) - x0));
                    lineBrush.x(x1)
                        .width(x2 - x1);
                })
                .on("end", (e) => {
                    if (!ctrlKey || e.context.lock) return;

                    const { x0, width, scaleX } = e.context;
                    const x1 = Math.min(x0 + width, Math.max(x0, Math.min(e.context.x1, e.context.x2)));
                    const x2 = Math.min(x0 + width, Math.max(x0, Math.max(e.context.x1, e.context.x2)));
                    const t1 = scaleX.invert(x1);
                    const t2 = scaleX.invert(x2);
                    if (Math.abs(t1.getTime() - t2.getTime()) > 1000) {
                        figuresTimeSelected.set(datum.id, [t1, t2]);
                    }
                    else {
                        figuresTimeSelected.delete(datum.id);
                    }
                    $figuresTimeSelected.set(new Map(figuresTimeSelected.entries()));
                })
                .apply(background);
        }
        background.clear();
        background.roundRect(0, 0, width, height, Math.min(width, height) * 0.15)
            .fill("rgba(0, 0, 0, 0.1)");
        background.cursor = figuresClicked.find(f => f.id === datum.id) ? "crosshair" : "default";
        background.eventMode = figuresClicked.find(f => f.id === datum.id) ? "static" : "none";

        ps.select(eventLine)
            .selectAll("g")
            .data(indices, d => d)
            .join("container")
            .attr("label", "g")
            .each((idx, i, nodes) => {
                const event = events[idx];
                const g = nodes[i] as Container;
                let c: string;
                let size = event.type === "成就" ? iconSize * 1.5
                    : event.type === "相關人物" ? iconSize * 0.45
                    : iconSize;
                if (event.type === "成就" || event.type === "教育" || event.type === "其他") {
                    c = color;
                }
                else {
                    c = PostParser.postColorMap[event.posts.reduce((r, post) => Math.max(r, post.rank), 0)];
                }
                g.x = scaleX(event.time) - x0 - size * 0.5;
                g.y = (height - size) * 0.5;
                EventTypeGlyph.draw(g, event.type as any, size, c);
                g.cursor = "pointer";
                g.eventMode = "static";
                g.removeAllListeners();
                g.on("click", () => {
                    const eventSelected = $eventSelected.get();
                    if (eventSelected !== null && datum.id === eventSelected.figure.id && idx === eventSelected.idx) {
                        $eventSelected.set(null);
                    }
                    else {
                        $eventSelected.set({ figure: datum, idx });
                    }
                });
            });
        eventLine.scale = 1;

        lineBrush
            .x(brushX ? scaleX(brushX[0]) - x0 : 0)
            .y(y)
            .width(brushX ? scaleX(brushX[1]) - scaleX(brushX[0]) : 0)
            .height(height);

    }

    renderLocationLine(config?: PosY & { forceFlush: boolean; }) {
        let locationLine = this.container.getChildByLabel("location-line") as Container | null;
        if (locationLine === null) {
            locationLine = new Container();
            locationLine.label = "location-line";
            this.container.addChild(locationLine);
        }
        let lineBrush = this.group.findOne<Konva.Rect>(".location-line-brush");
        if (lineBrush === undefined) {
            lineBrush = new Konva.Rect({
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                fill: color,
                opacity: 0.3,
                name: "location-line-brush"
            });
            this.group.add(lineBrush);
        }
        let locationNameElem = this.group.findOne<Konva.Group>(".location-name");
        if (locationNameElem === undefined) {
            locationNameElem = new Konva.Group();
            locationNameElem.name("location-name");
            this.group.add(locationNameElem);
        }
        const visible = config !== undefined && this.level === 0;
        locationLine.visible = visible;
        lineBrush.visible(visible);
        locationNameElem.visible(false);
        if (!visible) {
            return;
        }

        let locationNameBackground = locationNameElem.findOne<Konva.Rect>(".location-name-background");
        if (locationNameBackground === undefined) {
            locationNameBackground = new Konva.Rect({
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                strokeWidth: 1,
                stroke: color,
                cornerRadius: 0,
                fill: "#fff",
                name: "location-name-background"
            });
            locationNameElem.add(locationNameBackground);
        }
        const locationNameFontSize = 14;
        locationNameBackground
            .height(locationNameFontSize * 1.5);

        let locationNameText = locationNameElem.findOne<Konva.Text>(".location-name-text");
        if (locationNameText === undefined) {
            locationNameText = new Konva.Text({
                x: 0,
                y: 0,
                text: "",
                fontSize: 0,
                fill: color,
                name: "location-name-text"
            });
            locationNameElem.add(locationNameText);
        }
        locationNameText
            .x(locationNameFontSize * 0.3)
            .y(locationNameFontSize * 0.25)
            .verticalAlign("start")
            .fontSize(locationNameFontSize);

        const scaleX = this.scaleX!,
              datum = this.datum,
              forceFlush = config.forceFlush,
              locationSelected = $locationSelected.get(),
              locationIdSelected = locationSelected.location.id,
              coordinateSelected = locationSelected.location.coordinate,
              coordinateCapital = capitals.getCurrent(datum.time[0], datum.time[1]).coordinate,
              center = locationIdSelected === -1 ? coordinateCapital : coordinateSelected,
              locations = this.locations,
              width = this.width,
              x0 = this.container.x,
              y = config.y ?? locationLine.y,
              height = config.height ?? lineBrush.height(),
              iconSize = height,
              lineH = iconSize * 0.6,
              lineY = (iconSize - lineH) * 0.5,
              figuresTimeSelected = $figuresTimeSelected.get(),
              brushX = figuresTimeSelected.get(datum.id),
              figuresClicked = $figuresClicked.get(),
              svgTextLength = new SVGTextLength(locationNameFontSize);


        locationLine.x = 0;
        locationLine.y = y;
        locationLine.eventMode = "static";
        locationLine.interactiveChildren = true;

        lineBrush
            .x(brushX ? scaleX(brushX[0]) - x0 : 0)
            .y(y)
            .width(brushX ? scaleX(brushX[1]) - scaleX(brushX[0]) : 0)
            .height(height);


        if (locations.length === 0) {
            const location = getEmptyLocation();
            location.time = datum.time[0];
            locations.push(location);
        }
        ps.select(locationLine)
            .selectAll("g")
            .data(locations, d => d.id)
            .join("container")
            .attr("label", "g")
            .each((location, i, nodes) => {
                const g = nodes[i]!;
                const cx = scaleX(location.time!) - x0;

                // 地点图标中间的连线
                const cx2 = scaleX(i === nodes.length - 1 ? datum.time[1] : locations[i+1].time!) - x0;
                let subline = g.getChildByLabel("subline") as Graphics | null;
                if (subline === null) {
                    subline = new Graphics();
                    subline.label = "subline";
                    g.addChild(subline);
                    // drag({
                    //     x1: 0,
                    //     x2: 0,
                    //     X: 0,
                    //     x0: 0,
                    //     width: 0,
                    //     scaleX: 0 as any,
                    //     lock: false,
                    // })
                    //     .on("start", (e) => {
                    //         // 判断ctrl有没有被按下
                    //         e.context.lock = !ctrlKey;
                    //         if (e.context.lock) return;

                    //         e.context.x0 = this.container.x;
                    //         e.context.X = this.labels.root?.getBoundingClientRect().x ?? 0;
                    //         e.context.width = this.width;
                    //         e.context.scaleX = this.scaleX!;
                    //         const x = e.x - e.context.X;
                    //         e.context.x1 = e.context.x2 = x;

                    //         const x1 = Math.min(e.context.width, Math.max(0, x - e.context.x0));
                    //         lineBrush.x(x1).width(0);
                    //     })
                    //     .on("drag", (e) => {
                    //         if (!ctrlKey || e.context.lock) return;

                    //         const { X, x0, width } = e.context;
                    //         const x = e.x - X;

                    //         e.context.x2 = x;
                    //         const x1 = Math.min(width, Math.max(0, Math.min(e.context.x1, e.context.x2) - x0));
                    //         const x2 = Math.min(width, Math.max(0, Math.max(e.context.x1, e.context.x2) - x0));
                    //         lineBrush.x(x1)
                    //             .width(x2 - x1);
                    //     })
                    //     .on("end", (e) => {
                    //         if (!ctrlKey || e.context.lock) return;

                    //         const { x0, width, scaleX } = e.context;
                    //         const x1 = Math.min(x0 + width, Math.max(x0, Math.min(e.context.x1, e.context.x2)));
                    //         const x2 = Math.min(x0 + width, Math.max(x0, Math.max(e.context.x1, e.context.x2)));
                    //         const t1 = scaleX.invert(x1);
                    //         const t2 = scaleX.invert(x2);
                    //         if (Math.abs(t1.getTime() - t2.getTime()) > 1000) {
                    //             figuresTimeSelected.set(datum.id, [t1, t2]);
                    //         }
                    //         else {
                    //             figuresTimeSelected.delete(datum.id);
                    //         }
                    //         $figuresTimeSelected.set(new Map(figuresTimeSelected.entries()));
                    //     })
                    //     .apply(subline);
                }

                // 地点图标
                let icon = g.getChildByLabel("icon")!;
                let enter = icon === null;
                if (enter) {
                    icon = new Container();
                    icon.label = "icon";
                    icon.cursor = "pointer";
                    icon.eventMode = "static";
                    icon.on("mouseover", () => {
                        const text = location.name;
                        const tw = svgTextLength.visualWidth(text);
                        const cx = this.scaleX!(location.time!) - this.container.x;
                        locationNameElem
                            .x(cx - (tw * 0.5 + locationNameFontSize * 0.3))
                            .y(y - locationNameFontSize * 2)
                            .width(tw + locationNameFontSize * 0.6)
                            .visible(true);
                        locationNameBackground
                            .width(tw + locationNameFontSize * 0.6)
                        locationNameText.text(text);
                        
                    });
                    icon.on("mouseout", () => {
                        locationNameElem.visible(false);
                        // console.log("mouseout", location.name);
                    });
                    icon.on("click", () => {
                        const locationSelected = $locationSelected.get();
                        $locationSelected.set({
                            ...locationSelected,
                            location: locationSelected.location.id === location.id ? locationColorMap.defaultAddress : location,
                        });
                    })
                    g.addChild(icon);
                }
                icon.x = cx - iconSize * 0.5;
                icon.scale.set(1, 1); // 玄学，要是不加会产生意想不到的缩放
                
                if (enter || forceFlush) {
                    const coordinate = location.coordinate;
                    const color = LocationIcon.draw(icon, iconSize, center, coordinate, forceFlush);
                    // LocationIcon.updateColorMap(icon, $locationSelected.value.location.coordinate, this.datum.birthplace?.coordinate ?? null);
                    (location as any).__color__ = color;
                }
                subline.clear()
                    .rect(cx, lineY, cx2 - cx, lineH)
                    .fill((location as any).__color__);
                // subline.cursor = figuresClicked.find(f => f.id === datum.id) ? "crosshair" : "default";
                // subline.eventMode = figuresClicked.find(f => f.id === datum.id) ? "static" : "none";
            });
    }

    renderPostLine(config?: PosY) {
        let postLine = this.container.getChildByLabel("post-line") as Container | null;
        if (postLine === null) {
            postLine = new Container();
            postLine.label = "post-line";
            this.container.addChild(postLine);
        }
        let postNameElem = this.group.findOne<Konva.Group>(".post-name");
        if (postNameElem === undefined) {
            postNameElem = new Konva.Group();
            postNameElem.name("post-name");
            this.group.add(postNameElem);
        }

        const visible = config !== undefined && this.level === 0;
        postLine.visible = visible;
        postNameElem.visible(false);
        if (!visible) {
            return;
        }
        postLine.y = config.y;

        let postNameBackground = postNameElem.findOne<Konva.Rect>(".post-name-background");
        if (postNameBackground === undefined) {
            postNameBackground = new Konva.Rect({
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                strokeWidth: 1,
                stroke: color,
                cornerRadius: 0,
                fill: "#fff",
                name: "post-name-background"
            });
            postNameElem.add(postNameBackground);
        }
        const postNameFontSize = 14;
        postNameBackground
            .height(postNameFontSize * 1.5);

        let postNameText = postNameElem.findOne<Konva.Text>(".post-name-text");
        if (postNameText === undefined) {
            postNameText = new Konva.Text({
                x: 0,
                y: 0,
                text: "",
                fontSize: 0,
                fill: color,
                name: "post-name-text"
            });
            postNameElem.add(postNameText);
        }
        postNameText
            .x(postNameFontSize * 0.3)
            .y(postNameFontSize * 0.25)
            .verticalAlign("start")
            .fontSize(postNameFontSize);


        const scaleX = this.scaleX!,
              x0 = this.container.x,
              height = config.height,
              datum = this.datum,
              t1 = datum.time[1],
              posts = this.posts,
              svgTextLength = new SVGTextLength(postNameFontSize);

        ps.select(postLine)
          .selectAll("g")
          .data(posts, p => p.name)
          .join("container")
          .attr("label", "g")
          .each((post, i, nodes) => {
            const g = nodes[i]!,
                  cx = scaleX(post.time!) - x0,
                  cx2 = scaleX(i === nodes.length - 1 ? (post.endTime ?? t1) : posts[i+1].time!) - x0,
                  w = 2,
                  color = (post as any).__color__;

            let tick = g.getChildByLabel("one-post") as Graphics | null;
            if (tick === null) {
                tick = new Graphics();
                tick.label = "one-post";
                g.addChild(tick);
            }
            tick.clear()
                .rect(cx - w * 0.5, 0, w, height)
                .rect(cx, - w * 0.5, cx2 - cx, w * 0.5)
                .fill(color);

            let tickMask = g.getChildByLabel("one-post-mask") as Graphics | null;
            if (tickMask === null) {
                tickMask = new Graphics();
                tickMask.label = "one-post-mask";
                tickMask.eventMode = "static";
                tickMask.cursor = "pointer";
                g.addChild(tickMask);

                tickMask.on("mouseover", () => {
                    const text = post.name;
                    const tw = svgTextLength.visualWidth(text);
                    const cx = this.scaleX!(post.time!) - this.container.x;
                    postNameElem
                        .x(cx - (tw * 0.5 + postNameFontSize * 0.3))
                        .y(config.y - postNameFontSize * 2)
                        .width(tw + postNameFontSize * 0.6)
                        .visible(true);
                    postNameBackground
                        .width(tw + postNameFontSize * 0.6)
                    postNameText.text(text);

                });
                tickMask.on("mouseout", () => {
                    postNameElem.visible(false);
                });
            }
            tickMask.clear()
                .rect(cx, 0, cx2 - cx, height)
                .fill(color);
            tickMask.alpha = 0;
          })
    }

    renderRelationBar(config?: PosY) {
        let relationBar = this.container.getChildByLabel("relation-bar") as Container | null;
        if (relationBar === null) {
            relationBar = new Container();
            relationBar.label = "relation-bar";
            this.container.addChild(relationBar);
        }
        const visible = config !== undefined && this.level === 0;
        relationBar.visible = visible;
        if (!visible) {
            return;
        }

        const relations = this.relations;
        if (relations.length === 0) {
            return;
        }

        relationBar.y = config.y;

        const datum = this.datum,
              scaleX = this.scaleX!,
              t0 = datum.time[0],
              t1 = datum.time[1],
              X0 = scaleX(t0),
              X1 = scaleX(t1),
              year0 = t0.getFullYear(),
              year1 = t1.getFullYear(),
              bins = histogramYear(
                relations,
                relation => relation.time!,
                year0,
                year1,
              ),
              maxLength = 5, // Math.min(5, Math.max(...bins.map(bin => bin.length))),
              width = this.position.x2 - this.position.x1,
              height = config.height,
              H = height / maxLength,
              h = H * 0.8;

        let line = relationBar.getChildByLabel("line") as Graphics | null;
        if (line === null) {
            line = new Graphics();
            line.label = "line";
            relationBar.addChild(line);
        }
        line.clear()
            .setStrokeStyle({
                width: 1,
                color: color,
            })
            .moveTo(0, height)
            .lineTo(width, height)
            .stroke();
        
        ps.select(relationBar)
          .selectAll("bin")
          .data(bins, (_, i) => i)
          .join("container")
          .attr("label", "bin")
          .each((bin, i, nodes) => {
            let node = nodes[i],
                year = bin.year,
                x0 = scaleX(new Date(year, 0, 1)),
                x1 = scaleX(new Date(year + 1, 0, 1)),
                w = x1 - x0,
                cx = (x0 + x1) * 0.5,
                realX0 = Math.max(X0, cx - w * 0.4) - X0,
                realX1 = Math.min(X1, cx + w * 0.4) - X0,
                realW = realX1 - realX0;
                  
            if (realX0 > realX1) {
                [realX0, realX1] = [realX1, realX0];
            }

            let binH = bin.length > 8 ? height / bin.length : H,
                binh = binH * 0.8;

            ps.select(node)
              .selectAll("item")
              .data(bin, (_, i) => i)
              .join("graphics")
              .attr("label", "item")
              .each((item, j, nodes) => {
                const n = nodes[j]! as Graphics,
                      y = height - binH * (j + 1);
                // console.log(n);
                n.clear()
                    .rect(realX0, y, realW, binh)
                    .fill(color);
              });
            
          });
    }

    renderEvents(config?: PosY) {
        let eventsElem = this.container.getChildByLabel("events") as Container | null;
        if (eventsElem === null) {
            eventsElem = new Container();
            eventsElem.label = "events";
            this.container.addChild(eventsElem);
        }
        let group = this.group.findOne(".events") as Konva.Group | undefined;
        if (group === undefined) {
            group = new Konva.Group();
            group.name("events");
            this.group.add(group);
        }

        if (config === undefined || this.level > 0) {
            eventsElem.visible = false;
            group.visible(false);
            return;
        }
        const events = this.events,
              fontSize = eventFontSize,
              width = this.width,
              height = config.height ?? (this.container as any).__height__,
              lineH = Math.min(20, height * 0.1), // 连线部分的高度
              textH = height - lineH,
              textPaddingY = eventFontSize * 0.6,
              textHeight = textH - textPaddingY * 2;
        if (events.length === 0 || textHeight < fontSize) {
            eventsElem.visible = false;
            group.visible(false);
            return;
        }
        eventsElem.visible = true;
        group.visible(true);

        (this.container as any).__height__ = height;

        const datum = this.datum,
              texts = this.texts,
              shortTexts = this.shortTexts,
              eventTextWidths = this.eventTextWidths,
              scaleX = this.scaleX!,
              lineHeight = eventLineHeight, // 文本行高
              n = events.length,
              intervals = new Array(n),
              selectedIntervals = new Uint8Array(n),
              x0 = scaleX(datum.time[0]),
              x1 = scaleX(datum.time[1]),
              y0 = this.container.y,
              dy = config.y ?? eventsElem.y,
              leftX = 0,
              rightX = x1 - x0,
              gapX = eventFontSize,
              textPaddingX = gapX * 0.5,
              eventSelected = $eventSelected.get();

        if (textHeight < fontSize) {
            eventsElem.visible = false;
            group.visible(false);
        }

        const eventTextWidthInterpolator = (e: Event, totalWidth: number, width0: number, width1: number) => {
            const t = Math.min(1, width / totalWidth);
            return width0 + (width1 - width0) * t;
        }

        eventsElem.y = dy;
        // group.x(x0)
        //      .y(y0);
        // 事件采样+布局
        const dw = gapX + textPaddingX * 2;
        const eventTexts: SVGTextManager[] = [];
        const totalWidth0 = shortTexts.reduce((r, t) => r + t.visualWidth(), 0) + dw * n;
        const totalWidth1 = texts.reduce((r, t) => r + t.visualWidth(), 0) + dw * n;
        const totalWidth = totalWidth0 + Math.max(0, totalWidth1 - totalWidth0) * 0.2;
        for (let i = 0, n = events.length; i < n; ++i) {
            const event = events[i];
            const { w, ws } = eventTextWidths[i];
            const eventWidth = eventTextWidthInterpolator(event, totalWidth, ws, w);
            const cx = scaleX(event.time!) - x0;

            if (eventWidth > ws + (w - ws) * 0.6) {
                eventTexts.push(texts[i]);
            }
            else {
                eventTexts.push(shortTexts[i]);
            }
            // const width = Math.max(30, Math.min(200, event.size * fontSize));
            const weight = event.importance;
            intervals[i] = new Interval(cx, eventWidth + dw, (eventWidth + dw) * 0.55, weight);
        }
        if (eventSelected !== null && eventSelected.figure.id === datum.id) {
            selectedIntervals[eventSelected.idx] = 1;
        }
        const selected = Interval.schedule(intervals, selectedIntervals, leftX, rightX);

        const visibleIntervals = new Array<Interval>();
        const data = new Array<Event>();
        const indices = new Array<number>();
        for (let i = 0; i < selected.length; ++i) {
            if (selected[i]) {
                visibleIntervals.push(intervals[i]);
                data.push(events[i]);
                indices.push(i);
            }
        }
        Interval.layout(visibleIntervals, leftX, rightX);

        // 渲染
        ks.select(group)
          .selectAll(".text")
          .data(data, d => d.id)
          .join("group")
          .each((event, i, nodes) => {
            const node = nodes[i]! as Konva.Group,
                  interval = visibleIntervals[i],
                  index = indices[i],
                  // 线条的位置
                  x2 = interval.cx2!,
                  // 文本的位置,
                  width = interval.width - gapX,
                  textWidth = width - textPaddingX * 2,
                  x = x2 - (width - gapX) * 0.5,
                  y = lineH + dy,
                  text = eventTexts[index],
                  lines = text.wrap(textWidth, textHeight);

            node.name("text");

            node.x(x + textPaddingX)
                .y(y + textPaddingY);

            ks.select(node)
              .selectAll(".line")
              .data(lines)
              .join("text")
              .each((line, j, elems) => {
                const elem = elems[j]! as Konva.Text;
                elem.name("line")
                    .y(j * lineHeight)
                    .fontSize(fontSize)
                    .fontFamily("Source")
                    .fill(color)
                    .text(line)
                    .align("left")
                    .verticalAlign("top");
              });

            let realHeight = lineHeight * lines.length;
            (event as any).__textHeight__ = realHeight;
          });

        // 不知道为什么有这个bug
        if (group.children.length !== data.length) {
            this.renderEvents(config);
        }

        // const sortedEventIndices = new Array(events.length).fill(0)
        //   .map((_, i) => i)
        //   .sort((i1, i2) => events[i1].importance - events[i2].importance);

        // ps.select(eventsElem)
        //   .selectAll("point")
        //   .data(sortedEventIndices, d => d)
        //   .join("graphics")
        //   .attr("label", "point")
        //   .each((idx, i, nodes) => {
        //     const g = nodes[i] as Graphics;
        //     const interval = intervals[idx];
        //     g.clear();
        //     g.circle(interval.cx, 0, 3)
        //         .fill(bgcolor);
        //     g.eventMode = "static";
        //     g.cursor = "pointer";
        //     g.off("click");
        //     g.on("click", () => {
        //         $eventSelected.set({
        //             figure: datum,
        //             idx: idx,
        //         });
        //     })
        //   });

        ps.select(eventsElem)
          .selectAll("g")
          .data(data, d => d.id)
          .join("container")
          .attr("label", "g")
          .each((event, i, nodes) => {
            const g = nodes[i]!,
                  interval = visibleIntervals[i],
                  // 线条的位置
                  x1 = interval.cx,
                  x2 = interval.cx2!,
                  y1 = 0,
                  y2 = lineH,
                  // 文本的位置,
                  width = interval.width - gapX,
                  x = x2 - (width - gapX) * 0.5,
                  y = lineH,
                  // 文本框实际高度
                  borderH = (event as any).__textHeight__ + textPaddingY * 2,
                  r = Math.min(width, borderH) * 0.1;
            
            let tick = g.getChildByLabel("tick") as Graphics | null;
            if (tick === null) {
                tick = new Graphics();
                tick.label = "tick";
                g.addChild(tick);
            }
            tick.clear();
            
            // 连线
            tick.setStrokeStyle({
                    width: 1,
                    color: color,
                })
                .moveTo(x1, y1)
                .bezierCurveTo(x1, y2, x2, y1, x2, y2)
                .stroke();

            // 文本框
            tick.roundRect(x, y, width, borderH, r)
                .fill(light_bgcolor);
            
            tick.cursor = "pointer";
            tick.off("click");
            tick.on("click", () => {
                const idx = events.findIndex(e => e.id === event.id);
                $eventSelected.set({
                    figure: datum,
                    idx: idx,
                });
            });
            tick.eventMode = "static";
          });
    }

    focus() {
        this.labels.zoomToLabel(this);
    }

    destroy() {
        this.container.destroy({ children: true });
        this.group.destroy();
    }
}