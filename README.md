# Passport Photo Maker — Free Offline Tool

Form ki photo ka poora kaam ek jagah — pure HTML/CSS/Vanilla JS, no framework, no dependency, no build step. **Photo 100% aapke browser me process hoti hai — kabhi upload nahi hoti.**

## Features

- 📂 **4 tareeke photo lene ke** — file picker, camera (capture), drag-drop, clipboard paste (Ctrl/⌘+V)
- ✂️ **Smart crop editor** — passport 3.5×4.5 / square / original guidance, zoom (slider • scroll • pinch), drag to reposition, rotate, reset
- 🎯 **Form presets** — one tap me SSC GD, SSC CGL, Railway RRB, UPSC, Bank IBPS, Signature, Best Quality
- 🗜️ **Target KB compressor** — 20/30/50/100/200 chips ya 5–500KB slider ya "No limit"; quality + size dono adjust karke target hit karta hai
- 🎨 **Background change** — White / Blue / Gray (corner-sampling chroma key; plain background walii photo par best) — ya "Original"
- ☀️ **Fine-tune** — brightness & contrast sliders, per-photo jitter/eksposure theek karne ke liye
- ✒️ **Signature / Scan mode** — bina crop, sidha compress; "White karo" se scan jaisa clean white background (form ki signature ke liye)
- 🖨️ **Print sheet** — 4×6 inch ya A4, 4 / 6 / 8 / 12 copies, precise borders (photo studio se print karwao)
- 🕘 **History** — recent 8 photos localStorage me save; app band karke kholne par bhi rehti hain, one-tap re-download
- 📤 **Direct share** — Web Share API se WhatsApp/email me seedha bhej do (support na ho to download fallback)
- 🌙 **Dark / Light theme** — toggle button, choice yaad rehti hai
- 📱 **Full PWA** — install ho jata hai, service worker offline cache karta hai (network ke bina chalta hei)
- 🔒 **Zero upload** — sab processing client-side Canvas API se; SW bhi blob/data URLs ko cache ya network nahi karta

## Run kaise karein

`service worker / manifest` ke liye HTTP server zaroori hai (`file://` par plain HTML bhi chalega, bas PWA features miss honge):

```bash
cd ~/projects/passport-photo-tool
python -m http.server 8124
# browser me kholen: http://localhost:8124
```

## Files

| File | Kya hai |
| --- | --- |
| `index.html` | Structure — 3 views (upload / editor / result) |
| `style.css` | Theme (dark+light), layout, responsive grid |
| `app.js` | Saara logic — crop math, pinch/zoom, chroma-key bg, KB compression loop, sheets, history |
| `sw.js` + `manifest.json` | PWA (offline + install prompt) |
| `icon.svg`, `icon-192.png`, `icon-512.png` | App icons (maskable safe zone ke saath) |

## Notes

- Live: http://localhost:8124 (GH Pages / Vercel link yahan add hoga)
- HEIC iPhone photos browser decode nahi kar sakta — pehle JPG me convert karein
- Compress loop = quality step-down → dimension shrink → repeat; isliye 20KB bila cram sa milta hai
- GitHub: https://github.com/mapshivam162-blip/passport-photo-tool
