// "Minha Empresa": escritorio isometrico em blocos (estilo voxel) com os agentes de IA trabalhando.
// Carregado so quando a aba abre (import dinamico em app.js). Tudo e desenhado por codigo (caixas
// coloridas) - nenhum modelo/imagem pra baixar; so o Three.js. A animacao pausa quando a aba fecha.
import * as THREE from './vendor/three.module.min.js';

let ctx = null;
let raiz = null;
let renderer, scene, camera, palco, canvas, tagsEl, painelEl, chipsEl, dicaEl;
let rodando = false;
let rafId = 0;
let ultimoFrame = 0;
let relogio = 0;
let estado = null;
let pollId = 0;
let agentes = [];
let pacientes = [];
let selecionado = null;
const alvoCamera = new THREE.Vector3(8, 0, 6);
let alvoAnim = null;
let spawnEm = 0;
let obsResize = null;
let entregador = null;
let entregaEm = 12;
let somLigado = false;
let audioCtx = null;
let ultCriticos = null;
const histCache = new Map();
const ativCache = new Map();
const ativTexto = (id) => ativCache.get(id)?.[0]?.texto || '';

// ---------- utilidades ----------
const matCache = new Map();
function mat(cor) {
  let m = matCache.get(cor);
  if (!m) {
    const c = new THREE.Color(cor);
    const claro = c.r > 0.6 && c.g > 0.6 && c.b > 0.6; // brancos ganham um brilho leve pra nao ficarem acinzentados
    m = new THREE.MeshLambertMaterial({ color: cor, emissive: claro ? 0x2a2f34 : 0x000000 });
    matCache.set(cor, m);
  }
  return m;
}
const geoCache = new Map();
function geo(w, h, d) {
  const k = `${w}|${h}|${d}`;
  let g = geoCache.get(k);
  if (!g) { g = new THREE.BoxGeometry(w, h, d); geoCache.set(k, g); }
  return g;
}
// caixa com o centro em (cx, cz) e a base em y0
function caixa(pai, cx, y0, cz, w, h, d, cor, opc) {
  const m = new THREE.Mesh(geo(w, h, d), opc ? new THREE.MeshLambertMaterial({ color: cor, ...opc }) : mat(cor));
  m.position.set(cx, y0 + h / 2, cz);
  pai.add(m);
  return m;
}
// caixa por canto minimo -> maximo (mais facil pra paredes)
function bloco(pai, x0, y0, z0, x1, y1, z1, cor, opc) {
  return caixa(pai, (x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, cor, opc);
}
function placa(pai, texto, w, h, { fundo = '#2c3038', cor = '#d4af37', sub = '', x, y, z, ry = 0, tam = 0.62 }) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = Math.round(512 * (h / w));
  const g = c.getContext('2d');
  g.fillStyle = fundo; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = cor; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `700 ${Math.round(c.height * (sub ? tam * 0.62 : tam))}px "Segoe UI", system-ui, sans-serif`;
  g.fillText(texto, c.width / 2, c.height * (sub ? 0.4 : 0.52));
  if (sub) {
    g.font = `500 ${Math.round(c.height * 0.2)}px "Segoe UI", system-ui, sans-serif`;
    g.globalAlpha = 0.85; g.fillText(sub, c.width / 2, c.height * 0.78);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  m.position.set(x, y, z);
  m.rotation.y = ry;
  pai.add(m);
  return m;
}
const anguloEntre = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const aleatorio = (a, b) => a + Math.random() * (b - a);
const escolher = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------- personagens (blocos) ----------
function criarPessoa({ pele = '#f1c9a5', cabelo = '#4a3426', camisa = '#2f7f86', calca = '#2c3038', longo = false, barba = false, neon = null, sapato = '#1f2229' }) {
  const g = new THREE.Group();
  const sombra = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 }));
  sombra.rotation.x = -Math.PI / 2; sombra.position.y = 0.02;
  g.add(sombra);
  const corpo = new THREE.Group();
  g.add(corpo);
  const quadris = [];
  const joelhos = [];
  for (const lado of [-1, 1]) {
    const quadril = new THREE.Group();
    quadril.position.set(lado * 0.15, 0.62, 0);
    caixa(quadril, 0, -0.31, 0, 0.2, 0.31, 0.22, calca);
    const joelho = new THREE.Group();
    joelho.position.set(0, -0.31, 0);
    caixa(joelho, 0, -0.31, 0, 0.19, 0.25, 0.2, calca);
    caixa(joelho, 0, -0.31, 0.03, 0.2, 0.07, 0.27, sapato);
    quadril.add(joelho);
    corpo.add(quadril);
    quadris.push(quadril); joelhos.push(joelho);
  }
  caixa(corpo, 0, 0.62, 0, 0.6, 0.65, 0.34, camisa);
  const bracos = [];
  for (const lado of [-1, 1]) {
    const ombro = new THREE.Group();
    ombro.position.set(lado * 0.38, 1.2, 0);
    caixa(ombro, 0, -0.32, 0, 0.16, 0.32, 0.18, camisa);
    caixa(ombro, 0, -0.55, 0, 0.14, 0.24, 0.16, pele);
    corpo.add(ombro);
    bracos.push(ombro);
  }
  const cabeca = new THREE.Group();
  cabeca.position.y = 1.27;
  caixa(cabeca, 0, 0, 0, 0.5, 0.5, 0.5, pele);
  caixa(cabeca, 0, 0.43, 0, 0.55, 0.14, 0.55, cabelo);
  caixa(cabeca, 0, 0.3, 0.27, 0.55, 0.14, 0.05, cabelo); // franja
  caixa(cabeca, 0, 0.0, -0.27, 0.55, 0.5, 0.08, cabelo); // atras
  caixa(cabeca, -0.27, 0.05, 0, 0.06, 0.45, 0.5, cabelo);
  caixa(cabeca, 0.27, 0.05, 0, 0.06, 0.45, 0.5, cabelo);
  if (longo) {
    caixa(cabeca, 0, -0.38, -0.27, 0.55, 0.42, 0.1, cabelo);
    caixa(cabeca, -0.27, -0.28, 0, 0.07, 0.3, 0.45, cabelo);
    caixa(cabeca, 0.27, -0.28, 0, 0.07, 0.3, 0.45, cabelo);
  }
  caixa(cabeca, -0.12, 0.2, 0.26, 0.07, 0.09, 0.02, '#23252b');
  caixa(cabeca, 0.12, 0.2, 0.26, 0.07, 0.09, 0.02, '#23252b');
  if (barba) caixa(cabeca, 0, 0.0, 0.265, 0.5, 0.2, 0.03, cabelo);
  else caixa(cabeca, 0, 0.08, 0.26, 0.12, 0.03, 0.02, '#b5675e');
  if (neon) {
    const brilho = { emissive: new THREE.Color(neon), emissiveIntensity: 1 };
    caixa(cabeca, 0, 0.17, 0.275, 0.52, 0.13, 0.04, neon, brilho); // visor
    for (const lado of [-1, 1]) {
      caixa(cabeca, lado * 0.3, 0.08, 0, 0.08, 0.26, 0.22, '#e8eef5'); // fone
      caixa(cabeca, lado * 0.335, 0.14, 0, 0.02, 0.1, 0.1, neon, brilho);
    }
    caixa(cabeca, 0, 0.5, 0, 0.5, 0.05, 0.08, '#e8eef5'); // arco do headset
    caixa(corpo, 0, 0.95, 0.175, 0.2, 0.2, 0.03, neon, brilho); // nucleo no peito
    caixa(corpo, 0, 0.68, 0, 0.62, 0.05, 0.36, neon, brilho); // cinto de luz
    for (const o of bracos) caixa(o, 0, -0.12, 0, 0.18, 0.04, 0.2, neon, brilho);
  }
  corpo.add(cabeca);
  return { grupo: g, corpo, quadris, joelhos, bracos, cabeca, modo: 'parado', sentadoF: 0, andaF: 0, yaw: 0, yawAlvo: 0, rota: [], vel: 1.7 };
}

function animarPessoa(p, dt, t) {
  const andando = p.modo === 'andando';
  p.andaF += ((andando ? 1 : 0) - p.andaF) * Math.min(1, dt * 10);
  p.sentadoF += (((p.modo === 'sentado' || p.sentada) ? 1 : 0) - p.sentadoF) * Math.min(1, dt * 8);
  const w = p.andaF;
  const s = p.sentadoF;
  const fase = t * 9 + (p.fase || 0);
  const passo = Math.sin(fase);
  p.quadris[0].rotation.x = passo * 0.7 * w * (1 - s) - (Math.PI / 2) * s;
  p.quadris[1].rotation.x = -passo * 0.7 * w * (1 - s) - (Math.PI / 2) * s;
  p.joelhos[0].rotation.x = (Math.PI / 2) * s + Math.max(0, -passo) * 0.5 * w;
  p.joelhos[1].rotation.x = (Math.PI / 2) * s + Math.max(0, passo) * 0.5 * w;
  p.corpo.position.y = -0.2 * s + Math.abs(passo) * 0.05 * w + Math.sin(t * 2 + (p.fase || 0)) * 0.012 * (1 - w);
  let bE = -passo * 0.6 * w;
  let bD = passo * 0.6 * w;
  let zD = 0;
  if (s > 0.5) { bE = -0.55; bD = -0.55; }
  if (p.modo === 'digitando') {
    bE = -1.2 + Math.sin(t * 17) * 0.1; bD = -1.2 + Math.sin(t * 17 + 2) * 0.1;
  } else if (p.modo === 'acenando') {
    bD = 0; zD = 2.5 + Math.sin(t * 11) * 0.3;
  }
  p.bracos[0].rotation.x = bE;
  p.bracos[1].rotation.x = bD;
  p.bracos[1].rotation.z = zD;
  p.cabeca.rotation.y = p.modo === 'digitando' ? Math.sin(t * 0.8 + (p.fase || 0)) * 0.12 : p.modo === 'parado' ? Math.sin(t * 0.6 + (p.fase || 0)) * 0.35 : 0;
  p.yaw += anguloEntre(p.yaw, p.yawAlvo) * Math.min(1, dt * 9);
  p.grupo.rotation.y = p.yaw;
}

