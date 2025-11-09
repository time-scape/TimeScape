import { Figure, FigureContext, Institution, Location, Post, Relationship } from "../types";
import { $historicalContextWeights, $figureContextWeights, $timeSelected } from "../store";
import { domainX } from "../constants";
import PostParser from "./PostParser";

const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;

/**
 * 计算单个人物的历史上下文
 * 
 * 包括以下几个部分：
 * 1. 当前人物与选中时间重叠的时间（不同的时间段应该权重不一样？比如入仕后应该更加重要）
 * 2. 在选中时间内官职更高
 * 3. 当前人物在选中的时间段内的关系数量（一个关系等于一年，要用相同的量纲）
 * @param figure 目标人物
 * @param timeRange 时间范围（就是当前选中的时间）
 */
export function historicalContext(
    figure: Figure,
    timeRange: [Date, Date] | null,
    historicalContextWeights: typeof $historicalContextWeights.value
) {
    const result = historicalOverlap(figure, timeRange, historicalContextWeights);
    const totalWeight = figure.totalHistoricalContextWeight;
    const r = totalWeight === 0 ? 1 : result.weight / totalWeight;
    // if (r < 1 - 1e-8 || r > 1 + 1e-8) {
    //     console.log(figure.name, result.weight, totalWeight, r);
    //     throw new Error("权重计算错误！");
    // }
    // const weight = r * (Math.pow(figure.weight, 0.7));
    // result.weight = weight;
    return Object.assign(result, {
        r,
        _w: Math.pow(figure.weight, 0.7),
    });
}

export function historicalOverlap(
    figure: Figure,
    timeRange: [Date, Date] | null,
    historicalContextWeights?: typeof $historicalContextWeights.value,
) {
    historicalContextWeights = historicalContextWeights ?? $historicalContextWeights.get();
    const [gt1, gt2] = timeRange ?? domainX;
    const [t1, t2] = figure.time;

    const lifespan = t2.getTime() - t1.getTime();

    let weight = 0;

    /** 时间上重叠 */
    const T1 = new Date(Math.max(gt1.getTime(), t1.getTime()));
    const T2 = new Date(Math.min(gt2.getTime(), t2.getTime()));
    const T = Math.max(0, T2.getTime() - T1.getTime());
    const w_t = T / lifespan;
    weight += w_t * historicalContextWeights.time;

    if (T === 0) {
        // TODO: 如何处理计算出的权重
        return {
            weight: 0,
            time: {
                weight: 0,
                time: [T1, T2],
            },
            posts: {
                weight: 0,
                posts: [],
            },
            relations: {
                weight: 0,
                relations: [],
            },
        };
    }

    /** 官职 */
    let w_p = 0;
    let posts = [];
    for (let i = 0; i < figure.posts.length; ++i) {
        const post = figure.posts[i];
        let pt1 = post.time === null ? null : Math.max(t1.getTime(), post.time.getTime());
        let pt2 = Math.min(
            t2.getTime(),
            (post.endTime !== null ? post.endTime.getTime() : figure.posts[i + 1]?.time?.getTime()) ?? figure.time[1].getTime()
        );
        let p;
        let timespan = 0;
        if (pt1 === null) {
            pt1 = t1.getTime();
            timespan = 1;
            p = (pt2 - pt1) / lifespan;
        }
        else {
            timespan = (pt2 - pt1) / ONE_YEAR;
            p = 1;
        }

        if (pt1 > pt2) {
            continue;
        }
        const rank = PostParser.rank(post);
        w_p += p * timespan * rank;
        posts.push({
            post,
            time: [new Date(pt1), new Date(pt2)],
            probability: p,
        });
    }
    weight += w_p * historicalContextWeights.posts;

    /** 关系 */
    let w_r = 0;
    let relations = [];
    for (let i = 0; i < figure.relations.length; ++i) {
        const relation = figure.relations[i];
        if (relation.time === null) {
            let p = T / lifespan;
            relations.push({
                relation,
                time: null,
                probability: p,
            });
            w_r += p;
        }
        else if (relation.time >= T1 && relation.time <= T2) {
            let p = 1;
            relations.push({
                relation,
                time: relation.time,
                probability: p,
            });
            w_r += p;
        }
    }
    weight += w_r * historicalContextWeights.relations;

    return {
        weight,
        time: {
            weight: w_t,
            time: [T1, T2],
        },
        posts: {
            weight: w_p,
            posts,
        },
        relations: {
            weight: w_r,
            relations,
        },
    };
}

