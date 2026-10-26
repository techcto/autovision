// Rebuild raster deliverables from the repository's code-native SVG brand assets.
import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
const root=new URL('../../',import.meta.url);
const source=new URL('public/brand/autovision-icon.svg',root).pathname;
await sharp(source).resize(512,512).png().toFile(new URL('public/brand/autovision-icon-512.png',root).pathname);
await sharp(source).resize(180,180).png().toFile(new URL('public/brand/apple-touch-icon.png',root).pathname);
await sharp(source).resize(640,640).png().toFile(new URL('public/autovision-logo-marketplace-640.png',root).pathname);
await sharp(new URL('public/brand/autovision-devpost.svg',root).pathname).png().toFile(new URL('public/brand/autovision-devpost-1200x800.png',root).pathname);
const png=await sharp(source).resize(32,32).png().toBuffer();
const header=Buffer.alloc(22);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header[6]=32;header[7]=32;header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(png.length,14);header.writeUInt32LE(22,18);
await writeFile(new URL('public/favicon.ico',root),Buffer.concat([header,png]));
console.log('Exported AutoVision app icons, favicon, marketplace icon and 3:2 Devpost thumbnail.');
