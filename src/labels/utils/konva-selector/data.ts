import { KeyType, BaseType, ValueFn } from "./types";
import { EnterNode } from "./enter";
export function bindIndex<Element extends BaseType, Datum, PElement extends BaseType>(
    parent: PElement,
    group: Element[],
    enter: Element[],
    update: Element[],
    exit: Element[],
    data: Datum[],
) {
  let i = 0,
      node: Element,
      groupLength = group.length,
      dataLength = data.length;

  // Put any non-null nodes that fit into update.
  // Put any null nodes into enter.
  // Put any remaining data into enter.
  for (; i < dataLength; ++i) {
    if (node = group[i]) {
      (node as any).__data__ = data[i];
      update[i] = node;
    } else {
      enter[i] = new EnterNode(parent, data[i]) as unknown as Element;
    }
  }

  // Put any non-null nodes that don’t fit into exit.
  for (; i < groupLength; ++i) {
    if (node = group[i]) {
      exit[i] = node;
    }
  }
}

export function bindKey<Element extends BaseType, Datum, NewDatum, PElement extends BaseType>(
    parent: PElement,
    group: Element[],
    enter: Element[],
    update: Element[],
    exit: Element[],
    data: Datum[],
    key: ValueFn<Element | PElement, Datum | NewDatum, KeyType>
) {
  let i,
      node: Element,
      nodeByKeyValue = new Map,
      groupLength = group.length,
      dataLength = data.length,
      keyValues = new Array(groupLength),
      keyValue;
  // Compute the key for each node.
  // If multiple nodes have the same key, the duplicates are added to exit.
  for (i = 0; i < groupLength; ++i) {
    if (node = group[i]) {
      keyValues[i] = keyValue = key.call(node, (node as any).__data__, i, group) + "";
      if (nodeByKeyValue.has(keyValue)) {
        exit[i] = node;
      } else {
        nodeByKeyValue.set(keyValue, node);
      }
    }
  }

  // Compute the key for each datum.
  // If there a node associated with this key, join and add it to update.
  // If there is not (or the key is a duplicate), add it to enter.
  for (i = 0; i < dataLength; ++i) {
    keyValue = key.call(parent, data[i], i, data as any) + "";
    if (node = nodeByKeyValue.get(keyValue)) {
      update[i] = node;
      (node as any).__data__ = data[i];
      nodeByKeyValue.delete(keyValue);
    } else {
      enter[i] = new EnterNode(parent, data[i]) as unknown as Element;
    }
  }

  // Add any remaining nodes that were not bound to data to exit.
  for (i = 0; i < groupLength; ++i) {
    if ((node = group[i]) && (nodeByKeyValue.get(keyValues[i]) === node)) {
      exit[i] = node;
    }
  }
}

// function datum(node) {
//   return node.__data__;
// }



// Given some data, this returns an array-like view of it: an object that
// exposes a length property and allows numeric indexing. Note that unlike
// selectAll, this isn’t worried about “live” collections because the resulting
// array will only be used briefly while data is being bound. (It is possible to
// cause the data to change while iterating by using a key function, but please
// don’t; we’d rather avoid a gratuitous copy.)
// function arraylike(data) {
//   return typeof data === "object" && "length" in data
//     ? data // Array, TypedArray, NodeList, array-like
//     : Array.from(data); // Map, Set, iterable, string, or anything else
// }