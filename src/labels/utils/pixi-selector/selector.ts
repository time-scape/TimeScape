import { BaseType, ValueFn } from "./types";

const none = function() { return null; };
const empty = function() { return []; };


export function selector<Element extends BaseType, Datum, CElement extends BaseType>(selector: string): ValueFn<Element, Datum, CElement>;
export function selector<Element extends BaseType, Datum, CElement extends BaseType>(selector: null): ValueFn<null, Datum, CElement>;
export function selector<Element extends BaseType, Datum, CElement extends BaseType>(selector: string | null) {
    return selector == null ? none as any : function(this: Element) {
        return (this === null ? null : this.getChildByLabel(selector)) as CElement;
    };
}

export function selectorAll<Element extends BaseType, Datum, CElement extends BaseType>(selector: string): ValueFn<Element, Datum, CElement>;
export function selectorAll<Element extends BaseType, Datum, CElement extends BaseType>(selector: null): ValueFn<null, Datum, CElement>;
export function selectorAll<Element extends BaseType, Datum, CElement extends BaseType>(selector: string | null) {
    return selector == null ? empty as any : function(this: Element) {
        return this?.getChildrenByLabel(selector) as CElement[];
    };
}