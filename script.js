// ==========================================
// CONFIGURACIÓN E INICIALIZACIÓN DE FIREBASE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCMJw-RRlccuF5cP9IgPtZaO5LCP1cPIRs",
  authDomain: "easyexam-2d83e.firebaseapp.com",
  databaseURL: "https://easyexam-2d83e-default-rtdb.firebaseio.com",
  projectId: "easyexam-2d83e",
  storageBucket: "easyexam-2d83e.firebasestorage.app",
  messagingSenderId: "203972027709",
  appId: "1:203972027709:web:d36e24e0236b7d1fb81154"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

// Variables globales de la app
let registeredGroups = [];
let registeredStudents = [];
let registeredTeachers = [];
let examsBank = [];
let currentExamQuestions = [];
let currentEditingExamId = null;
let activeTimer = null;
let selectedGroupForView = null; // Grupo seleccionado en la pestaña Grupos

// Sesiones activas y métricas de examen / anti-cheat
let currentUser = null; 
let currentTeacher = null; 
let currentActiveExam = null;
let examStartTime = null;
let tabSwitchCount = 0;
let questionStartTimes = {};
let editingQuestionIndex = null; // Índice de la pregunta que se está editando actualmente

// Inicialización automática al cargar la ventana
window.onload = function() {
  cargarDatosDocente();
};

// ==========================================
// CONTROL DE ROLES Y NAVEGACIÓN
// ==========================================
function switchLoginRole(role) {
  const teacherBtn = document.getElementById('roleTeacherBtn');
  const studentBtn = document.getElementById('roleStudentBtn');
  const teacherForm = document.getElementById('teacherLoginForm');
  const studentForm = document.getElementById('studentLoginForm');

  if (!teacherBtn || !studentBtn || !teacherForm || !studentForm) return;

  if (role === 'teacher') {
    teacherBtn.classList.add('active');
    studentBtn.classList.remove('active');
    teacherForm.classList.remove('hidden');
    studentForm.classList.add('hidden');
  } else {
    studentBtn.classList.add('active');
    teacherBtn.classList.remove('active');
    studentForm.classList.remove('hidden');
    teacherForm.classList.add('hidden');
  }
}

function switchTab(tabId) {
  const tabs = document.querySelectorAll('.tab-content');
  tabs.forEach(tab => {
    tab.classList.add('hidden-tab');
    tab.classList.remove('active-tab');
  });

  const navBtns = document.querySelectorAll('.teacher-nav .nav-btn');
  navBtns.forEach(btn => btn.classList.remove('active'));

  const targetTab = document.getElementById(tabId);
  if (targetTab) {
    targetTab.classList.remove('hidden-tab');
    targetTab.classList.add('active-tab');
  }

  if (typeof event !== 'undefined' && event && event.target && event.target.classList.contains('nav-btn')) {
    event.target.classList.add('active');
  }
}

function logoutTeacher() {
  const teacherMod = document.getElementById('teacherModule');
  const loginMod = document.getElementById('loginModule');
  const teacherForm = document.getElementById('teacherLoginForm');

  currentTeacher = null;
  if (teacherMod) teacherMod.classList.add('hidden');
  if (loginMod) loginMod.classList.remove('hidden');
  if (teacherForm) teacherForm.reset();
}

function logoutStudent() {
  const studentMod = document.getElementById('studentModule');
  const loginMod = document.getElementById('loginModule');
  const studentForm = document.getElementById('studentLoginForm');
  
  currentUser = null;
  if (activeTimer) clearInterval(activeTimer);

  if (studentMod) studentMod.classList.add('hidden');
  if (loginMod) loginMod.classList.remove('hidden');
  if (studentForm) studentForm.reset();
}

// ==========================================
// GESTIÓN DE GRUPOS Y VISUALIZACIÓN DE INTEGRANTES
// ==========================================
function addGroup() {
  const input = document.getElementById('newGroupNameInput');
  if (!input) return;
  const groupName = input.value.trim();

  if (!groupName) {
    alert("Por favor ingresa un nombre para el grupo.");
    return;
  }

  if (registeredGroups.includes(groupName)) {
    alert("Este grupo ya existe.");
    return;
  }

  database.ref("grupos").push(groupName)
    .then(() => {
      input.value = "";
      alert("Grupo agregado exitosamente.");
    })
    .catch(error => alert("Error al agregar grupo: " + error.message));
}

function deleteGroup(groupKey) {
  if (confirm("¿Estás segura de eliminar este grupo?")) {
    database.ref("grupos/" + groupKey).remove()
      .then(() => {
        alert("Grupo eliminado.");
        if (selectedGroupForView) {
          selectedGroupForView = null;
          document.getElementById('groupMembersTitle').innerText = "Integrantes del Grupo";
          document.getElementById('groupMembersContainer').innerHTML = `<p style="color: #666; font-style: italic; font-size: 0.9rem;">Selecciona un grupo de la izquierda para ver sus estudiantes.</p>`;
        }
      })
      .catch(error => alert("Error al eliminar: " + error.message));
  }
}

// Escuchar cambios en grupos en tiempo real
database.ref("grupos").on("value", snapshot => {
  registeredGroups = [];
  const container = document.getElementById('groupsListContainer');
  if (container) container.innerHTML = "";

  snapshot.forEach(childSnap => {
    const key = childSnap.key;
    const groupName = childSnap.val();
    registeredGroups.push(groupName);

    if (container) {
      const isSelected = selectedGroupForView === groupName ? 'background: #e6f0fa; border-color: #007bff;' : 'background: #fff; border-color: #ddd;';
      container.innerHTML += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-radius: 6px; border: 1px solid #ddd; ${isSelected} cursor: pointer;" onclick="seleccionarGrupoParaVer('${groupName}')">
          <span style="font-weight: 500;">📚 ${groupName}</span>
          <button type="button" class="btn btn-danger-sm" onclick="event.stopPropagation(); deleteGroup('${key}')">Eliminar</button>
        </div>
      `;
    }
  });

  updateExamGroupSelect();
});

function seleccionarGrupoParaVer(groupName) {
  selectedGroupForView = groupName;
  document.getElementById('groupMembersTitle').innerText = `Integrantes de: ${groupName}`;
  
  database.ref("grupos").once("value", snapshot => {
    const container = document.getElementById('groupsListContainer');
    if (container) container.innerHTML = "";
    snapshot.forEach(childSnap => {
      const key = childSnap.key;
      const gName = childSnap.val();
      const isSelected = selectedGroupForView === gName ? 'background: #e6f0fa; border-color: #007bff;' : 'background: #fff; border-color: #ddd;';
      container.innerHTML += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-radius: 6px; border: 1px solid #ddd; ${isSelected} cursor: pointer;" onclick="seleccionarGrupoParaVer('${gName}')">
          <span style="font-weight: 500;">📚 ${gName}</span>
          <button type="button" class="btn btn-danger-sm" onclick="event.stopPropagation(); deleteGroup('${key}')">Eliminar</button>
        </div>
      `;
    });
  });

  cargarIntegrantesGrupo(groupName);
}

