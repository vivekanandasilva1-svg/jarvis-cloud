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

// ---------- utilidades ----------
const matCache = new Map();
function mat(cor) {
  let m = matCache.get(cor);
  if (!m) { m = new THREE.MeshLambertMaterial({ color: cor }); matCache.set(cor, m); }
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
function criarPessoa({ pele = '#f1c9a5', cabelo = '#4a3426', camisa = '#2f7f86', calca = '#2c3038', longo = false, sapato = '#1f2229' }) {
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
  caixa(cabeca, 0, 0.08, 0.26, 0.12, 0.03, 0.02, '#b5675e');
  corpo.add(cabeca);
  return { grupo: g, corpo, quadris, joelhos, bracos, cabeca, modo: 'parado', sentadoF: 0, andaF: 0, yaw: 0, yawAlvo: 0, rota: [], vel: 1.7 };
}

function animarPessoa(p, dt, t) {
  const andando = p.modo === 'andando';
  p.andaF += ((andando ? 1 : 0) - p.andaF) * Math.min(1, dt * 10);
  p.sentadoF += ((p.modo === 'sentado' ? 1 : 0) - p.sentadoF) * Math.min(1, dt * 8);
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

function lajeBase(pai, x0, z0, w, d, corPiso, corPiso2) {
  const g = new THREE.Group();
  g.position.set(x0, 0, z0);
  bloco(g, -0.35, -0.6, -0.35, w + 0.35, 0, d + 0.35, '#262a31');
  bloco(g, -0.35, -0.07, d + 0.35 - 0.07, w + 0.35, 0, d + 0.35, '#d4af37');
  bloco(g, w + 0.35 - 0.07, -0.07, -0.35, w + 0.35, 0, d + 0.35, '#d4af37');
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ map: texturaPiso(w, d, corPiso, corPiso2, 1) }));
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

function construirSalaEmBreve(nome, x0, z0, w, d) {
  const g = new THREE.Group();
  scene.add(g);
  lajeBase(g, x0, z0, w, d, '#d8dbe0', '#cdd1d7');
  const laje = new THREE.Group();
  g.add(laje);
  bloco(g, x0 - 0.3, 0, z0 - 0.3, x0 + w, 1.0, z0, '#aeb4bd');
  bloco(g, x0 - 0.3, 0, z0, x0, 1.0, z0 + d, '#aeb4bd');
  bloco(g, x0 - 0.3, 1.0, z0 - 0.3, x0 + w, 1.06, z0, '#d4af37');
  placa(g, nome.toUpperCase(), 5, 0.9, { x: x0 + w / 2, y: 2.1, z: z0 + 0.4, sub: 'Em breve', fundo: '#3a3f48', cor: '#d4af37', tam: 0.7 });
  bloco(g, x0 + w / 2 - 2.5, 1.0, z0 + 0.3, x0 + w / 2 + 2.5, 2.55, z0 + 0.34, '#3a3f48');
  return g;
}

// ---------- agentes e pacientes ----------
function criarAgente(def) {
  const p = criarPessoa(def.visual);
  p.grupo.position.set(def.x, 0, def.z);
  p.yaw = p.yawAlvo = def.yaw || 0;
  p.fase = def.fase || 0;
  scene.add(p.grupo);
  const tag = document.createElement('button');
  tag.type = 'button';
  tag.className = 'emp-tag';
  tag.innerHTML = '<span class="emp-tag-nome"></span><i class="emp-tag-dot"></i>';
  tag.querySelector('.emp-tag-nome').textContent = def.nome;
  tag.addEventListener('click', (ev) => { ev.stopPropagation(); selecionar(def.id); });
  const bolha = document.createElement('div');
  bolha.className = 'emp-bolha';
  bolha.hidden = true;
  tagsEl.append(bolha, tag);
  const a = { ...def, pessoa: p, tag, bolha, dot: tag.querySelector('.emp-tag-dot'), ocupada: false, bolhaAte: 0 };
  agentes.push(a);
  return a;
}

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
    atualizarPainel();
  } catch { /* mantem o ultimo estado */ }
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
  if (selecionado) {
    const p = selecionado.pessoa.grupo.position;
    irPara(p.x + 0.5, p.z + 1.5, 1.8);
  }
}

