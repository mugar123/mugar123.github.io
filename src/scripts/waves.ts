/**
 * The hero background: two coherent sources just below the fold, interfering, at a fixed slit separation.
 * Renders at reduced resolution, only while on screen, and holds a single still frame when motion is
 * reduced. Without WebGL the hero keeps its CSS glow.
 */
const VERTEX = `attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAGMENT = `precision mediump float;
uniform vec2 res;
uniform float t;
const float d = 0.11; // half the slit separation, in units of the hero's height
void main() {
  vec2 uv = gl_FragCoord.xy / res;
  vec2 p = (gl_FragCoord.xy - vec2(0.5 * res.x, 0.0)) / res.y; // origin at the bottom centre, units of height
  vec2 s1 = vec2(-d, -0.08);
  vec2 s2 = vec2(d, -0.08);
  float r1 = length(p - s1);
  float r2 = length(p - s2);
  float k = 64.0;
  float w = 2.2;
  // Instantaneous field, plus the time-averaged fringe envelope so the pattern reads as fringes, not noise.
  float a = sin(k * r1 - w * t) / (0.35 + 2.2 * r1) + sin(k * r2 - w * t) / (0.35 + 2.2 * r2);
  float env = cos(0.5 * k * (r1 - r2));
  float glow = a * a * 0.3 + env * env * 0.25 / (0.6 + 1.6 * length(p - vec2(0.0, -0.08)));
  vec3 base = vec3(0.86, 0.89, 0.96); // white light, a touch cool: the fringes carry no hue of their own
  vec3 col = 1.0 - exp(-base * glow * 2.0); // soft shoulder: the brightest fringes never clip to white
  col *= mix(0.3, 1.0, smoothstep(0.15, 0.45, abs(uv.y - 0.58))); // a darker band where the copy sits
  col *= smoothstep(1.25, 0.35, length((uv - vec2(0.5, 0.3)) * vec2(1.2, 1.0)));
  gl_FragColor = vec4(col, 1.0);
}`;

const RESOLUTION = 0.5; // of device pixels: the waves are soft, full resolution buys nothing

export function initWaves(canvas: HTMLCanvasElement) {
  const host = canvas.parentElement!;
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) return;

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
  };
  const vs = compile(gl.VERTEX_SHADER, VERTEX);
  const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT);
  if (!vs || !fs) return;
  const program = gl.createProgram()!;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);

  // One triangle that covers the viewport.
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'p');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(program, 'res');
  const uT = gl.getUniformLocation(program, 't');

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = true;
  let frame = 0;
  const start = performance.now();
  // Reduced motion holds one moment of the wave.
  const stillTime = 1.3;

  function draw(now: number) {
    gl!.uniform2f(uRes, canvas.width, canvas.height);
    gl!.uniform1f(uT, reduce.matches ? stillTime : (now - start) / 1000);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
  }
  function loop(now: number) {
    draw(now);
    frame = requestAnimationFrame(loop);
  }
  function sync() {
    const run = visible && !document.hidden && !reduce.matches;
    if (run && !frame) frame = requestAnimationFrame(loop);
    if (!run && frame) { cancelAnimationFrame(frame); frame = 0; }
    if (!run && visible) draw(performance.now());
  }

  function resize() {
    const scale = Math.min(devicePixelRatio, 2) * RESOLUTION;
    canvas.width = Math.max(1, Math.round(host.clientWidth * scale));
    canvas.height = Math.max(1, Math.round(host.clientHeight * scale));
    gl!.viewport(0, 0, canvas.width, canvas.height);
    if (!frame) draw(performance.now());
  }
  new ResizeObserver(resize).observe(host);

  new IntersectionObserver(([entry]) => { visible = !!entry?.isIntersecting; sync(); }).observe(host);
  document.addEventListener('visibilitychange', sync);
  reduce.addEventListener('change', sync);
  canvas.addEventListener('webglcontextlost', () => { cancelAnimationFrame(frame); frame = 0; canvas.hidden = true; });

  resize();
  host.classList.add('has-waves');
  sync();
}
