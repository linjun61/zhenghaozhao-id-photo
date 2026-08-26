"use client";

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";

const presets = [
  { name: "一寸", size: "25 × 35 mm", px: "295 × 413 px", width: 295, height: 413, tag: "常用" },
  { name: "小一寸", size: "22 × 32 mm", px: "260 × 378 px", width: 260, height: 378 },
  { name: "大一寸", size: "33 × 48 mm", px: "390 × 567 px", width: 390, height: 567 },
  { name: "二寸", size: "35 × 49 mm", px: "413 × 579 px", width: 413, height: 579, tag: "常用" },
  { name: "小二寸", size: "35 × 45 mm", px: "413 × 531 px", width: 413, height: 531 },
  { name: "大二寸", size: "35 × 53 mm", px: "413 × 626 px", width: 413, height: 626 },
  { name: "身份证", size: "26 × 32 mm", px: "358 × 441 px", width: 358, height: 441 },
  { name: "社保卡", size: "26 × 32 mm", px: "358 × 441 px", width: 358, height: 441 },
];

type SourceMeta = { width: number; height: number; bytes: number; dpi: number | null };

function readTiffDpi(view: DataView, tiff: number) {
  if (tiff + 8 > view.byteLength) return null;
  const order = view.getUint16(tiff);
  const little = order === 0x4949;
  if (!little && order !== 0x4d4d) return null;
  const get16 = (at: number) => view.getUint16(at, little);
  const get32 = (at: number) => view.getUint32(at, little);
  if (get16(tiff + 2) !== 42) return null;
  const ifd = tiff + get32(tiff + 4);
  if (ifd + 2 > view.byteLength) return null;
  const count = get16(ifd);
  let xResolution: number | null = null;
  let yResolution: number | null = null;
  let unit = 2;
  for (let n = 0; n < count; n++) {
    const entry = ifd + 2 + n * 12;
    if (entry + 12 > view.byteLength) break;
    const tag = get16(entry), dataType = get16(entry + 2), itemCount = get32(entry + 4);
    if (tag === 0x0128 && dataType === 3 && itemCount >= 1) unit = get16(entry + 8);
    if ((tag === 0x011a || tag === 0x011b) && dataType === 5 && itemCount >= 1) {
      const rational = tiff + get32(entry + 8);
      if (rational + 8 <= view.byteLength) {
        const numerator = get32(rational), denominator = get32(rational + 4);
        const value = denominator ? numerator / denominator : 0;
        if (tag === 0x011a) xResolution = value;
        else yResolution = value;
      }
    }
  }
  const resolution = xResolution || yResolution;
  if (!resolution || !Number.isFinite(resolution)) return null;
  return Math.round(unit === 3 ? resolution * 2.54 : resolution);
}

function readEmbeddedDpi(buffer: ArrayBuffer, type: string) {
  const view = new DataView(buffer);
  if (type === "image/png" && view.byteLength > 24) {
    for (let i = 8; i + 17 < view.byteLength;) {
      const length = view.getUint32(i);
      const chunk = String.fromCharCode(view.getUint8(i+4), view.getUint8(i+5), view.getUint8(i+6), view.getUint8(i+7));
      if (chunk === "pHYs" && length >= 9 && view.getUint8(i+16) === 1) return Math.round(view.getUint32(i+8) / 39.3701);
      i += 12 + length;
    }
  }
  if ((type === "image/jpeg" || type === "image/jpg") && view.byteLength > 18) {
    let jfifDpi: number | null = null;
    let i = 2;
    while (i + 15 < view.byteLength) {
      if (view.getUint8(i) !== 0xff) break;
      const marker = view.getUint8(i + 1), length = view.getUint16(i + 2);
      if (marker === 0xe1 && length >= 14 && String.fromCharCode(...new Uint8Array(buffer, i + 4, 6)) === "Exif\0\0") {
        const exifDpi = readTiffDpi(view, i + 10);
        if (exifDpi) return exifDpi;
      }
      if (marker === 0xe0 && String.fromCharCode(...new Uint8Array(buffer, i + 4, 5)) === "JFIF\0") {
        const unit = view.getUint8(i + 11), density = view.getUint16(i + 12);
        if (unit === 1) jfifDpi = density;
        if (unit === 2) jfifDpi = Math.round(density * 2.54);
      }
      if (!length) break; i += 2 + length;
    }
    if (jfifDpi) return jfifDpi;
  }
  if (type === "image/webp" || type === "image/heic" || type === "image/heif") {
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i + 14 < bytes.length; i++) {
      if (bytes[i] === 0x45 && bytes[i+1] === 0x78 && bytes[i+2] === 0x69 && bytes[i+3] === 0x66 && bytes[i+4] === 0 && bytes[i+5] === 0) {
        const exifDpi = readTiffDpi(view, i + 6);
        if (exifDpi) return exifDpi;
      }
    }
  }
  return null;
}