function atualizarPainel() {
  if (!painelEl) return;
  const a = selecionado;
  painelEl.hidden = !a;
  if (!a) return;
  const d = estado?.agentes?.[a.id];
  const ativa = !!d?.ativa;
  painelEl.querySelector('.emp-p-nome').textContent = a.nome;
  painelEl.querySelector('.emp-p-funcao').textContent = a.funcao;
  const st = painelEl.querySelector('.emp-p-status');
  st.textContent = ativa ? 'Trabalhando agora' : 'Disponível';
  st.className = `emp-p-status ${ativa ? 'on' : ''}`;
  const linhas = [];
  linhas.push(['Mensagens enviadas hoje', d ? String(d.hoje) : '—']);
  linhas.push(['Última atividade', d ? tempoAtras(d.ultimaEm) : '—']);
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

  // agentes
  for (const a of agentes) {
    const real = !!estado?.agentes?.[a.id]?.ativa;
    const p = a.pessoa;
    const atendendoBalcao = pacientes.some((x) => x.estagio === 'checkin');
    if (a.id === 'liz') {
      if (relogio < (a.saudarAte || 0)) p.modo = 'acenando';
      else if (real || atendendoBalcao || (relogio % 34) < 9) p.modo = 'digitando';
      else p.modo = 'parado';
      if (real && relogio > a.bolhaAte && (Math.floor(relogio) % 14 === 0)) falar(a, 'Atendendo no WhatsApp…', 4);
    }
    a.dot.className = `emp-tag-dot ${real ? 'on' : ''}`;
    animarPessoa(p, dt, relogio);
    if (!a.bolha.hidden && relogio > a.bolhaAte) a.bolha.hidden = true;
  }
  for (const p of pacientes) animarPessoa(p, dt, relogio);

  // etiquetas HTML acompanham os personagens
  const r = canvas.getBoundingClientRect();
  const v = new THREE.Vector3();
  for (const a of agentes) {
    a.pessoa.grupo.getWorldPosition(v);
    v.y += 2.15;
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
        </aside>
      </div>
    </div>`;
  palco = raiz.querySelector('.emp-palco');
  canvas = raiz.querySelector('.emp-canvas');
  tagsEl = raiz.querySelector('.emp-tags');
  painelEl = raiz.querySelector('.emp-painel');
  chipsEl = raiz.querySelector('.emp-chips');
  dicaEl = raiz.querySelector('.emp-dica');
  painelEl.querySelector('.emp-p-fechar').addEventListener('click', () => { selecionado = null; atualizarPainel(); });
  const setores = [
    { nome: 'Recepção', x: 8, z: 6, pronto: true },
    { nome: 'Comercial', x: 26, z: 6 },
    { nome: 'Laboratório', x: 8, z: 20 },
    { nome: 'Financeiro', x: 26, z: 20 },
    { nome: 'Tráfego Pago', x: 44, z: 6 },
  ];
  for (const s of setores) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `emp-chip ${s.pronto ? '' : 'breve'}`;
    b.textContent = s.pronto ? s.nome : `${s.nome} · em breve`;
    b.addEventListener('click', () => irPara(s.x, s.z, 1));
    chipsEl.appendChild(b);
  }
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
  construirSalaEmBreve('Comercial', 18, 0, 16, 12);
  construirSalaEmBreve('Laboratório', 0, 14, 16, 12);
  construirSalaEmBreve('Financeiro', 18, 14, 16, 12);
  construirSalaEmBreve('Tráfego Pago', 36, 0, 16, 12);

  criarAgente({
    id: 'liz', nome: 'Liz', funcao: 'Recepção · IA de autoatendimento', x: 8.5, z: 2.0, yaw: 0, fase: 1,
    visual: { pele: '#f1c9a5', cabelo: '#5a3a2a', camisa: '#2f7f86', calca: '#2c3038', longo: true },
  });
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
