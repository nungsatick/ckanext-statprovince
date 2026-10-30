/* หน้าแรก Provincial STAT Catalog — พอร์ตจาก home/js/home-auto.js เดิม
   - ตัวเลขสถิติวิ่งขึ้น
   - กริดองค์กร (หน้าละ 8, เลื่อนอัตโนมัติทุก 4 วินาที, หยุดเมื่อชี้เมาส์)
   - ชุดข้อมูลปรับปรุงล่าสุด / ยอดนิยม */
(function () {
  'use strict';

  var API = '/api/3/action/';
  var nf = new Intl.NumberFormat('th-TH');
  var MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

  function fetchJSON(url) {
    return fetch(url, { credentials: 'same-origin' }).then(function (r) { return r.json(); });
  }

  function fmtDate(s) {
    var d = new Date(s);
    if (!s || isNaN(d)) return '-';
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + (d.getFullYear() + 543);
  }

  // สร้าง element โดยใส่ข้อความด้วย textContent (กัน HTML ในชื่อชุดข้อมูล)
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }

  /* ---------- ตัวเลขสถิติวิ่งขึ้น ---------- */
  function runCounters() {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelectorAll('.stats-up span').forEach(function (counter) {
      var target = parseFloat(counter.textContent.replace(/,/g, ''));
      if (isNaN(target) || target === 0 || reduce) return;
      var duration = 3000, startTime = performance.now();
      function tick(now) {
        var p = Math.min((now - startTime) / duration, 1);
        var ease = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
        counter.textContent = Math.floor(ease * target).toLocaleString();
        if (p < 1) requestAnimationFrame(tick);
        else counter.textContent = target.toLocaleString();
      }
      requestAnimationFrame(tick);
    });
  }

  /* ---------- องค์กร ---------- */
  function initOrgs() {
    var grid = document.getElementById('org-grid-js');
    var pager = document.getElementById('org-pager');
    if (!grid) return;

    var perPage = 8, orgData = [], totalPages = 1, currentPage = 1, timer;

    function buildCard(o) {
      var logo = o.image_display_url || o.image_url || '/base/images/placeholder-organization.png';
      return el('a', { class: 'org-card text-reset', href: '/organization/' + encodeURIComponent(o.name) }, [
        el('span', { class: 'org-count-badge' }, [nf.format(o.package_count || 0) + ' ชุดข้อมูล']),
        el('img', { class: 'org-logo', src: logo, alt: o.title || o.name, loading: 'lazy' }),
        el('div', { class: 'org-name' }, [o.title || o.name])
      ]);
    }

    function buildPager() {
      pager.innerHTML = '';
      for (var i = 1; i <= totalPages; i++) {
        var b = el('button', { class: 'page-dot' + (i === currentPage ? ' active' : ''), type: 'button',
                               'aria-label': 'หน้า ' + i }, [String(i)]);
        b.addEventListener('click', renderPage.bind(null, i));
        pager.appendChild(b);
      }
    }

    function renderPage(p) {
      currentPage = p;
      grid.classList.add('fade-out');
      setTimeout(function () {
        grid.innerHTML = '';
        orgData.slice((p - 1) * perPage, p * perPage).forEach(function (o) {
          grid.appendChild(el('div', { class: 'col' }, [buildCard(o)]));
        });
        buildPager();
        setTimeout(function () { grid.classList.remove('fade-out'); }, 100);
      }, 300);
    }

    function start() {
      stop();
      if (totalPages > 1) timer = setInterval(function () {
        renderPage(currentPage >= totalPages ? 1 : currentPage + 1);
      }, 4000);
    }
    function stop() { clearInterval(timer); }

    fetchJSON((grid.getAttribute('data-api') || API + 'organization_list') +
              '?all_fields=true&include_dataset_count=true&limit=1000')
      .then(function (j) {
        orgData = ((j && j.result) || []).sort(function (a, b) {
          return (b.package_count || 0) - (a.package_count || 0);
        });
        totalPages = Math.max(1, Math.ceil(orgData.length / perPage));
        renderPage(1);
        start();
      })
      .catch(function () {
        grid.innerHTML = '';
        grid.appendChild(el('div', { class: 'muted' }, ['ไม่สามารถโหลดข้อมูลองค์กรได้']));
      });

    grid.addEventListener('mouseenter', stop);
    grid.addEventListener('mouseleave', start);
  }

  /* ---------- ชุดข้อมูลล่าสุด / ยอดนิยม ---------- */
  function statItem(p, icon, metas) {
    return el('li', { class: 'stat-item' }, [
      el('div', { class: 'stat-icon' }, [el('i', { class: 'bi ' + icon })]),
      el('div', {}, [
        el('p', { class: 'stat-title mb-1' }, [
          el('a', { href: '/dataset/' + encodeURIComponent(p.name), class: 'text-reset text-decoration-none' }, [p.title || p.name])
        ]),
        el('div', { class: 'stat-meta' }, metas.map(function (m) {
          return el('span', {}, [el('i', { class: 'bi ' + m[0] }), m[1]]);
        }))
      ])
    ]);
  }

  function fillList(id, items) {
    var ul = document.getElementById(id);
    if (!ul) return;
    ul.innerHTML = '';
    items.forEach(function (li) { ul.appendChild(li); });
    if (!items.length) ul.appendChild(el('li', { class: 'stat-item muted' }, ['ไม่มีข้อมูล']));
  }

  function initDatasets() {
    fetchJSON(API + 'package_search?q=&sort=metadata_modified+desc&rows=5')
      .then(function (j) {
        fillList('latest-datasets', ((j && j.result && j.result.results) || []).map(function (p) {
          return statItem(p, 'bi-table', [['bi-calendar3', 'อัปเดต ' + fmtDate(p.metadata_modified)]]);
        }));
      })
      .catch(function () {});

    // ยอดนิยม: เรียงตามยอดเข้าชมรวม (dataset_tracking.total)
    fetchJSON(API + 'package_search?q=&sort=views_total+desc,metadata_modified+desc&rows=5')
      .then(function (j) {
        var arr = ((j && j.result && j.result.results) || []).slice();
        function views(p) { return (p.dataset_tracking && p.dataset_tracking.total) || 0; }
        arr.sort(function (a, b) { return views(b) - views(a); });
        fillList('popular-datasets', arr.slice(0, 5).map(function (p) {
          return statItem(p, 'bi-eye', [
            ['bi-graph-up', 'เข้าชม ' + nf.format(views(p)) + ' ครั้ง'],
            ['bi-calendar3', 'อัปเดต ' + fmtDate(p.metadata_modified)]
          ]);
        }));
      })
      .catch(function () {});
  }

  function boot() {
    runCounters();
    initOrgs();
    initDatasets();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