function andar(p, dt) {
  if (!p.rota.length) return true;
  const [tx, tz] = p.rota[0];
  const dx = tx - p.grupo.position.x;
  const dz = tz - p.grupo.position.z;
  const dist = Math.hypot(dx, dz);
  const passo = p.vel * dt;
  if (dist <= passo) {
    p.grupo.position.x = tx; p.grupo.position.z = tz;
    p.rota.shift();
    return !p.rota.length;
  }
  p.grupo.position.x += (dx / dist) * passo;
  p.grupo.position.z += (dz / dist) * passo;
  p.yawAlvo = Math.atan2(dx, dz);
  p.modo = 'andando';
  return false;
}

// ---------- cenario: recepcao ----------
const ASSENTOS = [];
const PONTO_FILA = [8.5, 4.9];
const PONTO_H = [6.3, 5.4];
const ENTRADA = [4.1, -1.6];
const ROTA_SAIDA = [[6.3, 6.5], [0.8, 6.5], [0.8, 9.1], [-1.1, 9.1]];

function sofa(pai, cx, cz, larg, yaw, cor, corAlmofada) {
  const g = new THREE.Group();
  g.position.set(cx, 0, cz); g.rotation.y = yaw;
  const prof = 1.1;
  caixa(g, 0, 0.08, 0, larg, 0.37, prof, cor);
  caixa(g, 0, 0.45, -prof / 2 + 0.14, larg, 0.55, 0.28, cor);
  caixa(g, -larg / 2 + 0.14, 0.45, 0.05, 0.28, 0.3, prof - 0.1, cor);
  caixa(g, larg / 2 - 0.14, 0.45, 0.05, 0.28, 0.3, prof - 0.1, cor);
  const n = Math.round(larg / 1.1);
  for (let i = 0; i < n; i++) caixa(g, -larg / 2 + 0.4 + (larg - 0.8) * ((i + 0.5) / n), 0.45, 0.12, (larg - 0.8) / n - 0.08, 0.1, prof - 0.4, corAlmofada);
  for (const lado of [-1, 1]) caixa(g, lado * (larg / 2 - 0.15), 0, -0.3, 0.12, 0.1, 0.12, '#1f2229');
  pai.add(g);
  return g;
}
function poltrona(pai, cx, cz, cor) {
  const g = new THREE.Group();
  g.position.set(cx, 0, cz);
  caixa(g, 0, 0.1, 0, 1.15, 0.35, 1.05, cor);
  caixa(g, 0, 0.45, -0.38, 1.15, 0.6, 0.3, cor);
  caixa(g, -0.5, 0.45, 0.05, 0.22, 0.28, 0.9, cor);
  caixa(g, 0.5, 0.45, 0.05, 0.22, 0.28, 0.9, cor);
  caixa(g, 0, 0.45, 0.1, 0.78, 0.09, 0.7, '#f3ece0');
  pai.add(g);
}
function planta(pai, x, z, alta = 1) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  caixa(g, 0, 0, 0, 0.55, 0.45 * alta, 0.55, '#e9e4da');
  caixa(g, 0, 0.45 * alta, 0, 0.45, 0.06, 0.45, '#5b3d2a');
  const verde = ['#3f9a5a', '#2f8049', '#56b06e'];
  // copa em camadas largas (parece folhagem, nao pilar)
  caixa(g, 0, 0.5 * alta, 0, 0.16, 0.45 * alta, 0.16, '#5b3d2a');
  caixa(g, 0, 0.55 * alta, 0, 0.9, 0.32 * alta, 0.9, verde[1]);
  caixa(g, 0, 0.85 * alta, 0, 0.72, 0.3 * alta, 0.72, verde[0]);
  caixa(g, 0, 1.12 * alta, 0, 0.5, 0.28 * alta, 0.5, verde[2]);
  caixa(g, 0.28, 0.75 * alta, 0.2, 0.3, 0.2 * alta, 0.3, verde[2]);
  caixa(g, -0.25, 0.65 * alta, -0.2, 0.3, 0.2 * alta, 0.3, verde[0]);
  pai.add(g);
}
function monitor(pai, x, y, z, yaw) {
  const g = new THREE.Group();
  g.position.set(x, y, z); g.rotation.y = yaw;
  caixa(g, 0, 0, 0, 0.35, 0.05, 0.25, '#2c3038');
  caixa(g, 0, 0.05, 0, 0.08, 0.25, 0.08, '#2c3038');
  caixa(g, 0, 0.3, 0, 0.8, 0.5, 0.06, '#1b1d22');
  caixa(g, 0, 0.33, 0.035, 0.72, 0.43, 0.02, '#4cc3d9');
  pai.add(g);
}
function pendente(pai, x, z, y = 3.2) {
  caixa(pai, x, y - 0.7, z, 0.04, 0.7, 0.04, '#2c3038');
  caixa(pai, x, y - 0.85, z, 0.6, 0.15, 0.6, '#ffe9b0', { emissive: 0xffd98a, emissiveIntensity: 0.9 });
}

function texturaPiso(w, h, corA, corB, lado = 1) {
  const c = document.createElement('canvas');
  const px = 32;
  c.width = Math.round((w / lado) * px); c.height = Math.round((h / lado) * px);
  const g = c.getContext('2d');
  for (let i = 0; i < w / lado; i++) for (let j = 0; j < h / lado; j++) {
    g.fillStyle = (i + j) % 2 ? corA : corB;
    g.fillRect(i * px, j * px, px, px);
  }
  g.strokeStyle = 'rgba(0,0,0,0.06)'; g.lineWidth = 1;
  for (let i = 0; i <= w / lado; i++) { g.beginPath(); g.moveTo(i * px, 0); g.lineTo(i * px, c.height); g.stroke(); }
  for (let j = 0; j <= h / lado; j++) { g.beginPath(); g.moveTo(0, j * px); g.lineTo(c.width, j * px); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function lajeBase(pai, x0, z0, w, d, corPiso, corPiso2, borda = '#d4af37') {
  const g = new THREE.Group();
  g.position.set(x0, 0, z0);
  bloco(g, -0.35, -0.6, -0.35, w + 0.35, 0, d + 0.35, '#262a31');
  bloco(g, -0.35, -0.07, d + 0.35 - 0.07, w + 0.35, 0, d + 0.35, borda);
  bloco(g, w + 0.35 - 0.07, -0.07, -0.35, w + 0.35, 0, d + 0.35, borda);
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ map: texturaPiso(w, d, corPiso, corPiso2, 1), emissive: new THREE.Color(corPiso).getHSL({}).l > 0.9 ? 0x30353a : 0x000000 }));
  piso.rotation.x = -Math.PI / 2; piso.position.set(w / 2, 0.001, d / 2);
  g.add(piso);
  pai.add(g);
  return g;
}

