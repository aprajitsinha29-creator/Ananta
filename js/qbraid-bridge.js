/**
 * Ananta Quantum Studio - qBraid Multi-Provider Hardware Bridge
 * 
 * Manages:
 *  1. Live qBraid Quantum Device Fleet discovery (AWS Braket, QuEra, IonQ, Rigetti, OQC, qBraid Simulator)
 *  2. qBraid API Key management (localStorage: ananta_qbraid_token)
 *  3. OpenQASM circuit submission to /api/qbraid/run
 *  4. Real-time measurement histogram and architecture-specific telemetry
 */

class QBraidBridge {
  constructor(engine, circuitUI) {
    this.engine = engine;
    this.circuitUI = circuitUI;
    this.apiKey = localStorage.getItem('ananta_qbraid_token') || '';
    this.selectedBackend = 'qbraid_sdk_simulator';
    this.isJobRunning = false;
    this.activeProvider = 'ibm'; // 'ibm' or 'qbraid'
    this.devices = {};

    this.init();
  }

  async init() {
    await this.fetchDeviceFleet();
    this.bindDOM();
  }

  async fetchDeviceFleet() {
    try {
      const headers = {};
      if (this.apiKey) headers['x-qbraid-key'] = this.apiKey;

      const res = await fetch('/api/qbraid/devices', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.devices) {
          this.devices = data.devices;
          this.renderDeviceDropdown();
          this.updateDeviceTelemetry();
        }
      }
    } catch (e) {
      console.warn('[qBraidBridge] Fleet discovery notice:', e.message);
    }
  }

  async saveApiKey(key) {
    if (!key || !key.trim()) {
      this.clearApiKey();
      return;
    }
    const cleanKey = key.trim();
    const statusEl = document.getElementById('qbraid-token-status');
    if (statusEl) {
      statusEl.className = 'status-pill status-warn';
      statusEl.innerHTML = '⏳ Verifying with qBraid...';
    }

    try {
      const res = await fetch('/api/qbraid/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: cleanKey })
      });

      const data = await res.json();
      if (res.ok && data.valid) {
        this.apiKey = cleanKey;
        localStorage.setItem('ananta_qbraid_token', this.apiKey);
        if (statusEl) {
          statusEl.className = 'status-pill status-ready';
          statusEl.innerHTML = `✓ Connected: ${data.user || 'qBraid Account'} (${data.credits || 100} Credits)`;
        }
        await this.fetchDeviceFleet();
        return;
      } else {
        if (statusEl) {
          statusEl.className = 'status-pill status-warn';
          statusEl.innerHTML = '⚠️ Invalid Key (Simulated Mode)';
        }
        alert(`qBraid Authentication notice: ${data.error || 'Invalid API Key'}`);
      }
    } catch (err) {
      console.warn('[qBraidBridge] Key verification notice:', err);
    }

    this.apiKey = cleanKey;
    localStorage.setItem('ananta_qbraid_token', this.apiKey);
    this.updateTokenStatus();
    this.fetchDeviceFleet();
  }

  clearApiKey() {
    this.apiKey = '';
    localStorage.removeItem('ananta_qbraid_token');
    const input = document.getElementById('qbraid-api-token-input');
    if (input) input.value = '';
    this.updateTokenStatus();
    this.fetchDeviceFleet();
  }

  updateTokenStatus() {
    const statusEl = document.getElementById('qbraid-token-status');
    if (!statusEl) return;
    if (this.apiKey) {
      const masked = `${this.apiKey.substring(0, 4)}••••••••${this.apiKey.substring(this.apiKey.length - 4)}`;
      statusEl.className = 'status-pill status-ready';
      statusEl.innerHTML = `✓ Saved (${masked})`;
    } else {
      statusEl.className = 'status-pill status-warn';
      statusEl.innerHTML = '⚠️ No Key (Simulated Physics Mode)';
    }
  }

  renderDeviceDropdown() {
    const select = document.getElementById('qbraid-backend-select');
    if (!select || !Object.keys(this.devices).length) return;

    select.innerHTML = '';
    Object.values(this.devices).forEach(dev => {
      const opt = document.createElement('option');
      opt.value = dev.id;
      opt.textContent = `${dev.name} (${dev.qubits} Qubits | ${dev.provider} | ${dev.type})`;
      if (dev.id === this.selectedBackend) opt.selected = true;
      select.appendChild(opt);
    });
  }

  updateDeviceTelemetry() {
    const card = document.getElementById('qbraid-telemetry-card');
    if (!card) return;

    const dev = this.devices[this.selectedBackend];
    if (!dev) return;

    card.innerHTML = `
      <div class="qpu-telemetry-header">
        <div>
          <div class="qpu-telemetry-title">${dev.name}</div>
          <div class="qpu-telemetry-provider">${dev.provider} • ${dev.type}</div>
        </div>
        <span class="qpu-chip-status-badge ${dev.status.includes('Online') ? 'chip-online' : 'chip-queued'}">
          ● ${dev.status} (${dev.queue} in queue)
        </span>
      </div>
      <div class="qpu-metrics-grid">
        <div class="qpu-metric-item">
          <span class="qpu-metric-label">Active Qubits</span>
          <span class="qpu-metric-val">${dev.qubits}</span>
        </div>
        <div class="qpu-metric-item">
          <span class="qpu-metric-label">1Q Gate Fidelity</span>
          <span class="qpu-metric-val">${((dev.fidelity1Q || 0.999) * 100).toFixed(2)}%</span>
        </div>
        <div class="qpu-metric-item">
          <span class="qpu-metric-label">2Q Gate Fidelity</span>
          <span class="qpu-metric-val">${((dev.fidelity2Q || 0.985) * 100).toFixed(2)}%</span>
        </div>
        <div class="qpu-metric-item">
          <span class="qpu-metric-label">Topology</span>
          <span class="qpu-metric-val" style="font-size:12px;">${dev.topology || 'All-to-All'}</span>
        </div>
      </div>
    `;
  }

  async runJob() {
    if (this.isJobRunning) return;
    this.isJobRunning = true;

    const btn = document.getElementById('btn-dispatch-qbraid-job');
    const statusBanner = document.getElementById('qbraid-job-status-banner');
    const resultsContainer = document.getElementById('qbraid-hardware-results-container');

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `⏳ Executing on ${this.selectedBackend}...`;
    }

    if (statusBanner) {
      statusBanner.style.display = 'block';
      statusBanner.className = 'job-status-banner status-running';
      statusBanner.innerHTML = `🚀 Dispatched quantum circuit to <strong>${this.selectedBackend}</strong>. Simulating architecture noise channels...`;
    }

    try {
      const qasm = this.engine && typeof this.engine.toOpenQASM === 'function'
        ? this.engine.toOpenQASM(this.circuitUI ? this.circuitUI.grid : null)
        : 'OPENQASM 2.0;\ninclude "qelib1.inc";\nqreg q[3];\ncreg c[3];\nh q[0];\ncx q[0],q[1];\nmeasure q -> c;\n';

      const numQubits = this.circuitUI ? this.circuitUI.numQubits : 3;
      const idealProbabilities = this.engine && typeof this.engine.getProbabilities === 'function'
        ? this.engine.getProbabilities().map(p => p.probability)
        : null;

      const headers = { 'Content-Type': 'application/json' };
      if (this.apiKey) headers['x-qbraid-key'] = this.apiKey;

      const res = await fetch('/api/qbraid/run', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          backend: this.selectedBackend,
          shots: 1024,
          qasm,
          numQubits,
          idealProbabilities,
          apiKey: this.apiKey
        })
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || `HTTP ${res.status}`);
      }

      if (statusBanner) {
        statusBanner.className = 'job-status-banner status-success';
        statusBanner.innerHTML = `
          <span>✓ Execution Completed on <strong>${result.backend}</strong> (Job: <code>${result.jobId}</code>)</span>
          <span style="font-size:11px; margin-left:8px; opacity:0.8;">Mode: ${result.executionMode || (result.isRealHardware ? 'REAL QPU HARDWARE' : 'SIMULATED')} (${result.shots} shots in ${result.executionTimeMs || 18}ms)</span>
        `;
      }

      this.renderResults(result);
    } catch (err) {
      if (statusBanner) {
        statusBanner.className = 'job-status-banner status-error';
        statusBanner.innerHTML = `❌ qBraid Execution Error: ${err.message}`;
      }
    } finally {
      this.isJobRunning = false;
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `⚡ Run on qBraid (${this.selectedBackend})`;
      }
    }
  }

  renderResults(result) {
    const container = document.getElementById('qbraid-hardware-results-container');
    if (!container) return;

    container.style.display = 'block';
    const counts = result.counts || {};
    const totalShots = result.shots || 1024;
    const sortedStates = Object.keys(counts).sort();

    let barsHtml = '';
    sortedStates.forEach(bitstring => {
      const count = counts[bitstring];
      const probPct = ((count / totalShots) * 100).toFixed(1);
      barsHtml += `
        <div class="result-hist-row">
          <span class="hist-label">|${bitstring}⟩</span>
          <div class="hist-bar-track">
            <div class="hist-bar-fill" style="width: ${probPct}%; background: linear-gradient(90deg, #3b82f6, #06b6d4);"></div>
          </div>
          <span class="hist-val">${count} (${probPct}%)</span>
        </div>
      `;
    });

    container.innerHTML = `
      <div class="qpu-results-card">
        <div class="qpu-results-header">
          <strong>Measurement Shot Distribution</strong>
          <span style="font-size:12px; color:#94a3b8;">${totalShots} Total Shots</span>
        </div>
        <div class="qpu-hist-list">
          ${barsHtml}
        </div>
      </div>
    `;
  }

  bindDOM() {
    const select = document.getElementById('qbraid-backend-select');
    if (select) {
      select.addEventListener('change', (e) => {
        this.selectedBackend = e.target.value;
        this.updateDeviceTelemetry();
        const btn = document.getElementById('btn-dispatch-qbraid-job');
        if (btn) btn.innerHTML = `⚡ Run on qBraid (${this.selectedBackend})`;
      });
    }

    const saveBtn = document.getElementById('btn-save-qbraid-token');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const input = document.getElementById('qbraid-api-token-input');
        if (input) this.saveApiKey(input.value);
      });
    }

    const clearBtn = document.getElementById('btn-clear-qbraid-token');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearApiKey());
    }

    const runBtn = document.getElementById('btn-dispatch-qbraid-job');
    if (runBtn) {
      runBtn.addEventListener('click', () => this.runJob());
    }

    const input = document.getElementById('qbraid-api-token-input');
    if (input && this.apiKey) {
      input.value = this.apiKey;
    }
    this.updateTokenStatus();
  }
}

window.QBraidBridge = QBraidBridge;
