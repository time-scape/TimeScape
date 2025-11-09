import { computed } from "nanostores";
import { SubTimelineDatum, SubTimelineGroup } from "./timeline/types";
import Tick from "./timeline/single/timeline-tick";
import date from "./utils/date";
import * as d3 from "d3";
import TextRangeLabelBuilder from "./timeline/single/timeline-label-builders/text-range-label-builder";
import TextPointLabelBuilder from "./timeline/single/timeline-label-builders/text-point-label-builder";
import TextRange2LabelBuilder from "./timeline/single/timeline-label-builders/text-range2-label-builder";
import { GROUP_LABEL, color, domainX, light_bgcolor } from "./constants";
import * as store from "./store";

import {Event, OriginEventDatum, OriginFigure, Figure, Location} from "./timeline/types";
import EarthCoordinate from "./utils/EarthCoordinate";
import * as loader from "./utils/loader";
import { historicalOverlap } from "./utils/similarity";
import PostParser from "./utils/PostParser";
import { Institution } from "./types";
import { EventTypeGlyph, FigureTypeGlyph } from "./components/glyphs";
import generate from "./utils/fakeData";
import SingleLine from "./timeline/single";

interface Period {
    name: string;
    en: string;
    start: Date;
    end: Date;
}

type TimelineEvent =  {
    event: string;
    en: string;
    time: Date | [Date, Date];
    importance?: number;
}

const yearFormat = computed(store.$language, language => language === "en" ? " A.D." : "年");