function construirRecepcao() {
  const R = new THREE.Group();
  scene.add(R);
  lajeBase(R, 0, 0, 16, 12, '#ebe5d8', '#e0d8c8');
  const parede = '#f3efe8';
  // parede dos fundos (z = 0): faixa baixa + vidro + viga
  bloco(R, -0.3, 0, -0.3, 3, 1.0, 0, parede);
  bloco(R, 5.2, 0, -0.3, 16, 1.0, 0, parede);
  bloco(R, -0.3, 3.2, -0.3, 16, 3.4, 0, '#2c3038');
  bloco(R, -0.3, 3.4, -0.3, 16, 3.46, 0, '#d4af37');
  const vidro = { transparent: true, opacity: 0.22 };
  bloco(R, 0, 1.0, -0.12, 3, 3.2, -0.04, '#a9d8f5', vidro);
  bloco(R, 5.2, 1.0, -0.12, 16, 3.2, -0.04, '#a9d8f5', vidro);
  bloco(R, 3, 2.55, -0.12, 5.2, 3.2, -0.04, '#a9d8f5', vidro);
  for (const x of [0, 3, 5.2, 9, 12.6, 16]) bloco(R, x - 0.07, 0, -0.14, x + 0.07, 3.2, 0.02, '#2c3038');
  bloco(R, 3, 2.5, -0.14, 5.2, 2.6, 0.02, '#2c3038'); // verga da porta
  // capacho da entrada
  bloco(R, 3.2, 0, -1.4, 5.0, 0.04, -0.3, '#2c3038');
  bloco(R, 3.2, 0.04, -1.4, 5.0, 0.05, -0.3, '#d4af37');
  // painel escuro atras da recepcionista + placa
  bloco(R, 6, 1.0, 0, 12, 3.2, 0.12, '#2c3038');
  placa(R, 'RECEPÇÃO', 4.6, 0.9, { x: 9, y: 2.55, z: 0.14, sub: 'Sua consulta começa aqui', tam: 0.8 });
  bloco(R, 6.2, 1.2, 0.12, 11.8, 1.26, 0.16, '#d4af37');
  // balcao baixo atras da recepcionista
  bloco(R, 6.4, 0, 0.12, 11.6, 0.95, 0.95, '#cfc7b8');
  bloco(R, 6.3, 0.95, 0.08, 11.7, 1.03, 1.0, '#2c3038');
  // parede esquerda (x = 0): madeira, com a porta dos consultorios
  bloco(R, -0.3, 0, 0, 0, 3.4, 8.2, '#c9a27a');
  bloco(R, -0.3, 0, 10, 0, 3.4, 12.3, '#c9a27a');
  bloco(R, -0.3, 2.6, 8.2, 0, 3.4, 10, '#c9a27a');
  bloco(R, -0.31, 0, 8.1, 0.02, 2.6, 8.25, '#2c3038');
  bloco(R, -0.31, 0, 9.95, 0.02, 2.6, 10.1, '#2c3038');
  bloco(R, -0.31, 2.55, 8.1, 0.02, 2.65, 10.1, '#2c3038');
  for (let z = 0.4; z < 12; z += 0.55) if (z < 8 || z > 10.2) bloco(R, 0, 0.9, z, 0.07, 3.3, z + 0.12, '#b78d63');
  bloco(R, -0.3, 3.4, 0, 0, 3.46, 12.3, '#d4af37');
  placa(R, 'CONSULTÓRIOS', 2.2, 0.5, { x: 0.05, y: 2.95, z: 9.1, ry: Math.PI / 2, tam: 0.55 });
  // quadros na parede esquerda
  for (const [z, cor1, cor2] of [[2.6, '#2f7f86', '#d4af37'], [4.4, '#d4af37', '#2c3038'], [6.2, '#2f7f86', '#e9e4da']]) {
    bloco(R, 0.0, 1.6, z - 0.6, 0.1, 2.6, z + 0.6, '#2c3038');
    bloco(R, 0.1, 1.7, z - 0.5, 0.14, 2.5, z + 0.5, cor1);
    bloco(R, 0.14, 1.95, z - 0.3, 0.17, 2.25, z + 0.3, cor2);
  }
  // TV da fila
  bloco(R, 12.8, 1.4, 0, 15.4, 2.7, 0.12, '#14161a');
  placa(R, 'FILA DE ATENDIMENTO', 2.4, 1.1, { x: 14.1, y: 2.05, z: 0.14, fundo: '#0d1b24', cor: '#4cc3d9', sub: 'Aguarde ser chamado(a)', tam: 0.38 });
  // balcao da recepcao (frente)
  const balcao = new THREE.Group();
  R.add(balcao);
  bloco(balcao, 6, 0, 3, 12, 1.08, 4, '#f4f1ea');
  bloco(balcao, 6, 0, 3.98, 12, 1.0, 4.04, '#8a5a3b');
  bloco(balcao, 6.05, 0.3, 4.04, 11.95, 0.36, 4.07, '#d4af37');
  bloco(balcao, 5.9, 1.08, 2.9, 12.1, 1.18, 4.1, '#2c3038');
  bloco(balcao, 11, 0, 1.4, 12, 1.08, 3, '#f4f1ea');
  bloco(balcao, 10.9, 1.08, 1.4, 12.1, 1.18, 3, '#2c3038');
  monitor(R, 8.1, 1.18, 3.35, Math.PI);
  monitor(R, 9.6, 1.18, 3.35, Math.PI);
  caixa(R, 11.3, 1.18, 3.6, 0.25, 0.1, 0.25, '#d4af37'); // sininho
  planta(R, 6.5, 3.5, 0.5);
  // area de espera
  bloco(R, 1.0, 0.01, 8.2, 6.0, 0.05, 11.4, '#2f6f78'); // tapete
  bloco(R, 1.25, 0.05, 8.45, 5.75, 0.06, 11.15, '#d9c58f');
  bloco(R, 1.4, 0.06, 8.6, 5.6, 0.07, 11.0, '#2f6f78');
  sofa(R, 3.5, 7.55, 4.4, 0, '#2f6f78', '#e9dfd0');
  sofa(R, 1.4, 4.0, 4.0, Math.PI / 2, '#2f6f78', '#e9dfd0');
  poltrona(R, 8.3, 8.3, '#e9dfd0');
  poltrona(R, 11.3, 8.3, '#e9dfd0');
  // mesa de centro e mesa lateral
  caixa(R, 3.5, 0.38, 10.2, 1.7, 0.08, 0.8, '#2c3038');
  for (const [dx, dz] of [[-0.75, -0.3], [0.75, -0.3], [-0.75, 0.3], [0.75, 0.3]]) caixa(R, 3.5 + dx, 0, 10.2 + dz, 0.08, 0.38, 0.08, '#d4af37');
  caixa(R, 3.1, 0.46, 10.2, 0.28, 0.05, 0.2, '#d98b5f'); caixa(R, 3.9, 0.46, 10.1, 0.2, 0.16, 0.2, '#f3f3f3');
  caixa(R, 9.8, 0.0, 8.3, 0.7, 0.55, 0.7, '#8a5a3b'); caixa(R, 9.8, 0.55, 8.3, 0.8, 0.06, 0.8, '#2c3038');
  caixa(R, 9.8, 0.61, 8.3, 0.3, 0.45, 0.3, '#e9e4da'); caixa(R, 9.8, 1.06, 8.3, 0.2, 0.32, 0.2, '#3f9a5a');
  // plantas e bebedouro
  planta(R, 0.9, 0.9, 1.4);
  planta(R, 15.1, 1.2, 1.2);
  planta(R, 15.1, 10.9, 1.5);
  planta(R, 6.6, 11.0, 1.0);
  caixa(R, 14.7, 0, 3.2, 0.6, 1.0, 0.6, '#e9e4da'); caixa(R, 14.7, 1.0, 3.2, 0.5, 0.55, 0.5, '#7cc7e8', { transparent: true, opacity: 0.7 });
  // luminarias
  for (const [x, z] of [[7.6, 2.2], [9, 2.2], [10.4, 2.2], [3.5, 9.6], [9.8, 9.2]]) pendente(R, x, z);
  // meio-fio decorativo do corredor de entrada
  bloco(R, 3.0, 0, -3.0, 5.2, 0.02, -1.4, '#3a3f48');
  // assentos (posicao do quadril, direcao e rota a partir de H)
  const s1 = [2.4, 3.5, 4.6].map((x) => ({ x, z: 7.65, yaw: 0, ida: [[6.3, 8.7], [x, 8.7], [x, 7.65]] }));
  const s2 = [2.95, 4.0, 5.05].map((z) => ({ x: 1.45, z, yaw: Math.PI / 2, ida: [[3.0, 5.4], [3.0, z], [1.45, z]] }));
  const pol = [8.3, 11.3].map((x) => ({ x, z: 8.4, yaw: 0, ida: [[6.3, 9.5], [x, 9.5], [x, 8.4]] }));
  for (const a of [...s1, ...s2, ...pol]) ASSENTOS.push({ ...a, ocupado: false });
}

function cadeira(pai, x, z, cor = '#2c3038') {
  caixa(pai, x, 0, z, 0.1, 0.25, 0.1, '#14161a');
  caixa(pai, x, 0.25, z, 0.7, 0.14, 0.7, cor);
  caixa(pai, x, 0.39, z - 0.34, 0.7, 0.6, 0.1, cor);
}
function mesaTrabalho(pai, x, z, larg = 3.2, cor = '#f4f1ea', topo = '#2c3038') {
  caixa(pai, x, 0, z, larg, 0.95, 0.9, cor);
  caixa(pai, x, 0.95, z, larg + 0.1, 0.1, 1.0, topo);
  caixa(pai, x, 0.3, z + 0.46, larg - 0.1, 0.06, 0.02, '#d4af37');
}

let telaComercial = null;
function desenharTelaComercial() {
  if (!telaComercial) return;
  const { g, tex } = telaComercial;
  const d = estado?.agentes || {};
  g.fillStyle = '#0d1b24'; g.fillRect(0, 0, 512, 256);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#4cc3d9'; g.font = '700 34px "Segoe UI", system-ui, sans-serif';
  g.fillText('HOJE NO COMERCIAL', 256, 40);
  const linhas = [
    ['Leads atendidos', d.bia?.extras?.[0]?.[1] ?? '—', '#d1626b'],
    ['Follow-ups enviados', d.lua ? String(d.lua.hoje) : '—', '#9b7ede'],
    ['Aniversários enviados', d.lorena ? String(d.lorena.hoje) : '—', '#e0c04a'],
    ['Funis rodando hoje', d.anne ? String(d.anne.hoje) : '—', '#5cae7f'],
  ];
  linhas.forEach(([t, v, cor], i) => {
    const y = 95 + i * 42;
    g.fillStyle = cor; g.fillRect(34, y - 14, 10, 28);
    g.textAlign = 'left'; g.fillStyle = '#e8eef2'; g.font = '500 26px "Segoe UI", system-ui, sans-serif'; g.fillText(t, 58, y);
    g.textAlign = 'right'; g.fillStyle = '#ffffff'; g.font = '700 30px "Segoe UI", system-ui, sans-serif'; g.fillText(String(v), 480, y);
  });
  tex.needsUpdate = true;
}

