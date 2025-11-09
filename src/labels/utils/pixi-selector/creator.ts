import { Graphics, Sprite, Text, Container, HTMLText } from "pixi.js";
import { BaseType } from "./types";

export const ElementDict: {
    [key: string]: () => BaseType;
} = {
    "graphics": () => new Graphics(),
    "text": () => new Text(),
    "htmlText": () => new HTMLText(),
    "sprite": () => new Sprite(),
    "container": () => new Container(),
}

export default function(query: string) {
    return ElementDict[query];
}