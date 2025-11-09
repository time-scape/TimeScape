import Konva from "konva";
import { BaseType, ValueFn } from "./types";

const none = function() { return null; };
const empty = function() { return []; };


export function selector<Element extends BaseType, Datum, CElement extends BaseType>(selector: string): ValueFn<Element, Datum, CElement>;
export function selector<Element extends BaseType, Datum, CElement extends BaseType>(selector: null): ValueFn<null, Datum, CElement>;
export function selector<Element extends BaseType, Datum, CElement extends BaseType>(selector: string | null) {
    return selector == null ? none as any : function(this: Element) {
        return (this === null ? null : (this as unknown as Konva.Group)?.findOne(selector)) as CElement;
    };
}

export function selectorAll<Element extends BaseType, Datum, CElement extends BaseType>(selector: string): ValueFn<Element, Datum, CElement>;
export function selectorAll<Element extends BaseType, Datum, CElement extends BaseType>(selector: null): ValueFn<null, Datum, CElement>;
export function selectorAll<Element extends BaseType, Datum, CElement extends BaseType>(selector: string | null) {
    return selector == null ? empty as any : function(this: Element) {
        return (this as unknown as Konva.Group)?.find(selector) as CElement[];
    };
}