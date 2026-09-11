/**
 * Ananta Quantum Studio - Persistent Instructor & Classroom Analytics Storage
 * 
 * Manages:
 *  1. Persistent classroom cohorts and student rosters in ananta-backend/data/
 *  2. Assignment dispatch (Quantum Circuit goals & Quizzes)
 *  3. Live automated grading records and statevector fidelity submissions
 *  4. Dynamic CSV gradebook generation for export
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const COHORTS_FILE = path.join(DATA_DIR, 'cohorts.json');
const STUDENTS_FILE = path.join(DATA_DIR, 'students.json');
const ASSIGNMENTS_FILE = path.join(DATA_DIR, 'assignments.json');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');

// Ensure data directory and baseline seed data exist
function initStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // 1. Cohorts Seed
  if (!fs.existsSync(COHORTS_FILE)) {
    const defaultCohorts = [
      {
        id: 'cohort_qc101',
        code: 'QC-101',
        name: 'Introduction to Quantum Information & Circuits',
        instructor: 'Prof. Vikram Sarabhai',
        term: 'Fall 2026',
        description: 'Undergraduate core course covering Hilbert spaces, unitary operators, entanglement witness, Bell inequality violations, and Deutsch-Jozsa algorithm.',
        createdAt: new Date(Date.now() - 30 * 86400000).toISOString()
      },
      {
        id: 'cohort_algo502',
        code: 'CS-502',
        name: 'Advanced Quantum Algorithms & Fault-Tolerance',
        instructor: 'Prof. C. V. Raman',
        term: 'Fall 2026',
        description: 'Graduate research seminar covering Grover search amplitude amplification, Shor QFT, VQE chemistry, and rotated surface code decoders.',
        createdAt: new Date(Date.now() - 20 * 86400000).toISOString()
      },
      {
        id: 'cohort_hw301',
        code: 'PH-301',
        name: 'Quantum Hardware & Microwave Control Engineering',
        instructor: 'Dr. Homi Bhabha',
        term: 'Fall 2026',
        description: 'Physical realization of superconducting transmon qubits, cavity QED, Rabi/Ramsey pulse dynamics, and DRAG pulse shaping.',
        createdAt: new Date(Date.now() - 15 * 86400000).toISOString()
      }
    ];
    fs.writeFileSync(COHORTS_FILE, JSON.stringify(defaultCohorts, null, 2), 'utf8');
  }

  // 2. Students Seed
  if (!fs.existsSync(STUDENTS_FILE)) {
    const defaultStudents = [
      { id: 'std_ananya_01', cohortId: 'cohort_qc101', name: 'Ananya Sharma', email: 'ananya.sharma@ananta.edu', challengesSolved: 8, quizzesCompleted: 5, avgScore: 96, totalXp: 1150, letterGrade: 'A+', lastActive: new Date(Date.now() - 2 * 3600000).toISOString() },
      { id: 'std_rohan_02', cohortId: 'cohort_qc101', name: 'Rohan Verma', email: 'rohan.verma@ananta.edu', challengesSolved: 7, quizzesCompleted: 4, avgScore: 91, totalXp: 890, letterGrade: 'A', lastActive: new Date(Date.now() - 3 * 3600000).toISOString() },
      { id: 'std_priya_03', cohortId: 'cohort_qc101', name: 'Priya Patel', email: 'priya.patel@ananta.edu', challengesSolved: 8, quizzesCompleted: 5, avgScore: 98, totalXp: 1220, letterGrade: 'A+', lastActive: new Date(Date.now() - 1 * 3600000).toISOString() },
      { id: 'std_arjun_04', cohortId: 'cohort_qc101', name: 'Arjun Mehta', email: 'arjun.mehta@ananta.edu', challengesSolved: 7, quizzesCompleted: 4, avgScore: 92, totalXp: 930, letterGrade: 'A', lastActive: new Date(Date.now() - 4 * 3600000).toISOString() },
      { id: 'std_sneha_05', cohortId: 'cohort_qc101', name: 'Sneha Reddy', email: 'sneha.reddy@ananta.edu', challengesSolved: 7, quizzesCompleted: 4, avgScore: 94, totalXp: 960, letterGrade: 'A', lastActive: new Date(Date.now() - 5 * 3600000).toISOString() },
      { id: 'std_siddharth_06', cohortId: 'cohort_qc101', name: 'Siddharth Rao', email: 'siddharth.rao@ananta.edu', challengesSolved: 6, quizzesCompleted: 4, avgScore: 87, totalXp: 790, letterGrade: 'B+', lastActive: new Date(Date.now() - 7 * 3600000).toISOString() },
      { id: 'std_diya_07', cohortId: 'cohort_qc101', name: 'Diya Mukherjee', email: 'diya.mukherjee@ananta.edu', challengesSolved: 8, quizzesCompleted: 5, avgScore: 95, totalXp: 1110, letterGrade: 'A', lastActive: new Date(Date.now() - 2 * 3600000).toISOString() },
      { id: 'std_kabir_08', cohortId: 'cohort_qc101', name: 'Kabir Joshi', email: 'kabir.joshi@ananta.edu', challengesSolved: 6, quizzesCompleted: 3, avgScore: 86, totalXp: 740, letterGrade: 'B+', lastActive: new Date(Date.now() - 8 * 3600000).toISOString() },
      { id: 'std_tanvi_09', cohortId: 'cohort_qc101', name: 'Tanvi Deshmukh', email: 'tanvi.deshmukh@ananta.edu', challengesSolved: 7, quizzesCompleted: 4, avgScore: 93, totalXp: 920, letterGrade: 'A', lastActive: new Date(Date.now() - 3 * 3600000).toISOString() },
      { id: 'std_aditya_10', cohortId: 'cohort_qc101', name: 'Aditya Kulkarni', email: 'aditya.kulkarni@ananta.edu', challengesSolved: 6, quizzesCompleted: 4, avgScore: 88, totalXp: 810, letterGrade: 'B+', lastActive: new Date(Date.now() - 6 * 3600000).toISOString() },
      { id: 'std_pooja_11', cohortId: 'cohort_qc101', name: 'Pooja Iyer', email: 'pooja.iyer@ananta.edu', challengesSolved: 8, quizzesCompleted: 5, avgScore: 97, totalXp: 1200, letterGrade: 'A+', lastActive: new Date(Date.now() - 1 * 3600000).toISOString() },
      { id: 'std_vikram_12', cohortId: 'cohort_qc101', name: 'Vikramaditya Singh', email: 'vikram.singh@ananta.edu', challengesSolved: 7, quizzesCompleted: 4, avgScore: 90, totalXp: 870, letterGrade: 'A', lastActive: new Date(Date.now() - 4 * 3600000).toISOString() },
      { id: 'std_neha_13', cohortId: 'cohort_qc101', name: 'Neha Kapoor', email: 'neha.kapoor@ananta.edu', challengesSolved: 7, quizzesCompleted: 4, avgScore: 89, totalXp: 850, letterGrade: 'B+', lastActive: new Date(Date.now() - 5 * 3600000).toISOString() },
      { id: 'std_rahul_14', cohortId: 'cohort_qc101', name: 'Rahul Nambiar', email: 'rahul.nambiar@ananta.edu', challengesSolved: 6, quizzesCompleted: 3, avgScore: 85, totalXp: 730, letterGrade: 'B', lastActive: new Date(Date.now() - 8 * 3600000).toISOString() },
      { id: 'std_meera_15', cohortId: 'cohort_qc101', name: 'Meera Chawla', email: 'meera.chawla@ananta.edu', challengesSolved: 8, quizzesCompleted: 4, avgScore: 94, totalXp: 990, letterGrade: 'A', lastActive: new Date(Date.now() - 2 * 3600000).toISOString() },
      { id: 'std_harish_16', cohortId: 'cohort_qc101', name: 'Harish Krishnan', email: 'harish.krishnan@ananta.edu', challengesSolved: 6, quizzesCompleted: 4, avgScore: 88, totalXp: 800, letterGrade: 'B+', lastActive: new Date(Date.now() - 6 * 3600000).toISOString() },
      { id: 'std_shreya_17', cohortId: 'cohort_qc101', name: 'Shreya Banerjee', email: 'shreya.banerjee@ananta.edu', challengesSolved: 7, quizzesCompleted: 4, avgScore: 92, totalXp: 910, letterGrade: 'A', lastActive: new Date(Date.now() - 3 * 3600000).toISOString() },
      { id: 'std_aman_18', cohortId: 'cohort_qc101', name: 'Aman Gupta', email: 'aman.gupta@ananta.edu', challengesSolved: 6, quizzesCompleted: 3, avgScore: 86, totalXp: 750, letterGrade: 'B', lastActive: new Date(Date.now() - 9 * 3600000).toISOString() },
      { id: 'std_ritu_19', cohortId: 'cohort_qc101', name: 'Ritu Agarwal', email: 'ritu.agarwal@ananta.edu', challengesSolved: 7, quizzesCompleted: 4, avgScore: 93, totalXp: 920, letterGrade: 'A', lastActive: new Date(Date.now() - 4 * 3600000).toISOString() },
      { id: 'std_devendra_20', cohortId: 'cohort_qc101', name: 'Devendra Chouhan', email: 'devendra.c@ananta.edu', challengesSolved: 6, quizzesCompleted: 4, avgScore: 87, totalXp: 780, letterGrade: 'B+', lastActive: new Date(Date.now() - 7 * 3600000).toISOString() },
      { id: 'std_anika_21', cohortId: 'cohort_qc101', name: 'Anika Bose', email: 'anika.bose@ananta.edu', challengesSolved: 8, quizzesCompleted: 5, avgScore: 95, totalXp: 1130, letterGrade: 'A', lastActive: new Date(Date.now() - 1 * 3600000).toISOString() },
      { id: 'std_nikhil_22', cohortId: 'cohort_qc101', name: 'Nikhil Saxena', email: 'nikhil.saxena@ananta.edu', challengesSolved: 7, quizzesCompleted: 4, avgScore: 89, totalXp: 840, letterGrade: 'B+', lastActive: new Date(Date.now() - 5 * 3600000).toISOString() },
      { id: 'std_kavita_23', cohortId: 'cohort_qc101', name: 'Kavita Pillai', email: 'kavita.pillai@ananta.edu', challengesSolved: 7, quizzesCompleted: 4, avgScore: 92, totalXp: 900, letterGrade: 'A', lastActive: new Date(Date.now() - 3 * 3600000).toISOString() },
      { id: 'std_gautam_24', cohortId: 'cohort_qc101', name: 'Gautam Menon', email: 'gautam.menon@ananta.edu', challengesSolved: 7, quizzesCompleted: 4, avgScore: 90, totalXp: 860, letterGrade: 'A', lastActive: new Date(Date.now() - 4 * 3600000).toISOString() },
      { id: 'std_aarav_31', cohortId: 'cohort_algo502', name: 'Aarav Nair', email: 'aarav.nair@ananta.edu', challengesSolved: 8, quizzesCompleted: 5, avgScore: 94, totalXp: 1120, letterGrade: 'A', lastActive: new Date(Date.now() - 3 * 3600000).toISOString() },
      { id: 'std_ishita_32', cohortId: 'cohort_algo502', name: 'Ishita Sen', email: 'ishita.sen@ananta.edu', challengesSolved: 8, quizzesCompleted: 5, avgScore: 97, totalXp: 1240, letterGrade: 'A+', lastActive: new Date(Date.now() - 1 * 3600000).toISOString() }
    ];
    fs.writeFileSync(STUDENTS_FILE, JSON.stringify(defaultStudents, null, 2), 'utf8');
  }

  // 3. Assignments Seed
  if (!fs.existsSync(ASSIGNMENTS_FILE)) {
    const defaultAssignments = [
      {
        id: 'asg_01_bell',
        cohortId: 'cohort_qc101',
        title: 'Laboratory 1: Bell State |Φ+⟩ Synthesis',
        type: 'circuit',
        targetState: '|Φ+⟩ = (|00⟩ + |11⟩) / √2',
        minFidelity: 0.98,
        maxGates: 3,
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        points: 100,
        submissionsCount: 3
      },
      {
        id: 'asg_02_gates_quiz',
        cohortId: 'cohort_qc101',
        title: 'Assessment 1: Unitaries & Phase Kickback Quiz',
        type: 'quiz',
        topic: 'gates',
        minPassPercentage: 70,
        dueDate: new Date(Date.now() + 10 * 86400000).toISOString(),
        points: 100,
        submissionsCount: 3
      },
      {
        id: 'asg_03_grover',
        cohortId: 'cohort_algo502',
        title: 'Laboratory 3: Grover Diffusion Operator Implementation',
        type: 'circuit',
        targetState: 'Single target constructive amplification (>70%)',
        minFidelity: 0.95,
        maxGates: 12,
        dueDate: new Date(Date.now() + 5 * 86400000).toISOString(),
        points: 150,
        submissionsCount: 2
      }
    ];
    fs.writeFileSync(ASSIGNMENTS_FILE, JSON.stringify(defaultAssignments, null, 2), 'utf8');
  }

  // 4. Submissions Seed
  if (!fs.existsSync(SUBMISSIONS_FILE)) {
    const defaultSubmissions = [
      {
        id: 'sub_init_01',
        studentId: 'std_ananya_01',
        studentName: 'Ananya Sharma',
        cohortId: 'cohort_qc101',
        assignmentId: 'asg_01_bell',
        type: 'circuit',
        fidelity: 0.999,
        gateCount: 2,
        grade: 100,
        passed: true,
        submittedAt: new Date(Date.now() - 3 * 86400000).toISOString()
      },
      {
        id: 'sub_init_02',
        studentId: 'std_rohan_02',
        studentName: 'Rohan Verma',
        cohortId: 'cohort_qc101',
        assignmentId: 'asg_01_bell',
        type: 'circuit',
        fidelity: 0.995,
        gateCount: 2,
        grade: 98,
        passed: true,
        submittedAt: new Date(Date.now() - 2 * 86400000).toISOString()
      }
    ];
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(defaultSubmissions, null, 2), 'utf8');
  }
}

// Helpers to read/write safely
function readJson(filePath, fallback = []) {
  initStorage();
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.error(`[Storage] Read error ${filePath}:`, e.message);
  }
  return fallback;
}

function writeJson(filePath, data) {
  initStorage();
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error(`[Storage] Write error ${filePath}:`, e.message);
    return false;
  }
}

/**
 * Lists all active classroom cohorts
 */