/**
 * 计算单个人物的个人上下文
 * 
 * 包括以下几个部分：
 * 1. 当前人物与选中时间重叠的时间（不同的时间段应该权重不一样？比如入仕后应该更加重要）
 * 2. 在选中时间内官职的重叠（使用cbdb的层次数据，如果有同一个上级机构则认为是同僚关系）
 * 3. 在选中时间内地点的重叠
 * 4. 当前人物在选中的时间段内的关系数量（一个关系等于一年，要用相同的量纲）
 * @param figure 目标人物
 * @param figuresSelected 当前选中的人物
 * @param timeRange 时间范围（就是当前选中的时间）
 * @param figureContextWeights 权重
 */

export function figureContext(
    figure: Figure,
    figuresSelected: Figure[],
    figuresTimeRange: Map<number, [Date, Date]>,
    figureContextWeights: typeof $figureContextWeights.value,
) {
    const [t1, t2] = figure.time;
    const lifespan = t2.getTime() - t1.getTime();
    
    const result = [];
    for (let k = 0; k < figuresSelected.length; ++k) {
        const figureSelected = figuresSelected[k];
        const [gt1, gt2] = figuresTimeRange.get(figureSelected.id) ?? domainX;
        const [st1, st2] = figureSelected.time;
        const lifespanSelected = st2.getTime() - st1.getTime();

        let weight = 0;

        /** 时间上重叠 */
        const T1 = new Date(Math.max(gt1.getTime(), t1.getTime(), st1.getTime()));
        const T2 = new Date(Math.min(gt2.getTime(), t2.getTime(), st2.getTime()));
        const T = Math.max(0, T2.getTime() - T1.getTime()) / ONE_YEAR;
        const w_t = T;
        if (figure.id !== figureSelected.id) weight += w_t * figureContextWeights.time;

        if (T === 0 || figure.id === figureSelected.id) {
            result.push({
                weight,
                time: {
                    weight: 0,
                    time: [T1, T2],
                },
                locations: {
                    weight: 0,
                    locations: [],
                },
                posts: {
                    weight: 0,
                    posts: [],
                },
                relations: {
                    weight: 0,
                    relations: [],
                },
                events: [],
            });
            continue;
        }
        
        /** 
         * 地点上重叠
         * @explain 默认地点列表已经按照时间排序了，时间为null的在最后
         */

        const locationOverlaps = getOverlap(
            figure.locations,
            lifespan,
            figureSelected.locations,
            lifespanSelected,
            location => location.time,
            (location1, location2) => location1.id === location2.id,
            [T1, T2],
        );
        let w_l = 0;
        let sharedLocations = [];
        for (const [i1, i2, t1, t2, timespan, p] of locationOverlaps) {
            w_l += p * timespan;
            sharedLocations.push({
                location: figure.locations[i1],
                time: [t1, t2],
                probability: p,
            });
        }
        weight += w_l * figureContextWeights.locations;

        /**
         * 职位上重叠
         * @explain 默认职位列表已经按照时间排序了，时间为null的在最后
         */
        const postOverlaps = getOverlap(
            figure.posts,
            lifespan,
            figureSelected.posts,
            lifespanSelected,
            post => post.time,
            (post1, post2) => {
                const inst1 = post1.institutions.at(-1);
                const inst2 = post2.institutions.at(-1);
                if (inst1 === undefined || inst2 === undefined) {
                    return post1.name === post2.name;
                }
                if (inst1.name === "宋朝" || inst1.name === "Song Dynasty") return false;
                return inst1.id === inst2.id;
            },
            [T1, T2],
        );
        let w_p = 0;
        let sharedPosts = [];
        for (const [i1, i2, t1, t2, timespan, p] of postOverlaps) {
            w_p += p * timespan;
            sharedPosts.push({
                post: figure.posts[i1].institutions.at(-1) ?? figure.posts[i1],
                postSelected: figureSelected.posts[i2].institutions.at(-1) ?? figureSelected.posts[i2],
                time: [t1, t2],
                probability: p,
            });
        }
        weight += w_p * figureContextWeights.posts;
        
        /** 
         * 关系上重叠
         * @explain 每个关系的持续时间默认是1年
         */
        let w_r = 0;
        const TS1 = new Date(Math.max(t1.getTime(), st1.getTime()));
        const TS2 = new Date(Math.min(t2.getTime(), st2.getTime()));
        const lifespanOverlap = (TS2.getTime() - TS1.getTime()) / ONE_YEAR;
        const relations = [];
        
        for (const relation of figure.relations) {
            if (relation.id === figureSelected.id) {
                let p: number = 0;
                if (relation.time === null) {
                    p = T / lifespanOverlap;
                }
                else if (relation.time >= T1 && relation.time <= T2) {
                    p = 1;
                }
                if (p) {
                    w_r += p;
                    relations.push({
                        relation,
                        time: relation.time,
                        probability: p,
                    });
                }
                
            }
        }
        for (const relation of figureSelected.relations) {
            if (relation.id === figure.id) {
                let p: number = 0;
                if (relation.time === null) {
                    p = T / lifespanOverlap;
                }
                else if (relation.time >= T1 && relation.time <= T2) {
                    p = 1;
                }
                if (p) {
                    w_r += p;
                    relations.push({
                        relation,
                        time: relation.time,
                        probability: p,
                    });
                }
            }
        }
        weight += w_r * figureContextWeights.relations;

        const events: {
            time: Date;
            timeRange: [Date, Date];
            probability: number;
            locations: Location[];
            posts: [Post | Institution, Post | Institution][];
            relations: Relationship[];
        }[] = [];
        
        if (w_l > 0) {
            for (const location of sharedLocations) {
                const event = events.find(e => e.time.getTime() === location.time[0].getTime());
                if (event === undefined) {
                    events.push({
                        time: location.time[0],
                        timeRange: location.time as [Date, Date],
                        probability: location.probability,
                        locations: [location.location],
                        posts: [],
                        relations: [],
                    });
                }
                else {
                    event.locations.push(location.location);
                }
            }
        }
        if (w_p > 0) {
            for (const post of sharedPosts) {
                const event = events.find(e => e.time.getTime() === post.time[0].getTime());
                if (event === undefined) {
                    events.push({
                        time: post.time[0],
                        timeRange: post.time as [Date, Date],
                        probability: post.probability,
                        locations: [],
                        posts: [[post.post, post.postSelected]],
                        relations: [],
                    });
                }
                else {
                    event.posts.push([post.post, post.postSelected]);
                }
            }
        }
        if (w_r > 0) {
            for (const relation of relations) {
                if (!relation.time) continue;
                const event = events.find(e => e.time.getTime() === relation.time!.getTime());
                if (event === undefined) {
                    events.push({
                        time: relation.time,
                        timeRange: [relation.time, relation.time],
                        probability: relation.probability,
                        locations: [],
                        posts: [],
                        relations: [relation.relation],
                    });
                }
                else {
                    event.relations.push(relation.relation);
                }
            }
        }

        result.push({
            weight,
            time: {
                weight: w_t,
                time: [T1, T2],
            },
            locations: {
                weight: w_l,
                locations: sharedLocations,
            },
            posts: {
                weight: w_p,
                posts: sharedPosts,
            },
            relations: {
                weight: w_r,
                relations,
            },
            events: events,
        });
    }

    (result as any).weight = result.reduce((acc, d) => acc + d.weight, 0);

    return result as FigureContext;
}