function cargarIntegrantesGrupo(groupName) {
  const container = document.getElementById('groupMembersContainer');
  if (!container) return;

  container.innerHTML = `<p style="color: #666; font-style: italic;">Cargando estudiantes del grupo ${groupName}...</p>`;

  const estudiantesDelGrupo = registeredStudents.filter(s => s.group === groupName);

  if (estudiantesDelGrupo.length === 0) {
    container.innerHTML = `<p style="color: #888; font-style: italic; font-size: 0.9rem;">No hay estudiantes registrados en este grupo todavía.</p>`;
    return;
  }

  let html = `<ul style="list-style-type: none; padding: 0; margin: 0;">`;
  estudiantesDelGrupo.forEach((est) => {
    html += `
      <li style="padding: 8px 10px; margin-bottom: 6px; background: #fff; border: 1px solid #eee; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
        <span>👤 <strong>${est.name}</strong></span>
        <span style="font-size: 0.8rem; color: #28a745; background: #e8f5e9; padding: 2px 6px; border-radius: 4px;">Inscrito</span>
      </li>
    `;
  });
  html += `</ul>`;
  container.innerHTML = html;
}

function updateExamGroupSelect() {
  const select = document.getElementById('examGroupSelect');
  if (!select) return;
  select.innerHTML = '<option value="">-- Seleccionar Grupo --</option>';
  registeredGroups.forEach(group => {
    select.innerHTML += `<option value="${group}">${group}</option>`;
  });
}

// ==========================================
// REGISTRO DE ESTUDIANTES Y DOCENTES
// ==========================================
database.ref("estudiantes").on("value", snapshot => {
  registeredStudents = [];
  snapshot.forEach(childSnap => {
    registeredStudents.push({
      id: childSnap.key,
      ...childSnap.val()
    });
  });

  if (selectedGroupForView) {
    cargarIntegrantesGrupo(selectedGroupForView);
  }
});

database.ref("docentes").on("value", snapshot => {
  registeredTeachers = [];
  snapshot.forEach(childSnap => {
    registeredTeachers.push({
      id: childSnap.key,
      ...childSnap.val()
    });
  });
});

function registerNewStudent() {
  const nameInput = prompt("Registro de Estudiante\n\nIngresa tu nombre completo:");
  if (!nameInput || nameInput.trim() === "") return;

  if (registeredGroups.length === 0) {
    alert("⚠ No hay grupos registrados por el docente todavía. Comunícate con tu profesor.");
    return;
  }

  const exists = registeredStudents.some(s => s.name.toLowerCase() === nameInput.trim().toLowerCase());
  if (exists) {
    alert("Este nombre ya está registrado. Intenta iniciar sesión.");
    return;
  }

  let groupOptionsText = "Selecciona tu grupo:\n";
  registeredGroups.forEach((g, index) => {
    groupOptionsText += `${index + 1}. ${g}\n`;
  });

  const groupIndexInput = prompt(groupOptionsText + "\nIngresa el número correspondiente à tu grupo:");
  const selectedIndex = parseInt(groupIndexInput) - 1;

  if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= registeredGroups.length) {
    alert("Selección de grupo inválida. Registro cancelado.");
    return;
  }

  const chosenGroup = registeredGroups[selectedIndex];

  const passInput = prompt("Crea una contraseña personal para tus ingresos futuros:");
  if (!passInput || passInput.trim() === "") {
    alert("La contraseña no puede estar vacía. Registro cancelado.");
    return;
  }

  const newStudent = {
    name: nameInput.trim(),
    group: chosenGroup,
    pass: passInput.trim()
  };

  database.ref("estudiantes").push(newStudent)
    .then(() => {
      alert(`¡Registro exitoso, ${newStudent.name} (${chosenGroup})! Ya puedes iniciar sesión.`);
    })
    .catch((error) => {
      alert("Error al registrar estudiante en línea: " + error.message);
    });
}

function registerNewTeacher() {
  const nameInput = prompt("Registro de Docente\n\nIngresa tu nombre completo:");
  if (!nameInput || nameInput.trim() === "") return;

  const exists = registeredTeachers.some(t => t.name.toLowerCase() === nameInput.trim().toLowerCase());
  if (exists || nameInput.trim().toLowerCase() === "luisa arango") {
    alert("Este nombre ya está registrado o pertenece al administrador principal.");
    return;
  }

  const subjectInput = prompt("¿Qué materia o asignatura impartes?");
  if (!subjectInput || subjectInput.trim() === "") {
    alert("La materia es obligatoria. Registro cancelado.");
    return;
  }

  const passInput = prompt("Crea una contraseña personal para tus ingresos futuros:");
  if (!passInput || passInput.trim() === "") {
    alert("La contraseña no puede estar vacía. Registro cancelado.");
    return;
  }

  const newTeacher = {
    name: nameInput.trim(),
    subject: subjectInput.trim(),
    pass: passInput.trim()
  };

  database.ref("docentes").push(newTeacher)
    .then(() => {
      alert(`¡Registro exitoso, Prof. ${newTeacher.name}! Ya puedes iniciar sesión.`);
    })
    .catch((error) => {
      alert("Error al registrar docente en línea: " + error.message);
    });
}

// ==========================================
// BANCO Y CREADOR DE EXÁMENES (DOCENTE)
// ==========================================
function openExamCreator() {
  currentEditingExamId = null;
  currentExamQuestions = [];
  editingQuestionIndex = null;
  document.getElementById('creatorTitle').innerText = "Nuevo Examen";
  document.getElementById('examTitleInput').value = "";
  document.getElementById('examGroupSelect').value = "";
  document.getElementById('examTimeInput').value = "30";
  
  if (document.getElementById('examMediaInput')) document.getElementById('examMediaInput').value = "";
  if (document.getElementById('examRandomCountInput')) document.getElementById('examRandomCountInput').value = "0";
  if (document.getElementById('examDeadlineInput')) document.getElementById('examDeadlineInput').value = "";

  document.getElementById('currentExamQuestionsList').innerHTML = "";
  resetQuestionForm();
  
  document.getElementById('examsBankSection').classList.add('hidden');
  document.getElementById('examCreatorSection').classList.remove('hidden');
  toggleOptionFields();
}

function closeExamCreator() {
  document.getElementById('examCreatorSection').classList.add('hidden');
  document.getElementById('examsBankSection').classList.remove('hidden');
}

function toggleOptionFields() {
  const type = document.getElementById('newQuestionType').value;
  const block = document.getElementById('multipleOptionsBlock');
  if (type === 'multiple') {
    block.classList.remove('hidden');
    if (document.getElementById('dynamicOptionsContainer').innerHTML === "") {
      addOptionField();
      addOptionField();
    }
  } else {
    block.classList.add('hidden');
  }
}

