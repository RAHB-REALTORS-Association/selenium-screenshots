"""Read an RGB pixel from Chromium's PNG output using the standard library."""
def png_rgb(data, pixel_x=10, pixel_y=10):
    import zlib
    chunks = bytearray()
    pos = 8
    while pos < len(data):
        length = int.from_bytes(data[pos:pos+4], 'big')
        kind = data[pos+4:pos+8]
        if kind == b'IDAT': chunks.extend(data[pos+8:pos+8+length])
        pos += length + 12
    width = int.from_bytes(data[16:20], 'big')
    assert data[24] == 8 and data[25] in (2, 6)
    channels = 3 if data[25] == 2 else 4
    stride = width * channels
    raw = zlib.decompress(chunks)
    previous = bytearray(stride)
    for y in range(pixel_y + 1):
        offset = y * (stride + 1)
        mode = raw[offset]
        row = bytearray(raw[offset+1:offset+1+stride])
        for x in range(stride):
            a = row[x-channels] if x >= channels else 0
            b = previous[x]
            c = previous[x-channels] if x >= channels else 0
            p = a + b - c
            pa, pb, pc = abs(p-a), abs(p-b), abs(p-c)
            paeth = a if pa <= pb and pa <= pc else b if pb <= pc else c
            predictor = (0, a, b, (a+b)//2, paeth)[mode]
            row[x] = (row[x] + predictor) & 255
        previous = row
    return tuple(row[pixel_x*channels:pixel_x*channels+3])
