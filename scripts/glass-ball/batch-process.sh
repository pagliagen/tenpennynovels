#!/bin/bash

# Script per processare tutte le immagini location con effetto palla di vetro
# Usage: ./batch-process.sh input_dir output_dir

INPUT_DIR="${1:-./input}"
OUTPUT_DIR="${2:-./output}"

# Parametri effetto
BARREL_DISTORTION="0.65"
OUTPUT_SIZE="300"

echo "🔮 Batch Glass Ball Effect Processor"
echo ""
echo "Input directory: $INPUT_DIR"
echo "Output directory: $OUTPUT_DIR"
echo "Barrel distortion: $BARREL_DISTORTION"
echo "Output size: ${OUTPUT_SIZE}px"
echo ""

# Crea output directory se non esiste
mkdir -p "$OUTPUT_DIR"

# Conta file da processare
TOTAL=$(find "$INPUT_DIR" -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" \) | wc -l | tr -d ' ')

if [ "$TOTAL" -eq 0 ]; then
  echo "❌ Nessuna immagine trovata in $INPUT_DIR"
  exit 1
fi

echo "📁 Trovate $TOTAL immagini da processare"
echo ""

COUNTER=0

# Processa ogni immagine
for INPUT_FILE in "$INPUT_DIR"/*.{jpg,jpeg,png,JPG,JPEG,PNG}; do
  # Salta se il glob non trova file
  [ -f "$INPUT_FILE" ] || continue

  COUNTER=$((COUNTER + 1))
  BASENAME=$(basename "$INPUT_FILE")
  FILENAME="${BASENAME%.*}"
  OUTPUT_FILE="$OUTPUT_DIR/${FILENAME}-glass.png"

  echo "[$COUNTER/$TOTAL] Processing: $BASENAME"

  magick "$INPUT_FILE" \
    -resize 700x700^ \
    -gravity center \
    -extent 700x700 \
    -distort barrel "$BARREL_DISTORTION 0.0 0.0 1.0" \
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
    -resize "$OUTPUT_SIZE"x"$OUTPUT_SIZE" \
    "$OUTPUT_FILE" 2>&1 | grep -v "^$"

  if [ $? -eq 0 ]; then
    echo "   ✅ $OUTPUT_FILE"
  else
    echo "   ❌ Errore processando $BASENAME"
  fi
  echo ""
done

echo "🎉 Processazione completata!"
echo "📁 Output: $OUTPUT_DIR"