function construirComercial() {
  const x0 = 18;
  const C = new THREE.Group();
  scene.add(C);
  lajeBase(C, x0, 0, 16, 12, '#e6e1ea', '#dcd6e2');
  const parede = '#f3efe8';
  bloco(C, x0 - 0.3, 0, -0.3, x0 + 16, 1.0, 0, parede);
  bloco(C, x0 - 0.3, 3.2, -0.3, x0 + 16, 3.4, 0, '#2c3038');
  bloco(C, x0 - 0.3, 3.4, -0.3, x0 + 16, 3.46, 0, '#d4af37');
  bloco(C, x0, 1.0, -0.12, x0 + 16, 3.2, -0.04, '#a9d8f5', { transparent: true, opacity: 0.22 });
  for (const x of [0, 5.3, 10.6, 16]) bloco(C, x0 + x - 0.07, 0, -0.14, x0 + x + 0.07, 3.2, 0.02, '#2c3038');
  // painel central dos fundos + placa
  bloco(C, x0 + 4.5, 1.0, 0, x0 + 11.5, 3.2, 0.12, '#2c3038');
  placa(C, 'COMERCIAL', 5.4, 0.9, { x: x0 + 8, y: 2.65, z: 0.14, sub: 'CRCs · atendimento e relacionamento', tam: 0.8 });
  bloco(C, x0 + 4.7, 1.2, 0.12, x0 + 11.3, 1.26, 0.16, '#d4af37');
  // TV com os numeros do dia (atualiza com os dados reais)
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  telaComercial = { g: cv.getContext('2d'), tex };
  bloco(C, x0 + 4.9, 1.1, 0.12, x0 + 11.1, 2.1, 0.17, '#14161a');
  const tv = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 0.9), new THREE.MeshBasicMaterial({ map: tex }));
  tv.position.set(x0 + 8, 1.6, 0.18); C.add(tv);
  desenharTelaComercial();
  // parede esquerda de madeira + quadro do funil
  bloco(C, x0 - 0.3, 0, 0, x0, 3.4, 12.3, '#c9a27a');
  for (let z = 0.4; z < 12; z += 0.55) bloco(C, x0, 0.9, z, x0 + 0.07, 3.3, z + 0.12, '#b78d63');
  bloco(C, x0 - 0.3, 3.4, 0, x0, 3.46, 12.3, '#d4af37');
  bloco(C, x0, 1.3, 3.0, x0 + 0.1, 3.0, 9.0, '#f6f3ee');
  const cores = ['#2f7f86', '#5b8def', '#9b7ede', '#e0c04a', '#5cae7f'];
  cores.forEach((cor, i) => bloco(C, x0 + 0.1, 1.55, 3.3 + i * 1.1, x0 + 0.14, 1.55 + 1.2 - i * 0.2, 3.3 + i * 1.1 + 0.9, cor));
  placa(C, 'FUNIL', 1.6, 0.4, { x: x0 + 0.16, y: 2.75, z: 6.0, ry: Math.PI / 2, fundo: '#f6f3ee', cor: '#2c3038', tam: 0.7 });
  // estacoes: agente sentada olhando pra camera, mesa a frente
  for (const [px, pz] of [[4, 3.2], [11.5, 3.2], [4, 8.2], [11.5, 8.2]]) {
    cadeira(C, x0 + px, pz - 0.2);
    mesaTrabalho(C, x0 + px, pz + 1.2);
    monitor(C, x0 + px - 0.7, 1.05, pz + 1.2, Math.PI);
    caixa(C, x0 + px + 0.6, 1.05, pz + 1.15, 0.5, 0.03, 0.2, '#d8dbe0');
    caixa(C, x0 + px + 1.15, 1.05, pz + 1.1, 0.2, 0.25, 0.2, '#e9e4da');
  }
  // tapete, plantas, bebedouro, estante
  bloco(C, x0 + 6.2, 0.01, 5.2, x0 + 9.8, 0.05, 7.4, '#2f6f78');
  bloco(C, x0 + 6.4, 0.05, 5.4, x0 + 9.6, 0.06, 7.2, '#d9c58f');
  planta(C, x0 + 1.0, 0.9, 1.3); planta(C, x0 + 15.0, 1.1, 1.2); planta(C, x0 + 15.0, 10.9, 1.5); planta(C, x0 + 7.8, 11.0, 1.0);
  caixa(C, x0 + 15.2, 0, 5.0, 0.6, 1.0, 0.6, '#e9e4da');
  caixa(C, x0 + 15.2, 1.0, 5.0, 0.5, 0.55, 0.5, '#7cc7e8', { transparent: true, opacity: 0.7 });
  bloco(C, x0 + 0.6, 0, 9.6, x0 + 1.5, 1.7, 11.6, '#8a5a3b');
  for (let i = 0; i < 4; i++) bloco(C, x0 + 0.5, 0.35 + i * 0.4, 9.7, x0 + 1.6, 0.4 + i * 0.4, 11.5, '#2c3038');
  for (const [x, z] of [[4, 4.4], [11.5, 4.4], [4, 9.4], [11.5, 9.4], [8, 6.3]]) pendente(C, x0 + x, z);
  return C;
}

// ---------- telas de dados (TV com numeros reais) ----------
const telas = [];
const CORES_LINHA = ['#d1626b', '#9b7ede', '#e0c04a', '#5cae7f', '#5b8def'];
const linhasDe = (id, de = 0, ate = 99) => {
  const ex = (estado?.agentes?.[id]?.extras || []).slice(de, ate);
  return ex.length ? ex.map(([k, v], i) => [k, v, CORES_LINHA[(i + de) % CORES_LINHA.length]]) : [['Carregando…', '', '#8b8d92']];
};
function desenharTela(t) {
  const { g, cv } = t;
  const L = t.linhas();
  g.fillStyle = '#0d1b24'; g.fillRect(0, 0, cv.width, cv.height);
  g.textBaseline = 'middle'; g.textAlign = 'center';
  g.fillStyle = t.cor; g.font = `700 ${Math.round(cv.height * 0.14)}px "Segoe UI", system-ui, sans-serif`;
  g.fillText(t.titulo, cv.width / 2, cv.height * 0.15);
  const top = cv.height * 0.3;
  const passo = (cv.height - top - 8) / Math.max(L.length, 1);
  L.forEach(([rot, val, cor], i) => {
    const y = top + passo * (i + 0.5);
    g.fillStyle = cor || t.cor; g.fillRect(22, y - passo * 0.3, 8, passo * 0.6);
    g.textAlign = 'left'; g.fillStyle = '#e8eef2'; g.font = `500 ${Math.round(Math.min(passo * 0.5, 26))}px "Segoe UI", system-ui, sans-serif`;
    g.fillText(String(rot).slice(0, 30), 44, y);
    g.textAlign = 'right'; g.fillStyle = '#ffffff'; g.font = `700 ${Math.round(Math.min(passo * 0.56, 28))}px "Segoe UI", system-ui, sans-serif`;
    g.fillText(String(val), cv.width - 22, y);
  });
  t.tex.needsUpdate = true;
}
function novaTela(pai, { x, y, z, w, h, titulo, cor = '#4cc3d9', linhas }) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = Math.round(512 * (h / w));
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  m.position.set(x, y, z);
  pai.add(m);
  const t = { g: cv.getContext('2d'), tex, cv, titulo, cor, linhas };
  telas.push(t);
  desenharTela(t);
  bloco(pai, x - w / 2 - 0.08, y - h / 2 - 0.08, z - 0.03, x + w / 2 + 0.08, y + h / 2 + 0.08, z - 0.01, '#14161a');
  return m;
}
function desenharTelas() { telas.forEach(desenharTela); }

// sala padrao (laje, vidro nos fundos, parede de madeira a esquerda, painel com a placa do setor)
function salaPadrao(nome, sub, x0, z0, { piso = ['#e6e1ea', '#dcd6e2'], escuro = false, tema = {} } = {}) {
  const T = { painel: '#2c3038', viga: '#2c3038', trim: '#d4af37', faixa: '#d4af37', placaFundo: '#2c3038', placaCor: '#d4af37', esq: escuro ? '#3a3f48' : '#c9a27a', ripa: escuro ? '#2f343c' : '#b78d63', ...tema };
  const C = new THREE.Group();
  scene.add(C);
  lajeBase(C, x0, z0, 16, 12, piso[0], piso[1], T.trim);
  bloco(C, x0 - 0.3, 0, z0 - 0.3, x0 + 16, 1.0, z0, escuro ? '#3a3f48' : '#f3efe8');
  bloco(C, x0 - 0.3, 3.2, z0 - 0.3, x0 + 16, 3.4, z0, T.viga);
  bloco(C, x0 - 0.3, 3.4, z0 - 0.3, x0 + 16, 3.46, z0, T.trim);
  bloco(C, x0, 1.0, z0 - 0.12, x0 + 16, 3.2, z0 - 0.04, '#a9d8f5', { transparent: true, opacity: 0.22 });
  for (const x of [0, 5.3, 10.6, 16]) bloco(C, x0 + x - 0.07, 0, z0 - 0.14, x0 + x + 0.07, 3.2, z0 + 0.02, '#2c3038');
  bloco(C, x0 + 1, 1.0, z0, x0 + 15, 3.2, z0 + 0.12, T.painel);
  placa(C, nome.toUpperCase(), 5.4, 0.8, { x: x0 + 8, y: 2.8, z: z0 + 0.14, sub, tam: 0.8, fundo: T.placaFundo, cor: T.placaCor });
  bloco(C, x0 + 1.2, 1.0, z0 + 0.12, x0 + 14.8, 1.06, z0 + 0.16, T.faixa, T.faixa === '#4cc3d9' ? { emissive: new THREE.Color('#4cc3d9'), emissiveIntensity: 1 } : undefined);
  bloco(C, x0 - 0.3, 0, z0, x0, 3.4, z0 + 12.3, T.esq);
  for (let z = 0.4; z < 12; z += 0.55) bloco(C, x0, 0.9, z0 + z, x0 + 0.07, 3.3, z0 + z + 0.12, T.ripa);
  bloco(C, x0 - 0.3, 3.4, z0, x0, 3.46, z0 + 12.3, T.trim);
  planta(C, x0 + 1.0, z0 + 0.9, 1.3); planta(C, x0 + 15.0, z0 + 1.1, 1.2); planta(C, x0 + 15.0, z0 + 10.9, 1.5); planta(C, x0 + 7.8, z0 + 11.0, 1.0);
  return C;
}
function tvDoSetor(C, x0, z0, titulo, linhas, cor) {
  novaTela(C, { x: x0 + 8, y: 1.65, z: z0 + 0.2, w: 6.0, h: 1.2, titulo, linhas, cor });
}

