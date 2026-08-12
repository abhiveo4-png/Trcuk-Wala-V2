import React, { useEffect, useRef } from 'react';

interface RainCanvasProps {
  isRainActive: boolean;
  rainIntensity: 'light' | 'medium' | 'heavy';
  isWiperActive: boolean;
  isEarphoneMode?: boolean;
  onWiperComplete?: () => void;
}

export const RainCanvas: React.FC<RainCanvasProps> = ({
  isRainActive,
  rainIntensity,
  isWiperActive,
  isEarphoneMode = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wiperAngleRef = useRef<number>(-75);
  const wiperDirectionRef = useRef<number>(1); // 1 = right, -1 = left

  // Ambient Weather Audio Synthesizer (Rain, Wind, Thunder/Badal)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rainGainRef = useRef<GainNode | null>(null);
  const rainFilterRef = useRef<BiquadFilterNode | null>(null);
  const windGainRef = useRef<GainNode | null>(null);
  const windFilterRef = useRef<BiquadFilterNode | null>(null);
  const lightningFlashRef = useRef<boolean>(false);

  // Trigger Rolling Thunder (Bijli & Badal ki Aawaz) with visual flash
  const triggerThunder = () => {
    // Always trigger visual flash if rain is active
    if (isRainActive) {
      lightningFlashRef.current = true;
      setTimeout(() => {
        lightningFlashRef.current = false;
      }, 100);
      setTimeout(() => {
        lightningFlashRef.current = true;
        setTimeout(() => {
          lightningFlashRef.current = false;
        }, 160);
      }, 220);
    }

    if (!audioCtxRef.current || !isRainActive || isEarphoneMode) return;

    try {
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      const duration = 3.8;

      // 1. Sub-bass thunder rumble (30Hz - 90Hz)
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'sawtooth';
      subOsc.frequency.setValueAtTime(88, now);
      subOsc.frequency.exponentialRampToValueAtTime(32, now + duration);

      const subFilter = ctx.createBiquadFilter();
      subFilter.type = 'lowpass';
      subFilter.frequency.setValueAtTime(130, now);

      subGain.gain.setValueAtTime(0.001, now);
      subGain.gain.linearRampToValueAtTime(0.065, now + 0.25);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      subOsc.connect(subFilter);
      subFilter.connect(subGain);
      subGain.connect(ctx.destination);

      subOsc.start(now);
      subOsc.stop(now + duration);

      // 2. Filtered Brown-noise Crackle & Cloud Rumble (Badal ki gungunahat)
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = output[i];
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(280, now);
      noiseFilter.Q.setValueAtTime(1.1, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.001, now);
      // Double-peak rumble envelope
      noiseGain.gain.linearRampToValueAtTime(0.05, now + 0.15);
      noiseGain.gain.linearRampToValueAtTime(0.02, now + 0.7);
      noiseGain.gain.linearRampToValueAtTime(0.045, now + 1.4);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      noiseSource.start(now);
    } catch (e) {
      console.warn('Thunder audio error:', e);
    }
  };

  useEffect(() => {
    const initAudio = () => {
      try {
        if (!audioCtxRef.current) {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (!AudioCtx) return;
          audioCtxRef.current = new AudioCtx();
        }

        const ctx = audioCtxRef.current;
        if (!ctx) return;

        if (ctx.state === 'suspended' && isRainActive && !isEarphoneMode) {
          ctx.resume().catch(() => {});
        }

        // Initialize Rain & Wind Audio Nodes
        if (!rainGainRef.current) {
          // --- A. Rain Sound Generator ---
          const bufferSize = Math.floor(ctx.sampleRate * 2.5);
          const rainBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const rainOut = rainBuffer.getChannelData(0);

          let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0;
          for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            rainOut[i] = (b0 + b1 + b2 + b3 + b4 + b5 + white * 0.5362) * 0.08;
          }

          const rainSource = ctx.createBufferSource();
          rainSource.buffer = rainBuffer;
          rainSource.loop = true;

          const rainFilter = ctx.createBiquadFilter();
          rainFilter.type = 'lowpass';
          rainFilter.frequency.setValueAtTime(900, ctx.currentTime);
          rainFilterRef.current = rainFilter;

          const rainGain = ctx.createGain();
          rainGain.gain.setValueAtTime(0, ctx.currentTime);
          rainGainRef.current = rainGain;

          rainSource.connect(rainFilter);
          rainFilter.connect(rainGain);
          rainGain.connect(ctx.destination);
          rainSource.start(0);

          // --- B. Gentle Wind Breeze Generator (Halki Hawa) ---
          const windBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const windOut = windBuffer.getChannelData(0);
          let wLast = 0;
          for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            windOut[i] = (wLast + 0.015 * white) / 1.015; // smooth brown noise
            wLast = windOut[i];
          }

          const windSource = ctx.createBufferSource();
          windSource.buffer = windBuffer;
          windSource.loop = true;

          const windFilter = ctx.createBiquadFilter();
          windFilter.type = 'bandpass';
          windFilter.frequency.setValueAtTime(400, ctx.currentTime);
          windFilter.Q.setValueAtTime(1.5, ctx.currentTime);
          windFilterRef.current = windFilter;

          // LFO for gentle wind swell (hawa ka jhonka)
          const lfo = ctx.createOscillator();
          lfo.type = 'sine';
          lfo.frequency.setValueAtTime(0.18, ctx.currentTime); // slow swell (~5.5 sec cycle)

          const lfoGain = ctx.createGain();
          lfoGain.gain.setValueAtTime(150, ctx.currentTime); // sweep filter +-150Hz
          lfo.connect(lfoGain);
          lfoGain.connect(windFilter.frequency);
          lfo.start(0);

          const windGain = ctx.createGain();
          windGain.gain.setValueAtTime(0, ctx.currentTime);
          windGainRef.current = windGain;

          windSource.connect(windFilter);
          windFilter.connect(windGain);
          windGain.connect(ctx.destination);
          windSource.start(0);
        }
      } catch (e) {
        console.warn('Weather audio init error:', e);
      }
    };

    if (isRainActive) {
      initAudio();
    }

    // Dynamic Volume Updates for Rain & Wind
    if (rainGainRef.current && rainFilterRef.current && windGainRef.current && audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended' && isRainActive && !isEarphoneMode) {
        ctx.resume().catch(() => {});
      }

      const targetRainGain = (!isRainActive || isEarphoneMode)
        ? 0
        : rainIntensity === 'light'
        ? 0.02
        : rainIntensity === 'medium'
        ? 0.04
        : 0.065;

      const targetWindGain = (!isRainActive || isEarphoneMode)
        ? 0
        : rainIntensity === 'light'
        ? 0.012
        : rainIntensity === 'medium'
        ? 0.022
        : 0.038;

      const targetRainFreq =
        rainIntensity === 'light'
          ? 650
          : rainIntensity === 'medium'
          ? 1000
          : 1400;

      rainGainRef.current.gain.setTargetAtTime(targetRainGain, ctx.currentTime, 0.3);
      windGainRef.current.gain.setTargetAtTime(targetWindGain, ctx.currentTime, 0.3);
      rainFilterRef.current.frequency.setTargetAtTime(targetRainFreq, ctx.currentTime, 0.3);
    }

    const handleUserGesture = () => {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended' && isRainActive && !isEarphoneMode) {
        audioCtxRef.current.resume().catch(() => {});
      }
    };
    window.addEventListener('click', handleUserGesture, { once: true });

    return () => {
      window.removeEventListener('click', handleUserGesture);
    };
  }, [isRainActive, rainIntensity, isEarphoneMode]);

  // Periodic Thunder & Cloud Rumble Interval
  useEffect(() => {
    if (!isRainActive) return;

    // Trigger initial thunder sound after a short delay
    const initialTimer = setTimeout(() => {
      triggerThunder();
    }, 4000);

    // Periodic thunder every 20-35 seconds
    const interval = setInterval(() => {
      if (Math.random() < 0.8) {
        triggerThunder();
      }
    }, 22000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [isRainActive, isEarphoneMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle setup based on intensity
    const getCount = () => {
      if (rainIntensity === 'light') return 120;
      if (rainIntensity === 'medium') return 240;
      return 420;
    };

    interface Drop {
      x: number;
      y: number;
      length: number;
      speed: number;
      opacity: number;
      width: number;
    }

    interface Splatter {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
      size: number;
    }

    interface GlassDrop {
      x: number;
      y: number;
      r: number;
      opacity: number;
    }

    const drops: Drop[] = [];
    const splatters: Splatter[] = [];
    const glassDrops: GlassDrop[] = [];

    // Initialize rain drops
    const initDrops = () => {
      drops.length = 0;
      glassDrops.length = 0;
      if (!isRainActive) return;

      const count = getCount();
      for (let i = 0; i < count; i++) {
        drops.push({
          x: Math.random() * width,
          y: Math.random() * height,
          length: Math.random() * 25 + 15,
          speed: Math.random() * 12 + 10,
          opacity: Math.random() * 0.4 + 0.2,
          width: Math.random() * 1.5 + 0.8,
        });
      }

      // Glass droplets on windshield
      for (let i = 0; i < 60; i++) {
        glassDrops.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: Math.random() * 3 + 1,
          opacity: Math.random() * 0.6 + 0.2,
        });
      }
    };

    initDrops();

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 0. Visual Lightning Flash (Bijli ki Chamak)
      if (lightningFlashRef.current) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
        ctx.fillRect(0, 0, width, height);
      }

      // 1. Draw falling rain
      ctx.strokeStyle = 'rgba(215, 230, 255, 0.45)';
      ctx.lineCap = 'round';

      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        ctx.lineWidth = d.width;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - d.length * 0.15, d.y + d.length);
        ctx.strokeStyle = `rgba(210, 230, 255, ${d.opacity})`;
        ctx.stroke();

        d.y += d.speed;
        d.x -= d.speed * 0.15; // wind angle

        if (d.y > height - 60) {
          // Splatter on asphalt road
          if (Math.random() < 0.3) {
            splatters.push({
              x: d.x,
              y: height - Math.random() * 80,
              vx: (Math.random() - 0.5) * 4,
              vy: -Math.random() * 3 - 1,
              life: 0,
              maxLife: Math.random() * 12 + 8,
              size: Math.random() * 2 + 1,
            });
          }
          d.y = -20;
          d.x = Math.random() * (width + 100);
        }
      }

      // 2. Draw road splatters
      for (let i = splatters.length - 1; i >= 0; i--) {
        const s = splatters[i];
        s.life++;
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.2; // gravity

        const alpha = 1 - s.life / s.maxLife;
        if (alpha <= 0) {
          splatters.splice(i, 1);
          continue;
        }

        ctx.fillStyle = `rgba(220, 240, 255, ${alpha * 0.6})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Draw static windshield droplets
      for (let i = 0; i < glassDrops.length; i++) {
        const gd = glassDrops[i];
        ctx.fillStyle = `rgba(255, 255, 255, ${gd.opacity})`;
        ctx.beginPath();
        ctx.arc(gd.x, gd.y, gd.r, 0, Math.PI * 2);
        ctx.fill();

        // Subtle specular highlight
        ctx.fillStyle = `rgba(255, 255, 255, ${gd.opacity * 0.8})`;
        ctx.beginPath();
        ctx.arc(gd.x - gd.r * 0.3, gd.y - gd.r * 0.3, gd.r * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. Wiper Sweep logic if active
      if (isWiperActive) {
        wiperAngleRef.current += wiperDirectionRef.current * 2.8;
        if (wiperAngleRef.current > 50) {
          wiperDirectionRef.current = -1;
        } else if (wiperAngleRef.current < -75) {
          wiperDirectionRef.current = 1;
        }

        const angleRad = (wiperAngleRef.current * Math.PI) / 180;
        const wiperPivotX = width / 2;
        const wiperPivotY = height + 40;
        const wiperLength = height * 0.85;

        const wiperTipX = wiperPivotX + Math.sin(angleRad) * wiperLength;
        const wiperTipY = wiperPivotY - Math.cos(angleRad) * wiperLength;

        // Draw Wiper Blade
        ctx.save();
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 12;

        ctx.beginPath();
        ctx.moveTo(wiperPivotX, wiperPivotY);
        ctx.lineTo(wiperTipX, wiperTipY);
        ctx.stroke();

        // Blade rubber edge
        ctx.strokeStyle = '#64748B';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(wiperPivotX, wiperPivotY);
        ctx.lineTo(wiperTipX, wiperTipY);
        ctx.stroke();
        ctx.restore();

        // Clear droplets in wiper sweep path
        const currentAngle = wiperAngleRef.current;
        for (let i = glassDrops.length - 1; i >= 0; i--) {
          const gd = glassDrops[i];
          const dx = gd.x - wiperPivotX;
          const dy = wiperPivotY - gd.y;
          const dropAngle = (Math.atan2(dx, dy) * 180) / Math.PI;

          if (Math.abs(dropAngle - currentAngle) < 12) {
            glassDrops.splice(i, 1);
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isRainActive, rainIntensity, isWiperActive]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-10 w-full h-full"
    />
  );
};
