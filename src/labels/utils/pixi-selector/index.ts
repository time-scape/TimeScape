import { KeyType, BaseType, ValueFn } from "./types";
import constant from "./constant";
import { bindIndex, bindKey } from "./data";
import { attrRemove, attrConstant, attrFunction } from "./attr";
import creator, { ElementDict } from "./creator";
import { selector, selectorAll } from "./selector";
import remove from "./remove";
import on, { OnHandler, OnKeys } from "./on";

export function select<Element extends BaseType>(element: Element): PIXISelection<Element, unknown, null, any>;
export function select<Element extends BaseType>(elements: Element[]): PIXISelection<Element, unknown, null, any>;
export function select<Element extends BaseType>(value: Element | Element[]) {
    if (Array.isArray(value)) {
        return new PIXISelection<Element, unknown, null, any>([value]);
    }
    return new PIXISelection<Element, unknown, null, any>([[value]]);
}

export class PIXISelection<Element extends BaseType, Datum, PElement extends BaseType, PDatum> {
    private _groups: Element[][] = [];
    private _parents: PElement[] = [];

    constructor(groups: Element[][], parents?: PElement[]) {
        this._groups = groups;
        this._parents = parents ?? [null] as PElement[];
    }

    *[Symbol.iterator](): Generator<Element, any, any> {
        for(let groups = this._groups, m = groups.length, i = 0; i < m; ++i) {
            for (let group = groups[i], n = group.length, j = 0, node; j < n; ++j) {
                if (node = group[j]) yield node as Element;
            }
        }
    }

    select<CElement extends BaseType>(select: string): PIXISelection<CElement, Datum, PElement, PDatum>;
    select<CElement extends BaseType>(select: null): PIXISelection<null, undefined, PElement, PDatum>;
    select<CElement extends BaseType>(select: ValueFn<Element, Datum, CElement>): PIXISelection<CElement, Datum, PElement, PDatum>;
    select<CElement extends BaseType>(select: any) {
        if (typeof select !== "function") select = selector(select);

        const groups = this._groups,
              m = groups.length,
              subgroups: CElement[][] = new Array(m);

        for (let j = 0; j < m; ++j) {
            for (let group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
                if ((node = group[i]) && (subnode = select.call(node as Element, (node as any).__data__, i, group))) {
                    if ("__data__" in node) (subnode as any).__data__ = node.__data__;
                    subgroup[i] = subnode;
                }
            }
        }
        return new PIXISelection(subgroups, this._parents) as any;
    }

    selectAll(select?: null): PIXISelection<null, undefined, Element, Datum>;
    selectAll<CElement extends BaseType, OldDatum>(select: string): PIXISelection<CElement, OldDatum, Element, Datum>;
    selectAll<CElement extends BaseType, OldDatum>(select: ValueFn<Element, Datum, CElement[]>): PIXISelection<CElement, OldDatum, Element, Datum>;
    selectAll<CElement extends BaseType = Element>(select: any) {
        if (typeof select !== "function") select = selectorAll(select);

        const groups = this._groups,
              m = groups.length,
              subgroups: CElement[][] = [],
              parents: Element[] = [];

        for (let j = 0; j < m; ++j) {
            for (let group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
                if (node = group[i]) {
                    subgroups.push(select.call(node, (node as any).__data__, i, group));
                    parents.push(node as Element);
                }
            }
        }

        return new PIXISelection(subgroups, parents) as any;
    }

    each(func: ValueFn<Element, Datum, void>): this {
        for (let i = 0; i < this._groups.length; ++i) {
            const group = this._groups[i];
            for (let j = 0; j < group.length; ++j) {
                const node = group[j];
                if (node) {
                    func.call(node, (node as any).__data__, j, group);
                }
            }
        }
        return this;
    }

    node() {
        for (let i = 0, groups = this._groups, m = groups.length; i < m; ++i) {
            for (let group = groups[i], j = 0, n = group.length; j < n; ++j) {
                let node = group[j];
                if (node) return node;
            }
        }
        return null;
    }

    nodes() {
        return Array.from(this);
    }

    attr(name: string): any;
    attr(name: string, value: ValueFn<Element, Datum, any> | null): this;
    attr(name: string, value: any): this;
    attr(name: string, value?: any) {
        return arguments.length > 1
            ? this.each((value == null
                ? attrRemove : typeof value === "function"
                ? attrFunction
                : attrConstant)(name, value))
            : (this.node() as any)[name];
    }

    datum(): Datum;
    datum(value: null): PIXISelection<Element, undefined, PElement, PDatum>;
    datum<NewDatum>(value: ValueFn<Element, Datum, NewDatum>): PIXISelection<Element, NewDatum, PElement, PDatum>;
    datum(value?: any) {
        return arguments.length
            ? this.attr("__data__", value)
            : (this.node() as any).__data__;
    }

