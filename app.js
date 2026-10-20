const audio = document.querySelector('#audio');
const fileInput = document.querySelector('#fileInput');
const uploadButton = document.querySelector('#uploadButton');
const changeFileButton = document.querySelector('#changeFileButton');
const playButton = document.querySelector('#playButton');
const seekSlider = document.querySelector('#seekSlider');
const speedInput = document.querySelector('#speedInput');
const speedButtons = [...document.querySelectorAll('#speedPresets button')];
const waveform = document.querySelector('#waveform');
const waveformBars = document.querySelector('#waveformBars');
const dropZone = document.querySelector('#dropZone');
const toast = document.querySelector('#toast');
const installButton = document.querySelector('#installButton');
let objectUrl = '';
let toastTimer;
let deferredInstallPrompt;
let seeking = false;
let loopStart = null;
let loopEnd = null;
let loopEnabled = false;

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const wholeSeconds = Math.floor(seconds);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainder = wholeSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function createWaveform() {
  waveformBars.replaceChildren();
  const count = Math.max(45, Math.min(84, Math.floor(waveform.clientWidth / 5)));
  let seed = 271828;
  for (let index = 0; index < count; index += 1) {
    seed = (seed * 9301 + 49297) % 233280;
    const height = 5 + (seed / 233280) * 28;
    const bar = document.createElement('span');
    bar.className = 'wave-bar';
    bar.style.height = `${height}px`;
    waveformBars.append(bar);
  }
  updateWaveform();
}

function updateWaveform() {
  const progress = audio.duration ? audio.currentTime / audio.duration : 0;
  const playedCount = Math.round(progress * waveformBars.children.length);
  [...waveformBars.children].forEach((bar, index) => {
    bar.classList.toggle('played', index < playedCount);
  });
}

function updateProgress() {
  if (!seeking && Number.isFinite(audio.duration)) {
    const progress = audio.duration ? audio.currentTime / audio.duration : 0;
    seekSlider.value = String(Math.round(progress * 1000));
    seekSlider.style.setProperty('--seek', `${progress * 100}%`);
    document.querySelector('#currentTime').textContent = formatTime(audio.currentTime);
    updateWaveform();
  }
}

function updateLoopUI(message) {
  const hasAudio = Boolean(audio.src);
  const hasStart = loopStart !== null;
  const hasRange = hasStart && loopEnd !== null && loopEnd > loopStart;
  document.querySelector('#setLoopStartButton').disabled = !hasAudio;
  document.querySelector('#setLoopEndButton').disabled = !hasAudio || !hasStart;
  document.querySelector('#clearLoopButton').disabled = !hasStart && loopEnd === null;
  const loopToggle = document.querySelector('#loopToggle');
  loopToggle.disabled = !hasRange;
  loopToggle.classList.toggle('active', loopEnabled);
  loopToggle.setAttribute('aria-pressed', String(loopEnabled));
  loopToggle.textContent = loopEnabled ? '반복 중' : '반복 꺼짐';
  document.querySelector('#loopStartValue').textContent = `A · ${loopStart === null ? '--:--' : formatTime(loopStart)}`;
  document.querySelector('#loopEndValue').textContent = `B · ${loopEnd === null ? '--:--' : formatTime(loopEnd)}`;
  const status = message || (loopEnabled
    ? `A ${formatTime(loopStart)}부터 B ${formatTime(loopEnd)}까지 반복 재생 중이에요.`
    : hasRange
      ? `A ${formatTime(loopStart)} — B ${formatTime(loopEnd)} 구간이 준비됐어요.`
      : hasStart
        ? '시작점 A가 설정됐어요. 반복할 끝점에서 끝점 설정을 눌러주세요.'
        : hasAudio
          ? '재생 위치를 옮긴 뒤 시작점과 끝점을 차례로 설정하세요.'
          : '음악을 불러온 뒤 반복할 구간의 시작점과 끝점을 지정하세요.');
  document.querySelector('#loopStatus').textContent = status;
}

