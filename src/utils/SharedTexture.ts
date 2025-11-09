import * as PIXI from "pixi.js";

/**
 * 用于共享纹理的类，可以避免重复创建纹理，提高性能
 */
export default class SharedTexture {
    private static pixi: PIXI.Application;
    private static dict: Record<string, PIXI.Texture> = {};

    static init(pixi: PIXI.Application) {
        this.pixi = pixi; 
    }

    static generate(key: string, graphic: PIXI.Container) {
        const bounds = graphic.getLocalBounds();
        const paddingX = 0;
        const paddingY = 0;
      
        graphic.position.set(-bounds.x + paddingX, -bounds.y + paddingY); // padding
        const renderTexture = PIXI.RenderTexture.create({
          width: bounds.width + paddingX * 2,
          height: bounds.height + paddingY * 2,
        });
        this.pixi.renderer.render(graphic, { renderTexture });
        
        this.dict[key] = renderTexture;
        return renderTexture;
    }

    static generateFromCanvas(key: string, canvas: HTMLCanvasElement) {
        const sprite = new PIXI.Sprite(PIXI.Texture.from(canvas));
        const size = Math.min(canvas.width, canvas.height);
        const icon = new PIXI.Graphics()
            .rect(0, 0, size, size)
            .fill("#fff");
        icon.mask = sprite;
        SharedTexture.generate(key, icon);
    }

    static instance(key: string) {
        if (this.dict[key] === undefined) {
            throw new Error(`Texture ${key} not found`);
        }
        const texture = this.dict[key];
        const sprite = new PIXI.Sprite(texture);
        sprite.anchor.set(0.5);
        return sprite;
    }
}