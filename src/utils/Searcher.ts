import { Figure } from "../types";

export default class Searcher {
    constructor(
        public data: Figure[]
    ) {}

    search(keyword: string) {
        return this.data
            .filter(item => this.match(keyword, item) > 0);
    }

    searchMany(keywords: string[]) {
        if (keywords.length === 0) return this.data;
        return this.data
            .filter(item => keywords.every(keyword => this.match(keyword, item) > 0));
    }

    match(query: string, item: Figure): number {
        const qs = query.split("|");
        return item.events.some(event => qs.some(q => {
            return event.description.includes(q);
        })) ? 1 : 0;
    }
}