function setSpeed(value) {
  const speed = Number(value);
  if (!Number.isFinite(speed) || speed < 0.25 || speed > 3) {
    showToast('속도는 0.25부터 3까지 입력할 수 있어요.');
    speedInput.value = String(audio.playbackRate || 1);
    return;
  }
  const normalized = Math.round(speed * 100) / 100;
  audio.playbackRate = normalized;
  speedInput.value = String(normalized);
  speedButtons.forEach((button) => {
    const active = Number(button.dataset.speed) === normalized;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function selectAudio(file) {
  if (!file) return;
  if (file.type && !file.type.startsWith('audio/')) {
    showToast('오디오 파일을 선택해 주세요.');
    return;
  }
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  audio.src = objectUrl;
  audio.load();
  loopStart = null;
  loopEnd = null;
  loopEnabled = false;
  document.querySelector('#trackTitle').textContent = file.name.replace(/\.[^.]+$/, '') || file.name;
  document.querySelector('#trackSubtitle').textContent = `${file.type.replace('audio/', '').toUpperCase() || '오디오'} · 내 기기에서 재생`;
  document.querySelector('#trackKicker').textContent = '새로운 리듬을 찾아서';
  document.querySelector('#currentTime').textContent = '0:00';
  document.querySelector('#duration').textContent = '불러오는 중';
  seekSlider.value = '0';
  seekSlider.style.setProperty('--seek', '0%');
  seekSlider.disabled = false;
  playButton.disabled = false;
  changeFileButton.disabled = false;
  document.querySelector('#rewindButton').disabled = false;
  document.querySelector('#forwardButton').disabled = false;
  updateLoopUI();
  createWaveform();
  audio.play().catch(() => showToast('재생 버튼을 눌러 음악을 들어보세요.'));
}

uploadButton.addEventListener('click', () => fileInput.click());
changeFileButton.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (event) => {
  selectAudio(event.target.files?.[0]);
  event.target.value = '';
});

playButton.addEventListener('click', () => {
  if (!audio.src) return;
  if (audio.paused) audio.play().catch(() => showToast('이 파일을 재생할 수 없어요. 다른 오디오 파일을 선택해 주세요.'));
  else audio.pause();
});

audio.addEventListener('play', () => {
  playButton.classList.add('is-playing');
  playButton.setAttribute('aria-label', '일시정지');
  document.querySelector('#trackKicker').textContent = '지금, 음악에 머무는 중';
});
audio.addEventListener('pause', () => {
  playButton.classList.remove('is-playing');
  playButton.setAttribute('aria-label', '재생');
});
audio.addEventListener('timeupdate', () => {
  if (loopEnabled && loopStart !== null && loopEnd !== null && audio.currentTime >= loopEnd) {
    audio.currentTime = loopStart;
  }
  updateProgress();
});
audio.addEventListener('durationchange', () => {
  document.querySelector('#duration').textContent = formatTime(audio.duration);
  updateProgress();
});
audio.addEventListener('loadedmetadata', () => {
  document.querySelector('#duration').textContent = formatTime(audio.duration);
});
audio.addEventListener('ended', () => {
  if (loopEnabled && loopStart !== null && loopEnd !== null) {
    audio.currentTime = loopStart;
    audio.play().catch(() => showToast('재생 버튼을 눌러 반복 재생을 이어가세요.'));
  } else {
    audio.currentTime = 0;
    updateProgress();
  }
});
audio.addEventListener('error', () => {
  if (audio.src) {
    document.querySelector('#duration').textContent = '재생할 수 없음';
    showToast('브라우저에서 지원하지 않는 형식일 수 있어요.');
  }
});

seekSlider.addEventListener('input', () => {
  seeking = true;
  const progress = Number(seekSlider.value) / 1000;
  seekSlider.style.setProperty('--seek', `${progress * 100}%`);
  document.querySelector('#currentTime').textContent = formatTime(progress * (audio.duration || 0));
});
seekSlider.addEventListener('change', () => {
  if (Number.isFinite(audio.duration)) audio.currentTime = (Number(seekSlider.value) / 1000) * audio.duration;
  seeking = false;
  updateProgress();
});

function seekBy(seconds) {
  if (Number.isFinite(audio.duration)) audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds));
}
document.querySelector('#rewindButton').addEventListener('click', () => seekBy(-10));
document.querySelector('#forwardButton').addEventListener('click', () => seekBy(10));

document.querySelector('#setLoopStartButton').addEventListener('click', () => {
  if (!Number.isFinite(audio.duration)) return;
  loopStart = audio.currentTime;
  loopEnd = null;
  loopEnabled = false;
  updateLoopUI('시작점 A를 설정했어요. 반복할 끝점에서 끝점 설정을 눌러주세요.');
});
document.querySelector('#setLoopEndButton').addEventListener('click', () => {
  if (loopStart === null || !Number.isFinite(audio.duration)) return;
  if (audio.currentTime <= loopStart) {
    showToast('끝점은 시작점 A보다 뒤에 설정해 주세요.');
    return;
  }
  loopEnd = audio.currentTime;
  updateLoopUI();
});
document.querySelector('#loopToggle').addEventListener('click', () => {
  if (loopStart === null || loopEnd === null || loopEnd <= loopStart) return;
  loopEnabled = !loopEnabled;
  if (loopEnabled && (audio.currentTime < loopStart || audio.currentTime >= loopEnd)) {
    audio.currentTime = loopStart;
  }
  updateLoopUI();
});
document.querySelector('#clearLoopButton').addEventListener('click', () => {
  loopStart = null;
  loopEnd = null;
  loopEnabled = false;
  updateLoopUI();
});

speedButtons.forEach((button) => button.addEventListener('click', () => setSpeed(button.dataset.speed)));
speedInput.addEventListener('change', () => setSpeed(speedInput.value));
speedInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    setSpeed(speedInput.value);
    speedInput.blur();
  }
});

waveform.addEventListener('click', (event) => {
  if (!Number.isFinite(audio.duration)) return;
  const bounds = waveform.getBoundingClientRect();
  audio.currentTime = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) * audio.duration;
});

for (const eventName of ['dragenter', 'dragover']) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add('drag-over');
  });
}
for (const eventName of ['dragleave', 'drop']) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove('drag-over');
  });
}
dropZone.addEventListener('drop', (event) => selectAudio(event.dataTransfer?.files?.[0]));

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});
installButton.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.hidden = true;
});
window.addEventListener('appinstalled', () => showToast('느린결을 홈 화면에 설치했어요.'));

setSpeed(1);
updateLoopUI();
createWaveform();
window.addEventListener('resize', createWaveform);
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
