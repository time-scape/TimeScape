import * as PIXI from "pixi.js";
import EarthCoordinate from "../../utils/EarthCoordinate";
import * as d3 from "d3";
import { locationColorMap } from "../../constants";
import { $locationSelected } from "../../store";
import Component from "./template";
import SharedTexture from "../../utils/SharedTexture";

const centerColor = d3.color(locationColorMap.range[0])!.formatHex();
const unknownColor = d3.color(locationColorMap.range[1])!.formatHex();

/** 指南针形的地点图标 */
export default class LocationIcon extends Component {
    static init() {
        const background = LocationIcon.getBackground();
        SharedTexture.generate("background", background);
        const pointer = LocationIcon.getPointer();
        SharedTexture.generate("LocationIcon-pointer", pointer);
        const center = LocationIcon.getCenter();
        SharedTexture.generate("LocationIcon-center", center);
        const unknown = LocationIcon.getUnknown();
        SharedTexture.generate("LocationIcon-unknown", unknown);
    }

    private static size = 200;

    private static getBackground() {
        const size = LocationIcon.size;
        return new PIXI.Graphics()
            .circle(size * 0.5, size * 0.5, size * 0.5)
            .fill("#fff");
    }

    private static getPointer() {

        const size = LocationIcon.size;
        const delta = Math.PI * 0.7;
        const r0 = size * 0.15;
        const cx = size * 0.5;
        const cy = size * 0.8;

        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;

        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, size, size);

        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        ctx.moveTo(size * 0.5, size * 0.05);
        ctx.lineTo(cx + r0 * Math.cos(Math.PI / 2 - delta), cy + r0 * Math.sin(Math.PI / 2 - delta));
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + r0 * Math.cos(Math.PI / 2 + delta), cy + r0 * Math.sin(Math.PI / 2 + delta));
        ctx.closePath();
        ctx.fill();

        const sprite = new PIXI.Sprite(PIXI.Texture.from(canvas));
        
        const icon = new PIXI.Graphics()
            .circle(size * 0.5, size * 0.5, size * 0.5)
            .fill("#fff");

        icon.mask = sprite;
        
        return icon;
    }

    private static getCenter() {

        const size = LocationIcon.size;
        const r0 = size * 0.15;
        const cx = size * 0.5;
        const cy = size * 0.5;

        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;

        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, size, size);

        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        ctx.arc(cx, cy, r0, 0, Math.PI * 2);
        ctx.fill();

        const sprite = new PIXI.Sprite(PIXI.Texture.from(canvas));

        const icon = new PIXI.Graphics()
            .circle(size * 0.5, size * 0.5, size * 0.5)
            .fill("#fff");

        icon.mask = sprite;

        return icon;
    }

    private static getUnknown() {
        const size = LocationIcon.size;
        const cx = size * 0.5;
        const cy = size * 0.5;
        const fontsize = size * 0.7;

        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;

        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, size, size);

        ctx.globalCompositeOperation = "destination-out";
        ctx.font = `bold ${fontsize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("?", cx, cy);
        ctx.fill();

        const sprite = new PIXI.Sprite(PIXI.Texture.from(canvas));

        const icon = new PIXI.Graphics()
            .circle(size * 0.5, size * 0.5, size * 0.5)
            .fill("#fff");

        icon.mask = sprite;

        return icon;
    }

    static drawBackground(
        container: PIXI.Container,
        size: number,
        forceFlush: boolean = false,
    ) {
        let background = container.getChildByLabel("location-label-background") as PIXI.Container | null;
        if (background === null || forceFlush) {
            container.removeChildren();
            background = SharedTexture.instance("background");
            background.label = "location-label-background";
            container.addChild(background);
        }
        background.x = size * 0.5;
        background.y = size * 0.5;
        background.scale = size / LocationIcon.size;
    }

    static drawUnknown(
        container: PIXI.Container,
        size: number,
        forceFlush: boolean = false,
    ) {
        let icon = container.getChildByLabel("location-icon") as PIXI.Container | null;
        const color = unknownColor;
        if (icon === null || forceFlush) {
            icon = SharedTexture.instance("LocationIcon-unknown");
            icon.label = "location-icon";
            container.addChild(icon);
        }
        icon.x = size * 0.5;
        icon.y = size * 0.5;
        icon.scale = size / LocationIcon.size;
        icon.tint = Number.parseInt(locationColorMap.range[locationColorMap.range.length - 1].slice(1), 16);

        return color;
    }

    static drawCenter(
        container: PIXI.Container,
        size: number,
        forceFlush: boolean = false,
    ) {
        let icon = container.getChildByLabel("location-icon") as PIXI.Container | null;
        const color = centerColor;
        if (icon === null || forceFlush) {
            icon = SharedTexture.instance("LocationIcon-center");
            icon.label = "location-icon";
            container.addChild(icon);
        }
        icon.x = size * 0.5;
        icon.y = size * 0.5;
        icon.scale = size / LocationIcon.size;
        icon.tint = Number.parseInt(color.slice(1), 16);

        return color;
    }

    static drawPointer(
        container: PIXI.Container,
        size: number,
        distance: number,
        bearing: number,
        forceFlush: boolean = false,
    ) {
        let icon = container.getChildByLabel("location-icon") as PIXI.Container | null;
        const color = d3.color(LocationIcon.distanceColorMap(distance))!.formatHex();
        if (icon === null || forceFlush) {
            icon = SharedTexture.instance("LocationIcon-pointer");
            icon.label = "location-icon";
            container.addChild(icon);
        }
        icon.x = size * 0.5;
        icon.y = size * 0.5;
        icon.scale = size / LocationIcon.size;
        icon.tint = Number.parseInt(color.slice(1), 16);
        icon.rotation = bearing;

        return color;
    }

    /**
     * 绘制地点图标
     * @param container 图标容器
     * @param size 图标大小
     * @param center 中心地点
     * @param target 目标地点
     */
    static draw(
        container: PIXI.Container,
        size: number,
        center: EarthCoordinate,
        target: EarthCoordinate | null,
        forceFlush: boolean = false,
    ) {
        LocationIcon.drawBackground(container, size, forceFlush);
        if (target === null) {
            return LocationIcon.drawUnknown(container, size, forceFlush);
        }
        const distance = center.distanceTo(target);
        const bearing = distance < 1 ? undefined : center.bearingTo(target); 
        if (bearing === undefined) {
            return LocationIcon.drawCenter(container, size, forceFlush);
        }
        return LocationIcon.drawPointer(container, size, distance, bearing, forceFlush);
    }

    /**
     * 获取当前的颜色
     * @param center 
     * @param target 
     * @returns 
     */
    static getColor(
        center: EarthCoordinate,
        target: EarthCoordinate | null
    ) {
        if (target === null) {
            return unknownColor;
        }
        const distance = center.distanceTo(target);
        const bearing = distance < 1 ? undefined : center.bearingTo(target); 
        if (bearing === undefined) {
            return centerColor;
        }
        return d3.color(LocationIcon.distanceColorMap(distance))!.formatHex();
    }

    /**
     * @deprecated
     * @param container 
     * @param center 
     * @param target 
     * @returns 
     */
    static updateColorMap(
        container: PIXI.Container,
        center: EarthCoordinate,
        target: EarthCoordinate | null,
    ) {
        if (target === null) {
            return;
        }
        const distance = center.distanceTo(target);
        const background = container.children[0] as PIXI.Graphics;
        background.fill(LocationIcon.distanceColorMap(distance));
    }

    static get distanceColorMap() {
        return d3.scaleLinear<string, string>()
            .domain([0, $locationSelected.value.distance])
            .range(locationColorMap.range)
            .clamp(true)
            .interpolate(d3.interpolateHcl);
    }
}