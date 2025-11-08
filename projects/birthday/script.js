(() => {
  const BDAY = "2025-11-10";
  const RECIPIENT_OFFSET = 4;
  const OFFSETS = [];
  for (let o=14; o>=-12; o--) OFFSETS.push(o);
  const ZONES = OFFSETS.slice(0,24); 

  const tzLabel = document.getElementById('tzLabel');
  const countdown = document.getElementById('countdown');
  const status = document.getElementById('status');
  const openFull = document.getElementById('openFull');
  const overlayAnim = document.getElementById('overlayAnim');
  const bgMusic = document.getElementById('bgMusic');
  const openSfx = document.getElementById('openSfx');
  const muteBtn = document.getElementById('muteBtn');
  const forceMusicBtn = document.getElementById('forceMusicBtn');
  const testGiftBtn = document.getElementById('testGiftBtn');

  let muted = false;
  muteBtn.addEventListener('click', () => {
    muted = !muted;
    bgMusic.muted = muted;
    openSfx.muted = muted;
    muteBtn.textContent = muted ? '🔇' : '🔊';
  });

  function tryPlayMusic(){
    if (!bgMusic) return;
    bgMusic.volume = 0.28;
    bgMusic.play().catch(()=>{});
  }

  forceMusicBtn.addEventListener('click', () => {
    tryPlayMusic();
    alert('Background music forced to play!');
  });

  // test gift button
  testGiftBtn.addEventListener('click', () => {
    const giftList = ZONES.map((tz,i)=>`Gift ${i+1} (UTC${tz>=0?'+'+tz:tz})`).join('\n');
    const selected = prompt(`Testing: choose gift number to open:\n\n${giftList}`);
    const idx = parseInt(selected)-1;
    if (isNaN(idx) || idx<0 || idx>=ZONES.length){alert('Invalid number'); return;}
    window.location.href = `gifts/gift${String(idx+1).padStart(2,'0')}.html`;
  });

  function utcMidnightMsFor(dateStr){ const [y,m,d] = dateStr.split('-').map(Number); return Date.UTC(y,m-1,d,0,0,0);}
  function unlockUTCmsForZone(dateStr, tzOffset){ return utcMidnightMsFor(dateStr)-(tzOffset*3600*1000);}
  function openedKey(i){ return `tzgift_opened_${i}`; }
  function markOpened(i){ localStorage.setItem(openedKey(i),'1'); }
  function isOpened(i){ return localStorage.getItem(openedKey(i))==='1'; }
  function nextIndexToShow(){ for(let i=0;i<ZONES.length;i++){if(!isOpened(i))return i;} return -1;}
  function fmtHMS(ms){if(ms<0)ms=0;const s=Math.floor(ms/1000);const h=Math.floor(s/3600);const m=Math.floor((s%3600)/60);const sec=s%60;return [h,m,sec].map(n=>String(n).padStart(2,'0')).join(':');}
  function localStringFromUTCms(utcMs, offsetHours){ const d=new Date(utcMs+offsetHours*3600*1000); const Y=d.getUTCFullYear(); const M=String(d.getUTCMonth()+1).padStart(2,'0'); const D=String(d.getUTCDate()).padStart(2,'0'); const hh=String(d.getUTCHours()).padStart(2,'0'); const mm=String(d.getUTCMinutes()).padStart(2,'0'); return `${Y}-${M}-${D} ${hh}:${mm}`;}

  let currentIndex = nextIndexToShow();
  function updateUI(){
    currentIndex = nextIndexToShow();
    if(currentIndex===-1){tzLabel.textContent="All gifts unlocked";countdown.textContent="—";status.textContent="💖 You’ve opened every gift — happy birthday!";openFull.classList.add('hidden');return;}
    const tzOffset = ZONES[currentIndex];
    tzLabel.textContent = `UTC${tzOffset>=0?'+'+tzOffset:tzOffset}`;
    const unlockUTC = unlockUTCmsForZone(BDAY,tzOffset);
    const now = Date.now();
    const timeLeft = unlockUTC-now;
    if(timeLeft<=0){countdown.textContent="00:00:00";status.textContent="💌 Your gift is ready. Tap anywhere to open.";openFull.classList.remove('hidden');openFull.setAttribute('aria-hidden','false');}
    else{countdown.textContent=fmtHMS(timeLeft); const recLocal=localStringFromUTCms(unlockUTC,RECIPIENT_OFFSET); status.textContent=`Unlocks at recipient local ${recLocal}`; openFull.classList.add('hidden');openFull.setAttribute('aria-hidden','true');}
  }

  updateUI();
  setInterval(updateUI,900);

  openFull.addEventListener('click',()=>{tryPlayMusic(); openFull.classList.add('hidden'); overlayAnim.classList.remove('hidden'); const envelope=overlayAnim.querySelector('.envelope'); setTimeout(()=>{envelope.classList.add('open'); try{if(!muted)openSfx.play().catch(()=>{});}catch(e){}},160); const idx=currentIndex; if(idx>=0)markOpened(idx); setTimeout(()=>{overlayAnim.classList.add('hidden'); const giftNumber=String(idx+1).padStart(2,'0'); const url=`gifts/gift${giftNumber}.html`; window.location.href=url;},2200);});
  tryPlayMusic();
  document.addEventListener('click',(ev)=>{if(!openFull.classList.contains('hidden')&&!ev.target.closest('.control-btn')){openFull.click();}});
})();
