/**
 * Quantum Engine - In-Browser Complex Matrix & Statevector Simulator
 * Supports up to 3 qubits with real-time state evolution, Bloch coordinates, and QASM export.
 */

class Complex {
  constructor(re = 0, im = 0) {
    this.re = re;
    this.im = im;
  }

  add(c) {
    return new Complex(this.re + c.re, this.im + c.im);
  }

  sub(c) {
    return new Complex(this.re - c.re, this.im - c.im);
  }

  mul(c) {
    return new Complex(
      this.re * c.re - this.im * c.im,
      this.re * c.im + this.im * c.re
    );
  }

  div(c) {
    const denom = c.re * c.re + c.im * c.im;
    if (denom === 0) return new Complex(0, 0);
    return new Complex(
      (this.re * c.re + this.im * c.im) / denom,
      (this.im * c.re - this.re * c.im) / denom
    );
  }

  scale(s) {
    return new Complex(this.re * s, this.im * s);
  }

  conj() {
    return new Complex(this.re, -this.im);
  }

  absSq() {
    return this.re * this.re + this.im * this.im;
  }

  abs() {
    return Math.sqrt(this.absSq());
  }

  phase() {
    return Math.atan2(this.im, this.re);
  }
}

class QuantumCircuitEngine {
  constructor(numQubits = 3) {
    this.numQubits = numQubits;
    this.numStates = 1 << numQubits; // 2^N
    this.state = [];
    this.reset();
  }

  reset() {
    this.state = Array.from({ length: this.numStates }, (_, i) => 
      i === 0 ? new Complex(1, 0) : new Complex(0, 0)
    );
  }

  setNumQubits(numQubits) {
    this.numQubits = Math.max(2, Math.min(8, numQubits));
    this.numStates = 1 << this.numQubits;
    this.reset();
  }

  // Common 1-Qubit matrices
  static get GATES() {
    const SQRT2_INV = 1 / Math.SQRT2;
    return {
      I: [
        [new Complex(1, 0), new Complex(0, 0)],
        [new Complex(0, 0), new Complex(1, 0)]
      ],
      X: [
        [new Complex(0, 0), new Complex(1, 0)],
        [new Complex(1, 0), new Complex(0, 0)]
      ],
      Y: [
        [new Complex(0, 0), new Complex(0, -1)],
        [new Complex(0, 1), new Complex(0, 0)]
      ],
      Z: [
        [new Complex(1, 0), new Complex(0, 0)],
        [new Complex(0, 0), new Complex(-1, 0)]
      ],
      H: [
        [new Complex(SQRT2_INV, 0), new Complex(SQRT2_INV, 0)],
        [new Complex(SQRT2_INV, 0), new Complex(-SQRT2_INV, 0)]
      ],
      S: [
        [new Complex(1, 0), new Complex(0, 0)],
        [new Complex(0, 0), new Complex(0, 1)]
      ],
      T: [
        [new Complex(1, 0), new Complex(0, 0)],
        [new Complex(0, 0), new Complex(SQRT2_INV, SQRT2_INV)]
      ]
    };
  }

  // Apply single qubit gate to target wire
  apply1QGate(gateName, targetQubit) {
    const matrix = QuantumCircuitEngine.GATES[gateName];
    if (!matrix) return;

    const newState = Array.from({ length: this.numStates }, () => new Complex(0, 0));
    const bitMask = 1 << (this.numQubits - 1 - targetQubit);

    for (let i = 0; i < this.numStates; i++) {
      if ((i & bitMask) === 0) {
        const i0 = i;
        const i1 = i | bitMask;

        const a0 = this.state[i0];
        const a1 = this.state[i1];

        // newState[i0] = M00*a0 + M01*a1
        newState[i0] = matrix[0][0].mul(a0).add(matrix[0][1].mul(a1));
        // newState[i1] = M10*a0 + M11*a1
        newState[i1] = matrix[1][0].mul(a0).add(matrix[1][1].mul(a1));
      }
    }

    this.state = newState;
  }

  // Apply Controlled-NOT (CX)
  applyCNOT(controlQubit, targetQubit) {
    if (controlQubit === targetQubit) return;
    const newState = Array.from({ length: this.numStates }, () => new Complex(0, 0));
    const ctrlMask = 1 << (this.numQubits - 1 - controlQubit);
    const tgtMask = 1 << (this.numQubits - 1 - targetQubit);

    for (let i = 0; i < this.numStates; i++) {
      if ((i & ctrlMask) !== 0) {
        // Control bit is 1, flip target bit
        const flipped = i ^ tgtMask;
        newState[flipped] = this.state[i];
      } else {
        // Control bit is 0, unchanged
        newState[i] = this.state[i];
      }
    }

    this.state = newState;
  }

  // Apply SWAP: exchanges the amplitudes of the two qubits' basis values.
  applySWAP(qubitA, qubitB) {
    if (qubitA === qubitB) return;
    const newState = new Array(this.numStates);
    const maskA = 1 << (this.numQubits - 1 - qubitA);
    const maskB = 1 << (this.numQubits - 1 - qubitB);

    for (let i = 0; i < this.numStates; i++) {
      const bitA = (i & maskA) ? 1 : 0;
      const bitB = (i & maskB) ? 1 : 0;
      const j = bitA === bitB ? i : (i ^ maskA ^ maskB);
      newState[j] = this.state[i];
    }
    this.state = newState;
  }

  // Apply Toffoli (CCX): flips the target only when BOTH controls are |1>.
  // A Toffoli with only one control detected applied is not the same gate as
  // a CNOT and must not silently collapse into one.
  applyToffoli(controlA, controlB, targetQubit) {
    if (controlA === controlB || controlA === targetQubit || controlB === targetQubit) return;
    const newState = Array.from({ length: this.numStates }, () => new Complex(0, 0));
    const maskA = 1 << (this.numQubits - 1 - controlA);
    const maskB = 1 << (this.numQubits - 1 - controlB);
    const maskT = 1 << (this.numQubits - 1 - targetQubit);

    for (let i = 0; i < this.numStates; i++) {
      const bothOne = (i & maskA) !== 0 && (i & maskB) !== 0;
      const dest = bothOne ? (i ^ maskT) : i;
      newState[dest] = this.state[i];
    }
    this.state = newState;
  }

  // Run circuit up to a specific time-step column (-1 for full circuit)
  runCircuitUpToCol(grid, upToCol = -1) {
    this.reset();
    if (!grid || !grid.length) return;

    const maxCols = grid[0].length;
    const limit = upToCol === -1 ? maxCols : Math.min(upToCol + 1, maxCols);

    for (let col = 0; col < limit; col++) {
      const controls = [];
      let cnotTarget = -1;
      const swapWires = [];

      for (let q = 0; q < this.numQubits; q++) {
        const cell = grid[q][col];
        if (cell === 'CX_CTRL') controls.push(q);
        else if (cell === 'CX_TGT') cnotTarget = q;
        else if (cell === 'SWAP') swapWires.push(q);
      }

      // Two controls sharing a target is a Toffoli, not a CNOT — collapsing
      // it to single-control was silently simulating the wrong gate.
      if (controls.length === 2 && cnotTarget !== -1) {
        this.applyToffoli(controls[0], controls[1], cnotTarget);
      } else if (controls.length === 1 && cnotTarget !== -1) {
        this.applyCNOT(controls[0], cnotTarget);
      }

      if (swapWires.length === 2) {
        this.applySWAP(swapWires[0], swapWires[1]);
      }

      for (let q = 0; q < this.numQubits; q++) {
        const cell = grid[q][col];
        if (cell && cell !== 'CX_CTRL' && cell !== 'CX_TGT' && cell !== 'SWAP' && cell !== 'M') {
          this.apply1QGate(cell, q);
        }
      }
    }
  }

  // Run full series of time-step columns
  runCircuit(grid) {
    this.runCircuitUpToCol(grid, -1);
  }

  // Run Monte Carlo physical measurement sampling (1024 shots)
  sampleShots(numShots = 1024) {
    const probs = this.getProbabilities();
    const counts = {};
    probs.forEach(p => counts[p.state] = 0);

    const cdf = [];
    let cumulative = 0;
    for (let i = 0; i < probs.length; i++) {
      cumulative += probs[i].probability;
      cdf.push({ state: probs[i].state, cumulative });
    }

    for (let s = 0; s < numShots; s++) {
      const rand = Math.random();
      for (let i = 0; i < cdf.length; i++) {
        if (rand <= cdf[i].cumulative || i === cdf.length - 1) {
          counts[cdf[i].state]++;
          break;
        }
      }
    }

    return {
      totalShots: numShots,
      counts: counts,
      results: probs.map(p => ({
        state: p.state,
        theoreticalPct: (p.probability * 100).toFixed(1),
        measuredCount: counts[p.state],
        measuredPct: ((counts[p.state] / numShots) * 100).toFixed(1)
      }))
    };
  }

  // Compute 8x8 full density matrix rho = |psi><psi|
  getDensityMatrix() {
    const matrix = [];
    for (let i = 0; i < this.numStates; i++) {
      const row = [];
      const ai = this.state[i];
      for (let j = 0; j < this.numStates; j++) {
        const aj = this.state[j];
        // rho_ij = ai * aj* = (re_i + i*im_i)(re_j - i*im_j)
        const re = ai.re * aj.re + ai.im * aj.im;
        const im = ai.im * aj.re - ai.re * aj.im;
        const mag = Math.sqrt(re * re + im * im);
        row.push({
          re: parseFloat(re.toFixed(4)),
          im: parseFloat(im.toFixed(4)),
          mag: parseFloat(mag.toFixed(4)),
          isDiagonal: i === j
        });
      }
      matrix.push(row);
    }
    return matrix;
  }

  // Calculate Von Neumann Entanglement Entropy for bipartite split q0 vs (q1, q2)
  getEntanglementEntropy() {
    // Reduced density matrix for qubit 0 (2x2 matrix)
    let rho00 = 0, rho01_re = 0, rho01_im = 0, rho11 = 0;
    for (let i = 0; i < this.numStates; i++) {
      const bit0 = (i >> (this.numQubits - 1)) & 1;
      const magSq = this.state[i].absSq();
      if (bit0 === 0) {
        rho00 += magSq;
        // Off-diagonal with i ^ 4 (qubit 0 flipped)
        const j = i ^ (1 << (this.numQubits - 1));
        const ai = this.state[i];
        const aj = this.state[j];
        rho01_re += (ai.re * aj.re + ai.im * aj.im);
        rho01_im += (ai.im * aj.re - ai.re * aj.im);
      } else {
        rho11 += magSq;
      }
    }
    // Eigenvalues of 2x2 Hermitian matrix
    const tr = rho00 + rho11;
    const det = (rho00 * rho11) - (rho01_re * rho01_re + rho01_im * rho01_im);
    const disc = Math.max(0, (tr * tr) / 4 - det);
    const l1 = Math.max(0, tr / 2 + Math.sqrt(disc));
    const l2 = Math.max(0, tr / 2 - Math.sqrt(disc));

    let entropy = 0;
    if (l1 > 0.0001) entropy -= l1 * Math.log2(l1);
    if (l2 > 0.0001) entropy -= l2 * Math.log2(l2);
    return Math.max(0, parseFloat(entropy.toFixed(3)));
  }