function construirLaboratorio() {
  const x0 = 0; const z0 = 14;
  const C = salaPadrao('Laboratório', 'Próteses · andamento dos trabalhos', x0, z0, { piso: ['#e3e8ec', '#d8dfe5'] });
  tvDoSetor(C, x0, z0, 'LABORATÓRIO · SEMANA', () => linhasDe('lay'), '#4cc3d9');
  // bancada principal (Lay) com microscopio e modelos de gesso
  cadeira(C, x0 + 7, z0 + 3.0, '#3a4a6b');
  mesaTrabalho(C, x0 + 8, z0 + 4.4, 5.6, '#d8dde3');
  caixa(C, x0 + 6.0, 1.05, z0 + 4.4, 0.4, 0.06, 0.32, '#2c3038'); caixa(C, x0 + 6.0, 1.1, z0 + 4.45, 0.1, 0.5, 0.1, '#2c3038'); caixa(C, x0 + 6.0, 1.45, z0 + 4.35, 0.25, 0.2, 0.36, '#14161a');
  caixa(C, x0 + 8.9, 1.05, z0 + 4.4, 1.9, 0.08, 0.5, '#e8a6a0');
  for (let i = 0; i < 7; i++) caixa(C, x0 + 8.15 + i * 0.25, 1.13, z0 + 4.4, 0.19, 0.16, 0.22, '#f6f3ee');
  caixa(C, x0 + 10.0, 1.05, z0 + 4.7, 0.5, 0.05, 0.3, '#5b8def'); caixa(C, x0 + 10.0, 1.1, z0 + 4.7, 0.4, 0.14, 0.2, '#f6f3ee');
  // segunda bancada com bandejas de trabalhos
  mesaTrabalho(C, x0 + 8, z0 + 8.8, 7, '#cfd6dc');
  ['#d1626b', '#e0c04a', '#5cae7f', '#5b8def', '#9b7ede', '#d98b5f'].forEach((cor, i) => {
    caixa(C, x0 + 5.5 + i * 1.0, 1.05, z0 + 8.8, 0.7, 0.05, 0.5, cor);
    caixa(C, x0 + 5.5 + i * 1.0, 1.1, z0 + 8.8, 0.3, 0.12, 0.25, '#f6f3ee');
  });
  // estante de bandejas, forno e impressora 3D
  bloco(C, x0 + 1.0, 0, z0 + 0.6, x0 + 3.8, 2.3, z0 + 1.4, '#8a5a3b');
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) bloco(C, x0 + 1.15 + c * 0.52, 0.2 + r * 0.55, z0 + 1.4, x0 + 1.6 + c * 0.52, 0.55 + r * 0.55, z0 + 1.46, ['#d1626b', '#e0c04a', '#5cae7f', '#5b8def', '#9b7ede'][(r + c) % 5]);
  bloco(C, x0 + 12.2, 0, z0 + 0.7, x0 + 14.4, 1.4, z0 + 1.9, '#3a3f48');
  caixa(C, x0 + 13.3, 0.55, z0 + 1.93, 1.0, 0.55, 0.04, '#ff8a3d', { emissive: 0xff7a1f, emissiveIntensity: 0.9 });
  bloco(C, x0 + 14.0, 0, z0 + 4.4, x0 + 15.2, 1.5, z0 + 5.6, '#e9e4da');
  bloco(C, x0 + 14.1, 0.6, z0 + 4.5, x0 + 15.1, 1.4, z0 + 5.5, '#7cc7e8', { transparent: true, opacity: 0.45 });
  // quadro de trabalhos
  bloco(C, x0, 1.3, z0 + 3.0, x0 + 0.1, 3.0, z0 + 9.0, '#f6f3ee');
  [['#d1626b', 4], ['#e0c04a', 3], ['#5cae7f', 2]].forEach(([cor, n], col) => { for (let i = 0; i < n; i++) bloco(C, x0 + 0.1, 2.5 - i * 0.45, z0 + 3.3 + col * 1.9, x0 + 0.14, 2.85 - i * 0.45, z0 + 4.8 + col * 1.9, cor); });
  placa(C, 'TRABALHOS', 1.8, 0.4, { x: x0 + 0.16, y: 2.9, z: z0 + 6.0, ry: Math.PI / 2, fundo: '#f6f3ee', cor: '#2c3038', tam: 0.7 });
  for (const [x, z] of [[7, 4.4], [8, 9.4], [3, 6]]) pendente(C, x0 + x, z0 + z);
}

function construirFinanceiro() {
  const x0 = 18; const z0 = 14;
  const C = salaPadrao('Financeiro', 'Caixa, vendas e contas', x0, z0, { piso: ['#e4e6df', '#d9dcd2'] });
  tvDoSetor(C, x0, z0, 'FINANCEIRO · MÊS', () => linhasDe('mya', 0, 3), '#e0c04a');
  cadeira(C, x0 + 8, z0 + 3.0, '#2f6f45');
  mesaTrabalho(C, x0 + 8, z0 + 4.4, 5.0, '#f4f1ea');
  monitor(C, x0 + 7.1, 1.05, z0 + 4.4, Math.PI); monitor(C, x0 + 8.9, 1.05, z0 + 4.4, Math.PI);
  caixa(C, x0 + 10.1, 1.05, z0 + 4.6, 0.3, 0.06, 0.4, '#2c3038');
  for (let i = 0; i < 4; i++) caixa(C, x0 + 6.0, 1.05 + i * 0.05, z0 + 4.7, 0.5, 0.05, 0.35, i % 2 ? '#e9e4da' : '#f6f3ee');
  for (let i = 0; i < 5; i++) caixa(C, x0 + 10.7, 1.05 + i * 0.06, z0 + 4.2, 0.35, 0.05, 0.35, '#d4af37');
  // cofre, arquivos e mural de grafico
  bloco(C, x0 + 12.6, 0, z0 + 0.8, x0 + 14.4, 1.7, z0 + 2.2, '#4a5058');
  bloco(C, x0 + 12.8, 0.3, z0 + 2.2, x0 + 14.2, 1.4, z0 + 2.26, '#3a3f48');
  caixa(C, x0 + 13.5, 0.7, z0 + 2.3, 0.35, 0.35, 0.05, '#d4af37');
  for (let i = 0; i < 3; i++) {
    bloco(C, x0 + 0.5, 0, z0 + 7.0 + i * 1.5, x0 + 1.6, 1.3, z0 + 8.3 + i * 1.5, '#9aa1aa');
    bloco(C, x0 + 1.6, 0.25, z0 + 7.2 + i * 1.5, x0 + 1.66, 0.55, z0 + 8.1 + i * 1.5, '#7a828c');
    bloco(C, x0 + 1.6, 0.8, z0 + 7.2 + i * 1.5, x0 + 1.66, 1.1, z0 + 8.1 + i * 1.5, '#7a828c');
  }
  bloco(C, x0, 1.3, z0 + 2.6, x0 + 0.1, 3.0, z0 + 7.0, '#f6f3ee');
  [0.5, 0.8, 0.7, 1.1, 1.0, 1.4].forEach((h, i) => bloco(C, x0 + 0.1, 1.45, z0 + 2.85 + i * 0.66, x0 + 0.15, 1.45 + h, z0 + 3.35 + i * 0.66, i % 2 ? '#2f7f86' : '#d4af37'));
  placa(C, 'CAIXA', 1.5, 0.4, { x: x0 + 0.17, y: 2.85, z: z0 + 4.8, ry: Math.PI / 2, fundo: '#f6f3ee', cor: '#2c3038', tam: 0.7 });
  poltrona(C, x0 + 5, z0 + 9.2, '#2f6f45'); poltrona(C, x0 + 8.5, z0 + 9.2, '#2f6f45');
  caixa(C, x0 + 6.75, 0, z0 + 9.3, 0.7, 0.5, 0.7, '#8a5a3b'); caixa(C, x0 + 6.75, 0.5, z0 + 9.3, 0.8, 0.06, 0.8, '#2c3038');
  for (const [x, z] of [[8, 4.4], [6.8, 9.6]]) pendente(C, x0 + x, z0 + z);
}

const animados = [];
function construirTrafego() {
  const x0 = 36; const z0 = 0;
  const CIANO = '#4cc3d9';
  const luz = { emissive: new THREE.Color(CIANO), emissiveIntensity: 1 };
  const C = salaPadrao('Tráfego Pago', 'Campanhas, dados e estratégia', x0, z0, {
    piso: ['#f4f8fb', '#e7eef3'],
    tema: { painel: '#f4f8fb', viga: '#eef3f7', trim: CIANO, faixa: CIANO, placaFundo: '#ffffff', placaCor: '#0a8fa8', esq: '#e9eff4', ripa: '#d3dde6' },
  });
  // linhas de luz no chao (bordas abertas da sala) e halo sob a mesa
  bloco(C, x0, 0.01, z0 + 11.5, x0 + 16, 0.05, z0 + 11.62, CIANO, luz);
  bloco(C, x0 + 15.5, 0.01, z0, x0 + 15.62, 0.05, z0 + 11.5, CIANO, luz);
  bloco(C, x0 + 4.6, 0.01, z0 + 1.8, x0 + 11.4, 0.04, z0 + 6.6, '#bff1fa', { transparent: true, opacity: 0.55 });
  // 3 telas de dados holograficas nos fundos
  const painel = (cx, titulo, linhas, cor) => novaTela(C, { x: x0 + cx, y: 1.95, z: z0 + 0.2, w: 3.9, h: 1.4, titulo, linhas, cor });
  painel(3.5, 'CAMPANHAS', () => linhasDe('kyan', 0, 2), CIANO);
  painel(8, 'GASTO HOJE', () => linhasDe('kyan', 2, 3), '#e0c04a');
  painel(12.5, 'RESULTADOS', () => linhasDe('kyan', 3, 4), '#3ddc84');
  // mesa branca com tampo de vidro e 3 monitores
  cadeira(C, x0 + 8, z0 + 3.4, '#dfe7ee');
  mesaTrabalho(C, x0 + 8, z0 + 4.6, 6.0, '#f7fafc', '#cfeff6');
  bloco(C, x0 + 5.0, 0.3, z0 + 5.05, x0 + 11.0, 0.36, z0 + 5.08, CIANO, luz);
  for (const dx of [-1.5, 0, 1.5]) monitor(C, x0 + 8 + dx, 1.05, z0 + 4.6, Math.PI);
  caixa(C, x0 + 5.6, 1.05, z0 + 4.8, 0.5, 0.03, 0.2, '#cfd8e0'); caixa(C, x0 + 10.6, 1.05, z0 + 4.7, 0.2, 0.25, 0.2, CIANO, luz);
  // globo holografico e anel girando ao lado da mesa
  caixa(C, x0 + 12.3, 0, z0 + 4.3, 0.7, 0.9, 0.7, '#f7fafc'); caixa(C, x0 + 12.3, 0.9, z0 + 4.3, 0.8, 0.06, 0.8, CIANO, luz);
  const globo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshBasicMaterial({ color: CIANO, wireframe: true, transparent: true, opacity: 0.85 }));
  globo.position.set(x0 + 12.3, 1.75, z0 + 4.3); C.add(globo); animados.push({ obj: globo, vel: 0.8 });
  const anel = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.02, 6, 36), new THREE.MeshBasicMaterial({ color: CIANO }));
  anel.position.copy(globo.position); anel.rotation.x = Math.PI / 2.4; C.add(anel); animados.push({ obj: anel, vel: -1.2 });
  // sofa de brainstorm, rack de servidor branco e quadro de estrategia
  sofa(C, x0 + 4.5, z0 + 9.2, 4.2, 0, '#f1f5f8', CIANO);
  caixa(C, x0 + 4.5, 0.38, z0 + 11.0, 1.6, 0.08, 0.7, '#cfeff6');
  bloco(C, x0 + 13.0, 0, z0 + 8.0, x0 + 14.6, 2.3, z0 + 9.4, '#eef3f7');
  for (let i = 0; i < 6; i++) caixa(C, x0 + 13.3 + (i % 2) * 0.6, 0.35 + Math.floor(i / 2) * 0.6, z0 + 9.42, 0.15, 0.08, 0.04, i % 3 ? '#3ddc84' : CIANO, { emissive: new THREE.Color(i % 3 ? '#3ddc84' : CIANO), emissiveIntensity: 1 });
  bloco(C, x0, 1.3, z0 + 3.0, x0 + 0.1, 3.0, z0 + 9.0, '#ffffff');
  [CIANO, '#5b8def', '#9b7ede', '#e0c04a'].forEach((cor, i) => bloco(C, x0 + 0.1, 1.6, z0 + 3.4 + i * 1.3, x0 + 0.14, 1.6 + 1.2 - i * 0.28, z0 + 3.4 + i * 1.3 + 1.0, cor));
  placa(C, 'ESTRATÉGIA', 2.0, 0.4, { x: x0 + 0.16, y: 2.85, z: z0 + 6.0, ry: Math.PI / 2, fundo: '#ffffff', cor: '#0a8fa8', tam: 0.7 });
  for (const [x, z] of [[8, 4.6], [4.5, 9.6]]) pendente(C, x0 + x, z0 + z);
}

