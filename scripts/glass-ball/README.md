# Glass Ball Effect - Production Ready

Script per applicare effetto "palla di vetro" realistico a immagini usando **ImageMagick**.

## Requisiti

```bash
brew install imagemagick
```

## Uso Singolo File

Test su singola immagine:

```bash
magick input/your-image.jpg \
  -resize 700x700^ \
  -gravity center \
  -extent 700x700 \
  -distort barrel "0.65 0.0 0.0 1.0" \
  -gravity center \
  -crop 400x400+0+0 +repage \
  -alpha set \
  \( +clone -channel A -evaluate set 0 +channel -fill white -draw "circle 200,200 200,0" -blur 0x4 \) \
  -compose dst-in -composite \
  -colorize 8,6,0 \
  -modulate 100,120,108 \
  \( -size 400x400 xc:none -fill "radial-gradient:rgba(255,255,255,0.35)-rgba(255,255,255,0)" -draw "ellipse 135,95 75,55 0,360" -blur 0x18 \) \
  -compose over -composite \
  \( -size 400x400 xc:none -fill none -stroke "rgba(220,160,60,0.5)" -strokewidth 16 -draw "circle 200,200 200,12" -blur 0x6 \) \
  -compose over -composite \
  \( -size 400x400 xc:none -fill none -stroke "rgba(255,200,100,0.3)" -strokewidth 8 -draw "circle 200,200 200,8" -blur 0x4 \) \
  -compose over -composite \
  -resize 300x300 \
  output/result.png
```

## Batch Processing (Tutte le Location)

```bash
./batch-process.sh [input_dir] [output_dir]
```

Esempio:

```bash
# Processa tutte le immagini in input/ → output/
./batch-process.sh

# Oppure specifica directory custom
./batch-process.sh /path/to/locations /path/to/output
```

## Effetti Applicati

1. ✅ **Distorsione barrel** (0.65) - curvatura realistica palla di vetro
2. ✅ **Maschera circolare** con bordi sfumati
3. ✅ **Tonalità ambrata/seppia** (8% colorize + 120% saturazione)
4. ✅ **Riflesso vetro** (highlight radiale in alto a sinistra)
5. ✅ **Bordo ambrato trasparente** (doppio layer con blur)

## Parametri Personalizzabili

Nel file `batch-process.sh`:

```bash
BARREL_DISTORTION="0.65"  # Intensità curvatura (0.0-1.0)
OUTPUT_SIZE="300"         # Dimensione finale in px
```

Per modificare tonalità/colori, edita:
- `-colorize 8,6,0` (R,G,B offset)
- `-modulate 100,120,108` (Brightness, Saturation, Hue)
- `rgba(220,160,60,0.5)` (colore bordo interno)
- `rgba(255,200,100,0.3)` (colore bordo esterno)

## Performance

- **Tempo medio**: ~2-3 secondi per immagine
- **Dimensione output**: ~150-200KB (PNG ottimizzato)
- **Batch di 50 location**: ~2 minuti totali