function addOptionField(textValue = "") {
  const container = document.getElementById('dynamicOptionsContainer');
  const index = container.children.length;
  const div = document.createElement('div');
  div.style.cssText = "display: flex; gap: 8px; margin-bottom: 6px; align-items: center;";
  div.innerHTML = `
    <input type="radio" name="correctOptionRadio" value="${index}">
    <input type="text" placeholder="Opción ${index + 1}" class="option-text-input" style="flex: 1;" value="${textValue}">
    <button type="button" class="btn btn-danger-sm" onclick="this.parentElement.remove()">×</button>
  `;
  container.appendChild(div);
}

function resetQuestionForm() {
  editingQuestionIndex = null;
  document.getElementById('newQuestionText').value = "";
  document.getElementById('newQuestionType').value = "multiple";
  document.getElementById('newQuestionPoints').value = "1";
  document.getElementById('dynamicOptionsContainer').innerHTML = "";
  toggleOptionFields();
  const addBtn = document.getElementById('addQuestionBtn');
  if (addBtn) addBtn.innerText = "➕ Agregar Pregunta al Examen";
}

function addQuestionToCurrentExam() {
  const text = document.getElementById('newQuestionText').value.trim();
  const type = document.getElementById('newQuestionType').value;
  const points = parseFloat(document.getElementById('newQuestionPoints').value) || 1;

  if (!text) {
    alert("Escribe el enunciado de la pregunta.");
    return;
  }

  let questionObj = { text, type, points };

  if (type === 'multiple') {
    const optionInputs = document.querySelectorAll('.option-text-input');
    const radios = document.querySelectorAll('input[name="correctOptionRadio"]');
    let options = [];
    let correctIndex = -1;

    optionInputs.forEach((input, idx) => {
      options.push(input.value.trim());
      if (radios[idx].checked) {
        correctIndex = idx;
      }
    });

    if (options.some(opt => opt === "")) {
      alert("Todas las opciones deben tener texto.");
      return;
    }

    if (correctIndex === -1) {
      alert("Debes marcar cuál opción es la correcta.");
      return;
    }

    questionObj.options = options;
    questionObj.correctIndex = correctIndex;
  }

  if (editingQuestionIndex !== null) {
    // Si estamos editando una pregunta existente
    currentExamQuestions[editingQuestionIndex] = questionObj;
    alert("Pregunta actualizada con éxito.");
  } else {
    // Si es una pregunta nueva
    currentExamQuestions.push(questionObj);
  }

  renderCurrentExamQuestions();
  resetQuestionForm();
}

function editarPreguntaActual(index) {
  const q = currentExamQuestions[index];
  if (!q) return;

  editingQuestionIndex = index;
  document.getElementById('newQuestionText').value = q.text;
  document.getElementById('newQuestionType').value = q.type;
  document.getElementById('newQuestionPoints').value = q.points;

  toggleOptionFields();

  if (q.type === 'multiple') {
    const container = document.getElementById('dynamicOptionsContainer');
    container.innerHTML = "";
    q.options.forEach((optText, oIdx) => {
      addOptionField(optText);
    });

    const radios = document.querySelectorAll('input[name="correctOptionRadio"]');
    if (radios[q.correctIndex]) {
      radios[q.correctIndex].checked = true;
    }
  }

  const addBtn = document.getElementById('addQuestionBtn');
  if (addBtn) addBtn.innerText = "💾 Guardar Cambios de Pregunta";
  
  // Desplazar la vista hacia el formulario de preguntas para comodidad del docente
  document.getElementById('newQuestionText').scrollIntoView({ behavior: 'smooth' });
}

function renderCurrentExamQuestions() {
  const list = document.getElementById('currentExamQuestionsList');
  list.innerHTML = "";
  currentExamQuestions.forEach((q, idx) => {
    list.innerHTML += `
      <div style="background: #f9f9f9; padding: 10px; margin-bottom: 8px; border-radius: 6px; border: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong>Pq ${idx + 1} (${q.points} pts):</strong> ${q.text} [${q.type}]
        </div>
        <div style="display: flex; gap: 5px;">
          <button type="button" class="btn btn-secondary-sm" onclick="editarPreguntaActual(${idx})">✏️ Editar</button>
          <button type="button" class="btn btn-danger-sm" onclick="currentExamQuestions.splice(${idx},1); renderCurrentExamQuestions();">Eliminar</button>
        </div>
      </div>
    `;
  });
}

function saveExamToBank() {
  const title = document.getElementById('examTitleInput').value.trim();
  const group = document.getElementById('examGroupSelect').value;
  const timeLimit = parseInt(document.getElementById('examTimeInput').value) || 30;
  
  const mediaUrl = document.getElementById('examMediaInput') ? document.getElementById('examMediaInput').value.trim() : "";
  const randomCount = parseInt(document.getElementById('examRandomCountInput') ? document.getElementById('examRandomCountInput').value : 0) || 0;
  const deadline = document.getElementById('examDeadlineInput') ? document.getElementById('examDeadlineInput').value : "";

  if (!title) {
    alert("El examen debe tener un título.");
    return;
  }
  if (!group) {
    alert("Selecciona un grupo para el examen.");
    return;
  }
  if (currentExamQuestions.length === 0) {
    alert("Agrega al menos una pregunta al examen.");
    return;
  }

  if (randomCount > currentExamQuestions.length) {
    alert(`Has configurado ${randomCount} preguntas aleatorias, pero el banco solo tiene ${currentExamQuestions.length}. Ajusta este valor.`);
    return;
  }

  const examData = { 
    title, 
    group, 
    timeLimit, 
    mediaUrl, 
    randomCount, 
    deadline,
    questions: currentExamQuestions 
  };

  let dbRef = database.ref("examenes");
  if (currentEditingExamId) {
    dbRef.child(currentEditingExamId).set(examData)
      .then(() => {
        alert("Examen actualizado con éxito.");
        closeExamCreator();
      });
  } else {
    dbRef.push(examData)
      .then(() => {
        alert("Examen guardado en el banco.");
        closeExamCreator();
      });
  }
}

