import * as d3 from 'd3';
import zoom2D, { Zoom2D } from './utils/zoom2D';
import Transform2D from './utils/transform2D';
import * as constants from './constants';
import Layout from './layout';
import { Figure, LayoutConfig, ScaleLinear, ScaleTime } from './types';
import Label from './label';

import { Application, Container, Graphics } from 'pixi.js';
import Sampling from './sampling';
import { join } from './utils/selector';
import gsap from 'gsap';
import semanticZooming, { SemanticZoomingNode } from './label/semantic-zooming';

import SharedTexture from '../utils/SharedTexture';
import * as components from "./components";
import { $eventSelected, $figuresClicked, $figureContexts, $figureHovered, $figuresSelected, $historicalContexts, $layoutMethod, $locationSelected, $figuresTimeSelected, $figures, $figureId2index, $viewMode, $emitter } from '../store';

import Konva from 'konva';
import SVGTextManager from '../utils/SVGTextManager';

import * as ps from "./utils/pixi-selector";
import * as ks from "./utils/konva-selector";
import { relationScoreColormap } from '../constants';
import { $pixi } from '../store/basic';
import { $transform } from '../store/view';

interface Props {
    x: number;
    y: number;
    width: number;
    height: number;
    data: Figure[];
}

interface Emit {
    zoom(domainX: [Date, Date], domainY: [number, number]): void;
}

const layouts = constants.layouts;

const relatedFigureFontSize = 14;

export default class Labels {

    private props: Props;
    private emit: Emit | null = null;
    
    public root: HTMLDivElement | null = null;
    private pixi: Application | null = null;
    private konva: Konva.Layer | null = null;
    private eventsContainer: Container | null = null;
    private eventsGroup: Konva.Group | null = null;

    private labels: readonly Label[];
    private id2label: Map<number, Label>;
    private visibleLabels: Label[] = [];
    /** 采样所使用的标签全集列表。主要是在原始的标签全集的基础上重新根据权重进行了排序 */
    private sampleLabels: Label[] = [];

    private zooming: SemanticZoomingNode;

    /** 布局总高度 */
    private totalHeight: number = 0;
    private lineNumber: number = 0;

    private domainX: [Date, Date] = constants.domainX;
    private domainY: [number, number] = constants.domainY;
    private rangeX: [number, number] = [0, 0];
    private rangeY: [number, number] = [0, 0];

    private originScaleX: d3.ScaleTime<number, number> = d3.scaleTime().domain(constants.domainX);
    private originScaleY: d3.ScaleLinear<number, number> = d3.scaleLinear().domain(constants.domainY);

    /** 缩放倍数 */
    private resolution: number = constants.resolution;

    /** 布局管理器 */
    private layout: Layout;

    private get width() {
        return this.props.width;
    }
    private get height() {
        return this.props.height;
    }

    private get baseSize() {
        return Math.min(this.width, this.height) / 50;
    }

    private get scaleX() {
        return d3.scaleTime().domain(this.domainX).range(this.rangeX);
    }
    private get scaleY() {
        return d3.scaleLinear().domain(this.domainY).range(this.rangeY);
    }

    /** 横轴缩放的放大倍数 */
    private get kx() {
        return (this.originScaleX.domain()[1].getTime() - this.originScaleX.domain()[0].getTime()) / (this.domainX[1].getTime() - this.domainX[0].getTime());
    }

    /** 纵轴缩放的放大倍数 */
    private get ky() {
        return (this.originScaleY.domain()[1] - this.originScaleY.domain()[0]) / (this.domainY[1] - this.domainY[0]);
    }

    private _zoom: Zoom2D | null = null;
    private stopPropagation: boolean = false;

    constructor(props: Partial<Props>) {
        this.props = Object.assign({
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            data: [],
        }, props);

        this.rangeX = [0, this.width];
        this.rangeY = [0, this.height];
        this.originScaleX.range(this.rangeX);
        this.originScaleY.range(this.rangeY);

        this.zooming = semanticZooming.getCurrentNode();

        const labels = this.props.data.map((datum, i) => new Label(datum, i, this));
        const id2label = new Map<number, Label>();
        for (let i = 0, n = labels.length, label; i < n; ++i) {
            label = labels[i];
            id2label.set(label.datum.id, label);
        }

        this.labels = labels;
        this.id2label = id2label;

        const [layoutMethod, thisArgs] = $layoutMethod.get();
        const layoutConfig = layouts[layoutMethod].call(thisArgs);
        this.layout = new Layout(
            labels,
            this.width,
            this.height,
            {
                height: 1, // 固定取值为1，和scaleY的domain一致
                labelHeight: "auto", // 0.0007,
                labelLineHeight: "auto", // 0.0008,
                getX: (label) => label.datum.time.map(t => t.getTime()) as [number, number],
            },
            layoutConfig.lineNumber,
            (layoutConfig as any).singleLineNumber,
            (layoutConfig as any).order,
            (layoutConfig as any).key,
        );

        this.applyLayout();
    }

    public async setRoot(root: HTMLDivElement) {
        this.root = root;
        await this._initialize();
        return this;
    }

    public setEmit(emit: Emit) {
        this.emit = emit;
        return this;
    }

    /** 更新标签显示容器的位置和宽高 */
    public updateContainer() {
        if (this.root === null) {
            return;
        }
        this.root.setAttributeNS("http://www.w3.org/2000/svg", "transform", `translate(${this.props.x}, ${this.props.y})`);
        this.root.setAttribute("x", this.props.x.toString());
        this.root.setAttribute("y", this.props.y.toString());
        this.root.setAttribute("width", this.props.width.toString());
        this.root.setAttribute("height", this.props.height.toString());
    }

