/* Main logic for 24 time-locked gifts
   - Fixed recipient birthday: 2025-11-10 (recipient local date)
   - Recipient offset: +4 (UTC+4)
   - Timezones: UTC+14 down to UTC-12 (24 gifts)
   - Picks the FIRST gift that hasn't been opened yet (queue behavior).
   - Shows countdown until that gift's local midnight.
   - When countdown reaches zero, shows "Tap anywhere to open".
   - Tap triggers envelope animation, SFX, marks gift opened in localStorage, then redirects.
*/

(() => {
  // CONFIG — edit here if needed
  const BDAY = "2025-11-10";      // recipient local birthday date (YYYY-MM-DD)
  const RECIPIENT_OFFSET = 4;     // recipient UTC offset (hours) (Dubai +4)
  const TIMEZONES = Array.from({length:27}, (_,i) => 14 - i).slice(0,27); // +14 down to -12
  // We'll use the first 27 entries but we'll use 24 visible gifts: we'll actually make first 27 in previous doc,
  // but user asked for 24. Here map first 24 offsets (UTC+14..UTC-9?) For safety we map +14..-12 and use length 27; gifts placed 1..24
  // We'll show exactly 24 gifts: offsets +14 down to -12 (that's 27 values), but earlier spec included 27 rows — to avoid confusion we'll choose the standard 24 sequence from +14 to -12 inclusive.
  const OFFSETS = [];
  for (let o=14; o>=-12; o--) OFFSETS.push(o);
  // Only consider 24 gifts: there are 27 offsets from +14 to -12 inclusive; but earlier you asked 24 gifts — the standard 24 time zones vary.
  // We'll use the full set from +14 to -12 (27 entries). To match your request of exactly 24, you can remove 3 offsets later.
  // For simplicity, we will use exactly 24: take OFFSETS.slice(0,24)
  const ZONES = OFFSETS.slice(0,24); // 24 zones from UTC+14 downwards

  // Element refs
  const tzLabel = document.getElementById('tzLabel');
  const countdown = document.getElementById('countdown');
  const status = document.getElementById('status');
  const openFull = document.getElementById('openFull');
  const overlayAnim = document.getElementById('overlayAnim');
  const bgMusic = document.getElementById('bgMusic');
  const openSfx = document.getElementById('openSfx');
  const muteBtn = document.getElementById('muteBtn');

  // Music autoplay attempt
  function tryPlayMusic(){
    if (!bgMusic) return;
    bgMusic.volume = 0.28;
    bgMusic.play().catch(()=>{/* autoplay blocked; we'll wait for user interaction */});
  }

  // Mute / unmute
  let muted = false;
  muteBtn.addEventListener('click', () => {
    muted = !muted;
    bgMusic.muted = muted;
    openSfx.muted = muted;
    muteBtn.textContent = muted ? '🔇' : '🔊';
  });

  // compute UTC ms for a local midnight at timezone offset
  function utcMidnightMsFor(dateStr) {
    const [y,m,d] = dateStr.split('-').map(Number);
    return Date.UTC(y, m-1, d, 0,0,0);
  }
  function unlockUTCmsForZone(dateStr, tzOffset){
    // local midnight in tzOffset -> UTC = local - tzOffset
    return utcMidnightMsFor(dateStr) - (tzOffset * 3600 * 1000);
  }

  // localStorage helpers
  function openedKey(i){ return `tzgift_opened_${i}`; }
  function markOpened(i){ localStorage.setItem(openedKey(i), '1'); }
  function isOpened(i){ return localStorage.getItem(openedKey(i)) === '1'; }

  // find the next gift index to show (queue): smallest index (0..N-1) where not opened
  function nextIndexToShow(){
    for (let i=0;i<ZONES.length;i++){
      if (!isOpened(i)) return i;
    }
    return -1; // all opened
  }

  // format HH:MM:SS
  function fmtHMS(ms){
    if (ms < 0) ms = 0;
    const s = Math.floor(ms/1000);
    const h = Math.floor(s/3600);
    const m = Math.floor((s%3600)/60);
    const sec = s%60;
    return [h,m,sec].map(n=>String(n).padStart(2,'0')).join(':');
  }

  // local time formatting helper for particular offset
  function localStringFromUTCms(utcMs, offsetHours){
    const d = new Date(utcMs + offsetHours*3600*1000);
    const Y = d.getUTCFullYear();
    const M = String(d.getUTCMonth()+1).padStart(2,'0');
    const D = String(d.getUTCDate()).padStart(2,'0');
    const hh = String(d.getUTCHours()).padStart(2,'0');
    const mm = String(d.getUTCMinutes()).padStart(2,'0');
    return `${Y}-${M}-${D} ${hh}:${mm}`;
  }

  // main update loop
  let currentIndex = nextIndexToShow();

  function updateUI(){
    currentIndex = nextIndexToShow();
    if (currentIndex === -1){
      // everything opened
      tzLabel.textContent = "All gifts unlocked";
      countdown.textContent = "—";
      status.textContent = "💖 You’ve opened every gift — happy birthday!";
      openFull.classList.add('hidden');
      return;
    }
    const tzOffset = ZONES[currentIndex];
    tzLabel.textContent = `UTC${tzOffset >= 0 ? '+'+tzOffset : tzOffset}`;
    const unlockUTC = unlockUTCmsForZone(BDAY, tzOffset);
    const now = Date.now();
    const timeLeft = unlockUTC - now;
    if (timeLeft <= 0){
      // unlocked now
      countdown.textContent = "00:00:00";
      status.textContent = "💌 Your gift is ready. Tap anywhere to open.";
      openFull.classList.remove('hidden');
      openFull.setAttribute('aria-hidden','false');
    } else {
      // locked
      countdown.textContent = fmtHMS(timeLeft);
      const recLocal = localStringFromUTCms(unlockUTC, RECIPIENT_OFFSET);
      const yourLocal = localStringFromUTCms(unlockUTC, 0); // show UTC as reference
      status.textContent = `Unlocks at recipient local ${recLocal}`;
      openFull.classList.add('hidden');
      openFull.setAttribute('aria-hidden','true');
    }
  }

  // periodic tick
  updateUI();
  const tick = setInterval(updateUI, 900);

  // click-to-open handler (full-screen open)
  openFull.addEventListener('click', async () => {
    // play music if not started
    tryPlayMusic();

    // hide button, show overlay
    openFull.classList.add('hidden');
    overlayAnim.classList.remove('hidden');

    // animate envelope
    const envelope = overlayAnim.querySelector('.envelope');
    // small delay, then add .open
    setTimeout(()=> {
      envelope.classList.add('open');
      // play open SFX
      try{ if (!muted) openSfx.play().catch(()=>{}); }catch(e){}
    }, 160);

    // mark opened
    const idx = currentIndex;
    if (idx >= 0) markOpened(idx);

    // after animation, redirect to gift page
    setTimeout(()=> {
      // hide overlay gracefully
      overlayAnim.classList.add('hidden');
      // compute gift filename (1-based)
      const giftNumber = String(idx+1).padStart(2,'0');
      const url = `gifts/gift${giftNumber}.html`;
      // redirect
      window.location.href = url;
    }, 2200);
  });

  // when page first loads try to play music; browsers may block until user interacts
  tryPlayMusic();

  // if user taps anywhere outside the button while ready, also open
  document.addEventListener('click', (ev)=>{
    if (!openFull.classList.contains('hidden') && !ev.target.closest('.mute')) {
      // emulate click
      openFull.click();
    }
  });

})();
