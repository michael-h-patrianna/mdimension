command to create low quality ktx2:

convert first:
magick input.png \
  -alpha off \
  -colorspace RGB \
  -depth 8 \
  input_rgb.png

basisu \
  -ktx2 \
  -etc1s \
  -q 255 \
  -max_endpoints 4096 \
  -max_selectors 4096 \
  -comp_level 5 \
  -mipmap \
  -linear \
  input.png

command to create high quality ktx2:
basisu \
  -ktx2 \
  -etc1s \
  -q 255 \
  -max_endpoints 16128 \
  -max_selectors 16128 \
  -comp_level 5 \
  -mipmap \
  -linear \
  input.png
