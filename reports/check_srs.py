from pathlib import Path
import fitz
from PIL import Image, ImageDraw

root=Path(__file__).resolve().parent
pdf=fitz.open(root/'MarketLab_SRS.pdf')
sheet=Image.new('RGB',(1000,1500),'#dddddd')
draw=ImageDraw.Draw(sheet)
for i,page in enumerate(pdf):
    text=page.get_text()
    print(i+1,len(text),text.splitlines()[1:4])
    pix=page.get_pixmap(matrix=fitz.Matrix(.38,.38))
    im=Image.frombytes('RGB',[pix.width,pix.height],pix.samples)
    im.thumbnail((235,275))
    x=(i%4)*250
    y=(i//4)*300
    sheet.paste(im,(x,y))
    draw.text((x+4,y+280),str(i+1),fill='black')
sheet.save(root/'srs_assets'/'layout_check.png')
text='\n'.join(page.get_text() for page in pdf)
assert '\u2014' not in text and '\u2013' not in text
assert '2400320100149' in text and 'Mr. Faizan' in text
assert all(len(page.get_text().strip())>80 for page in pdf)
print('Text and page checks passed.')
