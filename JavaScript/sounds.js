let reverb, delay, filter;
let baseSample;
let hasInteracted = false;

function preload() {
  soundFormats("m4a");
  baseSample = loadSound("transition.m4a");
}

function initDiamondSound() {
  if (hasInteracted) return;
  userStartAudio();

  filter = new p5.LowPass();
  filter.freq(1200);
  filter.res(8);

  reverb = new p5.Reverb();
  delay = new p5.Delay();

  baseSample.disconnect();
  baseSample.connect(filter);

  reverb.process(filter, 6, 7);
  delay.process(filter, 0.4, 0.3, 2300);

  hasInteracted = true;
}
function playToneByTimeType(type) {
  if (!hasInteracted) initDiamondSound();

  if (baseSample.isPlaying()) {
    baseSample.stop();
  }

  let settings = {
    day: {
      rate: 1.4,
      filterFreq: 1600,
      reverbTime: 4,
      reverbDecay: 5,
      delayTime: 0.2,
      delayFeedback: 0.2,
    },
    night: {
      rate: 1.2,
      filterFreq: 800,
      reverbTime: 8,
      reverbDecay: 9,
      delayTime: 0.5,
      delayFeedback: 0.4,
    },
    sunrise: {
      rate: 1.5,
      filterFreq: 1800,
      reverbTime: 6,
      reverbDecay: 6,
      delayTime: 0.35,
      delayFeedback: 0.3,
    },
    sunset: {
      rate: 1.35,
      filterFreq: 1000,
      reverbTime: 7,
      reverbDecay: 7,
      delayTime: 0.4,
      delayFeedback: 0.35,
    },
  };

  let s = settings[type];

  let rate = s.rate + random(-0.2, 0.2);
  let filterFreq = s.filterFreq + random(-150, 150);
  let reverbTime = s.reverbTime + random(-0.5, 0.5);
  let reverbDecay = s.reverbDecay + random(-0.5, 0.5);
  let delayTime = s.delayTime + random(-0.05, 0.05);
  let delayFeedback = s.delayFeedback + random(-0.05, 0.05);

  filter.freq(filterFreq);
  reverb.disconnect();
  delay.disconnect();
  reverb.process(filter, reverbTime, reverbDecay);
  delay.process(filter, delayTime, delayFeedback, 2000);

  baseSample.rate(rate);
  baseSample.setVolume(0);
  baseSample.play();
  baseSample.setVolume(0.85, 1.7);

  let durationMs = (baseSample.duration() * 1000) / rate;
  setTimeout(() => {
    baseSample.setVolume(0, 1.2);
  }, durationMs - 1500);
}