function getOverlap<T>(
    arr1: T[],
    lifespan1: number, // 单位为ms
    arr2: T[],
    lifespan2: number, // 单位为ms
    getTime: (item: T) => Date | null,
    equal: (item1: T, item2: T) => boolean,
    timeRange: [Date, Date], // 需要事先和两个人物的生卒年取交集
) {
    /**
     * start: 与timeRange有交集的第一个地点下标
     * mid: 与timeRange有交集的最后一个地点下标 + 1
     * end: 时间为null的第一个地点下标
     */
    let start1: number, mid1: number, end1: number;
    let start2: number, mid2: number, end2: number;

    end1 = arr1.findIndex(item => getTime(item) === null);
    if (end1 === -1) end1 = arr1.length;
    let i: number;
    for (i = 0; i < end1; i++) {
        if (getTime(arr1[i])! >= timeRange[0]) break;
    }
    start1 = Math.max(0, i - 1);
    for(; i < end1; i++) {
        if (getTime(arr1[i])! > timeRange[1]) break;
    }
    mid1 = i;

    end2 = arr2.findIndex(item => getTime(item) === null);
    if (end2 === -1) end2 = arr2.length;
    for (i = 0; i < end2; i++) {
        if (getTime(arr2[i])! >= timeRange[0]) break;
    }
    start2 = Math.max(0, i - 1);
    for(; i < end2; i++) {
        if (getTime(arr2[i])! > timeRange[1]) break;
    }
    mid2 = i;

    let p1 = start1, p2 = start2;
    /**
     * [
     *  * i1: 重叠对在arr1中的下标
     *  * i2: 重叠对在arr2中的下标
     *  * t1: 重叠对的（可能）开始时间
     *  * t2: 重叠对的（可能）结束时间
     *  * timespan：实际持续时间（对于不确定事件固定为一年），单位为年
     *  * p: 重叠对出现在[t1, t2]的概率
     * ]
     */
    const overlaps: [number, number, Date, Date, number, number][] = [];

    /** 带有时间的部分 */
    while (p1 < mid1 && p2 < mid2) {
        const t1 = getTime(arr1[p1])!;
        const t2 = getTime(arr2[p2])!;
        if (t1 < t2) {
            const t12 = p1 === mid1 - 1 ? timeRange[1] : getTime(arr1[p1 + 1])!;
            if (t12 > t2) {
                equal(arr1[p1], arr2[p2]) && overlaps.push([p1, p2, t2, t12, (t12.getTime() - t2.getTime()) / ONE_YEAR, 1]);
            }
            p1++;
        }
        else if (t1 > t2) {
            const t22 = p2 === mid2 - 1 ? timeRange[1] : getTime(arr2[p2 + 1])!;
            if (t22 > t1) {
                equal(arr1[p1], arr2[p2]) && overlaps.push([p1, p2, t1, t22, (t22.getTime() - t1.getTime()) / ONE_YEAR, 1]);
            }
            p2++;
        }
        else {
            const t12 = p1 === mid1 - 1 ? timeRange[1] : getTime(arr1[p1 + 1])!;
            const t22 = p2 === mid2 - 1 ? timeRange[1] : getTime(arr2[p2 + 1])!;
            const t2 = new Date(Math.min(t12.getTime(), t22.getTime()));
            equal(arr1[p1], arr2[p2]) && overlaps.push([p1, p2, t1, t2, (t2.getTime() - t1.getTime()) / ONE_YEAR, 1]);
            p1++;
            p2++;
        }
    }

    /** 一个时间为null的部分 */
    for (let i = end1; i < arr1.length; i++) {
        for (let j = start2; j < mid2; j++) {
            if (equal(arr1[i], arr2[j])) {
                const t1 = getTime(arr2[j])!;
                const t2 = j === mid2 - 1 ? timeRange[1] : getTime(arr2[j + 1])!;
                overlaps.push([i, j, t1, t2, 1, (t2.getTime() - t1.getTime()) / lifespan2]);
            }
        }
    }
    for (let i = end2; i < arr2.length; i++) {
        for (let j = start1; j < mid1; j++) {
            if (equal(arr1[j], arr2[i])) {
                const t1 = getTime(arr1[j])!;
                const t2 = j === mid1 - 1 ? timeRange[1] : getTime(arr1[j + 1])!;
                overlaps.push([j, i, t1, t2, 1, (t2.getTime() - t1.getTime()) / lifespan1]);
            }
        }
    }

    /** 两个时间为null的部分 */
    for (let i = end1; i < arr1.length; i++) {
        for (let j = end2; j < arr2.length; j++) {
            if (equal(arr1[i], arr2[j])) {
                // 之所以乘以ONE_YEAR是因为只需要两个时间在同一年就认为是重叠了，也是为了防止p过于小
                const p = (timeRange[1].getTime() - timeRange[0].getTime()) / lifespan1 * ONE_YEAR / lifespan2;
                overlaps.push([i, j, timeRange[0], timeRange[1], 1, p]);
            }
        }
    }
    return overlaps;
}