    /** 比例尺更新后应用到所有的标签上，同时会让figuresSelected落在显示区域内 */
    public updateScale(labels: readonly Label[], scaleX?: ScaleTime, scaleY?: ScaleLinear) {
        const kx = this.kx,
              ky = this.ky;
        scaleX = scaleX ?? this.scaleX;
        scaleY = scaleY ?? this.scaleY;
        for (const label of labels) {
            label.updateScale(
                scaleX,
                scaleY,
                kx,
                ky,
                this.rangeX,
                this.rangeY
            );
        }

        const figuresSelected = $figuresSelected.get(),
            id2label = this.id2label,
            x = 0,
            y = 0,
            width = this.props.width,
            height = this.props.height;

        for (let i = 0, n = figuresSelected.length, figure, label, position, y1, h; i < n ; ++i) {
            figure = figuresSelected[i];
            label = id2label.get(figure.id)!;

            position = label.position;
            y1 = position.y1;
            h = label.height;

            if (y1 <= y) {
                position.y1 = y;
                position.y2 = y + h;
            }
            if (y1 >= height - h) {
                position.y1 = height - h;
                position.y2 = height;
            }
        }

        if ($viewMode.get() === "focused") {
            labels.forEach(label => {
                label.width = label.position.x2 - label.position.x1;
                label.height = label.position.y2 - label.position.y1;
            });
        }
        else {
            labels.forEach((label) => {
                this.zooming.updateWidthAndHeight(label);
            });
        }
    }

    public addSelectedFigures(labels: Label[]): Label[] {
        const added: Label[] = [],
              figuresSelected = $figuresSelected.get(),
              id2label = this.id2label,
              ids = new Set<number>(),
              zooming = this.zooming,
              kx = this.kx,
              ky = this.ky,
              oScaleX = this.originScaleX,
              oScaleY = this.originScaleY,
              dx = (oScaleX.domain()[1].getTime() - oScaleX.domain()[0].getTime()) / (oScaleX.range()[1] - oScaleX.range()[0]),
              dy = (oScaleY.domain()[1] - oScaleY.domain()[0]) / (oScaleY.range()[1] - oScaleY.range()[0]),
              rx = dx / kx,
              ry = dy / ky;

        for (let i = 0, n = labels.length, label; i < n; ++i) {
            label = labels[i];
            ids.add(label.datum.id);
        }
        for (let i = 0, n = figuresSelected.length, figure, id, label; i < n; ++i) {
            figure = figuresSelected[i];
            id = figure.id;
            label = id2label.get(id)!;
            if (!ids.has(id)) {
                // 采样的过程中会更新label的宽高，所以需要运行一遍
                zooming.getSamplingBBoxes(label, rx, ry);
                zooming.updateWidthAndHeight(label);
                added.push(label);
            }
            else {
                label.level = 0;
            }
        }
        return added.concat(labels);
    }

    public updateWeights() {
        const historicalContexts = $historicalContexts.get();
        const D = (historicalContexts.maxWeight - historicalContexts.minWeight) || 1;
        const id2index = $figureId2index.get();
        for (const label of this.labels) {
            const index = id2index.get(label.datum.id)!;
            label.__baseSize__ = undefined;
            label.weight = (historicalContexts[index].weight - historicalContexts.minWeight) / D;
            label.name = new SVGTextManager(label.datum.name, label.baseSize);
        }
    }

    public renderLabel(
        label: Label
    ) {
        const viewMode = $viewMode.get();
        const figureClicked = $figuresClicked.get();

        if (viewMode === "global") {
            this.zooming.render(label);
        }
        else {
            if (figureClicked.find(f => f.id === label.datum.id) !== undefined) {
                semanticZooming.getSelectedFigureNode().render(label);
            }
            else {
                label.renderAsRelatedFigure();
            }
        }
        // const selected = $figureClicked.get().find(f => f.id === label.datum.id) !== undefined,
            //   zooming = selected ? this.selectedFigureZooming : this.zooming;
            //   height = selected ? Math.max(160, label.height) : label.height;
        // label.height = height;
        // zooming.render(label);
    }

    /** 初始渲染或更新渲染所有的标签 */
    public renderLabels(
        labels: Label[],
        duration: number = 0,
    ) {
        const zooming = this.zooming,
              zoomY = semanticZooming.y,
              figuresSelected = $figuresSelected.get(),
              fs = new Set<number>(figuresSelected.map(f => f.id));

        /** 更新渲染顺序 */
        for (let label of this.labels) {
            label.container.zIndex = 0;
            // label.group.zIndex(0);
        }
        for (let i = 0, n = labels.length, label; i < n; i++) {
            label = labels[i];
            label.container.zIndex = fs.has(label.datum.id) ? n + 1 : n - i;
            // label.group.zIndex(n - i); // 效率极低！
        }
        // this.pixi!.stage.sortChildren(); // 似乎并不需要重排
        // for (let label of this.labels) { // 当然zIndex置零之后就需要重排了
        //     label.container.zIndex = 0;
        // }
        if (zoomY >= 5) {
            for (let i = 0, n = labels.length; i < n; ++i) {
                const label = labels[i];
                label.group.zIndex(fs.has(label.datum.id) ? n + 1 : n - i);
            }
        }

        /** 更新渲染内容 */
        const { enter, update, exit } = join(
            this.visibleLabels,
            labels,
            label => label.datum.id,
        );
        if (duration === 0) {
            for (const i of enter) {
                const label = labels[i];
                label.visible = true;
                this.renderLabel(label);
            }
            for (const i of update) {
                const label = labels[i];
                label.visible = true;
                this.renderLabel(label);
            }
            for (const i of exit) {
                const label = this.visibleLabels[i];
                label.visible = false;
            }
        }
        else {
            const tl = gsap.timeline();
            for (const i of enter) {
                const label = labels[i];
                label.visible = true;
                label.alpha = 0
                this.renderLabel(label);
                tl.to(label, {
                    alpha: label.getAlpha(),
                    duration: duration / 1000,
                }, 0);
            }
            for (const i of update) {
                const label = labels[i];
                const pos = label.position;
                label.position = Object.assign({}, label.lastPosition);
                this.renderLabel(label);
                tl.to(label.position, {
                    ...pos,
                    duration: duration / 1000,
                    onUpdate: () => {
                        this.renderLabel(label);
                    },
                }, 0);
            }
            for (const i of exit) {
                const label = this.visibleLabels[i];
                tl.to(label, {
                    alpha: 0,
                    duration: duration / 1000,
                    onComplete: () => {
                        label.visible = false;
                    },
                }, 0);
            }

            return tl;
        }
        this.visibleLabels = labels;
    }

