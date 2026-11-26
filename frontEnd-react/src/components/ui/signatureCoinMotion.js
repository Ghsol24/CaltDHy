// Chuyển động của màn loading "Mưa xu" (cảnh vẽ ở signatureCoinRain.jsx).
// Chỉ đổi transform/opacity: chạy trên compositor, không giật khi JavaScript đang bận.
// Toạ độ theo khung 512×512 của logo (public/brand/caltdhy-logo-full.svg).

export const PHASE_MS = 3000;

// Tay nghỉ: thụt sâu sau mặt trước của ví. Tay với: bàn tay ở cạnh phải, ngang đầu chuột.
const ARM_REST = 'translate(-27.34%, 23.44%)';
const ARM_REACH = 'translate(0%, 0%)';
export const CATCH = [500, 164];           // chỗ bàn tay chụp đồng xu
export const LEFT_SLOT = [132, 300];       // khe trái của ví
export const POCKET = [256, 300];          // lòng ví, sau đầu chuột
// Lúc xu chạm vào ví (ms trong một vòng): hứng → rơi thẳng → rơi từ chỗ ngẫu nhiên.
const DEPOSITS = [820, 1500, 2540];

// ── Web Animations API: mọi animation lặp dùng chung startTime nên luôn khớp nhịp. ──

function sceneLayers(scene) {
  const pick = (name) => scene.querySelector(`[data-layer="${name}"]`);
  return {
    body: pick('body'), tile: pick('tile'), mouse: pick('mouse'), open: pick('open'), closed: pick('closed'),
    held: pick('held'), coinA: pick('coinA'), coinB: pick('coinB'), coinC: pick('coinC'), spark: pick('spark'),
    clasp: pick('clasp'), ring: pick('ring'), plus: pick('plus'),
  };
}

const at = (ms) => ms / PHASE_MS;
const offsetTo = (x, y, end, spin) =>
  `translate(${((x - end[0]) / 5.12).toFixed(2)}%, ${((y - end[1]) / 5.12).toFixed(2)}%) scaleX(${spin.toFixed(3)})`;

// Rơi như có trọng lực (x đều, y tăng tốc) và xoay mặt đồng xu; đến nơi thì ẩn ngay.
function fallFrames(start, end, fromMs, toMs) {
  const frames = [];
  if (fromMs > 0) {
    frames.push({ offset: 0, opacity: 0, transform: offsetTo(start[0], start[1], end, 1) },
      { offset: at(fromMs), opacity: 0, transform: offsetTo(start[0], start[1], end, 1) });
  }
  for (let step = 0; step <= 12; step += 1) {
    const t = step / 12;
    const x = start[0] + (end[0] - start[0]) * t;
    const y = start[1] + (end[1] - start[1]) * t * t;
    frames.push({ offset: at(fromMs + (toMs - fromMs) * t), opacity: t < 0.15 ? t / 0.15 : 1,
      transform: offsetTo(x, y, end, Math.max(0.18, Math.abs(Math.cos(t * Math.PI * 3)))) });
  }
  frames.push({ offset: at(toMs) + 0.0001, opacity: 0, transform: offsetTo(end[0], end[1], end, 1) },
    { offset: 1, opacity: 0, transform: offsetTo(start[0], start[1], end, 1) });
  return frames;
}

// Bật/tắt tức thì ở các mốc: [[ms, opacity], ...].
function stepFrames(points) {
  const frames = [];
  points.forEach(([ms, value], index) => {
    if (index > 0) frames.push({ offset: Math.max(0, at(ms) - 0.0001), opacity: points[index - 1][1] });
    frames.push({ offset: at(ms), opacity: value });
  });
  frames.push({ offset: 1, opacity: points[points.length - 1][1] });
  return frames;
}

// Một nhịp lặp lại tại mỗi lần xu vào ví.
function pulseFrames(rest, shape) {
  const frames = [{ offset: 0, ...rest }];
  DEPOSITS.forEach((ms) => shape.forEach(([delta, props]) =>
    frames.push({ offset: at(ms + delta), easing: 'ease-in-out', ...props })));
  frames.push({ offset: 1, ...rest });
  return frames;
}

const randomPocketStart = () => [Math.round(-120 + Math.random() * 760), -260];

function play(element, frames, duration, easing = 'ease') {
  if (!element) return Promise.resolve();
  return element.animate(frames, { duration, easing, fill: 'forwards' }).finished.catch(() => {});
}

// Promise không bao giờ treo màn loading: tab ẩn hay animation bị huỷ thì hết giờ vẫn đi tiếp.
function settle(promise, ms) {
  return Promise.race([promise, new Promise((resolve) => window.setTimeout(resolve, ms))]);
}