// export function similarity(figure1: FigureDatum, figure2: FigureDatum, timeRange?: [Date, Date] | null) {

//     const ranks = store.state.similarityWeights.figure;
//     let similarity = 0;

//     const debug = figure2.name === '秦檜';
//     const tRange: [Date, Date] = [
//         new Date(Math.max(figure1.time[0].getTime(), figure2.time[0].getTime())),
//         new Date(Math.min(figure1.time[1].getTime(), figure2.time[1].getTime())),
//     ];
//     if (!timeRange) {
//         timeRange = tRange;
//     }
//     else {
//         timeRange = [
//             new Date(Math.max(tRange[0].getTime(), timeRange[0].getTime())),
//             new Date(Math.min(tRange[1].getTime(), timeRange[1].getTime())),
//         ];
//     }

//     const overlapTime = Math.max(0, timeRange[1].getTime() - timeRange[0].getTime());
//     const lifespan1 = figure1.time[1].getTime() - figure1.time[0].getTime();
//     const lifespan2 = figure2.time[1].getTime() - figure2.time[0].getTime();
//     const r1 = overlapTime / lifespan1;
//     const r2 = overlapTime / lifespan2;

//     if (debug) {
//         console.log("r1", r1, "r2", r2);
//     }

//     // console.log(overlapTime / 86400000 / 365, lifespan1 / 86400000 / 365, lifespan2 / 86400000 / 365, r1, r2);