export async function getTimelines(width: number, baseHeight: number = 20) {
    const height = baseHeight;
    const en = store.$language.get() === 'en';

    /** 读取数据 */
    const emperors: Period[] = await d3.json<any>("./data/emperors.json").then(emperors => {
        return emperors.map((e: any): Period => {
            return {
                name: e.name,
                en: e.en,
                start: date.string2Date(e.start),
                end: date.string2Date(e.end),
            };
        });
    });
    const nianhao: Period[] = await d3.json<any>("./data/nianhao.json").then(nianhao => {
        return nianhao.map((e: any): Period => {
            return {
                name: e.name,
                en: e.en,
                start: date.string2Date(e.start),
                end: date.string2Date(e.end),
            };
        });
    });
    const events: TimelineEvent[] = await d3.json<any>("./data/events.json").then(events => {
        return events.map((e: any): TimelineEvent => {
            if (e.time !== undefined) {
                return {
                    event: e.event,
                    en: e.en,
                    time: date.string2Date(e.time),
                    importance: e.importance,
                };
            }
            else {
                return {
                    event: e.event,
                    en: e.en,
                    time: [date.string2Date(e.start), date.string2Date(e.end)],
                    importance: e.importance,
                };
            }
        });
    });

    const timelines: SubTimelineDatum[] & { height: number; } = [
        {
            idx: -1,
            name: "事件",
            groupId: "g1",
            height: height,
            ticks: [],
            labels: [
                events.flatMap(e => {
                    if (e.time instanceof Date) {
                        return TextPointLabelBuilder.create()
                            .attr("time", e.time)
                            .attr("importance", e.importance || 1)
                            .attr("subTimelineWidth", width)
                            .attr("subTimelineHeight", height)
                            .attr("text", en ? e.en : e.event)
                            .attr("opacity", 1)
                            .build();
                    }
                    else {
                        const offsetY: number = e.event === "元丰改制" ? 5 : 0;
                        return TextRange2LabelBuilder.create()
                            .attr("time", e.time)
                            .attr("importance", e.importance || 1)
                            .attr("subTimelineWidth", width)
                            .attr("subTimelineHeight", height)
                            .attr("rangeOffsetY", offsetY)
                            .attr("text", en ? e.en : e.event)
                            .attr("opacity", 1)
                            .build();
                    }
                })
            ],
            showBrush: true,
            showMask: true,
            side: "bottom",
        },
        {
            idx: -1,
            name: "帝王",
            groupId: "g1",
            height: height,
            ticks: [],
            labels: [
                emperors.flatMap(p => {
                    return TextRangeLabelBuilder.create()
                        .attr("text", en ? p.en : p.name)
                        .attr("subTimelineWidth", width)
                        .attr("subTimelineHeight", height)
                        .attr("opacity", p.name === "五代十国" || p.name === "南宋" ? 0.5 : 1)
                        .attr("time", [p.start, p.end])
                        .build();
                }).map(label => {
                    return label.attr("maxK", 5);
                }),

                emperors.flatMap(p => {
                    return TextRangeLabelBuilder.create()
                        .attr("text", en ? p.en : p.name)
                        .attr("textBaseline", "bottom")
                        .attr("textAlignment", "left")
                        .attr("subTimelineWidth", width)
                        .attr("subTimelineHeight", height)
                        .attr("opacity", 0.3)
                        .attr("time", [p.start, p.end])
                        .build();
                }).map(label => {
                    return label.attr("minK", 5);
                }),

                nianhao.flatMap(p => {
                    return TextRangeLabelBuilder.create()
                        .attr("text", en ? p.en : p.name)
                        .attr("subTimelineWidth", width)
                        .attr("subTimelineHeight", height)
                        .attr("opacity", 1)
                        .attr("time", [p.start, p.end])
                        .build();
                }).map(label => {
                    return label.attr("minK", 5);
                })
            ],
            showBrush: false,
            showMask: true,
            maskType: "domain",
            side: "bottom",
        },
        {
            idx: -1,
            name: "年份",
            groupId: "g1",
            height: Math.max(height * 1.2, 0),
            ticks: [
                Tick.create()
                    .is(
                        t => t.getFullYear() % 100 === 0,
                        "100y",
                    )
                    .tickLength(height * 0.25)
                    .fontsize(height * 0.4)
                    .tickFormat(t => `${t.getFullYear()}${yearFormat.get()}`),
                Tick.create()
                    .is(
                        t => t.getFullYear() % 100 !== 0 && t.getFullYear() % 10 === 0,
                        "10y",
                    )
                    .tickLength(height * 0.2)
                    .fontsize(height * 0.32)
                    .tickFormat(t => `${t.getFullYear()}${yearFormat.get()}`),
                Tick.create()
                    .is(
                        t => t.getFullYear() % 10 !== 0,
                        "1y",
                    )
                    .tickLength(height * 0.15)
                    .fontsize(height * 0.24)
                    .tickFormat(t => `${t.getFullYear()}`),
            ],
            labels: [],
            showBrush: false,
            showMask: true,
            maskType: "domain",
            side: "bottom",
        },
        {
            idx: -1,
            name: "时间分布",
            groupId: "g1",
            height: Math.max(height * 1.2, 0),
            init() {
                const granularities = {
                    "10y": 86400000 * 3650,
                    "5y": 86400000 * 1825,
                    "1y": 86400000 * 365,
                    "1m": 86400000 * 30,
                };
                const keys: (keyof typeof granularities)[] = ["10y", "5y", "1y", "1m"];
                const domain = domainX;
                const ticksMap = new Map<keyof typeof granularities, number[]>();
                for (let i = 0, n = keys.length; i < n; ++i) {
                    const key = keys[i];
                    const ticks = Tick.create()
                        .granularity(key)
                        .every(key)
                        .getTicks(domain, "external")
                        .map(t => t.getTime());
                    ticksMap.set(key, ticks);
                }

                type Bin = Int32Array;
                type AllBin = Bin & { max: number; };

                const allFigureBinsMap = computed(store.$allFigures, allFigures => {
                    const result: Map<keyof typeof granularities, AllBin> = new Map();
                    for (let i = 0, n = keys.length; i < n; ++i) {
                        const key = keys[i];
                        const ticks = ticksMap.get(key)!;
                        const T1 = ticks[0];
                        const bins: AllBin = new Int32Array(ticks.length - 1) as any;
                        let max = 0;
                        for (let j = 0, m = allFigures.length; j < m; ++j) {
                            const figure = allFigures[j];
                            const time = figure.time;
                            const t1 = time[0].getTime();
                            const t2 = time[1].getTime();
                            const startIndex = Math.floor((t1 - T1) / granularities[keys[i]]);
                            const endIndex = Math.floor((t2 - T1) / granularities[keys[i]]);
                            for (let k = startIndex; k < endIndex; ++k) {
                                bins[k] += 1;
                            }
                        }

                        for (let k = 0; k < bins.length; ++k) {
                            max = Math.max(max, bins[k]);
                        }
                        bins.max = max;
                        result.set(keys[i], bins);
                    }
                    return result;
                });

                const figureBinsMap = computed(store.$figures, figures => {
                    const result: Map<keyof typeof granularities, Bin> = new Map();
                    for (let i = 0, n = keys.length; i < n; ++i) {
                        const key = keys[i];
                        const ticks = ticksMap.get(key)!;
                        const T1 = ticks[0];
                        const bins: Bin = new Int32Array(ticks.length - 1) as any;
                        for (let j = 0, m = figures.length; j < m; ++j) {
                            const figure = figures[j];
                            const time = figure.time;
                            const t1 = time[0].getTime();
                            const t2 = time[1].getTime();
                            const startIndex = Math.floor((t1 - T1) / granularities[keys[i]]);
                            const endIndex = Math.floor((t2 - T1) / granularities[keys[i]]);
                            for (let k = startIndex; k < endIndex; ++k) {
                                bins[k] += 1;
                            }
                        }
                        result.set(keys[i], bins);
                    }
                    return result;
                });

                return {
                    granularities,
                    ticksMap,
                    allFigureBinsMap,
                    figureBinsMap,
                }
            },
            ticks: [],
            labels: [],
            labelsRenderer: function (this: SingleLine, ctx: CanvasRenderingContext2D, scaleX: d3.ScaleTime<number, number>) {

                const context = this.context;
                const granularities = context.granularities as { [key in "10y" | "5y" | "1y" | "1m"]: number; };
                const ticksMap = context.ticksMap as Map<keyof typeof granularities, number[]>;
                const allFigureBinsMap = context.allFigureBinsMap.get() as Map<keyof typeof granularities, Int32Array & { max: number; }>;
                const figureBinsMap = context.figureBinsMap.get() as Map<keyof typeof granularities, Int32Array>;

                /** 找到合适的粒度 */
                const keys = Object.keys(granularities) as (keyof typeof granularities)[];
                const y0 = scaleX(0);
                let i = 0;
                for (let n = keys.length; i < n; ++i) {
                    const v = granularities[keys[i]];
                    const dw = scaleX(v) - y0;
                    if (dw < 20) {
                        break;
                    }
                }
                if (i === keys.length) i = keys.length - 1;
                const key = keys[i];

                const ticks = ticksMap.get(key)!;
                const allBins = allFigureBinsMap.get(key)!;
                const bins = figureBinsMap.get(key)!;
                const maxV = allBins.max;

                const [t1, t2] = scaleX.domain().map(t => t.getTime());
                const startIndex = d3.bisectLeft(ticks, t1);
                const endIndex = Math.min(d3.bisectRight(ticks, t2), bins.length);

                const height = this.props.height as number;
                const scaleY = d3.scaleLinear()
                    .domain([0, maxV])
                    .range([0, height * 0.7]);

                ctx.save();
                for (let j = startIndex; j < endIndex; ++j) {
                    const v1 = scaleX(new Date(ticks[j]));
                    const v2 = scaleX(new Date(ticks[j + 1]));
                    const cx = (v1 + v2) / 2;
                    const w = (v2 - v1) * 0.8;
                    const x1 = cx - w / 2;

                    const H = scaleY(allBins[j]);
                    const h = scaleY(bins[j]);
                    const y2 = height;

                    ctx.fillStyle = light_bgcolor;
                    ctx.fillRect(x1, y2 - H, w, H);
                    ctx.fillStyle = color;
                    ctx.fillRect(x1, y2 - h, w, h);
                }

                ctx.restore();
            },
            showBrush: false,
            showMask: true,
            maskType: "domain",
            side: "bottom",
        },
        {
            idx: -1,
            name: null,
            groupId: "g1",
            height: 3,
            ticks: [],
            labels: [],
            showBrush: false,
            showMask: true,
            side: "bottom",
        },
    ] as any;
    timelines.height = height * 2 + Math.max(height * 1.2, 0) * 2 + 3;
    return timelines;
}