    data(): Datum[];
    data<NewDatum>(data: NewDatum[] | ValueFn<PElement, PDatum, NewDatum[]>, key?: ValueFn<Element | PElement, Datum & NewDatum, KeyType>): PIXISelection<Element, NewDatum, PElement, PDatum>;
    data<NewDatum>(value?: NewDatum[] | ValueFn<PElement, PDatum, NewDatum[]>, key?: ValueFn<Element | PElement, Datum & NewDatum, KeyType>) {
        if (arguments.length === 0) {
            return Array.from(this, n => (n as any).__data__);
        }

        const groups = this._groups,
              parents = this._parents,
              bind = key ? bindKey : bindIndex,
              m = groups.length,
              update: Element[][] = new Array(m),
              enter: Element[][] = new Array(m),
              exit: Element[][] = new Array(m);

        if (typeof value !== "function") value = constant(value!);

        for (let i = 0; i < m; ++i) {
            
            let parent = parents[i],
                group = groups[i],
                groupLength = groups.length,
                data = value.call(parent, parent && (parent as any).__data__, i, parents),
                dataLength = data.length,
                enterGroup = enter[i] = new Array(dataLength),
                updateGroup = update[i] = new Array(dataLength),
                exitGroup = exit[i] = new Array(groupLength);

            bind(parent, group, enterGroup, updateGroup, exitGroup, data, key! as any);
            
            for (let i0 = 0, i1 = 0, previous, next; i0 < dataLength; ++i0) {
                if (previous = enterGroup[i0]) {
                    if (i0 >= i1) i1 = i0 + 1;
                    while (!(next = updateGroup[i1]) && ++i1 < dataLength);
                    previous._next = next || null;
                }
            }
        }

        const result = new PIXISelection(update, parents);
        (result as any)._enter = enter;
        (result as any)._exit = exit;

        return result;
    }

    append<K extends keyof typeof ElementDict>(type: K): PIXISelection<ReturnType<typeof ElementDict[K]>, Datum, PElement, PDatum>;
    append<CElement extends BaseType>(type: string): PIXISelection<CElement, Datum, PElement, PDatum>;
    append<CElement extends BaseType>(type: ValueFn<Element, Datum, CElement>): PIXISelection<CElement, Datum, PElement, PDatum>;
    append<CElement extends BaseType>(type: any) {
        const create = typeof type !== "function" ? creator(type) : type;
        return this.select(function(this: Element) {
            return this!.addChild(create.apply(this, arguments as any));
        });
    }

    enter(): PIXISelection<Element, Datum, PElement, PDatum>;
    enter() {
        return new PIXISelection(
            (this as any)._enter || this._groups.map(g => new Array(g.length) as Element[]),
            this._parents,
        );
    }

    exit(): PIXISelection<Element, Datum, PElement, PDatum>;
    exit() {
        return new PIXISelection(
            (this as any)._exit || this._groups.map(g => new Array(g.length) as Element[]),
            this._parents,
        )
    }

    order(): this;
    order() {
        const groups = this._groups,
              m = groups.length;
        for (let i = 0, group, n, nd; i < m; ++i) {
            group = groups[i];
            n = group.length;
            
            // d3.js在这里调用了compareDocumentPosition去判断元素的先后顺序。这里简化为要求所有节点必须属于同一个父节点，因此只需要zIndex即可
            for (let j = 0, node; j < n; ++j) {
                (node = group[j]) && (nd = node) && (node.zIndex = j);
            }
            nd && nd.parent.sortChildren();
            for (let j = 0, node; j < n; ++j) {
                (node = group[j]) && (node.zIndex = 0);
            }
        }
        return this;
    }

    merge(other: PIXISelection<Element, Datum, PElement, PDatum>): PIXISelection<Element, Datum, PElement, PDatum> {
        const groups0 = this._groups,
              groups1 = other._groups,
              m0 = groups0.length,
              m1 = groups1.length,
              m = Math.min(m0, m1),
              merges: Element[][] = new Array(m0);
        let j = 0;

        for (; j < m; ++j) {
            for (let group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
                if (node = group0[i] || group1[i]) {
                    merge[i] = node;
                }
            }
        }

        for (; j < m0; ++j) {
            merges[j] = groups0[j];
        }

        return new PIXISelection(merges, this._parents);
    }

    remove() {
        this.each(remove);
    }

    on<Key extends OnKeys>(key: Key, handler: OnHandler<Element, Datum>) {
        this.each(function (d: Datum) {
            // @ts-ignore
            on.call(this, key, handler, d);
        });
    }

    join<K extends keyof typeof ElementDict, OldDatum = Datum>(
        enter: K,
        update?: (
            elem: PIXISelection<Element, Datum, PElement, PDatum>,
        ) => PIXISelection<Element, Datum, PElement, PDatum>,
        exit?: (elem: PIXISelection<Element, OldDatum, PElement, PDatum>) => void,
    ): PIXISelection<Element | ReturnType<typeof ElementDict[K]>, Datum, PElement, PDatum>;
    join<CElement extends BaseType, OldDatum = Datum>(
        enter:
            | string
            | ((
                elem: PIXISelection<Element, Datum, PElement, PDatum>,
            ) => PIXISelection<CElement, Datum, PElement, PDatum>),
        update?: (
            elem: PIXISelection<Element, Datum, PElement, PDatum>,
        ) => PIXISelection<Element, Datum, PElement, PDatum>,
        exit?: (elem: PIXISelection<Element, OldDatum, PElement, PDatum>) => void,
    ): PIXISelection<CElement | Element, Datum, PElement, PDatum>;
    join(
        onenter: any,
        onupdate: any,
        onexit: any,
    ) {
        let enter = this.enter(), update = this, exit = this.exit();
        if (typeof onenter === "function") {
            enter = onenter(enter);
        } else {
            enter = enter.append(onenter + "") as any;
        }
        if (onupdate) {
            update = onupdate(update);
        }
        if (!onexit) exit.remove(); else onexit(exit);

        return enter && update ? enter.merge(update).order() : update;
    }
}