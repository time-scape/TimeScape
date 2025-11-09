import Label from "./labels/label";
import Transform2D from "./labels/utils/transform2D";
import EarthCoordinate from "./utils/EarthCoordinate";

export type ScaleTime = d3.ScaleTime<number, number>;
export type ScaleLinear = d3.ScaleLinear<number, number>;
export type Transform = d3.ZoomTransform;

export interface OriginEventDatum {
    /** 事件时间 */
    time: string | null;
    /** 事件类型 */
    type: string;
    /** 事件描述 */
    description: string;
    /** 事件简短描述 */
    short_description: string;
    /** 事件涉及的地点列表 */
    locations: OriginLocation[];
    /** 传主被授予的官职列表 */
    posts: OriginPost[];
    /** 传主辞去的官职列表 */
    eposts: OriginPost[];
    /** 事件涉及的相关人物 */
    relations: OriginRelation[];
}

export interface OriginRelation {
    /** 相关人物id */
    id: number;
    /** 相关人物名称 */
    name: string;
    /** 相关人物英文名称 */
    en_name: string;
    /** 相关人物类型 */
    type: string;
    /** 关系评分（-2 ~ 2） */
    rate: number;
    /** 关系描述 */
    description: string;
}

export interface OriginPost {
    /** 官职id */
    id: number;
    /** 官职名称 */
    name: string;
    /** 官职英文名称 */
    en_name: string;
    /** 实际官职名称（可能带有任职地点信息，例如“江宁知府”） */
    org_name: string;
    /** 官职别名 */
    alter_names: string | null;
    /** 所属层级 */
    hierarchy: {
        /** 层级id */
        id: string;
        /** 层级名称 */
        name: string;
        /** 层级英文名称 */
        en_name: string;
    }[];
}

export interface OriginLocation {
    /** 地点id */
    id: number;
    /** 地点名称 */
    name: string;
    /** 地点英文名称 */
    en_name: string;
    /** 地点坐标 */
    coordinate: [number, number] | null;
    /** 地点层级 */
    hierarchy: {
        /** 层级id */
        id: number;
        /** 层级名称 */
        name: string;
        /** 层级英文名称 */
        en_name: string;
    }[];
}

/** 原始数据 */
export interface OriginFigure {
    /** 人物id */
    id: number;
    /** 人物名称 */
    name: string;
    /** 人物英文名称 */
    en_name: string;
    /** 人物类型 */
    type: string;
    /** 人物出生时间 */
    birth: string;
    /** 人物死亡时间 */
    death: string;
    /** 人物出生地 */
    birthplace: OriginLocation;
    /** 人物描述 */
    description: string;
    /** 人物经历的事件 */
    events: OriginEventDatum[];
    /** 人物权重 */
    weight: number;
}

/** 地点 */
export interface Location {
    /** 地点id */
    id: number;
    /** 地点名称（已经切换中英文） */
    name: string;
    /** 在该地点的起始时间（用于上下文的计算） */
    time: Date | null;
    /** 坐标 */
    coordinate: EarthCoordinate;
    /** 地点上级列表 */
    parents: {
        id: number;
        name: string;
        en_name: string;
    }[];
}

export interface Institution {
    /** 机构id */
    id: string;
    /** 机构名称（已经切换中英文） */
    name: string;
}

/** 职位 */
export interface Post {
    /** 职位id */
    id: number;
    /** 职位开始时间 */
    time: Date | null;
    /** 职位名称（已经切换中英文） */
    name: string;
    /** 职位原名称（不带有地点信息的。e.g.当职位名称是“江宁知府”时，职位原名称是“知府” */
    postName: string;
    /** 职位结束时间 */
    endTime: Date | null;
    /** 职位所属机构层级列表 */
    institutions: Institution[];
    /** 官职品级 */
    rank: number;
}

/** 人物关系数据 */
export type Relation = {
    /** 人物关系出现的时间 */
    time: Date | null;
    /** 关联人物id */
    id: number;
    /** 关联人物名称 */
    name: string;
    /** 关系类型 */
    type: string;
    /** 评分 */
    score: number;
    /** 关系描述 */
    description: string;
}

/** 单个事件的数据 */
export interface Event {
    /** 事件id */
    id: number;
    /** 事件时间 */
    time: Date;
    /** 事件描述） */
    description: string;
    /** 事件简短描述 */
    short_description: string;
    /** 事件类型 */
    type: string;
    /** 事件详细类型 */
    subtype: string;
    /** 事件重要性 */
    importance: number;
    /** 事件显示大小（绝对数值没有意义，可以当做比例参考） */
    size: number;
    /** 事件发生地点 */
    locations: Location[];
    /** 职位（当事件类型为任職的时候会有） */
    posts: Post[];
    /** 事件相关人物 */
    relations: Relation[];
}

export type Relationship = Relation;

