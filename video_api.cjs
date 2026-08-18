#!/usr/bin/env node
/**
 * video_api.cjs — 通用视频/图片生成 API 客户端（OpenAI 兼容格式，模板）
 *
 * 环境变量（不写入 SKILL，用户本地配置）：
 *   VIDEO_API_BASE   中转站地址（OpenAI 兼容格式。必填，无默认值——不写具体供应商地址）
 *                    示例：https://<your-relay-host>/v1   (用你自己购买的中转站)
 *   VIDEO_API_KEY    API key
 *   VIDEO_MODEL      模型名（可用 --model 覆盖）
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

const https = require('https');
const fs = require('fs');

const BASE = process.env.VIDEO_API_BASE;
const KEY  = process.env.VIDEO_API_KEY;

if (!BASE) {
  console.error(JSON.stringify({ code: -100, msg: '缺少 VIDEO_API_BASE 环境变量。请按 OpenAI 兼容格式设置，例如：set VIDEO_API_BASE=https://<your-relay-host>/v1（不能用我们演示的中转站，必须用你自己购买的中转站）' }));
  process.exit(1);
}
if (!KEY) {
  console.error(JSON.stringify({ code: -100, msg: '缺少 VIDEO_API_KEY 环境变量，请先配置（见 SKILL「凭证配置」节）' }));
  process.exit(1);
}

// ---- 参数解析 ----
function args(argv) {
  const o = { images: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--prompt')        o.prompt = argv[++i];
    else if (a === '--image')    o.images.push(argv[++i].replace(/^@/, ''));
    else if (a === '--duration') o.duration = Number(argv[++i]);
    else if (a === '--size')     o.size = argv[++i];
    else if (a === '--model')    o.model = argv[++i];
  }
  return o;
}

// ---- 本地图 → base64 data URL（图生图/图生视频地基）----
function loadImages(paths) {
  return paths.map(p => {
    const buf = fs.readFileSync(p);
    const mime = p.toLowerCase().endsWith('.png') ? 'image/png'
      : p.toLowerCase().endsWith('.jpg') || p.toLowerCase().endsWith('.jpeg') ? 'image/jpeg'
      : p.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/png';
    return 'data:' + mime + ';base64,' + buf.toString('base64');
  });
}

// ---- 通用 HTTP 请求（返回 { statusCode, body }）----
function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(BASE.replace(/\/$/, '') + path);
    const data = body ? JSON.stringify(body) : null;
    const r = https.request({
      method, hostname: u.hostname, path: u.pathname, port: u.port || 443,
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

// ---- 图片生成（同步；图生图喂 --image）----
async function genImage(o) {
  const body = { model: o.model || process.env.VIDEO_MODEL, prompt: o.prompt };
  if (o.size) body.size = o.size;
  if (o.images.length) body.input_image = loadImages(o.images); // 参考图 → base64
  const { statusCode, body: res } = await req('POST', '/images/generations', body);
  if (statusCode >= 400) throw Object.assign(new Error(mapError(statusCode, res).msg), { code: statusCode });
  return res?.data?.[0]?.url || res?.data?.[0]?.b64_json || JSON.stringify(res);
}

// ---- 视频生成（异步；提交后返回任务 ID，不阻塞）----
async function submitVideo(o) {
  const body = { model: o.model || process.env.VIDEO_MODEL, prompt: o.prompt, duration: o.duration };
  if (o.images.length) body.image_url = loadImages(o.images); // 参考图 → base64
  const { statusCode, body: res } = await req('POST', '/videos', body);
  if (statusCode >= 400) throw Object.assign(new Error(mapError(statusCode, res).msg), { code: statusCode });
  const id = res.id || res.video_id || res.data?.id;
  if (!id) throw new Error('提交视频失败，未拿到任务 ID：' + JSON.stringify(res));
  return id;
}

// ---- 查询视频任务状态（单次，不阻塞）----
async function statusVideo(id) {
  const { statusCode, body: res } = await req('GET', '/videos/' + id);
  if (statusCode >= 400) throw Object.assign(new Error(mapError(statusCode, res).msg), { code: statusCode });
  const st  = res.status || res.state || res.data?.status;
  const out = res.video_url || res.url || res.output || res.data?.video_url;
  return { id, status: st, result: out || null, raw: res };
}

// ---- 主入口 ----
(async () => {
  const cmd = process.argv[2];
  try {
    if (cmd === 'image') {
      console.log(await genImage(args(process.argv.slice(3))));
    } else if (cmd === 'video') {
      console.log(JSON.stringify({ task_id: await submitVideo(args(process.argv.slice(3))) }));
    } else if (cmd === 'status') {
      console.log(JSON.stringify(await statusVideo(process.argv[3])));
    } else {
      console.error('用法: node video_api.cjs <image|video|status> ...');
      process.exit(1);
    }
  } catch (e) {
    console.error(JSON.stringify({ code: e.code || -100, msg: e.message }));
    process.exit(1);
  }
})();