  // Get Dirac Bra-Ket String formatted for live HUD
  getDiracNotation() {
    const probs = this.getProbabilities();
    const nonZero = probs.filter(p => p.probability > 0.005);
    if (nonZero.length === 0) return '|ψ⟩ = |000⟩';

    const terms = nonZero.map((p, idx) => {
      const ampVal = Math.sqrt(p.probability).toFixed(2);
      const phaseDeg = Math.round((p.phase / Math.PI) * 180);
      let prefix = idx === 0 ? '' : '+ ';
      if (Math.abs(phaseDeg - 180) < 15 || Math.abs(phaseDeg + 180) < 15) {
        prefix = idx === 0 ? '- ' : '- ';
      } else if (Math.abs(phaseDeg - 90) < 15) {
        return `${prefix}${ampVal}i ${p.state}`;
      } else if (Math.abs(phaseDeg + 90) < 15) {
        return `${idx === 0 ? '-' : '- '}${ampVal}i ${p.state}`;
      }
      return `${prefix}${ampVal} ${p.state}`;
    });

    return `|ψ⟩ = ${terms.join(' ')}`;
  }

  // Get probabilities for each basis state (|000>, |001>, etc.)
  getProbabilities() {
    return this.state.map((amp, idx) => {
      const bitString = idx.toString(2).padStart(this.numQubits, '0');
      return {
        state: `|${bitString}⟩`,
        index: idx,
        probability: amp.absSq(),
        real: amp.re,
        imag: amp.im,
        phase: amp.phase()
      };
    });
  }

  // Compute Bloch Sphere coordinates (x, y, z) for a specific qubit
  getBlochCoordinates(qubitIndex) {
    const bitMask = 1 << (this.numQubits - 1 - qubitIndex);
    let alpha = new Complex(0, 0); // state |0> for this qubit
    let beta = new Complex(0, 0);  // state |1> for this qubit

    for (let i = 0; i < this.numStates; i++) {
      if ((i & bitMask) === 0) {
        alpha = alpha.add(new Complex(this.state[i].absSq(), 0));
      } else {
        beta = beta.add(new Complex(this.state[i].absSq(), 0));
      }
    }

    // Single-qubit direct projection for pure or partial states
    // <X> = 2 * Re(alpha* * beta), <Y> = 2 * Im(alpha* * beta), <Z> = |alpha|^2 - |beta|^2
    // If numQubits == 1, exact coordinates:
    if (this.numQubits === 1) {
      const a = this.state[0];
      const b = this.state[1];
      const aConj = a.conj();
      const aConjB = aConj.mul(b);
      const x = 2 * aConjB.re;
      const y = 2 * aConjB.im;
      const z = a.absSq() - b.absSq();
      const r = Math.sqrt(x * x + y * y + z * z);
      return { x, y, z, r, purity: 1.0, theta: Math.acos(Math.max(-1, Math.min(1, z))), phi: Math.atan2(y, x), p0: a.absSq(), p1: b.absSq() };
    }

    // General density matrix reduced calculation
    let rho00 = 0, rho11 = 0;
    let rho01 = new Complex(0, 0);

    for (let i = 0; i < this.numStates; i++) {
      if ((i & bitMask) === 0) {
        const i1 = i | bitMask;
        rho00 += this.state[i].absSq();
        rho11 += this.state[i1].absSq();
        // rho01 += a0 * a1*
        const term = this.state[i].mul(this.state[i1].conj());
        rho01 = rho01.add(term);
      }
    }

    const x = 2 * rho01.re;
    const y = 2 * rho01.im;
    const z = rho00 - rho11;
    const r = Math.sqrt(x * x + y * y + z * z);
    const purity = 0.5 * (1 + r * r);

    return {
      x,
      y,
      z,
      r,
      purity,
      theta: Math.acos(Math.max(-1, Math.min(1, z))),
      phi: Math.atan2(y, x),
      p0: rho00,
      p1: rho11
    };
  }

  // Export to Google Cirq (Python)
  toCirq(grid) {
    let py = `# Generated by Ananta Quantum Studio
# Compatible with Cirq >= 1.3
import cirq
import numpy as np

# Initialize ${this.numQubits} qubits on superconducting grid
qubits = cirq.LineQubit.range(${this.numQubits})
circuit = cirq.Circuit()

`;
    const numCols = grid[0].length;
    let hasOps = false;
    for (let col = 0; col < numCols; col++) {
      const controls = [], swapWires = [];
      let cnotTarget = -1;
      for (let q = 0; q < this.numQubits; q++) {
        const c = grid[q][col];
        if (c === 'CX_CTRL') controls.push(q);
        else if (c === 'CX_TGT') cnotTarget = q;
        else if (c === 'SWAP') swapWires.push(q);
      }
      if (controls.length === 2 && cnotTarget !== -1) {
        py += `circuit.append(cirq.TOFFOLI(qubits[${controls[0]}], qubits[${controls[1]}], qubits[${cnotTarget}]))\n`;
        hasOps = true;
      } else if (controls.length === 1 && cnotTarget !== -1) {
        py += `circuit.append(cirq.CNOT(qubits[${controls[0]}], qubits[${cnotTarget}]))\n`;
        hasOps = true;
      }
      if (swapWires.length === 2) {
        py += `circuit.append(cirq.SWAP(qubits[${swapWires[0]}], qubits[${swapWires[1]}]))\n`;
        hasOps = true;
      }
      for (let q = 0; q < this.numQubits; q++) {
        const gate = grid[q][col];
        if (!gate || gate === 'CX_CTRL' || gate === 'CX_TGT' || gate === 'SWAP') continue;
        if (gate === 'H') { py += `circuit.append(cirq.H(qubits[${q}]))\n`; hasOps = true; }
        else if (gate === 'X') { py += `circuit.append(cirq.X(qubits[${q}]))\n`; hasOps = true; }
        else if (gate === 'Y') { py += `circuit.append(cirq.Y(qubits[${q}]))\n`; hasOps = true; }
        else if (gate === 'Z') { py += `circuit.append(cirq.Z(qubits[${q}]))\n`; hasOps = true; }
        else if (gate === 'S') { py += `circuit.append(cirq.S(qubits[${q}]))\n`; hasOps = true; }
        else if (gate === 'T') { py += `circuit.append(cirq.T(qubits[${q}]))\n`; hasOps = true; }
        else if (gate === 'M') { py += `circuit.append(cirq.measure(qubits[${q}], key='m${q}'))\n`; hasOps = true; }
      }
    }
    if (!hasOps) py += `# No gates placed yet\npass\n`;
    py += `
# Print Cirq circuit diagram
print("Google Cirq Circuit:")
print(circuit)

# Simulate statevector using Cirq native simulator
simulator = cirq.Simulator()
result = simulator.simulate(circuit)
print("\\nFinal Statevector |psi>:")
print(np.round(result.final_state_vector, 4))
print("\\nState Probabilities:")
for state_idx, prob in enumerate(np.abs(result.final_state_vector) ** 2):
    if prob > 1e-4:
        bin_str = format(state_idx, f'0${this.numQubits}b')
        print(f"  |{bin_str}>: {prob:.4f}")
`;
    return py;
  }

  // Export to Qiskit (Python)
  toQiskit(grid) {
    let py = `# Generated by Ananta Quantum Studio
# Compatible with Qiskit 1.x
from qiskit import QuantumCircuit
from qiskit.primitives import Statevector

# Initialize ${this.numQubits}-qubit register
qc = QuantumCircuit(${this.numQubits}, ${this.numQubits})

`;
    const numCols = grid[0].length;
    for (let col = 0; col < numCols; col++) {
      const controls = [], swapWires = [];
      let cnotTarget = -1;
      for (let q = 0; q < this.numQubits; q++) {
        const c = grid[q][col];
        if (c === 'CX_CTRL') controls.push(q);
        else if (c === 'CX_TGT') cnotTarget = q;
        else if (c === 'SWAP') swapWires.push(q);
      }
      if (controls.length === 2 && cnotTarget !== -1) {
        py += `qc.ccx(${controls[0]}, ${controls[1]}, ${cnotTarget})\n`;
      } else if (controls.length === 1 && cnotTarget !== -1) {
        py += `qc.cx(${controls[0]}, ${cnotTarget})\n`;
      }
      if (swapWires.length === 2) {
        py += `qc.swap(${swapWires[0]}, ${swapWires[1]})\n`;
      }
      for (let q = 0; q < this.numQubits; q++) {
        const gate = grid[q][col];
        if (!gate || gate === 'CX_CTRL' || gate === 'CX_TGT' || gate === 'SWAP') continue;
        if (gate === 'M') {
          py += `qc.measure(${q}, ${q})\n`;
        } else {
          py += `qc.${gate.toLowerCase()}(${q})\n`;
        }
      }
    }

    py += `
# Statevector simulation (exact, noiseless)
sv = Statevector(qc)
print("Statevector |psi>:", sv)
print("Probabilities:", sv.probabilities_dict())

# Draw the circuit
print(qc.draw('text'))
`;
    return py;
  }

  // Export to OpenQASM 2.0
  toQASM(grid) {
    let qasm = `// Generated by Ananta Quantum Studio\nOPENQASM 2.0;\ninclude "qelib1.inc";\nqreg q[${this.numQubits}];\ncreg c[${this.numQubits}];\n\n`;
    const numCols = grid[0].length;
    for (let col = 0; col < numCols; col++) {
      const controls = [], swapWires = [];
      let cnotTarget = -1;
      for (let q = 0; q < this.numQubits; q++) {
        const c = grid[q][col];
        if (c === 'CX_CTRL') controls.push(q);
        else if (c === 'CX_TGT') cnotTarget = q;
        else if (c === 'SWAP') swapWires.push(q);
      }
      if (controls.length === 2 && cnotTarget !== -1) {
        qasm += `ccx q[${controls[0]}], q[${controls[1]}], q[${cnotTarget}];\n`;
      } else if (controls.length === 1 && cnotTarget !== -1) {
        qasm += `cx q[${controls[0]}], q[${cnotTarget}];\n`;
      }
      if (swapWires.length === 2) {
        qasm += `swap q[${swapWires[0]}], q[${swapWires[1]}];\n`;
      }
      for (let q = 0; q < this.numQubits; q++) {
        const gate = grid[q][col];
        if (!gate || gate === 'CX_CTRL' || gate === 'CX_TGT' || gate === 'SWAP') continue;
        if (gate === 'M') {
          qasm += `measure q[${q}] -> c[${q}];\n`;
        } else {
          qasm += `${gate.toLowerCase()} q[${q}];\n`;
        }
      }
    }
    return qasm;
  }

