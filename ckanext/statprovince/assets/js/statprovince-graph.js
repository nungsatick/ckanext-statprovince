/* Five views over the same public Tags × Organizations graph. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var BLUE = '#2378bc', TEAL = '#169c97', GOLD = '#dca91d';
  function svg(tag, attrs, text) {
    var el = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function weight(e) { return Number(e.value) || 1; }
  function init(root) {
    var canvas = root.querySelector('[data-sp-canvas]');
    var loading = root.querySelector('.sp-graph-loading');
    var slider = root.querySelector('[data-sp-slider]');
    var view = root.querySelector('[data-sp-view]');
    var detail = root.querySelector('[data-sp-detail]');
    var allNodes = [], allEdges = [], activeNodes = [], activeEdges = [];
    var network = null, dataNodes = null, selected = null, regions = [];
    function link(node) {
      var tpl = root.getAttribute(node.group === 'Organization' ? 'data-org-url' : 'data-tag-url');
      return tpl.replace('__ID__', encodeURIComponent(node.slug));
    }
    function clearDetail() { detail.replaceChildren(); detail.hidden = true; selected = null; }
    function showDetail(node, tag, count) {
      detail.replaceChildren(); detail.hidden = false;
      var title = document.createElement('strong'); title.textContent = node.label;
      detail.appendChild(title);
      if (tag) {
        var p = document.createElement('p'); p.textContent = tag.label + ' · ' + count + ' ชุดข้อมูล'; detail.appendChild(p);
      } else {
        var total = activeEdges.filter(function (e) { return e.from === node.id || e.to === node.id; }).length;
        var p2 = document.createElement('p'); p2.textContent = 'เชื่อมโยง ' + total + ' รายการในมุมมองนี้'; detail.appendChild(p2);
      }
      var a = document.createElement('a');
      a.textContent = tag ? 'ดูชุดข้อมูลที่เกี่ยวข้อง ↗' : 'ดูรายละเอียด ↗';
      a.href = tag ? root.getAttribute('data-tag-url').replace('__ID__', encodeURIComponent(tag.slug)) + '&organization=' + encodeURIComponent(node.slug) : link(node);
      a.target = '_blank'; a.rel = 'noopener'; detail.appendChild(a);
      var close = document.createElement('button'); close.type = 'button'; close.textContent = 'ปิด';
      close.addEventListener('click', function () { clearDetail(); if (view.value === 'focus') render(); });
      detail.appendChild(close);
    }
    function partitions() {
      return [activeNodes.filter(function (n) { return n.group === 'Organization'; }), activeNodes.filter(function (n) { return n.group === 'Tag'; })];
    }
    function makeSvg(width, height) {
      var drawing = svg('svg', {viewBox: '0 0 ' + width + ' ' + height, role: 'img', 'aria-label': view.options[view.selectedIndex].text});
      drawing.style.minWidth = width + 'px'; drawing.style.width = '100%';
      canvas.appendChild(drawing); return drawing;
    }
    function selectable(element, label, callback) {
      element.setAttribute('tabindex', '0'); element.setAttribute('role', 'button'); element.setAttribute('aria-label', label);
      element.style.cursor = 'pointer'; element.addEventListener('click', callback);
      element.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); callback(); } });
    }
    function bipartite() {
      var parts=partitions(), height=Math.max(parts[0].length,parts[1].length)*46+80;
      var drawing=makeSvg(1100,height), pos=new Map();
      parts.forEach(function(list,side){list.forEach(function(n,i){pos.set(n.id,{x:side?780:320,y:45+i*(height-90)/Math.max(1,list.length-1)});});});
      activeEdges.forEach(function(e){var a=pos.get(e.from),b=pos.get(e.to);var path=svg('path',{d:'M'+a.x+','+a.y+' C550,'+a.y+' 550,'+b.y+' '+b.x+','+b.y,stroke:'#a7c6d9','stroke-opacity':0.6,'stroke-width':Math.min(10,1+Math.sqrt(weight(e))),fill:'none'});drawing.appendChild(path);});
      parts.forEach(function(list,side){list.forEach(function(n){var p=pos.get(n.id),g=svg('g');g.appendChild(svg('rect',{x:side?p.x:p.x-310,y:p.y-18,width:310,height:36,rx:6,fill:side?'#e2f5f1':'#e5f0fc',stroke:side?TEAL:BLUE}));g.appendChild(svg('text',{x:side?p.x+10:p.x-300,y:p.y+5,'font-size':13,fill:'#234'},n.label.length>38?n.label.slice(0,38)+'…':n.label));selectable(g,n.label,function(){showDetail(n);});drawing.appendChild(g);});});
    }
    function heatmap() {
      var parts = partitions(), orgs = parts[0], tags = parts[1];
      var cw = 42, rh = 34, left = 270, top = 160;
      var drawing = makeSvg(Math.max(720, left + tags.length * cw + 40), top + orgs.length * rh + 70);
      var counts = new Map(), max = 1;
      activeEdges.forEach(function (e) { counts.set(e.from + '|' + e.to, weight(e)); max = Math.max(max, weight(e)); });
      tags.forEach(function (t, i) {
        var x = left + i * cw + cw / 2;
        var label = svg('text', {x:x, y:top - 12, transform:'rotate(-50 ' + x + ' ' + (top - 12) + ')', 'font-size':12, fill:TEAL}, t.label);
        selectable(label, t.label, function () { showDetail(t); }); drawing.appendChild(label);
      });
      orgs.forEach(function (o, row) {
        var y = top + row * rh;
        var label = svg('text', {x:left - 12, y:y + 22, 'text-anchor':'end', 'font-size':12, fill:BLUE}, o.label);
        selectable(label, o.label, function () { showDetail(o); }); drawing.appendChild(label);
        tags.forEach(function (t, col) {
          var count = counts.get(o.id + '|' + t.id) || 0;
          var intensity = count ? 0.15 + 0.85 * Math.sqrt(count / max) : 0;
          var group = svg('g');
          group.appendChild(svg('rect', {x:left + col*cw, y:y, width:cw-1, height:rh-1, fill:count ? 'rgba(0,117,121,' + intensity + ')' : '#f0f3f6'}));
          group.appendChild(svg('text', {x:left + col*cw + cw/2, y:y+22, 'text-anchor':'middle', 'font-size':12, fill:intensity > 0.6 ? '#fff' : '#234'}, String(count)));
          if (count) selectable(group, o.label + ' / ' + t.label + ': ' + count + ' ชุดข้อมูล', function () { showDetail(o,t,count); });
          drawing.appendChild(group);
        });
      });
      drawing.appendChild(svg('text', {x:left, y:top+orgs.length*rh+36, 'font-size':13, fill:'#456'}, 'สีเข้ม = จำนวนชุดข้อมูลมาก · เลื่อนเพื่อดูทุกแถวและคอลัมน์'));
    }
    function chord() {
      var drawing = makeSvg(1100, 940), cx=550, cy=450, radius=300;
      drawing.style.minWidth='720px';
      var parts=partitions(), positions=new Map();
      parts.forEach(function (list, side) {
        var total=list.reduce(function (sum,n) { return sum + activeEdges.filter(function(e){return e.from===n.id || e.to===n.id;}).reduce(function(s,e){return s+weight(e);},0); },0);
        var start=side ? -Math.PI/2+0.06 : Math.PI/2+0.06;
        var span=Math.PI-0.12, cursor=start;
        list.forEach(function(n) {
          var amount=activeEdges.filter(function(e){return e.from===n.id || e.to===n.id;}).reduce(function(s,e){return s+weight(e);},0);
          var size=amount/total*span, mid=cursor+size/2;
          var arcEnd=cursor+size*0.88;
          function point(a,r){return [cx+Math.cos(a)*r,cy+Math.sin(a)*r];}
          var p1=point(cursor,radius), p2=point(arcEnd,radius);
          var arc=svg('path',{d:'M'+p1.join(',')+' A'+radius+','+radius+' 0 '+(arcEnd-cursor>Math.PI?1:0)+' 1 '+p2.join(','),fill:'none',stroke:side?TEAL:BLUE,'stroke-width':16});
          arc.appendChild(svg('title',{},n.label+' · '+amount+' ชุดข้อมูล'));
          selectable(arc,n.label,function(){showDetail(n);}); drawing.appendChild(arc);
          positions.set(n.id,{angle:cursor,span:size*0.88,used:0,total:amount});
          var p=point(mid,radius+20), text=svg('text',{x:p[0],y:p[1],fill:side?TEAL:BLUE,'font-size':10,'text-anchor':Math.cos(mid)>0?'start':'end'},n.label);
          text.appendChild(svg('title',{},n.label)); drawing.appendChild(text); cursor+=size;
        });
      });
      function point(a){return [cx+Math.cos(a)*(radius-12),cy+Math.sin(a)*(radius-12)];}
      activeEdges.forEach(function(e){
        var a=positions.get(e.from), b=positions.get(e.to), amount=weight(e);
        var a0=point(a.angle+a.used/a.total*a.span), a1=point(a.angle+(a.used+amount)/a.total*a.span);
        var b0=point(b.angle+b.used/b.total*b.span), b1=point(b.angle+(b.used+amount)/b.total*b.span);
        a.used+=amount; b.used+=amount;
        var d='M'+a0.join(',')+' Q'+cx+','+cy+' '+b1.join(',')+' L'+b0.join(',')+' Q'+cx+','+cy+' '+a1.join(',')+' Z';
        var path=svg('path',{d:d,fill:TEAL,'fill-opacity':0.17,stroke:TEAL,'stroke-opacity':0.1});
        var org=activeNodes.find(function(n){return n.id===e.from;}), tag=activeNodes.find(function(n){return n.id===e.to;});
        path.appendChild(svg('title',{},org.label+' → '+tag.label+': '+amount+' ชุดข้อมูล'));
        path.addEventListener('mouseenter',function(){path.setAttribute('fill',GOLD);path.setAttribute('fill-opacity',0.8);});
        path.addEventListener('mouseleave',function(){path.setAttribute('fill',TEAL);path.setAttribute('fill-opacity',0.17);});
        selectable(path,org.label+' / '+tag.label,function(){showDetail(org,tag,amount);}); drawing.insertBefore(path,drawing.firstChild);
      });
      drawing.appendChild(svg('text',{x:cx,y:900,'text-anchor':'middle','font-size':14,fill:'#456'},'ความกว้างแถบ = จำนวนชุดข้อมูล · คลิกแถบเพื่อดูข้อมูล'));
    }
    function networkView() {
      if (typeof vis === 'undefined') throw new Error('Network library unavailable');
      var parts=partitions(), mode=view.value, copies=activeNodes.map(function(n){return Object.assign({},n);});
      var options={nodes:{shape:'dot',scaling:{min:10,max:28},font:{size:14,face:'Prompt, sans-serif',color:'#234',strokeWidth:3,strokeColor:'#fff'}},edges:{color:{color:'#cbd7e2',highlight:GOLD},scaling:{min:1,max:5},smooth:{type:'continuous'}},groups:{Organization:{color:BLUE},Tag:{color:TEAL}},physics:{stabilization:{iterations:250},barnesHut:{gravitationalConstant:-2400,springLength:160}},interaction:{hover:true,zoomView:false,navigationButtons:true,keyboard:true}};
      regions=[];
      if (mode==='bipartite') {
        copies.forEach(function(n){var side=n.group==='Organization'?0:1, list=parts[side], i=list.findIndex(function(o){return o.id===n.id;}); n.x=side?420:-420;n.y=(i-(list.length-1)/2)*65;n.fixed=true;n.shape=side?'box':'box';n.margin=10;});
        options.physics=false;
      }
      if (mode==='cluster') {
        options.nodes.font.size=Math.min(28,14+parts[1].length/2); copies.forEach(function(n){if(n.label.length>24)n.label=n.label.match(/.{1,24}/g).join('\n');});
        // Shared-tag communities: each organization joins its strongest tag.
        var dominant=new Map();
        parts[0].forEach(function(o){var links=activeEdges.filter(function(e){return e.from===o.id;}).sort(function(a,b){return weight(b)-weight(a);});dominant.set(o.id,links[0].to);});
        var communities=parts[1].map(function(t){return {tag:t,orgs:parts[0].filter(function(o){return dominant.get(o.id)===t.id;})};});
        var cols=Math.ceil(Math.sqrt(communities.length));
        communities.forEach(function(c,index){
          var x=(index%cols)*700, y=Math.floor(index/cols)*650, r=Math.max(140,c.orgs.length*24);
          regions.push({x:x,y:y,r:r+90,label:c.tag.label});
          copies.forEach(function(n){if(n.id===c.tag.id){n.x=x;n.y=y;n.fixed=true;} var i=c.orgs.findIndex(function(o){return o.id===n.id;});if(i>=0){n.x=x+Math.cos(i/c.orgs.length*Math.PI*2)*r;n.y=y+Math.sin(i/c.orgs.length*Math.PI*2)*r;n.fixed=true;}});
        });
        options.physics=false;
      }
      dataNodes=new vis.DataSet(copies);
      network=new vis.Network(canvas,{nodes:dataNodes,edges:activeEdges.map(function(e,i){return Object.assign({id:i},e);})},options);
      network.on('beforeDrawing',function(ctx){regions.forEach(function(r){ctx.fillStyle='rgba(22,156,151,0.07)';ctx.strokeStyle='rgba(22,156,151,0.24)';ctx.beginPath();ctx.ellipse(r.x,r.y,r.r,r.r,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#187570';ctx.font='30px sans-serif';ctx.textAlign='center';ctx.fillText(r.label,r.x,r.y-r.r-15);});});
      network.on('click',function(p){
        if(!p.nodes.length){clearDetail();if(mode==='focus') render();return;}
        var node=activeNodes.find(function(n){return n.id===p.nodes[0];});showDetail(node);
        if(mode==='focus'){
          selected=node.id;var neighbors=new Set(network.getConnectedNodes(selected));neighbors.add(selected);
          dataNodes.update(copies.map(function(n){return {id:n.id,color:neighbors.has(n.id)?(n.group==='Organization'?BLUE:TEAL):'#e0e5e9',font:{color:neighbors.has(n.id)?'#234':'#b7bec4'}};}));
          network.body.data.edges.update(activeEdges.map(function(e,i){return {id:i,color:e.from===selected||e.to===selected?GOLD:'#edf0f3',width:e.from===selected||e.to===selected?3:1};}));
        }
      });
      if (mode === 'focus') {
        network.once('stabilizationIterationsDone', function () {
          // Keep force physics enabled so dragging moves connected nodes too.
          network.fit({animation:false});
          network.moveTo({scale:Math.min(0.95,Math.max(0.55,canvas.clientWidth/1400)),animation:false});
        });
      } else {
        network.once('afterDrawing',function(){network.fit({animation:false});});
      }
    }
    function render() {
      if(network){network.destroy();network=null;} canvas.replaceChildren();clearDetail();
      root.setAttribute('data-view',view.value);
      var ids=new Set(allNodes.filter(function(n){return n.group==='Tag'&&n.rank<=Number(slider.value);}).map(function(n){return n.id;}));
      activeEdges=allEdges.filter(function(e){return ids.has(e.to);});
      var orgIds=new Set(activeEdges.map(function(e){return e.from;}));
      activeNodes=allNodes.filter(function(n){return ids.has(n.id)||orgIds.has(n.id);});
      root.querySelector('[data-sp-help]').textContent=view.value==='heatmap'?'สีเข้ม = ชุดข้อมูลมาก · คลิกช่องที่มีข้อมูล':view.value==='chord'?'แถบกว้าง = ชุดข้อมูลมาก · คลิกแถบหรือชื่อ':view.value==='cluster'?'จัดกลุ่มตาม Tag ที่เชื่อมโยงมากที่สุด · Alt + Scroll เพื่อซูม':view.value==='focus'?'ลากโหนดให้เครือข่ายขยับตาม · คลิกเพื่อเน้นความสัมพันธ์ · Alt + Scroll เพื่อซูม':'หน่วยงานฝั่งซ้าย / Tags ฝั่งขวา · เลื่อนเพื่อดูทุกรายการ';
      if(!activeEdges.length){canvas.textContent='ไม่มีความสัมพันธ์สำหรับ Tags ที่เลือก';loading.hidden=true;return;}
      try {if(view.value==='heatmap')heatmap();else if(view.value==='chord')chord();else if(view.value==='bipartite')bipartite();else networkView();loading.hidden=true;}
      catch(error){loading.hidden=false;loading.textContent='แสดงกราฟไม่สำเร็จ กรุณาลองเลือกมุมมองอีกครั้ง';}
    }
    view.addEventListener('change',render);
    var timer;
    slider.addEventListener('input',function(){root.querySelector('[data-sp-slider-val]').textContent=slider.value;clearTimeout(timer);timer=setTimeout(render,150);});
    canvas.addEventListener('wheel',function(e){if(!e.altKey||!network)return;e.preventDefault();network.moveTo({scale:Math.min(5,Math.max(0.05,network.getScale()*(e.deltaY<0?1.1:0.9)))});},{passive:false});
    fetch(root.getAttribute('data-api'),{credentials:'same-origin'}).then(function(r){if(!r.ok)throw new Error('HTTP');return r.json();}).then(function(j){
      if(!j.success)throw new Error('API');allNodes=j.result.nodes;allEdges=j.result.edges;
      var max=allNodes.reduce(function(m,n){return Math.max(m,n.rank||0);},1);slider.max=max;slider.value=Math.min(Number(slider.value),max);root.querySelector('[data-sp-slider-val]').textContent=slider.value;
      root.querySelector('[data-sp-date]').textContent='ข้อมูล ณ '+new Date(j.result.generated_at).toLocaleString('th-TH');render();
    }).catch(function(){loading.textContent='โหลดข้อมูลกราฟไม่สำเร็จ';});
  }
  function boot(){document.querySelectorAll('[data-sp-graph]').forEach(init);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();



