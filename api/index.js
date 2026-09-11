/**
 * Ananta Quantum Studio - Vercel Serverless API Gateway
 * 
 * Provides cloud endpoints for:
 *  - GET  /api/health
 *  - GET  /api/logs
 *  - GET  /api/qpu/devices
 *  - POST /api/ai/audit
 *  - POST /api/ai/roadmap
 *  - POST /api/ai/chat
 *  - POST /api/qpu/run
 */

let DEFAULT_GEMINI_KEY = process.env.GEMINI_API_KEY || '';

// If local config exists (e.g. local dev), load it
if (!DEFAULT_GEMINI_KEY) {
  try {
    const fs = require('fs');
    const path = require('path');
    const cfgPath = path.join(__dirname, '..', 'js', 'config.js');
    if (fs.existsSync(cfgPath)) {
      const match = fs.readFileSync(cfgPath, 'utf8').match(/GEMINI_API_KEY:\s*["']([^"']+)["']/);
      if (match && match[1]) DEFAULT_GEMINI_KEY = match[1].trim();
    }
  } catch (e) {}
}

// IBM Quantum Hardware Bridge Utility
const ibmQuantum = require('../ananta-backend/utils/ibmQuantum');
let IBM_QUANTUM_TOKEN = process.env.IBM_QUANTUM_TOKEN || process.env.IBM_API_KEY || '';

// qBraid Multi-Provider Quantum Execution Utility
const qbraidClient = require('../ananta-backend/utils/qbraidClient');
let QBRAID_API_KEY = process.env.QBRAID_API_KEY || process.env.QBRAID_TOKEN || '';

// Assessment & Instructor Subsystem
const quizEngine = require('../ananta-backend/utils/quizEngine');
const instructorStorage = require('../ananta-backend/utils/instructorStorage');

// Physical Device Fleet Catalog (Baseline Reference)
const QPU_DEVICES = ibmQuantum.REFERENCE_QPU_DEVICES;

const serverlessLogs = [];

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
  });
  res.end(body);
}

async function getParsedBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