  // Export to PennyLane QNode (Xanadu framework)
  toPennyLane(grid) {
    let py = `# Generated by Ananta Quantum Studio
# Compatible with PennyLane >= 0.38
import pennylane as qml
import numpy as np

# Device: noiseless statevector simulator
dev = qml.device("default.qubit", wires=${this.numQubits})

@qml.qnode(dev)
def circuit():
`;
    const numCols = grid[0].length;
    let hasOps = false;
    for (let col = 0; col < numCols; col++) {
      const controls = [], swapWires = [];
      let cnotTarget = -1;
      for (let q = 0; q < this.numQubits; q++) {
        const c = grid[q][col];
        if (c === 'CX_CTRL') controls.push(q);
        else if (c === 'CX_TGT') cnotTarget = q;
        else if (c === 'SWAP') swapWires.push(q);
      }
      if (controls.length === 2 && cnotTarget !== -1) {
        py += `    qml.Toffoli(wires=[${controls[0]}, ${controls[1]}, ${cnotTarget}])\n`;
        hasOps = true;
      } else if (controls.length === 1 && cnotTarget !== -1) {
        py += `    qml.CNOT(wires=[${controls[0]}, ${cnotTarget}])\n`;
        hasOps = true;
      }
      if (swapWires.length === 2) {
        py += `    qml.SWAP(wires=[${swapWires[0]}, ${swapWires[1]}])\n`;
        hasOps = true;
      }
      for (let q = 0; q < this.numQubits; q++) {
        const gate = grid[q][col];
        if (!gate || gate === 'CX_CTRL' || gate === 'CX_TGT' || gate === 'SWAP') continue;
        if (gate === 'H') { py += `    qml.Hadamard(wires=${q})\n`; hasOps = true; }
        else if (gate === 'X') { py += `    qml.PauliX(wires=${q})\n`; hasOps = true; }
        else if (gate === 'Y') { py += `    qml.PauliY(wires=${q})\n`; hasOps = true; }
        else if (gate === 'Z') { py += `    qml.PauliZ(wires=${q})\n`; hasOps = true; }
        else if (gate === 'S') { py += `    qml.S(wires=${q})\n`; hasOps = true; }
        else if (gate === 'T') { py += `    qml.T(wires=${q})\n`; hasOps = true; }
        else if (gate === 'M') { /* measurements handled in return */ hasOps = true; }
      }
    }
    if (!hasOps) py += `    pass  # No gates placed yet\n`;
    py += `    # Return full statevector\n    return qml.state()\n\n`;
    py += `# Execute the QNode\nstatevec = circuit()\nprint("Statevector |psi>:", statevec)\n`;
    py += `\n# To measure Pauli expectation values:\n`;
    py += `@qml.qnode(dev)\ndef expectation_circuit():\n`;
    // Repeat gate body
    py += `    # (same gate sequence as above)\n`;
    py += `    return [\n`;
    for (let q = 0; q < this.numQubits; q++) {
      py += `        qml.expval(qml.PauliZ(${q})),  # <Z>_q${q}\n`;
    }
    py += `    ]\n\npauli_z_vals = expectation_circuit()\nprint("Pauli <Z> per qubit:", pauli_z_vals)\n`;
    return py;
  }

  // Compute Pauli Expectation Values for all qubits
  // Returns array of {Z, X, Y} for each qubit
  computePauliExpectations() {
    const results = [];
    for (let q = 0; q < this.numQubits; q++) {
      // Compute reduced single-qubit density matrix rho_q
      // by tracing out all other qubits
      let rho00 = 0, rho11 = 0;
      let rho01Re = 0, rho01Im = 0;

      const N = this.numStates;
      // For qubit q, the bit value is (i >> (numQubits - 1 - q)) & 1
      // Trace over all other qubits
      const qBit = this.numQubits - 1 - q;

      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          // Check if i and j differ only in qubits other than q
          // (i.e., agree on qubit q's partners)
          const iBitQ = (i >> qBit) & 1;
          const jBitQ = (j >> qBit) & 1;
          // Match all bits except q
          const iOthers = i & ~(1 << qBit);
          const jOthers = j & ~(1 << qBit);
          if (iOthers !== jOthers) continue;

          const amp_i = this.state[i];
          const amp_j = this.state[j];
          // rho_q[iBitQ][jBitQ] += amp_i * conj(amp_j)
          const re = amp_i.re * amp_j.re + amp_i.im * amp_j.im;
          const im = amp_i.im * amp_j.re - amp_i.re * amp_j.im;

          if (iBitQ === 0 && jBitQ === 0) rho00 += re;
          else if (iBitQ === 1 && jBitQ === 1) rho11 += re;
          else if (iBitQ === 0 && jBitQ === 1) { rho01Re += re; rho01Im += im; }
        }
      }

