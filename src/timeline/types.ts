import TimelineTick from "./single/timeline-tick";
import TimelineLabel from "./single/timeline-label";
import { ScaleTime } from "../types";
import SingleLine from "./single";

export type {
    ScaleTime,
    ScaleLinear,
    Transform,
    OriginEventDatum,
    OriginRelation,
    OriginPost,
    OriginLocation,
    OriginFigure,
    Location,
    Post,
    Relation,
    Relationship,
    Event,
    Figure,
} from "../types";

export interface SubTimelineDatum {
    idx: number;
    /** 名称 */
    name: string | null;
    /** 分组 */
    groupId: string;
    /** 分组对象 */
    group: SubTimelineGroup;
    /** 高度 */
    height: number;
    /** 自定义初始化（返回结果会写入SubTimeline的context中） */
    init?: () => any;
    /** 刻度 */
    ticks: TimelineTick[];
    /** 自定义的渲染刻度函数（优先级高于ticks） */
    ticksRenderer?: (this: SingleLine, ctx: CanvasRenderingContext2D, scale: d3.ScaleTime<number, number>) => void;
    /** 标签 */
    labels: TimelineLabel[][];
    /** 自定义的渲染标签函数（优先级高于labels） */
    labelsRenderer?: (this: SingleLine, ctx: CanvasRenderingContext2D, scale: d3.ScaleTime<number, number>) => void;
    /** 是否显示刷选框 */
    showBrush: boolean;
    /** 是否显示遮罩 */
    showMask?: boolean;
    /** 遮罩如何显示 */
    maskType?: "brush" | "domain";
    /** 位置 */
    side: "top" | "bottom";

    /** 分组信息 */
    g?: SubTimelineGroup;
}

export interface SubTimelineGroup {
    /** id */
    id: string;
    /** 定义域 */
    domain: [Date, Date];
    /** 值域 */
    range: [number, number];
    /** 比例尺 */
    scale: ScaleTime;
    /** 初始比例尺 */
    originScale: ScaleTime;
    /** 影响的分组 */
    effect: string;
    /** 是否可刷选 */
    brush: boolean;
    /** 刷选的定义域范围 */
    brushDomain: [Date, Date] | null;
    /** 是否可缩放 */
    scalable: boolean;
    /** 属于该组的子时间轴 */
    timelines: SubTimelineDatum[];
}