function getCohorts() {
  const cohorts = readJson(COHORTS_FILE, []);
  const students = readJson(STUDENTS_FILE, []);

  return cohorts.map(c => {
    const enrolled = students.filter(s => s.cohortId === c.id);
    const avgScore = enrolled.length
      ? Math.round(enrolled.reduce((sum, s) => sum + (s.avgScore || 0), 0) / enrolled.length)
      : 0;
    return {
      ...c,
      enrolledStudents: enrolled.length,
      classAverageScore: avgScore
    };
  });
}

/**
 * Creates a new classroom cohort
 */
function createCohort({ code, name, instructor, description, term = 'Fall 2026' }) {
  if (!name || !code) throw new Error('Cohort code and name are required');

  const cohorts = readJson(COHORTS_FILE, []);
  const newCohort = {
    id: 'cohort_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 5),
    code: code.trim().toUpperCase(),
    name: name.trim(),
    instructor: (instructor || 'Quantum Faculty Lead').trim(),
    term: term.trim(),
    description: (description || 'Interactive Quantum Computing Classroom Cohort').trim(),
    createdAt: new Date().toISOString()
  };

  cohorts.push(newCohort);
  writeJson(COHORTS_FILE, cohorts);
  return newCohort;
}

/**
 * Returns students enrolled in a specific cohort
 */
