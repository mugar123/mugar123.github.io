import type { FlatCopy } from './copy-layer';

export interface TurningCopy extends FlatCopy {
  yaw(): number;
  guitarShare: number;
}

// All angles of each traced SVG outline have matching vertices. Keep them on the GPU so that a
// scroll frame only changes the pose of each visible copy, including the bass-to-guitar morph.
const vertex = `
  attribute vec2 bass0, bass1, guitar0, guitar1;
  uniform vec2 blend;   // fraction between angles, then between instruments
  uniform vec2 scale;   // canvas pixels in clip coordinates, with y pointing down
  uniform vec2 pivot;   // foot of the instrument on the canvas, in CSS pixels
  uniform vec2 turn;    // cosine and sine of the lean
  uniform vec3 frame;   // CSS size, foot within the frame, encoded outline units per frame
  void main() {
    vec2 a = mix(bass0, bass1, blend.x);
    vec2 b = mix(guitar0, guitar1, blend.x);
    vec2 p = (mix(a, b, blend.y) / frame.z - vec2(.5, frame.y)) * frame.x;
    p = mat2(turn.x, turn.y, -turn.y, turn.x) * p + pivot;
    gl_Position = vec4(p * scale + vec2(-1., 1.), 0., 1.);
  }`;
const fragment = `
  precision mediump float;
  uniform vec4 colour;
  void main() { gl_FragColor = vec4(colour.rgb * colour.a, colour.a); }`;

