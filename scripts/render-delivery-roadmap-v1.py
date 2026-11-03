"""Render the versioned delivery plan; requires Pillow and a Japanese font."""
import argparse,json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ap=argparse.ArgumentParser(); ap.add_argument('--font',required=True); ap.add_argument('--output',required=True); ap.add_argument('--roadmap',default=str(Path(__file__).resolve().parents[1]/'docs/delivery-roadmap-v1.json')); a=ap.parse_args()
p=json.loads(Path(a.roadmap).read_text()); W,H=1440,2740
im=Image.new('RGB',(W,H),'#0B1324'); d=ImageDraw.Draw(im)
def f(n): return ImageFont.truetype(a.font,n)
def text(x,y,t,n=30,c='#EAF0FA'):
 assert d.textbbox((x,y),t,font=f(n))[2] <= W-55, (t,n)
 d.text((x,y),t,font=f(n),fill=c)
def box(rect,fill,outline=None,r=22): d.rounded_rectangle(rect,r,fill,outline=outline,width=2)
text(70,50,'BOAT COMMAND',40,'#64D9D2')
box((1155,48,1370,102),'#1D3044'); text(1191,57,'v'+p['version'],32)
text(70,121,'完成までのロードマップ',66)
text(73,220,'経験者1名への引き渡し ｜ '+p['createdDateJst']+' JST',29,'#A5B5CE')
box((70,286,1370,408),'#243442',outline='#44616C')
text(98,303,'現在地：'+p['current'],36,'#FFD58A')
text(98,361,'取得修正は反映済み。全場の運用確認・予測改善は未達。',29,'#D6E1EE')
colors={'amber':'#FFD58A','blue':'#7EC9FF','slate':'#AAB9CD'}
y=458
for i,s in enumerate(p['stages']):
 if i: d.line((111,y-25,111,y-4),fill='#3B536E',width=4)
 box((70,y,1370,y+276),'#142239',outline='#2C405B')
 col=colors[s['color']]
 box((90,y+22,159,y+89),'#243A50',r=15); text(101,y+30,s['id'],37,col)
 text(182,y+26,s['title'],40)
 text(183,y+85,s['status'],27,col)
 text(108,y+133,s['lines'][0],31)
 text(108,y+180,s['lines'][1],31,'#C5D2E4')
 d.line((108,y+228,1330,y+228),fill='#2C405B',width=2)
 text(108,y+239,s['gate'],26,'#83DBD2')
 y+=308
box((70,2335,1370,2474),'#182C3C')
text(98,2353,'並行作業：④の画面整理は①〜③と並行可能',30,'#B4DDF6')
text(98,2402,'追加候補：税金関連ページは要望が確定した場合に追加',29,'#B8C7D8')
text(73,2514,'進捗確認 → 項目IDと証拠を照合 → 変更時は画像を更新',31)
text(73,2570,'日程は実運用・独立検証・受入結果で判断します。',29,'#A5B5CE')
text(73,2620,'安定運用と予測改善は別判定。収益を保証する計画ではありません。',26,'#A5B5CE')
Path(a.output).parent.mkdir(parents=True,exist_ok=True); im.save(a.output)
print(json.dumps({'path':a.output,'size':[W,H],'version':p['version']}))
