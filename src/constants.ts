import { Location } from "./types";
import EarthCoordinate from "./utils/EarthCoordinate";
import SVGTextLength from "./utils/SVGTextLength";
import * as d3 from "d3";
export const GROUP_LABEL = "GROUP_LABEL";
export const color = "#6f4922";
export const bgcolor = "#ab8c70";
export const light_bgcolor = "#e6dcd4";
export const domainX: [Date, Date] = [new Date("0900-01-01"), new Date("1290-01-01")];
export const domainY: [number, number] = [0, 1];
export const svgTextLength = new SVGTextLength();

/** 分辨率（取值越大绘制越精细，但是绘制效率也会急剧下降甚至会崩溃。尽量设置在1-2之间） */
export const resolution = 1.2;

export const capitals = Object.assign([
    {
        id: 11027,
        name: "開封府",
        en: "Kaifeng Prefecture",
        time: null,
        start: new Date('1053'),
        end: new Date('1119'),
        coordinate: new EarthCoordinate(114.34333, 34.785477),
        parents: [
            { "id": 11026, "name": "京畿路" },
            { "id": 10989, "name": "宋朝" },
        ]
    },
    {
        id: 100658,
        name: "開封",
        en: "Kaifeng",
        time: null,
        start: new Date('960'),
        end: new Date('1119'),
        coordinate: new EarthCoordinate(114.34333, 34.785477),
        parents: [
            { "id": 11027, "name": "開封府" },
            { "id": 11026, "name": "京畿路" },
            { "id": 10989, "name": "宋朝" },
        ]
    },
    {
        id: 12671,
        name: "臨安府",
        en: "Lin'an Prefecture",
        time: null,
        start: new Date('1129'),
        end: new Date('1279'),
        coordinate: new EarthCoordinate(120.168625, 30.294125),
        parents: [
            { "id": 12669, "name": "兩浙西路" },
            { "id": 10989, "name": "宋朝" }
        ]
    },
    {
        id: 100512,
        name: "臨安",
        en: "Lin'an",
        time: null,
        start: new Date('980'),
        end: new Date('1279'),
        coordinate: new EarthCoordinate(119.71658, 30.318827),
        parents: [
            { "id": 101088, "name": "杭州" },
            { "id": 12669, "name": "兩浙西路" },
            { "id": 10989, "name": "宋朝" },
        ],
    },
], {
    maxDate: new Date("1279"),
    minDate: new Date("960"),
    getCurrent: function (t1: Date, t2?: Date) {
        if (!t2) {
            t2 = t1;
        }
        t1 = new Date(Math.min(this.maxDate.getTime(), Math.max(this.minDate.getTime(), t1.getTime())));
        t2 = new Date(Math.min(this.maxDate.getTime(), Math.max(this.minDate.getTime(), t2.getTime())));
        const result = (this as unknown as any[]).find((d) => {
            return d.start <= t2 && d.end >= t1;
        });
        return result;
    }
});

export const locationColorMap = {
    defaultAddress: {
        id: -1,
        name: "[Capital]",
        en: "[Capital]",
        time: null,
        coordinate: new EarthCoordinate(0, 0),
        parents: [],
    },
    domain: [1, 300],
    maxDistance: 2000,
    range: ["#f15447", "#606060"],
};

export const getEmptyLocation = () => ({
    id: -2,
    name: "",
    en: "",
    time: null,
    coordinate: null as any,
    parents: [],
}) as Location;

export const colormap = d3.schemeTableau10;

export const relationScoreColormap = new Map([
    [2, "#AF1F28"],
    [1, "#E97A66"],
    [0, "#a1a1a1"],
    [-1, "#A3C0E0"],
    [-2, "#083F75"]
]);


export const en_dict = {
    "time": "Time",
    "locations": "Location",
    "posts": "Post",
    "relations": "Relation",
    "weight": "Weight",
    "TimeScape": "TimeScape",
    "enter figure name": "Enter figure name",
    "unknown": "Unknown",
    "birth": "Birth",
    "been": "Been",
    "[Capital]": "[Capital]",
    "皇帝": "Emperor",
    "文官": "Official",
    "武將": "General",
    "宗室": "Royalty",
    "后妃": "Consort",
    "學者": "Scholar",
    "宦官": "Eunuch",
    "僧道": "Monk",
    "布衣": "Commoner",
    "其他": "Other",
    "请输入关键词": "Enter keywords",
    "default": "Default",
    "byLocation": "Location",
    "byTime": "Time",
    "layout": "Layout",
    "bookmarks": "Bookmarks",
    "data filters": "Data Filters",
    "context info": "Context Info",
    "selected figure info": "Selected Figure Info",
}

export const zh_dict = {
    "time": "时间",
    "locations": "地点",
    "posts": "官职",
    "relations": "关系",
    "weight": "权重",
    "TimeScape": "宋代人物时间线",
    "enter figure name": "请输入人名",
    "unknown": "未知",
    "birth": "籍贯",
    "been": "驻所",
    "[Capital]": "[都城]",
    "皇帝": "皇帝",
    "文官": "文官",
    "武將": "武將",
    "宗室": "宗室",
    "后妃": "后妃",
    "學者": "學者",
    "宦官": "宦官",
    "僧道": "僧道",
    "布衣": "布衣",
    "其他": "其他",
    "请输入关键词": "请输入关键词",
    "default": "默认",
    "byLocation": "按地点",
    "byTime": "按时间",
    "layout": "布局",
    "bookmarks": "书签",
    "data filters": "数据筛选",
    "context info": "上下文信息",
    "selected figure info": "选中人物信息",
}