export function createOutlineLayer(stage: HTMLElement, copies: TurningCopy[], bass: Uint16Array,
  guitar: Uint16Array, points: number, unitsPerFrame: number, onLoss: () => void) {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl', { depth: false, stencil: true, antialias: true, failIfMajorPerformanceCaveat: true });
  if (!gl) return null;
  // Some drivers still offer software WebGL when failIfMajorPerformanceCaveat is set.
  // The 2D/SVG paths are cheaper than emulating the multisampled stencil in software.
  const driver = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = driver ? String(gl.getParameter(driver.UNMASKED_RENDERER_WEBGL)) : '';
  if (!gl.getContextAttributes()?.stencil || /swiftshader|llvmpipe|softpipe|software rasterizer|basic render driver/i.test(renderer)) {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  }

  const program = gl.createProgram()!;
  for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  }
  gl.useProgram(program);
  const attributes = ['bass0', 'bass1', 'guitar0', 'guitar1'].map(name => gl.getAttribLocation(program, name));
  for (const attr of attributes) gl.enableVertexAttribArray(attr);
  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const blend = uniform('blend'), pivot = uniform('pivot'), turn = uniform('turn'), colour = uniform('colour');
  const scale = uniform('scale'), frame = uniform('frame');

  function upload(target: number, data: Uint16Array) {
    const buffer = gl!.createBuffer()!;
    gl!.bindBuffer(target, buffer);
    gl!.bufferData(target, data, gl!.STATIC_DRAW);
    return buffer;
  }
  const models = [upload(gl.ARRAY_BUFFER, bass), upload(gl.ARRAY_BUFFER, guitar)];
  // A strip from foot to head keeps the triangles close to the contour. At a concave edge they
  // can overlap. Count coverage modulo two in the stencil, just like the SVG's evenodd fill.
  const indices = new Uint16Array(points);
  for (let i = 0; i < points / 2; i++) {
    indices[i * 2] = i;
    indices[i * 2 + 1] = points - 1 - i;
  }
  const strip = upload(gl.ELEMENT_ARRAY_BUFFER, indices);
  gl.enable(gl.STENCIL_TEST);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  let blending = false;
  const angles = bass.length / (points * 2);
  const bytesPerAngle = points * 2 * Uint16Array.BYTES_PER_ELEMENT;
  // Each angle always reads the same two slices from each immutable outline buffer.
  const vao = gl.getExtension('OES_vertex_array_object');
  const bindings = new Map<number, WebGLVertexArrayObjectOES>();
  let boundAngle = -1;
  const bindAngle = (first: number) => {
    if (first === boundAngle) return;
    boundAngle = first;
    if (vao) {
      const cached = bindings.get(first);
      if (cached) {
        vao.bindVertexArrayOES(cached);
        return;
      }
      const binding = vao.createVertexArrayOES();
      vao.bindVertexArrayOES(binding);
      if (binding) bindings.set(first, binding);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, strip);
      for (const attribute of attributes) gl.enableVertexAttribArray(attribute);
    }
    const next = (first + 1) % angles;
    for (let m = 0; m < models.length; m++) {
      gl.bindBuffer(gl.ARRAY_BUFFER, models[m]!);
      gl.vertexAttribPointer(attributes[m * 2]!, 2, gl.UNSIGNED_SHORT, false, 0, first * bytesPerAngle);
      gl.vertexAttribPointer(attributes[m * 2 + 1]!, 2, gl.UNSIGNED_SHORT, false, 0, next * bytesPerAngle);
    }
  };
  const poses = copies.map(copy => {
    const { colour } = copy;
    const hex = parseInt(colour.slice(1), 16);
    const rgb = [(hex >> 16) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255] as const;
    return { copy, rgb, x: 0, opacity: 0, yaw: 0, lean: 0 };
  });

  canvas.className = 'lu__copy-layer';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.addEventListener('webglcontextlost', onLoss);
  stage.prepend(canvas);
  let width = 0, height = 0, size = 0, foot = 0;
  let resized = true;
  return {
    element: canvas,
    resize(stageWidth: number, centreY: number, frameSize: number, pivotFoot: number, ratio: number) {
      resized = true;
      width = stageWidth;
      size = frameSize;
      foot = pivotFoot;
      // Include the leaning headstocks and leave the caption outside the drawing buffer.
      height = size * 1.1;
      canvas.style.top = `${centreY - height / 2}px`;
      canvas.style.height = `${height}px`;
      canvas.width = Math.ceil(width * ratio);
      canvas.height = Math.ceil(height * ratio);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(scale, 2 / width, -2 / height);
      gl.uniform3f(frame, size, foot / size, unitsPerFrame);
    },
    invalidate() { resized = true; },
    paint() {
      let dirty = resized;
      for (const pose of poses) {
        const copy = pose.copy;
        const x = copy.x();
        const opacity = x < -size * .28 || x > width + size * .28 ? 0 : copy.opacity();
        if (!opacity && !pose.opacity) continue;
        const yaw = copy.yaw(), lean = copy.lean();
        // Anything the eye could follow is drawn in its own frame. With coarser steps a spring's last swing
        // was drawn every second or third frame: the row came to rest in little jerks.
        if (
          Math.abs(x - pose.x) >= .02 ||
          Math.abs(opacity - pose.opacity) >= .002 ||
          Math.abs(yaw - pose.yaw) >= .02 ||
          Math.abs(lean - pose.lean) >= .004
        ) {
          dirty = true;
        }
      }
      if (!dirty) return;
      resized = false;
      for (const pose of poses) {
        const copy = pose.copy;
        const x = copy.x();
        pose.x = x;
        pose.opacity = x < -size * .28 || x > width + size * .28 ? 0 : copy.opacity();
        if (pose.opacity) {
          pose.yaw = copy.yaw();
          pose.lean = copy.lean();
        }
      }
      gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
      for (const pose of poses) {
        if (!pose.opacity) continue;
        const needBlend = pose.opacity < .999;
        if (needBlend !== blending) {
          blending = needBlend;
          if (needBlend) gl.enable(gl.BLEND);
          else gl.disable(gl.BLEND);
        }
        const angle = ((pose.yaw % 360 + 360) % 360) * angles / 360;
        const first = Math.floor(angle);
        bindAngle(first);
        const lean = pose.lean * Math.PI / 180;
        gl.uniform2f(turn, Math.cos(lean), Math.sin(lean));
        gl.uniform2f(blend, angle - first, pose.copy.guitarShare);
        gl.uniform2f(pivot, pose.x, (height - size) / 2 + foot);
        gl.uniform4f(colour, ...pose.rgb, pose.opacity);
        gl.colorMask(false, false, false, false);
        gl.stencilFunc(gl.ALWAYS, 0, 1);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);
        gl.drawElements(gl.TRIANGLE_STRIP, points, gl.UNSIGNED_SHORT, 0);
        gl.colorMask(true, true, true, true);
        gl.stencilFunc(gl.NOTEQUAL, 0, 1);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.ZERO);
        gl.drawElements(gl.TRIANGLE_STRIP, points, gl.UNSIGNED_SHORT, 0);
      }
    },
    dispose() {
      canvas.removeEventListener('webglcontextlost', onLoss);
      for (const binding of bindings.values()) vao?.deleteVertexArrayOES(binding);
      for (const buffer of [...models, strip]) gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.remove();
    },
  };
}