async function jpegBlobWithDpi(canvas: HTMLCanvasElement, dpi: number) {
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("JPEG export failed")), "image/jpeg", 0.94));
  const source = new Uint8Array(await blob.arrayBuffer());
  const density = Math.min(65535, Math.max(1, Math.round(dpi)));
  let i = 2;
  while (i + 17 < source.length && source[i] === 0xff) {
    const marker = source[i + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const length = (source[i + 2] << 8) | source[i + 3];
    if (marker === 0xe0 && length >= 16 && String.fromCharCode(...source.slice(i + 4, i + 9)) === "JFIF\0") {
      source[i + 11] = 1;
      source[i + 12] = density >> 8; source[i + 13] = density & 0xff;
      source[i + 14] = density >> 8; source[i + 15] = density & 0xff;
      return new Blob([source], { type: "image/jpeg" });
    }
    if (length < 2) break;
    i += 2 + length;
  }
  const jfif = new Uint8Array([0xff,0xe0,0x00,0x10,0x4a,0x46,0x49,0x46,0x00,0x01,0x01,0x01,density>>8,density&0xff,density>>8,density&0xff,0x00,0x00]);
  const output = new Uint8Array(source.length + jfif.length);
  output.set(source.slice(0, 2), 0); output.set(jfif, 2); output.set(source.slice(2), 2 + jfif.length);
  return new Blob([output], { type: "image/jpeg" });
}

