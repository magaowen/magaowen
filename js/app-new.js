/* =====================================================
 * SoftHub 前台 - 全新重写版 (app-new.js)
 * 简洁、可靠、无历史包袱
 * ===================================================== */
console.log('[SoftHub] app-new.js LOADED', new Date().toISOString());

const App = {
  state: { cat: 'all', kw: '', sort: 'hot' },

  /* ====== 主入口 ====== */
  async init() {
    console.log('[App] init start');
    try {
      // 1. 等待数据就绪
      await DB.init();
      console.log('[App] DB ready, mode=', DB.mode, 'softwares=', DB.softwares().length);

      // 2. 渲染页面
      this.renderAll();

      // 3. 绑定事件
      this.bindEvents();

      // 4. 防自动填充：解除 readonly + 清空
      const si = document.getElementById('searchInput');
      if (si) {
        setTimeout(function() { si.removeAttribute('readonly'); }, 200);
      }

      console.log('[App] init done');
    } catch(e) {
      console.error('[App] init error:', e);
    }
  },

  renderAll() {
    this.renderHeader();
    this.renderStats();
    this.renderAnnounce();
    this.renderChips();
    this.renderGrid();   // 核心：渲染软件列表
    this.renderBiz();
  },

  /* ====== 顶栏 ====== */
  renderHeader() {
    var st = DB.settings();
    var el = document.getElementById('siteName');
    if(el) el.textContent = st.siteName || 'SoftHub';
    document.title = (st.siteName || 'SoftHub') + ' · 软件分享平台';
    el = document.getElementById('heroTitle');
    if(el) el.textContent = st.heroTitle || '发现下一款改变工作方式的软件';
    el = document.getElementById('siteSlogan');
    if(el) el.textContent = st.siteSlogan || '发现 · 分享 · 极致软件体验';

    // 登录区
    this.renderAuth();
  },

  renderAuth() {
    var box = document.getElementById('authArea');
    if(!box) return;
    var me = DB.session();
    if(!me) {
      box.innerHTML = '<button class="btn btn-ghost" onclick="App.openAuth(\'login\')">登录</button><button class="btn btn-primary" onclick="App.openAuth(\'reg\')">注册账户</button>';
      return;
    }
    box.innerHTML = '<div class="user-chip" onclick="document.getElementById(\'userMenu\').classList.toggle(\'open\');event.stopPropagation()"><span class="avatar" style="background:'+(me.color||'#6366f1')+'">'+(me.username[0]||'?').toUpperCase()+'</span><span class="name">'+this.esc(me.username)+'</span><span style="color:var(--text3);font-size:11px">▼</span><div class="user-menu" id="userMenu"><button onclick="App.openUpload()">📤 上传软件</button><button onclick="App.openMine()">👤 个人中心</button>'+(me.role==='admin'?'<button onclick="location.href=\'admin.html\'">🛠️ 后台管理</button>':'')+'<button onclick="App.doLogout()" style="color:var(--err)">🚪 退出登录</button></div></div>';
  },

  /* ====== 统计 ====== */
  renderStats() {
    var softs = DB.softwares().filter(function(s){return s.status==='approved';});
    var totalDl = 0;
    softs.forEach(function(s){totalDl += (s.downloads||0);});
    var users = DB.users().length;
    var cats = DB.categories().length;
    var el = document.getElementById('heroStats');
    if(!el) return;
    el.innerHTML = '<div class="hstat"><b class="grad-text">'+softs.length+'</b><span>精选软件</span></div>'+
      '<div class="hstat"><b class="grad-text">'+this.fmtNum(totalDl)+'</b><span>累计下载</span></div>'+
      '<div class="hstat"><b class="grad-text">'+users+'</b><span>注册用户</span></div>'+
      '<div class="hstat"><b class="grad-text">'+cats+'</b><span>软件分类</span></div>';
  },

  renderAnnounce() {
    var list = (DB.announcements()||[]).filter(function(a){return a.enabled;});
    var bar = document.getElementById('announceBar');
    if(!bar) return;
    if(!list.length){bar.innerHTML='';return;}
    var a = list[0];
    bar.innerHTML = '<div class="announce-inner">📣 <b>'+this.esc(a.title)+'</b> '+this.esc(a.content)+'</div>';
  },

  /* ====== 分类 ====== */
  renderChips() {
    var cats = DB.categories()||[];
    var html = '<button class="chip '+(this.state.cat==='all'?'on':'')+'" onclick="App.setCat(\'all\')">全部</button>';
    for(var i=0;i<cats.length;i++){
      html += '<button class="chip '+(this.state.cat===cats[i].id?'on':'')+'" onclick="App.setCat(\''+cats[i].id+'\')">'+cats[i].icon+' '+this.esc(cats[i].name)+'</button>';
    }
    var el = document.getElementById('catChips');
    if(el) el.innerHTML = html;
  },
  setCat(id){this.state.cat=id;this.renderChips();this.renderGrid();},

  /* ====== ★★★ 软件网格（核心渲染）★★★ ====== */
  renderGrid() {
    console.log('[App] renderGrid called, kw="'+this.state.kw+'" cat='+this.state.cat);
    var grid = document.getElementById('softGrid');
    if(!grid){console.error('[App] #softGrid not found!');return;}

    // 过滤
    var list = (DB.softwares()||[]).filter(function(s){return s.status==='approved';});
    console.log('[App] approved count:', list.length);

    if(this.state.cat!=='all'){
      var c=this.state.cat;
      list=list.filter(function(s){return s.category===c;});
    }
    if(this.state.kw){
      var k=this.state.kw.toLowerCase();
      list=list.filter(function(s){
        var t=(s.name||'')+' '+(s.desc||'')+' '+(s.tags||[]).join(',');
        return t.toLowerCase().indexOf(k)!==-1;
      });
    }
    // 排序
    if(this.state.sort==='hot') list.sort(function(a,b){return(b.downloads||0)-(a.downloads||0);});
    else if(this.state.sort==='new') list.sort(function(a,b){return(b.createdAt||0)-(a.createdAt||0);});
    else if(this.state.sort==='rate') list.sort(function(a,b){return(b.rating||0)-(a.rating||0);});

    console.log('[App] after filter+sort:', list.length, 'items');

    // 渲染
    if(list.length===0){
      grid.innerHTML='<div class="empty"><div class="icon">🔭</div>没有找到匹配的软件</div>';
      return;
    }

    var catsMap={};
    (DB.categories()||[]).forEach(function(c){catsMap[c.id]=c;});

    var html='';
    for(var i=0;i<list.length;i++){
      var s=list[i];
      var cat=catsMap[s.category];
      var cover=this.getCover(s);
      var iconSrc=s.iconImage||cover;
      var iconHtml=iconSrc?'<img src="'+iconSrc+'" style="width:54px;height:54px;border-radius:15px;object-fit:cover;display:block" alt="">':(s.icon||'📦');
      html+='<div class="card soft-card" onclick="App.openDetail(\''+s.id+'\')">'+
        '<div class="sc-head">'+
          '<div class="sc-icon '+(iconSrc?'thumb':'')+'">'+iconHtml+'</div>'+
          '<div style="min-width:0">'+
            '<div class="sc-title">'+this.esc(s.name)+' <span class="sc-ver">v'+this.esc(s.version)+'</span></div>'+
            '<div class="sc-meta">'+
              '<span>'+(cat?cat.icon+' '+this.esc(cat.name):'')+'</span>'+
              '<span>💾 '+this.fmtSize(s.size)+'</span>'+
            '</div>'+
          '</div>'+
        '</div>'+
        '<p class="sc-desc">'+this.esc(s.desc)+'</p>'+
        '<div class="sc-tags">'+(s.tags||[]).slice(0,3).map(function(t){return'<span class="tag">'+t+'</span>';}).join('')+'</div>'+
        '<div class="sc-foot">'+
          '<span class="sc-dl">'+this.stars(s.rating)+' <span style="margin-left:4px">⬇ '+this.fmtNum(s.downloads)+'</span></span>'+
          '<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();App.doDownload(\''+s.id+'\')">⬇ 下载</button>'+
        '</div>'+
      '</div>';
    }
    grid.innerHTML=html;
    console.log('[App] grid rendered, innerHTML length:', grid.innerHTML.length);
  },

  /* ====== 商务合作 ====== */
  renderBiz(){
    var sec=document.getElementById('bizSection');if(!sec)return;
    var biz=(DB.settings()||{}).business||{enabled:true,title:'🤝 商务合作',desc:'欢迎软件厂商、开发者与渠道伙伴洽谈上架、赞助与联合推广。',contacts:[{label:'商务邮箱',value:'business@softhub.io',icon:'📧'},{label:'微信号',value:'SoftHub-Biz',icon:'💬'}],images:[]};
    if(biz.enabled===false){sec.style.display='none';sec.innerHTML='';return;}
    sec.style.display='';
    var cs=(biz.contacts||[]).filter(function(c){return c&&c.value;});
    var html='<div class="biz-inner"><div class="biz-head"><h2>'+this.esc(biz.title||'商务合作')+'</h2></div>';
    if(biz.desc)html+='<p class="biz-desc">'+this.esc(biz.desc)+'</p>';
    if(cs.length)html+='<div class="biz-contact">'+cs.map(function(c){return'<div style="display:flex;align-items:center;gap:12px;padding:13px 18px;background:var(--bg3);border:1px solid var(--border);border-radius:14px;margin-bottom:10px"><span style="font-size:24px">'+(c.icon||'📞')+'</span><div><div style="font-size:12px;color:var(--text3)">'+c.label+'</div><div style="font-size:14.5px;font-weight:600">'+c.value+'</div></div></div>';}).join('')+'</div>';
    html+='</div>';sec.innerHTML=html;
  },
  scrollToBiz(){var el=document.getElementById('bizSection');if(el)el.scrollIntoView({behavior:'smooth'});},

  /* ====== 事件绑定 ====== */
  bindEvents(){
    var self=this;
    var si=document.getElementById('searchInput');
    if(si){
      si.addEventListener('input',function(e){
        var v=e.target.value.trim();
        if(/^\d{5,}$/.test(v)){e.target.value='';return;}
        self.state.k=v;self.renderGrid();
      });
    }
    var ss=document.getElementById('sortSel');
    if(ss)ss.addEventListener('change',function(e){self.state.sort=e.target.value;self.renderGrid();});
    document.addEventListener('click',function(e){
      var m=document.getElementById('userMenu');if(m&&e.target.closest&&!e.target.closest('.user-chip'))m.classList.remove('open');
    });
    document.querySelectorAll('.modal-mask').forEach(function(m){m.addEventListener('click',function(e){if(e.target===m)m.classList.remove('open');});});
    document.addEventListener('keydown',function(e){if(e.key==='Escape')document.querySelectorAll('.modal-mask.open').forEach(function(m){m.classList.remove('open');});});
  },

  /* ====== 工具函数 ====== */
  esc(s){var d=document.createElement('div');d.textContent=s||'';return d.innerHTML;},
  fmtNum(n){n=n||0;if(n>=10000)return(n/10000).toFixed(1)+'万';return String(n);},
  fmtSize(n){n=n||0;if(n>=1024*1024*1024)return(n/1073741824).toFixed(1)+'GB';if(n>=1024*1024)return(n/1048576).toFixed(1)+'MB';if(n>=1024)return(n/1024).toFixed(1)+'KB';return n+'B';},
  stars(r){r=r||0;var s='';for(var i=1;i<=5;i++)s+=i<=Math.round(r)?'⭐':'☆';return s;},
  getCover(s){var imgs=s.images||[];if(imgs.length){var c=imgs.find(function(im){return im.id===s.coverId;})||imgs[0];return c.data;}return null;},
  /* 图标：优先图标图片，否则封面，否则 Emoji */
  getIcon(s){if(s&&s.iconImage)return s.iconImage;var c=this.getCover(s);if(c)return c;return s&&s.icon?null:null;},
  /* 图片上传器所需方法（供 U.renderImageUploader 回调） */
  addImageFiles(files){
    var arr=[].slice.call(files).filter(function(f){return f.type.indexOf('image/')===0;});
    if(!arr.length)return;
    var self=this,pending=arr.length;
    arr.forEach(function(file){
      U.compressImage(file).then(function(data){
        var id='i_'+DB.uid();
        self.state.images.push({id:id,data:data});
        if(!self.state.coverId)self.state.coverId=id;
        if(--pending===0)U.renderImageUploader('upImages',self.state,self,'App');
      });
    });
  },
  setCover(id){this.state.coverId=id;U.renderImageUploader('upImages',this.state,this,'App');},
  removeImage(id){
    this.state.images=this.state.images.filter(function(x){return x.id!==id;});
    if(this.state.coverId===id)this.state.coverId=this.state.images[0]?this.state.images[0].id:null;
    U.renderImageUploader('upImages',this.state,this,'App');
  },
  catById(id){return(DB.categories()||[]).find(function(c){return c.id===id;});},
  userById(id){return(DB.users()||[]).find(function(u){return u.id===id;});},
  softwareById(id){return(DB.softwares()||[]).find(function(s){return s.id===id;});},
  fmtDate(t){if(!t)return'-';var d=new Date(t);return(d.getMonth()+1)+'/'+d.getDate();},
  ago(t){if(!t)return'';var s=Math.floor((Date.now()-t)/1000);if(s<60)return s+'秒前';if(s<3600)Math.floor(s/60)+'分钟前';if(s<86400)return Math.floor(s/3600)+'小时前';return Math.floor(s/86400)+'天前';},

  close(id){var el=document.getElementById(id);if(el)el.classList.remove('open');},

  /* ====== 登录/注册 ====== */
  openAuth(mode){this.switchAuth(mode);document.getElementById('authModal').classList.add('open');},
  switchAuth(mode){
    var isLogin=mode==='login';
    document.getElementById('loginForm').style.display=isLogin?'':'none';
    document.getElementById('regForm').style.display=isLogin?'none':'';
    document.getElementById('authTitle').textContent=isLogin?'👋 欢迎回来':'🚀 创建账户';
    document.getElementById('authHint').textContent=isLogin?'登录后即可上传软件、发表评论':'注册即可上传分享你的软件（浏览下载无需注册）';
  },
  async doLogin(){
    var name=document.getElementById('loginUser').value.trim();
    var pass=document.getElementById('loginPass').value;
    var me=await DB.login(name,pass);if(!me)return;
    if(me.status==='banned'){alert('该账户已被封禁');DB.logout();return;}
    this.close('authModal');this.renderAuth();alert('欢迎回来，'+me.username+'！');
  },
  async doRegister(){
    var name=document.getElementById('regUser').value.trim();
    var email=document.getElementById('regEmail').value.trim();
    var pass=document.getElementById('regPass').value;
    var pass2=document.getElementById('regPass2').value;
    if(!/^[\u4e00-\u9fa5a-zA-Z0-9_]{2,16}$/.test(name)){alert('用户名需为2-16位字母、数字、下划线或中文');return;}
    if(!/^\S+@\S+\.\S+$/.test(email)){alert('邮箱格式不正确');return;}
    if(pass.length<6){alert('密码至少6位');return;}
    if(pass!==pass2){alert('两次密码不一致');return;}
    var me=await DB.register({username:name,email,password:pass});if(!me)return;
    this.close('authModal');this.renderAuth();this.renderStats();alert('注册成功，欢迎加入！');
  },
  doLogout(){DB.logout();this.renderAuth();alert('已退出');},

  /* ====== 上传（普通用户：仅下载链接，不能上传安装包）====== */
  openUpload(){
    var me=DB.session();if(!me){this.openAuth('login');return;}
    var cats=(DB.categories()||[]).map(function(c){return '<option value="'+c.id+'">'+c.icon+' '+App.esc(c.name)+'</option>';}).join('');
    var osList=['Windows','macOS','Linux','Android','iOS'];
    var osHtml=osList.map(function(o){return '<label style="display:flex;align-items:center;gap:5px;margin:0"><input type="checkbox" class="upOs" value="'+o+'" style="width:auto"'+(o==='Windows'?' checked':'')+'>'+o+'</label>';}).join('');
    var body=document.getElementById('uploadBody');
    body.innerHTML='<div class="modal-head"><h3>📤 上传软件</h3><button class="modal-close" onclick="App.close(\'uploadModal\')">✕</button></div>'+
      '<p class="hint" style="color:var(--ok)">'+(DB.settings().requireReview?'提交后进入管理员审核队列，通过后立即展示':'提交后立即公开展示')+'</p>'+
      '<div class="form-row"><div><label>软件名称 *</label><input id="upName" placeholder="如 CodeFlow IDE"></div><div><label>版本号 *</label><input id="upVer" placeholder="如 1.0.0"></div></div>'+
      '<div class="form-row"><div><label>分类 *</label><select id="upCat">'+cats+'</select></div>'+
      '<div><label>图标（可选 Emoji 或上传图片）</label><div style="display:flex;gap:10px;align-items:center"><input id="upIcon" placeholder="如 🚀" maxlength="4" style="flex:1"><button type="button" class="btn btn-sm" onclick="document.getElementById(\'upIconFile\').click()">🖼️ 上传图标</button></div><div id="upIconPreview" style="margin-top:8px"></div><input type="file" id="upIconFile" accept="image/*" style="display:none"></div></div>'+
      '<label>支持平台 *</label><div style="display:flex;gap:14px;font-size:13.5px;color:var(--text2);flex-wrap:wrap">'+osHtml+'</div>'+
      '<label>软件简介 *</label><textarea id="upDesc" rows="3" placeholder="介绍软件核心功能与亮点…"></textarea>'+
      '<label>标签（逗号分隔）</label><input id="upTags" placeholder="如 效率, 开源">'+
      '<label>下载链接 * <span class="hint" style="margin:0">普通用户不能上传安装包，请填外部下载地址</span></label><input id="upLink" placeholder="https://...">'+
      '<label>软件图片（至少 1 张，可设首图）*</label><div id="upImages"></div>'+
      '<div style="display:flex;gap:10px;margin-top:20px"><button class="btn btn-primary" style="flex:1" id="upPubBtn" onclick="App.doUpload()">提交发布</button><button class="btn" onclick="App.close(\'uploadModal\')">取消</button></div>';
    this.state.images=[]; this.state.coverId=null; this.state.iconImage=null;
    U.renderImageUploader('upImages', this.state, this, 'App');
    var iconFile=document.getElementById('upIconFile');
    if(iconFile) iconFile.onchange=function(){
      var f=iconFile.files[0]; if(!f)return;
      U.compressImage(f,160,0.9).then(function(data){
        App.state.iconImage=data;
        var p=document.getElementById('upIconPreview');
        p.innerHTML='<div style="display:inline-flex;align-items:center;gap:8px"><img src="'+data+'" style="width:48px;height:48px;border-radius:12px;object-fit:cover;border:1px solid var(--border)"><button type="button" class="btn btn-danger btn-sm" onclick="App.state.iconImage=null;document.getElementById(\'upIconPreview\').innerHTML=\'\'">✕ 移除</button></div>';
      });
    };
    document.getElementById('uploadModal').classList.add('open');
  },

  /* ====== 提交上传（普通用户：仅下载链接）====== */
  async doUpload(){
    var me=DB.session(); if(!me){this.openAuth('login');return;}
    var name=document.getElementById('upName').value.trim();
    var ver=document.getElementById('upVer').value.trim();
    var cat=document.getElementById('upCat').value;
    var icon=document.getElementById('upIcon').value.trim()||'📦';
    var desc=document.getElementById('upDesc').value.trim();
    var tags=document.getElementById('upTags').value.split(/[,，]/).map(function(t){return t.trim();}).filter(Boolean);
    var os=[].slice.call(document.querySelectorAll('.upOs:checked')).map(function(c){return c.value;});
    var link=document.getElementById('upLink').value.trim();
    if(!name||!ver||!desc){alert('请填写名称、版本和简介');return;}
    if(!os.length){alert('请至少选择一个支持平台');return;}
    if(!link){alert('请填写下载链接（普通用户不能上传安装包）');return;}
    if(!/^https?:/i.test(link)){alert('下载链接需以 http(s):// 开头');return;}
    if(!this.state.images.length){alert('请至少上传一张软件图片');return;}
    var payload={name:name,version:ver,category:cat,icon:icon,os:os,desc:desc,tags:tags,homepage:'',link:link,fileName:'',fileData:'',size:0,iconImage:this.state.iconImage||'',images:this.state.images,coverId:this.state.coverId};
    var self=this;
    if(DB.mode!=='remote'){
      DB.softwares().push({id:'s_'+DB.uid(),name:name,version:ver,category:cat,icon:icon,os:os,size:0,desc:desc,tags:tags,uploaderId:me.id,status:DB.settings().requireReview?'pending':'approved',downloads:0,views:0,rating:0,ratingCount:0,createdAt:Date.now(),homepage:'',fileName:'',fileData:'',link:link,downloadUrl:link,iconImage:self.state.iconImage||'',images:self.state.images,coverId:self.state.coverId});
      DB.saveSoftwares(DB.softwares()); self._afterUserUpload(); return;
    }
    try{
      var res=await U.xhrPost('/api/softwares',payload);
      if(!res||res.error)throw new Error((res&&res.error)||'提交失败');
      DB.softwares().push({id:res.id,name:name,version:ver,category:cat,icon:icon,os:os,size:0,desc:desc,tags:tags,uploaderId:me.id,status:res.status||'approved',downloads:0,views:0,rating:0,ratingCount:0,createdAt:Date.now(),homepage:'',fileName:'',fileData:'',link:link,downloadUrl:link,iconImage:self.state.iconImage||'',images:self.state.images,coverId:self.state.coverId});
      self._afterUserUpload();
    }catch(e){alert('提交失败：'+(e.message||'未知错误'));}
  },
  _afterUserUpload(){
    this.close('uploadModal');
    ['upName','upVer','upIcon','upDesc','upTags','upLink'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
    this.state.images=[]; this.state.coverId=null; this.state.iconImage=null;
    this.renderGrid(); this.renderStats();
    alert(DB.settings().requireReview?'提交成功，等待管理员审核 ⏳':'发布成功！');
  },

  /* ====== 下载 ====== */
  async doDownload(id){
    var s=this.softwareById(id);if(!s){alert('软件未找到');return;}
    var url=s.downloadUrl||s.link;if(url){window.open(url,'_blank','noopener');alert('开始下载 '+s.name);return;}
    alert('该软件暂无下载链接');
  },

  /* ====== 详情 ====== */
  openDetail(id){
    var s=this.softwareById(id);if(!s)return;
    var cat=this.catById(s.category);
    var up=this.userById(s.uploaderId);
    var cover=this.getCover(s);
    var iconSrc=s.iconImage||cover;
    var imgs=s.images||[];
    var gallery='';
    if(imgs.length){
      var mainImg=(imgs.find(function(i){return i.id===s.coverId;})||imgs[0]).data;
      gallery='<div style="margin:8px 0 18px"><img src="'+mainImg+'" alt="" style="max-width:100%;border-radius:16px"></div>';
    }else if(iconSrc){
      gallery='<div style="margin:8px 0 18px"><img src="'+iconSrc+'" alt="" style="width:84px;height:84px;border-radius:22px"></div>';
    }
    document.getElementById('detailBody').innerHTML=
      '<div class="modal-head"><h3>软件详情</h3><button class="modal-close" onclick="App.close(\'detailModal\')">✕</button></div>'+
      gallery+
      '<div class="detail-head">'+
        '<div style="font-size:48px">'+(iconSrc?'<img src="'+iconSrc+'" style="width:84px;height:84px;border-radius:22px" alt="">':(s.icon||'📦'))+'</div>'+
        '<div style="flex:1;min-width:0"><h2 style="font-size:22px">'+this.esc(s.name)+' <span class="badge badge-info">v'+this.esc(s.version)+'</span></h2>'+
        '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><span class="badge badge-gray">'+(cat?cat.icon+' '+this.esc(cat.name):'未分类')+'</span>'+
        (s.os||[]).map(function(o){return'<span class="badge badge-gray">'+o+'</span>';}).join('')+'</div>'+
        '<div style="margin-top:8px;font-size:12.5px;color:var(--text3)">由 <b>'+(up?this.esc(up.username):'未知用户')+'</b> 分享于 '+this.fmtDate(s.createdAt)+'</div></div>'+
        '<button class="btn btn-primary" style="align-self:center;flex:none" onclick="App.doDownload(\''+s.id+'\')">⬇ 立即下载</button>'+
      '</div>'+
      '<div class="detail-stats"><div class="dstat"><b>'+this.fmtNum(s.downloads)+'</b><span>下载量</span></div><div class="dstat"><b>'+this.fmtNum(s.views)+'</b><span>浏览量</span></div><div class="dstat"><b>'+(s.rating?s.rating.toFixed(1):'—')+'</b><span>评分</span></div><div class="dstat"><b>'+this.fmtSize(s.size)+'</b><span>大小</span></div></div>'+
      '<p style="font-size:14px;line-height:1.8;color:var(--text2)">'+this.esc(s.desc)+'</p>'+
      '<div class="sc-tags" style="margin-top:12px">'+(s.tags||[]).map(function(t){return'<span class="tag">'+t+'</span>';}).join('')+'</div>';
    document.getElementById('detailModal').classList.add('open');
  },

  /* ====== 个人中心 ====== */
  openMine(tab){
    var me=DB.session();if(!me){this.openAuth('login');return;}
    tab=tab||'up';
    var myUps=(DB.softwares()||[]).filter(function(s){return s.uploaderId===me.id;}).sort(function(a,b){return b.createdAt-a.createdAt;});
    var content='';
    if(tab==='up'){
      content=myUps.length?myUps.map(function(s){var c=App.getCover(s);var ic=s.iconImage||c;return'<div class="mine-item"><span class="mi-icon">'+(ic?'<img src="'+ic+'" style="width:26px;height:26px;border-radius:8px" alt="">':s.icon)+'</span><div class="mi-main"><b>'+App.esc(s.name)+' v'+App.esc(s.version)+'</b><div>⬇ '+App.fmtNum(s.downloads)+' · 👁 '+App.fmtNum(s.views)+'</div></div><button class="btn btn-danger btn-sm" onclick="App.deleteMine(\''+s.id+'\')">删除</button></div>';}).join(''):'<div class="empty"><div class="icon">📭</div>还没有上传过软件</div>';
    }
    document.getElementById('mineBody').innerHTML='<div class="modal-head"><h3>👤 个人中心</h3><button class="modal-close" onclick="App.close(\'mineModal\')">✕</button></div>'+
      '<div style="display:flex;align-items:center;gap:14px;margin-top:10px"><span class="avatar" style="width:52px;height:52px;font-size:22px;border-radius:15px;background:'+(me.color||'#6366f1')+'">'+(me.username[0]||'?').toUpperCase()+'</span><div><b style="font-size:17px">'+me.username+'</b><div class="hint">'+me.email+'</div></div></div>'+
      '<div style="display:flex;align-items:center;gap:14px;margin-top:10px"><button class="mine-tab on" onclick="App.openMine(\'up\')">我的上传('+myUps.length+')</button></div>'+
      '<div style="max-height:46vh;overflow-y:auto">'+content+'</div>';
    document.getElementById('mineModal').classList.add('open');
  },
  deleteMine(id){if(confirm('确定删除？')){DB.saveSoftwares((DB.softwares()||[]).filter(function(s){return s.id!==id;}));DB.saveComments((DB.comments()||[]).filter(function(c){return c.softwareId!==id;}));this.openMine('up');this.renderGrid();this.renderStats();alert('已删除');}}
};

// 启动
DB.init().then(function(){App.init();});