    public renderLinks(labels?: Label[]) {

        // 相关人物和选中人物之间的连线
        const figuresClicked = $figuresClicked.get();
        const figuresSelected = $figuresSelected.get();
        const figuresClickedSet = new Set<number>(figuresClicked.map(f => f.id));
        const figuresClickedIndices = figuresClicked.map(f => figuresSelected.findIndex(s => s.id === f.id));
        const contexts = $figureContexts.get()!;
        const id2label = this.id2label;

        const container = this.pixi!.stage;

        const colormap = relationScoreColormap;

        let linksElem = container.getChildByLabel("links");
        if (!linksElem) {
            linksElem = new Container();
            linksElem.label = "links";
            linksElem.zIndex = Infinity;
            container.addChild(linksElem);
        }

        if (figuresClicked.length === 0 || labels === undefined || labels.length === 0) {
            linksElem.visible = false;
            return;
        }
        linksElem.visible = true;

        const data: {
            id: string;
            time: Date | null;
            source: number;
            target: number;
            type: string;
            description: string;
            descriptions: {
                content: string;
                rank: number;
            }[];
            score: number;
        }[] = [];
        const selectedData: {
            id: string;
            time: Date | null;
            source: number;
            target: number;
            type: string;
            description: string;
            descriptions: {
                content: string;
                rank: number;
            }[];
            score: number;
        }[] = [];

        labels.forEach((label, i) => {
            const f = label.datum;
            const context = contexts[i];
            if (!context) return;
            for (let j = 0, n = figuresClickedIndices.length; j < n; ++j) {
                const idx = figuresClickedIndices[j];
                const figureClicked = figuresClicked[j];
                const ctx = context[idx];
                ctx.events.forEach(event => {
                    if (!event.time) return;
                    const descriptions: {
                        content: string;
                        rank: number;
                    }[] = [];
                    if (event.relations.length > 0) {
                        event.relations.forEach(r => {
                            descriptions.push({
                                content: r.description,
                                rank: r.score
                            });
                        });
                    }
                    if (event.posts.length > 0) {
                        descriptions.push({
                            content: `可能同時任職於${event.posts.map(p => p[0].name).join(", ")}`,
                            rank: 0
                        });
                    }
                    if (event.locations.length > 0) {
                        descriptions.push({
                            content: `可能同時出現在${event.locations.map(l => l.name).join(", ")}`,
                            rank: 0
                        });
                    }
                    const d = {
                        id: `${f.id}-${figureClicked.id}-${event.time?.getTime()}`,
                        time: event.time,
                        source: f.id,
                        target: figureClicked.id,
                        type: "",
                        descriptions: descriptions,
                        description: "",
                        score: Math.round(
                            descriptions.reduce((acc, d) => acc + d.rank, 0) /
                            Math.max(1, descriptions.filter(d => d.rank > 0).length)
                        ),
                    };
                    if (figuresClickedSet.has(f.id)) {
                        if (f.id === figureClicked.id) return;
                        selectedData.push(d);
                    }
                    else {
                        data.push(d);
                    }
                });
                // ctx.relations.relations.forEach(r => {
                //     if (!r.time) return;
                //     const d = {
                //         id: `${f.id}-${figureClicked.id}-${r.time?.getTime()}`,
                //         time: r.time,
                //         source: f.id,
                //         target: figureClicked.id,
                //         type: r.relation.type,
                //         description: r.relation.description,
                //         score: r.relation.score,
                //     };
                //     if (figuresClickedSet.has(f.id)) {
                //         if (f.id === figureClicked.id) return;
                //         selectedData.push(d);
                //     }
                //     else {
                //         data.push(d);
                //     }
                // });
            }
        });


        let tooltip = this.konva!.findOne("#link-tooltip") as Konva.Group | null;
        if (!tooltip) {
            tooltip = new Konva.Group({
                id: "link-tooltip",
            });
            tooltip.hide();
            this.konva!.add(tooltip);
        }

        function drawBezier(
            g: Graphics,
            x1: number,
            y1: number,
            cpx1: number,
            cpy1: number,
            cpx2: number,
            cpy2: number,
            x2: number,
            y2: number,
            segments = 16
        ) {
            g.moveTo(x1, y1);
            for (let i = 1; i <= segments; i++) {
                const t = i / segments;
                const it = 1 - t;
                const x = it * it * it * x1 + 3 * it * it * t * cpx1 + 3 * it * t * t * cpx2 + t * t * t * x2;
                const y = it * it * it * y1 + 3 * it * it * t * cpy1 + 3 * it * t * t * cpy2 + t * t * t * y2;
                g.lineTo(x, y);
            }
        }

        const [X0, X1] = this.scaleX.range();
        ps.select(linksElem)
            .selectAll("link")
            .data(data, d => d.id)
            .join("container")
            .attr("label", "link")
            .each((d, i, nodes) => {
                const g = nodes[i] as Container;
                // g.zIndex = Infinity;
                const cfig = id2label.get(d.target)!
                const pos1 = id2label.get(d.source)!.position;
                const pos2 = cfig.position;
                const x1 = (pos1.x1 + pos1.x2) * 0.5;
                const y1 = pos2.y1 > pos1.y1 ? pos1.y2 : pos1.y2; // (pos1.y1 + pos1.y2) * 0.5;
                const x2 = this.scaleX!(d.time!);
                const _y2 = cfig.getEventLineY();
                const y2 = pos2.y1 + (pos2.y1 > pos1.y1 ? _y2[0] : _y2[1]);

                const cpx1 = x1;
                const cpy1 = (y1 + y2) * 0.5;
                const cpx2 = x2;
                const cpy2 = (y1 + y2) * 0.5;

                const color = colormap.get(d.score) ?? colormap.get(0);

                let mask = g.getChildByLabel("link-mask") as Graphics | null;
                if (mask === null) {
                    mask = new Graphics();
                    mask.label = "link-mask";
                    mask.alpha = 0;
                    mask.interactive = false;
                    mask.eventMode = "none";
                    g.addChild(mask);
                }
                const maskR = Math.abs(y2 - y1) * 0.2;
                mask.clear()
                    .circle(x1, y1, maskR)
                    .fill("#fff")
                mask.alpha = 0;

                // const link = components.Link.drawLink(g, x1, y1, x2, y2, color);
                let link = g.getChildByLabel("link-line") as Graphics | null;
                if (link === null) {
                    link = new Graphics();
                    link.label = "link-line";
                    g.addChild(link);
                }
                // link.clear();
                // drawBezier(link, x1, y1, cpx1, cpy1, cpx2, cpy2, x2, y2);
                // link.stroke({ color: color, width: 1 });
                link.clear()
                    .moveTo(x1, y1)
                    .bezierCurveTo(cpx1, cpy1, cpx2, cpy2, x2, y2)
                    .stroke({ color: color, width: 1 });

                let interactiveLink = g.getChildByLabel("link-interactive") as Graphics | null;
                if (interactiveLink === null) {
                    interactiveLink = new Graphics();
                    interactiveLink.label = "link-interactive";
                    interactiveLink.cursor = "pointer";
                    interactiveLink.eventMode = "static";
                    interactiveLink.alpha = 0;
                    interactiveLink.on("mouseover", (e) => {
                        const x = e.nativeEvent.offsetX;
                        const y = e.nativeEvent.offsetY;
                        tooltip.position({ x, y });
                        tooltip.removeChildren();
                        const background = new Konva.Rect({
                            x: 0,
                            y: 0,
                            width: 0,
                            height: 0,
                            fill: constants.light_bgcolor,
                            cornerRadius: 5,
                        });
                        tooltip.add(background);
                        const title = new Konva.Text({
                            text: id2label.get(d.source)!.datum.name + "-" + id2label.get(d.target)!.datum.name,
                            fontSize: 14,
                            fontStyle: "bold",
                            padding: 5,
                            fill: color,
                        });
                        tooltip.add(title);

                        let textY = title.height();
                        let maxWidth = 0;
                        ks.select(tooltip)
                            .selectAll(".content")
                            .data(d.descriptions, d => d.content)
                            .join("text")
                            .each((d, i, nodes) => {
                                const node = nodes[i] as Konva.Text;
                                const color = colormap.get(d.rank);
                                node.name("content")
                                    // .y(textY)
                                    .text(d.content)
                                    .fontSize(12)
                                    .padding(5)
                                    .fill(color);
                                maxWidth = Math.max(maxWidth, node.width());
                                // textY += node.height();
                            });

                        if (maxWidth > 150) {
                            maxWidth = 150;
                        }
                        ks.select(tooltip)
                            .selectAll(".content")
                            .each((d, i, nodes) => {
                                const node = nodes[i] as Konva.Text;
                                node
                                    .y(textY)
                                    .width(maxWidth);
                                textY += node.height();
                            });

                        background
                            .width(Math.max(maxWidth, title.width()))
                            .height(textY);

                        tooltip.show();
                    });
                    interactiveLink.on("mouseout", () => {
                        tooltip.hide();
                    });
                    interactiveLink.on("click", () => {
                        const idx = cfig.datum.events.findIndex(e => 
                            e.time?.getTime() === d.time?.getTime() &&
                            e.relations.findIndex(r => r.id === d.source) >= 0
                        );
                        if (idx < 0) return;
                        $eventSelected.set({
                            figure: cfig.datum,
                            idx: idx,
                        });
                    });
                    g.addChild(interactiveLink);
                }
                interactiveLink.clear()
                    .moveTo(x1, y1)
                    .bezierCurveTo(cpx1, cpy1, cpx2, cpy2, x2, y2)
                    .stroke({ color: color, width: 5 });

                if (x2 < X0 || x2 > X1) {
                    link.mask = mask;
                    interactiveLink.mask = mask;
                }
                else {
                    link.mask = null;
                    interactiveLink.mask = null;
                }
                link.alpha = 0.3;
            });

        // 选中人物之间的连线
        const [T0, T1] = this.scaleX.domain().map(d => d.getTime());
        
        ps.select(linksElem)
            .selectAll("link-selected")
            .data(selectedData.filter(d => d.time!.getTime() > T0 && d.time!.getTime() < T1), d => d.id)
            .join("container")
            .attr("label", "link-selected")
            .each((d, i, nodes) => {
                const g = nodes[i] as Container;

                const label1 = id2label.get(d.source)!;
                const label2 = id2label.get(d.target)!;
                const pos1 = label1.position;
                const pos2 = label2.position;
                const x1 = this.scaleX!(d.time!);
                const _y1 = label1.getEventLineY();
                const y1 = pos1.y1 + (pos1.y1 > pos2.y1 ? _y1[0] : _y1[1]);
                const x2 = x1;
                const _y2 = label2.getEventLineY();
                const y2 = pos2.y1 + (pos2.y1 > pos1.y1 ? _y2[0] : _y2[1]);

                const dy = Math.abs(y2 - y1);
                const cpx1 = x1 - dy * 0.2;
                const cpx2 = x2 - dy * 0.2;
                const cpy1 = y1 + (y2 - y1) * 0.3;
                const cpy2 = y2 + (y1 - y2) * 0.3;

                const color = colormap.get(d.score);

                let link = g.getChildByLabel("link-line") as Graphics | null;
                if (link === null) {
                    link = new Graphics();
                    link.label = "link-line";
                    g.addChild(link);
                }
                link.clear()
                    .moveTo(x1, y1)
                    .bezierCurveTo(cpx1, cpy1, cpx2, cpy2, x2, y2)
                    .stroke({ color: color, width: 1 });

                let interactiveLink = g.getChildByLabel("link-interactive") as Graphics | null;
                if (interactiveLink === null) {
                    interactiveLink = new Graphics();
                    interactiveLink.label = "link-interactive";
                    interactiveLink.cursor = "pointer";
                    interactiveLink.eventMode = "static";
                    interactiveLink.on("mouseover", (e) => {
                        const x = e.nativeEvent.offsetX;
                        const y = e.nativeEvent.offsetY;
                        tooltip.position({ x, y });
                        tooltip.removeChildren();
                        const background = new Konva.Rect({
                            x: 0,
                            y: 0,
                            width: 0,
                            height: 0,
                            fill: constants.light_bgcolor,
                            cornerRadius: 5,
                        });
                        tooltip.add(background);
                        const title = new Konva.Text({
                            text: id2label.get(d.source)!.datum.name + "-" + id2label.get(d.target)!.datum.name,
                            fontSize: 14,
                            fontStyle: "bold",
                            padding: 5,
                            fill: color,
                        });
                        tooltip.add(title);

                        let textY = title.height();
                        let maxWidth = 0;
                        ks.select(tooltip)
                            .selectAll(".content")
                            .data(d.descriptions, d => d.content)
                            .join("text")
                            .each((d, i, nodes) => {
                                const node = nodes[i] as Konva.Text;
                                const color = colormap.get(d.rank);
                                node.name("content")
                                    // .y(textY)
                                    .text(d.content)
                                    .fontSize(12)
                                    .padding(5)
                                    .fill(color);
                                maxWidth = Math.max(maxWidth, node.width());
                                // textY += node.height();
                            });

                        if (maxWidth > 150) {
                            maxWidth = 150;
                        }
                        ks.select(tooltip)
                            .selectAll(".content")
                            .each((d, i, nodes) => {
                                const node = nodes[i] as Konva.Text;
                                node
                                    .y(textY)
                                    .width(maxWidth);
                                textY += node.height();
                            });

                        background
                            .width(Math.max(maxWidth, title.width()))
                            .height(textY);
                        tooltip.show();
                    });
                    interactiveLink.on("mouseout", () => {
                        tooltip.hide();
                    });
                    g.addChild(interactiveLink);
                }
                interactiveLink.clear()
                    .moveTo(x1, y1)
                    .bezierCurveTo(cpx1, cpy1, cpx2, cpy2, x2, y2)
                    .stroke({ color: color, width: 5 });

                interactiveLink.alpha = 0;
            })
    }