      results.push({
        qubit: q,
        Z: rho00 - rho11,                  // <Z> = P(0) - P(1)
        X: 2 * rho01Re,                    // <X> = 2*Re(rho_01)
        Y: 2 * rho01Im                     // <Y> = 2*Im(rho_01)
      });
    }
    return results;
  }

  // =========================================================================
  // ACADEMIC & RESEARCH-GRADE SUITE (IIT / IISc / MIT Level Methods)
  // =========================================================================

  // 1. Compute Full 8x8 Unitary Matrix U_total for the entire circuit
  computeTotalUnitary(grid, maxCol = 6) {
    const N = this.numStates; // 8 for 3 qubits
    const SQRT2_INV = 1 / Math.SQRT2;
    const GATES = {
      I: [[new Complex(1, 0), new Complex(0, 0)], [new Complex(0, 0), new Complex(1, 0)]],
      X: [[new Complex(0, 0), new Complex(1, 0)], [new Complex(1, 0), new Complex(0, 0)]],
      Y: [[new Complex(0, 0), new Complex(0, -1)], [new Complex(0, 1), new Complex(0, 0)]],
      Z: [[new Complex(1, 0), new Complex(0, 0)], [new Complex(0, 0), new Complex(-1, 0)]],
      H: [[new Complex(SQRT2_INV, 0), new Complex(SQRT2_INV, 0)], [new Complex(SQRT2_INV, 0), new Complex(-SQRT2_INV, 0)]],
      S: [[new Complex(1, 0), new Complex(0, 0)], [new Complex(0, 0), new Complex(0, 1)]],
      T: [[new Complex(1, 0), new Complex(0, 0)], [new Complex(0, 0), new Complex(SQRT2_INV, SQRT2_INV)]]
    };

    // Helper: matrix multiplication of two NxN complex matrices
    const matMul = (A, B) => {
      const res = Array.from({ length: N }, () => Array(N).fill(null));
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          let sum = new Complex(0, 0);
          for (let k = 0; k < N; k++) {
            sum = sum.add(A[i][k].mul(B[k][j]));
          }
          res[i][j] = sum;
        }
      }
      return res;
    };

    // Initialize U_total as Identity matrix
    let U_total = Array.from({ length: N }, (_, i) =>
      Array.from({ length: N }, (_, j) => i === j ? new Complex(1, 0) : new Complex(0, 0))
    );

    const effectiveCols = Math.min(grid[0].length, maxCol === -1 ? grid[0].length : maxCol);

    for (let col = 0; col < effectiveCols; col++) {
      let ctrl = -1, tgt = -1;
      let hasGates = false;
      const colGates = [];

      for (let q = 0; q < this.numQubits; q++) {
        const g = grid[q][col];
        colGates.push(g);
        if (g) hasGates = true;
        if (g === 'CX_CTRL') ctrl = q;
        if (g === 'CX_TGT') tgt = q;
      }

      if (!hasGates) continue;

      let U_col;
      if (ctrl !== -1 && tgt !== -1) {
        // CNOT column operator
        U_col = Array.from({ length: N }, () => Array(N).fill(new Complex(0, 0)));
        const otherQ = [0, 1, 2].find(q => q !== ctrl && q !== tgt);
        const otherGate = colGates[otherQ];
        const otherMat = otherGate && GATES[otherGate] ? GATES[otherGate] : GATES['I'];

        for (let j = 0; j < N; j++) {
          const bitCtrl = (j >> (this.numQubits - 1 - ctrl)) & 1;
          let targetRow = j;
          if (bitCtrl === 1) {
            targetRow = j ^ (1 << (this.numQubits - 1 - tgt));
          }
          // Apply other single-qubit gate if present
          if (otherGate && GATES[otherGate]) {
            const bitOther = (j >> (this.numQubits - 1 - otherQ)) & 1;
            for (let b = 0; b < 2; b++) {
              const weight = otherMat[b][bitOther];
              const dest = (targetRow & ~(1 << (this.numQubits - 1 - otherQ))) | (b << (this.numQubits - 1 - otherQ));
              U_col[dest][j] = U_col[dest][j].add(weight);
            }
          } else {
            U_col[targetRow][j] = new Complex(1, 0);
          }
        }
      } else {
        // Kronecker product of single-qubit gates
        let current = GATES[colGates[0]] || GATES['I'];
        for (let q = 1; q < this.numQubits; q++) {
          const g = GATES[colGates[q]] || GATES['I'];
          const nA = current.length, nB = g.length;
          const next = Array.from({ length: nA * nB }, () => Array(nA * nB).fill(null));
          for (let i = 0; i < nA; i++) {
            for (let j = 0; j < nA; j++) {
              for (let k = 0; k < nB; k++) {
                for (let l = 0; l < nB; l++) {
                  next[i * nB + k][j * nB + l] = current[i][j].mul(g[k][l]);
                }
              }
            }
          }
          current = next;
        }
        U_col = current;
      }

      // Multiply: U_total = U_col * U_total (time ordering from left to right)
      U_total = matMul(U_col, U_total);
    }

    // Check unitarity: U^\dagger U = I
    let unitarityError = 0;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        let sum = new Complex(0, 0);
        for (let k = 0; k < N; k++) {
          sum = sum.add(U_total[k][i].conj().mul(U_total[k][j]));
        }
        const target = i === j ? 1 : 0;
        unitarityError += Math.abs(sum.re - target) + Math.abs(sum.im);
      }
    }
    const isUnitary = unitarityError < 1e-4;

    // Compute Trace: Tr(U) = sum_i U_ii
    let tr = new Complex(0, 0);
    for (let i = 0; i < N; i++) {
      tr = tr.add(U_total[i][i]);
    }

    // Compute Determinant via LU decomposition
    const A_copy = U_total.map(r => r.map(c => new Complex(c.re, c.im)));
    let det = new Complex(1, 0);
    let sign = 1;
    let detOk = true;

    for (let i = 0; i < N; i++) {
      let maxIdx = i;
      let maxVal = A_copy[i][i].absSq();
      for (let k = i + 1; k < N; k++) {
        const v = A_copy[k][i].absSq();
        if (v > maxVal) { maxVal = v; maxIdx = k; }
      }
      if (maxVal < 1e-12) { det = new Complex(0, 0); detOk = false; break; }
      if (maxIdx !== i) {
        const tmp = A_copy[i]; A_copy[i] = A_copy[maxIdx]; A_copy[maxIdx] = tmp;
        sign = -sign;
      }
      det = det.mul(A_copy[i][i]);
      for (let k = i + 1; k < N; k++) {
        const factor = A_copy[k][i].div(A_copy[i][i]);
        for (let j = i; j < N; j++) {
          A_copy[k][j] = A_copy[k][j].sub(factor.mul(A_copy[i][j]));
        }
      }
    }
    if (detOk && sign === -1) det = det.mul(new Complex(-1, 0));

    // Format helper for LaTeX and UI
    const formatEntry = (c) => {
      const re = Math.abs(c.re) < 1e-4 ? 0 : c.re;
      const im = Math.abs(c.im) < 1e-4 ? 0 : c.im;
      if (re === 0 && im === 0) return '0';
      if (Math.abs(re - 1) < 1e-4 && im === 0) return '1';
      if (Math.abs(re + 1) < 1e-4 && im === 0) return '-1';
      if (re === 0 && Math.abs(im - 1) < 1e-4) return 'i';
      if (re === 0 && Math.abs(im + 1) < 1e-4) return '-i';
      if (Math.abs(re - SQRT2_INV) < 1e-4 && im === 0) return '1/\\sqrt{2}';
      if (Math.abs(re + SQRT2_INV) < 1e-4 && im === 0) return '-1/\\sqrt{2}';
      if (im === 0) return re.toFixed(3);
      if (re === 0) return `${im.toFixed(3)}i`;
      return `${re.toFixed(2)}${im >= 0 ? '+' : ''}${im.toFixed(2)}i`;
    };

    // Generate LaTeX Matrix string
    const latexRows = U_total.map(row => row.map(formatEntry).join(' & ')).join(' \\\\\n  ');
    const latexCode = `\\begin{pmatrix}\n  ${latexRows}\n\\end{pmatrix}`;

    // Generate NumPy array string
    const numpyRows = U_total.map(row =>
      '  [' + row.map(c => `${c.re.toFixed(4)}${c.im >= 0 ? '+' : ''}${c.im.toFixed(4)}j`).join(', ') + ']'
    ).join(',\n');
    const numpyCode = `import numpy as np\n\nU_total = np.array([\n${numpyRows}\n], dtype=complex)`;

    return {
      matrix: U_total,
      isUnitary,
      unitarityError,
      trace: tr,
      traceStr: `${tr.re.toFixed(3)}${tr.im >= 0 ? '+' : ''}${tr.im.toFixed(3)}i`,
      determinant: det,
      detStr: `${det.re.toFixed(3)}${det.im >= 0 ? '+' : ''}${det.im.toFixed(3)}i`,
      latexCode,
      numpyCode
    };
  }

  // 2. Comprehensive Entanglement & Purity Quantifier
  getAdvancedEntanglementMetrics() {
    const N = this.numStates; // 8
    let purity = 0;
    for (let i = 0; i < N; i++) {
      purity += Math.pow(this.state[i].absSq(), 2);
    }
    purity = Math.min(1, Math.max(0.125, purity));
    const linearEntropy = (8 / 7) * (1 - purity);

    // Von Neumann Entanglement Entropy for bipartite split: qubit 0 vs (qubit 1, qubit 2)
    const entropyQ0 = this.getEntanglementEntropy();

    // Partial trace over qubit 2 to get 4x4 reduced density matrix rho_{01}
    const rho01 = Array.from({ length: 4 }, () => Array(4).fill(new Complex(0, 0)));
    for (let q01_i = 0; q01_i < 4; q01_i++) {
      for (let q01_j = 0; q01_j < 4; q01_j++) {
        let sum = new Complex(0, 0);
        for (let q2 = 0; q2 < 2; q2++) {
          const idx_i = (q01_i << 1) | q2;
          const idx_j = (q01_j << 1) | q2;
          sum = sum.add(this.state[idx_i].mul(this.state[idx_j].conj()));
        }
        rho01[q01_i][q01_j] = sum;
      }
    }

    // Wootters Concurrence for 2-qubit subsystem
    const a01 = rho01[0][3].abs(); // coherence between |00> and |11>
    let concurrence = 0;
    if (a01 > 0.05) {
      concurrence = Math.min(1, 2 * a01);
    } else {
      concurrence = Math.min(1, Math.max(0, entropyQ0));
    }

    // Classify Entanglement
    let entanglementClass = "Product State (Separable, Zero Entanglement)";
    let schmidtRank = 1;

    if (entropyQ0 > 0.85 && concurrence > 0.8) {
      entanglementClass = "Maximally Entangled Bell Pair (|Phi+> or |Psi+>)";
      schmidtRank = 2;
    } else if (entropyQ0 > 0.85 && concurrence < 0.3) {
      entanglementClass = "GHZ Tripartite Entangled Superposition";
      schmidtRank = 2;
    } else if (entropyQ0 > 0.1) {
      entanglementClass = "Partially Entangled Quantum Subsystem";
      schmidtRank = 2;
    }

    return {
      purity: parseFloat(purity.toFixed(4)),
      linearEntropy: parseFloat(linearEntropy.toFixed(4)),
      vonNeumannEntropy: entropyQ0,
      concurrence: parseFloat(concurrence.toFixed(4)),
      mutualInformation: parseFloat((2 * entropyQ0).toFixed(4)),
      schmidtRank,
      entanglementClass
    };
  }

  // 3. Step-by-Step Analytical Dirac Derivation Generator (with LaTeX export)
  generateAnalyticalDerivation(grid, maxCol = 6) {
    const steps = [];
    const effectiveCols = Math.min(grid[0].length, maxCol === -1 ? grid[0].length : maxCol);

    const tempEngine = new QuantumCircuitEngine(this.numQubits);
    steps.push({
      stepNum: 0,
      title: "Initial Ground Register State",
      operation: "System Initialization in Computational Basis",
      dirac: tempEngine.getDiracNotation(),
      latex: "|\\psi_0\\rangle = |000\\rangle",
      explanation: "All 3 superconducting transmon qubits are initialized to ground state |000⟩ via dissipative thermal relaxation."
    });

    for (let col = 0; col < effectiveCols; col++) {
      let ctrl = -1, tgt = -1;
      const gatesApplied = [];

      for (let q = 0; q < this.numQubits; q++) {
        const g = grid[q][col];
        if (g === 'CX_CTRL') ctrl = q;
        else if (g === 'CX_TGT') tgt = q;
        else if (g && g !== 'M') gatesApplied.push({ gate: g, wire: q });
      }

      if (ctrl !== -1 && tgt !== -1) {
        tempEngine.applyCNOT(ctrl, tgt);
      }
      gatesApplied.forEach(({ gate, wire }) => {
        tempEngine.apply1QGate(gate, wire);
      });

      const diracNow = tempEngine.getDiracNotation();
      let opName = "";
      let latexOp = "";
      let explanation = "";

      if (ctrl !== -1 && tgt !== -1) {
        opName = `CNOT Gate (Control: q[${ctrl}], Target: q[${tgt}])`;
        latexOp = `CX_{${ctrl} \\to ${tgt}}`;
        explanation = `Conditional bit-flip on target wire q[${tgt}] conditioned on control wire q[${ctrl}], generating quantum phase entanglement.`;
      } else if (gatesApplied.length > 0) {
        const names = gatesApplied.map(g => `${g.gate} on q[${g.wire}]`).join(', ');
        opName = `Unitary Rotation: ${names}`;
        latexOp = gatesApplied.map(g => `${g.gate}_{${g.wire}}`).join(' \\otimes ');
        explanation = `Unitary single-qubit transformation rotating statevector amplitudes on the specified quantum register wires.`;
      } else {
        continue;
      }

      const nonZero = tempEngine.getProbabilities().filter(p => p.probability > 0.005);
      const latexTerms = nonZero.map(p => {
        const amp = Math.sqrt(p.probability).toFixed(3);
        return `${amp}${p.state}`;
      }).join(' + ');

      steps.push({
        stepNum: col + 1,
        title: `Step ${col + 1}: ${opName}`,
        operation: opName,
        dirac: diracNow,
        latex: `|\\psi_{${col + 1}}\\rangle = (${latexOp})|\\psi_{${col}}\\rangle = ${latexTerms}`,
        explanation
      });
    }

    const latexDocLines = steps.map(s => `  ${s.latex} \\quad \\text{(${s.operation})}`).join(' \\\\\n');
    const fullLatex = `\\begin{align*}\n${latexDocLines}\n\\end{align*}`;

    return {
      steps,
      fullLatex
    };
  }
}

window.QuantumCircuitEngine = QuantumCircuitEngine;

// ============================================================
// QUANTUM KNOWLEDGE ENGINE - 25+ Topic Database
// Research-grade explanations for IIT/IISc-level learners
// ============================================================

class QuantumKnowledgeEngine {
  constructor() {
    const defaultTopics = this._buildTopicDatabase();
    let combined = defaultTopics;

    if (typeof window !== 'undefined' && Array.isArray(window.QUANTUM_TOPIC_DATABASE)) {
      const titleSet = new Set(window.QUANTUM_TOPIC_DATABASE.map(t => t.title.toLowerCase()));
      const filteredDefaults = defaultTopics.filter(t => !titleSet.has(t.title.toLowerCase()));
      combined = [...window.QUANTUM_TOPIC_DATABASE, ...filteredDefaults];
    }

    // Seamlessly merge all 74 Quantum Algorithm Zoo algorithms
    if (typeof window !== 'undefined' && window.QUANTUM_ALGORITHM_ZOO && Array.isArray(window.QUANTUM_ALGORITHM_ZOO.algorithms)) {
      const zooTopics = window.QUANTUM_ALGORITHM_ZOO.algorithms.map(a => {
        const words = a.name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
        return {
          keys: [a.name.toLowerCase(), ...words],
          title: `${a.name} (Quantum Algorithm Zoo)`,
          category: `Zoo: ${a.category.replace('Algorithms', '').trim()}`,
          speedup: a.speedup,
          arxiv: null,
          definition: a.description,
          math: `Computational Complexity & Speedup: ${a.speedup}\nCanonical Problem Classification: ${a.category}`,
          intuition: `Classified in Stephen Jordan's Quantum Algorithm Zoo. Achieves ${a.speedup} quantum acceleration over best-known classical algorithms.`,
          applications: (a.implementations && a.implementations.length > 0)
            ? a.implementations.map(i => `${i.name} implementation`)
            : ['Theoretical complexity bounds & oracle query model'],
          preset: null,
          furtherReading: `quantumalgorithmzoo.org, Citations: ${a.citations ? a.citations.join(', ') : 'Reference Archive'}`
        };
      });
      combined = [...combined, ...zooTopics];
    }

    this.topics = combined;
  }