// ---------- agentes e pacientes ----------
function criarAgente(def) {
  const p = criarPessoa(def.visual);
  p.grupo.position.set(def.x, 0, def.z);
  p.yaw = p.yawAlvo = def.yaw || 0;
  p.fase = def.fase || 0;
  p.sentada = !!def.sentada;
  scene.add(p.grupo);
  const tag = document.createElement('button');
  tag.type = 'button';
  tag.className = `emp-tag ${def.tagClasse || ''}`;
  tag.innerHTML = '<span class="emp-tag-nome"></span><i class="emp-tag-dot"></i>';
  tag.querySelector('.emp-tag-nome').textContent = def.nome;
  tag.addEventListener('click', (ev) => { ev.stopPropagation(); selecionar(def.id); });
  const bolha = document.createElement('div');
  bolha.className = 'emp-bolha';
  bolha.hidden = true;
  tagsEl.append(bolha, tag);
  const a = { ...def, pessoa: p, tag, bolha, dot: tag.querySelector('.emp-tag-dot'), ocupada: false, bolhaAte: 0, tagY: def.tagY || 2.15 };
  agentes.push(a);
  return a;
}

const FRASES = { lay: 'Conferindo os trabalhos…', mya: 'Fechando o caixa…', kyan: 'Otimizando campanhas…', bia: 'Respondendo lead novo…', lua: 'Enviando follow-up…', lorena: 'Enviando aniversário…', anne: 'Conduzindo o funil…' };
const PELES = ['#f1c9a5', '#e0ac82', '#c68a63', '#8d5a3b', '#f6d7b8'];
const CABELOS = ['#2a1e17', '#4a3426', '#6b4a2f', '#1b1b1f', '#a37b45', '#7a2e2e'];
const CAMISAS = ['#d98b5f', '#5b8def', '#9b7ede', '#e0c04a', '#5cae7f', '#d1626b', '#7d8896', '#eeeeee'];
const CALCAS = ['#2c3038', '#3b4a6b', '#4d4337', '#5b5f68'];

function novoPaciente(preSentado = false) {
  const p = criarPessoa({ pele: escolher(PELES), cabelo: escolher(CABELOS), camisa: escolher(CAMISAS), calca: escolher(CALCAS), longo: Math.random() < 0.45 });
  p.fase = Math.random() * 6;
  p.vel = aleatorio(1.4, 1.9);
  p.estagio = 'entrando';
  p.espera = 0;
  p.assento = null;
  scene.add(p.grupo);
  if (preSentado) {
    const livre = ASSENTOS.filter((a) => !a.ocupado);
    if (livre.length) {
      const a = escolher(livre);
      a.ocupado = true; p.assento = a;
      p.grupo.position.set(a.x, 0, a.z);
      p.yaw = p.yawAlvo = a.yaw;
      p.modo = 'sentado'; p.sentadoF = 1;
      p.estagio = 'sentado'; p.espera = aleatorio(6, 22);
      pacientes.push(p);
      return p;
    }
  }
  p.grupo.position.set(ENTRADA[0], 0, ENTRADA[1]);
  p.yaw = p.yawAlvo = 0;
  p.rota = [[4.1, 0.4], [4.1, PONTO_FILA[1]], PONTO_FILA];
  pacientes.push(p);
  return p;
}

const LAB_FRENTE = [14, 26];
function novoEntregador() {
  const p = criarPessoa({ pele: escolher(PELES), cabelo: escolher(CABELOS), camisa: '#d98b5f', calca: '#3b4a6b', longo: false });
  p.fase = Math.random() * 6;
  p.vel = 1.8;
  p.estagio = 'entrando';
  p.caixa = caixa(p.corpo, 0, 0.8, 0.42, 0.45, 0.3, 0.32, '#c9a27a');
  p.grupo.position.set(LAB_FRENTE[0], 0, LAB_FRENTE[1]);
  p.yaw = p.yawAlvo = Math.PI;
  p.rota = [[13, 20.6], [9.6, 20.6]];
  scene.add(p.grupo);
  return p;
}
function atualizarEntregador(p, dt) {
  if (p.estagio === 'entrando' || p.estagio === 'saindo') {
    if (!andar(p, dt)) return;
    if (p.estagio === 'saindo') { scene.remove(p.grupo); entregador = null; entregaEm = aleatorio(22, 40); return; }
    p.estagio = 'entrega'; p.espera = 3.5; p.modo = 'parado'; p.yawAlvo = Math.PI;
    const lay = agentes.find((a) => a.id === 'lay');
    if (lay) { lay.saudarAte = relogio + 2; falar(lay, 'Chegou trabalho do laboratório!', 3); }
    return;
  }
  p.espera -= dt;
  if (p.espera < 1.5 && p.caixa) { p.corpo.remove(p.caixa); p.caixa = null; }
  if (p.espera <= 0) { p.estagio = 'saindo'; p.rota = [[13, 20.6], LAB_FRENTE]; }
}

function removerPaciente(p) {
  scene.remove(p.grupo);
  if (p.assento) p.assento.ocupado = false;
  pacientes = pacientes.filter((x) => x !== p);
}

function atualizarPaciente(p, dt, liz) {
  if (p.estagio === 'entrando' || p.estagio === 'indo' || p.estagio === 'saindo') {
    const chegou = andar(p, dt);
    if (!chegou) return;
    if (p.estagio === 'entrando') { p.estagio = 'checkin'; p.espera = aleatorio(3.5, 5); p.modo = 'parado'; p.yawAlvo = 0; liz.saudarAte = relogio + 1.6; falar(liz, escolher(['Bem-vindo(a)!', 'Olá! Já te atendo', 'Boa tarde! Seu nome?']), 2.2); return; }
    if (p.estagio === 'indo') { p.estagio = 'sentado'; p.modo = 'sentado'; p.yawAlvo = p.assento.yaw; p.espera = aleatorio(9, 24); return; }
    if (p.estagio === 'saindo') { removerPaciente(p); }
    return;
  }
  p.espera -= dt;
  if (p.estagio === 'checkin' && p.espera <= 0) {
    const livres = ASSENTOS.filter((a) => !a.ocupado);
    if (!livres.length) { p.espera = 2; return; }
    const a = escolher(livres);
    a.ocupado = true; p.assento = a;
    p.rota = [PONTO_H, ...a.ida];
    p.estagio = 'indo';
  } else if (p.estagio === 'sentado' && p.espera <= 0) {
    const a = p.assento;
    const volta = a.ida.slice(0, -1).reverse();
    p.rota = [...volta, PONTO_H, ...ROTA_SAIDA];
    p.grupo.position.x = a.x; p.grupo.position.z = a.z;
    a.ocupado = false; p.assento = null;
    p.estagio = 'saindo';
    p.modo = 'andando';
  }
}

function falar(agente, texto, seg = 3) {
  agente.bolha.textContent = texto;
  agente.bolha.hidden = false;
  agente.bolhaAte = relogio + seg;
}

// ---------- dados reais ----------
async function buscarEstado() {
  try {
    estado = await ctx.api('/api/empresa/estado');
    const crit = Number(estado?.agentes?.kyan?.extras?.[1]?.[1]);
    if (Number.isFinite(crit)) { if (somLigado && ultCriticos !== null && crit > ultCriticos) tocarAlerta(); ultCriticos = crit; }
    atualizarPainel();
    if (selecionado) carregarAtividade(selecionado);
    for (const [id, d] of Object.entries(estado?.agentes || {})) if (d.ativa && id !== selecionado?.id) carregarAtividade({ id });
    desenharTelaComercial();
    desenharTelas();
  } catch { /* mantem o ultimo estado */ }
}

function tocarAlerta() {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume?.();
    [0, 0.22].forEach((atraso) => {
      const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = atraso ? 660 : 880;
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime + atraso);
      g.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + atraso + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + atraso + 0.18);
      o.connect(g).connect(audioCtx.destination);
      o.start(audioCtx.currentTime + atraso); o.stop(audioCtx.currentTime + atraso + 0.2);
    });
  } catch { /* sem audio no aparelho */ }
}

function tempoAtras(iso) {
  if (!iso) return 'ainda sem atividade';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return 'agora há pouco';
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  return `há ${Math.round(s / 86400)} dia(s)`;
}

function selecionar(id) {
  selecionado = agentes.find((a) => a.id === id) || null;
  atualizarPainel();
  if (selecionado) { carregarHistorico(selecionado); carregarAtividade(selecionado); }
  if (selecionado) {
    const p = selecionado.pessoa.grupo.position;
    irPara(p.x + 0.5, p.z + 1.5, 1.8);
  }
}