// Escuchar banco de exámenes
database.ref("examenes").on("value", snapshot => {
  examsBank = [];
  const container = document.getElementById('examsBankContainer');
  const historySelect = document.getElementById('historyExamFilter');
  
  if (container) container.innerHTML = "";
  if (historySelect) historySelect.innerHTML = '<option value="">-- Seleccionar Examen --</option>';

  snapshot.forEach(childSnap => {
    const key = childSnap.key;
    const exam = childSnap.val();
    exam.id = key;
    examsBank.push(exam);

    if (container) {
      const deadlineText = exam.deadline ? ` | Vence: ${new Date(exam.deadline).toLocaleString()}` : '';
      container.innerHTML += `
        <div style="background:#fff; padding:15px; margin-bottom:10px; border-radius:8px; border:1px solid #eee; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            <h4 style="margin:0 0 5px 0;">${exam.title}</h4>
            <small style="color:#666;">Grupo: <b>${exam.group}</b> | Tiempo: ${exam.timeLimit} min | Total Preguntas: ${exam.questions ? exam.questions.length : 0} ${exam.randomCount > 0 ? `(Aleatorias: ${exam.randomCount})` : ''}${deadlineText}</small>
          </div>
          <div style="display: flex; gap: 5px; flex-wrap: wrap;">
            <button class="btn btn-secondary-sm" onclick="abrirVistaPrevia('${key}')">👁️ Vista Previa</button>
            <button class="btn btn-secondary-sm" onclick="editarExamen('${key}')">✏️ Editar</button>
            <button class="btn btn-secondary-sm" onclick="abrirCompartirExamen('${key}')">🔗 Compartir / QR</button>
            <button class="btn btn-secondary-sm" onclick="verRespuestasRecibidas('${key}')">📥 Respuestas</button>
            <button class="btn btn-danger-sm" onclick="deleteExam('${key}')">Eliminar</button>
          </div>
        </div>
      `;
    }

    if (historySelect) {
      historySelect.innerHTML += `<option value="${key}">${exam.title} (${exam.group})</option>`;
    }
  });

  if (currentUser) {
    cargarExamenesEstudiante();
  }
});

function deleteExam(key) {
  if (confirm("¿Estás seguro de eliminar este examen del banco?")) {
    database.ref("examenes/" + key.trim()).remove()
      .then(() => alert("Examen eliminado."));
  }
}

// ==========================================
// LOGIN DOCENTE & ESTUDIANTE (EVENT LISTENERS)
// ==========================================
const teacherFormEl = document.getElementById('teacherLoginForm');
if (teacherFormEl) {
  teacherFormEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = document.getElementById('loginTeacherUser').value.trim();
    const pass = document.getElementById('loginTeacherPass').value.trim();

    if (user === "Luisa Arango" && pass === "1234") {
      iniciarSesionDocenteExitoso({ name: "Luisa Arango", subject: "General" });
      return;
    }

    const foundTeacher = registeredTeachers.find(t => t.name.toLowerCase() === user.toLowerCase() && t.pass === pass);

    if (foundTeacher) {
      iniciarSesionDocenteExitoso(foundTeacher);
    } else {
      alert("Usuario o contraseña de docente incorrectos.");
    }
  });
}

function iniciarSesionDocenteExitoso(teacherObj) {
  currentTeacher = teacherObj;
  const loginMod = document.getElementById('loginModule');
  const teacherMod = document.getElementById('teacherModule');
  if (loginMod) loginMod.classList.add('hidden');
  if (teacherMod) teacherMod.classList.remove('hidden');

  const welcomeTeacherEl = document.getElementById('teacherWelcomeName');
  if (welcomeTeacherEl) welcomeTeacherEl.innerText = teacherObj.name;

  cargarDatosDocente();
}

const studentFormEl = document.getElementById('studentLoginForm');
if (studentFormEl) {
  studentFormEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('loginStudentName').value.trim();
    const pass = document.getElementById('loginStudentPass').value.trim();

    const foundStudent = registeredStudents.find(s => s.name.toLowerCase() === name.toLowerCase() && s.pass === pass);

    if (foundStudent) {
      currentUser = foundStudent;
      alert(`¡Bienvenido de nuevo, ${currentUser.name}!`);
      
      const loginMod = document.getElementById('loginModule');
      const studentMod = document.getElementById('studentModule');
      if (loginMod) loginMod.classList.add('hidden');
      if (studentMod) studentMod.classList.remove('hidden');

      const welcomeEl = document.getElementById('studentWelcomeName');
      if (welcomeEl) welcomeEl.innerText = currentUser.name;

      cargarExamenesEstudiante();
    } else {
      alert("Nombre o contraseña incorrectos, o usuario no registrado.");
    }
  });
}

// ==========================================
// VISTA Y RESOLUCIÓN DE EXÁMENES (ESTUDIANTE)
// ==========================================
function cargarExamenesEstudiante() {
  const container = document.getElementById('studentExamsContainer');
  if (!container || !currentUser) return;

  container.innerHTML = "<p>Cargando evaluaciones disponibles...</p>";

  database.ref("resultados").orderByChild("studentName").equalTo(currentUser.name).once("value", snapshot => {
    const resultadosPorExamen = {};
    snapshot.forEach(child => {
      const data = child.val();
      resultadosPorExamen[data.examId] = data;
    });

    container.innerHTML = "";
    const examenesDisponibles = examsBank.filter(ex => ex.group === currentUser.group);

    if (examenesDisponibles.length === 0) {
      container.innerHTML = "<p>No hay exámenes disponibles para tu grupo en este momento.</p>";
      return;
    }

    const ahora = Date.now();

    examenesDisponibles.forEach(exam => {
      const resultadoGuardado = resultadosPorExamen[exam.id];
      const yaPresentado = !!resultadoGuardado;
      
      let expirado = false;
      if (exam.deadline) {
        const tiempoLimite = new Date(exam.deadline).getTime();
        if (ahora > tiempoLimite) {
          expirado = true;
        }
      }

      let estadoHtml = '';
      if (yaPresentado) {
        estadoHtml = `<button class="btn btn-secondary-sm" onclick="verResumenAnterior('${exam.id}')">📁 Ver mi Resumen</button>`;
      } else if (expirado) {
        estadoHtml = '<span style="color:#d9534f; font-weight:bold;">❌ Examen Expirado (Plazo Vencido)</span>';
      } else {
        estadoHtml = `<button class="btn btn-primary" onclick="iniciarExamen('${exam.id}')">Presentar Examen</button>`;
      }

      const infoPlazo = exam.deadline ? `<br><small style="color:#888;">Plazo límite: ${new Date(exam.deadline).toLocaleString()}</small>` : '';

      container.innerHTML += `
        <div style="background:#fff; padding:15px; margin-bottom:12px; border-radius:8px; border:1px solid #ddd; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h4 style="margin:0 0 5px 0;">${exam.title}</h4>
            <small style="color:#666;">Duración: ${exam.timeLimit} min | Preguntas: ${exam.randomCount > 0 ? exam.randomCount : exam.questions.length}</small>
            ${infoPlazo}
          </div>
          <div>${estadoHtml}</div>
        </div>
      `;
    });
  });
}

