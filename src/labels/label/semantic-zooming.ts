import Label from ".";
import { $figuresClicked, $figureContexts, $figuresSelected, $figureId2index } from "../../store";

const BASE_SIZE = 12;

export type SemanticZoomingEdgeSizeX = {
    mode: "size";
    /**
     * @param width 标签的宽度
     * @returns 非负数表示采纳右侧的节点，反之表示采纳左侧的节点
     */
    compare(width: number): number;
}

export type SemanticZoomingEdgeScaleX ={
    mode: "scale";
    /**
     * @param kx 当前缩放比例
     * @returns 非负数表示采纳右侧的节点，反之表示采纳左侧的节点
     */
    compare(kx: number): number;
}


export type SemanticZoomingEdgeSizeY = {
    mode: "size";
    /**
     * @param height 标签的高度
     * @returns 非负数表示采纳右侧的节点，反之表示采纳左侧的节点
     */
    compare(height: number): number;
}

export type SemanticZoomingEdgeScaleY = {
    mode: "scale";
    /**
     * @param ky 当前缩放比例
     * @returns 非负数表示采纳右侧的节点，反之表示采纳左侧的节点
     */
    compare(ky: number): number;
}


export type SemanticZoomingNode = {
    /**
     * 获得采样时使用的边界框列表
     * @description 在这一阶段，对于固定大小的标签已经可以决定其宽高，此时也会设置其宽高
     * @param label 标签对象
     * @param rx 固定的宽度在采样算法中的缩放比例
     * @param ry 固定的高度在采样算法中的缩放比例
     * @returns 
     */
    getSamplingBBoxes(label: Label, rx: number, ry: number): {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
    }[];

    /**
     * 更新标签的宽度和高度
     * @description 对于在getSamplingBBoxes阶段无法决定的宽高（主要是没有更新scale）进行更新
     * @param label 标签对象
     */
    updateWidthAndHeight(label: Label): void;

    /**
     * 在当前缩放网格下渲染标签
     * @param container 渲染的容器
     * @param label 标签对象
     */
    render(label: Label): void;
}


class SemanticZooming<EdgeX extends SemanticZoomingEdgeSizeX | SemanticZoomingEdgeScaleX, EdgeY extends SemanticZoomingEdgeSizeY | SemanticZoomingEdgeScaleY> {

    /** 网格的节点列表 */
    nodes: SemanticZoomingNode[][];
    /** 横向的边 */
    edgesX: EdgeX[];
    /** 纵向的边 */
    edgesY: EdgeY[];
    /** 当前所处的节点位置 */
    x: number;
    y: number;
    /** 选中人物时调用的渲染节点位置 */
    sx: number;
    sy: number;

    constructor(
        nodes: SemanticZoomingNode[][],
        edgesX: EdgeX[],
        edgesY: EdgeY[],
        sx: number = 0,
        sy: number = 0,
    ) {
        if (nodes.length !== edgesY.length + 1) {
            throw new Error("SemanticZooming: nodes.length !== edgesY.length");
        }
        for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].length !== edgesX.length + 1) {
                throw new Error("SemanticZooming: nodes[i].length !== edgesX.length");
            }
        }
        this.nodes = nodes;
        this.edgesX = edgesX;
        this.edgesY = edgesY;
        this.x = 0;
        this.y = 0;
        this.sx = sx;
        this.sy = sy;
    }

    hit(valueX: number, valueY: number) {
        let x = this.x;
        let y = this.y;
        while (true) {
            let x2 = x;
            let y2 = y;

            if (x < this.edgesX.length && this.edgesX[x].compare(valueX) >= 0) {
                x2 += 1;
            }
            if (x > 0 && this.edgesX[x - 1].compare(valueX) < 0) {
                x2 -= 1;
            }
            if (y < this.edgesY.length && this.edgesY[y].compare(valueY) >= 0) {
                y2 += 1;
            }
            if (y > 0 && this.edgesY[y - 1].compare(valueY) < 0) {
                y2 -= 1;
            }
            if (x2 === x && y2 === y) {
                break;
            }
            x = x2;
            y = y2;
        }
        return [x, y];
    }

    update(valueX: number, valueY: number) {
        const [x, y] = this.hit(valueX, valueY);
        if (this.x !== x || this.y !== y) {
            this.x = x;
            this.y = y;
            return true;
        }
        return false;
    }

    getCurrentNode() {
        return this.nodes[this.y][this.x];
    }

    getSelectedFigureNode() {
        return this.nodes[this.sy][this.sx];
    }
}

const nameOffsetYRate = -0.15;
const locationIconPaddingLeft = 0.0;