//     /** 直接关系 */
//     const relationInfo: {
//         relation: Relationship,
//         time: Date | null
//     }[] = [];
//     for (let relation of figure1.relations) {
//         if (relation.id === figure2.id) {
//             if (relation.time === null) {
//                 similarity += ranks.relation.nonTemporal * r1;
//                 relationInfo.push({
//                     relation,
//                     time: null,
//                 });
//             }
//             else if (relation.time <= timeRange[1] && relation.time >= timeRange[0]) {
//                 similarity += ranks.relation.normal;
//                 relationInfo.push({
//                     relation,
//                     time: relation.time,
//                 });
//             }
//         }
//     }
//     for (let relation of figure2.relations) {
//         if (relation.id === figure1.id) {
//             if (relation.time === null) {
//                 similarity += ranks.relation.nonTemporal * r2;
//                 relationInfo.push({
//                     relation,
//                     time: null,
//                 });
//             }
//             else if (relation.time <= timeRange[1] && relation.time >= timeRange[0]) {
//                 similarity += ranks.relation.normal;
//                 relationInfo.push({
//                     relation,
//                     time: relation.time,
//                 });
//             }
//         }
//     }

//     if (debug) {
//         console.log(similarity, relationInfo);
//         console.log("figure1", figure1.name, figure1.time);
//         console.log("figure2", figure2.name, figure2.time);
//     }

//     /** 地点上的重叠 */
//     const locationOverlaps = getOverlaps(
//         figure1.locations,
//         figure2.locations,
//         location => location.time,
//         (location1, location2) => location1.id === location2.id,
//         timeRange,
//         debug,
//     );
//     const locationOverlapInfo: {
//         location: Location;
//         time: [Date, Date] | null
//     }[] = [];

//     for (let [i, j] of locationOverlaps) {
//         if (figure1.locations[i].time === null && figure2.locations[j].time === null) {
//             similarity += ranks.location.nonTemporal * overlapTime / lifespan1 / lifespan2;
//             locationOverlapInfo.push({
//                 location: figure1.locations[i],
//                 time: null,
//             });
//         }
//         else if (figure1.locations[i].time === null) {
//             similarity += ranks.location.nonTemporal * r1;
//             locationOverlapInfo.push({
//                 location: figure1.locations[i],
//                 time: null,
//             });
//         }
//         else if (figure2.locations[j].time === null) {
//             similarity += ranks.location.nonTemporal * r2;
//             locationOverlapInfo.push({
//                 location: figure1.locations[i],
//                 time: null,
//             });
//         }
//         else {
//             similarity += ranks.location.normal;
//             const s1 = figure1.locations[i].time!.getTime();
//             const e1 = i === figure1.locations.length - 1 || figure1.locations[i + 1].time === null ? timeRange[1].getTime() : figure1.locations[i + 1].time!.getTime();
//             const s2 = figure2.locations[j].time!.getTime();
//             const e2 = j === figure2.locations.length - 1 || figure2.locations[j + 1].time === null ? timeRange[1].getTime() : figure2.locations[j + 1].time!.getTime();
//             locationOverlapInfo.push({
//                 location: figure1.locations[i],
//                 time: [new Date(Math.max(s1, s2)), new Date(Math.min(e1, e2))],
//             });
//         }
//     }