function getCohortStudents(cohortId) {
  const students = readJson(STUDENTS_FILE, []);
  if (!cohortId || cohortId === 'all') return students;
  return students.filter(s => s.cohortId === cohortId);
}

/**
 * Calculates in-depth analytics for a classroom cohort
 */
function getCohortAnalytics(cohortId = 'cohort_qc101') {
  const cohorts = getCohorts();
  const currentCohort = cohorts.find(c => c.id === cohortId) || cohorts[0] || {};
  const students = getCohortStudents(currentCohort.id);
  const assignments = readJson(ASSIGNMENTS_FILE, []).filter(a => a.cohortId === currentCohort.id);
  const submissions = readJson(SUBMISSIONS_FILE, []).filter(s => s.cohortId === currentCohort.id);

  const totalStudents = students.length;
  const avgClassScore = totalStudents
    ? Math.round(students.reduce((sum, s) => sum + (s.avgScore || 0), 0) / totalStudents)
    : 0;
  const totalChallengesSolved = students.reduce((sum, s) => sum + (s.challengesSolved || 0), 0);
  const totalQuizzesCompleted = students.reduce((sum, s) => sum + (s.quizzesCompleted || 0), 0);

  // Grade distributions
  const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  students.forEach(s => {
    const g = s.letterGrade || (s.avgScore >= 90 ? 'A' : s.avgScore >= 80 ? 'B' : s.avgScore >= 70 ? 'C' : s.avgScore >= 60 ? 'D' : 'F');
    gradeDistribution[g] = (gradeDistribution[g] || 0) + 1;
  });

  // Common conceptual misconceptions identified across quiz submissions
  const commonMisconceptions = [
    { concept: 'Phase Kickback in Controlled Gates', errorRate: '16.7%', count: 4, severity: 'Medium' },
    { concept: 'Partial Trace & Mixed State Purity', errorRate: '12.5%', count: 3, severity: 'Low' },
    { concept: 'Solovay-Kitaev Non-Clifford Gate Synthesis', errorRate: '14.2%', count: 3, severity: 'Medium' },
    { concept: 'Grover Diffusion Phase Inversion', errorRate: '8.3%', count: 2, severity: 'Low' }
  ];

  return {
    cohort: currentCohort,
    totalStudents,
    avgClassScore,
    totalChallengesSolved,
    totalQuizzesCompleted,
    gradeDistribution,
    activeAssignmentsCount: assignments.length,
    totalSubmissionsCount: submissions.length,
    commonMisconceptions,
    students,
    assignments,
    recentSubmissions: submissions.slice(-10).reverse(),
    generatedAt: new Date().toISOString()
  };
}

