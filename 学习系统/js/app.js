// v3: preserve v2 storage, add reliable mastery tracking and course navigation.
var PRE = ['what-is-code','what-is-ai','python-intro','numpy-intro'];
var CORE = ['concept','vision','ml','arm','coord','control','brain','sound','connect','learn'];
var SECTIONS = PRE.concat(CORE), TOTAL_SECTIONS = 14, MAX_SCORE = 30, MOBILE_MAX = 820;
var STORE_KEY = 'embodied_learning_progress_v2', GUIDE_KEY = 'embodied_guide_mode_v2';
var LAST_KEY = 'embodied_last_lesson_v3', VIEW_KEY = 'embodied_reading_view_v3';
var memoryState = null, memoryPrefs = {}, storageWarning = false, readingAll = false, currentPage = 'roadmap', lastModalFocus = null;
var COURSE_META = {
  'what-is-code':['什么是代码',5,'读懂一条指令，运行你的第一行代码。'],
  'what-is-ai':['什么是 AI',6,'说明数据、训练和推理的区别。'],
  'python-intro':['Python 快速入门',15,'读懂变量、列表、判断、循环和函数。'],
  'numpy-intro':['数组与矩阵启蒙',10,'算出一个点旋转 90° 后的位置。'],
  concept:['什么是具身智能',6,'说出机器人拿水杯时“看、想、动”分别做什么。'],
  vision:['机器看见 · OpenCV',10,'调整颜色阈值，让画面只保留红色苹果。'],
  ml:['机器学习入门',8,'区分训练与推理，理解模型如何从样本学习。'],
  arm:['机械臂 · 运动学',15,'预测连杆旋转 90° 的坐标，再用实验验证。'],
  coord:['坐标变换',12,'比较先旋转再平移与反过来的差别。'],
  control:['控制稳定 · PID',12,'比较 P、PI、PID 三组参数的高度响应。'],
  brain:['大脑 · 大模型',8,'理解自然语言如何变成动作指令。'],
  sound:['听和说 · ASR / TTS',8,'串起听到声音、识别、决策和回答的流程。'],
  connect:['通讯与 MCP',10,'观察 UART 的起始位、数据位和停止位。'],
  learn:['机器怎么学习',10,'区分模仿学习与强化学习，并观察电机的执行。']
};
var SIM_MAP = {
  color:'../课程ppt/颜色过滤模拟器.html', linkage:'../课程ppt/单连杆运动学模拟器.html',
  linkage2:'../课程ppt/单连杆运动学几何推导模拟器.html', twoLink:'../课程ppt/二连杆运动学模拟器.html',
  '2darm':'../课程ppt/2D三连杆机械臂正解计算模拟器.html', '3darm':'../课程ppt/3D机械臂正解计算模拟器.html',
  pid:'../课程ppt/PID模拟器.html', motor:'../课程ppt/六步换向无刷电机.html', stepper:'../课程ppt/步进电机模拟器.html',
  matrix:'../课程ppt/旋转矩阵和平移矩阵.html', transform:'../课程ppt/旋转平移矩阵演示.html',
  coord:'../课程ppt/坐标变换与矢量叠加模拟器.html', uart:'../软件/UART模拟器.html'
};
var SIM_INFO = {
  color:['颜色过滤','视觉','保留苹果，滤掉背景。','vision'],
  linkage:['单连杆运动学','运动学','用角度预测末端坐标。','arm'],
  linkage2:['单连杆几何推导','运动学','把三角函数与连杆对应起来。','arm'],
  twoLink:['二连杆运动学','运动学','观察关节角度如何叠加。','arm'],
  '2darm':['2D 三连杆机械臂','运动学','探索多个关节组成的工作空间。','arm'],
  '3darm':['3D 机械臂与夹爪','运动学','旋转视角，观察关节与夹爪。','arm'],
  pid:['PID 高度控制','控制','比较响应速度、振荡与稳态误差。','control'],
  motor:['无刷电机六步换向','控制','单步观察线圈与霍尔信号。','learn'],
  stepper:['步进电机','控制','比较单相、双相与半步模式。','learn'],
  matrix:['几何与矩阵','坐标','对照图形理解矩阵运算。','coord'],
  transform:['旋转与平移','坐标','拖动参数，观察点的位置。','coord'],
  coord:['坐标变换与矢量叠加','坐标','理解多个坐标系之间的关系。','coord'],
  uart:['UART 通讯','通讯','把字符拆成逐位传输的信号。','connect']
};
function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function toast(message) {
  var box = document.getElementById('appStatus'); if (!box) return;
  box.textContent = message; box.classList.add('visible'); clearTimeout(toast.timer);
  toast.timer = setTimeout(function(){ box.classList.remove('visible'); },4200);
}
function warnStorage() { if (!storageWarning) { storageWarning = true; toast('浏览器无法保存记录。离开前请在学习报告中导出进度。'); } }
function pref(key,value) {
  if (value !== undefined) { memoryPrefs[key] = value; try { localStorage.setItem(key,value); } catch(e) { warnStorage(); } return value; }
  try { return localStorage.getItem(key) || memoryPrefs[key] || ''; } catch(e) { return memoryPrefs[key] || ''; }
}
function normalizeState(raw) {
  raw = raw && typeof raw === 'object' ? raw : {};
  var s = {version:3,done:{},quiz:{},attempts:{},final:{tries:0,best:-1}};
  SECTIONS.forEach(function(id){
    if (raw.done && raw.done[id] === true) s.done[id] = true;
    if (raw.quiz && raw.quiz[id] === true) s.quiz[id] = true;
    var a = raw.attempts && raw.attempts[id];
    if (a && Number.isInteger(a.tries) && a.tries > 0) s.attempts[id] = {tries:a.tries,firstCorrect:a.firstCorrect === true,lastAnswer:/^[0-2]$/.test(a.lastAnswer) ? a.lastAnswer : null};
  });
  if (raw.final) {
    s.final.tries = Math.max(0,Math.floor(Number(raw.final.tries) || 0));
    var best = Number(raw.final.best); s.final.best = Number.isInteger(best) ? Math.max(-1,Math.min(3,best)) : -1;
  }
  return s;
}
function loadState() { try { return normalizeState(JSON.parse(localStorage.getItem(STORE_KEY)) || memoryState); } catch(e) { return normalizeState(memoryState); } }
function saveState(s) { memoryState = normalizeState(s); try { localStorage.setItem(STORE_KEY,JSON.stringify(memoryState)); } catch(e) { warnStorage(); } }
function sectionDoneCount(s) { return SECTIONS.filter(function(id){return !!s.done[id];}).length; }
function selfcheckPassedCount(s) { return SECTIONS.filter(function(id){return !!s.quiz[id];}).length; }
function firstPassCount(s) { return SECTIONS.filter(function(id){return s.attempts[id] && s.attempts[id].firstCorrect;}).length; }
function score(s) { return sectionDoneCount(s) + selfcheckPassedCount(s) + (s.final.best >= 3 ? 2 : 0); }
function isGuided() { return pref(GUIDE_KEY) === '1'; }
function isUnlocked(s,idx) { return idx >= 0 && idx < TOTAL_SECTIONS && (!isGuided() || SECTIONS.slice(0,idx).every(function(id){return !!(s.done[id] && s.quiz[id]);})); }
function unlockedCount(s) { var n = 0; while (n < TOTAL_SECTIONS && isUnlocked(s,n)) n++; return n; }
function nextLesson(s) {
  var last = pref(LAST_KEY);
  if (SECTIONS.indexOf(last) >= 0 && isUnlocked(s,SECTIONS.indexOf(last)) && !(s.done[last] && s.quiz[last])) return last;
  return SECTIONS.find(function(id,i){return isUnlocked(s,i) && !(s.done[id] && s.quiz[id]);}) || SECTIONS[0];
}
function toggleGuide() { pref(GUIDE_KEY,isGuided() ? '0' : '1'); renderProgress(); }
function applyGuideToggleUI() { var cb = document.getElementById('guideToggle'); if(cb) cb.checked = isGuided(); }
function renderProgress() {
  var s = loadState(), sc = score(s), pct = Math.round(sc / MAX_SCORE * 100); applyGuideToggleUI();
  var bar = document.getElementById('sideProgBar'); if(bar) bar.style.width = pct + '%';
  var text = document.getElementById('sideProgText'); if(text) text.textContent = sectionDoneCount(s) + ' / 14 节 · ' + pct + '%';
  SECTIONS.forEach(function(id,i){
    var mod = document.getElementById(id); if(!mod) return;
    var unlocked = isUnlocked(s,i); mod.classList.toggle('locked',!unlocked);
    var btn = mod.querySelector('.done-btn');
    if(btn) { btn.classList.toggle('done',!!s.done[id]); btn.classList.toggle('done-win',!!s.quiz[id]); btn.disabled = !unlocked; btn.textContent = s.done[id] ? '✓ 已学完这节 · 点击撤销打卡' : '✓ 我已学完这节'; }
    var box = mod.querySelector('.selfcheck'); if(box) box.classList.toggle('win',!!s.quiz[id]);
    mod.querySelectorAll('input, .btn, .simulator, .btn-run, .btn-copy').forEach(function(el){el.disabled = !unlocked;});
    var overlay = mod.querySelector('.lock-overlay');
    if(overlay) overlay.innerHTML = '<strong>这节课还未解锁</strong><span>完成前面的课程打卡与自测，再来探索这里。</span><a class="btn" href="#' + nextLesson(s) + '">去完成前置课程 →</a>';
    var nav = document.querySelector('.side-nav a[href="#' + id + '"]');
    if(nav) { nav.classList.toggle('completed',!!(s.done[id] && s.quiz[id])); nav.classList.toggle('nav-locked',!unlocked); nav.setAttribute('aria-label',COURSE_META[id][0] + (!unlocked ? '，未解锁' : s.done[id] && s.quiz[id] ? '，已完成' : '')); }
  });
  var resume = document.getElementById('resumeLink'); if(resume) { resume.href = '#' + nextLesson(s); resume.textContent = sc || SECTIONS.indexOf(pref(LAST_KEY)) >= 0 ? '继续学习 →' : '开始第一课 →'; }
  var hint = document.getElementById('resumeHint'); if(hint) hint.textContent = '下一步：' + COURSE_META[nextLesson(s)][0];
  var home = document.getElementById('homeProgress'); if(home) home.textContent = '已学完 ' + sectionDoneCount(s) + ' / 14 节 · 自测通过 ' + selfcheckPassedCount(s) + ' / 14';
  renderReport(s); renderLessonNav(s);
}
function markDone(btn) {
  var id = btn.closest('.module').id, s = loadState(); if(!isUnlocked(s,SECTIONS.indexOf(id))) return;
  s.done[id] = !s.done[id]; saveState(s); renderProgress();
  if(s.done[id]) toast(s.quiz[id] ? '本节已完成，可以进入下一节。' : '已打卡。再完成本节自测，巩固一下。');
}
function resetProgress() {
  if(!confirm('清空这台浏览器中的学习记录？建议先导出备份。')) return;
  saveState({}); pref(LAST_KEY,'');
  document.querySelectorAll('.selfcheck input, .q input').forEach(function(el){el.checked = false;});
  document.querySelectorAll('.sc-feedback, #quizResult').forEach(function(el){el.textContent = '';}); renderProgress(); toast('学习进度已重置。');
}
function checkSC(btn) {
  var box = btn.closest('.selfcheck'), id = box.closest('.module').id, s = loadState(); if(!isUnlocked(s,SECTIONS.indexOf(id))) return;
  var sel = box.querySelector('input:checked'), fb = box.querySelector('.sc-feedback');
  if(!sel) { fb.textContent = '先选一个答案，再检查。'; fb.className = 'sc-feedback wrong'; return; }
  var right = sel.value === box.dataset.answer, a = s.attempts[id] || {tries:0,firstCorrect:false,lastAnswer:null};
  if(a.tries === 0) a.firstCorrect = right; a.tries++; a.lastAnswer = sel.value; s.attempts[id] = a;
  if(right) s.quiz[id] = true;
  fb.textContent = (right ? '✓ 答对了！' : '再想一想。') + ' ' + (box.dataset.explain || ''); fb.className = 'sc-feedback ' + (right ? 'right' : 'wrong');
  saveState(s); renderProgress();
}
var QUIZ = {q1:{ans:'0',tip:'感知、决策、执行：看 → 想 → 动。'},q2:{ans:'1',tip:'正解：角度算位置；逆解：位置反推角度。'},q3:{ans:'1',tip:'P 看当前误差；I 看累计误差；D 看误差变化。'}};
function checkQuiz() {
  var el = document.getElementById('quizResult'), missing = Object.keys(QUIZ).filter(function(name){return !document.querySelector('input[name="' + name + '"]:checked');});
  if(missing.length) { el.textContent = '还有 ' + missing.length + ' 道题未选择答案，完成后再提交。'; return; }
  var got = 0, wrong = [];
  Object.keys(QUIZ).forEach(function(name){if(document.querySelector('input[name="' + name + '"]:checked').value === QUIZ[name].ans) got++; else wrong.push(QUIZ[name].tip);});
  el.innerHTML = '<p class="' + (got === 3 ? 'good' : 'bad') + '">' + (got === 3 ? '✓ 满分！去实验室完成一个挑战，检验你的理解。' : '本次答对 ' + got + ' / 3。可以回到对应课程再试一次。') + '</p>' + (wrong.length ? '<ul>' + wrong.map(function(w){return '<li>' + escapeHtml(w) + '</li>';}).join('') + '</ul>' : '<a class="btn" href="#lab">进入实验室 →</a>');
  var s = loadState(); s.final.tries++; s.final.best = Math.max(s.final.best,got); saveState(s); renderProgress();
}
function renderReport(s) {
  var box = document.getElementById('reportContent'); if(!box) return;
  var done = sectionDoneCount(s), passed = selfcheckPassedCount(s), complete = done === 14 && passed === 14 && s.final.best === 3;
  box.innerHTML = '<p class="report-status">' + (complete ? '✓ 全部课程已完成' : done || passed ? '正在进步，继续探索。' : '从第一课开始，记录每一点进步。') + '</p><div class="report-grid">' +
    [[done,'已学完 / 14'],[passed,'自测通过 / 14'],[s.final.best < 0 ? '—' : s.final.best,'结业最佳 / 3']].map(function(a){return '<div class="report-cell"><span class="rn">' + a[0] + '</span><span class="rl">' + a[1] + '</span></div>';}).join('') +
    '</div><p class="report-hint">首次答对 ' + firstPassCount(s) + ' 题 · 学习得分 ' + score(s) + ' / 30。重试也能掌握知识，已经通过的自测会保留。</p><p class="report-hint">' + (isGuided() ? '闯关模式：已解锁前 ' + unlockedCount(s) + ' 节，按顺序完成打卡与自测。' : '自由模式：所有课程与实验都可以随时探索。') + '</p><div class="course-records">' +
    SECTIONS.map(function(id,i){var a = s.attempts[id], status = s.done[id] && s.quiz[id] ? '已完成' : s.done[id] ? '待自测' : s.quiz[id] ? '待打卡' : '未开始';return '<a href="#' + id + '"><span>' + (i < 4 ? '0.' + (i + 1) : i - 3) + ' ' + COURSE_META[id][0] + '</span><small>' + status + (a ? ' · 尝试 ' + a.tries + ' 次' : '') + '</small></a>';}).join('') + '</div>';
}
function exportProgress() {
  var data = {type:'embodied-learning-progress',version:3,savedAt:new Date().toISOString(),state:loadState(),guided:isGuided(),last:pref(LAST_KEY)};
  var url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})), a = document.createElement('a');
  a.href = url; a.download = '具身智能-学习进度.json'; a.hidden = true; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){URL.revokeObjectURL(url);},1000);
}
function importProgress(input) {
  var file = input.files && input.files[0]; if(!file) return;
  if(file.size > 1048576) { toast('请选择小于 1MB 的学习进度 JSON 文件。'); input.value = ''; return; }
  var reader = new FileReader();
  reader.onload = function(){try{
    var data = JSON.parse(reader.result);
    function record(value){return value && typeof value === 'object' && !Array.isArray(value);}
    if(data.type !== 'embodied-learning-progress' || data.version !== 3 || !record(data.state) || !record(data.state.done) || !record(data.state.quiz) || !record(data.state.final) || !Number.isInteger(data.state.final.best) || data.state.final.best < -1 || data.state.final.best > 3 || !Number.isInteger(data.state.final.tries) || data.state.final.tries < 0) throw new Error('格式不匹配');
    if(!confirm('用这份备份替换当前学习进度？')) return;
    saveState(data.state); pref(GUIDE_KEY,data.guided ? '1' : '0'); pref(LAST_KEY,SECTIONS.indexOf(data.last) >= 0 ? data.last : ''); restoreAnswers(); renderProgress(); toast('学习进度已恢复。');
  } catch(e){toast('无法导入。请选择本网站导出的学习进度 JSON 文件。');} finally{input.value = '';}};
  reader.onerror = function(){toast('文件读取失败，请重新选择。');input.value = '';}; reader.readAsText(file,'UTF-8');
}
function restoreAnswers() {
  var s = loadState(); SECTIONS.forEach(function(id){
    var box = document.querySelector('#' + id + ' .selfcheck'); if(!box) return;
    box.querySelectorAll('input').forEach(function(el){el.checked = !!s.attempts[id] && el.value === s.attempts[id].lastAnswer;});
    var fb = box.querySelector('.sc-feedback'); fb.textContent = s.quiz[id] ? '✓ 本节自测已通过，可继续复习。' : ''; fb.className = 'sc-feedback' + (s.quiz[id] ? ' right' : '');
  }); var r = document.getElementById('quizResult'); if(r) r.textContent = '';
}
function route(id,scroll) {
  var target = document.getElementById(id); if(!target || !target.classList.contains('module')) id = 'roadmap'; currentPage = id;
  var lesson = SECTIONS.indexOf(id) >= 0;
  document.querySelectorAll('main > .module').forEach(function(el){el.hidden = !(readingAll || el.id === id);});
  var hero = document.getElementById('homeHero'); if(hero) hero.hidden = id !== 'roadmap' && !readingAll;
  ['lessonTools','lessonNav'].forEach(function(k){var el = document.getElementById(k);if(el) el.hidden = !lesson;});
  if(lesson && isUnlocked(loadState(),SECTIONS.indexOf(id))) pref(LAST_KEY,id);
  document.title = (COURSE_META[id] ? COURSE_META[id][0] : {roadmap:'学习地图',report:'学习报告',lab:'互动实验室',resources:'资料库','quiz-panel':'结业测验'}[id]) + ' · 具身智能学习系统';
  closeSidebar(); renderProgress(); highlightNav();
  if(scroll !== false) {
    if(readingAll) document.getElementById(id).scrollIntoView(); else window.scrollTo(0,0);
    var h = document.querySelector('#' + id + ' h2'); if(h) {h.tabIndex = -1;h.focus({preventScroll:true});}
  }
}
function toggleReading() {
  readingAll = !readingAll; pref(VIEW_KEY,readingAll ? 'all' : 'single');
  var b = document.getElementById('readingToggle'); if(b) {b.textContent = readingAll ? '切换单课阅读' : '展开全部课程';b.setAttribute('aria-pressed',String(readingAll));}
  route(currentPage,false); if(readingAll) document.getElementById(currentPage).scrollIntoView();
}
function renderLessonNav(s) {
  var i = SECTIONS.indexOf(currentPage), box = document.getElementById('lessonNav'); if(i < 0 || !box) return;
  document.getElementById('lessonPosition').textContent = (i < 4 ? '前置基础' : '核心课程') + ' · 第 ' + (i + 1) + ' / 14 课 · 约 ' + COURSE_META[currentPage][1] + ' 分钟';
  box.innerHTML = '<a class="btn btn-secondary" href="#' + (i ? SECTIONS[i-1] : 'roadmap') + '">← ' + (i ? '上一节' : '学习地图') + '</a>' + (i === 13 ? '<a class="btn" href="#quiz-panel">结业测验 →</a>' : isUnlocked(s,i+1) ? '<a class="btn" href="#' + SECTIONS[i+1] + '">下一节 →</a>' : '<span class="next-hint">完成打卡和自测后解锁下一节</span>');
}
function highlightNav() {
  var id = currentPage;
  if(readingAll) document.querySelectorAll('main > .module').forEach(function(el){if(el.getBoundingClientRect().top <= 140) id = el.id;});
  document.querySelectorAll('.nav-item').forEach(function(a){var active = a.getAttribute('href') === '#' + id;a.classList.toggle('active',active);if(active) a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
}
function toggleSidebar() {
  var open = !document.getElementById('sidebar').classList.contains('open'); document.getElementById('sidebar').classList.toggle('open',open); document.getElementById('sidebarBackdrop').classList.toggle('open',open);
  document.querySelector('.hamburger').setAttribute('aria-expanded',String(open)); document.body.classList.toggle('sidebar-visible',open); if(open) document.querySelector('.side-nav a').focus();
}
function closeSidebar() {
  var sb = document.getElementById('sidebar'), bd = document.getElementById('sidebarBackdrop'); if(sb) sb.classList.remove('open'); if(bd) bd.classList.remove('open');
  var b = document.querySelector('.hamburger'); if(b) b.setAttribute('aria-expanded','false'); document.body.classList.remove('sidebar-visible');
}
function openSim(key) {
  if(!SIM_MAP[key]) return; lastModalFocus = document.activeElement;
  var frame = document.getElementById('simFrame'); document.getElementById('simTitle').textContent = SIM_INFO[key][0]; document.getElementById('simStandalone').href = SIM_MAP[key];
  frame.title = SIM_INFO[key][0]; frame.src = SIM_MAP[key]; document.getElementById('simModal').style.display = 'block'; document.body.classList.add('modal-visible');
  document.querySelectorAll('main, .sidebar, .hamburger').forEach(function(el){el.inert = true;}); document.querySelector('.modal-close').focus();
}
function closeSim() {
  var modal = document.getElementById('simModal'); if(!modal || modal.style.display !== 'block') return;
  modal.style.display = 'none'; document.getElementById('simFrame').src = 'about:blank'; document.body.classList.remove('modal-visible');
  document.querySelectorAll('main, .sidebar, .hamburger').forEach(function(el){el.inert = false;}); if(lastModalFocus && lastModalFocus.isConnected) lastModalFocus.focus();
}
function trapFocus(e,box) {
  var all = Array.prototype.filter.call(box.querySelectorAll('a[href],button,input,select,iframe'),function(el){return !el.disabled && el.getBoundingClientRect().width > 0;}); if(!all.length) return;
  if(e.shiftKey && document.activeElement === all[0]) {e.preventDefault();all[all.length-1].focus();} else if(!e.shiftKey && document.activeElement === all[all.length-1]) {e.preventDefault();all[0].focus();}
}
function copyCode(btn) {
  var value = btn.closest('.code-demo').querySelector('pre code').textContent;
  function done(){btn.textContent = '✓ 已复制';setTimeout(function(){btn.textContent = '复制';},1800);}
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(value).then(done,function(){fallbackCopy(value,done);}); else fallbackCopy(value,done);
}
function fallbackCopy(value,done) {
  var ta = document.createElement('textarea');ta.value = value;ta.style.position = 'fixed';ta.style.opacity = '0';document.body.appendChild(ta);ta.select();
  try{if(document.execCommand('copy')) done();else toast('无法自动复制，请选中代码后复制。');}catch(e){toast('无法自动复制，请选中代码后复制。');}ta.remove();
}
function pyToJs(code){return DemoRuntime.pyToJs(code);}
function convertLine(line){return DemoRuntime.convertLine(line);}
function runCode(btn) {
  if(btn.disabled) return;
  var demo = btn.closest('.code-demo'), output = demo.querySelector('.code-output'), code = demo.querySelector('pre code').textContent;
  output.style.display = 'block';output.textContent = '正在运行…';btn.disabled = true;
  var worker = null,timer = null,settled = false;
  function finish(r){if(settled) return;settled = true;clearTimeout(timer);if(worker) worker.terminate();btn.disabled = demo.closest('.module').classList.contains('locked');output.textContent = r.error ? '运行出错：' + r.error : r.logs.join('\n') || '代码已执行，没有输出。';output.classList.toggle('code-error',!!r.error);}
  function local(){try{finish({logs:DemoRuntime.execute(code)});}catch(e){finish({error:e.message});}}
  if(location.protocol === 'file:' || typeof Worker === 'undefined'){local();return;}
  try{worker = new Worker('js/demo-worker.js');worker.onmessage = function(e){finish(e.data);};worker.onerror = function(e){e.preventDefault();local();};timer = setTimeout(function(){finish({error:'运行超时，请重新打开本节后再试。'});},4000);worker.postMessage({code:code});}catch(e){local();}
}
function renderLab() {
  var box = document.getElementById('labGrid');if(!box) return;
  box.innerHTML = Object.keys(SIM_MAP).map(function(key){var a = SIM_INFO[key];return '<article class="lab-card" data-category="' + a[1] + '"><span class="lab-type">' + a[1] + '</span><h3>' + a[0] + '</h3><p>' + a[2] + '</p><div class="lab-actions"><button class="btn btn-sm" data-sim="' + key + '">开始实验 ↗</button><a href="#' + a[3] + '">相关课程</a></div></article>';}).join('');
  box.querySelectorAll('[data-sim]').forEach(function(b){b.addEventListener('click',function(){openSim(b.dataset.sim);});});
}
function filterLab(button) {
  document.querySelectorAll('#labFilters button').forEach(function(b){b.setAttribute('aria-pressed',String(b === button));});
  document.querySelectorAll('.lab-card').forEach(function(card){card.hidden = button.dataset.filter !== '全部' && card.dataset.category !== button.dataset.filter;});
}
function renderResources() {
  var box = document.getElementById('resourceList');if(!box || typeof RESOURCE_DATA === 'undefined') return;
  var q = document.getElementById('resourceSearch').value.trim().toLowerCase(), type = document.getElementById('resourceType').value;
  var items = RESOURCE_DATA.filter(function(a){return (type === '全部' || a.type === type) && (a.name + a.type).toLowerCase().indexOf(q) >= 0;});
  document.getElementById('resourceCount').textContent = items.length + ' 份资料';
  box.innerHTML = items.length ? items.map(function(a){return '<a class="resource-item" href="' + encodeURI(a.url) + '" target="_blank" rel="noopener"><span class="resource-type">' + a.type + '</span><span class="resource-name">' + escapeHtml(a.name) + '</span><small>' + a.size + ' MB · ' + a.ext + '</small><span aria-hidden="true">↗</span></a>';}).join('') : '<p class="empty-state">没有找到这份资料。换一个关键词，或选择“全部”类型。</p>';
}
function initHero() {
  var slider = document.getElementById('heroAngle');if(!slider) return;
  function draw(){var angle = Number(slider.value), x = 75 + 122*Math.cos(angle*Math.PI/180), y = 178-122*Math.sin(angle*Math.PI/180);document.getElementById('heroLink').setAttribute('x2',x);document.getElementById('heroLink').setAttribute('y2',y);document.getElementById('heroJoint').setAttribute('cx',x);document.getElementById('heroJoint').setAttribute('cy',y);document.getElementById('heroAngleValue').textContent = angle + '°';document.getElementById('heroXY').textContent = 'X ' + Math.round(x-75) + ' / Y ' + Math.round(178-y);}
  slider.addEventListener('input',draw);draw();
}
document.addEventListener('keydown',function(e){
  var modal = document.getElementById('simModal'), sb = document.getElementById('sidebar');
  if(e.key === 'Escape'){if(modal && modal.style.display === 'block') closeSim();else if(sb && sb.classList.contains('open')){closeSidebar();document.querySelector('.hamburger').focus();}}
  if(e.key === 'Tab'){if(modal && modal.style.display === 'block') trapFocus(e,modal);else if(sb && sb.classList.contains('open') && window.innerWidth <= MOBILE_MAX) trapFocus(e,sb);}
});
window.addEventListener('message',function(e){var f = document.getElementById('simFrame');if(f && e.source === f.contentWindow && e.data && e.data.type === 'close-simulator') closeSim();});
window.addEventListener('scroll',highlightNav,{passive:true});
window.addEventListener('resize',function(){if(window.innerWidth > MOBILE_MAX) closeSidebar();});
window.addEventListener('hashchange',function(){var id=location.hash.slice(1);if(id==='mainContent'){document.getElementById(id).focus();document.getElementById(id).scrollIntoView();return;}route(id,true);});
window.addEventListener('load',function(){
  document.querySelectorAll('.selfcheck .sc-feedback, #quizResult').forEach(function(el){el.setAttribute('role','status');el.setAttribute('aria-live','polite');});
  SECTIONS.forEach(function(id){var mod = document.getElementById(id), meta = COURSE_META[id];if(!mod) return;var goal = document.createElement('div');goal.className = 'lesson-goal';goal.innerHTML = '<span>本节目标 · 约 ' + meta[1] + ' 分钟</span><p>' + meta[2] + '</p>';mod.querySelector('h2').after(goal);mod.querySelectorAll('.code-output').forEach(function(el){el.setAttribute('role','status');el.setAttribute('aria-live','polite');});});
  document.querySelectorAll('.side-nav .nav-item').forEach(function(a){a.addEventListener('click',function(){if(window.innerWidth <= MOBILE_MAX) closeSidebar();if(a.hash === location.hash) route(a.hash.slice(1),true);});});
  document.getElementById('simModal').addEventListener('click',function(e){if(e.target === this) closeSim();});
  readingAll = pref(VIEW_KEY) === 'all';var b = document.getElementById('readingToggle');b.textContent = readingAll ? '切换单课阅读' : '展开全部课程';b.setAttribute('aria-pressed',String(readingAll));
  renderLab();renderResources();initHero();restoreAnswers();renderProgress();route(location.hash.slice(1) || 'roadmap',false);
});
