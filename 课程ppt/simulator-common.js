(function(){
  'use strict';
  function setValues(values){
    Object.keys(values).forEach(function(id){var el=document.getElementById(id);if(el){el.value=values[id];el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}});
  }
  function setup(){
    var type=document.body.dataset.simulator;
    document.addEventListener('keydown',function(e){if(e.key==='Escape' && window.parent!==window) window.parent.postMessage({type:'close-simulator'},'*');});
    var place=document.querySelector('.control-panel, .controls, #infoPanel, .simulator-panel, .config, .controls-container') || document.querySelector('body > .panel:last-of-type') || document.body;
    var tasks={
      linkage:['动手挑战','先预测：连杆长 150、角度 90° 时，X 与 Y 各是多少？调整滑杆验证，再试 0° 和 −90°。'],
      linkage2:['动手挑战','改变角度，观察投影的长度与正负。试着解释 90° 时哪个方向的投影为零。'],
      twoLink:['动手挑战','让两根连杆伸直，再让第二关节转 180°。末端会到哪里？'],
      arm2d:['动手挑战','先让三个关节角度都为 0°，预测末端坐标，再改变一个关节。'],
      arm3d:['动手挑战','拖动画面旋转视角；改变基座与一个关节。手机上可收起参数，留出完整画面。'],
      matrix:['动手挑战','比较旋转矩阵、平移向量与最终位置，找出每个参数对应的图形变化。'],
      transform:['动手挑战','先旋转 90°，再增加 X 平移量，观察坐标和图形如何对应。'],
      coord:['动手挑战','改变一个坐标系的角度，观察局部向量与全局向量是否一起变化。'],
      motor:['动手挑战','先单步换向，找出每一步哪两相通电。完成一轮后再运行。'],
      stepper:['动手挑战','比较三种模式：半步模式每一步转多少度？单步观察通电线圈和转子。'],
      color:['动手挑战','先保留红苹果，再选择蓝色背景。白色像素表示通过阈值筛选。'],
      uart:['动手挑战','输入 A，观察它的数据位；打开偶校验，比较多出的校验位。只支持标准 ASCII 字符。'],
      pid:['动手挑战','比较 P、PI、PID 预设的超调与最终误差。改变参数后点击“开始模拟”。']
    };
    var task=tasks[type];
    if(task){var hint=document.createElement('div');hint.className='sim-help';hint.innerHTML='<strong>'+task[0]+'</strong>'+task[1];place.appendChild(hint);}
    var ranges=[].slice.call(document.querySelectorAll('input[type=range], input[type=number]'));
    var defaults={};ranges.forEach(function(el){defaults[el.id]=el.value;});
    if(type!=='pid' && type!=='stepper' && type!=='motor' && ranges.length){
      var reset=document.createElement('button');reset.type='button';reset.className='sim-reset';reset.textContent='恢复初始参数';reset.addEventListener('click',function(){setValues(defaults);});place.appendChild(reset);
    }
    var presets={
      linkage:[['0° · 沿 X 轴',{theta1:0}],['90° · 沿 Y 轴',{theta1:90}],['−90° · 向下',{theta1:-90}]],
      arm2d:[['伸直',{angle1:0,angle2:0,angle3:0}],['折叠',{angle1:30,angle2:90,angle3:-90}]],
      twoLink:[['伸直',{theta1:0,theta2:0}],['直角',{theta1:0,theta2:90}]],
      color:[['红苹果',{h1:170,h2:10,s:100,v:100}],['绿叶',{h1:35,h2:85,s:100,v:50}],['蓝背景',{h1:90,h2:130,s:100,v:50}]]
    };
    if(presets[type]){var row=document.createElement('div');row.className='sim-presets';presets[type].forEach(function(p){var b=document.createElement('button');b.type='button';b.textContent=p[0];b.addEventListener('click',function(){setValues(p[1]);});row.appendChild(b);});place.appendChild(row);}
    // Label any slider that previously relied solely on nearby visual text.
    document.querySelectorAll('input[type=range]').forEach(function(el){
      if(!el.id) return;
      if(!document.querySelector('label[for="'+el.id+'"]')){
        var label=el.previousElementSibling;
        if(label && label.tagName==='LABEL') label.htmlFor=el.id;
        else if(el.id.endsWith('_slider')){var own=document.querySelector('label[for="'+el.id.replace('_slider','')+'"]');el.setAttribute('aria-label',own ? own.textContent : '调整参数');}
        else el.setAttribute('aria-label',el.id);
      }
    });
    var toggle=document.getElementById('panelToggle');
    if(toggle) toggle.addEventListener('click',function(){var closed=document.body.classList.toggle('panel-collapsed');toggle.textContent=closed?'展开参数':'收起参数';toggle.setAttribute('aria-expanded',String(!closed));window.dispatchEvent(new Event('resize'));});
    // Preserve valid values while a number field is temporarily empty.
    document.querySelectorAll('input[type=number]').forEach(function(el){
      var previous=el.value;
      el.addEventListener('change',function(){
        var n=Number(el.value);
        if(el.value.trim()==='' || !Number.isFinite(n)){el.value=previous;}
        else {if(el.min!=='') n=Math.max(Number(el.min),n);if(el.max!=='') n=Math.min(Number(el.max),n);el.value=String(n);previous=el.value;}
        el.dispatchEvent(new Event('input',{bubbles:true}));
      });
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',setup);else setup();
})();
