#!/usr/bin/env node
/**
 * video_api.cjs — 通用视频/图片生成 API 客户端（OpenAI 兼容格式，模板）
 *
 * 环境变量（不写入 SKILL，用户本地配置）：
 *   VIDEO_API_BASE   中转站地址（OpenAI 兼容格式。必填，无默认值——不写具体供应商地址）
 *                    示例：https://<your-relay-host>/v1   (用你自己购买的中转站)
 *   VIDEO_API_KEY    API key
 *   VIDEO_MODEL      模型名（可用 --model 覆盖）
 *   VIDEO_API_TIMEOUT_MS  单次 HTTP 超时毫秒数（可选，默认 120000）
 *
 * 子命令：
 *   image  --prompt "..." [--image @图1.png ...] [--size 16:9]
 *          → 图片生成（同步；图生图时喂 --image 参考图）
 *   video  --prompt "..." --duration 15 [--image @图1.png ...] [--model xxx]
 *          → 视频生成，提交后立即返回任务 ID（不阻塞）
 *   status <task_id>
 *          → 查询视频任务状态，返回 status + 结果
 *
 * 说明：这是「模板」，字段名按 OpenAI 风格写，各中转站可能有差异，使用者按需微调。
 * 参考图喂法：本地图 → base64 data URL；图片走 input_image，视频走 image_url（可改）。
 */

const http = require('http');
const https = require('https');
const fs = require('fs');

const BASE = process.env.VIDEO_API_BASE;
const KEY  = process.env.VIDEO_API_KEY;
const REQUEST_TIMEOUT_MS = Number(process.env.VIDEO_API_TIMEOUT_MS || 120000);

function validateConfig() {
  if (!BASE) throw new Error('缺少 VIDEO_API_BASE 环境变量。请设置为你已获授权使用的 HTTP(S) 接口根地址');
  if (!KEY) throw new Error('缺少 VIDEO_API_KEY 环境变量，请先配置（见 core-instructions.md「凭证配置」）');
  if (!Number.isFinite(REQUEST_TIMEOUT_MS) || REQUEST_TIMEOUT_MS <= 0) {
    throw new Error('VIDEO_API_TIMEOUT_MS 必须是大于 0 的毫秒数');
  }
  const u = new URL(BASE);
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('VIDEO_API_BASE 只支持 http:// 或 https://');
}

// ---- 参数解析 ----
function args(argv) {
  const o = { images: [] };
  const next = (flag, i) => {
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`${flag} 缺少参数值`);
    return value;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--prompt')        o.prompt = next(a, i++);
    else if (a === '--image')    o.images.push(next(a, i++).replace(/^@/, ''));
    else if (a === '--duration') o.duration = Number(next(a, i++));
    else if (a === '--size')     o.size = next(a, i++);
    else if (a === '--model')    o.model = next(a, i++);
    else throw new Error(`未知参数：${a}`);
  }
  return o;
}

function validateGenerationArgs(o, kind) {
  if (!o.prompt || !o.prompt.trim()) throw new Error(`${kind} 命令必须提供非空 --prompt`);
  if (!(o.model || process.env.VIDEO_MODEL)) throw new Error(`${kind} 命令必须提供 --model 或 VIDEO_MODEL`);
  if (kind === 'video' && (!Number.isFinite(o.duration) || o.duration <= 0)) {
    throw new Error('video 命令的 --duration 必须是大于 0 的秒数');
  }
  for (const imagePath of o.images) {
    if (!fs.existsSync(imagePath) || !fs.statSync(imagePath).isFile()) throw new Error(`参考图不存在或不是文件：${imagePath}`);
  }
}

// ---- 本地图 → base64 data URL（图生图/图生视频地基）----
function loadImages(paths) {
  return paths.map(p => {
    const buf = fs.readFileSync(p);
    const lower = p.toLowerCase();
    const mime = lower.endsWith('.png') ? 'image/png'
      : lower.endsWith('.jpg') || lower.endsWith('.jpeg') ? 'image/jpeg'
      : lower.endsWith('.webp') ? 'image/webp' : null;
    if (!mime) throw new Error(`不支持的参考图格式（仅 png/jpg/jpeg/webp）：${p}`);
    return 'data:' + mime + ';base64,' + buf.toString('base64');
  });
}