//     if (debug) {
//         for (let info of locationOverlapInfo) {
//             console.log(info.location.name, info.time === null ? null : info.time.map(t => `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`));
//         }
//     }

//     /** 具有相同的职位（或者在同一机构中） */
//     const postOverlaps = getOverlaps(
//         figure1.posts,
//         figure2.posts,
//         post => post.time,
//         (post1, post2) => post1.name === post2.name,
//         timeRange,
//     );
//     const postOverlapInfo: {
//         post: Post;
//         time: [Date, Date] | null
//     }[] = [];

//     for (let [i, j] of postOverlaps) {
//         if (figure1.posts[i].time === null && figure2.posts[j].time === null) {
//             similarity += ranks.post.nonTemporal * overlapTime / lifespan1 / lifespan2;
//             postOverlapInfo.push({
//                 post: figure1.posts[i],
//                 time: null,
//             });
//         }
//         else if (figure1.posts[i].time === null) {
//             similarity += ranks.post.nonTemporal * r1;
//             postOverlapInfo.push({
//                 post: figure1.posts[i],
//                 time: null,
//             });
//         }
//         else if (figure2.posts[j].time === null) {
//             similarity += ranks.post.nonTemporal * r2;
//             postOverlapInfo.push({
//                 post: figure1.posts[i],
//                 time: null,
//             });
//         }
//         else {
//             similarity += ranks.post.normal;
//             const s1 = figure1.posts[i].time!.getTime();
//             const e1 = i === figure1.posts.length - 1 || figure1.posts[i + 1].time === null ? timeRange[1].getTime() : figure1.posts[i + 1].time!.getTime();
//             const s2 = figure2.posts[j].time!.getTime();
//             const e2 = j === figure2.posts.length - 1 || figure2.posts[j + 1].time === null ? timeRange[1].getTime() : figure2.posts[j + 1].time!.getTime();
//             postOverlapInfo.push({
//                 post: figure1.posts[i],
//                 time: [new Date(Math.max(s1, s2)), new Date(Math.min(e1, e2))],
//             });
//         }
//     }

//     /** 具有相同的类型 */
//     if (figure1.type === figure2.type) {
//         similarity += ranks.type.normal;
//     }

//     return {
//         similarity,
//         relationInfo,
//         locationOverlapInfo,
//         postOverlapInfo,
//     }
// }

// export function timeSimilarity(figure: FigureDatum, timeRange: [Date, Date]) {
//     const ranks = store.state.similarityWeights.historical;
//     /** 時間沒有重疊 */
//     if (figure.time[1] < timeRange[0] || figure.time[0] > timeRange[1]) {
//         return 0;
//     }
//     let similarity = 1;
//     /** 關係 */
//     for (let i = 0; i < figure.relations.length; ++i) {
//         const relation = figure.relations[i];
//         if (relation.time === null) continue;
//         if (relation.time >= timeRange[0] && relation.time <= timeRange[1]) {
//             similarity += ranks.relation;
//         }
//     }
//     /** 官職 */
//     for (let i = 0; i < figure.posts.length; ++i) {
//         const post = figure.posts[i];
//         if (post.time === null) continue;
//         if (post.time >= timeRange[0] && post.time <= timeRange[1]) {
//             const end = post.endTime !== null ? post.endTime :
//                 i === figure.posts.length - 1 || figure.posts[i + 1].time === null ? timeRange[1] : figure.posts[i + 1].time!;
//             similarity += ranks.post * post.rank / 20 *
//                 (end.getTime() - post.time.getTime()) / (timeRange[1].getTime() - timeRange[0].getTime());
//         }
//     }
//     return similarity;
// }