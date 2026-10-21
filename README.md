# ckanext-statprovince

ส่วนปรับแต่งของ **Provincial STAT Catalog** ([statprovince.gdcatalog.go.th](https://statprovince.gdcatalog.go.th))
สำหรับ CKAN-OpenD (CKAN 2.10 + ckanext-thai_gdc) ย้ายจากการแก้ไฟล์ของ CKAN/thai_gdc โดยตรงมาเป็น extension

## ย้ายอะไรมาแล้วบ้าง

| ของเดิม (แก้ตรงบนเซิร์ฟเวอร์) | ใน extension นี้ |
|---|---|
| template หน้าแรก (layout1) | `templates/home/layout1.html` |
| `public/home/css/layout1.css` | `assets/css/home.css` (webassets) |
| `public/home/js/home-auto.js` | `assets/js/home.js` (webassets) |
| `public/base/images/logo_PSC*.png`, `background_PSC.png` | `public/statprovince/images/` |
| `public/base/html/nw_graph_wlink.html` (สร้างไฟล์ static ทุกวัน) | กราฟแบบ live: action `statprovince_tag_org_graph` + cache ใน Redis + หน้า `/graph` |

> เพิ่ม header, footer และหน้ากลุ่มแบบลำดับชั้นแล้ว โดยแก้ผ่าน extension ทั้งหมด

## กราฟความสัมพันธ์ Tags x หน่วยงาน

- **API:** `GET /api/3/action/statprovince_tag_org_graph`
  ส่ง `nodes` / `edges` / `generated_at` กลับมา ใช้ Top 100 tags และนับเฉพาะชุดข้อมูลสาธารณะ
- **Cache:** เก็บใน Redis ของ CKAN อายุตาม `ckanext.statprovince.graph.cache_ttl` (วินาที ค่าเริ่มต้น 3600)
  ถ้า Redis ใช้ไม่ได้ ระบบจะคำนวณใหม่ทุกครั้งแทนการ error
- **บังคับคำนวณใหม่:** `?refresh=true` (sysadmin เท่านั้น) หรือใช้คำสั่ง CLI

  ```bash
  ckan -c /etc/ckan/default/ckan.ini statprovince graph-refresh   # คำนวณใหม่ + เก็บ cache
  ckan -c /etc/ckan/default/ckan.ini statprovince graph-clear     # ลบ cache
  ```

- **ใช้ในหน้าอื่น:**
  `{% snippet 'statprovince/snippets/tag_org_graph.html', height='600px', full_link=true %}`
- **หน้าเต็มจอ:** `/graph` (แทน `/base/html/nw_graph_wlink.html`)

## การตั้งค่า

```ini
ckan.plugins = statprovince thai_gdc ...                 # ต้องอยู่ก่อน thai_gdc

ckanext.statprovince.graph.cache_ttl = 3600              # อายุ cache ของกราฟ (วินาที)
ckanext.statprovince.vis_network_url = /statprovince/vendor/vis-network.min.js   # ถ้าเซิร์ฟเวอร์ออกเน็ตไม่ได้
```

ค่าเริ่มต้นของ `vis_network_url` คือ vis-network 9.1.9 จาก unpkg.com

## การติดตั้ง

ติดตั้งได้ 3 แบบ เหมือน [ckanext-uitheme](https://github.com/nungsatick/ckanext-uitheme#การติดตั้ง)

```bash
# แบบ source (ตามคู่มือ CKAN-OpenD)
source /usr/lib/ckan/default/bin/activate
cd /usr/lib/ckan/default/src
git clone <repo-url> ckanext-statprovince
pip install -e ckanext-statprovince
sudo supervisorctl restart ckan-uwsgi:*
```

**หลังติดตั้งบนเซิร์ฟเวอร์จริง** ให้ลบไฟล์เดิมที่เคยแก้ตรงออก เพื่อไม่ให้มีของซ้ำกัน

- `public/home/`
- `public/base/html/nw_graph_wlink.html`
- cron/script ที่ใช้สร้างไฟล์กราฟ

จากนั้นคืน template ของ thai_gdc ให้เป็นของเดิม

## ความต้องการ

- CKAN 2.10, ckanext-thai_gdc
- ckanext-hierarchy (ไม่บังคับ): ใช้นับ "จำนวนกลุ่มย่อย" และรวมชุดข้อมูลของกลุ่มย่อยในการ์ดกลุ่ม
- Redis (มากับ CKAN อยู่แล้ว)

## License

[AGPL-3.0](LICENSE)

## ส่วนที่ปรับเพิ่ม

- Header พื้นน้ำเงินเข้ม รองรับจอแคบ และแสดงสีพื้นเฉพาะเมนูที่เลือก
- Footer พร้อมโลโก้ ข้อมูลติดต่อ นโยบาย ตัวเลือกภาษา และตัวนับผู้เข้าชม
- หน้ากลุ่มแสดงกลุ่มแม่และกลุ่มย่อยผ่าน `ckanext-hierarchy`
- ซ่อนป้ายจังหวัดในรายการชุดข้อมูลและแท็ก โดยไม่ลบ metadata
- กราฟเลือกได้ 5 แบบ: Focus, Cluster, Bipartite, Chord และ Heatmap
- ค่าเริ่มต้นเป็น Focus แบบ force-directed และ Top Tags 80 ลากโหนดแล้วเครือข่ายขยับตามกันได้
- รายการล่าสุดเรียงตาม `metadata_modified` ส่วนยอดนิยมเรียง `views_total` จากทั้งแค็ตตาล็อก

ข้อมูลติดต่อใน footer ปรับได้ด้วย `ckanext.statprovince.footer.address`, `ckanext.statprovince.footer.phone` และ `ckanext.statprovince.footer.email`

กราฟและหน้ากลุ่มใช้ `ckanext-hierarchy` ส่วน footer ใช้ helper ของ `thai_gdc` จึงต้องเปิด plugin เหล่านี้ร่วมกัน และวาง `statprovince` ก่อน `thai_gdc`

## ยอดเข้าชม

เปิด tracking และตั้งงานประมวลผลตามรอบที่ต้องการ เช่น ทุก 5 นาที

```ini
ckan.tracking_enabled = true
```

```bash
ckan -c /srv/app/conf/ckan.ini tracking update
```

ถ้าใช้ CKAN-OpenD Docker ชุดเดียวกับ workspace นี้ ให้ตั้ง `CKAN__TRACKING_ENABLED=true` ใน `.env` ส่วน path ของ config ให้ปรับตาม image ที่ใช้

## รูปภาพและข้อมูลทดสอบ

รูปโลโก้และรูปหมวดข้อมูลนำมาจาก statprovince.gdcatalog.go.th, gdcatalog.go.th และ nso.go.th เพื่อแสดงหน่วยงานและบริการต้นทาง ไฟล์ใน `public/statprovince/images/catalog/` เป็นรูปที่เก็บไว้สำหรับเว็บทดสอบ ส่วนภาพสัญลักษณ์กลางใช้กับรายการที่ต้นทางไม่มีรูป

การติดตั้ง extension ไม่ได้นำเข้าชุดข้อมูล องค์กร หรือกลุ่มให้อัตโนมัติ ข้อมูลเหล่านี้อยู่ในฐานข้อมูล CKAN แยกจาก repository นี้ URL รูปใน metadata ต้องตั้งให้ตรงกับโดเมนปลายทางเมื่อนำข้อมูลไปติดตั้งบนเครื่องอื่น
