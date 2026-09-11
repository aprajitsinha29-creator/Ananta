/**
 * Ananta - Topic-Specific Learning Journey & Adaptive Roadmap
 * Matches user query against prerequisite-mapped curriculum modules,
 * renders staggered waterfall module cards, and conditionally renders
 * side-by-side live Circuit Designer exercises.
 */

class TopicRoadmapManager {
  constructor() {
    this.container = typeof document !== 'undefined' ? document.getElementById('view-topic-roadmap') : null;
    this.currentCuratedModules = [];
    this.generatedModules = [];
    this.activeModule = null;
    this.isDockedInSplit = false;

    // Define Master Curriculum Modules (18 Core Modules with Landmark Research Citations)
    this.modules = [
      {
        id: 'module-01',
        docId: 'doc-sec-hilbert',
        number: 'Module 01',
        title: 'Hilbert Space & Statevector Representation',
        category: 'Foundations',
        level: 'Beginner',
        timeEst: '15 mins',
        summary: 'Understand complex probability amplitudes, the Born rule, and continuous statevectors in 2^n dimensional Hilbert space.',
        researchPaper: 'Dirac, Principles of Quantum Mechanics (1930) / Born, Z. Phys. (1926)',
        circuitPreset: null,
        mathFormula: '|ψ⟩ = α|0⟩ + β|1⟩,   where |α|² + |β|² = 1',
        intuition: 'A qubit is not a classical bit with uncertainty. It is a unit vector on the complex sphere where amplitudes can constructively or destructively interfere.'
      },
      {
        id: 'module-02',
        docId: 'doc-sec-unitaries',
        number: 'Module 02',
        title: 'Gate Unitaries & Matrix Evolution',
        category: 'Quantum Gates',
        level: 'Beginner',
        timeEst: '20 mins',
        summary: 'Learn single-qubit rotations (H, X, Y, Z, S, T) and multi-qubit Kronecker expansions that preserve quantum norm.',
        researchPaper: 'Nielsen & Chuang, Quantum Computation & Quantum Information (2010)',
        circuitPreset: 'superposition',
        expectedOutput: { states: { '|000⟩': 0.5, '|100⟩': 0.5 }, tolerance: 0.12 },
        mathFormula: 'U · U† = I,   |+⟩ = H|0⟩ = (|0⟩ + |1⟩)/√2',
        intuition: 'Every quantum gate is a reversible rotation in Hilbert space. Applying H puts the qubit into equal superposition.',
        exerciseGoal: 'Arm the Hadamard (H) gate and place it on Qubit 0. Observe measurement probabilities become 50% for |0⟩ and 50% for |1⟩.'
      },
      {
        id: 'module-03',
        docId: 'doc-sec-density',
        number: 'Module 03',
        title: 'Density Matrix Formalism & Mixed States',
        category: 'Statistical Physics',
        level: 'Intermediate',
        timeEst: '25 mins',
        summary: 'Explore pure vs mixed quantum states, partial trace over entangled subsystems, and von Neumann entropy.',
        researchPaper: 'von Neumann, Mathematische Grundlagen der Quantenmechanik (1932)',
        circuitPreset: null,
        mathFormula: 'ρ = ∑ p_i |ψ_i⟩⟨ψ_i|,   Tr(ρ) = 1,   Tr(ρ²) ≤ 1',
        intuition: 'When a qubit is entangled or decohered, it can no longer be described by a statevector alone. The density matrix tracks classical mixture and quantum coherences.'
      },
      {
        id: 'module-04',
        docId: 'doc-sec-pauli',
        number: 'Module 04',
        title: 'Pauli Observables & Expectation Values',
        category: 'Measurements',
        level: 'Intermediate',
        timeEst: '20 mins',
        summary: 'Calculate expectation values ⟨Z⟩, ⟨X⟩, ⟨Y⟩ from physical projective measurements and density matrices.',
        researchPaper: 'Pauli, Z. Phys. 43, 601 (1927)',
        circuitPreset: 'superposition',
        expectedOutput: { states: { '|000⟩': 0.5, '|100⟩': 0.5 }, tolerance: 0.12 },
        mathFormula: '⟨O⟩ = ⟨ψ|O|ψ⟩ = Tr(ρ O),   ⟨Z⟩ = P(0) - P(1)',
        intuition: 'Pauli observables quantify the projection of the quantum state along the Bloch sphere coordinate axes.',
        exerciseGoal: 'Switch on Pauli Observables on the left panel to watch ⟨Z⟩ drop to 0 and ⟨X⟩ rise to +1 when H is applied.'
      },
      {
        id: 'module-05',
        docId: 'doc-sec-decoherence',
        number: 'Module 05',
        title: 'Decoherence & Lindblad Master Equation',
        category: 'Hardware Physics',
        level: 'Advanced',
        timeEst: '30 mins',
        summary: 'Model energy relaxation (T1) and transverse dephasing (T2) in physical superconducting transmon qubits.',
        researchPaper: 'G. Lindblad, Commun. Math. Phys. 48, 119 (1976)',
        circuitPreset: null,
        mathFormula: 'dρ/dt = -i[H, ρ] + ∑ (L_k ρ L_k† - ½ {L_k† L_k, ρ})',
        intuition: 'Quantum systems are not isolated. Coupling to thermal electromagnetic environments causes phase information to leak out exponentially.'
      },
      {
        id: 'module-06',
        docId: 'doc-sec-circuit-qasm',
        number: 'Module 06',
        title: 'OpenQASM 3.0 & Google Cirq AST Compilation',
        category: 'Software Engineering',
        level: 'Intermediate',
        timeEst: '25 mins',
        summary: 'Master syntax translation between Python SDKs (Cirq, Qiskit, Braket) and standard hardware assembly languages.',
        researchPaper: 'Cross et al., OpenQASM 3.0 Spec, ACM TOCS (2022)',
        circuitPreset: 'bell',
        expectedOutput: { states: { '|000⟩': 0.5, '|110⟩': 0.5 }, tolerance: 0.12 },
        mathFormula: 'OPENQASM 3.0; qubit[2] q; h q[0]; cx q[0], q[1];',
        intuition: 'Transpilers map mathematical unitary matrices into hardware-native pulse sequences and gate topologies.',
        exerciseGoal: 'Synthesize a 2-qubit circuit and inspect the generated Cirq / QASM code export.'
      },
      {
        id: 'module-07',
        docId: 'doc-sec-entanglement',
        number: 'Module 07',
        title: 'Entanglement Entropy & Bell States',
        category: 'Quantum Phenomena',
        level: 'Intermediate',
        timeEst: '25 mins',
        summary: 'Construct the four maximally entangled Einstein-Podolsky-Rosen (EPR) Bell states and measure entanglement entropy.',
        researchPaper: 'Einstein, Podolsky, Rosen (1935) / J. S. Bell, Physics 1 (1964)',
        circuitPreset: 'bell',
        expectedOutput: { states: { '|000⟩': 0.5, '|110⟩': 0.5 }, tolerance: 0.12 },
        mathFormula: '|Φ⁺⟩ = (|00⟩ + |11⟩)/√2,   S(ρ_A) = 1.000 ebit',
        intuition: 'Entangled qubits exhibit correlations that cannot be explained by any local classical variables, violating Bell inequalities.',
        exerciseGoal: 'Place an H gate on Qubit 0 followed by a CNOT (control on q0, target on q1) to generate the |Φ⁺⟩ Bell pair.'
      },
      {
        id: 'module-08',
        docId: 'doc-sec-teleportation',
        number: 'Module 08',
        title: 'Quantum Teleportation Protocol',
        category: 'Quantum Protocols',
        level: 'Advanced',
        timeEst: '30 mins',
        summary: 'Transmit an unknown quantum state using a pre-shared Bell pair, Bell-state measurement, and 2 classical bits.',
        researchPaper: 'Bennett, Brassard, Crépeau, Jozsa, Peres, Wootters, PRL 70 (1993)',
        circuitPreset: 'teleport',
        expectedOutput: { states: { '|000⟩': 0.25, '|001⟩': 0.25, '|010⟩': 0.25, '|011⟩': 0.25 }, tolerance: 0.15 },
        mathFormula: '|ψ⟩ ⊗ |Φ⁺⟩ → Bell Measurement → Pauli Correction (X^b Z^a)',
        intuition: 'Information is transferred without moving physical matter, respecting the No-Cloning theorem because the source state is destroyed.',
        exerciseGoal: 'Load the Teleportation preset in the circuit designer to trace amplitude transfer from q0 to q2.'
      },
      {
        id: 'module-09',
        docId: 'doc-sec-grover',
        number: 'Module 09',
        title: 'Grover Search & Amplitude Amplification',
        category: 'Quantum Algorithms',
        level: 'Advanced',
        timeEst: '35 mins',
        summary: 'Achieve quadratic speedup O(√N) for unstructured database search using phase oracles and diffusion inversion.',
        researchPaper: 'L. K. Grover, STOC \'96 (1996) / Phys. Rev. Lett. 79 (1997)',
        circuitPreset: 'grover',
        expectedOutput: { states: { '|110⟩': 1.0 }, tolerance: 0.2 },
        mathFormula: 'G = (2|ψ⟩⟨ψ| - I) · O_f,   Iterations ≈ (π/4)√N',
        intuition: 'By inverting target states around the average mean amplitude, the probability of measuring the correct answer surges toward 100%.',
        exerciseGoal: 'Observe the Grover diffusion operator amplify the marked basis state in the probability distribution.'
      },
      {
        id: 'module-10',
        docId: 'doc-sec-vqe',
        number: 'Module 10',
        title: 'Variational Quantum Eigensolver (VQE)',
        category: 'NISQ Algorithms',
        level: 'Advanced',
        timeEst: '35 mins',
        summary: 'Hybrid quantum-classical optimization to calculate molecular ground state energies and chemical binding curves.',
        researchPaper: 'Peruzzo, McClean, Shadbolt, O\'Brien et al., Nature Comm. 5 (2014)',
        circuitPreset: 'vqe',
        mathFormula: 'E(θ) = ⟨ψ(θ)|H_molecule|ψ(θ)⟩ ≥ E_ground',
        intuition: 'The quantum processor computes state energy efficiently while a classical optimizer tunes gate parameters iteratively.',
        exerciseGoal: 'Inspect the VQE ansatz circuit for Hydrogen H2 and run the variational energy evaluation.'
      },
      {
        id: 'module-11',
        docId: 'doc-sec-qft',
        number: 'Module 11',
        title: 'Quantum Fourier Transform & Phase Estimation (QPE)',
        category: 'Quantum Algorithms',
        level: 'Advanced',
        timeEst: '35 mins',
        summary: 'Extract eigenvalues of unitary operators with exponential speedup over classical FFT, forming the computational core of Shor’s factoring and quantum simulation.',
        researchPaper: 'P. Shor, FOCS (1994) / A. Kitaev, arXiv:quant-ph/9511026 (1995)',
        circuitPreset: 'grover',
        mathFormula: '|j⟩ ↦ (1/√N) ∑ ω^{j k} |k⟩,   where ω = e^{2πi / N}',
        intuition: 'QFT transforms state basis from computational amplitude space to phase frequency space through controlled phase rotations and Hadamards.',
        exerciseGoal: 'Trace phase kickback interference on the ancillary register to resolve operator eigenvalues with binary precision.'
      },
      {
        id: 'module-12',
        docId: 'doc-sec-surface-code',
        number: 'Module 12',
        title: 'Fault-Tolerant Surface Codes & Quantum Error Correction',
        category: 'FTQC Hardware',
        level: 'Advanced',
        timeEst: '40 mins',
        summary: 'Protect quantum memory using topological 2D lattice stabilizer codes (X and Z syndrome checks) with threshold error rates near 1%.',
        researchPaper: 'A. Fowler et al., Phys. Rev. A 86 (2012) / Google Quantum AI, Nature 614 (2023)',
        circuitPreset: null,
        mathFormula: 'S = ⟨g_1, g_2, ..., g_{n-k}⟩,   g_i |ψ_L⟩ = +1 |ψ_L⟩,   d = 2t + 1',
        intuition: 'Physical qubits inevitably suffer decoherence. By entangling data qubits with ancilla syndrome checkers in a checkerboard lattice, errors can be detected and corrected without measuring the underlying superposition.',
        exerciseGoal: 'Analyze minimum-weight perfect matching (MWPM) syndrome graphs and verify logical error suppression below physical fault thresholds.'
      },
      {
        id: 'module-13',
        docId: 'doc-sec-qaoa',
        number: 'Module 13',
        title: 'Quantum Approximate Optimization Algorithm (QAOA)',
        category: 'NISQ Optimization',
        level: 'Advanced',
        timeEst: '30 mins',
        summary: 'Solve NP-hard combinatorial graph problems (Max-Cut, TSP, Portfolio Optimization) by alternating problem cost and transverse driver Hamiltonians.',
        researchPaper: 'E. Farhi, J. Goldstone, S. Gutmann, arXiv:1411.4028 (2014)',
        circuitPreset: 'vqe',
        mathFormula: '|γ, β⟩ = ∏ e^{-i β_p H_M} e^{-i γ_p H_C} |+⟩^{\\otimes n}',
        intuition: 'QAOA is the discrete Trotterized analog of adiabatic quantum computing, steering states along an energy landscape toward the ground-state solution.',
        exerciseGoal: 'Synthesize parameterized cost unitaries for a 4-node Max-Cut graph and optimize variational angle parameters (γ, β).'
      },
      {
        id: 'module-14',
        docId: 'doc-sec-qml',
        number: 'Module 14',
        title: 'Quantum Machine Learning & Quantum Kernel Estimation',
        category: 'Quantum AI',
        level: 'Advanced',
        timeEst: '35 mins',
        summary: 'Map classical datasets non-linearly into high-dimensional Hilbert feature spaces to evaluate quantum kernels and train variational quantum classifiers (VQC).',
        researchPaper: 'V. Havlíček et al., Nature 567 (2019) / M. Schuld & N. Killoran, PRL 122 (2019)',
        circuitPreset: 'bell',
        mathFormula: 'K(x, x\') = |⟨Φ(x)|Φ(x\')⟩|² = |⟨0| U_Φ†(x\') U_Φ(x) |0⟩|²',
        intuition: 'Classical SVMs struggle with complex feature spaces. Quantum processors can compute inner products in exponentially large spaces where classical computation is intractable.',
        exerciseGoal: 'Encode a 2D dataset with ZZ-feature maps and observe separation boundaries in quantum kernel space.'
      },
      {
        id: 'module-15',
        docId: 'doc-sec-pulse-control',
        number: 'Module 15',
        title: 'Microwave Pulse Control & Hamiltonian Drive (DRAG)',
        category: 'Control Physics',
        level: 'Advanced',
        timeEst: '35 mins',
        summary: 'Synthesize sub-nanosecond Gaussian and DRAG microwave envelope pulses to eliminate leakage into transmon higher excited states (|2⟩).',
        researchPaper: 'F. Motzoi et al., Phys. Rev. Lett. 103, 110501 (2009)',
        circuitPreset: null,
        mathFormula: 'Ω(t) = Ω_x(t) cos(ω_d t) - (Ω̇_x(t) / Δ) sin(ω_d t)',
        intuition: 'A transmon is a weakly anharmonic oscillator. Fast pulses have spectral width that can accidentally excite the qubit out of computational subspace unless derivative correction (DRAG) cancels out-of-phase leakage.',
        exerciseGoal: 'Tune DRAG derivative scaling factor to suppress non-computational leakage below 10^-4.'
      },
      {
        id: 'module-16',
        docId: 'doc-sec-pqc',
        number: 'Module 16',
        title: 'Post-Quantum Cryptography & Shor Threat Analysis',
        category: 'Security & PQC',
        level: 'Advanced',
        timeEst: '30 mins',
        summary: 'Quantify cryptographic risk timelines (Y2K8 / Y2Q) for RSA-2048 and ECC, and evaluate NIST lattice-based standards (ML-KEM, ML-DSA).',
        researchPaper: 'NIST FIPS 203 / 204 Standards (2024) / C. Gidney & M. Ekerå, Quantum 5 (2021)',
        circuitPreset: null,
        mathFormula: 'N = p · q,   Shor Logical Qubits ≈ 2n + 2,   LWE Hardness: A s + e = b (mod q)',
        intuition: 'While classical RSA and ECC are completely broken in polynomial time by Shor’s period finding, Learning With Errors (LWE) high-dimensional lattice vectors have no known quantum speedup.',
        exerciseGoal: 'Calculate physical error-corrected qubit overheads required to break RSA-2048 at physical error rate 10^-3.'
      },
      {
        id: 'module-17',
        docId: 'doc-sec-cryo-hardware',
        number: 'Module 17',
        title: 'Cryogenic Hardware & Superconducting Qubit Physics',
        category: 'Cryo Engineering',
        level: 'Advanced',
        timeEst: '30 mins',
        summary: 'Explore dilution refrigerator thermodynamics (3He/4He phase separation), thermal quasiparticle poisoning, and transmon Josephson energy ratios (Ej/Ec >> 1).',
        researchPaper: 'J. Koch et al., Phys. Rev. A 76, 042319 (2007) Transmon Physics',
        circuitPreset: null,
        mathFormula: 'H = 4 E_C (n - n_g)² - E_J cos(φ),   E_J / E_C ≈ 50-80,   T_base ≈ 15 mK',
        intuition: 'Thermal fluctuations at room temperature (~300 K / 26 meV) would immediately destroy fragile micro-eV quantum superpositions. Dilution refrigerators cool transmons down to 15 millikelvin to freeze out blackbody radiation.',
        exerciseGoal: 'Balance dilution cooling power against coaxial RF line attenuation at the 4K and 100mK stages.'
      },
      {
        id: 'module-18',
        docId: 'doc-sec-quantum-internet',
        number: 'Module 18',
        title: 'Quantum Internet, Repeaters & Entanglement Swapping',
        category: 'Quantum Networks',
        level: 'Advanced',
        timeEst: '35 mins',
        summary: 'Distribute entanglement across planetary distances without physical qubit transit using quantum memory repeaters and Bell state measurements.',
        researchPaper: 'H. J. Kimble, Nature 453, 1023–1030 (2008) "The Quantum Internet"',
        circuitPreset: 'teleport',
        mathFormula: '|Φ⁺⟩₁₂ ⊗ |Φ⁺⟩₃₄  --[BSM₂₃]-->  |Φ⁺⟩₁₄   (Entanglement Swapped across distance)',
        intuition: 'Optical fiber attenuation absorbs photons over long distances. Since quantum states cannot be classically amplified (No-Cloning theorem), quantum repeaters use entanglement swapping at intermediate nodes to link distant stations.',
        exerciseGoal: 'Trace Bell state projection on intermediate nodes to verify non-local entanglement established between end nodes 1 and 4.'
      }
    ];

    // Predefined Topic Matching Knowledge Matrix
    this.topicPatterns = [
      {
        topicId: 'beginner-track',
        displayName: 'Beginner Foundations: Hilbert Space, Gates & Entanglement',
        description: 'Structured zero-to-hero onboarding designed for learners starting with 0 prior knowledge: master statevectors, rotations, measurement, and Bell pairs.',
        keywords: [
          'beginner', 'beginner roadmap', 'beginner track', 'foundations', 'start', 'intro', 'introduction',
          'beginner to advanced', 'basics', 'zero knowledge', 'getting started', 'learn quantum', 'i am already a beginner',
          'i am beginner', 'for beginner', 'starter', 'starting from scratch'
        ],
        moduleIds: ['module-01', 'module-02', 'module-04', 'module-06', 'module-07']
      },
      {
        topicId: 'intermediate-track',
        displayName: 'Intermediate Pathway: Circuit Engineering, Teleportation & Grover',
        description: 'Accelerated track for learners with math/coding basics: bypasses definitions and dives straight into Pauli algebra, Cirq, Bell states, teleportation, and Grover search.',
        keywords: [
          'intermediate', 'intermediate track', 'know basics', 'moderate', 'some knowledge', 'intermediate roadmap',
          'i know basics', 'already know basics', 'developer', 'quantum programmer'
        ],
        moduleIds: ['module-02', 'module-04', 'module-06', 'module-07', 'module-08', 'module-09']
      },
      {
        topicId: 'advanced-track',
        displayName: 'Advanced Quantum Mastery: FTQC, Surface Codes, VQE & Algorithms',
        description: 'Advanced graduate-level pathway covering density matrices, Lindblad noise, Grover search, VQE chemistry, QFT phase estimation, and fault-tolerant surface codes.',
        keywords: [
          'advanced', 'advanced roadmap', 'advanced track', 'nisq', 'vqe chemistry', 'master equation',
          'entanglement', 'teleportation', 'grover', 'expert', 'graduate', 'ftqc', 'learn from advanced',
          'i wanna learn from advanced', 'wanna learn from advanced', 'from advanced'
        ],
        moduleIds: ['module-03', 'module-05', 'module-07', 'module-08', 'module-09', 'module-10', 'module-11', 'module-12', 'module-13', 'module-14']
      },
      {
        topicId: 'full-curriculum',
        displayName: 'Full Master Learning Roadmap: Complete 18-Module Quantum Mastery',
        description: 'Comprehensive end-to-end curriculum from Hilbert space foundations to VQE molecular algorithms, surface code error correction, QML, and quantum internet repeaters.',
        keywords: [
          'full', 'complete', 'all modules', 'master', 'everything', 'entire', '18 modules', '10 modules', 'full roadmap',
          'full curriculum', 'full learning roadmap', 'complete roadmap', 'all topics', 'all'
        ],
        moduleIds: [
          'module-01', 'module-02', 'module-03', 'module-04', 'module-05', 'module-06',
          'module-07', 'module-08', 'module-09', 'module-10', 'module-11', 'module-12',
          'module-13', 'module-14', 'module-15', 'module-16', 'module-17', 'module-18'
        ]
      },
      {
        topicId: 'circuits-basics',
        displayName: 'Quantum Circuits & Gate Fundamentals',
        description: 'Complete zero-to-hero onboarding to quantum gates, state vectors, and building your first quantum circuit.',
        keywords: [
          'circuit', 'circuits', 'make quantum circuits', '0 prior knowledge', 'zero prior knowledge',
          'learn circuits', 'build circuit', 'how to make', 'gate', 'gates', 'hadamard', 'cnot', 'quantum logic', 'unitary'
        ],
        moduleIds: ['module-01', 'module-02', 'module-06']
      },
      {
        topicId: 'entanglement-bell',
        displayName: 'Quantum Entanglement & Bell Pairs',
        description: 'Master non-local correlation, Einstein-Podolsky-Rosen paradox, and creating entangled qubit registers.',
        keywords: [
          'entangle', 'entanglement', 'bell', 'bell state', 'bell states', 'bell pair', 'epr',
          'spooky', 'superdense', 'correlated', 'chsh'
        ],
        moduleIds: ['module-01', 'module-02', 'module-07', 'module-18']
      },
      {
        topicId: 'teleportation',
        displayName: 'Quantum Teleportation & Quantum Networks',
        description: 'Understand how quantum information is transmitted across distant nodes using shared entanglement and repeaters.',
        keywords: [
          'teleport', 'teleportation', 'quantum teleportation', 'transfer state', 'quantum network',
          'quantum internet', 'channel', 'repeater', 'swapping'
        ],
        moduleIds: ['module-01', 'module-02', 'module-07', 'module-08', 'module-18']
      },
      {
        topicId: 'grover-search',
        displayName: 'Grover Search & Amplitude Amplification',
        description: 'Learn how quantum oracles and diffusion operators achieve quadratic speedup over classical search.',
        keywords: [
          'grover', 'grover search', 'search algorithm', 'amplitude amplification', 'oracle',
          'diffusion', 'unstructured search', 'database search'
        ],
        moduleIds: ['module-01', 'module-02', 'module-07', 'module-09']
      },
      {
        topicId: 'vqe-chemistry',
        displayName: 'VQE & Quantum Molecular Chemistry',
        description: 'Explore variational algorithms, parameterized ansatz circuits, and estimating molecular ground state energies.',
        keywords: [
          'vqe', 'chemistry', 'molecule', 'molecular', 'variational', 'eigensolver',
          'hydrogen', 'ground state', 'hamiltonian', 'parameter shift', 'nisq'
        ],
        moduleIds: ['module-01', 'module-02', 'module-04', 'module-10']
      },
      {
        topicId: 'qft-phase',
        displayName: 'QFT & Quantum Phase Estimation',
        description: 'Master exponential Fourier speedup, modular exponentiation, and the mathematical engine behind Shor’s algorithm.',
        keywords: ['qft', 'fourier', 'phase estimation', 'qpe', 'shor', 'period finding', 'eigenvalue'],
        moduleIds: ['module-01', 'module-02', 'module-06', 'module-11']
      },
      {
        topicId: 'error-correction',
        displayName: 'Surface Codes & Fault-Tolerant Quantum Computing',
        description: 'Study 2D topological stabilizer codes, syndrome extraction, and fault-tolerant logical qubit operations.',
        keywords: ['error correction', 'surface code', 'ftqc', 'fault tolerant', 'stabilizer', 'syndrome', 'logical qubit', 'decoder', 'mwpm'],
        moduleIds: ['module-02', 'module-05', 'module-07', 'module-12']
      },
      {
        topicId: 'qaoa-optimization',
        displayName: 'QAOA & Combinatorial Optimization',
        description: 'Solve NP-hard combinatorial graph problems with alternating problem cost and driver Hamiltonians.',
        keywords: ['qaoa', 'optimization', 'maxcut', 'combinatorial', 'graph', 'tsp', 'portfolio'],
        moduleIds: ['module-01', 'module-02', 'module-10', 'module-13']
      },
      {
        topicId: 'qml-machine-learning',
        displayName: 'Quantum Machine Learning & Feature Maps',
        description: 'Evaluate quantum kernels in exponentially large Hilbert spaces and train variational classifiers.',
        keywords: ['qml', 'machine learning', 'kernel', 'quantum kernel', 'vqc', 'classifier', 'svm', 'feature map', 'quantum ai'],
        moduleIds: ['module-01', 'module-02', 'module-07', 'module-14']
      },
      {
        topicId: 'pulse-control',
        displayName: 'Microwave Pulse Control & DRAG Optimization',
        description: 'Model continuous Hamiltonian drives, calibrate sub-nanosecond Gaussian envelopes, and cancel phase leakage.',
        keywords: ['pulse', 'microwave', 'drag', 'control', 'envelope', 'anharmonicity', 'grape', 'optimal control'],
        moduleIds: ['module-02', 'module-05', 'module-15']
      },
      {
        topicId: 'pqc-security',
        displayName: 'Post-Quantum Cryptography & Threat Modeling',
        description: 'Quantify RSA/ECC vulnerability timelines, evaluate lattice hardness, and prepare for NIST standards.',
        keywords: ['pqc', 'post quantum', 'cryptography', 'security', 'lattice', 'ml-kem', 'ml-dsa', 'kyber', 'dilithium', 'rsa', 'threat'],
        moduleIds: ['module-09', 'module-11', 'module-16']
      },
      {
        topicId: 'cryo-hardware',
        displayName: 'Cryogenic Hardware & Superconducting Qubits',
        description: 'Thermodynamics of dilution refrigerators, transmon Josephson junctions, and millikelvin RF lines.',
        keywords: ['cryo', 'dilution refrigerator', 'hardware', 'transmon', 'superconducting', 'josephson', 'milli-kelvin', 'kelvin', 'cooling'],
        moduleIds: ['module-05', 'module-15', 'module-17']
      }
    ];

    this.initDOM();
  }