export async function getGroups(width: number): Promise<SubTimelineGroup[]> {
    return [
        {
            id: "g1",
            domain: domainX,
            range: [0, width],
            effect: GROUP_LABEL,
            brush: true,
            scalable: true,
            timelines: [],
            // scale: null,
            // originScale: null,
        } as any,
    ];
}

export function preprocessData(timelines: SubTimelineDatum[], groups: SubTimelineGroup[], timelineWidth: number)   {
    /**如果有刷选框功能，则需要为刷选框的圆点留下padding */
    // let pd = timelines.some(timeline => timeline.showBrush) ? padding : 0;

    const groupDict: {
        [id: string]: number;
    } = {};

    /**生成scale和对timeline的引用 */
    groups.forEach((group: SubTimelineGroup, i)=>{
        groupDict[group.id] = i;

        /**查找祖先group，使用祖先group的domain */
        let gs = groups.find(g => g.effect === group.id);
        if(gs !== undefined) {
            let gsp: SubTimelineGroup | undefined = gs;
            while(gsp !== undefined){
                gsp = groups.find(g => g.effect === gsp!.id);
                gs = gsp || gs;
            }
        }
        gs = gs || group;

        group.scale = d3.scaleTime()
            .domain(gs.domain)
            .range([0, timelineWidth]);
        group.originScale = group.scale.copy();

        // group.brushDomain = gs.domain.slice() as [Date, Date];
        group.brushDomain = null;
        group.timelines = [];
    })
    /**生成对group的引用 */
    timelines.forEach((timeline, i) => {
        let group = groups[groupDict[timeline.groupId]];
        timeline.g = group;
        timeline.idx = i;
        timeline.group = group;
        group.timelines.push(timeline);
    });
}

