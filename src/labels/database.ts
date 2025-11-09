import Loki from 'lokijs';
import Label from './label';

class Database<T extends Object> {
    private db: LokiConstructor;
    collection: Collection<T>;
    options: Partial<CollectionOptions<T>>;

    constructor(data: T[], options: Partial<CollectionOptions<T>>) {
        this.db = new Loki('figures.db');
        this.collection = this.db.addCollection<T>('figures', options);
        this.options = options;
        this.collection.insert(data);
    }

    find(query: LokiQuery<T & LokiObj>): T[] {
        return this.collection.find(query);
    }

    /** 将数据更新同步到数据库中 */
    update(data?: T[]) {
        if (data === undefined) {
            data = this.collection.data;
        }
        this.collection.clear();
        this.collection.insert(data);
    }
}


export default class FigureDatabase {
    database: Database<Label>;

    constructor(data: Label[]) {
        this.database = new Database(data, {
            indices: ['initialPosition.x1', 'initialPosition.x2', 'initialPosition.y1', 'initialPosition.y2', 'datum.weight' as any],
        });
    }

    find(xRange: [number, number], yRange: [number, number]) {
        return this.database.collection.chain()
            .find({
                ['initialPosition.x1' as any]: { $lte: xRange[1] },
                ['initialPosition.x2' as any]: { $gte: xRange[0] },
                ['initialPosition.y1' as any]: { $lte: yRange[1] },
                ['initialPosition.y2' as any]: { $gte: yRange[0] },
            })
            .simplesort("datum.weight" as any, {
                desc: true,
            })
            .data();
    }
}