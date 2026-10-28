# Media regression fixture

`green-hevc.mp4` is a generated one-second 320×180 solid-green HEVC Main clip, tagged hvc1. It contains no third-party media. It verifies actual decoded video pixels rather than merely checking that the page or image loaded.

Generation:

```
ffmpeg -f lavfi -i 'color=c=0x137333:size=320x180:rate=10:duration=1' \
  -c:v libx265 -x265-params 'pools=1:log-level=error' -tag:v hvc1 \
  -pix_fmt yuv420p -movflags +faststart green-hevc.mp4
```