export default function Home() {
  const [selected, setSelected] = useState(0);
  const [dpi, setDpi] = useState(300);
  const [customWidth, setCustomWidth] = useState(25);
  const [customHeight, setCustomHeight] = useState(35);
  const [customUnit, setCustomUnit] = useState<"px" | "mm" | "cm">("mm");
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [sourceMeta, setSourceMeta] = useState<SourceMeta | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isCustom = selected === presets.length;
  const preset = presets[Math.min(selected, presets.length - 1)];
  const customFactor = customUnit === "px" ? 1 : customUnit === "mm" ? dpi / 25.4 : dpi / 2.54;
  const outputWidth = Math.max(1, Math.round(isCustom ? customWidth * customFactor : preset.width * dpi / 300));
  const outputHeight = Math.max(1, Math.round(isCustom ? customHeight * customFactor : preset.height * dpi / 300));
  const outputPx = `${outputWidth} × ${outputHeight} px`;
  const [presetWidthMm, presetHeightMm] = preset.size.match(/[\d.]+/g)?.map(Number) ?? [0, 0];
  const widthCm = isCustom ? (customUnit === "cm" ? customWidth : customUnit === "mm" ? customWidth / 10 : outputWidth / dpi * 2.54) : presetWidthMm / 10;
  const heightCm = isCustom ? (customUnit === "cm" ? customHeight : customUnit === "mm" ? customHeight / 10 : outputHeight / dpi * 2.54) : presetHeightMm / 10;
  const currentName = isCustom ? "自定义" : preset.name;
  const currentSize = isCustom ? `${customWidth} × ${customHeight} ${customUnit}` : preset.size;

  const readFile = (file?: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      setImage(img); setFileName(file.name); setZoom(1); setOffset({ x: 0, y: 0 });
      const buffer = await file.arrayBuffer();
      setSourceMeta({ width: img.naturalWidth, height: img.naturalHeight, bytes: file.size, dpi: readEmbeddedDpi(buffer, file.type) });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const draw = (target: HTMLCanvasElement, outWidth: number, outHeight: number) => {
    if (!image) return;
    target.width = outWidth; target.height = outHeight;
    const ctx = target.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, outWidth, outHeight);
    const base = Math.max(outWidth / image.width, outHeight / image.height);
    const scale = base * zoom;
    const w = image.width * scale, h = image.height * scale;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, (outWidth - w) / 2 + offset.x * outWidth / 420, (outHeight - h) / 2 + offset.y * outWidth / 420, w, h);
  };

  useEffect(() => {
    if (canvasRef.current && image) draw(canvasRef.current, 840, 840 * outputHeight / outputWidth);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, zoom, offset, selected, dpi, customWidth, customHeight, customUnit]);

  const download = async () => {
    if (!image) return;
    const out = document.createElement("canvas"); draw(out, outputWidth, outputHeight);
    const file = await jpegBlobWithDpi(out, dpi);
    const a = document.createElement("a");
    a.download = `${currentName}-${outputWidth}x${outputHeight}-${dpi}dpi.jpg`;
    a.href = URL.createObjectURL(file); a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <main>
      <nav>
        <a className="brand" href="#top"><span className="brand-mark">照</span><span>正好照</span></a>
        <div className="nav-links"><a href="#standards">规格标准</a><a href="#guide">拍摄指南</a><span className="privacy">图片仅在本机处理</span></div>
      </nav>
      <section className="hero" id="top">
        <div className="eyebrow"><span>✦</span> 免费 · 无需注册 · 不上传服务器</div>
        <h1>一张普通照片，<br /><em>裁成合规证件照。</em></h1>
        <p>国内常用规格齐全，像素精准。上传、调整、下载，三步完成。</p>
        <button className="primary" onClick={() => inputRef.current?.click()}>上传照片开始 <span>↗</span></button>
        <div className="hint">支持 JPG、PNG、WEBP · 建议使用正面半身照</div>
      </section>
      <section className="workspace" aria-label="证件照制作区">
        <div className="step-label"><b>01</b><span>选择规格</span></div>
        <div className="preset-grid" id="standards">
          {presets.map((p, i) => <button key={p.name} className={`preset ${selected === i ? "active" : ""}`} onClick={() => setSelected(i)}>
            <span className="preset-top"><strong>{p.name}</strong>{p.tag && <small>{p.tag}</small>}</span>
            <span>{p.size}</span><span>{p.px}</span>
          </button>)}
          <button className={`preset custom-preset ${isCustom ? "active" : ""}`} onClick={() => setSelected(presets.length)}>
            <span className="preset-top"><strong>自定义</strong><small>自由</small></span><span>像素 / mm / cm</span><span>自定宽度与高度</span>
          </button>
        </div>
        <div className="divider" />
        <div className="step-label"><b>02</b><span>上传与裁剪</span></div>
        <div className="editor-grid">
          <div className={`upload ${image ? "has-image" : ""}`} onDragOver={(e: DragEvent) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); readFile(e.dataTransfer.files[0]); }}>
            {!image ? <button className="upload-inner" onClick={() => inputRef.current?.click()}>
              <span className="upload-icon">＋</span><strong>拖拽照片到这里</strong><span>或点击选择文件</span><small>照片不会离开你的设备</small>
            </button> : <>
              <div className="crop-frame" style={{ aspectRatio: `${outputWidth}/${outputHeight}` }} onPointerDown={(e) => { setDragging(true); dragStart.current = { x:e.clientX,y:e.clientY,ox:offset.x,oy:offset.y }; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={(e) => dragging && setOffset({ x: dragStart.current.ox + e.clientX-dragStart.current.x, y: dragStart.current.oy + e.clientY-dragStart.current.y })} onPointerUp={() => setDragging(false)}>
                <canvas ref={canvasRef} /><div className="guide-line eye"/><div className="guide-line face"/>
              </div><span className="drag-tip">拖动照片调整位置</span>
            </>}
            <input ref={inputRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(e: ChangeEvent<HTMLInputElement>) => readFile(e.target.files?.[0])}/>
          </div>
          <aside className="controls">
            <div><label>当前规格</label><div className="current"><strong>{currentName}</strong><span>{currentSize}</span><b>{outputPx}</b></div></div>
            {isCustom && <div className="custom-size-panel">
              <div className="custom-size-head"><label>自定义尺寸</label><div className="unit-switch">{(["px","mm","cm"] as const).map(unit => <button key={unit} className={customUnit === unit ? "active" : ""} onClick={() => setCustomUnit(unit)}>{unit}</button>)}</div></div>
              <div className="size-inputs"><label><span>宽度</span><input type="number" min="1" max="10000" step={customUnit === "cm" ? ".1" : "1"} value={customWidth} onChange={e => setCustomWidth(Math.max(1, Number(e.target.value)))} /></label><b>×</b><label><span>高度</span><input type="number" min="1" max="10000" step={customUnit === "cm" ? ".1" : "1"} value={customHeight} onChange={e => setCustomHeight(Math.max(1, Number(e.target.value)))} /></label></div>
            </div>}
            <div className="control-block"><label>输出 DPI</label><div className="dpi-options" role="group" aria-label="输出 DPI">
              {[72, 96, 150, 300, 350, 600].map(value => <button key={value} className={dpi === value ? "active" : ""} onClick={() => setDpi(value)} aria-pressed={dpi === value}>{value}</button>)}
            </div><label className="custom-dpi"><span>自定义 DPI</span><div><input type="number" min="1" max="1200" step="1" value={dpi} onChange={e => setDpi(Math.min(1200, Math.max(1, Number(e.target.value) || 1)))} /><b>DPI</b></div></label><p className="dpi-help">{dpi === 300 ? "推荐：适合冲印及多数报名系统" : `将按 ${dpi} DPI 等比例计算导出像素`}</p></div>
            <div className="parameter-panel">
              <div className="parameter-head"><label>图片参数</label><span>实时</span></div>
              {sourceMeta ? <>
                <div className="parameter-title">原始图片</div>
                <dl>
                  <div><dt>分辨率</dt><dd>{sourceMeta.width} × {sourceMeta.height} px</dd></div>
                  <div><dt>原始 DPI</dt><dd>{sourceMeta.dpi ? `${sourceMeta.dpi} DPI` : "未写入"}</dd></div>
                  <div><dt>文件大小</dt><dd>{sourceMeta.bytes >= 1048576 ? `${(sourceMeta.bytes/1048576).toFixed(2)} MB` : `${Math.round(sourceMeta.bytes/1024)} KB`}</dd></div>
                  <div><dt>宽高比</dt><dd>{(sourceMeta.width/sourceMeta.height).toFixed(3)} : 1</dd></div>
                  {sourceMeta.dpi && <div><dt>推算尺寸</dt><dd>{(sourceMeta.width/sourceMeta.dpi*2.54).toFixed(2)} × {(sourceMeta.height/sourceMeta.dpi*2.54).toFixed(2)} cm</dd></div>}
                </dl>
              </> : <p className="empty-parameters">上传照片后可查看原图参数</p>}
              <div className="parameter-title output-title">导出图片</div>
              <dl>
                <div><dt>分辨率</dt><dd>{outputPx}</dd></div>
                <div><dt>DPI</dt><dd>{dpi} DPI</dd></div>
                <div><dt>尺寸</dt><dd>{widthCm.toFixed(2)} × {heightCm.toFixed(2)} cm</dd></div>
              </dl>
            </div>
            <div className="control-block"><label htmlFor="zoom">缩放</label><div className="range-row"><button onClick={() => setZoom(Math.max(1, zoom-.05))}>−</button><input id="zoom" type="range" min="1" max="3" step=".01" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/><button onClick={() => setZoom(Math.min(3, zoom+.05))}>＋</button></div></div>
            <div className="tips"><strong>裁剪提示</strong><p>双眼保持水平，头顶留出少量空间，下巴位于虚线附近。</p></div>
            {image && <div className="file-row"><span>✓</span><p><strong>{fileName}</strong><small>已在本机载入</small></p><button onClick={()=>{setImage(null);setSourceMeta(null);if(inputRef.current) inputRef.current.value=""}}>更换</button></div>}
            <button className="download" disabled={!image} onClick={download}>生成并下载 <span>↓</span></button>
            <p className="download-note">输出 JPG · {outputPx} · {dpi} DPI</p>
          </aside>
        </div>
      </section>
      <section className="guide" id="guide">
        <div><span>01</span><h3>光线均匀</h3><p>面向窗户或柔和光源，避免脸部明显阴影。</p></div>
        <div><span>02</span><h3>正面平视</h3><p>坐直、双肩放松，镜头与双眼保持同一高度。</p></div>
        <div><span>03</span><h3>背景简洁</h3><p>选择白色或纯色墙面，避免头发与背景混在一起。</p></div>
      </section>
      <footer><span>正好照 · 简单、准确、保护隐私</span><span>所有图像处理均在浏览器本地完成</span></footer>
    </main>
  );
}