let eventCounter = 0;


const eventScores = {
    "出生": 2,
    "死亡": 2,
    "教育": 3,
    "入仕": 10,
    "升職": 7,
    "降職": 7,
    "平調": 6,
    "罷官": 10,
    "特殊官職": 9,
    "最高官職": 10,
    "成就": 4,
    "其他": 1,
}
function getEventImportance(event: Event): number {
    let score = (eventScores as any)[event.type] ?? 1;
    if ((event as any).__fromOtherFigure) {
        score = 0.5;
    }
    return score;
}

function getEventSize(event: Event): number {
    return Math.sqrt(event.description.length * 2);
}

function getEventType(event: Event, events: Event[]): keyof typeof EventTypeGlyph.typeFunctions {
    // 去掉中文括号（）里面的内容
    let type = event.subtype.replace(/（.*?）/g, "").trim();

    if (type === "出生" || type === "死亡") {
        return "其他";
    }
    if (type.startsWith("教育")) {
        return "教育";
    }
    if (type.startsWith("入仕") || type === "官職變動-奪情或起復" || type === "皇帝-登基") {
        return "入仕";
    }
    if (type.startsWith("官職變動")) {
        let rank = event.posts.length > 0 ? Math.max(...event.posts.map(p => p.rank)) : 0;
        let isHighest = Math.max(...events.map(e => e.posts.length > 0 ? Math.max(...e.posts.map(p => p.rank)) : 0)) === rank;
        if (isHighest) {
            return "最高官職";
        }
        if (type === "官職變動-擢升") {
            return "升職";
        }
        else if (type === "官職變動-貶謫") {
            return "降職";
        }
        else if (type === "官職變動-主動辭官或致仕" || type === "官職變動-丁憂" || type === "皇帝-退位") {
            return "罷官";
        }
        return "平調";
    }
    if (type.startsWith("政績實踐") || type.startsWith("成就")) {
        return "成就";
    }
    return "其他";
}