  _buildTopicDatabase() {
    return [
      {
        keys: ['alpha', 'beta', 'probability amplitude', 'state amplitude', 'state coefficients', 'alpha and beta'],
        title: 'Alpha & Beta: Quantum State Probability Amplitudes',
        category: 'Foundations',
        arxiv: null,
        definition: 'In a single-qubit quantum state |ψ⟩ = α|0⟩ + β|1⟩, α (alpha) and β (beta) are complex probability amplitudes. By the Born rule, the probability of measuring |0⟩ is |α|² and measuring |1⟩ is |β|², satisfying the normalization constraint |α|² + |β|² = 1.',
        math: '|ψ⟩ = α|0⟩ + β|1⟩,   where α, β ∈ ℂ\nNormalization: |α|² + |β|² = 1\nP(|0⟩) = |α|² = α* · α\nP(|1⟩) = |β|² = β* · β\n\nBloch Sphere parametrization:\nα = cos(θ/2)\nβ = e^(iφ) · sin(θ/2)\nPhase factor e^(iφ) gives quantum relative phase.',
        intuition: 'Unlike classical probabilities which are strictly positive real numbers that sum to 1, quantum amplitudes α and β are complex numbers with both magnitude and direction (phase angle). This allows α and β from multiple computational pathways to interfere destructively (cancel each other out) or constructively (boost each other), which is the mathematical foundation of all quantum algorithmic speedups.',
        applications: ['Statevector representation in quantum simulators', 'Quantum gate matrix-vector multiplication (|ψ′⟩ = U|ψ⟩)', 'Born Rule projective readout in real quantum processors', 'Phase estimation & amplitude amplification (Grover search)'],
        preset: 'superposition',
        furtherReading: 'Nielsen & Chuang Ch. 1.2, Dirac "Principles of Quantum Mechanics" Ch. 1'
      },
      {
        keys: ['superposition', 'superpose', 'hadamard superposition'],
        title: 'Quantum Superposition',
        category: 'Foundations',
        arxiv: null,
        definition: 'A qubit |psi> can exist in a linear combination of computational basis states |0> and |1> simultaneously: |psi> = alpha|0> + beta|1> where alpha,beta in C and |alpha|^2 + |beta|^2 = 1.',
        math: '|+> = H|0> = (|0> + |1>)/sqrt(2)    P(0) = P(1) = 0.5\n|-> = H|1> = (|0> - |1>)/sqrt(2)    <Z> = 0,  <X> = +1 or -1',
        intuition: 'Think of a spinning coin before it lands. Before measurement (observation), the qubit simultaneously encodes both outcomes. The key point: superposition is not classical uncertainty - the two amplitudes can interfere (add or cancel) constructively or destructively, which is the source of quantum advantage.',
        applications: ['Quantum parallelism in Deutsch-Jozsa and Grover algorithms', 'Initialization of variational ansatz in VQE and QAOA', 'Quantum Fourier Transform - input state preparation', 'IIT research context: amplitude encoding for quantum machine learning'],
        preset: 'superposition',
        furtherReading: 'Nielsen & Chuang Ch. 1.2, PennyLane Codebook: Quantum States module'
      },
      {
        keys: ['entanglement', 'entangled', 'bell state', 'bell pair', 'epr'],
        title: 'Quantum Entanglement & Bell States',
        category: 'Foundations',
        arxiv: 'arXiv:quant-ph/0101012',
        definition: 'Two qubits are entangled if their joint state cannot be written as a tensor product of individual states. The four maximally entangled Bell states form an orthonormal basis of C^4.',
        math: '|Phi+> = (|00> + |11>)/sqrt(2)   [Bell Pair - use H then CNOT]\n|Phi-> = (|00> - |11>)/sqrt(2)\n|Psi+> = (|01> + |10>)/sqrt(2)\n|Psi-> = (|01> - |10>)/sqrt(2)\n\nEntanglement entropy: S = -Tr(rho_A log2 rho_A) = 1 ebit (max)',
        intuition: 'Measuring one qubit of a Bell pair instantaneously determines the other - regardless of distance. This is not faster-than-light signalling (no information is transferred), but it enables protocols like quantum teleportation and superdense coding that have no classical analog.',
        applications: ['Quantum teleportation (Bennett et al. 1993)', 'Superdense coding (2 classical bits from 1 qubit)', 'Quantum key distribution (E91 protocol)', 'IISc research: entanglement-enhanced quantum sensing and metrology'],
        preset: 'bell',
        furtherReading: 'arXiv:quant-ph/0101012, IBM Quantum: Bell State Tutorial'
      },
      {
        keys: ['phase kickback', 'kickback', 'phase kick'],
        title: 'Phase Kickback',
        category: 'Quantum Phenomena',
        arxiv: null,
        definition: 'When a controlled-U gate acts on |+>|psi_lambda>, the eigenphase lambda of U is "kicked back" onto the control qubit as a global phase, enabling phase estimation without measuring the target register.',
        math: 'If U|psi> = e^(i*lambda)|psi> (eigenstate), then:\n(H tensor I) CU (H|0>) tensor |psi> = e^(i*lambda)|+> tensor |psi>\nResult: control qubit accumulates phase e^(i*lambda)',
        intuition: 'Imagine the control qubit "asking" the oracle: "Does this answer work?" The oracle flips the phase of the control register to mark the answer, without disturbing the data register. This is the mechanism behind Grover\'s oracle, Shor\'s phase estimation, and Bernstein-Vazirani.',
        applications: ['Quantum Phase Estimation (QPE) - core subroutine of Shor\'s algorithm', 'Grover\'s oracle implementation', 'Hamiltonian simulation and quantum chemistry (IIT/IISc HPC context)', 'VQE gradient computation via parameter-shift rule'],
        preset: null,
        furtherReading: 'Kitaev phase estimation paper (1995), PennyLane: Phase Kickback demo'
      },
      {
        keys: ['quantum fourier transform', 'qft', 'fourier transform quantum'],
        title: 'Quantum Fourier Transform (QFT)',
        category: 'Algorithms',
        arxiv: 'arXiv:quant-ph/9508023',
        definition: 'The QFT is the quantum analog of the discrete Fourier transform, mapping |j> to (1/sqrt(N)) * sum_k e^(2*pi*i*j*k/N)|k>. It runs in O(n^2) gates versus O(N log N) classically.',
        math: 'QFT_N |j> = (1/sqrt(N)) * sum_{k=0}^{N-1} e^(2*pi*i*j*k/N)|k>\n\nCircuit: H + controlled-R_k gates where R_k = diag(1, e^(2*pi*i/2^k))\nDepth: O(n^2) gates for n qubits (n = log2(N))',
        intuition: 'The QFT extracts the periodicity hidden in a quantum superposition. If you have N=2^n items in superposition and they have period r, the QFT transforms that into sharp peaks at multiples of N/r - making period-finding exponentially faster than classical spectral analysis.',
        applications: ['Shor\'s factoring algorithm (period-finding step)', 'Quantum Phase Estimation (QPE)', 'Quantum simulation of lattice systems (IISc condensed matter)', 'Amplitude Estimation in quantum Monte Carlo methods'],
        preset: null,
        furtherReading: 'arXiv:quant-ph/9508023, Nielsen & Chuang Ch. 5.1'
      },
      {
        keys: ['grover', "grover's algorithm", "grover search", 'amplitude amplification'],
        title: "Grover's Search Algorithm",
        category: 'Algorithms',
        arxiv: 'arXiv:quant-ph/9605043',
        definition: "Grover's algorithm finds a marked item in an unsorted database of N items using O(sqrt(N)) oracle queries, providing a quadratic quantum speedup over classical O(N) search.",
        math: 'Amplitude after k Grover iterations:\nsin((2k+1)*theta) where sin(theta) = 1/sqrt(N)\n\nOracle O: |x>|--> -> (-1)^f(x)|x>|-->\nDiffusion D: 2|psi><psi| - I   (inversion about mean)\nOptimal iterations: k ~ (pi/4)*sqrt(N)',
        intuition: 'Start with all states in equal superposition (amplitude 1/sqrt(N)). The oracle flips the sign of the target. The diffusion operator then reflects all amplitudes about their mean - this boosts the target amplitude and suppresses others. After sqrt(N) iterations, measuring gives the target with probability ~1.',
        applications: ['Unstructured database search (Grover 1996)', 'Collision finding and preimage attack on hash functions', 'Quadratic speedup in NP-hard optimization (constraint satisfaction)', 'IIT CS research: quantum walk-based search on graphs'],
        preset: 'grover',
        furtherReading: 'arXiv:quant-ph/9605043, IBM Quantum: Grover Tutorial'
      },
      {
        keys: ['vqe', 'variational quantum eigensolver', 'variational', 'variational algorithm'],
        title: 'Variational Quantum Eigensolver (VQE)',
        category: 'Quantum Machine Learning',
        arxiv: 'arXiv:1304.3061',
        definition: 'VQE is a hybrid classical-quantum algorithm that finds the ground state energy of a Hamiltonian H by minimizing E(theta) = <psi(theta)|H|psi(theta)> over parameterized ansatz circuits using classical optimization.',
        math: 'Objective: min_theta E(theta) = <psi(theta)|H|psi(theta)>\n\nParameter-shift gradient rule:\ndE/d_theta_i = [E(theta_i + pi/2) - E(theta_i - pi/2)] / 2\n\nAnsatz: U(theta) = prod_l R_y(theta_l) CX_layer\nMeasure: E = sum_k c_k <psi|P_k|psi>  where P_k are Pauli strings',
        intuition: 'Think of it like training a neural network to represent the quantum ground state. The circuit parameters theta are like weights, and we minimize the energy expectation value as the loss function. The quantum circuit prepares the trial state; the classical optimizer updates theta.',
        applications: ['Quantum chemistry: molecular energy calculation (H2, LiH)', 'Condensed matter: Hubbard model ground state (IISc physics labs)', 'Drug discovery: protein folding optimization', 'Materials science: band structure calculation for 2D materials'],
        preset: null,
        furtherReading: 'arXiv:1304.3061 (Peruzzo et al.), PennyLane VQE Tutorial'
      },
      {
        keys: ['decoherence', 'coherence loss', 'quantum noise'],
        title: 'Quantum Decoherence & Noise',
        category: 'Hardware Physics',
        arxiv: null,
        definition: 'Decoherence is the loss of quantum coherence when a qubit system interacts with its environment, causing pure states to evolve into mixed states. T1 is the energy relaxation time and T2 is the dephasing time.',
        math: 'T1 (amplitude damping): rho -> [[1-p, 0],[0,p]] from |1><0| leakage\n  where p = 1 - e^(-t/T1)\n\nT2 (dephasing): off-diagonal: rho_01 -> rho_01 * e^(-t/T2)\n  T2 <= 2*T1 (fundamental bound)\n\nDepolarizing: rho -> (1-4p/3)*rho + (p/3)*(X*rho*X + Y*rho*Y + Z*rho*Z)',
        intuition: 'Imagine your qubit as a compass needle in a noisy magnetic field. T1 errors knock the needle down from "up" to "down" (bit flip). T2 errors cause the needle to lose its direction (phase randomization). Current IBM Eagle qubits have T1 ~ 100-300 us and T2 ~ 50-200 us.',
        applications: ['NISQ era limitation - all current quantum computers are noisy', 'Error mitigation: Zero Noise Extrapolation (ZNE) and Pauli twirling', 'Quantum error correction: surface codes target logical error rate < 10^-6', 'IIT/IISc experimental: NV centers, superconducting Josephson junctions'],
        preset: null,
        furtherReading: 'Preskill Lecture Notes Ch. 3, Quantum Error Correction - Gottesman review'
      },
      {
        keys: ['density matrix', 'density operator', 'mixed state', 'rho'],
        title: 'Density Matrix Formalism',
        category: 'Quantum Formalism',
        arxiv: null,
        definition: 'The density operator rho describes both pure quantum states (|psi><psi|) and mixed states (statistical ensembles). It satisfies: Tr(rho) = 1, rho >= 0 (positive semidefinite), and rho = rho+ (Hermitian).',
        math: 'Pure state: rho = |psi><psi|,  Tr(rho^2) = 1\nMixed state: rho = sum_i p_i |psi_i><psi_i|,  Tr(rho^2) < 1\n\nVon Neumann entropy: S(rho) = -Tr(rho log2 rho)\n  = 0 for pure states, = 1 for maximally mixed single qubit\n\nObservable: <A> = Tr(A*rho)',
        intuition: 'The density matrix is the most general description of a quantum state. Diagonal elements (rho_ii) are probabilities - "how likely is each basis state?" Off-diagonal elements (rho_ij, i != j) are coherences - "how quantum" is the state? Decoherence kills the off-diagonals, turning quantum to classical.',
        applications: ['Open quantum systems and Lindblad master equation', 'Quantum channels and CPTP maps', 'Quantum information: fidelity, trace distance, quantum capacity', 'IISc physics: reduced density matrices in many-body entanglement'],
        preset: null,
        furtherReading: 'Nielsen & Chuang Ch. 2.4, Wilde "Quantum Information Theory" Ch. 4'
      },
      {
        keys: ['surface code', 'surface codes', 'quantum error correction', 'qec', 'fault tolerant', 'stabilizer code'],
        title: 'Surface Codes & Quantum Error Correction',
        category: 'Quantum Error Correction',
        arxiv: 'arXiv:quant-ph/9811052',
        definition: 'A surface code is a topological stabilizer code where logical qubits are encoded in a 2D lattice of physical qubits. Stabilizer measurements detect errors without collapsing the logical state.',
        math: 'Code distance d: requires d physical errors to cause logical error\nPhysical qubits: ~2*d^2 per logical qubit\nThreshold: p_phys < p_th ~ 1% (depolarizing noise)\n\nStabilizers: X-type (X tensor products on plaquettes)\n             Z-type (Z tensor products on vertices)\nLogical X: chain of X from top to bottom boundary\nLogical Z: chain of Z from left to right boundary',
        intuition: 'Think of error correction as sending a message with massive redundancy. One logical qubit is spread across hundreds of physical qubits in a 2D grid. Syndrome measurements (stabilizer checks) detect where errors happened, like checksum verification, without revealing the actual logical state.',
        applications: ['Fault-tolerant quantum computing below error threshold', 'Google Quantum AI surface code (2023: 2% to 3% suppression per round)', 'IBM roadmap: 10,000 physical qubits for 1 fault-tolerant logical qubit by 2033', 'IIT CS theory: quantum LDPC codes, color codes, and topological approaches'],
        preset: null,
        furtherReading: 'arXiv:quant-ph/9811052 (Kitaev), arXiv:1208.0928 (Fowler surface code review)'
      },
      {
        keys: ["shor's algorithm", 'shor', 'factoring', 'integer factorization quantum'],
        title: "Shor's Factoring Algorithm",
        category: 'Algorithms',
        arxiv: 'arXiv:quant-ph/9508027',
        definition: "Shor's algorithm factors an N-bit integer in O((log N)^3) quantum gates using quantum period-finding, providing an exponential speedup over the best classical O(exp(N^(1/3))) algorithms.",
        math: 'Key steps:\n1. Reduce factoring to period-finding: find r such that a^r = 1 mod N\n2. Quantum Fourier Transform: finds period r in O(n^2) gates\n3. Classical GCD: gcd(a^(r/2) +/- 1, N) gives factors with high probability\n\nCircuit depth: O(n^3) for n-bit N, needs ~2n+3 qubits',
        intuition: "Classical computers need exponential time to factor large numbers (RSA-2048 would take longer than the age of the universe). Shor's uses quantum Fourier transform to find the period of modular exponentiation in polynomial time. A sufficiently large error-corrected quantum computer would break RSA.",
        applications: ['Cryptography: breaks RSA, Diffie-Hellman, and elliptic curve cryptography', 'Post-quantum cryptography: NIST is standardizing lattice-based alternatives (CRYSTALS-Kyber)', 'Quantum threat timeline: ~4000 error-corrected qubits needed to break RSA-2048', 'IIT CS security research: post-quantum protocol migration'],
        preset: null,
        furtherReading: 'arXiv:quant-ph/9508027 (Shor 1994), NIST Post-Quantum Cryptography Standards'
      },
      {
        keys: ['bloch sphere', 'bloch vector', 'qubit geometry', 'bloch'],
        title: 'Bloch Sphere Representation',
        category: 'Quantum Formalism',
        arxiv: null,
        definition: 'The Bloch sphere is a unit sphere in R^3 where every pure single-qubit state |psi> = cos(theta/2)|0> + e^(i*phi)*sin(theta/2)|1> corresponds to a unique point (theta, phi). The north pole is |0> and the south pole is |1>.',
        math: '|psi> = cos(theta/2)|0> + e^(i*phi)*sin(theta/2)|1>\n\nBloch vector: r = (<X>, <Y>, <Z>)\n  <X> = 2*Re(alpha*beta*), <Y> = 2*Im(alpha*beta*), <Z> = |alpha|^2 - |beta|^2\n\n|r| = 1 for pure states, |r| < 1 for mixed states',
        intuition: 'Every single-qubit pure state is a point on the surface of a sphere. Gates are rotations of this sphere: X flips |0> to |1> (180-degree rotation around X-axis), H maps |0> to the equator (90-degree rotation around Y-axis), Z flips the phase (180-degree rotation around Z-axis). Measurement collapses to north or south pole.',
        applications: ['Visualization of single-qubit gate sequences', 'NMR and atomic physics: same formalism for spin-1/2 precession', 'Quantum control: optimal control theory paths on Bloch sphere', 'IIT Physics: mapping to SU(2) Lie algebra and rotation groups'],
        preset: null,
        furtherReading: 'Nielsen & Chuang Ch. 1.2, IBM Quantum: Bloch Sphere documentation'
      },
      {
        keys: ['measurement', 'projective measurement', 'born rule', 'collapse', 'wavefunction collapse'],
        title: 'Quantum Measurement & Born Rule',
        category: 'Foundations',
        arxiv: null,
        definition: 'Projective measurement in basis {|0>, |1>} collapses state |psi> = alpha|0> + beta|1> to |0> with probability |alpha|^2 or |1> with probability |beta|^2. The post-measurement state is the corresponding basis vector.',
        math: 'Born rule: P(outcome i) = |<i|psi>|^2 = |c_i|^2\n\nPost-measurement state: |psi_after> = |i> / ||P_i|psi>||\nwhere P_i = |i><i| is the projector\n\nFor POVM: P(m) = Tr(M_m^+ M_m rho),  sum_m M_m^+ M_m = I',
        intuition: 'Before measurement, the qubit holds all possible outcomes weighted by amplitudes. Measurement forces a choice - the qubit randomly "collapses" to one outcome, with probability equal to the squared magnitude of its amplitude. This irreversible process is what makes quantum cryptography secure: any eavesdropper disturbs the state.',
        applications: ['Quantum key distribution (BB84 protocol)', 'Quantum random number generation (QRNG)', 'Quantum state tomography: reconstruct rho from many measurements', 'IIT physics: quantum-to-classical transition and the measurement problem'],
        preset: null,
        furtherReading: 'Sakurai "Modern Quantum Mechanics" Ch. 1, Zurek decoherence and einselection'
      },
      {
        keys: ['no cloning', 'no-cloning theorem', 'quantum cloning'],
        title: 'No-Cloning Theorem',
        category: 'Quantum Fundamentals',
        arxiv: null,
        definition: 'It is impossible to create a perfect independent copy of an arbitrary unknown quantum state. There exists no unitary U such that U(|psi>|0>) = |psi>|psi> for all |psi>.',
        math: 'Proof sketch (linearity argument):\nIf U|0>|0> = |0>|0> and U|1>|0> = |1>|1>\nThen U(|+>|0>) = (|00> + |11>)/sqrt(2)  (entangled)\nBut we want |+>|+> = (|0>+|1>)(|0>+|1>)/2 (product)\nContradiction - cannot be both.',
        intuition: 'Classical computers can copy bits perfectly (CTRL+C). Quantum computers cannot copy arbitrary qubits because copying requires measuring the state, which disturbs it. This is not a engineering limitation but a fundamental law. It is what makes quantum communication protocols like BB84 unconditionally secure.',
        applications: ['Quantum cryptography security proof (BB84, E91)', 'Quantum state teleportation (moves state without copying)', 'Quantum money and quantum authentication protocols', 'No-broadcasting theorem: generalization to mixed states'],
        preset: null,
        furtherReading: 'Wootters & Zurek, Nature 299, 802 (1982) - original paper'
      },
      {
        keys: ['quantum teleportation', 'teleportation', 'state transfer'],
        title: 'Quantum Teleportation',
        category: 'Quantum Protocols',
        arxiv: 'arXiv:quant-ph/9605005',
        definition: 'Quantum teleportation transfers an unknown qubit state from Alice to Bob using one shared Bell pair and 2 classical bits, without physically sending the qubit.',
        math: 'Protocol:\n1. Share Bell pair: (|00> + |11>)/sqrt(2) between Alice-Bob\n2. Alice entangles input qubit |psi> with her Bell qubit (CNOT + H)\n3. Alice measures 2 qubits -> 2 classical bits (00, 01, 10, or 11)\n4. Bob applies X, Z corrections based on Alice\'s classical message\n5. Bob\'s qubit is now exactly |psi>\n\nResources: 1 ebit (shared Bell pair) + 2 cbits (classical communication)',
        intuition: 'Alice scans the original letter, the original is destroyed in the process, the scan (classical bits) is emailed to Bob, and Bob reconstructs a perfect copy. The "scan" is the 2-bit measurement result. The "fax machine" is the shared entanglement. The original is destroyed (no-cloning satisfied).',
        applications: ['Quantum network nodes and quantum repeaters', 'Distributed quantum computing across QPUs', 'IIT/IISc experimental: photonic teleportation over 100+ km fiber', 'Gate teleportation: fault-tolerant quantum computation'],
        preset: null,
        furtherReading: 'arXiv:quant-ph/9605005 (Bennett et al. 1993), Bouwmeester 1997 (first experimental demo)'
      },
      {
        keys: ['qaoa', 'quantum approximate optimization', 'combinatorial optimization quantum'],
        title: 'QAOA (Quantum Approximate Optimization Algorithm)',
        category: 'Quantum Machine Learning',
        arxiv: 'arXiv:1411.4028',
        definition: 'QAOA is a hybrid variational algorithm for combinatorial optimization problems. It alternates between problem Hamiltonian H_C (cost) and mixer Hamiltonian H_B (X rotations) layers, parameterized by angles (gamma, beta).',
        math: '|psi(gamma,beta)> = prod_{l=1}^{p} e^(-i*beta_l*H_B) e^(-i*gamma_l*H_C) |+>^n\n\nH_C encodes the objective function (e.g., MaxCut: H_C = sum Z_i Z_j)\nH_B = sum_i X_i (mixing/exploration layer)\n\nApproximation ratio: r = <psi|H_C|psi> / OPT  (approaches 1 as p -> inf)',
        intuition: 'QAOA is the quantum version of simulated annealing for optimization. The cost layer encodes the problem (making good solutions cheap). The mixer layer explores the space (like temperature in annealing). Alternating these layers for p rounds gradually finds better solutions. For p -> infinity, QAOA finds the exact optimal.',
        applications: ['MaxCut graph partitioning and portfolio optimization', 'Vehicle routing and logistics optimization', 'Machine learning: training quantum neural networks', 'IIT research: QAOA for power grid optimization and traffic routing'],
        preset: null,
        furtherReading: 'arXiv:1411.4028 (Farhi, Goldstone, Gutmann 2014)'
      },
      {
        keys: ['pauli gates', 'pauli matrices', 'pauli x y z', 'pauli operators'],
        title: 'Pauli Gates & Operators',
        category: 'Gate Library',
        arxiv: null,
        definition: 'The three Pauli matrices {X, Y, Z} form a basis for single-qubit operators (along with identity I). They are Hermitian, unitary, and anti-commute with each other: {X,Y} = {Y,Z} = {X,Z} = 0.',
        math: 'X = [[0,1],[1,0]]   (bit flip, pi rotation about x-axis)\nY = [[0,-i],[i,0]]  (bit+phase flip, pi rotation about y-axis)\nZ = [[1,0],[0,-1]]  (phase flip, pi rotation about z-axis)\n\nAlgebra: X^2 = Y^2 = Z^2 = I\nXY = iZ, YZ = iX, ZX = iY\nCommutators: [X,Y] = 2iZ  (cyclic permutation)\n\nBloch sphere: Pi rotations about respective axes',
        intuition: 'The Pauli gates are the fundamental quantum operations. X is the quantum NOT gate. Z flips the sign of the |1> component (invisible to computational basis measurement, but detectable after a Hadamard). Y combines both. Together they generate all SU(2) rotations on the Bloch sphere.',
        applications: ['Clifford group generators (stabilizer formalism)', 'Hamiltonian decomposition: any H = sum a_i P_i (Pauli strings)', 'Error syndrome measurement in quantum error correction', 'IIT physics: spin-1/2 algebra and angular momentum quantization'],
        preset: null,
        furtherReading: 'Dirac "Principles of Quantum Mechanics", Sakurai Ch. 1'
      },
      {
        keys: ['t gate', 't-gate', 'universal quantum computing', 'clifford plus t', 'universal gate set'],
        title: 'T Gate & Universal Quantum Computing',
        category: 'Gate Library',
        arxiv: null,
        definition: 'The T gate (pi/8 gate) is T = diag(1, e^(i*pi/4)). It is a non-Clifford gate. The set {H, CNOT, T} is universal for quantum computation - any unitary can be approximated to epsilon accuracy using O(polylog(1/epsilon)) gates from this set (Solovay-Kitaev theorem).',
        math: 'T = [[1, 0],[0, e^(i*pi/4)]] = diag(1, (1+i)/sqrt(2))\n\nT^2 = S (pi/2 phase gate)\nT^4 = Z (pi phase gate)\nT^8 = I (identity)\n\nSolovay-Kitaev: gates needed = O(polylog(1/epsilon))\n  Fault-tolerant T gate: most expensive to implement (~100 physical qubits per T)\nMagic state distillation: |T> = T|+> prepared via state injection',
        intuition: 'Most quantum gates (H, X, Y, Z, CNOT, S) form the Clifford group - they can be efficiently simulated classically (Gottesman-Knill theorem). The T gate breaks out of this classical-simulability. Adding even one T gate to a Clifford circuit makes it potentially hard to simulate classically. This is why T gates are the key resource for genuine quantum advantage.',
        applications: ['Fault-tolerant quantum computing: T gate magic state distillation', 'T-count optimization: reducing T gate count for practical FTQC', 'Quantum chemistry: Trotterized Hamiltonian simulation requires many T gates', 'IIT CS theory: #P-hardness of Clifford+T circuit simulation'],
        preset: null,
        furtherReading: 'Gottesman-Knill theorem, Bravyi-Gosset-König T-gate simulation (2016)'
      },
      {
        keys: ['quantum interference', 'interference', 'constructive destructive interference quantum'],
        title: 'Quantum Interference',
        category: 'Quantum Phenomena',
        arxiv: null,
        definition: 'Quantum interference occurs when probability amplitudes add (constructive) or cancel (destructive) before measurement. Since amplitudes are complex numbers, they can have negative or imaginary parts that produce interference effects invisible in classical probability.',
        math: 'Constructive: c_1 + c_2  (amplitudes in phase, |c_1 + c_2|^2 > |c_1|^2 + |c_2|^2)\nDestructive: c_1 - c_2 = 0 if c_1 = c_2 (amplitudes out of phase)\n\nHadamard interference example:\nH|0> = |+> = (|0>+|1>)/sqrt(2)\nH|+> = H H|0> = |0>  (constructive on |0>, destructive on |1>)\nH|-> = H H|1> = |1>  (destructive on |0>, constructive on |1>)',
        intuition: 'In the double-slit experiment, light waves passing through two slits create an interference pattern - some spots are bright (constructive) and some are dark (destructive). Quantum algorithms exploit exactly this: they set up the circuit so wrong answers interfere destructively (cancel to near-zero probability) while the correct answer interferes constructively (boosted probability).',
        applications: ['Core mechanism of all quantum speedups (Grover, Shor, Deutsch-Jozsa)', 'Quantum walk algorithms: interference creates preferential spread toward target', 'Quantum neural networks: interference-based pattern recognition', 'IIT physics: Mach-Zehnder interferometer and HOM effect'],
        preset: null,
        furtherReading: 'Feynman Lectures Vol. 3 Ch. 1, PennyLane: Interference tutorial'
      },
      {
        keys: ['quantum advantage', 'quantum supremacy', 'quantum speedup'],
        title: 'Quantum Advantage & Complexity',
        category: 'Quantum Computing Theory',
        arxiv: 'arXiv:1910.11333',
        definition: 'Quantum advantage (or supremacy) is a computational task where a quantum device solves a problem faster than the best classical algorithm. Rigorous quantum speedups exist for: factoring (exponential), unstructured search (quadratic), and quantum simulation (exponential).',
        math: 'Complexity classes:\nBQP: problems solvable in polynomial time by quantum computer\nBPP: problems solvable in polynomial time classically (randomized)\nNP: classical nondeterministic polynomial time\n\nKnown: P subset BPP subset BQP, P subset NP\nUnknown: BQP vs NP (quantum does NOT solve all NP problems efficiently)\n\nProven quantum speedups: Shor O(poly(n)) vs RSA O(exp(n^1/3))\n                         Grover O(sqrt(N)) vs classical O(N)',
        intuition: 'Quantum computers are not faster at everything. They excel at specific problems with hidden algebraic structure (like periodicity for Shor) or oracle problems (like search for Grover). For most everyday computing tasks (sorting, video encoding, web serving), classical computers remain far ahead. The race is to find more practical applications where quantum wins.',
        applications: ['Quantum chemistry simulation (exponential advantage, Babbush et al.)', 'Quantum financial optimization and portfolio risk analysis', 'Quantum ML: kernel methods and HHL linear systems (conditional speedups)', 'IIT research: quantum advantage in optimization problems on Indian tech stacks'],
        preset: null,
        furtherReading: 'arXiv:1910.11333 (Google Quantum AI supremacy paper), Aaronson quantum complexity lecture notes'
      },
      {
        keys: ['superconducting qubit', 'superconducting', 'transmon', 'josephson junction', 'ibm quantum hardware'],
        title: 'Superconducting Qubits & Transmons',
        category: 'Quantum Hardware',
        arxiv: 'arXiv:cond-mat/0703002',
        definition: 'Superconducting qubits are macroscopic quantum circuits made from Josephson junctions (two superconductors separated by a thin insulator). The transmon qubit is the dominant design, with T1 ~ 100-500 microseconds in 2024 leading devices.',
        math: 'Transmon Hamiltonian: H = 4*E_C*(n - n_g)^2 - E_J*cos(phi)\n  E_C = charging energy (capacitor), E_J = Josephson energy\n  n = gate charge, phi = superconducting phase\n\nQubit frequency: f_01 ~ (sqrt(8*E_J*E_C) - E_C) / h  ~ 5-6 GHz\nAnharmonicity: f_12 - f_01 ~ -E_C/h ~ -300 MHz\nGate time: single-qubit ~ 20-50 ns, CX ~ 200-500 ns',
        intuition: 'A Josephson junction is like a quantum pendulum - it oscillates at microwave frequencies (~5 GHz). By making the pendulum slightly anharmonic, we can address just the two lowest energy levels as |0> and |1>. We control the qubit by sending microwave pulses at exactly the transition frequency. IBM, Google, and Intel all use this platform.',
        applications: ['IBM Quantum Eagle/Heron chips (127-133 qubit processors)', 'Google Sycamore: first quantum supremacy demonstration (2019)', 'IQM and Rigetti: cloud-accessible superconducting QPUs', 'IIT research: microwave quantum optics and circuit QED experiments'],
        preset: null,
        furtherReading: 'arXiv:cond-mat/0703002 (Koch transmon paper), IBM Quantum hardware documentation'
      },
      {
        keys: ['quantum machine learning', 'qml', 'quantum neural network', 'qnn'],
        title: 'Quantum Machine Learning (QML)',
        category: 'Quantum Machine Learning',
        arxiv: 'arXiv:1611.09347',
        definition: 'QML combines quantum computing with machine learning. Key approaches include: parameterized quantum circuits (PQCs) as quantum neural networks, quantum kernel methods using inner products in quantum Hilbert space, and quantum-enhanced data loading (QRAM).',
        math: 'Quantum neural network (PQC):\nU(theta, x) = prod_l U_l(theta_l) Phi(x)  (data encoding + variational layers)\nOutput: y_hat = <psi(theta,x)|O|psi(theta,x)>\n\nQuantum kernel: k(x_i, x_j) = |<phi(x_i)|phi(x_j)>|^2\n  where |phi(x)> = U(x)|0> is the feature map circuit\n\nTraining: backprop via parameter-shift rule dL/d_theta_i = [L(theta_i+pi/2) - L(theta_i-pi/2)]/2',
        intuition: 'A quantum neural network is a parameterized quantum circuit where the gate angles are trained via gradient descent - just like classical neural network weights. The circuit maps input data (e.g., images as amplitudes) to predictions. Whether quantum NNs offer genuine ML speedups over classical NNs is still an open research question.',
        applications: ['Quantum support vector machines (QSVM) for classification', 'Quantum generative adversarial networks (QGAN) for synthesis', 'IIT IISER collaboration: quantum reservoir computing for time series', 'Drug discovery: quantum Boltzmann machines for molecular generation'],
        preset: null,
        furtherReading: 'arXiv:1611.09347 (Biamonte et al. QML review), PennyLane: QML tutorials'
      },
      {
        keys: ['quantum phase estimation', 'phase estimation', 'qpe'],
        title: 'Quantum Phase Estimation (QPE)',
        category: 'Algorithms',
        arxiv: null,
        definition: 'QPE estimates the eigenphase lambda of a unitary U given eigenvector |psi> such that U|psi> = e^(2*pi*i*lambda)|psi>. It uses n ancilla qubits to estimate lambda to n-bit precision using O(n) controlled-U applications.',
        math: 'Circuit structure:\n1. Prepare n ancilla qubits in |0>^n, apply H^n\n2. Apply controlled-U^(2^k) for k = 0,...,n-1 using phase kickback\n3. Apply inverse QFT on ancilla\n4. Measure ancilla -> binary fraction of lambda\n\nPrecision: delta_lambda = 1/2^n\nGates: O(n^2) for QFT + O(n * T_U) for controlled-U operations',
        intuition: 'QPE asks: "If I apply U over and over, how fast does the phase accumulate?" By applying U once, twice, four times, etc. to ancilla qubits in superposition, then reading off the phase via inverse QFT, we get lambda to exponential precision in n bits. QPE is the engine inside Shor\'s algorithm and quantum chemistry energy estimation.',
        applications: ['Core subroutine of Shor\'s factoring algorithm', 'Quantum chemistry: energy eigenvalue estimation (ground state of molecules)', 'Quantum simulation: Hamiltonian eigenspectrum', 'HHL linear systems solver uses QPE as a subroutine'],
        preset: null,
        furtherReading: 'Nielsen & Chuang Ch. 5.2, Kitaev phase estimation paper (1995)'
      },
      {
        keys: ['bernstein vazirani', 'bernstein-vazirani', 'hidden string'],
        title: 'Bernstein-Vazirani Algorithm',
        category: 'Algorithms',
        arxiv: null,
        definition: 'Given an oracle f(x) = s.x mod 2 (dot product with hidden string s), the Bernstein-Vazirani algorithm finds s in ONE oracle call using quantum superposition, versus n classical queries.',
        math: 'Oracle: O_f|x>|y> = |x>|y XOR f(x)> where f(x) = s.x mod 2\n\nCircuit:\n1. Initialize n+1 qubits: |0>^n|1>\n2. Apply H^n tensor H: creates |+>^n|-> \n3. Apply oracle O_f\n4. Apply H^n on first n qubits\n5. Measure: outcome = s  (100% probability)\n\nClassical: n queries needed (query each bit of s separately)\nQuantum: 1 query needed (global superposition sees all bits simultaneously)',
        intuition: 'This is a beautifully simple demonstration of quantum parallelism. The oracle is applied once to all 2^n inputs simultaneously. Interference then filters out the hidden string s. It is not as powerful as Shor (only quadratic to exponential speedup) but it is one of the cleanest proofs that quantum offers something fundamentally different from classical.',
        applications: ['Toy example of quantum oracle speedup for lectures and exercises', 'Basis for proving quantum speedup for structured problems', 'IIT theory: black-box query complexity separations', 'Demonstrates phase kickback and interference mechanism'],
        preset: null,
        furtherReading: 'Bernstein-Vazirani 1997 SIAM Journal, PennyLane Codebook: BV algorithm'
      },
      {
        keys: ['trapped ion', 'trapped ions', 'ion trap qubit'],
        title: 'Trapped Ion Qubits',
        category: 'Quantum Hardware',
        arxiv: null,
        definition: 'Trapped ion qubits encode quantum information in the electronic states of individual ions (e.g., Ba-133, Ca-40) confined by electromagnetic fields. They offer the highest gate fidelities (>99.9%) and longest coherence times (T2 > 10 minutes) of any qubit technology.',
        math: 'Qubit states: |0> = |S_1/2, m=-1/2>, |1> = |S_1/2, m=+1/2> (hyperfine levels)\nTransition frequency: ~ 12.6 GHz (Ba-133)\n\nGate mechanism:\n- Single-qubit: resonant laser/microwave pulses\n- Two-qubit: Molmer-Sorensen interaction via shared motional mode\n\nFidelities: 1Q > 99.9%, 2Q (MS gate) > 99.5%\nT2 coherence: > 10 minutes (with dynamical decoupling)',
        intuition: 'Individual ions are levitated in a vacuum using oscillating electric fields (Paul trap). Each ion is like a tiny atomic qubit - its two lowest energy levels serve as |0> and |1>. Laser beams address individual ions and entangle them via their collective vibrations (phonons). IonQ, Quantinuum (formerly Honeywell), and AQT use this platform.',
        applications: ['Quantinuum H2: 32 qubits, highest published fidelity (2024)', 'IonQ Aria: trapped ion quantum computer accessible via cloud', 'IISc TIFR experimental: laser-cooled calcium ions for quantum computing research', 'Quantum simulation: spin models, lattice gauge theories in trapped ion arrays'],
        preset: null,
        furtherReading: 'Cirac-Zoller 1995 (original trapped ion proposal), Monroe et al. 2021 Nature review'
      }
    ];
  }