function iniciarExamen(examId) {
  const examOriginal = examsBank.find(e => e.id === examId);
  if (!examOriginal) return;

  if (examOriginal.deadline && Date.now() > new Date(examOriginal.deadline).getTime()) {
    alert("Lo sentimos, el plazo límite para presentar este examen ya ha vencido.");
    cargarExamenesEstudiante();
    return;
  }

  let poolPreguntas = [...examOriginal.questions];

  for (let i = poolPreguntas.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [poolPreguntas[i], poolPreguntas[j]] = [poolPreguntas[j], poolPreguntas[i]];
  }

  let cantidadAUsar = poolPreguntas.length;
  if (examOriginal.randomCount && examOriginal.randomCount > 0 && examOriginal.randomCount < poolPreguntas.length) {
    cantidadAUsar = examOriginal.randomCount;
  }
  
  const preguntasSeleccionadas = poolPreguntas.slice(0, cantidadAUsar);

  currentActiveExam = {
    ...examOriginal,
    questions: preguntasSeleccionadas
  };

  examStartTime = Date.now();
  tabSwitchCount = 0;
  questionStartTimes = {};
  currentActiveExam.questions.forEach((_, idx) => {
    questionStartTimes[idx] = Date.now();
  });

  window.onblur = function() {
    tabSwitchCount++;
  };

  document.getElementById('studentDashboardView').classList.add('hidden');
  document.getElementById('studentExamExecutionView').classList.remove('hidden');

  document.getElementById('execExamTitle').innerText = currentActiveExam.title;

  const questionsContainer = document.getElementById('execQuestionsContainer');
  questionsContainer.innerHTML = "";

  if (currentActiveExam.mediaUrl) {
    let mediaHtml = "";
    const url = currentActiveExam.mediaUrl;
    if (url.match(/\.(jpeg|jpg|gif|png)$/i) || url.includes("imgur") || url.includes("cloudinary")) {
      mediaHtml = `<div style="text-align:center; margin-bottom:15px;"><img src="${url}" alt="Recurso multimedia" style="max-width:100%; max-height:300px; border-radius:6px;"></div>`;
    } else if (url.match(/\.(mp4|webm|ogg)$/i) || url.includes("youtube")) {
      mediaHtml = `<div style="text-align:center; margin-bottom:15px;"><video src="${url}" controls style="max-width:100%; max-height:300px;"></video></div>`;
    } else if (url.match(/\.(mp3|wav|ogg)$/i)) {
      mediaHtml = `<div style="text-align:center; margin-bottom:15px;"><audio src="${url}" controls style="width:100%;"></audio></div>`;
    } else {
      mediaHtml = `<div style="margin-bottom:15px; padding:10px; background:#eef; border-radius:6px;"><a href="${url}" target="_blank">🔗 Enlace a recurso multimedia del examen</a></div>`;
    }
    questionsContainer.innerHTML += mediaHtml;
  }

  currentActiveExam.questions.forEach((q, idx) => {
    let htmlOptions = "";
    if (q.type === 'multiple' && q.options) {
      q.options.forEach((opt, optIdx) => {
        htmlOptions += `
          <div style="margin-bottom: 5px;">
            <label>
              <input type="radio" name="question_${idx}" value="${optIdx}"> ${opt}
            </label>
          </div>
        `;
      });
    } else {
      htmlOptions = `<input type="text" id="open_answer_${idx}" class="form-control" placeholder="Escribe tu respuesta aquí...">`;
    }

    questionsContainer.innerHTML += `
      <div style="background:#fdfdfd; padding:15px; margin-bottom:15px; border-radius:6px; border:1px solid #ccc;">
        <p><strong>Pregunta ${idx + 1} (${q.points} pts):</strong> ${q.text}</p>
        ${htmlOptions}
      </div>
    `;
  });

  let timeLeft = currentActiveExam.timeLimit * 60;
  const timerDisplay = document.getElementById('execTimerDisplay');
  
  if (activeTimer) clearInterval(activeTimer);

  activeTimer = setInterval(() => {
    let minutes = Math.floor(timeLeft / 60);
    let seconds = timeLeft % 60;
    timerDisplay.innerText = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

    if (timeLeft <= 0) {
      clearInterval(activeTimer);
      alert("¡Se ha acabado el tiempo!");
      enviarExamen(true);
    }
    timeLeft--;
  }, 1000);
}

function enviarExamen(porTiempo = false) {
  if (!porTiempo && !confirm("¿Estás seguro de enviar tu examen? No podrás cambiar las respuestas después.")) {
    return;
  }

  if (activeTimer) clearInterval(activeTimer);
  window.onblur = null;

  let puntajeObtenido = 0;
  let puntajeTotal = 0;
  let detalleRespuestas = [];
  const tiempoFinGlobal = Date.now();

  currentActiveExam.questions.forEach((q, idx) => {
    puntajeTotal += q.points;
    let respuestaEstudiante = null;
    let esCorrecta = false;

    if (q.type === 'multiple') {
      const selectedRadio = document.querySelector(`input[name="question_${idx}"]:checked`);
      if (selectedRadio) {
        respuestaEstudiante = parseInt(selectedRadio.value);
        if (respuestaEstudiante === q.correctIndex) {
          esCorrecta = true;
        }
      }
    } else {
      const openInput = document.getElementById(`open_answer_${idx}`);
      if (openInput) {
        respuestaEstudiante = openInput.value.trim();
      }
    }

    let puntuacionAportada = esCorrecta ? q.points : 0;
    puntajeObtenido += puntuacionAportada;

    const tiempoPreguntaSeg = Math.round((tiempoFinGlobal - (questionStartTimes[idx] || examStartTime)) / 1000);

    detalleRespuestas.push({
      preguntaIndex: idx,
      enunciado: q.text,
      tiempoSegundos: tiempoPreguntaSeg,
      respuesta: respuestaEstudiante !== null ? respuestaEstudiante : "Sin responder",
      esCorrecta: esCorrecta,
      puntuacionAportada: puntuacionAportada
    });
  });

  const resultadoData = {
    examId: currentActiveExam.id,
    examTitle: currentActiveExam.title,
    studentName: currentUser.name,
    studentGroup: currentUser.group,
    puntajeObtenido: puntajeObtenido,
    puntajeTotal: puntajeTotal,
    startTime: examStartTime,
    fecha: tiempoFinGlobal,
    tabSwitchCount: tabSwitchCount,
    respuestas: detalleRespuestas
  };

  database.ref("resultados").push(resultadoData)
    .then(() => {
      const intentoParaResumen = {
        calificacion: `${puntajeObtenido} / ${puntajeTotal}`,
        tiempoEmpleadoTexto: `${Math.round((tiempoFinGlobal - examStartTime) / 1000)} segundos`,
        horaInicio: new Date(examStartTime).toLocaleTimeString(),
        horaFin: new Date(tiempoFinGlobal).toLocaleTimeString(),
        detallesPreguntas: detalleRespuestas.map((resp, i) => {
          const q = currentActiveExam.questions[i];
          return {
            textoPregunta: q.text,
            respuestaEstudiante: q.type === 'multiple' && typeof resp.respuesta === 'number' && q.options[resp.respuesta] !== undefined 
              ? q.options[resp.respuesta] 
              : resp.respuesta,
            respuestaCorrecta: q.type === 'multiple' ? q.options[q.correctIndex] : 'Abierta / Verificada',
            esCorrecta: resp.esCorrecta,
            tiempoEmpleadoPregunta: `${resp.tiempoSegundos}s`
          };
        })
      };

      mostrarResumenIndividualEstudiante(currentActiveExam.id, intentoParaResumen);
    })
    .catch(error => {
      alert("Error al enviar el resultado: " + error.message);
    });
}