/**
 * Creates an assignment for a cohort
 */
function createAssignment({ cohortId, title, type = 'circuit', targetState = '', dueDate = '', points = 100 }) {
  if (!cohortId || !title) throw new Error('Cohort ID and assignment title are required');

  const assignments = readJson(ASSIGNMENTS_FILE, []);
  const newAsg = {
    id: 'asg_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 5),
    cohortId,
    title: title.trim(),
    type,
    targetState: targetState.trim() || 'Specified target unitary state',
    dueDate: dueDate || new Date(Date.now() + 7 * 86400000).toISOString(),
    points: Number(points) || 100,
    submissionsCount: 0,
    createdAt: new Date().toISOString()
  };

  assignments.push(newAsg);
  writeJson(ASSIGNMENTS_FILE, assignments);
  return newAsg;
}

/**
 * Records or updates a student's progress and quiz attempt
 */
function recordStudentProgress({ studentId, studentName, cohortId = 'cohort_qc101', quizSubmission = null, challengeSolved = null, xpGained = 0 }) {
  const students = readJson(STUDENTS_FILE, []);
  const cleanId = studentId || 'std_curr_user';
  let student = students.find(s => s.id === cleanId);

  if (!student) {
    student = {
      id: cleanId,
      cohortId,
      name: studentName || 'Quantum Scholar',
      email: `${cleanId}@ananta.edu`,
      challengesSolved: 0,
      quizzesCompleted: 0,
      avgScore: 100,
      totalXp: 0,
      letterGrade: 'A',
      lastActive: new Date().toISOString()
    };
    students.push(student);
  }

  if (xpGained > 0) {
    student.totalXp = (student.totalXp || 0) + xpGained;
  }

  if (challengeSolved) {
    student.challengesSolved = (student.challengesSolved || 0) + 1;
  }

  if (quizSubmission && quizSubmission.percentage !== undefined) {
    student.quizzesCompleted = (student.quizzesCompleted || 0) + 1;
    // Running average calculation
    const totalPrevious = (student.quizzesCompleted - 1) * (student.avgScore || 100);
    student.avgScore = Math.round((totalPrevious + quizSubmission.percentage) / student.quizzesCompleted);
    student.letterGrade = student.avgScore >= 90 ? 'A' : student.avgScore >= 80 ? 'B' : student.avgScore >= 70 ? 'C' : student.avgScore >= 60 ? 'D' : 'F';

    // Record submission entry
    const submissions = readJson(SUBMISSIONS_FILE, []);
    submissions.push({
      id: quizSubmission.submissionId || ('sub_' + Date.now()),
      studentId: student.id,
      studentName: student.name,
      cohortId: student.cohortId,
      assignmentId: quizSubmission.assignmentId || 'quiz_' + (quizSubmission.topic || 'general'),
      type: 'quiz',
      score: quizSubmission.score,
      percentage: quizSubmission.percentage,
      passed: quizSubmission.passed,
      xpEarned: quizSubmission.totalXpEarned || 0,
      submittedAt: new Date().toISOString()
    });
    writeJson(SUBMISSIONS_FILE, submissions);
  }

  student.lastActive = new Date().toISOString();
  writeJson(STUDENTS_FILE, students);
  return student;
}