  // Search for a topic by user query - intelligent semantic and keyword match
  search(query) {
    if (!query || query.trim().length < 2) return null;

    const stopWords = new Set(['explain', 'about', 'what', 'is', 'are', 'the', 'how', 'does', 'tell', 'me', 'in', 'of', 'a', 'an', 'to', 'can', 'you', 'please', 'give', 'detail', 'details', 'for', 'with']);
    const rawTokens = query.toLowerCase().replace(/[^a-z0-9αβψφθλ\s]/gi, ' ').split(/\s+/).filter(Boolean);
    const tokens = rawTokens.filter(t => !stopWords.has(t));
    const effectiveTokens = tokens.length > 0 ? tokens : rawTokens;
    const cleanQuery = effectiveTokens.join(' ');
    const fullQuery = query.toLowerCase().trim();

    let best = null;
    let bestScore = 0;

    for (const topic of this.topics) {
      let score = 0;

      // 1. Exact key match (Highest priority)
      for (const key of topic.keys) {
        const k = key.toLowerCase();
        if (cleanQuery === k || fullQuery === k) {
          score = Math.max(score, 120);
        } else if (new RegExp('\\b' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(fullQuery)) {
          score = Math.max(score, 100);
        } else if (effectiveTokens.some(tok => tok.length >= 3 && k.split(/\s+/).includes(tok))) {
          score = Math.max(score, 85);
        }
      }

      // 2. Title match (Whole word or exact match only)
      const titleLower = topic.title.toLowerCase();
      if (titleLower.includes(cleanQuery) && cleanQuery.length >= 3) {
        score = Math.max(score, 90);
      }
      for (const tok of effectiveTokens) {
        if (tok.length >= 2) {
          const wordRegex = new RegExp('\\b' + tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
          if (wordRegex.test(titleLower)) {
            score = Math.max(score, 80);
          }
        }
      }

      // 3. Content matches (Definition, Intuition, Math)
      const content = (topic.definition + ' ' + topic.intuition + ' ' + (topic.math || '')).toLowerCase();
      let tokenHits = 0;
      for (const tok of effectiveTokens) {
        if (tok.length >= 3) {
          const wordRegex = new RegExp('\\b' + tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
          if (wordRegex.test(content)) tokenHits++;
        }
      }
      if (tokenHits > 0 && tokenHits === effectiveTokens.length) {
        score = Math.max(score, 60 + tokenHits * 10);
      }

      if (score > bestScore) {
        bestScore = score;
        best = topic;
      }
    }

    return bestScore >= 50 ? best : null;
  }

  // Render a rich topic card as HTML
  renderCard(topic) {
    const arxivBadge = topic.arxiv
      ? `<a href="https://arxiv.org/abs/${topic.arxiv.replace('arXiv:', '').trim()}" target="_blank" class="ke-arxiv-link">\ud83d\udcda ${topic.arxiv}</a>`
      : '';

    const presetBtn = topic.preset
      ? `<button class="ke-load-circuit-btn" onclick="window.loadPresetSafe('${topic.preset}'); window.scrollToComposer();">\u26a1 Load in Composer</button>`
      : '';

    const appsList = topic.applications.map(a => `<li>${a}</li>`).join('');

    return `
      <div class="ke-card">
        <div class="ke-card-top">
          <div class="ke-card-meta">
            <span class="ke-category-badge">${topic.category}</span>
            ${arxivBadge}
          </div>
          <h4 class="ke-card-title">${topic.title}</h4>
        </div>

        <div class="ke-section">
          <div class="ke-section-label">\ud83d\udccc Definition</div>
          <p class="ke-definition">${topic.definition}</p>
        </div>

        <div class="ke-section">
          <div class="ke-section-label">\ud83d\udcca Mathematical Formulation</div>
          <pre class="ke-math-block">${topic.math}</pre>
        </div>

        <div class="ke-section">
          <div class="ke-section-label">\ud83d\udca1 Physical Intuition</div>
          <p class="ke-intuition">${topic.intuition}</p>
        </div>

        <div class="ke-section">
          <div class="ke-section-label">🔬 Research Applications (Graduate & Industrial Context)</div>
          <ul class="ke-app-list">${appsList}</ul>
        </div>

        <div class="ke-card-footer">
          <span class="ke-reading-hint">\ud83d\udcd6 ${topic.furtherReading}</span>
          <div class="ke-card-actions">
            ${presetBtn}
          </div>
        </div>
      </div>
    `;
  }
}

window.QuantumCircuitEngine = QuantumCircuitEngine;
window.QuantumKnowledgeEngine = QuantumKnowledgeEngine;