    public render(resample: boolean = true, relayout: boolean = true, duration: number = 0) {
        // initialize && this.updateContainer();

        const showPerformance = false;

        showPerformance && console.log("==============================================");

        showPerformance && console.time("layout");
        relayout && this.applyLayout();
        showPerformance && console.timeEnd("layout");

        showPerformance && console.time("zooming");
        const valueX = 0; // 任意值都行，没什么用
        const valueY = this.scaleY(this.layout.globalConfig.labelLineHeight) - this.scaleY(0);
        semanticZooming.update(valueX, valueY);
        this.zooming = semanticZooming.getCurrentNode();
        showPerformance && console.timeEnd("zooming");

        showPerformance && console.time("sampling");
        let labels = resample ? this.sampling() : this.visibleLabels;
        showPerformance && console.timeEnd("sampling");

        showPerformance && console.time("updateScale");
        labels = this.addSelectedFigures(labels);
        this.updateScale(labels);
        
        showPerformance && console.timeEnd("updateScale");

        showPerformance && console.time("renderLabels");
        this.renderLabels(labels, duration);
        showPerformance && console.timeEnd("renderLabels");

        this.renderLinks($viewMode.get() === "focused" ? labels : undefined);
        // initialize && this._listenZoom();

        // this.renderEvents();
    }