export function startCoinRain(scene) {
  const layer = sceneLayers(scene);
  const loop = { duration: PHASE_MS, iterations: Infinity };
  const easeOut = 'cubic-bezier(.2,.8,.3,1)';
  const easeIn = 'cubic-bezier(.55,0,.75,.4)';
  const armFrames = [
    { offset: 0, transform: ARM_REST }, { offset: at(260), transform: ARM_REST, easing: easeOut },
    { offset: at(520), transform: ARM_REACH }, { offset: at(580), transform: ARM_REACH, easing: easeIn },
    { offset: at(820), transform: ARM_REST }, { offset: 1, transform: ARM_REST },
  ];
  const head = (rotate, lift = 0) => `rotate(${rotate}deg) translateY(${lift}%)`;
  const animations = [
    layer.open.animate(armFrames, loop),
    layer.closed.animate(armFrames, loop),
    layer.held.animate(armFrames, loop),
    layer.open.animate(stepFrames([[0, 0], [330, 1], [520, 0]]), loop),
    layer.closed.animate(stepFrames([[0, 1], [330, 0], [520, 1]]), loop),
    layer.held.animate(stepFrames([[0, 0], [520, 1], [840, 0]]), loop),
    layer.coinA.animate(fallFrames([700, -200], CATCH, 0, 520), loop),
    layer.coinB.animate(fallFrames([132, -230], LEFT_SLOT, 1000, 1520), loop),
    layer.coinC.animate(fallFrames(randomPocketStart(), POCKET, 2000, 2560), loop),
    layer.spark.animate([
      { offset: 0, opacity: 0, transform: 'scale(.5)' }, { offset: at(520) - 0.0001, opacity: 0, transform: 'scale(.5)' },
      { offset: at(520), opacity: 0.95, transform: 'scale(.5)' }, { offset: at(650), opacity: 0, transform: 'scale(1.9)' },
      { offset: 1, opacity: 0, transform: 'scale(1.9)' },
    ], loop),
    // Nghiêng đầu theo đồng xu đang hứng, ngước nhìn xu rơi thẳng, khựng nhẹ khi xu lọt sau đầu.
    layer.mouse.animate([
      { offset: 0, transform: head(0) }, { offset: at(260), transform: head(0), easing: 'ease-out' },
      { offset: at(500), transform: head(6) }, { offset: at(700), transform: head(6), easing: 'ease-in-out' },
      { offset: at(900), transform: head(0) }, { offset: at(1000), transform: head(0), easing: 'ease-out' },
      { offset: at(1160), transform: head(-5) }, { offset: at(1400), transform: head(-5), easing: 'ease-in-out' },
      { offset: at(1600), transform: head(0) }, { offset: at(2480), transform: head(0), easing: 'ease-out' },
      { offset: at(2560), transform: head(0, 3) }, { offset: at(2700), transform: head(0), easing: 'ease-out' },
      { offset: 1, transform: head(0) },
    ], loop),
    layer.body.animate(pulseFrames({ transform: 'scale(1, 1)' }, [
      [-60, { transform: 'scale(1, 1)' }], [0, { transform: 'scale(1.06, .94)' }],
      [50, { transform: 'scale(.98, 1.02)' }], [100, { transform: 'scale(1, 1)' }],
    ]), loop),
    layer.clasp.animate(pulseFrames({ transform: 'scale(1)' }, [
      [-20, { transform: 'scale(1)' }], [40, { transform: 'scale(1.2)' }], [100, { transform: 'scale(1)' }],
    ]), loop),
    layer.plus.animate(pulseFrames({ opacity: 0, transform: 'translateY(0em)' }, [
      [-10, { opacity: 0, transform: 'translateY(0em)' }], [10, { opacity: 1, transform: 'translateY(-.3em)' }],
      [230, { opacity: 0, transform: 'translateY(-1.8em)' }],
    ]), loop),
  ];
  const coinC = animations[8];
  const startTime = document.timeline.currentTime;
  animations.forEach((animation) => { animation.startTime = startTime; });

  // Đổi điểm xuất phát của xu "ngẫu nhiên" khi nó đang ẩn (đầu mỗi vòng, trước mốc 2000ms).
  const reseed = () => coinC.effect?.setKeyframes(fallFrames(randomPocketStart(), POCKET, 2000, 2560));
  let interval = null;
  const firstReseed = window.setTimeout(() => { reseed(); interval = window.setInterval(reseed, PHASE_MS); },
    PHASE_MS + 200);

  return {
    layer,
    stopTimers() { window.clearTimeout(firstReseed); window.clearInterval(interval); },
    stop() { this.stopTimers(); animations.forEach((animation) => animation.cancel()); },
    // Dừng vòng lặp và đưa mọi thứ về tư thế nghỉ (tay thụt vào, xu đang rơi mờ đi).
    freeze() {
      this.stopTimers();
      animations.forEach((animation) => animation.pause());
      const style = (element) => getComputedStyle(element);
      const poses = [[layer.open, ARM_REST], [layer.closed, ARM_REST], [layer.held, ARM_REST],
        [layer.mouse, head(0)], [layer.body, 'scale(1, 1)'], [layer.clasp, 'scale(1)']]
        .map(([element, to]) => [element, style(element).transform, to]);
      const fading = [layer.open, layer.held, layer.coinA, layer.coinB, layer.coinC, layer.spark, layer.plus]
        .map((element) => [element, style(element).opacity, style(element).transform]);
      const closedOpacity = style(layer.closed).opacity;
      animations.forEach((animation) => animation.cancel());
      fading.forEach(([element, opacity, transform]) =>
        play(element, [{ opacity, transform }, { opacity: 0, transform }], 160, 'linear'));
      play(layer.closed, [{ opacity: closedOpacity }, { opacity: 1 }], 120, 'linear');
      return settle(Promise.all(poses.map(([element, from, to]) =>
        play(element, [{ transform: from === 'none' ? to : from }, { transform: to }], 200, 'cubic-bezier(.4,0,.6,1)'))), 600);
    },
  };
}

