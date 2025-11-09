/**
 * date.js：日期相关的工具函数
 */
import * as d3 from 'd3';
import Tick from '../timeline/single/timeline-tick';

// 根据数据计算时间跨度
function timeExtent<T>(data: T[], accessor?: (d: T) => Date | [Date, Date]) {
    accessor = accessor || (d=> (d as any).time as Date | [Date, Date]);
    let extent = d3.extent(data.flatMap(accessor));
    let range = (extent[1]?.getTime() ?? 0) - (extent[0]?.getTime() ?? 0);
    return [
        Number(extent[0]) - range * 0.03,
        Number(extent[1]) + range * 0.03
    ];
}

// 根据数据自适应地计算刻度
function data2ticks<T>(
    data: T[],
    accessor: (d: T) => Date | [Date, Date],
    fontsize: number = 18,
    tickLength: number = 18,
    ticksNumber: number = 20
): Tick[] {

    const granularities: {
        [key: string]: [number, (t: Date) => boolean]
    } = {
        sec: [1000, t=>t.getSeconds()!==0],
        min: [60000, t=>t.getMinutes()!==0],
        hour: [3600000, t=>t.getHours()!==0],
        day: [86400000, t=>t.getDate()!==1],
        mon: [2592000000, t=>t.getMonth()!==0],
        year: [31536000000, t=>t.getFullYear()%10!==0],
        year10: [315360000000, t=>t.getFullYear()%100!==0],
        year100: [3153600000000, t=>t.getFullYear()%1000!==0],
        year1000: [31536000000000, t=>true],
    }
    const is_list: {
        [key: string]: [(t: Date) => boolean, string]
    } = {
        sec: [t=>t.getMilliseconds() === 0, '1s'],
        min: [t=>t.getSeconds() === 0, '1M'],
        hour: [t=>t.getMinutes() === 0, '1h'],
        day: [t=>t.getHours() === 0, '1d'],
        mon: [t=>t.getDate() === 1, '1m'],
        year: [t=>t.getMonth() === 0, '1y'],
        year10: [t=>t.getFullYear()%10 === 0, '10y'],
        year100: [t=>t.getFullYear()%100 === 0, '100y'],
        year1000: [t=>t.getFullYear()%1000 === 0, '1000y'],
    }
    const formats: {
        [key: string]: (t: Date) => string
    } = {
        sec: t=>`${t.getSeconds()}秒`,
        min: t=>`${t.getMinutes()}分`,
        hour: t=>`${t.getHours()}时`,
        day: t=>`${t.getDate()}日`,
        mon: t=>`${t.getMonth()+1}月`,
        year: t=>`${t.getFullYear() < 0 ? "前" : ""}${Math.abs(t.getFullYear()) || 1}年`,
        year10: t=>`${t.getFullYear() < 0 ? "前" : ""}${Math.abs(t.getFullYear()) || 1}年`,
        year100: t=>`${t.getFullYear() < 0 ? "前" : ""}${Math.abs(t.getFullYear()) || 1}年`,
        year1000: t=>`${t.getFullYear() < 0 ? "前" : ""}${Math.abs(t.getFullYear()) || 1}年`,
    }
    const keys = Object.keys(granularities);

    let minGranularity: number | undefined
    let maxGranularity: number | undefined;

    let times = data.flatMap(accessor);

    /**计算最粗粒度 */
    let extent = timeExtent(data);
    let range = extent[1] - extent[0];

    for(let i in keys) {
        let key = keys[i];
        if(range <= granularities[key][0] * ticksNumber){
            maxGranularity = Number(i);
            break;
        }
    }
    if(maxGranularity === undefined){
        maxGranularity = keys.length - 1;
    }

    /**计算最细粒度 */
    for(let i in keys){
        let key = keys[i];
        if(times.some(granularities[key][1])){
            minGranularity = Number(i);
            break;
        }
    }
    if(minGranularity === undefined) {
        minGranularity = 0;
    }
    if(maxGranularity < minGranularity) {
        [maxGranularity, minGranularity] = [minGranularity, maxGranularity];
    }
    if(maxGranularity > minGranularity + 2) {
        minGranularity = maxGranularity - 2;
    }

    /**获取多级刻度的参数 */
    let filters: ((t: Date) => boolean)[] = [];
    let ticks = keys.slice(minGranularity, maxGranularity+1).reverse();
    let R = Math.max(0.5, 1 - ticks.length * 0.25);

    return ticks.map((k,i)=>{
        if(!k.startsWith('year')){
            filters = filters.slice(-1);
        }
        let fs = filters.slice();

        let is = is_list[k];
        let r = 0.85 ** i //ticks.length <= 1 ? 1 : 1 - i*i/(ticks.length-1)/(ticks.length-1)*R

        filters.push(is[0]);

        return Tick.create()
            .is(
                (t)=> !fs.some(f=>f(t)) && is[0](t),
                is[1]
            )
            .tickLength(tickLength*r)
            .fontsize(fontsize*r)
            .tickFormat(formats[k]);
    });
}

// 字符串转日期，主要考虑公元前的情况，格式为：(-?)YYYY年MM月DD日
// 暂时没考虑公元1年到公元前1年之间的情况
function string2Date(string: string) {
    const p = /^(-)?(\d+)[-/年]?((\d+)[-/月]?((\d+)[日]?)?)?$/;
    const match = string.match(p);
    if (match === null) {
        throw new Error('Invalid date string: ' + string + '.');
    }
    const signal = match[1] === undefined ? 1 : -1;
    const year = signal === 1 ? Number(match[2]) : (-Number(match[2]));
    const month = Number(match[4] ?? 1);
    const day = Number(match[6] ?? 1);
    return new Date(year, month - 1, day);
}

function date2string(date: Date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return day === 1 ?
        month === 1 ? `${year}年` : `${year}年${month}月` :
        `${year}年${month}月${day}日`;
}

export default {
    timeExtent,
    data2ticks,
    string2Date,
    date2string,
}