    public applyLayout(scaleX?: ScaleTime, scaleY?: ScaleLinear) {
        const viewMode = $viewMode.get();
        const layout = this.layout;

        scaleX = scaleX ?? this.scaleX;
        scaleY = scaleY ?? this.scaleY;

        const cx = scaleX.invert(this.width * 0.5).getTime();
            const cy = scaleY.invert(this.height * 0.5);

        if (viewMode === "global") {
            layout.interpolate(this._zoom, [cx, cy], viewMode);
            this.totalHeight = layout.globalConfig.totalHeight * this.props.height;
            this.lineNumber = layout.globalConfig.lineNumber;
        }
        else {
            layout.solve_focused(scaleX, this.originScaleY);
            layout.interpolate(this._zoom, [cx, cy], viewMode);
        }
    }

    public sophisticatedZoom(domainX?: [Date, Date], domainY?: [number, number], duration: number = 0) {
        this.stopPropagation = true;
        const transform = this.getTransform(domainX, domainY);
        const transform0 = this._zoom!.getTransform();
        const labels = this.labels.slice();
        const tl = gsap.timeline();
        (transform0 as any).t = 0;
        (transform0 as any).t = 1;

        const targetScaleX = transform.rescaleX(this.originScaleX);
        const targetScaleY = transform.rescaleY(this.originScaleY);

        const globalPositions = this.layout.globalPositions;
        this.layout.labels = labels;
        this.layout.solve_focused(targetScaleX, this.originScaleY);
        const focusedPositions = this.layout.focusedPositions;

        console.log("?????");

        tl.to(transform0, {
            ...transform,
            duration: duration / 1000,
            onUpdate:() => {
                const t = (transform0 as any).t;
                this._zoom!.setTransform(transform0);
                this.domainX = transform0.rescaleX(this.originScaleX).domain() as [Date, Date];
                this.domainY = transform0.rescaleY(this.originScaleY).domain() as [number, number];
                // this.layout.customInterpolate(
                //     this.labels.slice(),
                //     globalPositions,
                //     focusedPositions,
                //     t
                // );
                this.render(true, false);
            },
            onComplete: () => {
                // this.render(true);
            }
        });
    }