// ---- 通用 HTTP 请求（返回 { statusCode, body }）----
function req(method, path, body) {
  return new Promise((resolve, reject) => {
    validateConfig();
    const u = new URL(BASE.replace(/\/$/, '') + path);
    const transport = u.protocol === 'http:' ? http : https;
    const data = body ? JSON.stringify(body) : null;
    const r = transport.request({
      method, hostname: u.hostname, path: u.pathname + u.search,
      port: u.port || (u.protocol === 'http:' ? 80 : 443),
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY,
                 ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) }
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        let parsed; try { parsed = JSON.parse(buf); } catch { parsed = buf; }
        resolve({ statusCode: res.statusCode, body: parsed });
      });
    });
    r.on('error', reject);
    r.setTimeout(REQUEST_TIMEOUT_MS, () => r.destroy(new Error(`请求超时（${REQUEST_TIMEOUT_MS}ms）`)));
    if (data) r.write(data);
    r.end();
  });
}

// ---- 错误码映射（结构化错误）----
function mapError(statusCode, body) {
  const codeMap = {
    401: '凭证错误（VIDEO_API_KEY 无效或过期）',
    400: '参数错误（prompt/参考图/duration 等字段不合法）',
    402: '余额不足或额度用尽',
    429: '请求限流（429），请降速或切换模型/路由',
    403: '权限不足（模型未开通或无访问权限）'
  };
  const msg = codeMap[statusCode] || ('HTTP ' + statusCode + ' 错误');
  return { code: statusCode, msg, detail: body?.error?.message || body?.msg || JSON.stringify(body) };
}

function apiError(statusCode, body) {
  const mapped = mapError(statusCode, body);
  return Object.assign(new Error(mapped.msg), { code: mapped.code, detail: mapped.detail });
}

// ---- 图片生成（同步；图生图喂 --image）----
async function genImage(o) {
  validateGenerationArgs(o, 'image');
  const body = { model: o.model || process.env.VIDEO_MODEL, prompt: o.prompt };
  if (o.size) body.size = o.size;
  if (o.images.length) body.input_image = loadImages(o.images); // 参考图 → base64
  const { statusCode, body: res } = await req('POST', '/images/generations', body);
  if (statusCode >= 400) throw apiError(statusCode, res);
  return res?.data?.[0]?.url || res?.data?.[0]?.b64_json || JSON.stringify(res);
}

// ---- 视频生成（异步；提交后返回任务 ID，不阻塞）----
async function submitVideo(o) {
  validateGenerationArgs(o, 'video');
  const body = { model: o.model || process.env.VIDEO_MODEL, prompt: o.prompt, duration: o.duration };
  if (o.images.length) body.image_url = loadImages(o.images); // 参考图 → base64
  const { statusCode, body: res } = await req('POST', '/videos', body);
  if (statusCode >= 400) throw apiError(statusCode, res);
  const id = res.id || res.video_id || res.data?.id;
  if (!id) throw new Error('提交视频失败，未拿到任务 ID：' + JSON.stringify(res));
  return id;
}

// ---- 查询视频任务状态（单次，不阻塞）----
async function statusVideo(id) {
  if (!id) throw new Error('status 命令必须提供 task_id');
  const { statusCode, body: res } = await req('GET', '/videos/' + encodeURIComponent(id));
  if (statusCode >= 400) throw apiError(statusCode, res);
  const st  = res.status || res.state || res.data?.status;
  const out = res.video_url || res.url || res.output || res.data?.video_url;
  return { id, status: st, result: out || null, raw: res };
}

// ---- 主入口 ----
function usage() {
  return [
    '用法:',
    '  node video_api.cjs image --prompt "..." [--image @图1.png] [--size 16:9] [--model xxx]',
    '  node video_api.cjs video --prompt "..." --duration 15 [--image @图1.png] [--model xxx]',
    '  node video_api.cjs status <task_id>',
    '环境变量: VIDEO_API_BASE, VIDEO_API_KEY, VIDEO_MODEL, VIDEO_API_TIMEOUT_MS（默认 120000）',
    '说明: 通用模板不会自动付费重试；供应商字段不兼容时请使用对应官方适配器。'
  ].join('\n');
}

(async () => {
  const cmd = process.argv[2];
  try {
    if (cmd === 'image') {
      console.log(await genImage(args(process.argv.slice(3))));
    } else if (cmd === 'video') {
      console.log(JSON.stringify({ task_id: await submitVideo(args(process.argv.slice(3))) }));
    } else if (cmd === 'status') {
      console.log(JSON.stringify(await statusVideo(process.argv[3])));
    } else if (cmd === '--help' || cmd === '-h' || cmd === 'help') {
      console.log(usage());
    } else {
      throw new Error(usage());
    }
  } catch (e) {
    console.error(JSON.stringify({ code: e.code || -100, msg: e.message, ...(e.detail ? { detail: e.detail } : {}) }));
    process.exit(1);
  }
})();