async function callGeminiApi(prompt, systemInstruction = '', isJson = true, customKey = '') {
  const activeKey = customKey || DEFAULT_GEMINI_KEY;
  if (!activeKey) {
    throw new Error('GEMINI_API_KEY is not configured on server. Set GEMINI_API_KEY in Vercel Project Settings or provide X-Gemini-Key header.');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeKey}`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2 }
  };

  if (isJson) {
    payload.generationConfig.responseMimeType = 'application/json';
  }

  if (systemInstruction) {
    payload.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const latencyMs = Date.now() - startTime;
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google AI Studio HTTP ${res.status}: ${errText.substring(0, 300)}`);
    }

    const data = await res.json();
    const candidate = data?.candidates?.[0];
    const rawText = candidate?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error('Empty response from Google AI Studio');
    }

    return {
      text: rawText,
      usage: data.usageMetadata || null,
      modelVersion: data.modelVersion || 'gemini-2.5-flash',
      latencyMs,
      finishReason: candidate.finishReason || 'STOP'
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

module.exports = async function handler(req, res) {
  const reqStart = Date.now();
  const host = req.headers['host'] || '127.0.0.1';
  const reqUrl = new URL(req.url, `https://${host}`);
  let pathname = reqUrl.pathname;

  // Normalize /api trailing slashes
  pathname = pathname.replace(/\/+$/, '') || '/';

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
    });
    res.end();
    return;
  }

  // Dedicated Multi-task Gemini Endpoint (/api/gemini, /api/ai, /api/grok)
  if (pathname === '/api/gemini' || pathname === '/gemini' || pathname === '/api/ai' || pathname === '/api/grok') {
    const geminiHandler = require('./gemini.js');
    return geminiHandler(req, res);
  }

  // ================= RESEARCH PAPER EXTRACTION ENDPOINTS =================
  const { googleSearch } = require('../ananta-backend/utils/googleSearch');
  const { extractTextFromUrl } = require('../ananta-backend/utils/extractText');
  const { findTermOccurrences } = require('../ananta-backend/utils/findTerm');
  const { summarizeText } = require('../ananta-backend/utils/summarize');

  if (pathname === '/api/search' && req.method === 'POST') {
    const body = await getParsedBody(req);
    const { query, num } = body || {};
    if (!query) return sendJson(res, 400, { error: 'query is required' });
    try {
      const results = await googleSearch(query, num || 10);
      return sendJson(res, 200, { query, results });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (pathname === '/api/fetch-content' && req.method === 'POST') {
    const body = await getParsedBody(req);
    const { url } = body || {};
    if (!url) return sendJson(res, 400, { error: 'url is required' });
    try {
      const { title, text, fullTextAvailable } = await extractTextFromUrl(url);
      return sendJson(res, 200, { url, title, length: text.length, text, fullTextAvailable: Boolean(fullTextAvailable) });
    } catch (e) {
      return sendJson(res, 500, { error: 'Could not fetch/parse that URL: ' + e.message });
    }
  }

  if (pathname === '/api/find-term' && req.method === 'POST') {
    const body = await getParsedBody(req);
    const { url, text, term } = body || {};
    if (!term) return sendJson(res, 400, { error: 'term is required' });
    if (!url && !text) return sendJson(res, 400, { error: 'provide either url or text' });

    try {
      let sourceText = text;
      let title = null;
      if (!sourceText && url) {
        const extracted = await extractTextFromUrl(url);
        sourceText = extracted.text;
        title = extracted.title;
      }

      const occurrences = findTermOccurrences(sourceText, term);
      if (!occurrences.length) {
        return sendJson(res, 200, { term, title, found: false, message: `"${term}" was not found in this document.` });
      }

      const topOccurrences = occurrences.slice(0, 5);
      const summarized = await Promise.all(
        topOccurrences.map(async (occ) => ({
          context: occ.context,
          summary: await summarizeText(occ.context, term),
        }))
      );
      return sendJson(res, 200, { term, title, found: true, totalOccurrences: occurrences.length, results: summarized });
    } catch (e) {
      return sendJson(res, 500, { error: e.message });
    }
  }

  if (pathname === '/api/summarize' && req.method === 'POST') {
    const body = await getParsedBody(req);
    const { url, text } = body || {};
    if (!url && !text) return sendJson(res, 400, { error: 'provide either url or text' });

    try {
      let sourceText = text;
      let title = null;
      if (!sourceText && url) {
        const extracted = await extractTextFromUrl(url);
        sourceText = extracted.text;
        title = extracted.title;
      }
      const truncated = (sourceText || '').slice(0, 15000);
      const summary = await summarizeText(truncated);
      return sendJson(res, 200, { title, summary });
    } catch (e) {
      return sendJson(res, 500, { error: e.message });
    }
  }

  if (pathname === '/api/synthesize-topic' && req.method === 'POST') {
    const body = await getParsedBody(req);
    const { topic, papers } = body || {};
    if (!topic || !Array.isArray(papers) || papers.length === 0) {
      return sendJson(res, 400, { error: 'provide topic and a non-empty papers array' });
    }

    try {
      const { synthesizeTopic } = require('../ananta-backend/utils/summarize');
      const result = await synthesizeTopic(topic, papers);
      return sendJson(res, 200, result);
    } catch (e) {
      return sendJson(res, 500, { error: e.message });
    }
  }

  // 1. GET /api or /api/health
  if ((pathname === '/api' || pathname === '/api/health') && req.method === 'GET') {
    return sendJson(res, 200, {
      status: 'ONLINE',
      server: 'Ananta Quantum Vercel Serverless Engine',
      version: '2.5.0',
      cloud: 'Vercel Serverless Function',
      timestamp: new Date().toISOString(),
      aiStudio: {
        provider: 'Google AI Studio',
        model: 'gemini-2.5-flash',
        keyConfigured: Boolean(DEFAULT_GEMINI_KEY && DEFAULT_GEMINI_KEY.length > 10),
        status: (DEFAULT_GEMINI_KEY && DEFAULT_GEMINI_KEY.length > 10) ? 'CONNECTED' : 'READY_FOR_KEY'
      },
      qpuDevices: Object.keys(QPU_DEVICES),
      activeFeatures: [
        'Quantum Circuit Composer',
        'Universal Transpiler & AI Circuit Doctor',
        'Topic Roadmap & Custom AI Synthesis',
        'Physical Cloud QPU Hardware Bridge',
        'Quantum Voice & Video Copilot',
        'Real-time Statevector Simulator',
        'Cryostat Digital Twin',
        'PQC Security Auditor'
      ]
    });
  }

  // 2. GET /api/logs
  if (pathname === '/api/logs' && req.method === 'GET') {
    return sendJson(res, 200, {
      total: serverlessLogs.length,
      logs: serverlessLogs
    });
  }

  // 3. GET /api/qpu/devices (Live IBM Quantum Fleet Discovery)
  if (pathname === '/api/qpu/devices' && req.method === 'GET') {
    const token = req.headers['x-ibm-token'] || reqUrl.searchParams.get('token') || IBM_QUANTUM_TOKEN;
    try {
      const fleet = await ibmQuantum.getLiveBackends(token);
      return sendJson(res, 200, {
        success: true,
        ...fleet
      });
    } catch (err) {
      return sendJson(res, 200, {
        success: true,
        isLive: false,
        count: Object.keys(QPU_DEVICES).length,
        devices: QPU_DEVICES,
        notice: 'Baseline reference catalog: ' + err.message
      });
    }
  }

  // 3b. POST /api/qpu/auth (Verify IBM Quantum API Token)
  if (pathname === '/api/qpu/auth' && req.method === 'POST') {
    try {
      const body = await getParsedBody(req);
      const token = body.token || body.apiToken || req.headers['x-ibm-token'] || IBM_QUANTUM_TOKEN;
      const authRes = await ibmQuantum.validateToken(token);
      return sendJson(res, authRes.valid ? 200 : 401, authRes);
    } catch (err) {
      return sendJson(res, 500, { valid: false, error: err.message });
    }
  }

  // POST /api/roadmap/generate — writes a learning roadmap for any request
  if (pathname === '/api/roadmap/generate' && req.method === 'POST') {
    const body = await getParsedBody(req);
    const { goal, catalog, refresh } = body || {};
    if (!goal) return sendJson(res, 400, { error: 'goal is required' });

    try {
      const { generateRoadmap } = require('../ananta-backend/utils/roadmapGenerator');
      const data = await generateRoadmap({
        goal,
        catalog: Array.isArray(catalog) ? catalog : [],
        refresh: refresh === true
      });
      return sendJson(res, 200, data);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // POST /api/research/discover — live literature search for a plain-language topic
  // POST /api/research/brief    — the same, plus a cited AI synthesis
  if ((pathname === '/api/research/discover' || pathname === '/api/research/brief') && req.method === 'POST') {
    const body = await getParsedBody(req);
    const { topic, limit, refresh } = body || {};
    if (!topic) return sendJson(res, 400, { error: 'topic is required' });

    try {
      const { discoverPapers, briefTopic } = require('../ananta-backend/utils/researchArchive');
      const run = pathname.endsWith('/brief') ? briefTopic : discoverPapers;
      const data = await run({ topic, limit: Math.min(Number(limit) || 12, 40), refresh: refresh === true });
      return sendJson(res, 200, data);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // GET /api/voice/vocabulary — capability registry used for phonetic matching
  if (pathname === '/api/voice/vocabulary' && req.method === 'GET') {
    try {
      const { getVocabulary } = require('../ananta-backend/utils/voiceIntent');
      return sendJson(res, 200, getVocabulary());
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // GET /api/resources — Live Community Resource Library (fetched from GitHub, cached)
  if (pathname === '/api/resources' && req.method === 'GET') {
    try {
      const { getResourceLibrary } = require('../ananta-backend/utils/githubResources');
      const forceRefresh = reqUrl.searchParams.get('refresh') === 'true';
      const data = await getResourceLibrary({ forceRefresh });
      return sendJson(res, 200, data);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 4. POST /api/ai/audit
  if (pathname === '/api/ai/audit' && req.method === 'POST') {
    try {
      const body = await getParsedBody(req);
      const { code, framework = 'cirq', rawGates = 0, optGates = 0, savings = 0, qubits = 3 } = body;

      if (!code) {
        return sendJson(res, 400, { error: 'Missing quantum circuit code in request body' });
      }

      const prompt = `You are the Principal Quantum Hardware Architect & Circuit Compiler Lead at Google Quantum AI and IBM Quantum.
Perform an in-depth clinical audit and hardware noise prognosis for this quantum circuit written in ${framework.toUpperCase()}:

\`\`\`
${code}
\`\`\`

Diagnostic context:
- Total Raw Gates: ${rawGates}
- Optimized Gates: ${optGates}
- Pruned Redundancies: ${savings} gates
- Active Qubits: ${qubits}

Return ONLY a valid JSON object matching this schema:
{
  "circuitName": "Descriptive algorithm title (e.g. 4-Qubit GHZ State Preparation or Entangled Bell State)",
  "healthAssessment": "2-3 sentences evaluating circuit health, gate bloat, and compilation status.",
  "gatePathology": "Specific explanation of which gates are redundant, unmerged, or causing unnecessary depth.",
  "decoherenceRisks": "Which physical qubits or operations carry highest risk of T1 decay or T2 dephasing on superconducting transmons.",
  "qpuRecommendation": "Comparative analysis: performance on IBM Eagle (Heavy-Hex), Google Sycamore (2D Grid), and IonQ Forte (All-to-All).",
  "clinicalPrescription": "Concrete next steps (e.g., Dynamical Decoupling sequence, Zero-Noise Extrapolation, KAK Cartan synthesis)."
}`;

      const clientKey = (req.headers['x-gemini-key'] || '').trim();
      const aiRes = await callGeminiApi(prompt, '', true, clientKey);
      let parsedAudit;
      try {
        parsedAudit = JSON.parse(aiRes.text);
      } catch (jsonErr) {
        const cleaned = aiRes.text.replace(/```json/gi, '').replace(/```/g, '').trim();
        parsedAudit = JSON.parse(cleaned);
      }

      const responseData = {
        success: true,
        audit: parsedAudit,
        metadata: {
          provider: 'Google AI Studio (Gemini 2.5 Flash)',
          model: aiRes.modelVersion,
          latencyMs: aiRes.latencyMs,
          usage: aiRes.usage,
          cloud: 'Vercel Serverless',
          timestamp: new Date().toISOString()
        }
      };

      return sendJson(res, 200, responseData);
    } catch (err) {
      console.error('[Vercel API /api/ai/audit Error]', err);
      return sendJson(res, 502, {
        success: false,
        error: err.message || 'Error processing AI audit with Google AI Studio'
      });
    }
  }

  // 5. POST /api/ai/roadmap
  if (pathname === '/api/ai/roadmap' && req.method === 'POST') {
    try {
      const body = await getParsedBody(req);
      const { userPrompt, moduleCatalog = '' } = body;

      if (!userPrompt) {
        return sendJson(res, 400, { error: 'Missing userPrompt in request body' });
      }

      const systemPrompt = `You are the Lead Quantum Curriculum Architect & Quantum Information Physicist for Ananta Quantum Studio.
You must construct a personalized, mathematically rigorous learning pathway for a user based on their background, question, or request.

Available 18 Quantum Modules in the Curriculum:
${moduleCatalog}

User Request: "${userPrompt}"

Instructions:
1. Analyze the user's expertise level and request:
   - If they state they are a "beginner", "no prior knowledge", "already a beginner", or ask basic concepts, START at foundational modules (e.g. module-01, module-02, module-04, module-06).
   - If they state they "already know basics" or are "intermediate", skip introductory 101 definitions and begin with circuit engineering, Pauli observables, density matrices, and algorithms (e.g. module-02, module-04, module-06, module-07, module-08).
   - If they state "advanced", "learn from advanced", "expert", or ask about specialized topics (e.g., surface codes, FTQC, VQE, QML, microwave pulses, post-quantum crypto, cryogenics), skip basics completely and build a deep, high-level sequence (e.g. module-03, module-05, module-10, module-11, module-12, module-14, module-16).
   - If they ask for a specific topic (e.g., "teleportation", "Grover search", "cryogenics", "error correction"), include its essential prerequisites followed by the target topic and advanced next steps.
2. Select between 3 and 10 module IDs from the 18 available modules in STRICT prerequisite order.
3. Provide a clear rationale explaining why this specific sequence fits the user's background.

You MUST return ONLY a valid JSON object with the following schema:
{
  "displayName": "Concise descriptive title of this customized roadmap (e.g., 'Adaptive Pathway: Fault-Tolerant QC & QML')",
  "description": "2-sentence summary of the curriculum and what the learner will master.",
  "detectedLevel": "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "MASTER",
  "levelRationale": "Clear explanation of how the user's prompt informed this selection and ordering.",
  "moduleIds": ["module-01", "module-02", ...]
}`;

      const clientKey = (req.headers['x-gemini-key'] || '').trim();
      const aiRes = await callGeminiApi(systemPrompt, '', true, clientKey);
      let parsedRoadmap;
      try {
        parsedRoadmap = JSON.parse(aiRes.text);
      } catch (jsonErr) {
        const cleaned = aiRes.text.replace(/```json/gi, '').replace(/```/g, '').trim();
        parsedRoadmap = JSON.parse(cleaned);
      }

      return sendJson(res, 200, {
        success: true,
        roadmap: parsedRoadmap,
        metadata: {
          provider: 'Google AI Studio (Gemini 2.5 Flash)',
          model: aiRes.modelVersion,
          latencyMs: aiRes.latencyMs,
          cloud: 'Vercel Serverless',
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      console.error('[Vercel API /api/ai/roadmap Error]', err);
      return sendJson(res, 502, {
        success: false,
        error: err.message || 'Error generating roadmap with Google AI Studio'
      });
    }
  }

  // 6. POST /api/ai/chat
  if (pathname === '/api/ai/chat' && req.method === 'POST') {
    try {
      const body = await getParsedBody(req);
      const { message, context = '' } = body;

      if (!message) {
        return sendJson(res, 400, { error: 'Missing message in request body' });
      }

      const prompt = `You are Ananta's Quantum Copilot, a brilliant quantum physicist and circuit designer.
Explain clearly, concisely (max 3-4 sentences), and with mathematical precision.
If relevant, give gate sequence recommendations.

Current Studio Context: ${context || 'General Quantum Studio'}
User Question: "${message}"`;

      const clientKey = (req.headers['x-gemini-key'] || '').trim();
      const aiRes = await callGeminiApi(prompt, '', false, clientKey);
      return sendJson(res, 200, {
        success: true,
        reply: aiRes.text.trim(),
        metadata: {
          provider: 'Google AI Studio (Gemini 2.5 Flash)',
          model: aiRes.modelVersion,
          latencyMs: aiRes.latencyMs,
          cloud: 'Vercel Serverless'
        }
      });
    } catch (err) {
      console.error('[Vercel API /api/ai/chat Error]', err);
      return sendJson(res, 502, {
        success: false,
        error: err.message
      });
    }
  }

  // 7. POST /api/qpu/run (Physical QPU Hardware Execution & Honest Simulation Dispatch)
  if (pathname === '/api/qpu/run' && req.method === 'POST') {
    try {
      const body = await getParsedBody(req);
      const {
        backend = 'ibm_brisbane',
        shots = 1024,
        qasm = '',
        numQubits = 3,
        idealProbabilities = null,
        mode = 'auto',
        requireLive = false
      } = body || {};

      const token = req.headers['x-ibm-token'] || body.token || body.apiToken || IBM_QUANTUM_TOKEN;
      const isSimBackend = backend === 'simulator_mps';
      const shouldAttemptLive = !isSimBackend && mode !== 'simulation' && Boolean(token);

      if (shouldAttemptLive) {
        try {
          const job = await ibmQuantum.submitQpuJob({
            apiToken: token,
            backend,
            qasm,
            shots
          });

          // Wait up to 3.5s for fast execution or simulators
          let finalResult = job;
          if (job.status !== 'COMPLETED') {
            const pollStart = Date.now();
            while (Date.now() - pollStart < 3500) {
              await new Promise(r => setTimeout(r, 1000));
              try {
                const check = await ibmQuantum.getJobStatusAndResult(token, job.jobId);
                if (check.status === 'COMPLETED' || check.status === 'ERROR' || check.status === 'CANCELLED') {
                  finalResult = check;
                  break;
                }
              } catch (pollErr) {
                break;
              }
            }
          }

          return sendJson(res, 200, {
            ...finalResult,
            executionTimeMs: Math.round(Date.now() - reqStart)
          });
        } catch (qpuErr) {
          if (requireLive || mode === 'hardware') {
            return sendJson(res, 502, {
              success: false,
              isRealHardware: true,
              error: `IBM Quantum Hardware Execution Failed: ${qpuErr.message}`
            });
          }
          const simRes = ibmQuantum.runSimulatedNoise({ backend, shots, numQubits, idealProbabilities, qasm });
          simRes.fallbackReason = qpuErr.message;
          simRes.executionTimeMs = Math.round(Date.now() - reqStart);
          return sendJson(res, 200, simRes);
        }
      }

      if (requireLive || mode === 'hardware') {
        return sendJson(res, 401, {
          success: false,
          error: 'IBM Quantum API Token required for physical QPU hardware execution. Please enter your API token in the settings modal or set IBM_QUANTUM_TOKEN.'
        });
      }

      // Sandbox Mode: Local physics noise simulation with honest disclosure
      const simRes = ibmQuantum.runSimulatedNoise({ backend, shots, numQubits, idealProbabilities, qasm });
      simRes.executionTimeMs = Math.round(Date.now() - reqStart);
      return sendJson(res, 200, simRes);
    } catch (err) {
      console.error('[Vercel API /api/qpu/run Error]', err);
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 8. GET /api/qpu/job/:id (Poll Real IBM Quantum Job Status and Results)
  if (pathname.startsWith('/api/qpu/job/') && req.method === 'GET') {
    const jobId = pathname.replace('/api/qpu/job/', '').trim();
    const token = req.headers['x-ibm-token'] || reqUrl.searchParams.get('token') || IBM_QUANTUM_TOKEN;
    if (!jobId) {
      return sendJson(res, 400, { error: 'Job ID is required in URL path' });
    }
    if (jobId.startsWith('sim_')) {
      return sendJson(res, 200, { status: 'COMPLETED', jobId, executionMode: 'SIMULATED_PHYSICAL_NOISE' });
    }
    if (!token) {
      return sendJson(res, 401, { error: 'IBM Quantum API Token required to query physical hardware job status' });
    }

    try {
      const jobResult = await ibmQuantum.getJobStatusAndResult(token, jobId);
      return sendJson(res, 200, jobResult);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // ================= 9. QBRAID MULTI-PROVIDER QUANTUM EXECUTION ENDPOINTS =================

  // 9a. GET /api/qbraid/devices
  if (pathname === '/api/qbraid/devices' && req.method === 'GET') {
    const apiKey = req.headers['x-qbraid-key'] || reqUrl.searchParams.get('key') || QBRAID_API_KEY;
    try {
      const fleet = await qbraidClient.getLiveBackends(apiKey);
      return sendJson(res, 200, { success: true, ...fleet });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 9b. POST /api/qbraid/auth
  if (pathname === '/api/qbraid/auth' && req.method === 'POST') {
    try {
      const body = await getParsedBody(req);
      const apiKey = body.apiKey || body.token || req.headers['x-qbraid-key'] || QBRAID_API_KEY;
      const authRes = await qbraidClient.validateToken(apiKey);
      return sendJson(res, authRes.valid ? 200 : 401, authRes);
    } catch (err) {
      return sendJson(res, 500, { valid: false, error: err.message });
    }
  }

  // 9c. POST /api/qbraid/run
  if (pathname === '/api/qbraid/run' && req.method === 'POST') {
    try {
      const body = await getParsedBody(req);
      const {
        backend = 'qbraid_sdk_simulator',
        shots = 1024,
        qasm = '',
        numQubits = 3,
        idealProbabilities = null,
        mode = 'auto',
        requireLive = false
      } = body || {};

      const apiKey = req.headers['x-qbraid-key'] || body.apiKey || body.token || QBRAID_API_KEY;
      const isSimulator = backend.includes('simulator');
      const shouldAttemptLive = !isSimulator && mode !== 'simulation' && Boolean(apiKey);

      if (shouldAttemptLive) {
        try {
          const job = await qbraidClient.submitQbraidJob({ apiKey, backend, qasm, shots });
          return sendJson(res, 200, { ...job, executionTimeMs: Math.round(Date.now() - reqStart) });
        } catch (qbrErr) {
          if (requireLive || mode === 'hardware') {
            return sendJson(res, 502, { success: false, isRealHardware: true, error: `qBraid Execution Failed: ${qbrErr.message}` });
          }
          const simRes = qbraidClient.runSimulatedNoise({ backend, shots, numQubits, idealProbabilities, qasm });
          simRes.fallbackReason = qbrErr.message;
          simRes.executionTimeMs = Math.round(Date.now() - reqStart);
          return sendJson(res, 200, simRes);
        }
      }

      const simRes = qbraidClient.runSimulatedNoise({ backend, shots, numQubits, idealProbabilities, qasm });
      simRes.executionTimeMs = Math.round(Date.now() - reqStart);
      return sendJson(res, 200, simRes);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 9d. GET /api/qbraid/job/:id
  if (pathname.startsWith('/api/qbraid/job/') && req.method === 'GET') {
    const jobId = pathname.replace('/api/qbraid/job/', '').trim();
    const apiKey = req.headers['x-qbraid-key'] || reqUrl.searchParams.get('key') || QBRAID_API_KEY;

    if (!jobId) return sendJson(res, 400, { error: 'Job ID is required in URL path' });
    if (jobId.startsWith('qbr_sim_')) {
      return sendJson(res, 200, { status: 'COMPLETED', jobId, executionMode: 'SIMULATED_PHYSICAL_NOISE' });
    }

    try {
      const jobResult = await qbraidClient.getJobStatusAndResult(apiKey, jobId);
      return sendJson(res, 200, jobResult);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // ================= 10. ASSESSMENT & QUIZZES ENDPOINTS =================

  // 10a. GET /api/quizzes
  if (pathname === '/api/quizzes' && req.method === 'GET') {
    try {
      const topic = reqUrl.searchParams.get('topic') || 'all';
      const difficulty = reqUrl.searchParams.get('difficulty') || 'all';
      const limit = parseInt(reqUrl.searchParams.get('limit') || '10', 10);
      const isCatalogOnly = reqUrl.searchParams.get('catalog') === 'true';

      const catalog = quizEngine.getQuizCatalog();
      if (isCatalogOnly) return sendJson(res, 200, { success: true, catalog });

      const session = quizEngine.getQuizQuestions({ topic, difficulty, limit });
      return sendJson(res, 200, { success: true, catalog, session });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 10b. POST /api/quizzes/submit
  if (pathname === '/api/quizzes/submit' && req.method === 'POST') {
    try {
      const body = await getParsedBody(req);
      const { answers = {}, studentId = 'std_curr_user', studentName = 'Quantum Scholar', cohortId = 'cohort_qc101' } = body;
      const evalResult = quizEngine.evaluateSubmission({ answers, studentId, studentName });
      if (!evalResult.success) return sendJson(res, 400, evalResult);

      instructorStorage.recordStudentProgress({
        studentId,
        studentName,
        cohortId,
        quizSubmission: evalResult,
        xpGained: evalResult.totalXpEarned
      });
      return sendJson(res, 200, evalResult);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // ================= 11. INSTRUCTOR PORTAL & PROGRESS TRACKING ENDPOINTS =================

  // 11a. GET /api/progress/summary
  if (pathname === '/api/progress/summary' && req.method === 'GET') {
    const studentId = reqUrl.searchParams.get('studentId') || 'std_curr_user';
    const progress = instructorStorage.getStudentProgress(studentId);
    return sendJson(res, 200, { success: true, ...progress });
  }

  // 11b. POST /api/progress/sync
  if (pathname === '/api/progress/sync' && req.method === 'POST') {
    try {
      const body = await getParsedBody(req);
      const { studentId, studentName, cohortId, challengeSolved, xpGained } = body || {};
      const updated = instructorStorage.recordStudentProgress({
        studentId,
        studentName,
        cohortId,
        challengeSolved,
        xpGained: Number(xpGained) || 0
      });
      return sendJson(res, 200, { success: true, student: updated });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 11c. GET /api/instructor/cohorts
  if (pathname === '/api/instructor/cohorts' && req.method === 'GET') {
    const cohorts = instructorStorage.getCohorts();
    return sendJson(res, 200, { success: true, count: cohorts.length, cohorts });
  }

  // 11d. POST /api/instructor/cohorts
  if (pathname === '/api/instructor/cohorts' && req.method === 'POST') {
    try {
      const body = await getParsedBody(req);
      const newCohort = instructorStorage.createCohort(body);
      return sendJson(res, 201, { success: true, cohort: newCohort });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 11e. GET /api/instructor/cohort/:id/students
  if (pathname.startsWith('/api/instructor/cohort/') && pathname.endsWith('/students') && req.method === 'GET') {
    const cohortId = pathname.replace('/api/instructor/cohort/', '').replace('/students', '').trim();
    const students = instructorStorage.getCohortStudents(cohortId);
    return sendJson(res, 200, { success: true, cohortId, count: students.length, students });
  }

  // 11f. GET /api/instructor/analytics
  if (pathname === '/api/instructor/analytics' && req.method === 'GET') {
    const cohortId = reqUrl.searchParams.get('cohortId') || 'cohort_qc101';
    const analytics = instructorStorage.getCohortAnalytics(cohortId);
    return sendJson(res, 200, { success: true, ...analytics });
  }

  // 11g. POST /api/instructor/assignments
  if (pathname === '/api/instructor/assignments' && req.method === 'POST') {
    try {
      const body = await getParsedBody(req);
      const newAsg = instructorStorage.createAssignment(body);
      return sendJson(res, 201, { success: true, assignment: newAsg });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 11h. GET /api/instructor/export-gradebook
  if (pathname === '/api/instructor/export-gradebook' && req.method === 'GET') {
    const cohortId = reqUrl.searchParams.get('cohortId') || 'cohort_qc101';
    const csvContent = instructorStorage.generateGradebookCSV(cohortId);
    const filename = `ananta_gradebook_${cohortId}_${Date.now()}.csv`;

    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Access-Control-Allow-Origin': '*'
    });
    res.end(csvContent);
    return;
  }

  // 404 for unknown API route
  sendJson(res, 404, { error: `Endpoint not found: ${pathname}` });
};