  loadTopicById(topicId) {
    this.initDOM();
    const pattern = this.topicPatterns.find(p => p.topicId === topicId);
    if (pattern) {
      const matchedModules = pattern.moduleIds.map(id => this.modules.find(m => m.id === id)).filter(Boolean);
      let detectedLevel = 'BEGINNER';
      if (topicId === 'advanced-track') detectedLevel = 'ADVANCED';
      else if (topicId === 'intermediate-track') detectedLevel = 'INTERMEDIATE';
      else if (topicId === 'full-curriculum') detectedLevel = 'MASTER';

      if (typeof setStatusBadge === 'function') {
        setStatusBadge('roadmap-status-badge', false); // "Local Fallback"
      }
      const matchResult = {
        pattern,
        modules: matchedModules,
        detectedLevel,
        levelRationale: pattern.description,
        score: 100
      };
      const inputEl = document.getElementById('topic-user-query');
      if (inputEl) inputEl.value = pattern.displayName;
      this.closeModuleReader();
      const resultsContainer = document.getElementById('topic-roadmap-results');
      if (resultsContainer) {
        resultsContainer.style.display = 'block';
        this.renderRoadmapDiagram(matchResult, pattern.displayName);
        setTimeout(() => {
          resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 60);
      }
    }
  }

  initDOM() {
    if (!this.container && typeof document !== 'undefined') {
      this.container = document.getElementById('view-topic-roadmap');
    }
    if (!this.container) return;
    if (!this.container.innerHTML || this.container.innerHTML.trim() === '') {
      this.renderLandingView();
    }
  }

  // Dedicated Roadmap Landing Page with 3 Options + Mic
  renderLandingView() {
    this.container.innerHTML = `
      <div class="topic-roadmap-container">

        <!-- Hero Header with Mic Button -->
        <div class="topic-entry-hero">
          <div class="topic-sparkle-halo"></div>

          <div class="rmp-hero-row">
            <div class="rmp-hero-text">
              <div class="topic-pill-badge">
                <span class="topic-badge-dot"></span>
                <span>Quantum Learning Roadmap Studio</span>
                <span id="roadmap-status-badge" class="ai-status-badge fallback">○ Local Fallback</span>
              </div>

              <h1 class="topic-entry-heading">
                Your Personalized<br />
                <span class="heading-gradient">Quantum Learning Path</span>
              </h1>

              <p class="topic-entry-subtext">
                Choose a curated track, speak via the mic, or type any quantum concept — our adaptive engine
                will assemble an ordered prerequisite pathway with interactive flowcharts and complete step breakdowns.
              </p>
            </div>

            <!-- Floating Mic Button -->
            <button class="rmp-mic-btn" id="rmp-mic-btn"
              onclick="window.topicRoadmapManager._startRoadmapVoiceSearch()"
              title="Speak a topic to generate a roadmap">
              <span class="rmp-mic-icon">🎙️</span>
              <span class="rmp-mic-ring"></span>
            </button>
          </div>

          <!-- Voice status label with finish and cancel actions -->
          <div class="rmp-voice-status" id="rmp-voice-status" style="display:none;">
            <span class="rmp-voice-dot"></span>
            <span id="rmp-voice-label">Listening... speak your topic or background</span>
            <div class="rmp-voice-actions">
              <button class="btn-voice-finish" type="button" onclick="window.topicRoadmapManager._finishVoiceAndGenerate()">⚡ Generate Now</button>
              <button class="btn-voice-cancel" type="button" onclick="window.topicRoadmapManager._stopRoadmapVoiceSearch()">✕</button>
            </div>
          </div>
        </div>

        <!-- 3 Primary Roadmap Option Cards -->
        <div class="rmp-options-grid">

          <!-- Basic Roadmap -->
          <div class="rmp-option-card rmp-card-beginner" onclick="window.topicRoadmapManager.loadTopicById('beginner-track')">
            <div class="rmp-card-glow rmp-glow-beginner"></div>
            <div class="rmp-card-icon">🌱</div>
            <div class="rmp-card-content">
              <span class="rmp-card-badge rmp-badge-beginner">BEGINNER TRACK</span>
              <h3 class="rmp-card-title">Basic Roadmap</h3>
              <p class="rmp-card-desc">
                Zero-to-hero foundations: Hilbert spaces, single-qubit gates,
                Pauli observables, and your first circuit synthesis.
              </p>
              <div class="rmp-card-meta">
                <span class="rmp-meta-modules">4 Modules</span>
                <span class="rmp-meta-time">~70 min</span>
              </div>
            </div>
            <div class="rmp-card-arrow">→</div>
          </div>

          <!-- Advanced Roadmap -->
          <div class="rmp-option-card rmp-card-advanced" onclick="window.topicRoadmapManager.loadTopicById('advanced-track')">
            <div class="rmp-card-glow rmp-glow-advanced"></div>
            <div class="rmp-card-icon">🚀</div>
            <div class="rmp-card-content">
              <span class="rmp-card-badge rmp-badge-advanced">ADVANCED TRACK</span>
              <h3 class="rmp-card-title">Advanced Roadmap</h3>
              <p class="rmp-card-desc">
                Density matrices, Lindblad decoherence, Bell entanglement,
                Grover search, teleportation, and VQE molecular chemistry.
              </p>
              <div class="rmp-card-meta">
                <span class="rmp-meta-modules">6 Modules</span>
                <span class="rmp-meta-time">~180 min</span>
              </div>
            </div>
            <div class="rmp-card-arrow">→</div>
          </div>

          <!-- Custom Roadmap -->
          <div class="rmp-option-card rmp-card-custom" onclick="document.getElementById('topic-user-query').focus()">
            <div class="rmp-card-glow rmp-glow-custom"></div>
            <div class="rmp-card-icon">🎯</div>
            <div class="rmp-card-content">
              <span class="rmp-card-badge rmp-badge-custom">GOOGLE AI STUDIO</span>
              <h3 class="rmp-card-title">Custom Roadmap</h3>
              <p class="rmp-card-desc">
                Type or speak any background (e.g. "I am already a beginner", "I wanna learn from advanced", "QML & FTQC") — synthesized dynamically via Gemini 2.5.
              </p>
              <div class="rmp-card-meta">
                <span class="rmp-meta-modules">AI-Synthesized</span>
                <span class="rmp-meta-time">Any background</span>
              </div>
            </div>
            <div class="rmp-card-arrow">→</div>
          </div>

        </div>

        <!-- Master Curriculum Full Strip -->
        <div class="rmp-full-strip" onclick="window.topicRoadmapManager.loadTopicById('full-curriculum')">
          <div class="rmp-strip-icon-box">🗺️</div>
          <div class="rmp-strip-details">
            <div class="rmp-strip-title-row">
              <span class="rmp-strip-title">Full Master Learning Roadmap</span>
              <span class="rmp-strip-badge">ALL 18 MODULES · ZERO TO FTQC & HARDWARE</span>
            </div>
            <p class="rmp-strip-desc">
              Hilbert space geometry, unitaries, density matrices, Pauli observables, Lindblad noise, OpenQASM, Bell entanglement, teleportation, Grover search, VQE chemistry, QFT phase estimation, Surface Codes, QAOA, QML, DRAG pulse control, Post-Quantum Cryptography, Cryogenics & Quantum Internet.
            </p>
          </div>
          <div class="rmp-strip-action">
            <span class="rmp-strip-cta">Explore All 18 Modules</span>
            <span class="rmp-strip-arrow">→</span>
          </div>
        </div>

        <!-- Search Bar (always visible) -->
        <div class="rmp-search-section">
          <form id="topic-roadmap-form" onsubmit="event.preventDefault(); window.topicRoadmapManager.handleSearch();">
            <div class="topic-input-wrapper">
              <span class="topic-search-icon">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </span>
              <input
                type="text"
                id="topic-user-query"
                class="topic-search-field"
                placeholder="e.g. I am already a beginner, I wanna learn from advanced, VQE chemistry, Surface codes..."
                autocomplete="off"
                spellcheck="false"
              />
              <button class="rmp-search-mic" id="rmp-inline-mic"
                type="button"
                onclick="event.stopPropagation(); window.topicRoadmapManager._startRoadmapVoiceSearch('inline')"
                title="Speak a topic or background">
                🎙️
              </button>
              <button type="submit" class="btn-topic-generate" id="btn-generate-roadmap">
                <span>Generate Roadmap</span>
                <span class="btn-arrow">→</span>
              </button>
            </div>
          </form>

          <!-- Quick topic chips -->
          <div class="topic-suggested-row">
            <span class="suggested-label">Quick topics:</span>
            <button class="topic-chip topic-chip-highlight" onclick="window.topicRoadmapManager.loadTopicById('full-curriculum')">🌟 All 18 Modules</button>
            <button class="topic-chip" onclick="window.topicRoadmapManager.setQueryAndSearch('I am already a beginner, give a roadmap according to it')">🌱 Beginner Track</button>
            <button class="topic-chip" onclick="window.topicRoadmapManager.setQueryAndSearch('I wanna learn from advanced quantum computing')">🚀 Advanced Track</button>
            <button class="topic-chip" onclick="window.topicRoadmapManager.setQueryAndSearch('Surface codes and fault-tolerant quantum computing')">Surface Codes</button>
            <button class="topic-chip" onclick="window.topicRoadmapManager.setQueryAndSearch('Quantum machine learning and kernel feature maps')">QML</button>
            <button class="topic-chip" onclick="window.topicRoadmapManager.setQueryAndSearch('Post-quantum cryptography and Shor threat analysis')">PQC Security</button>
            <button class="topic-chip" onclick="window.topicRoadmapManager.setQueryAndSearch('Cryogenic hardware and superconducting transmons')">Hardware</button>
            <button class="topic-chip" onclick="window.topicRoadmapManager.setQueryAndSearch('VQE molecular chemistry')">VQE Chemistry</button>
          </div>
        </div>

        <!-- Dynamic Results Stage (SVG Diagram + Module List render here) -->
        <div id="topic-roadmap-results" class="topic-results-stage" style="display: none;"></div>

        <!-- Dynamic Module Detail Split Stage -->
        <div id="topic-module-detail-stage" class="topic-module-split-stage" style="display: none;"></div>

      </div>
    `;

    // Auto-focus search if on desktop
    if (typeof document !== 'undefined') {
      const inputEl = document.getElementById('topic-user-query');
      if (inputEl && window.innerWidth > 768) {
        setTimeout(() => inputEl.focus(), 250);
      }
    }
  }

  setQueryAndSearch(query) {
    const inputEl = document.getElementById('topic-user-query');
    if (inputEl) {
      inputEl.value = query;
      this.handleSearch();
    }
  }

  // -------------------------------------------------------------------
  // Continuous Voice Search (Mic Button on Landing & Results)
  // -------------------------------------------------------------------

  _startRoadmapVoiceSearch(source = 'hero') {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please type your topic or question instead.');
      return;
    }

    // Toggle off if already listening
    if (this._roadmapRecognition) {
      this._stopRoadmapVoiceSearch();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;  // Keep listening continuously so user isn't prematurely cut off
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';
    this._roadmapRecognition = recognition;
    this._accumulatedTranscript = '';
    this._voiceSilenceTimer = null;
    this._isVoiceActive = true;

    this._setVoiceUIActive(true);
    this._updateVoiceStatusLabel('Listening... speak your topic, question, or background');

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) {
          this._accumulatedTranscript = (this._accumulatedTranscript + ' ' + res[0].transcript).trim();
        } else {
          interim += res[0].transcript;
        }
      }