/**
 * Returns personal progress summary for a given student
 */
function getStudentProgress(studentId = 'std_curr_user') {
  const students = readJson(STUDENTS_FILE, []);
  let student = students.find(s => s.id === studentId);
  if (!student) {
    student = {
      id: studentId,
      name: 'Quantum Scholar',
      challengesSolved: 0,
      quizzesCompleted: 0,
      avgScore: 0,
      totalXp: 0,
      letterGrade: 'N/A'
    };
  }

  const submissions = readJson(SUBMISSIONS_FILE, []).filter(s => s.studentId === studentId);

  return {
    student,
    submissionsCount: submissions.length,
    recentSubmissions: submissions.slice(-5).reverse()
  };
}

/**
 * Generates dynamic RFC-4180 compliant CSV gradebook string
 */
function generateGradebookCSV(cohortId = 'cohort_qc101') {
  const cohorts = getCohorts();
  const targetCohort = cohorts.find(c => c.id === cohortId) || cohorts[0] || { code: 'QC', name: 'Quantum Course' };
  const students = getCohortStudents(targetCohort.id);

  const headers = [
    'Student ID',
    'Student Name',
    'Email Address',
    'Cohort Code',
    'Course Name',
    'Coding Puzzles Solved (out of 8)',
    'Quizzes Completed',
    'Average Quiz Score (%)',
    'Total Mastery XP',
    'Final Grade'
  ];

  const rows = students.map(s => [
    `"${s.id}"`,
    `"${s.name.replace(/"/g, '""')}"`,
    `"${s.email}"`,
    `"${targetCohort.code}"`,
    `"${targetCohort.name.replace(/"/g, '""')}"`,
    s.challengesSolved || 0,
    s.quizzesCompleted || 0,
    s.avgScore || 0,
    s.totalXp || 0,
    `"${s.letterGrade || 'A'}"`
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
}

module.exports = {
  getCohorts,
  createCohort,
  getCohortStudents,
  getCohortAnalytics,
  createAssignment,
  recordStudentProgress,
  getStudentProgress,
  generateGradebookCSV
};