const quandoCurto = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Maceio' }) === d.toLocaleDateString('pt-BR', { timeZone: 'America/Maceio' });
  return hoje ? d.toLocaleTimeString('pt-BR', { timeZone: 'America/Maceio', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString('pt-BR', { timeZone: 'America/Maceio', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};
async function carregarAtividade(a) {
  try {
    const { itens } = await ctx.api(`/api/empresa/atividade?agente=${a.id}`);
    ativCache.set(a.id, itens);
    if (selecionado !== a || !painelEl) return;
    const ul = painelEl.querySelector('.emp-p-ativ ul');
    ul.textContent = '';
    if (!itens.length) { const li = document.createElement('li'); li.className = 'vazio'; li.textContent = 'Nada registrado ainda.'; ul.appendChild(li); return; }
    for (const it of itens) {
      const li = document.createElement('li');
      if (it.nivel === 'critico') li.className = 'crit';
      const h = document.createElement('em'); h.textContent = quandoCurto(it.quando);
      const t = document.createElement('span'); t.textContent = it.texto;
      li.append(h, t);
      ul.appendChild(li);
    }
  } catch { /* mantem o que ja estava na tela */ }
}

async function carregarHistorico(a) {
  const alvo = painelEl?.querySelector('.emp-p-graf');
  if (!alvo) return;
  const tit = alvo.querySelector('small');
  const barras = alvo.querySelector('.emp-p-barras');
  const desenhar = (h) => {
    tit.textContent = h.titulo;
    barras.textContent = '';
    const max = Math.max(1, ...h.pontos.map((x) => x.valor));
    for (const pt of h.pontos) {
      const b = document.createElement('div');
      b.className = 'emp-barra';
      b.title = `${pt.rotulo}: ${pt.valor}`;
      const v = document.createElement('span'); v.textContent = pt.valor > 999 ? `${Math.round(pt.valor / 100) / 10}k` : String(Math.round(pt.valor * 10) / 10);
      const i = document.createElement('i'); i.style.height = `${Math.max(3, (pt.valor / max) * 46)}px`;
      const l = document.createElement('em'); l.textContent = pt.rotulo;
      b.append(v, i, l);
      barras.appendChild(b);
    }
    if (!h.pontos.length) tit.textContent = `${h.titulo} — sem dados ainda`;
  };
  const c = histCache.get(a.id);
  if (c && Date.now() - c.em < 60000) return desenhar(c.h);
  tit.textContent = 'Carregando histórico…'; barras.textContent = '';
  try {
    const h = await ctx.api(`/api/empresa/historico?agente=${a.id}`);
    if (selecionado !== a) return;
    if (h.carregando) { tit.textContent = 'Buscando no Meta… aguarde alguns segundos'; setTimeout(() => { if (selecionado === a) carregarHistorico(a); }, 5000); return; }
    histCache.set(a.id, { em: Date.now(), h });
    desenhar(h);
  } catch { tit.textContent = 'Histórico indisponível'; }
}

function atualizarPainel() {
  if (!painelEl) return;
  const a = selecionado;
  painelEl.hidden = !a;
  if (!a) return;
  const d = estado?.agentes?.[a.id];
  const ativa = !!d?.ativa;
  const alerta = d?.alerta || null;
  painelEl.querySelector('.emp-p-nome').textContent = a.nome;
  painelEl.querySelector('.emp-p-funcao').textContent = a.funcao;
  const st = painelEl.querySelector('.emp-p-status');
  st.textContent = alerta ? 'Atenção' : ativa ? 'Trabalhando agora' : 'Disponível';
  st.className = `emp-p-status ${alerta ? 'alerta' : ativa ? 'on' : ''}`;
  const linhas = [];
  if (alerta) linhas.push(['Alerta', alerta]);
  if (!['lay', 'mya', 'kyan'].includes(a.id)) linhas.push(['Mensagens enviadas hoje', d ? String(d.hoje) : '—']);
  linhas.push([['lay', 'mya'].includes(a.id) ? 'Último lançamento' : 'Última atividade', d ? tempoAtras(d.ultimaEm) : '—']);
  for (const [k, v] of d?.extras || []) linhas.push([k, v]);
  if (a.id === 'liz') linhas.push(['Consultas na agenda hoje', estado?.pacientesHoje == null ? 'agenda não conectada' : String(estado.pacientesHoje)]);
  painelEl.querySelector('.emp-p-dados').innerHTML = linhas.map(([k, v]) => `<div><span>${k}</span><strong></strong></div>`).join('');
  painelEl.querySelectorAll('.emp-p-dados strong').forEach((el, i) => { el.textContent = linhas[i][1]; });
  painelEl.querySelector('.emp-p-av').style.background = a.visual.camisa;
  painelEl.querySelector('.emp-p-av').textContent = a.nome[0];
}

// ---------- camera ----------
const OFFSET_CAM = new THREE.Vector3(1, 0.86, 1).normalize().multiplyScalar(60);
function posicionarCamera() {
  camera.position.copy(alvoCamera).add(OFFSET_CAM);
  camera.lookAt(alvoCamera);
  camera.updateMatrixWorld();
}
function ajustarTamanho() {
  if (!renderer || !palco) return;
  const w = palco.clientWidth || 800;
  const h = palco.clientHeight || 500;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(w, h, false);
  const asp = w / h;
  const base = w < 700 ? 19 : 15; // altura visivel em unidades do mundo
  if (!camera.userData.pronto) { camera.userData.pronto = true; camera.zoom = w < 700 ? 1.45 : 1.1; }
  camera.left = (-base * asp) / 2; camera.right = (base * asp) / 2;
  camera.top = base / 2; camera.bottom = -base / 2;
  camera.updateProjectionMatrix();
}
const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raio = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pontoNoChao(cx, cy, alvo) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  raio.setFromCamera(ndc, camera);
  return raio.ray.intersectPlane(plano, alvo);
}
function irPara(x, z, zoom) {
  alvoAnim = { x, z, zoom: zoom || camera.zoom, t: 0, x0: alvoCamera.x, z0: alvoCamera.z, z00: camera.zoom };
}

function ligarControles() {
  const ponteiros = new Map();
  let p0 = null;
  let dist0 = 0;
  let zoom0 = 1;
  let moveu = 0;
  const tmp = new THREE.Vector3();
  canvas.addEventListener('pointerdown', (ev) => {
    canvas.setPointerCapture(ev.pointerId);
    ponteiros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    moveu = 0;
    alvoAnim = null;
    if (ponteiros.size === 1) { p0 = pontoNoChao(ev.clientX, ev.clientY, new THREE.Vector3()); }
    if (ponteiros.size === 2) {
      const [a, b] = [...ponteiros.values()];
      dist0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = camera.zoom;
    }
    dicaEl.classList.add('some');
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (!ponteiros.has(ev.pointerId)) return;
    const ant = ponteiros.get(ev.pointerId);
    moveu += Math.abs(ev.clientX - ant.x) + Math.abs(ev.clientY - ant.y);
    ponteiros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (ponteiros.size === 2) {
      const [a, b] = [...ponteiros.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      camera.zoom = Math.min(3, Math.max(0.55, zoom0 * (d / (dist0 || 1))));
      camera.updateProjectionMatrix();
      return;
    }
    if (ponteiros.size === 1 && p0 && pontoNoChao(ev.clientX, ev.clientY, tmp)) {
      alvoCamera.x += p0.x - tmp.x; alvoCamera.z += p0.z - tmp.z;
      limitarAlvo();
      posicionarCamera();
    }
  });
  const soltar = (ev) => {
    ponteiros.delete(ev.pointerId);
    if (ponteiros.size === 1) { const [r] = [...ponteiros.values()]; p0 = pontoNoChao(r.x, r.y, new THREE.Vector3()); }
    if (!ponteiros.size && moveu < 8 && ev.type === 'pointerup') clicouNoPalco(ev.clientX, ev.clientY);
  };
  canvas.addEventListener('pointerup', soltar);
  canvas.addEventListener('pointercancel', soltar);
  canvas.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const f = Math.exp(-ev.deltaY * 0.0015);
    camera.zoom = Math.min(3, Math.max(0.55, camera.zoom * f));
    camera.updateProjectionMatrix();
    dicaEl.classList.add('some');
  }, { passive: false });
}
function limitarAlvo() {
  alvoCamera.x = Math.min(60, Math.max(-6, alvoCamera.x));
  alvoCamera.z = Math.min(34, Math.max(-6, alvoCamera.z));
}
function clicouNoPalco(cx, cy) {
  const r = canvas.getBoundingClientRect();
  let melhor = null;
  let md = 70;
  const v = new THREE.Vector3();
  for (const a of agentes) {
    a.pessoa.grupo.getWorldPosition(v);
    v.y += 1.0;
    v.project(camera);
    const sx = r.left + ((v.x + 1) / 2) * r.width;
    const sy = r.top + ((1 - v.y) / 2) * r.height;
    const dd = Math.hypot(sx - cx, sy - cy);
    if (dd < md) { md = dd; melhor = a; }
  }
  if (melhor) selecionar(melhor.id); else { selecionado = null; atualizarPainel(); }
}

// ---------- loop ----------
function quadro(agora) {
  if (!rodando) return;
  rafId = requestAnimationFrame(quadro);
  if (agora - ultimoFrame < 33) return; // ~30 quadros por segundo
  const dt = Math.min(0.1, (agora - (ultimoFrame || agora)) / 1000);
  ultimoFrame = agora;
  relogio += dt;
  const liz = agentes[0];

  if (alvoAnim) {
    alvoAnim.t = Math.min(1, alvoAnim.t + dt / 0.9);
    const e = 1 - (1 - alvoAnim.t) ** 3;
    alvoCamera.x = alvoAnim.x0 + (alvoAnim.x - alvoAnim.x0) * e;
    alvoCamera.z = alvoAnim.z0 + (alvoAnim.z - alvoAnim.z0) * e;
    camera.zoom = alvoAnim.z00 + (alvoAnim.zoom - alvoAnim.z00) * e;
    camera.updateProjectionMatrix();
    posicionarCamera();
    if (alvoAnim.t >= 1) alvoAnim = null;
  }

  // pacientes chegando
  spawnEm -= dt;
  if (spawnEm <= 0 && pacientes.length < 6) { novoPaciente(); spawnEm = aleatorio(6, 11); }
  for (const p of [...pacientes]) { atualizarPaciente(p, dt, liz); }
  if (entregador) atualizarEntregador(entregador, dt);
  else { entregaEm -= dt; if (entregaEm <= 0) entregador = novoEntregador(); }

  // agentes
  for (const a of agentes) {
    const real = !!estado?.agentes?.[a.id]?.ativa;
    const p = a.pessoa;
    const atendendoBalcao = pacientes.some((x) => x.estagio === 'checkin');
    if (a.id === 'liz') {
      if (relogio < (a.saudarAte || 0)) p.modo = 'acenando';
      else if (real || atendendoBalcao || (relogio % 34) < 9) p.modo = 'digitando';
      else p.modo = 'parado';
      if (real && relogio > a.bolhaAte && (Math.floor(relogio) % 14 === 0)) falar(a, ativTexto('liz') ? `${ativTexto('liz')}…` : 'Atendendo no WhatsApp…', 4);
    } else if (a.id === 'lay' && relogio < (a.saudarAte || 0)) {
      p.modo = 'acenando';
    } else {
      // agentes da mesa: digitam quando ha atividade real; sem atividade, alternam trabalho e pausa
      p.modo = real || ((relogio + (p.fase || 0) * 7) % 30) < 11 ? 'digitando' : 'parado';
      const frase = ativTexto(a.id) ? `${ativTexto(a.id)}…` : FRASES[a.id];
      if (real && frase && relogio > a.bolhaAte && (Math.floor(relogio + (p.fase || 0)) % 16 === 0)) falar(a, frase, 4);
    }
    const alerta = estado?.agentes?.[a.id]?.alerta;
    a.dot.className = `emp-tag-dot ${alerta ? 'alerta' : real ? 'on' : ''}`;
    if (alerta && relogio > a.bolhaAte && (Math.floor(relogio + (p.fase || 0)) % 22 === 0)) falar(a, `⚠ ${alerta}`, 5);
    animarPessoa(p, dt, relogio);
    if (!a.bolha.hidden && relogio > a.bolhaAte) a.bolha.hidden = true;
  }
  for (const an of animados) an.obj.rotation.y += dt * an.vel;
  for (const p of pacientes) animarPessoa(p, dt, relogio);
  if (entregador) animarPessoa(entregador, dt, relogio);

  // etiquetas HTML acompanham os personagens
  const r = canvas.getBoundingClientRect();
  const v = new THREE.Vector3();
  for (const a of agentes) {
    a.pessoa.grupo.getWorldPosition(v);
    v.y += a.tagY;
    v.project(camera);
    const x = ((v.x + 1) / 2) * r.width;
    const y = ((1 - v.y) / 2) * r.height;
    a.tag.style.transform = `translate(-50%, -100%) translate(${x}px, ${y}px)`;
    a.bolha.style.transform = `translate(-50%, -100%) translate(${x}px, ${y - 30}px)`;
  }
  renderer.render(scene, camera);
}

// ---------- ciclo de vida ----------
function montarInterface() {
  raiz.innerHTML = `
    <div class="emp-wrap">
      <div class="emp-palco">
        <canvas class="emp-canvas"></canvas>
        <div class="emp-tags"></div>
        <div class="emp-chips"></div>
        <div class="emp-dica">Arraste para mover · role ou use dois dedos para aproximar · toque no agente</div>
        <aside class="emp-painel" hidden>
          <button type="button" class="emp-p-fechar" aria-label="Fechar">✕</button>
          <div class="emp-p-topo"><span class="emp-p-av"></span><div><strong class="emp-p-nome"></strong><small class="emp-p-funcao"></small></div></div>
          <span class="emp-p-status"></span>
          <div class="emp-p-dados"></div>
          <div class="emp-p-ativ"><small>Atividade recente (dados do app)</small><ul></ul></div>
          <div class="emp-p-graf"><small></small><div class="emp-p-barras"></div></div>
        </aside>
      </div>
    </div>`;
  palco = raiz.querySelector('.emp-palco');
  canvas = raiz.querySelector('.emp-canvas');
  tagsEl = raiz.querySelector('.emp-tags');
  painelEl = raiz.querySelector('.emp-painel');
  chipsEl = raiz.querySelector('.emp-chips');
  try { somLigado = localStorage.getItem('empresaSom') === '1'; } catch { somLigado = false; }
  dicaEl = raiz.querySelector('.emp-dica');
  painelEl.querySelector('.emp-p-fechar').addEventListener('click', () => { selecionado = null; atualizarPainel(); });
  const setores = [
    { nome: 'Recepção', x: 8, z: 6, pronto: true },
    { nome: 'Comercial', x: 26, z: 6, pronto: true },
    { nome: 'Laboratório', x: 8, z: 20, pronto: true },
    { nome: 'Financeiro', x: 26, z: 20, pronto: true },
    { nome: 'Tráfego Pago', x: 44, z: 6, pronto: true },
  ];
  for (const s of setores) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `emp-chip ${s.pronto ? '' : 'breve'}`;
    b.textContent = s.pronto ? s.nome : `${s.nome} · em breve`;
    b.addEventListener('click', () => irPara(s.x, s.z, 1));
    chipsEl.appendChild(b);
  }
  const som = document.createElement('button');
  som.type = 'button';
  som.className = 'emp-chip emp-som';
  const rotuloSom = () => { som.textContent = somLigado ? '🔔 Alerta sonoro: ligado' : '🔕 Alerta sonoro: desligado'; };
  rotuloSom();
  som.title = 'Toca um aviso quando o Kyan encontrar um novo alerta crítico nas campanhas';
  som.addEventListener('click', () => {
    somLigado = !somLigado;
    try { localStorage.setItem('empresaSom', somLigado ? '1' : '0'); } catch { /* sem armazenamento */ }
    rotuloSom();
    if (somLigado) tocarAlerta();
  });
  chipsEl.appendChild(som);
}