export async function getLabels(onProgress: (progress: number) => void): Promise<Figure[]> {
    let count0 = 0;
    let maxWeight = 0;

    const layoutImportance: {
        [key: string]: number;
    } = await d3.json<any>("./data/layout_importance.json");

    const data: Figure[] = await loader.json<OriginFigure[]>("./data/figures.json", onProgress).then(data => {
        if (data === undefined) {
            throw new Error("Failed to load data.");
        }
        onProgress(100);
        const en = store.$language.get() === 'en';
        
        let result = data
            .filter((d: any) => !Number.isNaN(Date.parse(d.birth)) && !Number.isNaN(Date.parse(d.death)))
            .map((d: OriginFigure, i: number) => {
                const start = new Date(d.birth);
                const end = new Date(d.death);
                maxWeight = Math.max(maxWeight, d.weight);

                const birthplace = d.birthplace;
                const events = d.events.map((e: OriginEventDatum) => {
                    const time = e.time === null ? null : new Date(e.time);
                    const event = {
                        id: eventCounter++,
                        time: time,
                        description: e.description,
                        short_description: e.short_description,
                        type: "",
                        subtype: e.type,
                        importance: 1,
                        size: 1,
                        locations: e.locations
                            .filter(loc => loc.coordinate !== null)
                            .map(loc => {
                                return {
                                    id: loc.id,
                                    name: loc.name,
                                    time: time,
                                    coordinate: new EarthCoordinate(loc.coordinate![0], loc.coordinate![1]),
                                    parents: loc.hierarchy,
                                };
                            }),
                        posts: e.posts.map(post => {
                            return {
                                id: post.id,
                                time: time,
                                name: en ? post.en_name : post.name,
                                postName: post.org_name,
                                __name__: post.name,
                                endTime: null,
                                institutions: post.hierarchy.map(inst => {
                                    return {
                                        id: inst.id,
                                        name: en ? inst.en_name : inst.name,
                                        __name__: inst.name,
                                    };
                                }),
                                rank: 0,
                            }
                        }),
                        relations: e.relations.map((figure) => ({
                            time: time,
                            id: figure.id,
                            name: figure.name,
                            type: figure.type,
                            score: figure.rate,
                            description: figure.description,
                        })),
                    } as Event;
                    
                    return event;
                });
                
                const result = {
                    id: d.id,
                    time: [start, end],
                    name: en ? d.en_name : d.name,
                    pinyin: d.en_name,
                    type: d.type,
                    birthplace: birthplace === null || !birthplace.coordinate ? null : {
                        id: birthplace.id,
                        name: birthplace.name,
                        coordinate: new EarthCoordinate(birthplace.coordinate[0], birthplace.coordinate[1]),
                        parents: birthplace.hierarchy.map((d: any) => ({
                            id: d.id,
                            name: d.name,
                        })),
                    },
                    weight: d.weight,
                    description: d.description,
                    totalHistoricalContextWeight: 0,
                    events: events.filter(e => e.time !== null)
                        .filter(e => {
                            if (e.time instanceof Array) {
                                return e.time.every(t => t >= start && t <= end);
                            } else {
                                return e.time >= start && e.time <= end;
                            }
                        }),
                    posts: events.flatMap(e => e.posts)
                        .sort((a, b) => (a.time?.getTime?.() ?? Number.MAX_SAFE_INTEGER) - (b.time?.getTime?.() ?? Number.MAX_SAFE_INTEGER)),
                    locations: events.flatMap(e => e.locations)
                        .sort((a, b) => (a.time?.getTime?.() ?? Number.MAX_SAFE_INTEGER) - (b.time?.getTime?.() ?? Number.MAX_SAFE_INTEGER))
                        .reduce((locations, location) => {
                            if (location.time === null) {
                                if (locations.some(l => l.id === location.id)) {
                                    return locations;
                                }
                                return [...locations, location];
                            }
                            if (locations.length > 0 && location.id === locations[locations.length - 1].id) {
                                return locations;
                            }
                            return [...locations, location];
                        }, [] as Location[]),
                    relations: events.flatMap(e => e.relations),
                    layout: {
                        importance: layoutImportance[d.id.toString()],
                    },
                    status: 0,
                } as Figure;

                result.totalHistoricalContextWeight = historicalOverlap(result, result.time).weight;
                return result;
            });
            // .filter((d: LabelDatum) => d.events.length > 0);

        // const fakeData: Figure[] = new Array(165 + 15000).fill(0).map(()=> generate());
        // result = result.concat(fakeData);

        count0 = result.length;

        for (let i = 0; i < count0; ++i) {
            /** Normalize weight */
            result[i].weight = result[i].weight / maxWeight;

            const [t1, t2] = result[i].time;
            result[i].relations = result[i].relations.filter(r => !r.time || (r.time >= t1 && r.time <= t2));
            result[i].locations = result[i].locations.filter(l => !l.time || (l.time >= t1 && l.time <= t2));
            result[i].posts = result[i].posts.filter(p => !p.time || (p.time >= t1 && p.time <= t2));
            result[i].events = result[i].events.filter(e => !e.time || (e.time >= t1 && e.time <= t2));

            let lastPostColor: string;
            result[i].events.forEach(event => {
                for (const post of event.posts) {
                    post.rank = PostParser.rank(post);
                    (post as any).__color__ = lastPostColor = (PostParser.postColorMap[post.rank] ?? lastPostColor ?? PostParser.postColorMap[1]);
                }
            });
            result[i].posts.forEach(post => {
                post.rank = PostParser.rank(post);
                (post as any).__color__ = lastPostColor = (PostParser.postColorMap[post.rank] ?? lastPostColor ?? PostParser.postColorMap[1]);
            });

            result[i].events.forEach(e => {
                e.type = getEventType(e, result[i].events);
            });

            if (result[i].type === "皇帝") {
                result[i].status = 13;
            }
            else {
                let status = result[i].posts.length > 0 ? Math.max(...result[i].posts.map(p => p.rank)) : 0;
                if (status === 1) {
                    if (result[i].type === "宦官" || result[i].type === "后妃") {
                        status = 11;
                    }
                }
                result[i].status = status;
            }

            
        }

        const id2label = new Map<number, Figure>();
        for (let i = 0; i < count0; ++i) {
            id2label.set(result[i].id, result[i]);
        }

        // 將當前人物的事件中涉及到其他數據中有的人物的，要將這個事件加到其他人物中
        for (let i = 0; i < count0; ++i) {
            const figure = result[i];
            figure.events.forEach(event => {
                if ((event as any).__fromOtherFigure) return;
                event.relations.forEach(relation => {
                    const f = id2label.get(relation.id);
                    if (f !== undefined && f.id !== figure.id) {
                        const e = structuredClone(event);
                        e.type = "相關人物";
                        e.relations = e.relations.filter(r => r.id !== f.id);
                        e.description = `【${figure.name}】` + e.description;
                        e.short_description = `【${figure.name}】` + e.short_description;
                        
                        e.relations = [{
                            time: e.time,
                            id: figure.id,
                            name: figure.name,
                            type: relation.type,
                            score: relation.score,
                            description: `（${f.name}）` + relation.description,
                        }];
                        (e as any).__fromOtherFigure = true;
                        f.events.push(e);
                    }
                });
            });
        }

        // 將每個人物的事件按時間排序
        for (let i = 0; i < count0; ++i) {
            const figure = result[i];
            const t0 = figure.time[0].getTime();
            const t1 = figure.time[1].getTime();
            // 去掉時間不合法的事件
            figure.events = figure.events.filter(e => e.time.getTime() >= t0 && e.time.getTime() <= t1) as Event[];
            figure.events.sort((a, b) => a.time.getTime() - b.time.getTime());
        }
        // 將同一時間的多個事件合併成一個事件
        for (let i = 0; i < count0; ++i) {
            const figure = result[i];
            const mergedEvents: Event[] = [];
            for (const event of figure.events) {
                const last = mergedEvents[mergedEvents.length - 1];
                if (last && last.time === event.time) {
                    last.description += "\n" + event.description;
                    last.short_description += "\n" + event.short_description;
                    last.locations.push(...event.locations.filter(l => !last.locations.some(ll => ll.id === l.id)));
                    last.posts.push(...event.posts.filter(p => !last.posts.some(pp => pp.id === p.id)));
                    last.relations.push(...event.relations.filter(r => !last.relations.some(rr => rr.id === r.id)));

                    last.importance = getEventImportance(last as any);
                    last.size = getEventSize(last as any);

                } else {
                    mergedEvents.push(event);
                }
            }
            figure.events = mergedEvents;
        }

        for (let i = 0; i < count0; ++i) {
            const figure = result[i];
            figure.events.forEach(e => {
                e.importance = getEventImportance(e);
                e.size = getEventSize(e);
            });
        }

        return result;
    });
    return data;
}