      const fullText = (this._accumulatedTranscript + ' ' + interim).trim();
      if (!fullText) return;

      // Update both landing and results inputs live
      const heroInput = document.getElementById('topic-user-query');
      const resultsInput = document.getElementById('rmp-results-query-input');
      if (heroInput) heroInput.value = fullText;
      if (resultsInput) resultsInput.value = fullText;

      this._updateVoiceStatusLabel(`Heard: "${fullText}" (Click "Generate Now" or pause 3s)`);

      // Reset generous silence debounce timer (3200ms of true silence before committing)
      if (this._voiceSilenceTimer) clearTimeout(this._voiceSilenceTimer);
      this._voiceSilenceTimer = setTimeout(() => {
        const textToSubmit = (this._accumulatedTranscript + ' ' + interim).trim();
        if (textToSubmit) {
          this._stopRoadmapVoiceSearch();
          this.generateRoadmap(textToSubmit);
        }
      }, 3200);
    };

    recognition.onerror = (event) => {
      console.warn('[TopicRoadmap] Voice recognition error:', event.error);
      if (event.error !== 'no-speech') {
        this._updateVoiceStatusLabel(`Mic notice: ${event.error}. You can type or click retry.`);
        setTimeout(() => this._stopRoadmapVoiceSearch(), 2500);
      }
    };

    recognition.onend = () => {
      // If recognition ended while voice was active
      if (this._isVoiceActive && this._accumulatedTranscript.trim()) {
        const text = this._accumulatedTranscript.trim();
        this._stopRoadmapVoiceSearch();
        this.generateRoadmap(text);
      } else if (this._isVoiceActive) {
        this._stopRoadmapVoiceSearch();
      }
    };

    try {
      recognition.start();
    } catch (e) {
      console.warn('[TopicRoadmap] Failed to start voice recognition:', e);
      this._stopRoadmapVoiceSearch();
    }
  }

  _finishVoiceAndGenerate() {
    if (this._voiceSilenceTimer) clearTimeout(this._voiceSilenceTimer);
    const heroInput = document.getElementById('topic-user-query');
    const resultsInput = document.getElementById('rmp-results-query-input');
    const query = (this._accumulatedTranscript || (resultsInput?.value) || (heroInput?.value) || '').trim();
    this._stopRoadmapVoiceSearch();
    if (query) {
      this.generateRoadmap(query);
    }
  }

  _stopRoadmapVoiceSearch() {
    if (this._voiceSilenceTimer) {
      clearTimeout(this._voiceSilenceTimer);
      this._voiceSilenceTimer = null;
    }
    if (this._roadmapRecognition) {
      try { this._roadmapRecognition.abort(); } catch (e) {}
      this._roadmapRecognition = null;
    }
    this._setVoiceUIActive(false);
  }

  _setVoiceUIActive(isActive) {
    this._isVoiceActive = isActive;
    const heroMic = document.getElementById('rmp-mic-btn');
    const inlineMic = document.getElementById('rmp-inline-mic');
    const resultsMic = document.getElementById('rmp-results-mic-btn');
    const heroStatus = document.getElementById('rmp-voice-status');
    const resultsStatus = document.getElementById('rmp-results-voice-status');

    [heroMic, inlineMic, resultsMic].forEach(btn => {
      if (btn) {
        if (isActive) btn.classList.add('rmp-mic-active');
        else btn.classList.remove('rmp-mic-active');
      }
    });

    [heroStatus, resultsStatus].forEach(bar => {
      if (bar) {
        if (isActive) bar.style.display = 'flex';
        else setTimeout(() => { if (!this._isVoiceActive) bar.style.display = 'none'; }, 800);
      }
    });
  }

  _updateVoiceStatusLabel(text) {
    const heroLabel = document.getElementById('rmp-voice-label');
    const resultsLabel = document.getElementById('rmp-results-voice-label');
    if (heroLabel) heroLabel.textContent = text;
    if (resultsLabel) resultsLabel.textContent = text;
  }

  handleSearch() {
    const inputEl = document.getElementById('topic-user-query');
    if (!inputEl) return;
    const query = inputEl.value.trim();
    if (!query) return;
    this.generateRoadmap(query);
  }

  handleResultsSearch() {
    const inputEl = document.getElementById('rmp-results-query-input');
    if (!inputEl) return;
    const query = inputEl.value.trim();
    if (!query) return;
    this.generateRoadmap(query);
  }

  // Unified Roadmap Generation Orchestrator (Google AI Studio + Local Adaptive Engine)
  async generateRoadmap(query) {
    const trimmed = (query || '').trim();
    if (!trimmed) return;

    // Synchronize both search inputs
    const heroInput = document.getElementById('topic-user-query');
    const resultsInput = document.getElementById('rmp-results-query-input');
    if (heroInput) heroInput.value = trimmed;
    if (resultsInput) resultsInput.value = trimmed;

    this.closeModuleReader();

    const resultsContainer = document.getElementById('topic-roadmap-results');
    if (!resultsContainer) return;
    resultsContainer.style.display = 'block';

    // Show dynamic AI loading card immediately
    this.renderAILoadingState(trimmed);
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Handle exact preset shortcuts
    const cleanLower = trimmed.toLowerCase();
    if (cleanLower === 'beginner' || cleanLower === 'beginner track' || cleanLower === 'basic roadmap') {
      this.loadTopicById('beginner-track');
      return;
    }
    if (cleanLower === 'advanced' || cleanLower === 'advanced track' || cleanLower === 'advanced roadmap') {
      this.loadTopicById('advanced-track');
      return;
    }
    if (cleanLower === 'intermediate' || cleanLower === 'intermediate track') {
      this.loadTopicById('intermediate-track');
      return;
    }
    if (cleanLower === 'full' || cleanLower === 'all' || cleanLower === 'full roadmap' || cleanLower === 'all 18 modules') {
      this.loadTopicById('full-curriculum');
      return;
    }

    // Try Google AI Studio Gemini 2.5 Flash
    let aiMatch = null;
    try {
      aiMatch = await this.generateCustomRoadmapAI(trimmed);
    } catch (err) {
      console.warn('[TopicRoadmap] Gemini synthesis notice, using local adaptive engine:', err);
    }

    if (aiMatch && aiMatch.modules && aiMatch.modules.length > 0) {
      this.renderRoadmapDiagram(aiMatch, trimmed);
    } else {
      // Local adaptive fallback matching across all 18 modules
      if (typeof setStatusBadge === 'function') {
        setStatusBadge('roadmap-status-badge', false); // "Local Fallback"
      }
      const localMatch = this.matchQueryToTopic(trimmed);
      if (localMatch) {
        this.renderRoadmapDiagram(localMatch, trimmed);
      } else {
        this.renderFallbackView(trimmed);
      }
    }

    setTimeout(() => {
      resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }

  // Dynamic Pathway Synthesis via Google AI Studio Gemini 2.5 Flash
  // Dynamic Pathway Synthesis via /api/gemini Backend (Section 4.2)
  async generateCustomRoadmapAI(userPrompt) {
    // The catalogue goes to the backend as material the model may reuse, not as
    // a list it must choose from — steps outside the curriculum are expected.
    const catalog = this.modules.map(m => ({
      id: m.id,
      docId: m.docId,
      title: m.title,
      level: m.level,
      timeEst: m.timeEst,
      summary: m.summary,
      category: m.category,
      mathFormula: m.mathFormula,
      intuition: m.intuition,
      researchPaper: m.researchPaper,
      circuitPreset: m.circuitPreset,
      exerciseGoal: m.exerciseGoal
    }));

    try {
      const base = (window.anantaBackend && window.anantaBackend.baseUrl) || '';
      const response = await fetch(`${base}/api/roadmap/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: userPrompt, catalog })
      });
      if (!response.ok) throw new Error(`Backend returned HTTP ${response.status}`);
      const parsed = await response.json();

      if (parsed.unavailable || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
        throw new Error(parsed.description || 'No roadmap steps returned');
      }

      // Generated steps are not in this.modules, so keep them somewhere the
      // module reader can still find them when a card is opened.
      this.generatedModules = parsed.steps;

      if (typeof setStatusBadge === 'function') {
        setStatusBadge('roadmap-status-badge', parsed.source === 'generated');
      }

      return {
        pattern: {
          displayName: parsed.displayName || 'Custom Quantum Roadmap',
          description: parsed.description || 'Personalised pathway.',
          modules: parsed.steps
        },
        modules: parsed.steps,
        detectedLevel: String(parsed.detectedLevel || 'Intermediate').toUpperCase(),
        levelRationale: parsed.levelRationale || '',
        score: 100,
        isAiSynthesized: parsed.source === 'generated',
        aiProvider: parsed.source === 'generated'
          ? 'Written for this request by the configured AI provider'
          : 'Matched against the built-in curriculum (no AI provider configured)'
      };
    } catch (err) {
      console.info('[TopicRoadmap] Backend unavailable, using local adaptive engine.', err);
      if (typeof setStatusBadge === 'function') {
        setStatusBadge('roadmap-status-badge', false); // "Local Fallback"
      }
      return null; // caller already falls back to matchQueryToTopic() — unchanged
    }
  }

  // Loading skeleton while Google AI Studio synthesizes the pathway
  renderAILoadingState(query) {
    const resultsContainer = document.getElementById('topic-roadmap-results');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = `
      <div class="rmp-ai-loading-card">
        <div class="rmp-ai-loading-orb">
          <div class="rmp-orb-core"></div>
          <div class="rmp-orb-ring rmp-ring-1"></div>
          <div class="rmp-orb-ring rmp-ring-2"></div>
        </div>
        <div class="rmp-ai-loading-content">
          <div class="rmp-ai-badge">
            <span class="rmp-ai-sparkle">✨</span>
            <span>GOOGLE AI STUDIO · GEMINI 2.5 FLASH</span>
          </div>
          <h3 class="rmp-loading-title">Synthesizing Personalized Quantum Roadmap</h3>
          <p class="rmp-loading-subtext">Analyzing query: <em>"${query.replace(/"/g, '&quot;')}"</em></p>
          <div class="rmp-loading-steps">
            <span class="rmp-step-active">⚡ Evaluating prerequisite dependencies across 18 quantum physics modules...</span>
            <span>📄 Cross-referencing landmark research papers (Nature, PRL, NIST)...</span>
          </div>
        </div>
      </div>
    `;
  }

  // Intelligent Knowledge & Topic Matching Engine (Robust 18-Module Local Engine)
  matchQueryToTopic(query) {
    const clean = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const queryWords = clean.split(/\s+/).filter(w => w.length > 0);

    // Check for full/complete/master requests
    const fullTrackPhrases = [
      'full', 'complete', 'all modules', 'master', 'whole', 'entire', '18 modules', 'all 18',
      'full roadmap', 'complete roadmap', 'everything', 'end to end', 'comprehensive',
      'all topics', 'curriculum', 'whole diagram', 'all 18 modules'
    ];
    if (fullTrackPhrases.some(p => clean.includes(p))) {
      return {
        pattern: {
          displayName: 'Full Master Learning Roadmap: Complete 18-Module Quantum Mastery',
          description: 'Comprehensive end-to-end curriculum from Hilbert space foundations to VQE molecular algorithms, surface code error correction, QML, and quantum internet repeaters.'
        },
        modules: this.modules,
        detectedLevel: 'MASTER',
        levelRationale: 'Assembled complete 18-module master progression covering foundational, intermediate, advanced, and hardware domains.',
        score: 100
      };
    }

    // 1. Detect User's Prior Knowledge Level
    const beginnerPhrases = [
      '0 prior', 'zero prior', 'no prior', '0 knowledge', 'zero knowledge', 'no knowledge',
      'no experience', 'from scratch', 'beginner', 'already a beginner', 'already beginner',
      'i am already a beginner', 'novice', 'new to', 'starter', 'basics', 'never studied',
      'high school', '101', 'start from zero', 'freshman', 'absolute beginner', '0 background',
      'zero background', 'no background', 'start from scratch'
    ];
    const intermediatePhrases = [
      'know basics', 'know basic', 'know linear algebra', 'know python', 'know coding',
      'know gates', 'know hadamard', 'know cnot', 'know superposition', 'know math',
      'intermediate', 'some knowledge', 'moderate', 'already know', 'familiar with',
      'have experience', 'developer', 'undergraduate', 'learned basics', 'know single qubit',
      'some prior', 'basic knowledge', 'basics known'
    ];
    const advancedPhrases = [
      'advanced', 'learn from advanced', 'learn advanced', 'expert', 'graduate', 'phd',
      'researcher', 'know statevector', 'know entanglement', 'know density matrix',
      'postgrad', 'mastery', 'know hamiltonian', 'know qft', 'know shor',
      'advanced background', 'know algorithms'
    ];

    let detectedLevel = 'BEGINNER';
    let levelRationale = 'Assembled full foundational scaffolding (Hilbert spaces to circuit synthesis)';

    if (advancedPhrases.some(p => clean.includes(p))) {
      detectedLevel = 'ADVANCED';
      levelRationale = 'Accelerated track skipping foundational math; focused on advanced quantum protocols, algorithms & hardware';
    } else if (intermediatePhrases.some(p => clean.includes(p))) {
      detectedLevel = 'INTERMEDIATE';
      levelRationale = 'Adapted for intermediate background (knows math/gates); accelerated past introductory 101 definitions';
    } else if (beginnerPhrases.some(p => clean.includes(p))) {
      detectedLevel = 'BEGINNER';
      levelRationale = 'Zero-to-hero onboarding starting from fundamental complex statevectors & Dirac notation';
    }

    // 2. Define Comprehensive Concept Domains across all 18 Modules
    const topicDomains = [
      {
        key: 'circuits',
        name: 'Quantum Circuits & Gate Fundamentals',
        keywords: ['circuit', 'circuits', 'gate', 'gates', 'hadamard', 'cnot', 'logic', 'unitary', 'composer', 'wire', 'qubit', 'qubits'],
        modulesByLevel: {
          BEGINNER: ['module-01', 'module-02', 'module-06'],
          INTERMEDIATE: ['module-02', 'module-04', 'module-06'],
          ADVANCED: ['module-06', 'module-07']
        },
        description: 'Complete hands-on pathway to building, simulating, and transpiling multi-qubit quantum circuits.'
      },
      {
        key: 'entanglement',
        name: 'Quantum Entanglement & Bell Pairs',
        keywords: ['entangle', 'entanglement', 'bell', 'bell state', 'bell states', 'epr', 'spooky', 'correlated', 'chsh'],
        modulesByLevel: {
          BEGINNER: ['module-01', 'module-02', 'module-07', 'module-18'],
          INTERMEDIATE: ['module-02', 'module-06', 'module-07', 'module-18'],
          ADVANCED: ['module-04', 'module-07', 'module-18']
        },
        description: 'Master non-local correlations, Einstein-Podolsky-Rosen paradox, and creating maximally entangled states.'
      },
      {
        key: 'teleportation',
        name: 'Quantum Teleportation & State Transfer Protocol',
        keywords: ['teleport', 'teleportation', 'transfer state', 'quantum internet', 'channel', 'state transfer'],
        modulesByLevel: {
          BEGINNER: ['module-01', 'module-02', 'module-07', 'module-08', 'module-18'],
          INTERMEDIATE: ['module-02', 'module-07', 'module-08', 'module-18'],
          ADVANCED: ['module-07', 'module-08', 'module-18']
        },
        description: 'Understand how quantum statevectors are transmitted across distant nodes using shared entanglement & classical bits.'
      },
      {
        key: 'grover',
        name: 'Grover Search & Amplitude Amplification',
        keywords: ['grover', 'search', 'oracle', 'diffusion', 'unstructured', 'amplitude amplification', 'database'],
        modulesByLevel: {
          BEGINNER: ['module-01', 'module-02', 'module-07', 'module-09'],
          INTERMEDIATE: ['module-02', 'module-07', 'module-09'],
          ADVANCED: ['module-07', 'module-09']
        },
        description: 'Learn how quantum phase oracles and diffusion operators achieve quadratic speedup over classical search.'
      },
      {
        key: 'vqe',
        name: 'VQE & Molecular Quantum Chemistry',
        keywords: ['vqe', 'chemistry', 'molecule', 'molecular', 'variational', 'eigensolver', 'hydrogen', 'hamiltonian', 'ground state', 'nisq', 'chemical'],
        modulesByLevel: {
          BEGINNER: ['module-01', 'module-02', 'module-04', 'module-10'],
          INTERMEDIATE: ['module-04', 'module-06', 'module-10'],
          ADVANCED: ['module-03', 'module-05', 'module-10']
        },
        description: 'Explore variational hybrid algorithms, parameterized ansatz circuits, and estimating molecular ground state energies.'
      },
      {
        key: 'noise',
        name: 'Decoherence, Noise Channels & Lindblad Physics',
        keywords: ['noise', 'decoherence', 'lindblad', 't1', 't2', 'relaxation', 'dephasing', 'open system', 'error', 'cryo', 'fidelity'],
        modulesByLevel: {
          BEGINNER: ['module-01', 'module-02', 'module-03', 'module-05'],
          INTERMEDIATE: ['module-03', 'module-04', 'module-05'],
          ADVANCED: ['module-03', 'module-05', 'module-15']
        },
        description: 'Study open quantum systems, energy relaxation (T1), dephasing (T2), and density matrix master equations.'
      },
      {
        key: 'density',
        name: 'Density Matrix Formalism & Statistical States',
        keywords: ['density', 'density matrix', 'mixed state', 'pure state', 'trace', 'entropy', 'von neumann', 'statistical'],
        modulesByLevel: {
          BEGINNER: ['module-01', 'module-02', 'module-03'],
          INTERMEDIATE: ['module-01', 'module-03', 'module-04'],
          ADVANCED: ['module-03', 'module-05']
        },
        description: 'Explore pure vs mixed quantum states, partial trace over entangled subsystems, and von Neumann entropy.'
      },
      {
        key: 'programming',
        name: 'Quantum Programming with Cirq & OpenQASM 3.0',
        keywords: ['program', 'programming', 'cirq', 'qasm', 'openqasm', 'python', 'code', 'transpile', 'compiler', 'sdk', 'software', 'assembly'],
        modulesByLevel: {
          BEGINNER: ['module-01', 'module-02', 'module-06'],
          INTERMEDIATE: ['module-02', 'module-06'],
          ADVANCED: ['module-06', 'module-07']
        },
        description: 'Hands-on cross-framework compilation between Google Cirq, Python SDKs, and OpenQASM hardware assembly.'
      },
      {
        key: 'observables',
        name: 'Pauli Observables & Expectation Values',
        keywords: ['pauli', 'observable', 'observables', 'expectation', 'measurement', 'measure', 'z axis', 'x axis', 'born'],
        modulesByLevel: {
          BEGINNER: ['module-01', 'module-02', 'module-04'],
          INTERMEDIATE: ['module-02', 'module-04'],
          ADVANCED: ['module-03', 'module-04']
        },
        description: 'Calculate expectation values from projective measurements, density matrices, and Bloch coordinate projections.'
      },
      {
        key: 'math',
        name: 'Hilbert Space & Complex Statevector Mathematics',
        keywords: ['hilbert', 'statevector', 'math', 'mathematics', 'dirac', 'bra', 'ket', 'complex', 'vector', 'linear algebra', 'amplitudes', 'superposition'],
        modulesByLevel: {
          BEGINNER: ['module-01', 'module-02', 'module-03'],
          INTERMEDIATE: ['module-01', 'module-03'],
          ADVANCED: ['module-01', 'module-03', 'module-05']
        },
        description: 'Formal mathematical specifications in complex Hilbert spaces, probability amplitudes, and unitary transformations.'
      },
      {
        key: 'algorithms',
        name: 'Quantum Algorithms & Asymptotic Speedups',
        keywords: ['algorithm', 'algorithms', 'speedup', 'advantage', 'complexity', 'polynomial', 'exponential', 'shor', 'simon', 'deutsch'],
        modulesByLevel: {
          BEGINNER: ['module-01', 'module-02', 'module-07', 'module-09', 'module-10'],
          INTERMEDIATE: ['module-02', 'module-06', 'module-07', 'module-09', 'module-11'],
          ADVANCED: ['module-07', 'module-09', 'module-10', 'module-11', 'module-13']
        },
        description: 'Understand how quantum parallelism, phase kickback, and constructive interference achieve computational advantage.'
      },
      {
        key: 'qft',
        name: 'QFT & Quantum Phase Estimation',
        keywords: ['qft', 'fourier', 'phase estimation', 'qpe', 'shor', 'period finding', 'eigenvalue'],
        modulesByLevel: {
          BEGINNER: ['module-01', 'module-02', 'module-06', 'module-11'],
          INTERMEDIATE: ['module-02', 'module-06', 'module-11'],
          ADVANCED: ['module-06', 'module-11', 'module-16']
        },
        description: 'Master exponential Fourier speedup, modular exponentiation, and the mathematical engine behind Shor’s algorithm.'
      },
      {
        key: 'surface_codes',
        name: 'Surface Codes & Fault-Tolerant Quantum Computing',
        keywords: ['surface code', 'surface codes', 'ftqc', 'fault tolerant', 'fault-tolerant', 'error correction', 'stabilizer', 'syndrome', 'logical qubit', 'decoder', 'mwpm'],
        modulesByLevel: {
          BEGINNER: ['module-02', 'module-05', 'module-07', 'module-12'],
          INTERMEDIATE: ['module-05', 'module-07', 'module-12'],
          ADVANCED: ['module-05', 'module-12', 'module-17']
        },
        description: 'Study 2D topological stabilizer codes, syndrome extraction, and fault-tolerant logical qubit operations.'
      },
      {
        key: 'qaoa',
        name: 'QAOA & Combinatorial Optimization',
        keywords: ['qaoa', 'optimization', 'maxcut', 'combinatorial', 'graph', 'tsp', 'portfolio'],
        modulesByLevel: {
          BEGINNER: ['module-01', 'module-02', 'module-10', 'module-13'],
          INTERMEDIATE: ['module-02', 'module-10', 'module-13'],
          ADVANCED: ['module-10', 'module-13']
        },
        description: 'Solve NP-hard combinatorial graph problems with alternating problem cost and driver Hamiltonians.'
      },
      {
        key: 'qml',
        name: 'Quantum Machine Learning & Feature Maps',
        keywords: ['qml', 'machine learning', 'kernel', 'quantum kernel', 'vqc', 'classifier', 'svm', 'feature map', 'quantum ai'],
        modulesByLevel: {
          BEGINNER: ['module-01', 'module-02', 'module-07', 'module-14'],
          INTERMEDIATE: ['module-02', 'module-07', 'module-14'],
          ADVANCED: ['module-07', 'module-10', 'module-14']
        },
        description: 'Evaluate quantum kernels in exponentially large Hilbert spaces and train variational classifiers.'
      },
      {
        key: 'pulse',
        name: 'Microwave Pulse Control & DRAG Optimization',
        keywords: ['pulse', 'microwave', 'drag', 'control', 'envelope', 'anharmonicity', 'grape', 'optimal control'],
        modulesByLevel: {
          BEGINNER: ['module-01', 'module-02', 'module-05', 'module-15'],
          INTERMEDIATE: ['module-02', 'module-05', 'module-15'],
          ADVANCED: ['module-05', 'module-15', 'module-17']
        },
        description: 'Model continuous Hamiltonian drives, calibrate sub-nanosecond Gaussian envelopes, and cancel phase leakage.'
      },
      {
        key: 'pqc',
        name: 'Post-Quantum Cryptography & Threat Modeling',
        keywords: ['pqc', 'post quantum', 'cryptography', 'security', 'lattice', 'ml-kem', 'ml-dsa', 'kyber', 'dilithium', 'rsa', 'threat'],
        modulesByLevel: {
          BEGINNER: ['module-01', 'module-09', 'module-11', 'module-16'],
          INTERMEDIATE: ['module-09', 'module-11', 'module-16'],
          ADVANCED: ['module-11', 'module-16']
        },
        description: 'Quantify RSA/ECC vulnerability timelines, evaluate lattice hardness, and prepare for NIST standards.'
      },
      {
        key: 'cryo',
        name: 'Cryogenic Hardware & Superconducting Qubits',
        keywords: ['cryo', 'dilution refrigerator', 'hardware', 'transmon', 'superconducting', 'josephson', 'milli-kelvin', 'kelvin', 'cooling'],
        modulesByLevel: {
          BEGINNER: ['module-01', 'module-05', 'module-15', 'module-17'],
          INTERMEDIATE: ['module-05', 'module-15', 'module-17'],
          ADVANCED: ['module-05', 'module-15', 'module-17']
        },
        description: 'Thermodynamics of dilution refrigerators, transmon Josephson junctions, and millikelvin RF lines.'
      },
      {
        key: 'internet',
        name: 'Quantum Internet & Entanglement Swapping',
        keywords: ['internet', 'quantum internet', 'repeater', 'swapping', 'network', 'quantum network', 'quantum repeater'],
        modulesByLevel: {
          BEGINNER: ['module-01', 'module-02', 'module-07', 'module-08', 'module-18'],
          INTERMEDIATE: ['module-02', 'module-07', 'module-08', 'module-18'],
          ADVANCED: ['module-07', 'module-08', 'module-18']
        },
        description: 'Architecture of long-distance quantum repeaters, BSM entanglement swapping, and quantum memory.'
      }
    ];

    // Score topics across domains
    let bestDomain = null;
    let bestDomainScore = 0;

    topicDomains.forEach(domain => {
      let score = 0;
      domain.keywords.forEach(kw => {
        if (clean.includes(kw)) {
          score += kw.length > 5 ? 25 : 12;
        }
        const kwParts = kw.split(/\s+/);
        kwParts.forEach(kp => {
          if (queryWords.includes(kp)) score += 6;
        });
      });
      if (score > bestDomainScore) {
        bestDomainScore = score;
        bestDomain = domain;
      }
    });

    // Handle pure level queries (e.g. "I am already a beginner, give a roadmap according to it", "I wanna learn from advanced")
    if (bestDomainScore < 10) {
      if (detectedLevel === 'BEGINNER') {
        return {
          pattern: {
            displayName: 'Adaptive Beginner Roadmap: Foundations & Quantum Gates',
            description: 'Customized for learners starting with zero prior background: master Hilbert space geometry, single-qubit rotations, Pauli observables, and compiling your first circuits.'
          },
          modules: ['module-01', 'module-02', 'module-04', 'module-06'].map(id => this.modules.find(m => m.id === id)),
          detectedLevel,
          levelRationale,
          score: 25
        };
      } else if (detectedLevel === 'ADVANCED') {
        return {
          pattern: {
            displayName: 'Adaptive Advanced Roadmap: Multi-Qubit NISQ & Algorithms',
            description: 'Customized for advanced learners: dives straight into density matrices, Lindblad noise, Bell entanglement, Grover search, and VQE chemistry.'
          },
          modules: ['module-03', 'module-05', 'module-07', 'module-08', 'module-09', 'module-10'].map(id => this.modules.find(m => m.id === id)),
          detectedLevel,
          levelRationale,
          score: 25
        };
      } else if (detectedLevel === 'INTERMEDIATE') {
        return {
          pattern: {
            displayName: 'Adaptive Intermediate Roadmap: Circuit Engineering & Entanglement',
            description: 'Customized for intermediate learners: bypasses basic definitions and explores Pauli observables, OpenQASM coding, and Bell pair creation.'
          },
          modules: ['module-02', 'module-04', 'module-06', 'module-07', 'module-08'].map(id => this.modules.find(m => m.id === id)),
          detectedLevel,
          levelRationale,
          score: 25
        };
      }
    }

    if (bestDomain && bestDomainScore >= 6) {
      const moduleIds = bestDomain.modulesByLevel[detectedLevel] || bestDomain.modulesByLevel['BEGINNER'];
      const matchedModules = moduleIds.map(id => this.modules.find(m => m.id === id)).filter(Boolean);

      return {
        pattern: {
          displayName: `${bestDomain.name} (${detectedLevel === 'BEGINNER' ? 'Beginner Scaffolded Track' : (detectedLevel === 'INTERMEDIATE' ? 'Intermediate Accelerated Track' : 'Advanced Direct Track')})`,
          description: bestDomain.description
        },
        modules: matchedModules,
        detectedLevel,
        levelRationale,
        score: bestDomainScore
      };
    }

    return null;
  }

  // Render Curated Ordered Module Sequence with Waterfall Staggered Animation
  renderCuratedRoadmap(matchResult, query) {
    const { pattern, modules, detectedLevel = 'BEGINNER', levelRationale = '' } = matchResult;
    this.currentCuratedModules = modules;
    const resultsContainer = document.getElementById('topic-roadmap-results');
    if (!resultsContainer) return;

    let cardsHtml = '';
    modules.forEach((mod, idx) => {
      const stepNum = idx + 1;
      const isPrereq = idx === 0 && modules.length > 1;
      const stepType = isPrereq ? 'Prerequisite Foundation' : (idx === modules.length - 1 ? 'Target Mastery Goal' : 'Core Concept');
      const hasLab = Boolean(mod.circuitPreset);

      cardsHtml += `
        <div class="waterfall-card-wrapper" style="--stagger-index: ${idx};">
          <div class="curated-module-card ${hasLab ? 'has-circuit-lab' : ''}" onclick="window.topicRoadmapManager.openModuleReader('${mod.id}')">
            
            <div class="curated-card-sidebar">
              <div class="curated-step-circle">${stepNum}</div>
              ${stepNum < modules.length ? '<div class="curated-timeline-stem"></div>' : ''}
            </div>

            <div class="curated-card-main">
              <div class="curated-card-header">
                <div class="curated-badge-group">
                  <span class="curated-step-tag">${stepType}</span>
                  <span class="curated-module-badge">${mod.number}</span>
                  <span class="curated-level-badge level-${mod.level.toLowerCase()}">${mod.level}</span>
                </div>
                <span class="curated-time-badge">${mod.timeEst}</span>
              </div>

              <h3 class="curated-card-title">${mod.title}</h3>
              <p class="curated-card-summary">${mod.summary}</p>

              <div class="curated-math-preview">
                <code>${mod.mathFormula}</code>
              </div>

              <div class="curated-card-footer">
                ${hasLab ? `
                  <div class="curated-lab-pill">
                    <span class="lab-pill-dot"></span>
                    <span>Interactive Circuit Lab Attached</span>
                  </div>
                ` : `
                  <div class="curated-theory-pill">
                    <span class="theory-pill-dot"></span>
                    <span>Theoretical Foundations</span>
                  </div>
                `}

                <button class="btn-open-curated-module">
                  <span>Start ${mod.number}</span>
                  <span class="open-arrow">→</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      `;
    });

    resultsContainer.innerHTML = `
      <div class="curated-results-header">
        <div class="curated-header-top">
          <span class="results-tag">ADAPTIVE PATHWAY ASSEMBLED</span>
          <span class="results-level-badge level-${detectedLevel.toLowerCase()}">${detectedLevel} TRACK</span>
          <span class="results-step-count">${modules.length} Ordered Steps to Mastery</span>
        </div>
        <h2 class="results-topic-title">${pattern.displayName}</h2>
        <p class="results-topic-desc">${pattern.description}</p>
        
        ${levelRationale ? `
          <div class="results-rationale-box">
            <span class="rationale-accent-bar"></span>
            <span class="rationale-text"><strong>Adaptive Reasoning:</strong> ${levelRationale}</span>
          </div>
        ` : ''}

        <div class="results-query-echo">
          <span class="echo-label">Matched Query:</span>
          <span class="echo-text">"${query}"</span>
        </div>
      </div>

      <div class="waterfall-module-list">
        ${cardsHtml}
      </div>

      <div class="curated-bottom-actions">
        <p>Want to explore the entire curriculum without topic filtering?</p>
        <button class="btn-view-full-roadmap" onclick="window.switchView('docs')">
          Browse Full Learning Roadmap (All 10 Modules) →
        </button>
      </div>
    `;
  }

  // Graceful Fallback Message when no direct keyword is found
  renderFallbackView(query) {
    const resultsContainer = document.getElementById('topic-roadmap-results');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = `
      <div class="topic-fallback-card">
        <div class="fallback-header-badge">NO DIRECT PATHWAY MATCH</div>
        <h2 class="fallback-title">Explore Related Quantum Learning Resources</h2>
        <p class="fallback-desc">
          We couldn't automatically map <em>"${query}"</em> to a single specialized pathway, but here are the fastest ways to continue your quantum journey:
        </p>

        <div class="fallback-options-grid">
          <!-- Option 1: Full Learning Roadmap -->
          <div class="fallback-action-card" onclick="window.switchView('docs')">
            <h4>Browse Full Learning Roadmap</h4>
            <p>Explore all 10 core modules in sequential order from Hilbert space to VQE algorithms.</p>
            <span class="action-card-link">Open Full Curriculum →</span>
          </div>

          <!-- Option 2: Ask Concept Doctor -->
          <div class="fallback-action-card" onclick="window.switchView('intuition')">
            <h4>Ask the AI Concept Doctor</h4>
            <p>Type your exact confusing topic to get physical analogies and real-time interactive simulations.</p>
            <span class="action-card-link">Launch Concept Doctor →</span>
          </div>

          <!-- Option 3: Global Knowledge Search -->
          <div class="fallback-action-card" onclick="window.focusKnowledgeEngineSearch()">
            <h4>Search Global Knowledge Base</h4>
            <p>Search across 80+ quantum computing topics, arXiv landmark papers, and 74 quantum algorithms.</p>
            <span class="action-card-link">Open Knowledge Search (/) →</span>
          </div>
        </div>

        <div class="fallback-quick-re-search">
          <span>Or explore popular tracks:</span>
          <div class="re-search-chips">
            <button class="topic-chip" onclick="window.topicRoadmapManager.loadTopicById('beginner-track')">Beginner Roadmap</button>
            <button class="topic-chip" onclick="window.topicRoadmapManager.loadTopicById('advanced-track')">Advanced Roadmap</button>
            <button class="topic-chip" onclick="window.topicRoadmapManager.setQueryAndSearch('quantum circuits for beginners')">Quantum Circuits</button>
            <button class="topic-chip" onclick="window.topicRoadmapManager.setQueryAndSearch('bell state entanglement')">Bell Entanglement</button>
            <button class="topic-chip" onclick="window.topicRoadmapManager.setQueryAndSearch('grover search algorithm')">Grover Search</button>
            <button class="topic-chip" onclick="window.topicRoadmapManager.setQueryAndSearch('vqe molecular chemistry')">VQE Chemistry</button>
          </div>
        </div>
      </div>
    `;
  }

  // Open specific module reader (with conditional side-by-side Circuit Designer)
  openModuleReader(moduleId) {
    // Generated steps live outside the authored curriculum, so look there too —
    // otherwise clicking a generated card would silently do nothing.
    const mod = this.modules.find(m => m.id === moduleId)
      || (this.generatedModules || []).find(m => m.id === moduleId);
    if (!mod) return;
    this.activeModule = mod;
    if (window.aiDoctorManager) window.aiDoctorManager.attach(mod);

    const detailStage = document.getElementById('topic-module-detail-stage');
    const resultsStage = document.getElementById('topic-roadmap-results');
    if (!detailStage) return;

    if (resultsStage) resultsStage.style.display = 'none';
    detailStage.style.display = 'block';

    const hasCircuitLab = Boolean(mod.circuitPreset);

    detailStage.innerHTML = `
      <div class="module-reader-wrapper ${hasCircuitLab ? 'reader-split-layout' : 'reader-full-layout'}">
        
        <!-- Top Navigation Bar -->
        <div class="module-reader-top-bar">
          <button class="btn-back-to-roadmap" onclick="window.topicRoadmapManager.backToCuratedRoadmap()">
            ← Back to Curated Roadmap
          </button>
          <div class="reader-meta-group">
            <span class="reader-module-num">${mod.number}</span>
            <span class="reader-module-cat">${mod.category}</span>
            <span class="reader-module-time">${mod.timeEst}</span>
          </div>
        </div>

        <!-- Split Content Area -->
        <div class="module-reader-body">
          
          <!-- Column 1: Educational Theory & Exercise Instructions -->
          <div class="reader-theory-column">
            <div class="theory-content-card">
              <div class="theory-header-box">
                <span class="theory-badge">${mod.level} Track</span>
                <h1 class="theory-title">${mod.title}</h1>
                <p class="theory-lead-summary">${mod.summary}</p>
              </div>

              <div class="theory-section">
                <div class="theory-section-tag">Mathematical Formulation</div>
                <div class="theory-math-block">
                  <code>${mod.mathFormula}</code>
                </div>
              </div>

              <div class="theory-section">
                <div class="theory-section-tag">Physical Intuition</div>
                <p class="theory-text">${mod.intuition}</p>
              </div>

              ${mod.researchPaper ? `
                <div class="theory-section theory-paper-box">
                  <div class="theory-section-tag">Landmark Research Publication & ArXiv Citation</div>
                  <div class="theory-paper-card">
                    <div class="theory-paper-top">
                      <span class="theory-paper-icon">📄</span>
                      <div class="theory-paper-heading">
                        <h4 class="theory-paper-title">${typeof mod.researchPaper === 'object' ? mod.researchPaper.title : mod.researchPaper}</h4>
                        ${typeof mod.researchPaper === 'object' && mod.researchPaper.journal ? `
                          <span class="theory-paper-journal">${mod.researchPaper.journal} (${mod.researchPaper.year})</span>
                        ` : ''}
                      </div>
                    </div>
                    ${typeof mod.researchPaper === 'object' && mod.researchPaper.authors ? `
                      <p class="theory-paper-authors"><strong>Authors:</strong> ${mod.researchPaper.authors}</p>
                    ` : ''}
                    ${typeof mod.researchPaper === 'object' && mod.researchPaper.doi ? `
                      <p class="theory-paper-doi"><strong>Citation / DOI:</strong> <code>${mod.researchPaper.doi}</code></p>
                    ` : ''}
                    ${typeof mod.researchPaper === 'object' && mod.researchPaper.keyInsight ? `
                      <div class="theory-paper-insight">
                        <strong>Breakthrough Contribution:</strong> ${mod.researchPaper.keyInsight}
                      </div>
                    ` : ''}
                  </div>
                </div>
              ` : ''}

              ${hasCircuitLab ? `
                <div class="theory-exercise-box">
                  <div class="exercise-header">
                    <span class="exercise-icon-dot"></span>
                    <h4>Hands-on Circuit Exercise</h4>
                  </div>
                  <p class="exercise-instructions">${mod.exerciseGoal}</p>
                  <div class="exercise-actions">
                    <button class="btn-load-exercise" onclick="window.topicRoadmapManager.loadExerciseIntoLab('${mod.circuitPreset}')">
                      Reset Circuit Exercise
                    </button>
                  </div>
                </div>
              ` : `
                <div class="theory-notice-box">
                  <span>This module establishes foundational theoretical principles. Interactive circuit synthesis is available in subsequent modules.</span>
                </div>
              `}

              <div class="theory-nav-footer">
                <button class="btn-view-doc-manual" onclick="window.switchView('docs'); window.scrollDocIntoView(null, '${mod.docId}')">
                  View Technical Manual Specification ↗
                </button>
              </div>
            </div>
          </div>

          <!-- Column 2: Side-by-Side Embedded Circuit Designer (Conditional) -->
          ${hasCircuitLab ? `
            <div class="reader-lab-column">
              <div class="split-lab-header">
                <div class="lab-title-group">
                  <span class="live-dot"></span>
                  <span class="lab-title">Live Quantum Circuit Composer</span>
                </div>
                <span class="lab-preset-label">Active: ${mod.circuitPreset.toUpperCase()} Exercise</span>
              </div>
              
              <!-- Dock Target for Circuit Designer Component -->
              <div id="topic-lab-dock-target" class="topic-lab-dock-target">
                <!-- Re-parented live from #view-simulator -->
              </div>
            </div>
          ` : ''}

        </div>

      </div>
    `;

    // If module has circuit lab, dock the existing Circuit Designer component
    if (hasCircuitLab) {
      this.dockCircuitDesigner(mod.circuitPreset);
    }

    // Scroll smoothly to top of reader
    detailStage.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Dock existing Circuit Designer without duplicating any component code
  dockCircuitDesigner(presetKey) {
    const dockTarget = document.getElementById('topic-lab-dock-target') || document.querySelector('.topic-lab-dock-target');
    const simCol = document.querySelector('#view-simulator .studio-two-col');
    if (!dockTarget || !simCol) return;

    // Move DOM node into dock target
    dockTarget.appendChild(simCol);
    this.isDockedInSplit = true;

    const stepperControls = simCol.querySelector('.stepper-controls-group');
    if (stepperControls && !document.getElementById('topic-lab-run-calc')) {
      const runButton = document.createElement('button');
      runButton.type = 'button';
      runButton.id = 'topic-lab-run-calc';
      runButton.className = 'topic-lab-run-btn';
      runButton.title = 'Run the circuit and check the exercise output with AI Doctor';
      runButton.textContent = 'Run Simulation ⚡';
      runButton.addEventListener('click', () => {
        if (window.circuitUI) window.circuitUI.runInteractiveSimulation();
      });
      stepperControls.appendChild(runButton);
    }

    // Load matching exercise preset
    if (presetKey && typeof window !== 'undefined') {
      if (window.loadPresetSafe) {
        window.loadPresetSafe(presetKey);
      } else if (window.circuitUI && window.circuitUI.loadPreset) {
        window.circuitUI.loadPreset(presetKey);
      }
    }
  }

  // Un-dock Circuit Designer back to #view-simulator
  undockCircuitDesigner() {
    if (!this.isDockedInSplit) return;
    const simContainer = document.querySelector('#view-simulator .studio-workspace-container') || document.getElementById('view-simulator');
    const simCol = document.querySelector('.reader-lab-column .studio-two-col') || document.querySelector('#topic-lab-dock-target .studio-two-col');
    
    if (simContainer && simCol) {
      const moduleRunButton = simCol.querySelector('#topic-lab-run-calc');
      if (moduleRunButton) moduleRunButton.remove();
      // Re-insert right before analytics deck or at original location
      const analyticsDeck = document.querySelector('#view-simulator .composer-analytics-deck') || document.querySelector('#view-simulator .studio-analytics-deck');
      if (analyticsDeck && analyticsDeck.parentNode === simContainer) {
        simContainer.insertBefore(simCol, analyticsDeck);
      } else {
        simContainer.appendChild(simCol);
      }
    }
    this.isDockedInSplit = false;
  }

  loadExerciseIntoLab(presetKey) {
    if (presetKey && typeof window !== 'undefined') {
      if (window.loadPresetSafe) {
        window.loadPresetSafe(presetKey);
      } else if (window.circuitUI && window.circuitUI.loadPreset) {
        window.circuitUI.loadPreset(presetKey);
      }
    }
  }

  backToCuratedRoadmap() {
    this.closeModuleReader();
    const resultsStage = document.getElementById('topic-roadmap-results');
    if (resultsStage) {
      resultsStage.style.display = 'block';
      resultsStage.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  closeModuleReader() {
    this.undockCircuitDesigner();
    const detailStage = document.getElementById('topic-module-detail-stage');
    if (detailStage) {
      detailStage.style.display = 'none';
      detailStage.innerHTML = '';
    }
    if (window.aiDoctorManager) window.aiDoctorManager.detach();
    this.activeModule = null;
  }

  // -------------------------------------------------------------------
  // Voice-Activated Roadmap Entry Point
  // Called by QuantumVoiceCopilot._executeRoadmapIntent()
  // -------------------------------------------------------------------

  /**
   * Populates the search input, runs the match engine, and renders the
   * visual flow-diagram view. Returns metadata for the voice copilot to
   * speak back.
   * @param {string} topicQuery - extracted topic string from voice
   * @returns {{ count: number, trackName: string }}
   */
  voiceActivatedRoadmap(topicQuery) {
    this.initDOM();

    // Populate search input
    const inputEl = document.getElementById('topic-user-query');
    if (inputEl) inputEl.value = topicQuery;

    // Close any open module reader
    this.closeModuleReader();

    // Run matcher
    const match = this.matchQueryToTopic(topicQuery);
    const resultsContainer = document.getElementById('topic-roadmap-results');
    if (!resultsContainer) {
      return { count: 0, trackName: topicQuery };
    }

    resultsContainer.style.display = 'block';

    if (match) {
      // Render DIAGRAM view (voice default)
      this.renderRoadmapDiagram(match, topicQuery);
      resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return { count: match.modules.length, trackName: match.pattern.displayName };
    } else {
      this.renderFallbackView(topicQuery);
      resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return { count: 0, trackName: topicQuery };
    }
  }

  backToLanding() {
    this.closeModuleReader();
    const resultsContainer = document.getElementById('topic-roadmap-results');
    if (resultsContainer) resultsContainer.style.display = 'none';
    const inputEl = document.getElementById('topic-user-query');
    if (inputEl) inputEl.value = '';
    const landingHero = document.querySelector('.topic-entry-hero');
    if (landingHero) {
      landingHero.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // -------------------------------------------------------------------
  // Toggle between Combined, Diagram, and Card views
  // -------------------------------------------------------------------
  toggleRoadmapView(mode) {
    const cardBtn = document.getElementById('rmv-btn-cards');
    const diagBtn = document.getElementById('rmv-btn-diagram');
    const combBtn = document.getElementById('rmv-btn-combined');
    const cardView = document.getElementById('rmv-card-view');
    const diagView = document.getElementById('rmv-diagram-view');

    if (!cardView || !diagView) return;

    if (cardBtn) cardBtn.classList.remove('rmv-toggle-active');
    if (diagBtn) diagBtn.classList.remove('rmv-toggle-active');
    if (combBtn) combBtn.classList.remove('rmv-toggle-active');

    if (mode === 'diagram') {
      cardView.style.display = 'none';
      diagView.style.display = 'block';
      if (diagBtn) diagBtn.classList.add('rmv-toggle-active');
    } else if (mode === 'cards') {
      diagView.style.display = 'none';
      cardView.style.display = 'block';
      if (cardBtn) cardBtn.classList.add('rmv-toggle-active');
    } else { // 'combined'
      diagView.style.display = 'block';
      cardView.style.display = 'block';
      if (combBtn) combBtn.classList.add('rmv-toggle-active');
    }
  }

  // -------------------------------------------------------------------
  // Visual Flow-Diagram & Complete Curriculum Renderer
  // -------------------------------------------------------------------

  /**
   * Renders both the visual SVG flow-diagram roadmap AND the complete
   * step-by-step module breakdown list with rich theory, formulas, and labs.
   */
  renderRoadmapDiagram(matchResult, query) {
    const { pattern, modules, detectedLevel = 'BEGINNER', levelRationale = '' } = matchResult;
    this.currentCuratedModules = modules;
    const resultsContainer = document.getElementById('topic-roadmap-results');
    if (!resultsContainer) return;

    // ── Level colors ──────────────────────────────────────────
    const levelColors = {
      Beginner:     { node: '#0d9488', glow: 'rgba(13,148,136,0.5)', badge: '#14b8a6', text: '#ccfbf1' },
      Intermediate: { node: '#7c3aed', glow: 'rgba(124,58,237,0.5)', badge: '#8b5cf6', text: '#ede9fe' },
      Advanced:     { node: '#ea580c', glow: 'rgba(234,88,12,0.5)',  badge: '#f97316', text: '#ffedd5' },
      Master:       { node: '#2563eb', glow: 'rgba(37,99,235,0.5)',  badge: '#3b82f6', text: '#dbeafe' },
    };

    // Calculate total duration
    const totalMins = modules.reduce((sum, m) => {
      const match = m.timeEst.match(/\d+/);
      return sum + (match ? parseInt(match[0], 10) : 20);
    }, 0);

    // ── Build comprehensive module cards (Listing Completely) ─
    let cardsHtml = '';
    modules.forEach((mod, idx) => {
      const stepNum = idx + 1;
      const isPrereq = idx === 0 && modules.length > 1;
      const isTarget = idx === modules.length - 1;
      const stepType = isPrereq ? 'Prerequisite Foundation' : (isTarget ? 'Target Mastery Goal' : 'Core Concept Progression');
      const hasLab = Boolean(mod.circuitPreset);

      cardsHtml += `
        <div class="waterfall-card-wrapper" style="--stagger-index: ${idx};">
          <div class="curated-module-card ${hasLab ? 'has-circuit-lab' : ''}" onclick="window.topicRoadmapManager.openModuleReader('${mod.id}')">
            <div class="curated-card-sidebar">
              <div class="curated-step-circle">${stepNum}</div>
              ${stepNum < modules.length ? '<div class="curated-timeline-stem"></div>' : ''}
            </div>
            <div class="curated-card-main">
              <div class="curated-card-header">
                <div class="curated-badge-group">
                  <span class="curated-step-tag">${stepType}</span>
                  <span class="curated-module-badge">${mod.number}</span>
                  <span class="curated-level-badge level-${mod.level.toLowerCase()}">${mod.level}</span>
                </div>
                <span class="curated-time-badge">⏱ ${mod.timeEst}</span>
              </div>

              <h3 class="curated-card-title">${mod.title}</h3>
              <p class="curated-card-summary">${mod.summary}</p>

              <div class="curated-math-preview">
                <div class="math-preview-label">MATHEMATICAL FORMULATION</div>
                <code>${mod.mathFormula}</code>
              </div>

              ${mod.intuition ? `
                <div class="curated-intuition-callout">
                  <span class="intuition-icon">💡</span>
                  <span class="intuition-text"><strong>Physical Intuition:</strong> ${mod.intuition}</span>
                </div>
              ` : ''}

              ${mod.researchPaper ? `
                <div class="curated-paper-badge">
                  <div class="paper-badge-top">
                    <span class="paper-badge-icon">📄</span>
                    <span class="paper-badge-tag">LANDMARK RESEARCH CITATION</span>
                    ${typeof mod.researchPaper === 'object' && mod.researchPaper.journal ? `
                      <span class="paper-badge-journal">${mod.researchPaper.journal} (${mod.researchPaper.year})</span>
                    ` : ''}
                  </div>
                  <div class="paper-badge-title">${typeof mod.researchPaper === 'object' ? mod.researchPaper.title : mod.researchPaper}</div>
                  ${typeof mod.researchPaper === 'object' && mod.researchPaper.authors ? `
                    <div class="paper-badge-meta">${mod.researchPaper.authors} · <code>${mod.researchPaper.doi || ''}</code></div>
                  ` : ''}
                  ${typeof mod.researchPaper === 'object' && mod.researchPaper.keyInsight ? `
                    <div class="paper-badge-insight"><strong>Key Contribution:</strong> ${mod.researchPaper.keyInsight}</div>
                  ` : ''}
                </div>
              ` : ''}

              <div class="curated-card-footer">
                ${hasLab ? `
                  <div class="curated-lab-pill">
                    <span class="lab-pill-dot"></span>
                    <span>Interactive Circuit Lab Attached</span>
                  </div>
                ` : `
                  <div class="curated-theory-pill">
                    <span class="theory-pill-dot"></span>
                    <span>Foundational Theory</span>
                  </div>
                `}

                <div class="curated-action-buttons">
                  ${hasLab ? `
                    <button class="btn-open-lab-direct" type="button"
                      onclick="event.stopPropagation(); window.topicRoadmapManager.openModuleReader('${mod.id}')">
                      ⚡ Open Lab
                    </button>
                  ` : ''}
                  <button class="btn-open-curated-module" type="button">
                    <span>Study Module</span>
                    <span class="open-arrow">→</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    });

    // ── Build SVG diagram ──────────────────────────────────────
    const svgDiagram = this._buildRoadmapSVG(modules, levelColors);

    // ── Assemble full HTML ─────────────────────────────────────
    resultsContainer.innerHTML = `
      <!-- Persistent Search & Voice Bar directly in Results View -->
      <div class="rmp-results-persistent-bar">
        <div class="rmp-results-search-wrapper">
          <span class="topic-search-icon">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </span>
          <input
            type="text"
            id="rmp-results-query-input"
            class="rmp-results-input"
            placeholder="Ask another question or topic (e.g. 'I am already a beginner', 'Learn from advanced', 'Surface codes')..."
            value="${(query || '').replace(/"/g, '&quot;')}"
            onkeydown="if(event.key==='Enter'){event.preventDefault(); window.topicRoadmapManager.handleResultsSearch();}"
          />
          <button class="rmp-results-mic-btn" id="rmp-results-mic-btn" type="button"
            onclick="window.topicRoadmapManager._startRoadmapVoiceSearch('results')"
            title="Speak a new roadmap query">
            <span class="rmp-mic-icon">🎙️</span>
          </button>
          <button class="btn-results-generate" type="button"
            onclick="window.topicRoadmapManager.handleResultsSearch()">
            <span>Generate</span>
            <span class="btn-arrow">→</span>
          </button>
        </div>

        <!-- Voice status banner in results view -->
        <div class="rmp-voice-status" id="rmp-results-voice-status" style="display:none;">
          <span class="rmp-voice-dot"></span>
          <span id="rmp-results-voice-label">Listening... speak your question or background</span>
          <div class="rmp-voice-actions">
            <button class="btn-voice-finish" type="button" onclick="window.topicRoadmapManager._finishVoiceAndGenerate()">⚡ Generate Now</button>
            <button class="btn-voice-cancel" type="button" onclick="window.topicRoadmapManager._stopRoadmapVoiceSearch()">✕</button>
          </div>
        </div>

        <!-- Quick Switch Chips in Results View -->
        <div class="rmp-results-quick-chips">
          <span class="rmp-chips-label">Switch Track:</span>
          <button class="topic-chip ${detectedLevel === 'BEGINNER' ? 'topic-chip-active' : ''}"
            onclick="window.topicRoadmapManager.loadTopicById('beginner-track')">🌱 Beginner (4 Modules)</button>
          <button class="topic-chip ${detectedLevel === 'INTERMEDIATE' ? 'topic-chip-active' : ''}"
            onclick="window.topicRoadmapManager.loadTopicById('intermediate-track')">⚡ Intermediate (5 Modules)</button>
          <button class="topic-chip ${detectedLevel === 'ADVANCED' ? 'topic-chip-active' : ''}"
            onclick="window.topicRoadmapManager.loadTopicById('advanced-track')">🚀 Advanced (6 Modules)</button>
          <button class="topic-chip topic-chip-highlight ${detectedLevel === 'MASTER' ? 'topic-chip-active' : ''}"
            onclick="window.topicRoadmapManager.loadTopicById('full-curriculum')">🗺️ Full 18 Modules</button>
        </div>
      </div>

      <div class="curated-results-header">
        <div class="results-header-nav-row">
          <button class="btn-rmp-back-landing" type="button" onclick="window.topicRoadmapManager.backToLanding()">
            ← Back to Track Selection
          </button>
          <div class="results-badges-cluster">
            ${matchResult.isAiSynthesized ? `
              <span class="results-tag ai-tag">✨ GOOGLE AI STUDIO SYNTHESIS</span>
            ` : `
              <span class="results-tag">ADAPTIVE PATHWAY ASSEMBLED</span>
            `}
            <span class="results-level-badge level-${detectedLevel.toLowerCase()}">${detectedLevel} TRACK</span>
            <span class="results-step-count">${modules.length} Ordered Steps</span>
            <span class="results-time-count">⏱ ~${totalMins} min total</span>
          </div>
        </div>

        <h2 class="results-topic-title">${pattern.displayName}</h2>
        <p class="results-topic-desc">${pattern.description}</p>

        ${levelRationale ? `
          <div class="results-rationale-box">
            <span class="rationale-accent-bar"></span>
            <span class="rationale-text"><strong>Adaptive Reasoning:</strong> ${levelRationale}</span>
          </div>
        ` : ''}

        ${query && query !== pattern.displayName ? `
          <div class="results-query-echo">
            <span class="echo-label">Matched Query:</span>
            <span class="echo-text">"${query}"</span>
          </div>
        ` : ''}

        <!-- 3-Way View Switcher -->
        <div class="rmp-toggle-group" role="group" aria-label="Switch roadmap display view">
          <button id="rmv-btn-combined" class="rmv-toggle-btn rmv-toggle-active" type="button"
            onclick="window.topicRoadmapManager.toggleRoadmapView('combined')">
            ⚡ Combined (Diagram + Full List)
          </button>
          <button id="rmv-btn-diagram" class="rmv-toggle-btn" type="button"
            onclick="window.topicRoadmapManager.toggleRoadmapView('diagram')">
            🗺️ Flow Diagram
          </button>
          <button id="rmv-btn-cards" class="rmv-toggle-btn" type="button"
            onclick="window.topicRoadmapManager.toggleRoadmapView('cards')">
            📋 Detailed Module List (${modules.length})
          </button>
        </div>
      </div>

      <!-- Diagram View (Visible in combined & diagram modes) -->
      <div id="rmv-diagram-view" class="rmv-diagram-view">
        <div class="rmv-section-heading">
          <div class="rmv-heading-left">
            <span class="rmv-section-badge">INTERACTIVE ARCHITECTURE</span>
            <h3 class="rmv-section-title">Visual Quantum Prerequisite Pipeline</h3>
          </div>
          <span class="rmv-heading-hint">Click any node to open its lesson reader & circuit designer</span>
        </div>
        ${svgDiagram}
      </div>

      <!-- Card View (Visible in combined & cards modes) -->
      <div id="rmv-card-view" class="rmv-card-view">
        <div class="rmv-section-heading">
          <div class="rmv-heading-left">
            <span class="rmv-section-badge">COMPREHENSIVE SYLLABUS</span>
            <h3 class="rmv-section-title">Complete Ordered Module Breakdown</h3>
          </div>
          <span class="rmv-heading-hint">${modules.length} lessons in logical sequence</span>
        </div>
        <div class="waterfall-module-list">${cardsHtml}</div>
      </div>

      <div class="curated-bottom-actions">
        <p>Want to explore all 18 core modules in a single comprehensive syllabus?</p>
        <button class="btn-view-full-roadmap" type="button" onclick="window.topicRoadmapManager.loadTopicById('full-curriculum')">
          Browse Full Master Learning Roadmap (All 18 Modules) →
        </button>
      </div>
    `;

    // Trigger staggered node entry animations
    setTimeout(() => {
      const nodes = resultsContainer.querySelectorAll('.rdg-node');
      nodes.forEach((node, i) => {
        node.style.animationDelay = `${i * 100}ms`;
        node.classList.add('rdg-node-animate');
      });
    }, 60);
  }

  /**
   * Builds the SVG roadmap flow diagram.
   * Uses a true serpentine zigzag layout with responsive SVG viewBox.
   */
  _buildRoadmapSVG(modules, levelColors) {
    const COLS = 3;
    const NODE_W = 260;
    const NODE_H = 155;
    const COL_GAP = 70;
    const ROW_GAP = 90;
    const PAD = 40;

    const rows = Math.ceil(modules.length / COLS);
    const cols = Math.min(modules.length, COLS);
    const svgW = COLS * (NODE_W + COL_GAP) - COL_GAP + PAD * 2;
    const svgH = rows * (NODE_H + ROW_GAP) - ROW_GAP + PAD * 2;

    // Serpentine Zigzag:
    // Even rows (0, 2...) go Left -> Right (col 0, 1, 2)
    // Odd rows (1, 3...) go Right -> Left (col 2, 1, 0)
    const positions = modules.map((_, i) => {
      const row = Math.floor(i / COLS);
      const col = i % COLS;
      const actualCol = (row % 2 === 0) ? col : (COLS - 1 - col);
      return {
        x: PAD + actualCol * (NODE_W + COL_GAP),
        y: PAD + row * (NODE_H + ROW_GAP),
        row,
        col: actualCol
      };
    });

    // Arrow definitions with glowing markers
    let arrowDefs = `
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#818cf8"/>
        </marker>
        <linearGradient id="arrowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#6366f1" />
          <stop offset="100%" stop-color="#a855f7" />
        </linearGradient>
      </defs>
    `;

    let arrows = '';
    for (let i = 0; i < modules.length - 1; i++) {
      const from = positions[i];
      const to   = positions[i + 1];

      let pathD;
      if (from.row === to.row) {
        const isLeftToRight = (from.row % 2 === 0);
        const x1 = isLeftToRight ? from.x + NODE_W : from.x;
        const y1 = from.y + NODE_H / 2;
        const x2 = isLeftToRight ? to.x : to.x + NODE_W;
        const y2 = to.y + NODE_H / 2;
        const dir = isLeftToRight ? 1 : -1;
        const cx1 = x1 + dir * 32;
        const cx2 = x2 - dir * 32;
        pathD = `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;
      } else {
        const x1 = from.x + NODE_W / 2;
        const y1 = from.y + NODE_H;
        const x2 = to.x + NODE_W / 2;
        const y2 = to.y;
        const midY = (y1 + y2) / 2;
        pathD = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
      }

      arrows += `
        <path class="rdg-arrow" d="${pathD}"
          fill="none" stroke="url(#arrowGrad)" stroke-width="2.6"
          stroke-dasharray="7 5" marker-end="url(#arrowhead)" opacity="0.88"/>
      `;
    }

    let nodesSVG = '';
    modules.forEach((mod, i) => {
      const pos  = positions[i];
      const lc   = levelColors[mod.level] || levelColors['Beginner'];
      const step = i + 1;
      const isPrereq = i === 0 && modules.length > 1;
      const isTarget = i === modules.length - 1;
      const stepRole = isPrereq ? 'FOUNDATION' : (isTarget ? 'MASTERY' : 'PROGRESSION');

      nodesSVG += `
        <g class="rdg-node" data-module-id="${mod.id}"
          onclick="window.topicRoadmapManager.openModuleReader('${mod.id}')"
          style="cursor:pointer;"
          role="button" tabindex="0" aria-label="Open ${mod.number}: ${mod.title}">

          <!-- Glow backing -->
          <rect x="${pos.x - 4}" y="${pos.y - 4}"
            width="${NODE_W + 8}" height="${NODE_H + 8}"
            rx="18" fill="${lc.glow}" class="rdg-node-glow"/>

          <!-- Node body -->
          <rect x="${pos.x}" y="${pos.y}"
            width="${NODE_W}" height="${NODE_H}"
            rx="15"
            fill="#0b1021"
            stroke="${lc.node}"
            stroke-width="1.8"
            class="rdg-node-rect"/>

          <!-- Step Number Circle -->
          <circle cx="${pos.x + 22}" cy="${pos.y + 22}" r="12"
            fill="${lc.badge}" opacity="0.95"/>
          <text x="${pos.x + 22}" y="${pos.y + 26}"
            text-anchor="middle" font-size="11" font-weight="700"
            fill="#ffffff" font-family="Inter,sans-serif">${step}</text>

          <!-- Step Role Pill -->
          <rect x="${pos.x + 40}" y="${pos.y + 11}"
            width="${stepRole.length * 6 + 16}" height="22"
            rx="11" fill="${lc.badge}" opacity="0.18"/>
          <text x="${pos.x + 48 + stepRole.length * 3}" y="${pos.y + 25}"
            text-anchor="middle" font-size="9" font-weight="700"
            fill="${lc.text}" font-family="Inter,sans-serif" letter-spacing="0.5">${stepRole}</text>

          <!-- Module ID label -->
          <text x="${pos.x + NODE_W - 14}" y="${pos.y + 26}"
            text-anchor="end" font-size="10" fill="#64748b" font-family="Inter,sans-serif"
            font-weight="600">${mod.number}</text>

          <!-- Title -->
          ${this._svgWordWrap(mod.title, pos.x + 14, pos.y + 58, NODE_W - 28, 12, '#f8fafc')}

          <!-- Category / Summary snippet -->
          <text x="${pos.x + 14}" y="${pos.y + 98}"
            font-size="10" fill="#94a3b8" font-family="Inter,sans-serif">
            ${this._truncateSummary(mod.summary, 38)}
          </text>

          <!-- Divider line -->
          <line x1="${pos.x + 12}" y1="${pos.y + 114}" x2="${pos.x + NODE_W - 12}" y2="${pos.y + 114}"
            stroke="rgba(255,255,255,0.07)" stroke-width="1"/>

          <!-- Time Estimate -->
          <text x="${pos.x + 14}" y="${pos.y + 136}"
            font-size="10" fill="#64748b" font-family="Inter,sans-serif">⏱ ${mod.timeEst}</text>

          <!-- Circuit Lab Pill -->
          ${mod.circuitPreset ? `
            <rect x="${pos.x + NODE_W - 84}" y="${pos.y + 122}"
              width="72" height="20" rx="10"
              fill="rgba(16, 185, 129, 0.16)" stroke="#10b981" stroke-width="1"/>
            <text x="${pos.x + NODE_W - 48}" y="${pos.y + 136}"
              text-anchor="middle" font-size="9" font-weight="600" fill="#34d399"
              font-family="Inter,sans-serif">⚡ Live Lab</text>
          ` : `
            <text x="${pos.x + NODE_W - 14}" y="${pos.y + 136}"
              text-anchor="end" font-size="9.5" fill="#475569"
              font-family="Inter,sans-serif">Theoretical</text>
          `}
        </g>
      `;
    });

    return `
      <div class="rdg-scroll-wrapper">
        <svg class="rdg-svg"
          viewBox="0 0 ${svgW} ${svgH}"
          width="100%"
          style="max-width: ${svgW}px;"
          xmlns="http://www.w3.org/2000/svg"
          role="img" aria-label="Roadmap flow diagram">
          ${arrowDefs}
          ${arrows}
          ${nodesSVG}
        </svg>

        <div class="rdg-legend-bar">
          <span class="rdg-legend-item"><span class="rdg-legend-dot" style="background:#0d9488"></span> Beginner</span>
          <span class="rdg-legend-item"><span class="rdg-legend-dot" style="background:#7c3aed"></span> Intermediate</span>
          <span class="rdg-legend-item"><span class="rdg-legend-dot" style="background:#ea580c"></span> Advanced</span>
          <span class="rdg-legend-item"><span class="rdg-legend-dot" style="background:#10b981"></span> ⚡ Circuit Lab</span>
          <span class="rdg-legend-hint">👆 Click any node to open full lesson & interactive circuit composer</span>
        </div>
      </div>
    `;
  }

  _truncateSummary(text, maxLen) {
    if (!text) return '';
    return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
  }

  /**
   * SVG text word-wrap helper — splits title into max 2 lines.
   */
  _svgWordWrap(text, x, y, maxWidth, fontSize, fill) {
    const avgCharW = fontSize * 0.58;
    const maxChars = Math.floor(maxWidth / avgCharW);

    if (text.length <= maxChars) {
      return `<text x="${x}" y="${y}" font-size="${fontSize}" fill="${fill}"
        font-family="Inter,sans-serif" font-weight="600">${text}</text>`;
    }

    const mid = Math.floor(text.length / 2);
    let splitAt = text.lastIndexOf(' ', mid + 10);
    if (splitAt < 1) splitAt = text.indexOf(' ', mid);
    if (splitAt < 1) splitAt = maxChars;

    const line1 = text.slice(0, splitAt).trim();
    const line2 = text.slice(splitAt).trim();

    return `<text x="${x}" y="${y}" font-size="${fontSize}" fill="${fill}"
      font-family="Inter,sans-serif" font-weight="600">
      <tspan x="${x}" dy="0">${line1}</tspan>
      <tspan x="${x}" dy="${fontSize + 3}">${line2}</tspan>
    </text>`;
  }
}


if (typeof window !== 'undefined') {
  window.TopicRoadmapManager = TopicRoadmapManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TopicRoadmapManager };
}