function verResumenAnterior(examId) {
  if (!currentUser) return;

  database.ref("resultados")
    .orderByChild("studentName")
    .equalTo(currentUser.name)
    .once("value", snapshot => {
      let resultadoEncontrado = null;
      snapshot.forEach(child => {
        const data = child.val();
        if (data.examId === examId) {
          resultadoEncontrado = data;
        }
      });

      if (!resultadoEncontrado) {
        alert("No se encontró el registro de este examen.");
        return;
      }

      const examenOriginal = examsBank.find(e => e.id === examId);
      const preguntasOriginales = examenOriginal ? examenOriginal.questions : [];

      const intentoParaResumen = {
        calificacion: `${resultadoEncontrado.puntajeObtenido} / ${resultadoEncontrado.puntajeTotal}`,
        tiempoEmpleadoTexto: `${Math.round((resultadoEncontrado.fecha - resultadoEncontrado.startTime) / 1000)} segundos`,
        horaInicio: new Date(resultadoEncontrado.startTime).toLocaleTimeString(),
        horaFin: new Date(resultadoEncontrado.fecha).toLocaleTimeString(),
        detallesPreguntas: resultadoEncontrado.respuestas.map((resp, i) => {
          const q = preguntasOriginales[resp.preguntaIndex] || { text: resp.enunciado, type: 'open', options: [] };
          return {
            textoPregunta: resp.enunciado,
            respuestaEstudiante: q.type === 'multiple' && typeof resp.respuesta === 'number' && q.options && q.options[resp.respuesta] !== undefined 
              ? q.options[resp.respuesta] 
              : resp.respuesta,
            respuestaCorrecta: q.type === 'multiple' && q.options ? q.options[q.correctIndex] : 'Abierta / Verificada',
            esCorrecta: resp.esCorrecta,
            tiempoEmpleadoPregunta: `${resp.tiempoSegundos}s`
          };
        })
      };

      mostrarResumenIndividualEstudiante(examId, intentoParaResumen);
    });
}

// ==========================================
// CONFIGURACIÓN Y PERFIL DEL DOCENTE
// ==========================================
function cargarDatosDocente() {
  database.ref("configuracionDocente").on("value", snapshot => {
    const config = snapshot.val();
    if (config) {
      if (document.getElementById('profNameInput')) document.getElementById('profNameInput').value = config.name || "";
      if (document.getElementById('profPassInput')) document.getElementById('profPassInput').value = config.pass || "";
      if (document.getElementById('profSubjectInput')) document.getElementById('profSubjectInput').value = config.subject || "";
      if (document.getElementById('profBioInput')) document.getElementById('profBioInput').value = config.bio || "";
      if (config.avatar && document.getElementById('avatarImage')) {
        document.getElementById('avatarImage').src = config.avatar;
      }
    }
  });
}

function updateProfile() {
  const name = document.getElementById('profNameInput') ? document.getElementById('profNameInput').value.trim() : "";
  const pass = document.getElementById('profPassInput') ? document.getElementById('profPassInput').value.trim() : "";
  const subject = document.getElementById('profSubjectInput') ? document.getElementById('profSubjectInput').value.trim() : "";
  const bio = document.getElementById('profBioInput') ? document.getElementById('profBioInput').value.trim() : "";
  const avatarImg = document.getElementById('avatarImage');
  const avatar = avatarImg ? avatarImg.src : "";

  const teacherConfig = { name, pass, subject, bio, avatar };

  database.ref("configuracionDocente").set(teacherConfig)
    .then(() => {
      console.log("Perfil actualizado correctamente en Firebase.");
    })
    .catch(error => {
      alert("Error al actualizar el perfil: " + error.message);
    });
}

const avatarInputEl = document.getElementById('avatarInput');
if (avatarInputEl) {
  avatarInputEl.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(event) {
        const base64Image = event.target.result;
        document.getElementById('avatarImage').src = base64Image;
        updateProfile(); 
      };
      reader.readAsDataURL(file);
    }
  });
}

// ==========================================
// FUNCIONES DE VISTA PREVIA, QR, EDICIÓN Y RESPUESTAS
// ==========================================
function abrirVistaPrevia(examId) {
  const examen = examsBank.find(e => e.id === examId);
  if (!examen) {
    alert("No se encontró el examen para la vista previa.");
    return;
  }

  const container = document.getElementById("previewContentContainer");
  if (!container) return;

  container.innerHTML = `
    <h3 style="color: #333; margin-bottom: 5px;">${examen.title} (Simulacro)</h3>
    <p style="color: #666; font-size: 0.85rem; margin-bottom: 15px;">Grupo: ${examen.group || 'General'} | Tiempo: ${examen.timeLimit} min</p>
    <hr style="border: 0; border-top: 1px solid #eee; margin-bottom: 15px;">
  `;

  if (examen.mediaUrl) {
    container.innerHTML += `<div style="margin-bottom: 15px;"><img src="${examen.mediaUrl}" style="max-width: 100%; border-radius: 8px;" alt="Multimedia"></div>`;
  }

  if (examen.questions && examen.questions.length > 0) {
    examen.questions.forEach((q, index) => {
      let opcionesHtml = '';
      if (q.type === 'multiple' && q.options) {
        q.options.forEach((opt, oIndex) => {
          opcionesHtml += `
            <div style="margin: 5px 0;">
              <label><input type="radio" name="preview_q_${index}" value="${oIndex}"> ${opt}</label>
            </div>`;
        });
      } else {
        opcionesHtml = `<textarea style="width:100%; margin-top:5px; padding:8px;" placeholder="Respuesta abierta de prueba..."></textarea>`;
      }

      container.innerHTML += `
        <div style="background: #f9f9f9; padding: 12px; border-radius: 8px; margin-bottom: 12px; border: 1px solid #e1e1e1;">
          <p style="font-weight: bold; margin-bottom: 8px;">${index + 1}. ${q.text} <span style="font-size:0.8rem; color:#888;">(${q.points || 1} pts)</span></p>
          ${opcionesHtml}
        </div>
      `;
    });
  } else {
    container.innerHTML += `<p style="color: #888; font-style: italic;">Este examen no tiene preguntas agregadas aún.</p>`;
  }

  document.getElementById("previewModal").classList.remove("hidden");
}

function closePreviewModal() {
  document.getElementById("previewModal").classList.add("hidden");
}

function abrirCompartirExamen(examId) {
  const modal = document.getElementById("shareModal");
  const qrContainer = document.getElementById("qrcodeContainer");
  const linkInput = document.getElementById("shareLinkInput");

  if (!modal || !qrContainer || !linkInput) return;

  qrContainer.innerHTML = "";
  const urlExamen = window.location.href.split('#')[0] + "?exam=" + examId;
  linkInput.value = urlExamen;

  modal.classList.remove("hidden");

  new QRCode(qrContainer, {
    text: urlExamen,
    width: 180,
    height: 180,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });
}

