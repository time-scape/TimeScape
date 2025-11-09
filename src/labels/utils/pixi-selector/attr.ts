import { BaseType, ValueFn } from "./types";
export function attrRemove(name: string) {
  return function(this: any) {
    delete this[name];
  };
}

export function attrConstant(name: string, value: any) {
  return function(this: any) {
    this[name] = value;
  };
}

export function attrFunction<Element extends BaseType, Datum>(name: string, value: ValueFn<Element, Datum, any>) {
  return function(this: any) {
    var v = value.apply(this, arguments as any);
    if (v == null) delete this[name];
    else this[name] = v;
  };
}