// Thành công: chuột thụt vào ví, khoá xu "tách" loé sáng, ví nén lại lấy đà.
export function lockWallet(layer) {
  const sequence = (async () => {
    await play(layer.mouse, [{ transform: 'rotate(0deg) translateY(0%)' }, { transform: 'rotate(0deg) translateY(19%)' }],
      230, 'cubic-bezier(.5,0,.75,0)');
    play(layer.ring, [{ opacity: 0.95, transform: 'scale(.6)' }, { opacity: 0, transform: 'scale(2.2)' }], 420, 'ease-out');
    play(layer.clasp, [{ transform: 'scale(1)' }, { transform: 'scale(.8)', offset: 0.3 },
      { transform: 'scale(1.25)', offset: 0.65 }, { transform: 'scale(1)' }], 300);
    await play(layer.body, [{ transform: 'scale(1, 1)' }, { transform: 'scale(1.07, .92)', offset: 0.35 },
      { transform: 'scale(.97, 1.04)', offset: 0.7 }, { transform: 'scale(1, 1)' }], 300);
  })();
  return settle(sequence, 1200);
}

// Ví nhảy vòng cung vào ô logo; giữa đường hiện nền logo và chuột ló đầu lên = đúng logo.
export function flyToMark({ character, layer, backdrop, mark, duration }) {
  const from = character.getBoundingClientRect();
  const to = mark.getBoundingClientRect();
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const scale = to.width / from.width;
  play(layer.tile, [{ opacity: 0 }, { opacity: 0, offset: 0.45 }, { opacity: 1 }], duration, 'linear');
  play(layer.mouse, [{ transform: 'rotate(0deg) translateY(19%)' }, { transform: 'rotate(0deg) translateY(19%)', offset: 0.55 },
    { transform: 'rotate(0deg) translateY(0%)' }], duration, 'ease-out');
  play(layer.body, [{ transform: 'scale(1, 1)' }, { transform: 'scale(.9, 1.1)', offset: 0.15 },
    { transform: 'scale(1, 1)', offset: 0.4 }, { transform: 'scale(1, 1)' }], duration, 'linear');
  play(backdrop, [{ opacity: 1 }, { opacity: 1, offset: 0.4 }, { opacity: 0 }], duration, 'linear');
  const flight = play(character, [
    { transform: 'translate(0px, 0px) scale(1)', easing: 'cubic-bezier(.3,0,.5,1)' },
    { transform: `translate(${dx * 0.3}px, ${dy * 0.45 - 60}px) scale(${1 + (scale - 1) * 0.4})`, offset: 0.42,
      easing: 'cubic-bezier(.5,0,.3,1)' },
    { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
  ], duration, 'linear');
  return settle(flight, duration + 400);
}

export function landOnMark(mark) {
  mark.animate([{ transform: 'scale(1.2, .85)' }, { transform: 'scale(.94, 1.06)', offset: 0.45 }, { transform: 'scale(1)' }],
    { duration: 340, easing: 'ease-out' });
}

// Thất bại: chuột chui xuống chỉ còn ló hai tai, ví lắc nhẹ rồi đứng yên một nhịp.
export function hideInWallet(layer) {
  const sequence = (async () => {
    await play(layer.mouse, [{ transform: 'rotate(0deg) translateY(0%)' }, { transform: 'rotate(0deg) translateY(25%)' }],
      280, 'cubic-bezier(.5,0,.75,0)');
    await play(layer.body, [{ transform: 'translateX(0%)' }, { transform: 'translateX(-2%)', offset: 0.25 },
      { transform: 'translateX(2%)', offset: 0.5 }, { transform: 'translateX(-1%)', offset: 0.75 },
      { transform: 'translateX(0%)' }], 300, 'linear');
    await new Promise((resolve) => window.setTimeout(resolve, 220));
  })();
  return settle(sequence, 1400);
}