    public updateLabels(labels: Label[], duration: number = 700) {
        // const oldLabels = this.labels;
        this.labels = labels;
        // this.visibleLabels = labels;

        const viewMode = $viewMode.get();

        // /** 隐藏exit部分 */
        // const { exit } = join(oldLabels, labels, d => d.datum.id);
        // for (const i of exit) {
        //     const label = oldLabels[i];
        //     label.visible = false;
        // }

        
       
        /** 更新缩放交互阈值 */
        
        const figuresClicked = $figuresClicked.get();
        if (viewMode === "focused") {
            /** 更新布局的目标 */
            const layout = this.layout;
            layout.labels = labels;
            layout.solve_global();
            layout.solve_single();
            this.totalHeight = layout.getTotalHeight(viewMode) * this.props.height;
            this.lineNumber = layout.globalConfig.lineNumber;
            
            /** 更新采样的全集 */
            this.updateSampleLabels(labels);

            const domainX: [Date, Date] = [
                Math.min(...figuresClicked.map(f => f.time[0].getTime())),
                Math.max(...figuresClicked.map(f => f.time[1].getTime())),
            ] as any;
            // @ts-ignore
            domainX[0] = new Date(domainX[0] - (domainX[1] - domainX[0]) * 0.1);
            // @ts-ignore
            domainX[1] = new Date(domainX[1] + (domainX[1] - domainX[0]) * 0.1);
            this.zoom(domainX, this.originScaleY.domain() as [number, number], duration);

            setTimeout(() => {
                this.totalHeight = layout.getTotalHeight(viewMode) * this.props.height;
                this.lineNumber = layout.globalConfig.lineNumber;
                this._listenZoom();
            }, duration);
        }
        else {
            /** 更新布局的目标 */
            const layout = this.layout;
            layout.labels = labels;
            layout.solve_global();
            layout.solve_single();
            this.totalHeight = layout.getTotalHeight(viewMode) * this.props.height;
            this.lineNumber = layout.globalConfig.lineNumber;

            /** 更新采样的全集 */
            this.updateSampleLabels(undefined);
            
            this._listenZoom();
        }
        // this._zoom!.setTransform(new Transform2D(
        //     0, 0, 1, 1
        // ));
        // this.domainX = this.originScaleX.domain() as [Date, Date];
        // this.domainY = this.originScaleY.domain() as [number, number];
        // const sy = viewMode === "global" ?
        //     Number.isNaN(this.lineNumber) ? 400 : (this.height / 3.2) / (this.totalHeight / this.lineNumber) :
        //     1;
        // this._zoom = this._zoom!
        //     .scaleExtentY([1, sy]);

        // /** 更新布局插值端点 */
        // this.layout.Ty = sy ** 0.85;


        // const viewMode = $viewMode.get();
        // if (viewMode === "global") {
        //     const [method, thisArgs] = $layoutMethod.get();
        //     this.relayout(method, thisArgs, 0);
        //     return;
        // }
        
        // this.layout.solve_focused(this.height, relatedFigureFontSize, this.scaleX);
        // this.applyLayout();

        // const labels = this.sampleLabels = $figures.get().map(f => this.id2label.get(f.id)!);
        // this.updateScale(labels);
        // labels.forEach((label) => {
        //     this.zooming.updateWidthAndHeight(label);
        // });
        // this.renderLabels(labels);

        // setTimeout(() => {
        //     this._zoom!.scaleExtentY([1, 1]);
        // }, 5);
        //     // .translateExtent()

    }

    public updateSampleLabels(labels?: Label[]) {
        if (labels !== undefined) {
            this.sampleLabels = labels;
            // this.visibleLabels = labels;
            return;
        }
        const figureContexts = $figureContexts.get();
        const currentLabels = this.labels;
        if (figureContexts !== null) {
            const figureSelected = $figuresSelected.get();
            const argsort = new Array(figureContexts.length).fill(0).map((_, i) => i)
                .sort((i, j) => {
                    if (figureContexts[i] === null && figureContexts[j] === null) {
                        return figureSelected.indexOf(currentLabels[i].datum) - figureSelected.indexOf(currentLabels[j].datum);
                    }
                    if (figureContexts[i] === null) {
                        return -1;
                    }
                    if (figureContexts[j] === null) {
                        return 1;
                    }
                    return (figureContexts[j].weight - figureContexts[i].weight) || (currentLabels[j].weight - currentLabels[i].weight);
                });
            labels = argsort.map(i => currentLabels[i]);
        }
        else {
            labels = currentLabels.slice().sort((a, b) => b.weight - a.weight);
        }
        this.sampleLabels = labels;
    }

    /** 根据当前的scaleX和scaleY筛选出当前显示窗口内的所有标签并进行采样，并设置景深 */
    public sampling() {

        if ($viewMode.get() === "focused") {
            return this.labels.slice();
        }

        /** 按照个人上下文的权重排序 */
        let labels: Label[] = this.sampleLabels;

        // scale相对于originScale缩放的倍数
        const kx = this.kx;
        const ky = this.ky;

        // initialPosition使用的是domain的值，所以需要将range转换为domain
        const dx = (this.originScaleX.domain()[1].getTime() - this.originScaleX.domain()[0].getTime()) / (this.originScaleX.range()[1] - this.originScaleX.range()[0]);
        const dy = (this.originScaleY.domain()[1] - this.originScaleY.domain()[0]) / (this.originScaleY.range()[1] - this.originScaleY.range()[0]);

        // 最终需要给标签的宽高缩放的倍数
        const rx = dx / kx;
        const ry = dy / ky;

        const xRange = this.scaleX.domain().map(t => t.getTime()) as [number, number];
        const yRange = this.scaleY.domain() as [number, number];
        labels = labels.filter((label) => {
            return (label.initialPosition.x2 >= xRange[0] && label.initialPosition.x1 <= xRange[1]) &&
                (label.initialPosition.y2 >= yRange[0] && label.initialPosition.y1 <= yRange[1]);
        });

        const sampling = new Sampling(
            xRange,
            yRange,
            [600, 300],
            1
        );

        const [result, levels] = sampling.solve(labels, (label) => {
            return this.zooming.getSamplingBBoxes(label, rx, ry);
        });
        labels = result;
        for (let i = 0; i < labels.length; i++) {
            labels[i].level = levels[i];
        }

        return labels;
    }