function closeShareModal() {
  document.getElementById("shareModal").classList.add("hidden");
}

function copyShareLink() {
  const linkInput = document.getElementById("shareLinkInput");
  if (!linkInput) return;
  linkInput.select();
  linkInput.setSelectionRange(0, 99999);
  document.execCommand("copy");
  alert("¡Enlace copiado al portapapeles!");
}

function editarExamen(examId) {
  const examen = examsBank.find(e => e.id === examId);
  if (!examen) return;

  currentEditingExamId = examId;

  document.getElementById("examsBankSection").classList.add("hidden");
  document.getElementById("examCreatorSection").classList.remove("hidden");
  document.getElementById("creatorTitle").innerText = "Editar Examen";

  document.getElementById("examTitleInput").value = examen.title || "";
  document.getElementById("examGroupSelect").value = examen.group || "";
  document.getElementById("examTimeInput").value = examen.timeLimit || 30;
  
  if (document.getElementById("examMediaInput")) {
    document.getElementById("examMediaInput").value = examen.mediaUrl || "";
  }
  if (document.getElementById("examRandomCountInput")) {
    document.getElementById("examRandomCountInput").value = examen.randomCount || 0;
  }
  if (document.getElementById("examDeadlineInput")) {
    document.getElementById("examDeadlineInput").value = examen.deadline || "";
  }

  currentExamQuestions = examen.questions ? [...examen.questions] : [];
  renderCurrentExamQuestions();
}

function verRespuestasRecibidas(examId) {
  const examen = examsBank.find(e => e.id === examId);
  const modal = document.getElementById("responsesModal");
  const container = document.getElementById("responsesListContainer");
  const title = document.getElementById("responsesModalTitle");

  if (!modal || !container || !title) return;

  title.innerText = `📥 Respuestas Recibidas: ${examen ? examen.title : ''}`;
  container.innerHTML = `<p style="color: #666; font-style: italic;">Cargando entregas de los estudiantes...</p>`;
  modal.classList.remove("hidden");

  database.ref('resultados').orderByChild('examId').equalTo(examId).once('value')
    .then(snapshot => {
      const data = snapshot.val();
      if (!data) {
        container.innerHTML = `<p style="color: #888; text-align: center; padding: 20px;">Aún no hay estudiantes que hayan entregado este examen.</p>`;
        return;
      }

      let html = `<table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
        <thead>
          <tr style="background: #f4f4f4; border-bottom: 2px solid #ddd;">
            <th style="padding: 8px; text-align: left;">Estudiante</th>
            <th style="padding: 8px; text-align: center;">Grupo</th>
            <th style="padding: 8px; text-align: center;">Calificación</th>
            <th style="padding: 8px; text-align: center;">Fecha</th>
          </tr>
        </thead>
        <tbody>`;

      Object.values(data).forEach(res => {
        const fechaFormateada = res.fecha ? new Date(res.fecha).toLocaleString() : 'Reciente';
        html += `
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px;">${res.studentName || 'Anónimo'}</td>
            <td style="padding: 8px; text-align: center; color: #555;">${res.studentGroup || '-'}</td>
            <td style="padding: 8px; text-align: center; font-weight: bold; color: #28a745;">${res.puntajeObtenido} / ${res.puntajeTotal}</td>
            <td style="padding: 8px; text-align: center; color: #666; font-size: 0.8rem;">${fechaFormateada}</td>
          </tr>`;
      });

      html += `</tbody></table>`;
      container.innerHTML = html;
    })
    .catch(error => {
      container.innerHTML = `<p style="color: #d9534f;">Error al cargar las respuestas: ${error.message}</p>`;
    });
}

function closeResponsesModal() {
  document.getElementById("responsesModal").classList.add("hidden");
}

// ==========================================
// HISTORIAL Y EXPORTACIÓN AVANZADA A EXCEL (.XLSX)
// ==========================================
const historyFilterEl = document.getElementById('historyExamFilter');
if (historyFilterEl) {
  historyFilterEl.addEventListener('change', function() {
    cargarHistorialExamen(this.value);
  });
}

