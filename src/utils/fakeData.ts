import { Event, Figure } from "../types";
import { Random } from "mockjs";

export default function generate(): Figure {
    const start = new Date(960, 0, 1).getTime();
    const end = new Date(1127, 0, 1).getTime();

    const ts = Random.integer(start, end);
    const lifespan = Random.integer(30, 70) * 365 * 24 * 60 * 60 * 1000;
    const types = ["皇帝", "文官", "武將", "宦官", "宗室", "后妃", "學者", "僧道", "布衣"];
    const eventTypes = ["出生", "死亡", "教育-入學", "教育-畢業", "入仕-考試及第", "入仕-舉薦", "官職變動-擢升", "官職變動-貶謫", "官職變動-平調", "官職變動-主動辭官或致仕", "官職變動-丁憂", "官職變動-奪情或起復", "政績實踐-任職政績", "成就-著作發表", "成就-戰役勝利", "皇帝-登基", "皇帝-退位"];

    Random.increment(100000);

    return {
        id: Random.increment(),
        name: Random.cname(),
        time: [new Date(ts), new Date(ts + lifespan)],
        type: Random.pick(types),
        birthplace: null,
        weight: Random.integer(1, 100),
        description: Random.csentence(10, 50),
        totalHistoricalContextWeight: 0,
        events: [
            ...new Array(Random.integer(1, 10)).fill(0).map(() => {
                return {
                    id: Random.increment(),
                    time: new Date(Random.integer(start + 1, end - 1)),
                    description: Random.csentence(15, 50),
                    short_description: Random.csentence(10, 25),
                    type: Random.pick(eventTypes),
                    subtype: "",
                    importance: Random.float(0, 1),
                    size: 0,
                    locations: [],
                    posts: [],
                    relations: [],
                }
            })
        ].sort((a, b) => a.time.getTime() - b.time.getTime()),
        locations: [],
        posts: [],
        relations: [],
        layout: {
            importance: Random.float(0, 1),
        },
        status: Random.integer(1, 5),
    }
}