    getTransform(domainX?: [Date, Date], domainY?: [number, number]): Transform2D {
        domainX = domainX ?? this.domainX;
        domainY = domainY ?? this.domainY;

        const [x, kx] = (() => {
            const [x0, x1] = domainX.map(d => this.originScaleX(d));
            const [y0, y1] = this.originScaleX.range();
            const kx = (y1 - y0) / (x1 - x0);
            const b = y0 - kx * x0;
            return [b, kx];
        })();

        const [y, ky] = (() => {
            const [x0, x1] = domainY.map(d => this.originScaleY(d));
            const [y0, y1] = this.originScaleY.range();
            const ky = (y1 - y0) / (x1 - x0);
            const b = y0 - ky * x0;
            return [b, ky];
        })();
        return new Transform2D(x, y, kx, ky);
    }

    public zoom(domainX?: [Date, Date], domainY?: [number, number], duration: number = 0) {
        const tf = this.getTransform(domainX, domainY);
        this.stopPropagation = true;
        this._zoomEvent(tf, duration);
    }

    /**
     * 将标签缩放到视窗中心
     * @param label 待缩放的标签
     * @param duration 动画持续时间
     */
    public zoomToLabel(label: Label, duration: number = 1000) {
        const { x1, x2, y1, y2 } = this.layout.globalPositions.get(label.datum.id)!;
        const dw = (x2 - x1) * 0.3;
        const dh = (y2 - y1) * 2;
        const domainX = [new Date(x1 - dw), new Date(x2 + dw)] as [Date, Date];
        const domainY = [y1 - dh, y2 + dh] as [number, number];
        this.zoom(domainX, domainY, duration);
    }

    /**
     * 重新布局并触发动画过渡绘制
     * @param method 布局方法
     * @param thisArgs 布局上下文
     */
    relayout(method: keyof typeof layouts = "default", thisArgs: any, duration: number = 500) {
        const config = layouts[method].call(thisArgs);
        this.layout.updateConfig(
            config.lineNumber,
            (config as any).singleLineNumber,
            (config as any).order,
            (config as any).key
        );
        this.applyLayout();

        let labels = this.sampling();
        labels = this.addSelectedFigures(labels);
        this.updateScale(labels);
        this.renderLabels(labels, duration);

        const sy = Number.isNaN(this.lineNumber) ? 400 : Math.max(400, 200 / (this.totalHeight / this.lineNumber));
        this._zoom?.scaleExtentY([1, sy]);
    }
    

    /**
     * 初始化
     * @description （1）向DOM中添加canvas（如果没有的话）并配置pixijs
     * @description （2）将所有的标签添加到pixi的stage中
     * @description （3）设置canvas的宽高
     * @description （4）监听zoom事件
     * @returns 
     */
    private async _initialize() {
        const root = this.root;
        if (root === null) {
            return;
        }

        const width = this.width;
        const height = this.height;

        // root.style.position = "relative";

        // let foreignObject = root.querySelector("foreignObject");
        // if (foreignObject === null) {
        //     foreignObject = root.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "foreignObject"));
        // }
        // foreignObject.setAttribute("x", "0");
        // foreignObject.setAttribute("y", "0");
        // foreignObject.setAttribute("width", width.toString());
        // foreignObject.setAttribute("height", height.toString());
        // foreignObject.innerHTML = "";

        const pixi = this.pixi || new Application();
        await pixi.init({
            resolution: (window.devicePixelRatio || 1) * this.resolution,
            preserveDrawingBuffer: true,
            autoDensity: true,
            antialias: true,
            background: 0xffffff,
            width,
            height,
        });

        const stage = new Konva.Stage({
            container: root,
            width: width,
            height: height,
        });
        const layer = new Konva.Layer();
        stage.add(layer);
        this.konva = layer;
        
        this.eventsGroup = new Konva.Group({
            name: "events-group",
            listening: false,
        });
        layer.add(this.eventsGroup);

        // konvajs不监听事件，可以将交互加载pixijs的canvas上
        const div = root.querySelector(".konvajs-content") as HTMLDivElement;
        div.style.setProperty("pointer-events", "none");
        // pixi.renderer._roundPixels = 1;
        // pixi.stage.interactive = true;
        // root.setAttribute("viewBox", `0 0 ${width} ${height}`);
        // root.viewBox = `0 0 ${this.props.width * 2} ${this.props.height * 2}`;

        // background设置为非黑色的时候会触发一次绘制指令，进而导致屏幕闪烁。所以通过settimeout等待绘制完成之后再挂载到DOM中
        return new Promise<void>((resolve) => {
            setTimeout(() => {
                const width = this.props.width;
                const height = this.props.height;
                const canvas = root.insertBefore(pixi.canvas, root.firstChild);
                canvas.style.width = `${width}px`;
                canvas.style.height = `${height}px`;
                canvas.style.position = "absolute";
                this.pixi = pixi;
                $pixi.set(pixi);

                SharedTexture.init(pixi);

                for (const component of Object.values(components)) {
                    component.init();
                }

                this.labels.forEach((label) => {
                    layer.add(label.group);
                    const child = pixi.stage.addChild(label.container);
                    (child as any).__data__ = label.datum;
                    child.alpha = 0;
                });
                this.eventsContainer = new Container();
                this.eventsContainer.label = "events-container";
                this.eventsContainer.interactive = true;
                this.eventsContainer.zIndex = Number.MAX_VALUE;
                pixi.stage.addChild(this.eventsContainer);

                this.updateContainer();
                this.updateWeights();
                this._listenInteraction();
                this._listenZoom();

                resolve();
            }, 0);
        });
    }