export function iniciar(container, contexto) {
  ctx = contexto;
  raiz = container;
  montarInterface();
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 300);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa6b8, 1.05));
  const sol = new THREE.DirectionalLight(0xfff4e0, 0.75);
  sol.position.set(-4, 14, 9);
  scene.add(sol);

  construirRecepcao();
  construirComercial();
  construirLaboratorio();
  construirFinanceiro();
  construirTrafego();

  criarAgente({
    id: 'liz', nome: 'Liz', funcao: 'Recepção · IA de autoatendimento', x: 8.5, z: 2.0, yaw: 0, fase: 1,
    visual: { pele: '#f1c9a5', cabelo: '#5a3a2a', camisa: '#2f7f86', calca: '#2c3038', longo: true },
  });
  const mesa = (id, nome, funcao, x, z, visual, fase) => criarAgente({ id, nome, funcao, x: 18 + x, z, yaw: 0, fase, sentada: true, tagY: 1.85, visual });
  mesa('bia', 'Bia', 'Comercial · atende os leads novos', 4, 3.2, { pele: '#c68a63', cabelo: '#1b1b1f', camisa: '#d1626b', calca: '#2c3038', longo: true }, 2);
  mesa('lua', 'Lua', 'Comercial · follow-up', 11.5, 3.2, { pele: '#f1c9a5', cabelo: '#a37b45', camisa: '#9b7ede', calca: '#2c3038', longo: false }, 3);
  mesa('lorena', 'Lorena', 'Comercial · resgates e aniversariantes', 4, 8.2, { pele: '#e0ac82', cabelo: '#7a2e2e', camisa: '#e0c04a', calca: '#3b4a6b', longo: true }, 4);
  mesa('anne', 'Anne', 'Comercial · funis do Follow Up Inteligente', 11.5, 8.2, { pele: '#f6d7b8', cabelo: '#4a3426', camisa: '#5cae7f', calca: '#2c3038', longo: false }, 5);
  criarAgente({ id: 'lay', nome: 'Lay', funcao: 'Laboratório · andamento dos trabalhos e pacientes em tratamento', x: 7, z: 17.2, yaw: 0, fase: 6, sentada: true, tagY: 1.85, visual: { pele: '#f1c9a5', cabelo: '#5a3a2a', camisa: '#f4f6f8', calca: '#3b4a6b', longo: true } });
  criarAgente({ id: 'mya', nome: 'Mya', funcao: 'Financeiro · caixa, vendas e contas', x: 26, z: 17.2, yaw: 0, fase: 7, sentada: true, tagY: 1.85, visual: { pele: '#8d5a3b', cabelo: '#1b1b1f', camisa: '#2f8049', calca: '#2c3038', longo: true } });
  criarAgente({ id: 'kyan', nome: 'Kyan', funcao: 'Tráfego pago · tecnologia, marketing digital e estratégia', x: 44, z: 3.4, yaw: 0, fase: 8, sentada: true, tagY: 1.85, tagClasse: 'tech', visual: { pele: '#e0ac82', cabelo: '#e8eef5', camisa: '#f6fafd', calca: '#e9eff4', sapato: '#cfd8e0', longo: false, barba: true, neon: '#4cc3d9' } });
  novoPaciente(true); novoPaciente(true); novoPaciente(true);
  spawnEm = 3;

  posicionarCamera();
  ajustarTamanho();
  ligarControles();
  obsResize = new ResizeObserver(() => { ajustarTamanho(); posicionarCamera(); });
  obsResize.observe(palco);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pararLoop(); else if (!raiz.closest('[hidden]')) retomar(); });
  buscarEstado();
  retomar();
}

function pararLoop() {
  rodando = false;
  cancelAnimationFrame(rafId);
}
export function pausar() {
  pararLoop();
  clearInterval(pollId);
}
export function retomar() {
  if (!renderer || rodando) return;
  rodando = true;
  ultimoFrame = 0;
  ajustarTamanho();
  rafId = requestAnimationFrame(quadro);
  clearInterval(pollId);
  buscarEstado();
  pollId = setInterval(buscarEstado, 15000);
}