function cargarHistorialExamen(examId) {
  const container = document.getElementById('historyListContainer');
  if (!container) return;

  if (!examId) {
    container.innerHTML = `<p style="color: #666; font-style: italic;">Selecciona un examen arriba para ver su historial y opciones de descarga.</p>`;
    return;
  }

  container.innerHTML = `<p style="color: #666;">Cargando resultados...</p>`;

  database.ref("resultados").orderByChild("examId").equalTo(examId).once("value", snapshot => {
    const resultados = [];
    snapshot.forEach(child => {
      resultados.push({
        id: child.key,
        ...child.val()
      });
    });

    if (resultados.length === 0) {
      container.innerHTML = `<p style="color: #888; text-align: center; padding: 15px;">Aún no hay estudiantes que hayan presentado este examen.</p>`;
      return;
    }

    let html = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
        <h4 style="margin: 0; color: #333;">Total de Evaluados: ${resultados.length}</h4>
        <button class="btn" onclick="descargarExcelGeneral('${examId}')" style="background-color: #28a745;">📥 Descargar Reporte General (Excel)</button>
      </div>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
          <thead>
            <tr style="background: #f4f4f4; border-bottom: 2px solid #ddd;">
              <th style="padding: 10px; text-align: left;">Estudiante</th>
              <th style="padding: 10px; text-align: center;">Grupo</th>
              <th style="padding: 10px; text-align: center;">Puntaje</th>
              <th style="padding: 10px; text-align: center;">Salidas (Anti-Cheat)</th>
              <th style="padding: 10px; text-align: center;">Hora Inicio / Fin</th>
              <th style="padding: 10px; text-align: center;">Acciones</th>
            </tr>
          </thead>
          <tbody>
    `;

    resultados.forEach(res => {
      const horaInicio = res.startTime ? new Date(res.startTime).toLocaleTimeString() : 'N/A';
      const horaFin = res.fecha ? new Date(res.fecha).toLocaleTimeString() : 'N/A';
      const salidas = res.tabSwitchCount !== undefined ? res.tabSwitchCount : 0;

      html += `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px;">${res.studentName}</td>
          <td style="padding: 10px; text-align: center; color: #555;">${res.studentGroup || '-'}</td>
          <td style="padding: 10px; text-align: center; font-weight: bold; color: #28a745;">${res.puntajeObtenido} / ${res.puntajeTotal}</td>
          <td style="padding: 10px; text-align: center; color: ${salidas > 0 ? '#d9534f' : '#28a745'}; font-weight: bold;">${salidas} veces</td>
          <td style="padding: 10px; text-align: center; color: #666; font-size: 0.8rem;">${horaInicio} - ${horaFin}</td>
          <td style="padding: 10px; text-align: center;">
            <button class="btn btn-secondary-sm" onclick="descargarExcelIndividual('${res.id}')">📄 Descargar Detalle</button>
          </td>
        </tr>
      `;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
  });
}

function descargarExcelGeneral(examId) {
  database.ref("examenes/" + examId).once("value", examSnap => {
    const examenInfo = examSnap.val() || {};
    const fechaLimiteStr = examenInfo.deadline ? new Date(examenInfo.deadline).toLocaleString() : "Sin límite";

    database.ref("resultados").orderByChild("examId").equalTo(examId).once("value", snapshot => {
      const datosTabla = [];
      
      snapshot.forEach(child => {
        const r = child.val();
        datosTabla.push({
          "Estudiante": r.studentName,
          "Grupo": r.studentGroup || "N/A",
          "Puntaje Obtenido": r.puntajeObtenido,
          "Puntaje Total": r.puntajeTotal,
          "Hora de Inicio": r.startTime ? new Date(r.startTime).toLocaleTimeString() : "N/A",
          "Hora de Finalización": r.fecha ? new Date(r.fecha).toLocaleTimeString() : "N/A",
          "Veces que salió (Anti-Cheat)": r.tabSwitchCount !== undefined ? r.tabSwitchCount : 0,
          "Plazo Límite del Examen": fechaLimiteStr,
          "Fecha de Presentación": r.fecha ? new Date(r.fecha).toLocaleDateString() : "N/A"
        });
      });

      if (datosTabla.length === 0) {
        alert("No hay datos para exportar.");
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(datosTabla);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Resultados Generales");

      XLSX.writeFile(workbook, `Reporte_General_Examen_${examId}.xlsx`);
    });
  });
}

function descargarExcelIndividual(resultadoKey) {
  database.ref("resultados/" + resultadoKey).once("value", snapshot => {
    const r = snapshot.val();
    if (!r) {
      alert("No se encontró el detalle de este resultado.");
      return;
    }

    const detallePreguntas = [];
    if (r.respuestas && Array.isArray(r.respuestas)) {
      r.respuestas.forEach((resp, idx) => {
        detallePreguntas.push({
          "N° Pregunta": idx + 1,
          "Enunciado": resp.enunciado,
          "Tiempo Invertido (segundos)": resp.tiempoSegundos !== undefined ? resp.tiempoSegundos : 0,
          "Respuesta del Estudiante": resp.respuesta !== null ? resp.respuesta : "Sin responder",
          "¿Está Correcta?": resp.esCorrecta ? "Sí" : "No",
          "Puntuación Aportada à la Nota": resp.puntuacionAportada !== undefined ? resp.puntuacionAportada : 0
        });
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(detallePreguntas);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Detalle Pregunta a Pregunta");

    XLSX.writeFile(workbook, `Reporte_${r.studentName.replace(/\s+/g, '_')}_Detalle.xlsx`);
  });
}

// ==========================================
// RESUMEN INDIVIDUAL PARA EL ESTUDIANTE
// ==========================================
function mostrarResumenIndividualEstudiante(examenId, intentoEstudiante) {
  const examExecutionView = document.getElementById('studentExamExecutionView');
  if (examExecutionView) examExecutionView.classList.add('hidden');
  
  const studentResultSection = document.getElementById('studentResultSection'); 
  if (studentResultSection) {
    studentResultSection.classList.remove('hidden');
  }

  const totalPreguntas = intentoEstudiante.detallesPreguntas.length;
  const respuestasCorrectas = intentoEstudiante.detallesPreguntas.filter(p => p.esCorrecta).length;
  const calificacion = intentoEstudiante.calificacion;
  const tiempoEmpleado = intentoEstudiante.tiempoEmpleadoTexto || "N/A";
  const horaInicio = intentoEstudiante.horaInicio || "N/A";
  const horaFin = intentoEstudiante.horaFin || "N/A";

  let htmlResumen = `
    <div class="card shadow-sm p-4 mb-4" style="background: #fff; border-radius: 8px; border: 1px solid #ddd;">
      <h3 style="color: #007bff; margin-bottom: 15px;">📊 Resumen de tu Evaluación</h3>
      <hr>
      <div style="display: flex; gap: 20px; margin-bottom: 15px; flex-wrap: wrap;">
        <div><strong>Calificación:</strong> <span style="background: #28a745; color: white; padding: 2px 8px; border-radius: 4px;">${calificacion}</span></div>
        <div><strong>Aciertos:</strong> ${respuestasCorrectas} de ${totalPreguntas}</div>
        <div><strong>Tiempo empleado:</strong> ${tiempoEmpleado}</div>
      </div>
      <div style="margin-bottom: 20px; color: #666; font-size: 0.85rem;">
        <div>Hora de inicio: ${horaInicio} | Hora de entrega: ${horaFin}</div>
      </div>

      <h4 style="margin-bottom: 15px;">Desglose Detallado Pregunta por Pregunta:</h4>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="background: #343a40; color: white;">
              <th style="padding: 10px;">#</th>
              <th style="padding: 10px;">Pregunta</th>
              <th style="padding: 10px;">Tu Respuesta</th>
              <th style="padding: 10px;">Respuesta Correcta</th>
              <th style="padding: 10px;">Estado</th>
              <th style="padding: 10px;">Tiempo</th>
            </tr>
          </thead>
          <tbody>
  `;

  intentoEstudiante.detallesPreguntas.forEach((det, index) => {
    const badgeEstado = det.esCorrecta 
      ? '<span style="color: #28a745; font-weight: bold;">Correcta</span>' 
      : '<span style="color: #dc3545; font-weight: bold;">Incorrecta</span>';

    htmlResumen += `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px;">${index + 1}</td>
        <td style="padding: 10px;">${det.textoPregunta}</td>
        <td style="padding: 10px;">${det.respuestaEstudiante || '(Sin responder)'}</td>
        <td style="padding: 10px;">${det.respuestaCorrecta}</td>
        <td style="padding: 10px;">${badgeEstado}</td>
        <td style="padding: 10px;">${det.tiempoEmpleadoPregunta || 'N/A'}</td>
      </tr>
    `;
  });

  htmlResumen += `
          </tbody>
        </table>
      </div>

      <div style="text-align: center; margin-top: 20px;">
        <button class="btn btn-primary" onclick="volverAlDashboardEstudiante()">Volver al Panel Principal</button>
      </div>
    </div>
  `;

  if (studentResultSection) {
    studentResultSection.innerHTML = htmlResumen;
  }
}

function volverAlDashboardEstudiante() {
  const studentResultSection = document.getElementById('studentResultSection');
  if (studentResultSection) studentResultSection.classList.add('hidden');
  
  const studentDashboard = document.getElementById('studentDashboardView');
  if (studentDashboard) studentDashboard.classList.remove('hidden');
  
  cargarExamenesEstudiante();
}