    /** 监听各种状态变量的变化 */
    private _listenInteraction() {
        $figuresClicked.listen(() => {
            if ($viewMode.get() === "global") {
                this.layout.solve_single();
            }
            // else {
            //     const id2label = this.id2label;
            //     this.updateLabels($figures.get().map(f => id2label.get(f.id)!));
            // }
            // this.render(true);
        });
        $figuresTimeSelected.listen(() => {
            this.layout.solve_single();
            // this.render(true);
        });

        $historicalContexts.listen(() => {
            this.updateWeights();
            this.render(true);
        });

        $figureContexts.subscribe(() => {
            this.updateSampleLabels();
        });

        $layoutMethod.listen(() => {
            const [method, thisArgs] = $layoutMethod.value;
            this.relayout(method, thisArgs);
        });

        $locationSelected.listen(() => {
            this.visibleLabels.forEach((label) => {
                label.renderLocationIcon({ forceFlush: true } as any);
            });
            if (semanticZooming.y > 1) {
                this.visibleLabels.forEach((label) => {
                    label.renderLocationLine({ forceFlush: true } as any);
                });
            }
            // this.renderLabels(this.visibleLabels);
        });
        
        $eventSelected.listen(() => {
            const viewMode = $viewMode.get();
            const figuresClicked = $figuresClicked.get();
            for (const label of this.visibleLabels) {
                if (viewMode === "focused" && figuresClicked.find(f => f.id === label.datum.id) === undefined) continue;
                label.renderEvents({} as any);
            }
        });

        $viewMode.listen(() => {
            // this.switchView();
        });

        $figures.listen((figures) => {
            const id2label = this.id2label;
            this.updateLabels(figures.map(f => id2label.get(f.id)!));
            this.render(true);
        });

        $figureContexts.listen(() => {
            this.render(true);
        });

        $emitter.on("book-mark", ((transform: Transform2D) => {
            this.stopPropagation = true;
            this._zoomEvent(transform, 800);
        }) as any);

        $figureHovered.listen(() => {
            this.render(true);
        });
        // $figureClicked.listen((value, oldValue) => {
        //     // const id2label = this.id2label;
        //     // const { enter, exit } = join(oldValue, value, f => f.id);
        //     // for (const i of enter) {
        //     //     const label = id2label.get(value[i].id)!;
        //     //     label.fy = label.position.y1;
        //     // }
        //     // for (const i of exit) {
        //     //     const label = id2label.get(oldValue[i].id)!;
        //     //     label.fy = undefined;
        //     // }
        // });
    
    }

    /** 根据当前画布大小和布局的总高度设置或者更新zoom对象 */
    private _listenZoom() {
        const viewMode = $viewMode.get();
        const height = Math.max(this.props.height, this.totalHeight);
        const sy = viewMode === "global" ?
            Number.isNaN(this.lineNumber) ? 400 : (this.height / 3.2) / (this.totalHeight / this.lineNumber) :
            1;
        this.layout.Ty = sy ** 0.85;
        if (this._zoom !== null) {
            this._zoom
                .extent([
                    [0, 0],
                    [this.props.width, this.props.height],
                ])
                .translateExtent([
                    [0, 0],
                    [this.props.width, height],
                ])
                .scaleExtentY([1, sy]);
        }
        else {
            const zoom = zoom2D()
                .extent([
                    [0, 0],
                    [this.props.width, this.props.height],
                ])
                .scaleExtentX([1, Infinity])
                .scaleExtentY([1, sy])
                .axis(["x", "y"])
                .translateExtent([
                    [0, this.props.height - height],
                    [this.props.width, height],
                ])
                .filter((e: any) => !(e as KeyboardEvent).ctrlKey)
            zoom.on("zoom", (e: any) => {
                !this.stopPropagation && this._zoomEvent(e.transform, 0, true);
                this.stopPropagation = false;
            });
            zoom.on("end", (_: any) => {
                // this._zoomEvent(this._zoom!.getTransform(), 0, true);
            });

            this._zoom = zoom as Zoom2D;
            d3.select(this.root).call(zoom as any);
        }
    }

    private _zoomEvent (
        transform: Transform2D,
        duration = 0,
        resample = true,
        onend: (() => void) | null = null
    ) {
        $transform.set(transform);
        if (!this.stopPropagation) {
            this.domainX = transform.rescaleX(this.originScaleX).domain() as [Date, Date];
            this.domainY = transform.rescaleY(this.originScaleY).domain() as [number, number];
            this.render(resample);
            this.emit && this.emit["zoom"](this.domainX, this.domainY);
        } else {
            if (duration > 0) {
                const transform0 = this._zoom!.getTransform();
                const tl = gsap.timeline();

                tl.to(transform0, {
                    ...transform,
                    duration: duration / 1000,
                    onUpdate:() => {
                        this._zoom!.setTransform(transform0);
                        this.domainX = transform0.rescaleX(this.originScaleX).domain() as [Date, Date];
                        this.domainY = transform0.rescaleY(this.originScaleY).domain() as [number, number];
                        this.render(resample);
                    },
                    onComplete: () => {
                        !resample && this.render(true);
                        onend && onend();
                    }
                });
            } else {
                this._zoom!.setTransform(transform);
                this.domainX = transform.rescaleX(this.originScaleX).domain() as [Date, Date];
                this.domainY = transform.rescaleY(this.originScaleY).domain() as [number, number];
                this.render(true);
                onend && onend();
            }
        }
    }
}