export default new SemanticZooming(
    [
        [
            {
                getSamplingBBoxes(label, rx, ry) {
                    const fontSize = label.name.fontSize,
                          width = label.name.visualWidth() + fontSize * (1 + locationIconPaddingLeft),
                          height = fontSize,
                          w = width * rx,
                          // y1: 时间线线段的位置（姓名的下边缘）
                          y1 = height * ry;

                    label.width = width;
                    label.height = height;
                    const px = Math.min(5, w * 0.1);
                    const py = Math.min(5, y1 * 0.1);
                    const bboxes = [
                        // 姓名 + 地点图标
                        {
                            x1: label.initialPosition.x1 - px,
                            y1: label.initialPosition.y1 - py,
                            x2: label.initialPosition.x1 + w + px,
                            y2: label.initialPosition.y1 + y1 + py,
                        },
                    ];
                    if ($figuresSelected.get().length > 0) {
                        // bboxes.push(
                        //     // 表示和选中人物关系的bar
                        //     {
                        //         x1: label.initialPosition.x1 - label.baseSize * 0.6 * rx,
                        //         y1: label.initialPosition.y1,
                        //         x2: label.initialPosition.x2,
                        //         y2: label.initialPosition.y1 + y1,
                        //     }
                        // );
                    }
                    return bboxes;
                },
                updateWidthAndHeight(label) {

                },
                render(label) {
                    const index = $figureId2index.get().get(label.datum.id)!,
                          context = $figureContexts.value === null ? undefined : $figureContexts.value![index],
                          name = label.name,
                          nameWidth = name.visualWidth(),
                          fontSize = name.fontSize,
                          id = label.datum.id,
                          mask = Boolean($figuresClicked.get().find(f => f.id === id));
                    label.render({
                        mask,
                        name: { x: fontSize * (1 + locationIconPaddingLeft), width: nameWidth, y: fontSize * nameOffsetYRate, height: fontSize, context },
                        selectedFiguresBar: { y: 0, height: fontSize, context },
                        statusIcon: { x: 0, y: 0, width: fontSize, height: fontSize },
                    });
                },
            },
        ],
        [
            {
                getSamplingBBoxes(label, rx, ry) {
                    const fontSize = label.name.fontSize,
                          width = label.name.visualWidth() + fontSize * (1 + locationIconPaddingLeft),
                          height = fontSize,
                          w = width * rx,
                          // y1: 时间线线段的位置（姓名的下边缘）
                          y1 = fontSize * ry;
                    label.height = y1 / ry;
                    const px = Math.min(5, w * 0.1);
                    const py = Math.min(5, y1 * 0.1);
                    const bboxes = [
                        // 姓名 + 地点图标
                        {
                            x1: label.initialPosition.x1 - px,
                            y1: label.initialPosition.y1 - py,
                            x2: label.initialPosition.x1 + w + px,
                            y2: label.initialPosition.y1 + y1 + py,
                        },
                        // // 时间线（单直线）
                        // {
                        //     x1: label.initialPosition.x1,
                        //     y1: label.initialPosition.y1 + y1,
                        //     x2: label.initialPosition.x2,
                        //     y2: label.initialPosition.y1 + y1,
                        // },
                    ];
                    if ($figuresSelected.get().length > 0) {
                        // bboxes.push(
                        //     // 表示和选中人物关系的bar
                        //     {
                        //         x1: label.initialPosition.x1 - label.baseSize * 0.6 * rx,
                        //         y1: label.initialPosition.y1,
                        //         x2: label.initialPosition.x2,
                        //         y2: label.initialPosition.y1 + y1,
                        //     }
                        // );
                    }
                    return bboxes;
                },
                updateWidthAndHeight(label) {
                    const position = label.position;
                    label.width = position.x2 - position.x1;
                },
                render(label) {
                    const index = $figureId2index.get().get(label.datum.id)!,
                          context = $figureContexts.value === null ? undefined : $figureContexts.value![index],
                          name = label.name,
                          nameWidth = name.visualWidth(),
                          fontSize = name.fontSize,
                          id = label.datum.id,
                          mask = Boolean($figuresClicked.get().find(f => f.id === id));
                    label.render({
                        mask,
                        name: { x: fontSize * (1 + locationIconPaddingLeft), width: nameWidth, y: fontSize * nameOffsetYRate, height: fontSize, context },
                        selectedFiguresBar: { y: 0, height: fontSize, context },
                        statusIcon: { x: 0, y: 0, width: fontSize, height: fontSize },
                        line: { y: label.height - 0.5, height: 1 },
                    });
                },
            }
        ],
        [
            {
                getSamplingBBoxes(label, rx, ry) {
                    const fontSize = label.name.fontSize,
                          width = label.name.visualWidth() + fontSize * (1 + locationIconPaddingLeft),
                          w = width * rx,
                          // y1: 时间线线段的位置（姓名的下边缘）
                          y1 = fontSize * ry,
                          // y2 & y3: location-icons时间线的上下边缘
                          y2 = y1 * 1.2,
                          y3 = y2 + BASE_SIZE * 1.2 * ry;

                    label.height = y3 / ry;

                    const bboxes = [
                        // 姓名 + 地点图标
                        {
                            x1: label.initialPosition.x1,
                            y1: label.initialPosition.y1,
                            x2: label.initialPosition.x1 + w,
                            y2: label.initialPosition.y1 + y1,
                        },
                        // 带地点图标的时间轴
                        {
                            x1: label.initialPosition.x1,
                            y1: label.initialPosition.y1 + y2,
                            x2: label.initialPosition.x2,
                            y2: label.initialPosition.y1 + y3,
                        },
                    ];
                    if ($figuresSelected.get().length > 0) {
                        // 表示和选中人物关系的bar
                        bboxes.push(
                            {
                                x1: label.initialPosition.x1 - label.baseSize * 0.6 * rx,
                                y1: label.initialPosition.y1,
                                x2: label.initialPosition.x2,
                                y2: label.initialPosition.y1 + y1,
                            }
                        );
                    }
                    return bboxes;
                },
                updateWidthAndHeight(label) {
                    const position = label.position;
                    label.width = position.x2 - position.x1;
                },
                render(label) {
                    const index = $figureId2index.get().get(label.datum.id)!,
                          context = $figureContexts.value === null ? undefined : $figureContexts.value![index],
                          name = label.name,
                          nameWidth = name.visualWidth(),
                          fontSize = name.fontSize,
                          id = label.datum.id,
                          mask = Boolean($figuresClicked.get().find(f => f.id === id));
                    const y1 = fontSize,
                          y2 = y1 * 1.2,
                          y3 = y2 + BASE_SIZE * 1.2;
                    label.render({
                        mask,
                        name: { x: fontSize * (1 + locationIconPaddingLeft), width: nameWidth, y: fontSize * nameOffsetYRate, height: y1, context },
                        selectedFiguresBar: { y: 0, height: y1, context },
                        statusIcon: { x: 0, y: 0, width: fontSize, height: fontSize },
                        description: { y: y2, height: y3 - y2 },
                        line: { y: label.height - 0.5, height: 1 },
                        // locationLine: { y: y2, height: y3 - y2, forceFlush: false },
                    });
                },
            }
        ],
        [
            {
                getSamplingBBoxes(label, rx, ry) {
                    const fontSize = label.name.fontSize,
                          width = label.name.visualWidth() + fontSize * (1 + locationIconPaddingLeft),
                          w = width * rx,
                          // y1: 时间线线段的位置（姓名的下边缘）
                          y1 = fontSize * ry,
                          // y2 & y3: location-icons时间线的上下边缘
                          y2 = y1 * 1.2,
                          y3 = y2 + BASE_SIZE * 1.2 * ry,
                          // y4 & y5: post-line的上下边缘
                          y4 = y3 + fontSize * 0.1 * ry,
                          y5 = y4 + BASE_SIZE * ry;

                    label.height = y5 / ry;

                    const bboxes = [
                        // 姓名 + 地点图标
                        {
                            x1: label.initialPosition.x1,
                            y1: label.initialPosition.y1,
                            x2: label.initialPosition.x1 + w,
                            y2: label.initialPosition.y1 + y1,
                        },
                        // 带地点图标的时间轴 + 带职位时间轴
                        {
                            x1: label.initialPosition.x1,
                            y1: label.initialPosition.y1 + y2,
                            x2: label.initialPosition.x2,
                            y2: label.initialPosition.y1 + y5,
                        },

                    ];
                    if ($figuresSelected.get().length > 0) {
                        // 表示和选中人物关系的bar
                        bboxes.push(
                            {
                                x1: label.initialPosition.x1 - fontSize * 0.6 * rx,
                                y1: label.initialPosition.y1,
                                x2: label.initialPosition.x2,
                                y2: label.initialPosition.y1 + y1,
                            }
                        );
                    }
                    return bboxes;
                },
                updateWidthAndHeight(label) {
                    const position = label.position;
                    label.width = position.x2 - position.x1;
                },
                render(label) {
                    const index = $figureId2index.get().get(label.datum.id)!,
                          context = $figureContexts.value === null ? undefined : $figureContexts.value![index],
                          name = label.name,
                          nameWidth = name.visualWidth(),
                          fontSize = name.fontSize,
                          id = label.datum.id,
                          mask = Boolean($figuresClicked.get().find(f => f.id === id));

                    const y1 = fontSize,
                          y2 = y1 * 1.2,
                          y3 = y2 + BASE_SIZE * 1.2,
                          y4 = y3 + fontSize * 0.1,
                          y5 = y4 + BASE_SIZE;

                    label.render({
                        mask,
                        name: { x: fontSize * (1 + locationIconPaddingLeft), width: nameWidth, y: fontSize * nameOffsetYRate, height: y1, context },
                        selectedFiguresBar: { y: 0, height: y1, context },
                        statusIcon: { x: 0, y: 0, width: fontSize, height: fontSize },
                        // locationIcon: { x: nameWidth + fontSize * locationIconPaddingLeft, y: 0, width: fontSize, height: fontSize },
                        // locationLine: { y: y2, height: y3 - y2, forceFlush: false },
                        description: { y: y2, height: y3 - y2 },
                        eventLine: { y: y4, height: y5 - y4 },
                        // postLine: { y: y4, height: y5 - y4 },
                    });
                },
            }
        ],
        [
            {
                getSamplingBBoxes(label, rx, ry) {
                    const fontSize = label.name.fontSize,
                          width = label.name.visualWidth() + fontSize * (1 + locationIconPaddingLeft),
                          w = width * rx,
                          // y1: 时间线线段的位置（姓名的下边缘）
                          y1 = fontSize * ry,
                          y2 = y1 * 1.2,
                          y3 = y2 + BASE_SIZE * 1.2 * ry,
                          y4 = y3 + fontSize * 0.1 * ry,
                          y5 = y4 + BASE_SIZE * ry,
                          y6 = y5 + BASE_SIZE * ry;

                    label.height = y6 / ry;

                    const bboxes = [
                        // 姓名 + 地点图标
                        {
                            x1: label.initialPosition.x1,
                            y1: label.initialPosition.y1,
                            x2: label.initialPosition.x1 + w,
                            y2: label.initialPosition.y1 + y1,
                        },
                        // relation-bar + 带地点图标的时间轴 + 带职位时间轴
                        {
                            x1: label.initialPosition.x1,
                            y1: label.initialPosition.y1 + y2,
                            x2: label.initialPosition.x2,
                            y2: label.initialPosition.y1 + y6,
                        },

                    ];
                    if ($figuresSelected.get().length > 0) {
                        // 表示和选中人物关系的bar
                        bboxes.push(
                            {
                                x1: label.initialPosition.x1 - fontSize * 0.6 * rx,
                                y1: label.initialPosition.y1,
                                x2: label.initialPosition.x2,
                                y2: label.initialPosition.y1 + y1,
                            }
                        );
                    }
                    return bboxes;
                },
                updateWidthAndHeight(label) {
                    const position = label.position;
                    label.width = position.x2 - position.x1;
                },
                render(label) {
                    const index = $figureId2index.get().get(label.datum.id)!,
                          context = $figureContexts.value === null ? undefined : $figureContexts.value![index],
                          name = label.name,
                          nameWidth = name.visualWidth(),
                          fontSize = name.fontSize,
                          id = label.datum.id,
                          mask = Boolean($figuresClicked.get().find(f => f.id === id));

                    const y1 = fontSize,
                          y2 = y1 * 1.2,
                          y3 = y2 + BASE_SIZE * 1.2,
                          y4 = y3 + fontSize * 0.1,
                          y5 = y4 + BASE_SIZE,
                          y6 = y5 + BASE_SIZE;
                    
                    label.render({
                        mask,
                        name: { x: fontSize * (1 + locationIconPaddingLeft), width: nameWidth, y: fontSize * nameOffsetYRate, height: y1, context },
                        selectedFiguresBar: { y: 0, height: y1, context },
                        statusIcon: { x: 0, y: 0, width: fontSize, height: fontSize },
                        description: { y: y2, height: y3 - y2 },
                        locationAreaChart: { y: y4, height: y5 - y4 },
                        eventLine: { y: y5, height: y6 - y5 },
                        // locationIcon: { x: nameWidth + fontSize * locationIconPaddingLeft, y: 0, width: fontSize, height: fontSize },
                        // locationLine: { y: y2, height: y3 - y2, forceFlush: false },
                        // postLine: { y: y4, height: y5 - y4 },
                        // relationBar: { y: yr1, height: yr2 - yr1 },
                    });
                },
            }
        ],
        [
            {
                getSamplingBBoxes(label, rx, ry) {
                    const fontSize = label.name.fontSize,
                          width = label.name.visualWidth() + fontSize * (1 + locationIconPaddingLeft),
                          initialPosition = label.initialPosition,
                          w = width * rx,
                          H = initialPosition.y2 - initialPosition.y1,
                          // y1: 时间线线段的位置（姓名的下边缘）
                          y1 = fontSize * ry,
                          // y2 & y3: location-icons时间线的上下边缘
                          y2 = y1 * 1.2,
                          y3 = y2 + BASE_SIZE * 1.2 * ry,
                          // y4 & y5: post-line的上下边缘
                          y4 = y3 + fontSize * 0.1 * ry,
                          y5 = y4 + BASE_SIZE * ry,
                          y6 = y5 + BASE_SIZE * ry,
                          y7 = H;

                    label.height = Math.max(y7, y6) / ry;

                    const bboxes = [
                        // 姓名 + 地点图标
                        {
                            x1: label.initialPosition.x1,
                            y1: label.initialPosition.y1,
                            x2: label.initialPosition.x1 + w,
                            y2: label.initialPosition.y1 + y1,
                        },
                        // relation-bar + 带地点图标的时间轴 + 带职位时间轴
                        {
                            x1: label.initialPosition.x1,
                            y1: label.initialPosition.y1 + y2,
                            x2: label.initialPosition.x2,
                            y2: label.initialPosition.y1 + y7,
                        },
                    ];
                    if ($figuresSelected.get().length > 0) {
                        // 表示和选中人物关系的bar
                        bboxes.push(
                            {
                                x1: label.initialPosition.x1 - fontSize * 0.6 * rx,
                                y1: label.initialPosition.y1,
                                x2: label.initialPosition.x2,
                                y2: label.initialPosition.y1 + y1,
                            }
                        );
                    }
                    return bboxes;
                },
                updateWidthAndHeight(label) {
                    const position = label.position;
                    label.width = position.x2 - position.x1;
                },
                render(label) {
                    const index = $figureId2index.get().get(label.datum.id)!,
                          context = $figureContexts.value === null ? undefined : $figureContexts.value![index],
                          name = label.name,
                          nameWidth = name.visualWidth(),
                          fontSize = name.fontSize,
                          id = label.datum.id,
                          mask = Boolean($figuresClicked.get().find(f => f.id === id));
                    const H = label.height,
                          y1 = fontSize,
                          y2 = y1 * 1.2,
                          y3 = y2 + BASE_SIZE * 1.2,
                          y4 = y3 + fontSize * 0.1,
                          y5 = y4 + BASE_SIZE,
                          y6 = y5 + BASE_SIZE,
                          y7 = H;

                    label.render({
                        mask,
                        name: { x: fontSize * (1 + locationIconPaddingLeft), width: nameWidth, y: fontSize * nameOffsetYRate, height: y1, context },
                        selectedFiguresBar: { y: 0, height: y1, context },
                        statusIcon: { x: 0, y: 0, width: fontSize, height: fontSize },
                        description: { y: y2, height: y3 - y2 },
                        locationAreaChart: { y: y4, height: y5 - y4 },
                        eventLine: { y: y5, height: y6 - y5 },
                        events: { y: y6, height: y7 - y6 },
                    });
                },
            }
        ],
    ],
    [
        
    ],
    [
        {
            mode: "size",
            compare(h) {
                return h;
            }
        },
        {
            mode: "size",
            compare(h) {
                return h - 15;
            }
        },
        {
            mode: "size",
            compare(h) {
                return h - 90;
            }
        },
        {
            mode: "size",
            compare(h) {
                return h - 110;
            }
        },
        {
            mode: "size",
            compare(h) {
                return h - 150;
            }
        },

        // {
        //     mode: "scale",
            
        //     compare(ky) {
        //         return ky - 3;
        //     }
        // },
        // {
        //     mode: "scale",
        //     compare(ky) {
        //         return ky - 6;
        //     }
        // },
        // {
        //     mode: "scale",
        //     compare(ky) {
        //         return ky - 8;
        //     }
        // },
        // {
        //     mode: "scale",
        //     compare(ky) {
        //         return ky - 14;
        //     }
        // },
        // {
        //     mode: "scale",
        //     compare(ky) {
        //         return ky - 75;
        //     }
        // },
    ],
    0, 5 // sx, sy (选中人物时调用的渲染节点位置）
)