/** 单个人物的数据 */
export interface Figure {
    /** 人物id（沿用CBDB的c_personid） */
    id: number;
    /** 人物名称 */
    name: string;
    /** 人物生卒年 */
    time: [Date, Date];
    /** 人物类型 */
    type: string;
    /** 人物出生地 */
    birthplace: Location | null;
    /** 人物权重（归一化） */
    weight: number;
    /** 人物描述 */
    description: string;
    /** 人物的总历史上下文权重 */
    totalHistoricalContextWeight: number;
    /** 人物经历的事件 */
    events: Event[];
    /** 地点 */
    locations: Location[];
    /** 职位 */
    posts: Post[];
    /** 相关人物 */
    relations: Relationship[];
    /** 初始布局顺序，key表示布局的方法，value的大小表示线性布局的顺序 */
    layout: {
        [key: string]: number;
    }
    /** 社会地位等级（和官职挂钩） */
    status: number;
}

export type LayoutConfig = {
    order: (a: Label, _1: number, b: Label, _2: number) => number;
    lineNumber: (label: Label) => number;
} | {
    key: (label: Label, i: number, n: number) => number,
    lineNumber: (label: Label) => number;
}

export interface LayoutConfigGenerator {
    (this: any): LayoutConfig;
}

export type InstitutionNode = { // 非叶节点
    parent: InstitutionNode | null;
    value: Institution;
    count: number; // 该职位在所有人物中出现的次数
    figCount: number; // 拥有该职位的人的数量
    figFilteredCount: number; // 拥有该职位的人的数量（经过筛选）
    children: (InstitutionNode | PostNode)[];
}

export type PostNode = { // 叶节点
    parent: InstitutionNode | null;
    value: Post;
    count: number; // 该职位在所有人物中出现的次数
    figCount: number; // 拥有该职位的人的数量
    figFilteredCount: number; // 拥有该职位的人的数量（经过筛选）
}

export type TimeSelected = [Date, Date] | null;

export type LocationSelected = {
    location: Location, // 选中的地点对象
    mode: "birth" | "been" // 选中地点的模式（出生地或曾经去过的地点）
    distance: number // 选中地点的距离
};

export type keywordInfos = Set<number>;

export type PostSelected = InstitutionNode | PostNode | null;

export type FiguresTimeSelected = Map<number, [Date, Date]>;

export type FiguresSelectedColorMap = Map<number, string>;

export type EventSelected = {
    /** 事件所在的人物 */
    figure: Figure;
    /** 事件在人物事件列表中的索引 */
    idx: number;
} | null;

export type LocationInfos = Map<number, { center: EarthCoordinate, locate: EarthCoordinate | null }>

export type HistoricalContextWeights = {
    /** 时间的权重 */
    time: number;
    /** 官职的权重 */
    posts: number;
    /** 关系的权重 */
    relations: number;
}

export type FigureContextWeights = {
    /** 时间的权重 */
    time: number;
    /** 官职的权重 */
    posts: number;
    /** 地点的权重 */
    locations: number;
    /** 关系的权重 */
    relations: number;
}

export type HistoricalContext = {
    weight: number;
    time: {
        weight: number;
        time: Date[];
    };
    posts: {
        weight: number;
        posts: {
            post: Post;
            time: Date[];
            probability: number;
        }[];
    };
    relations: {
        weight: number;
        relations: ({
            relation: Relation;
            time: null;
            probability: number;
        } | {
            relation: Relation;
            time: Date;
            probability: number;
        })[];
    };
} & {
    r: number;
    _w: number;
}

export type HistoricalContexts = HistoricalContext[] & {
    maxWeight: number;
    _maxW: number;
    maxWs: {
        time: number;
        posts: number;
        relations: number;
    };
    minWeight: number;
};

export type FigureContext = {
    weight: number;
    time: {
        weight: number;
        time: [Date, Date];
    };
    locations: {
        weight: number;
        locations: {
            location: Location;
            time: [Date, Date];
            probability: number;
        }[];
    };
    posts: {
        weight: number;
        posts: {
            post: Post | Institution;
            postSelected: Post | Institution;
            time: [Date, Date];
            probability: number;
        }[];
    };
    relations: {
        weight: number;
        relations: {
            relation: Relationship;
            time: Date | null;
            probability: number;
        }[];
    };
    events: {
        time: Date;
        timeRange: [Date, Date];
        probability: number;
        locations: Location[];
        posts: [Post | Institution, Post | Institution][];
        relations: Relationship[];
    }[];
}[] & {
    weight: number;
};

export type FigureContexts = FigureContext[] & {
    maxWeight: number;
    minWeight: number;
    maxWs: {
        time: number;
        posts: number;
        locations: number;
        relations: number;
    };
};

export type BookMark = {
    /** 书签 ID */
    id: number;
    /** 书签名称 */
    name: string;
    /** 书签对应的缩放 */
    transform: Transform2D;
    /** 书签对应的截图 */
    screenshot: HTMLCanvasElement;
    /** 视图模式 */
    viewMode: "global" | "focused";
}