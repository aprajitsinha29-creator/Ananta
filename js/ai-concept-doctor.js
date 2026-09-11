class AIDoctorManager {
  constructor() {
    this.isActive = false;
    this.activeModule = null;
    this.cache = {};
    this.apiKey = (typeof window !== 'undefined' && (
      window.ANANTA_CONFIG?.GROQ_API_KEY ||
      window.GROQ_API_KEY ||
      window.CONFIG?.groqKey ||
      ''
    )) || '';
    this.circle = null;
    this.popup = null;
    this._diagnosisRequest = null;
    this.pendingDiagnosisHashes = new Set();
    this.injectStyles();
  }

  getApiKey() {
    try {
      return (typeof window !== 'undefined' && (
        window.ANANTA_CONFIG?.GROQ_API_KEY ||
        window.GROQ_API_KEY ||
        window.CONFIG?.groqKey ||
        (typeof localStorage !== 'undefined' && localStorage.getItem('ananta_groq_key')) ||
        ''
      )) || '';
    } catch (error) {
      return '';
    }
  }

  injectStyles() {
    if (typeof document === 'undefined' || document.getElementById('acd-styles')) return;
    const style = document.createElement('style');
    style.id = 'acd-styles';
    style.textContent = `
      .acd-circle {
        position: fixed;
        right: 24px;
        top: 88px;
        z-index: 10020;
        width: 52px;
        height: 52px;
        padding: 0;
        border: 1px solid rgba(148, 163, 184, 0.5);
        border-radius: 50%;
        background: #172033;
        color: #e2e8f0;
        cursor: pointer;
        display: grid;
        place-items: center;
        font-size: 25px;
        box-shadow: 0 8px 24px rgba(2, 6, 23, 0.34);
        transition: box-shadow 180ms ease, transform 180ms ease, border-color 180ms ease;
      }
      .acd-circle:hover,
      .acd-circle.acd-active {
        transform: translateY(-2px);
        border-color: #67e8f9;
        box-shadow: 0 0 0 4px rgba(34, 211, 238, 0.14), 0 0 28px rgba(34, 211, 238, 0.5);
      }
      .acd-circle.acd-success {
        border-color: #34d399;
        background: #064e3b;
        box-shadow: 0 0 0 6px rgba(52, 211, 153, 0.16), 0 0 32px rgba(52, 211, 153, 0.75);
      }
      .acd-popup {
        position: fixed;
        right: 24px;
        top: 152px;
        z-index: 10021;
        width: min(340px, calc(100vw - 32px));
        box-sizing: border-box;
        padding: 16px;
        border: 1px solid rgba(103, 232, 249, 0.42);
        border-radius: 12px;
        background: #101827;
        color: #e5e7eb;
        box-shadow: 0 16px 42px rgba(2, 6, 23, 0.52);
        font: 13px/1.5 system-ui, sans-serif;
      }
      .acd-popup[hidden] { display: none; }
      .acd-popup h4 { margin: 0 28px 8px 0; color: #67e8f9; font-size: 15px; }
      .acd-popup p { margin: 0 0 12px; color: #cbd5e1; }
      .acd-hint { padding: 10px 11px; border-left: 3px solid #a78bfa; border-radius: 6px; background: rgba(124, 58, 237, 0.18); color: #ede9fe; }
      .acd-dismiss { position: absolute; top: 7px; right: 9px; padding: 2px 6px; border: 0; background: transparent; color: #94a3b8; cursor: pointer; font-size: 20px; line-height: 1; }
      .acd-dismiss:hover { color: #f8fafc; }
    `;
    document.head.appendChild(style);
  }

  attach(activeModule) {
    this.activeModule = activeModule;
    if (!activeModule || activeModule.expectedOutput == null) return;

    this.isActive = true;
    this.createUI();
  }

  detach() {
    this.isActive = false;
    this.activeModule = null;
    this._diagnosisRequest = null;
    if (this.circle) this.circle.remove();
    if (this.popup) this.popup.remove();
    this.circle = null;
    this.popup = null;
  }

  createUI() {
    if (typeof document === 'undefined') return;
    if (this.circle && this.popup) {
      this.circle.hidden = false;
      return;
    }

    const circle = document.createElement('button');
    circle.type = 'button';
    circle.className = 'acd-circle';
    circle.textContent = '🧠';
    circle.title = 'AI Concept Doctor';
    circle.setAttribute('aria-label', 'Open AI Concept Doctor diagnosis');

    const popup = document.createElement('aside');
    popup.className = 'acd-popup';
    popup.hidden = true;
    popup.setAttribute('aria-live', 'polite');
    popup.innerHTML = '<button type="button" class="acd-dismiss" aria-label="Dismiss diagnosis">×</button><h4></h4><p></p><div class="acd-hint"></div>';

    popup.querySelector('.acd-dismiss').addEventListener('click', () => {
      popup.hidden = true;
      circle.classList.remove('acd-active');
    });
    circle.addEventListener('click', () => {
      if (!popup.hidden) {
        popup.hidden = true;
        return;
      }
      if (!circle.classList.contains('acd-active')) {
        popup.querySelector('h4').textContent = 'AI Concept Doctor';
        popup.querySelector('p').textContent = 'Run the circuit to check whether its output matches this exercise goal.';
        popup.querySelector('.acd-hint').textContent = 'If the result is unexpected, I will point you toward the quantum concept to review.';
      }
      popup.hidden = false;
    });

    document.body.appendChild(circle);
    document.body.appendChild(popup);
    this.circle = circle;
    this.popup = popup;
  }

  onCircuitRun(probabilities, grid) {
    try {
      const expectedOutput = this.activeModule && this.activeModule.expectedOutput;
      if (!expectedOutput) return;

      const structuralIssue = this.findStructuralIssue(grid);
      if (structuralIssue) {
        this.diagnose(probabilities, grid, structuralIssue);
        return;
      }

      const actual = {};
      (probabilities || []).forEach(item => {
        actual[item.state] = Number(item.probability) || 0;
      });
      const tolerance = Number(expectedOutput.tolerance) || 0;
      const expectedStates = expectedOutput.states || {};
      const matchesExpected = Object.entries(expectedStates).every(([state, expected]) =>
        Math.abs((actual[state] || 0) - Number(expected)) <= tolerance
      );
      const hasUnexpectedHighProbability = Object.entries(actual).some(([state, probability]) =>
        !Object.prototype.hasOwnProperty.call(expectedStates, state) && probability > tolerance
      );

      if (matchesExpected && !hasUnexpectedHighProbability) {
        this.onSuccess();
        return;
      }
      this.diagnose(probabilities, grid);
    } catch (error) {
      this.silentFail();
    }
  }

  findStructuralIssue(grid) {
    if (!Array.isArray(grid)) return null;
    const hasMeasurementBeforeGate = grid.some(row => {
      if (!Array.isArray(row)) return false;
      let measured = false;
      return row.some(cell => {
        if (cell === 'M') {
          measured = true;
          return false;
        }
        return measured && Boolean(cell);
      });
    });
    if (!hasMeasurementBeforeGate) return null;
    return {
      issueDetected: true,
      conceptName: 'Measurement collapses the circuit state',
      explanation: 'A measurement gate was placed before a later operation, so the qubit is no longer available as an untouched quantum state for the rest of the circuit. Measurement should be treated as the end of that qubit\'s coherent computation unless the exercise explicitly asks you to measure there.',
      correctiveHint: 'Move the measurement to the final step, after the gates that create the target state.'
    };
  }

  async diagnose(probabilities, grid, localDiagnosis = null) {
    const moduleAtRun = this.activeModule;
    let hash = null;
    try {
      hash = JSON.stringify(grid);
      if (Object.prototype.hasOwnProperty.call(this.cache, hash)) {
        this.showDiagnosis(this.cache[hash]);
        return;
      }
      if (this.pendingDiagnosisHashes.has(hash)) return;
      if (localDiagnosis) {
        this.cache[hash] = localDiagnosis;
        this.showDiagnosis(localDiagnosis);
        return;
      }
      this.apiKey = this.getApiKey();
      if (!this.apiKey || !moduleAtRun) {
        this.silentFail();
        return;
      }

      const promptString = `You are a quantum computing tutor. A student's circuit produced the wrong output for their exercise.
Respond ONLY with valid JSON. No explanation, no markdown, no code blocks.

Schema: {"issueDetected": boolean, "conceptName": string|null, "explanation": string|null, "correctiveHint": string|null}

Module: ${moduleAtRun.title}
Category: ${moduleAtRun.category}
Exercise goal: ${moduleAtRun.exerciseGoal}

Student circuit (gate grid, rows=qubits, cols=time): ${JSON.stringify(grid)}
Student output: ${JSON.stringify((probabilities || []).map(p => ({state: p.state, prob: Number(p.probability).toFixed(3)})))}
Expected output: ${JSON.stringify(moduleAtRun.expectedOutput.states)}

Step 1: Analyze the gate sequence and identify what specific placement or ordering caused the wrong output.
Step 2: Name the quantum concept the student misunderstood.
Step 3: Write a 2-sentence plain-language explanation of the mistake.
Step 4: Write one sentence guiding them toward the fix without giving the answer away.

If the mismatch cannot be explained by a conceptual mistake such as noise or rounding, set issueDetected to false and all other fields to null.`;

      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = setTimeout(() => controller?.abort(), 10000);
      this._diagnosisRequest = moduleAtRun;
      this.pendingDiagnosisHashes.add(hash);
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-20b',
          messages: [{ role: 'user', content: promptString }],
          max_completion_tokens: 700,
          temperature: 0.3,
          reasoning_effort: 'low'
        }),
        ...(controller ? { signal: controller.signal } : {})
      });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`Groq returned HTTP ${response.status}`);

      const payload = await response.json();
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') throw new Error('Groq response did not contain JSON content');
      const cleanContent = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      const jsonStart = cleanContent.indexOf('{');
      const jsonEnd = cleanContent.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd <= jsonStart) throw new Error('Groq response did not contain a JSON object');
      const result = JSON.parse(cleanContent.slice(jsonStart, jsonEnd + 1));
      if (typeof result.issueDetected !== 'boolean') throw new Error('Invalid diagnosis schema');

      this.cache[hash] = result;
      if (this.activeModule === moduleAtRun) this.showDiagnosis(result);
    } catch (error) {
      if (!this.circle || this.popup?.hidden !== false) this.silentFail();
    } finally {
      if (hash) this.pendingDiagnosisHashes.delete(hash);
      this._diagnosisRequest = null;
    }
  }

  showDiagnosis(result) {
    try {
      if (!result || result.issueDetected !== true || !this.circle || !this.popup) {
        this.silentFail();
        return;
      }
      const heading = this.popup.querySelector('h4');
      const explanation = this.popup.querySelector('p');
      const hint = this.popup.querySelector('.acd-hint');
      if (!heading || !explanation || !hint) return;

      heading.textContent = result.conceptName || 'Circuit concept check';
      explanation.textContent = result.explanation || '';
      hint.textContent = result.correctiveHint || '';
      this.circle.classList.add('acd-active');
      this.popup.hidden = false;
    } catch (error) {
      this.silentFail();
    }
  }

  onSuccess() {
    try {
      if (!this.circle || !this.circle.classList.contains('acd-active')) return;
      this.circle.classList.remove('acd-active');
      if (this.popup) this.popup.hidden = true;
      this.circle.classList.add('acd-success');
      setTimeout(() => {
        if (this.circle) this.circle.classList.remove('acd-success');
      }, 2000);
    } catch (error) {
      this.silentFail();
    }
  }

  silentFail() {
    try {
      if (this.circle) {
        this.circle.classList.remove('acd-active', 'acd-success');
      }
      if (this.popup) this.popup.hidden = true;
    } catch (error) {}
  }
}

if (typeof window !== 'undefined') window.AIDoctorManager = AIDoctorManager;
if (typeof module !== 'undefined' && module.exports) module.exports = { AIDoctorManager };
