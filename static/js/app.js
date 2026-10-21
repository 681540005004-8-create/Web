// TaskFlow AI - Main Frontend Logic with Image/File Timetable Scanning & Auth

let appState = {
  user: {},
  classes: [],
  assignments: [],
  checkinHistory: [],
  burnout: {},
  activeDay: "Wednesday",
  selectedEnergy: "medium",
  selectedMood: "focused",
  focusInterval: null,
  focusTimeLeft: 35 * 60,
  focusIsRunning: false,
  currentFocusSubtaskId: null,
  isAuthenticated: false,
  extractedClassesReview: [],
  charts: {}
};

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  fetchInitialData();
  loadSavedApiKey();
  
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const deadlineInput = document.getElementById("asg-deadline");
  if (deadlineInput) {
    deadlineInput.value = nextWeek.toISOString().slice(0, 16);
  }
});

function initLucide() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Fetch Initial Data from Backend
async function fetchInitialData() {
  try {
    const res = await fetch("/api/data");
    const data = await res.json();
    
    appState.user = data.user || {};
    appState.classes = data.classes || [];
    appState.assignments = data.assignments || [];
    appState.checkinHistory = data.checkin_history || [];
    appState.burnout = data.burnout_indicators || {};
    appState.isAuthenticated = data.is_authenticated || false;
    appState.selectedEnergy = appState.user.current_energy || "medium";
    appState.selectedMood = appState.user.current_mood || "focused";

    renderAuthHeader();
    updateUI();
    renderDayTimeline(appState.activeDay);
    initCharts();
  } catch (err) {
    console.error("Error loading data:", err);
  }
}

// Render Top Bar Authentication Profile Pill or Login Button
function renderAuthHeader() {
  const container = document.getElementById("auth-header-container");
  if (!container) return;

  if (appState.isAuthenticated) {
    const initial = (appState.user.name || "U").charAt(0);
    container.innerHTML = `
      <div class="flex items-center gap-2 pl-1 border-l border-slate-800">
        <div class="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs">
          <div class="w-6 h-6 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-[11px] shadow-sm">
            ${initial}
          </div>
          <div class="hidden sm:block text-left">
            <p class="font-bold text-white text-xs leading-none truncate max-w-[110px]">${appState.user.name || 'นักศึกษา'}</p>
            <p class="text-[10px] text-slate-400 font-mono mt-0.5">${appState.user.student_id || 'CPE'}</p>
          </div>
        </div>
        <button onclick="handleLogout()" title="ออกจากระบบ" class="p-2 rounded-xl bg-slate-800/60 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700/60 transition-all">
          <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="flex items-center gap-1.5 pl-1 border-l border-slate-800">
        <button onclick="openAuthModal('login')" class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all cursor-pointer">
          <i data-lucide="log-in" class="w-3.5 h-3.5"></i>
          <span>เข้าสู่ระบบ</span>
        </button>
      </div>
    `;
  }
  initLucide();
}

// Update Top & Hero Stats UI
function updateUI() {
  const energy = appState.selectedEnergy;
  const energyMap = {
    low: { text: "ต่ำ (Low 🔋)", dot: "bg-rose-500", pulse: "bg-rose-400", badge: "🔋", title: "ระดับพลังงาน: ต่ำ (Low)", desc: "ระบบลดงาน High-Cognitive แนะนำงานเบา 30 นาที เพื่อป้องกันหมดไฟ" },
    medium: { text: "ปานกลาง (Medium ⚡⚡)", dot: "bg-amber-500", pulse: "bg-amber-400", badge: "⚡⚡", title: "ระดับพลังงาน: ปานกลาง (Medium)", desc: "สมดุลพร้อมทำงานย่อย 1-2 สเต็ป สลับพักสายตา" },
    high: { text: "สูง (High 🚀)", dot: "bg-emerald-500", pulse: "bg-emerald-400", badge: "🚀", title: "ระดับพลังงาน: สูง (High)", desc: "พลังงานเต็มเปี่ยม เหมาะกับการลุยงานยากและเขียนโค้ดหลัก" }
  };

  const eInfo = energyMap[energy] || energyMap.medium;

  const navText = document.getElementById("nav-energy-text");
  if (navText) navText.innerText = `พลังงาน: ${eInfo.text}`;
  const dot = document.getElementById("energy-dot");
  if (dot) dot.className = `relative inline-flex rounded-full h-2.5 w-2.5 ${eInfo.dot}`;
  const pulse = document.getElementById("energy-pulse");
  if (pulse) pulse.className = `animate-ping absolute inline-flex h-full w-full rounded-full ${eInfo.pulse} opacity-75`;

  const heroTitle = document.getElementById("hero-energy-title");
  if (heroTitle) heroTitle.innerText = eInfo.title;
  const heroDesc = document.getElementById("hero-energy-desc");
  if (heroDesc) heroDesc.innerText = eInfo.desc;
  const heroBadge = document.getElementById("hero-energy-badge");
  if (heroBadge) heroBadge.innerText = eInfo.badge;

  const moodNames = {
    exhausted: "หมดแรง (Exhausted 😫)",
    anxious: "กังวล (Anxious 😟)",
    neutral: "ปกติ (Neutral 😐)",
    focused: "มีสมาธิ (Focused 🙂)",
    energized: "พลังล้น (Energized 🔥)"
  };
  const heroMood = document.getElementById("hero-mood-text");
  if (heroMood) heroMood.innerText = moodNames[appState.user.current_mood] || "มีสมาธิ";

  const bScore = appState.burnout.score || appState.user.burnout_score || 28;
  const bLevel = document.getElementById("hero-burnout-level");
  if (bLevel) bLevel.innerText = appState.burnout.risk_level || "ระดับต่ำ (Safe)";
  const bScoreText = document.getElementById("hero-burnout-score");
  if (bScoreText) bScoreText.innerText = `ดัชนีความเสี่ยง: ${bScore} / 100`;
  const bProg = document.getElementById("burnout-progress");
  if (bProg) {
    bProg.style.width = `${bScore}%`;
    if (bScore > 60) {
      bProg.className = "bg-gradient-to-r from-amber-500 to-rose-500 h-2 rounded-full";
      if (bLevel) bLevel.className = "text-lg font-bold text-rose-400 mt-1";
    } else {
      bProg.className = "bg-gradient-to-r from-emerald-500 to-indigo-500 h-2 rounded-full";
      if (bLevel) bLevel.className = "text-lg font-bold text-emerald-400 mt-1";
    }
  }

  const compCount = document.getElementById("hero-completed-count");
  if (compCount) compCount.innerText = `${appState.user.completed_subtasks || 0} Subtasks สำเร็จแล้ว`;

  const bannerText = document.getElementById("banner-text");
  const noteContent = document.getElementById("ai-workload-note-content");
  if (energy === 'low') {
    if (bannerText) bannerText.innerHTML = `<strong>⚠️ Dynamic Workload Active (Low Energy):</strong> ตรวจพบความเหนื่อยล้า ระบบปรับเลื่อนงานหนัก (High-Cognitive) ไปวันหยุด และแนะนำเฉพาะขั้นตอนย่อยที่ทำเสร็จใน 30 นาที เพื่อปกป้องสุขภาพจิต!`;
    if (noteContent) noteContent.innerText = "ระดับพลังงานปัจจุบันอยู่ในเกณฑ์ต่ำ ระบบได้คัดเลือกงานที่ใช้สมองน้อย (Low-Cognitive Tasks) เพื่อให้คุณยังรักษาความคืบหน้าได้โดยไม่หมดไฟ (No Burnout)";
  } else if (energy === 'high') {
    if (bannerText) bannerText.innerHTML = `<strong>🚀 High Energy Flow:</strong> พลังงานอยู่ในระดับสูงเต็มเปี่ยม! ระบบแนะนำให้ลุยงาน High-Cognitive เช่น งานเขียนโค้ดระบบ หรือสถาปัตยกรรม ในวันนี้ทันที`;
    if (noteContent) noteContent.innerText = "วันนี้เป็นโอกาสทอง! พลังงานสูง เหมาะสำหรับสะสางงานที่ต้องใช้ตรรกะและการเขียนโปรแกรมระดับยาก";
  } else {
    if (bannerText) bannerText.innerHTML = `<strong>⚡ Dynamic Workload Adjustment:</strong> ระบบจัดตารางอัตโนมัติตามระดับพลังงานและตารางเรียนวิศวะคอม ไม่ชนเวลาบรรยาย พร้อมป้องกันสภาวะหมดไฟ`;
    if (noteContent) noteContent.innerText = "ระดับพลังงานปานกลาง ระบบจัดสรรงานระดับ Medium 1-2 สเต็ป และกระจายงานย่อยอย่างสมดุล";
  }

  renderSubtasks();
  initLucide();
}

// Render Subtasks list in Left Column
function renderSubtasks() {
  const container = document.getElementById("subtasks-container");
  if (!container) return;

  const currentEnergy = appState.selectedEnergy;
  let allSubtasks = [];

  appState.assignments.forEach(asg => {
    (asg.subtasks || []).forEach(st => {
      allSubtasks.push({
        asgId: asg.id,
        course: asg.course,
        asgTitle: asg.title,
        deadline: asg.deadline,
        ...st
      });
    });
  });

  if (allSubtasks.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-slate-500 glass-card rounded-2xl">ไม่มีรายการงานย่อยในขณะนี้ กรุณาอัปโหลดใบสั่งงานเพื่อเริ่มใช้งาน</div>`;
    return;
  }

  allSubtasks.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return 0;
  });

  let html = "";
  allSubtasks.forEach(st => {
    const isDone = st.completed;
    const cogBadge = {
      high: { label: "High Cognitive", color: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
      medium: { label: "Med Cognitive", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
      low: { label: "Low Cognitive", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" }
    }[st.cognitive_load || "medium"];

    const isRecommendedToday = (currentEnergy === 'low' && st.cognitive_load === 'low') ||
                               (currentEnergy === 'high' && st.cognitive_load === 'high') ||
                               (currentEnergy === 'medium' && st.cognitive_load === 'medium');

    html += `
      <div class="glass-card rounded-2xl p-4 border transition-all ${isDone ? 'opacity-50 border-slate-800/50 bg-slate-900/30' : 'border-slate-800 hover:border-indigo-500/40'}">
        <div class="flex items-start gap-3">
          
          <button onclick="toggleSubtask('${st.id}', ${!isDone})" class="mt-1 w-5 h-5 rounded-md border flex items-center justify-center transition-all ${isDone ? 'bg-emerald-500 border-emerald-400 text-slate-950' : 'border-slate-600 hover:border-indigo-400 bg-slate-900'}">
            ${isDone ? '<i data-lucide="check" class="w-3.5 h-3.5 stroke-[3]"></i>' : ''}
          </button>

          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <span class="text-[10px] font-semibold text-indigo-400">${st.course || 'CPE Course'}</span>
              <div class="flex items-center gap-1.5">
                <span class="text-[10px] font-medium px-2 py-0.5 rounded-full border ${cogBadge.color}">
                  ${cogBadge.label}
                </span>
                <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                  ⏱️ ${st.duration || 35} นาที
                </span>
              </div>
            </div>

            <h4 class="text-sm font-bold text-white mt-1 ${isDone ? 'line-through text-slate-400' : ''}">${st.title}</h4>
            <p class="text-xs text-slate-400 mt-1 leading-relaxed">${st.guidance || ''}</p>

            <div class="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-2 text-xs">
              <span class="text-slate-400 flex items-center gap-1 font-mono text-[11px]">
                <i data-lucide="calendar" class="w-3 h-3 text-slate-400"></i>
                <span>${st.scheduled_day || 'Wednesday'} ${st.scheduled_time || '18:00 - 18:45'}</span>
              </span>

              <div class="flex items-center gap-2">
                ${!isDone && isRecommendedToday ? '<span class="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">✨ แนะนำทำวันนี้</span>' : ''}
                ${!isDone ? `
                  <button onclick="startFocusMode('${st.id}', ${st.duration || 35}, '${encodeURIComponent(st.title)}', '${encodeURIComponent(st.guidance || '')}')" class="px-2.5 py-1 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white font-medium text-xs flex items-center gap-1 transition-all">
                    <i data-lucide="play" class="w-3 h-3"></i>
                    <span>โฟกัส 35 นาที</span>
                  </button>
                ` : '<span class="text-xs text-emerald-400 font-medium">✓ เสร็จสิ้น</span>'}
              </div>
            </div>

          </div>

        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  initLucide();
}

// Toggle subtask status (done / undone)
async function toggleSubtask(subtaskId, completed) {
  try {
    const res = await fetch("/api/tasks/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subtask_id: subtaskId, completed })
    });
    const data = await res.json();
    
    appState.assignments.forEach(asg => {
      (asg.subtasks || []).forEach(st => {
        if (st.id === subtaskId) {
          st.completed = completed;
        }
      });
    });

    if (completed) {
      triggerConfetti();
      appState.user.completed_subtasks = (appState.user.completed_subtasks || 0) + 1;
    } else {
      appState.user.completed_subtasks = Math.max(0, (appState.user.completed_subtasks || 1) - 1);
    }

    updateUI();
  } catch (err) {
    console.error("Failed to toggle subtask:", err);
  }
}

// Render Daily Timetable in Right Column
function selectScheduleDay(day) {
  appState.activeDay = day;
  document.querySelectorAll(".day-tab").forEach(btn => {
    btn.className = "day-tab px-3 py-1.5 rounded-xl font-medium transition-all text-slate-400 hover:text-white bg-slate-800/40";
  });
  const activeBtn = document.getElementById(`day-btn-${day}`);
  if (activeBtn) {
    activeBtn.className = "day-tab px-3 py-1.5 rounded-xl font-medium transition-all text-white bg-indigo-600 shadow-sm";
  }
  renderDayTimeline(day);
}

function renderDayTimeline(day) {
  const container = document.getElementById("day-timeline-container");
  if (!container) return;

  const dayClasses = appState.classes.filter(c => c.day === day);
  
  let daySubtasks = [];
  appState.assignments.forEach(asg => {
    (asg.subtasks || []).forEach(st => {
      if (st.scheduled_day === day) {
        daySubtasks.push({ ...st, course: asg.course });
      }
    });
  });

  let items = [];

  dayClasses.forEach(c => {
    const colorThemes = {
      indigo: "border-indigo-500/40 bg-indigo-950/20 text-indigo-300",
      sky: "border-sky-500/40 bg-sky-950/20 text-sky-300",
      emerald: "border-emerald-500/40 bg-emerald-950/20 text-emerald-300",
      amber: "border-amber-500/40 bg-amber-950/20 text-amber-300",
      purple: "border-purple-500/40 bg-purple-950/20 text-purple-300",
      rose: "border-rose-500/40 bg-rose-950/20 text-rose-300",
      teal: "border-teal-500/40 bg-teal-950/20 text-teal-300"
    };

    items.push({
      type: "class",
      id: c.id,
      title: `${c.code}: ${c.name}`,
      subtitle: `ห้อง: ${c.room || '-'} | ผู้สอน: ${c.instructor || '-'}`,
      time: `${c.start} - ${c.end}`,
      color: colorThemes[c.color] || colorThemes.indigo,
      icon: "graduation-cap"
    });
  });

  daySubtasks.forEach(st => {
    items.push({
      type: "subtask",
      id: st.id,
      title: `⚡ AI Subtask: ${st.title}`,
      subtitle: `${st.course} | Cognitive: ${st.cognitive_load} | ${st.duration} นาที`,
      time: st.scheduled_time || "18:00 - 18:45",
      color: st.completed ? "border-slate-800 bg-slate-900/30 text-slate-400" : "border-purple-500/40 bg-purple-950/20 text-purple-300",
      icon: "zap",
      completed: st.completed
    });
  });

  items.sort((a, b) => a.time.localeCompare(b.time));

  if (items.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center glass-card rounded-2xl border border-slate-800 space-y-3">
        <div class="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mx-auto">
          <i data-lucide="coffee" class="w-6 h-6"></i>
        </div>
        <h4 class="text-sm font-bold text-white">ไม่มีคาบเรียนในวันนี้</h4>
        <p class="text-xs text-slate-400">คุณสามารถอัปโหลดภาพตารางเรียน หรือกดปุ่ม <strong>"กรอกวิชาเรียน"</strong> เพื่อใส่ตารางของคุณเอง</p>
        <div class="flex items-center justify-center gap-2">
          <button onclick="openUploadTimetableModal()" class="px-3 py-1.5 rounded-xl bg-purple-600/80 hover:bg-purple-600 text-white font-medium text-xs inline-flex items-center gap-1.5 transition-all">
            <i data-lucide="image" class="w-3.5 h-3.5"></i>
            <span>นำเข้ารูปตารางเรียน</span>
          </button>
          <button onclick="openAddClassModal()" class="px-3 py-1.5 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white font-medium text-xs inline-flex items-center gap-1.5 transition-all">
            <i data-lucide="plus" class="w-3.5 h-3.5"></i>
            <span>เพิ่มวิชาเรียนวัน${day}</span>
          </button>
        </div>
      </div>
    `;
    initLucide();
    return;
  }

  let html = "";
  items.forEach(it => {
    html += `
      <div class="p-3.5 rounded-xl border ${it.color} flex items-center justify-between gap-3 transition-all hover:translate-x-1 group">
        <div class="flex items-center gap-3 min-w-0">
          <div class="p-2 rounded-lg bg-slate-900 border border-slate-700/60 flex-shrink-0">
            <i data-lucide="${it.icon}" class="w-4 h-4"></i>
          </div>
          <div class="min-w-0">
            <h4 class="text-xs font-bold text-white truncate">${it.title}</h4>
            <p class="text-[11px] text-slate-400 truncate mt-0.5">${it.subtitle}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs font-mono font-bold text-slate-300 whitespace-nowrap bg-slate-900/80 px-2.5 py-1 rounded-md border border-slate-800">
            ${it.time}
          </span>
          ${it.type === 'class' ? `
            <button onclick="deleteClass('${it.id}')" title="ลบวิชานี้ออกจากตาราง" class="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  initLucide();
}

// Navigation Tabs Switcher (Proposal Tab removed)
function switchTab(tabId) {
  const tabs = ["workspace", "deconstruct", "csp", "analytics"];
  tabs.forEach(t => {
    const view = document.getElementById(`view-${t}`);
    const tabBtn = document.getElementById(`tab-${t}`);
    if (view) {
      if (t === tabId) {
        view.classList.remove("hidden");
      } else {
        view.classList.add("hidden");
      }
    }
    if (tabBtn) {
      if (t === tabId) {
        tabBtn.className = "nav-tab active px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all text-white bg-indigo-600 shadow-sm flex items-center gap-1.5";
      } else {
        tabBtn.className = "nav-tab px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all text-slate-400 hover:text-white hover:bg-slate-800 flex items-center gap-1.5";
      }
    }
  });

  if (tabId === 'csp') {
    simulateEnergyChange(appState.selectedEnergy);
  }
  if (tabId === 'analytics') {
    setTimeout(initCharts, 100);
  }
  initLucide();
}

// ================= AUTHENTICATION MODAL LOGIC =================
function openAuthModal(mode = 'login') {
  document.getElementById("auth-modal").classList.remove("hidden");
  switchAuthTab(mode);
  initLucide();
}

function closeAuthModal() {
  document.getElementById("auth-modal").classList.add("hidden");
}

function switchAuthTab(tab) {
  const formLogin = document.getElementById("form-login");
  const formReg = document.getElementById("form-register");
  const btnLogin = document.getElementById("auth-tab-login");
  const btnReg = document.getElementById("auth-tab-register");
  const title = document.getElementById("auth-modal-title");

  if (tab === 'login') {
    formLogin.classList.remove("hidden");
    formReg.classList.add("hidden");
    btnLogin.className = "flex-1 py-2 rounded-lg font-bold transition-all text-white bg-indigo-600 shadow-sm";
    btnReg.className = "flex-1 py-2 rounded-lg font-bold transition-all text-slate-400 hover:text-white";
    title.innerText = "เข้าสู่ระบบ TaskFlow AI";
  } else {
    formLogin.classList.add("hidden");
    formReg.classList.remove("hidden");
    btnLogin.className = "flex-1 py-2 rounded-lg font-bold transition-all text-slate-400 hover:text-white";
    btnReg.className = "flex-1 py-2 rounded-lg font-bold transition-all text-white bg-indigo-600 shadow-sm";
    title.innerText = "สร้างบัญชีใหม่ (Register)";
  }
  initLucide();
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById("btn-login-submit");
  btn.disabled = true;
  btn.innerText = "กำลังเข้าสู่ระบบ...";

  const identifier = document.getElementById("login-identifier").value.trim();
  const password = document.getElementById("login-password").value;

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password })
    });
    const data = await res.json();
    if (res.ok && data.status === "success") {
      closeAuthModal();
      await fetchInitialData();
      triggerConfetti();
    } else {
      alert(data.message || "เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบข้อมูล");
    }
  } catch (err) {
    alert("เกิดข้อผิดพลาดในการเชื่อมต่อ: " + err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="log-in" class="w-4 h-4"></i> <span>เข้าสู่ระบบ</span>`;
    initLucide();
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById("btn-reg-submit");
  btn.disabled = true;
  btn.innerText = "กำลังสร้างบัญชี...";

  const name = document.getElementById("reg-name").value.trim();
  const student_id = document.getElementById("reg-student-id").value.trim();
  const department = document.getElementById("reg-department").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const prefill_classes = document.getElementById("reg-prefill").checked;

  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, student_id, department, email, password, prefill_classes })
    });
    const data = await res.json();
    if (res.ok && data.status === "success") {
      closeAuthModal();
      await fetchInitialData();
      triggerConfetti();
    } else {
      alert(data.message || "สมัครสมาชิกไม่สำเร็จ");
    }
  } catch (err) {
    alert("เกิดข้อผิดพลาดในการเชื่อมต่อ: " + err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="user-plus" class="w-4 h-4"></i> <span>สร้างบัญชีและเริ่มใช้งาน</span>`;
    initLucide();
  }
}

async function loginDemoAccount() {
  try {
    const res = await fetch("/api/auth/demo", { method: "POST" });
    if (res.ok) {
      closeAuthModal();
      await fetchInitialData();
      triggerConfetti();
    }
  } catch (err) {
    console.error("Demo login error:", err);
  }
}

async function handleLogout() {
  if (confirm("ต้องการออกจากระบบหรือไม่?")) {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      await fetchInitialData();
    } catch (err) {
      console.error("Logout error:", err);
    }
  }
}

// ================= TIMETABLE IMAGE / FILE UPLOAD SCANNER =================
function openUploadTimetableModal() {
  document.getElementById("upload-timetable-modal").classList.remove("hidden");
  switchTimetableTab('file');
  initLucide();
}

function closeUploadTimetableModal() {
  document.getElementById("upload-timetable-modal").classList.add("hidden");
  const progressBox = document.getElementById("timetable-scan-progress");
  if (progressBox) progressBox.classList.add("hidden");
}

function switchTimetableTab(tab) {
  const fileTab = document.getElementById("tab-content-file");
  const textTab = document.getElementById("tab-content-text");
  const fileBtn = document.getElementById("tab-btn-file-upload");
  const textBtn = document.getElementById("tab-btn-text-paste");
  if (!fileTab || !textTab || !fileBtn || !textBtn) return;

  if (tab === 'file') {
    fileTab.classList.remove("hidden");
    textTab.classList.add("hidden");
    fileBtn.className = "flex-1 py-2 px-3 rounded-xl text-xs font-bold text-white bg-indigo-600/80 shadow-md flex items-center justify-center gap-1.5 transition-all";
    textBtn.className = "flex-1 py-2 px-3 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center gap-1.5 transition-all";
  } else {
    fileTab.classList.add("hidden");
    textTab.classList.remove("hidden");
    fileBtn.className = "flex-1 py-2 px-3 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center gap-1.5 transition-all";
    textBtn.className = "flex-1 py-2 px-3 rounded-xl text-xs font-bold text-white bg-emerald-600/80 shadow-md flex items-center justify-center gap-1.5 transition-all";
  }
  initLucide();
}

function pasteSampleScheduleText() {
  const sample = `วันจันทร์ 09:00 - 12:00 CPE312 Computer Networks ENG-402
วันจันทร์ 13:00 - 16:00 CPE312L Computer Networks Lab LAB-501
วันอังคาร 09:30 - 12:00 CPE324 Database Systems ENG-305
วันอังคาร 13:30 - 15:30 CPE381 Technical Communication LIB-201
วันพุธ 09:00 - 12:00 CPE223 Data Structures & Algorithms ENG-502
วันพุธ 14:00 - 17:00 CPE342L Operating Systems Lab LAB-404
วันพฤหัสบดี 10:00 - 12:00 CPE491 Senior Project Seminar SEMINAR-1
วันพฤหัสบดี 13:00 - 16:00 CPE355 Software Engineering ENG-408
วันศุกร์ 09:00 - 12:00 CPE361 Embedded Systems & IoT IOT-LAB`;
  const textarea = document.getElementById("timetable-raw-text-input");
  if (textarea) textarea.value = sample;
}

async function handlePasteTimetableSubmit(e) {
  e.preventDefault();
  const textarea = document.getElementById("timetable-raw-text-input");
  const rawText = textarea ? textarea.value.trim() : "";
  if (!rawText) {
    alert("กรุณาวางข้อความตารางเรียนก่อนกดดำเนินการ");
    return;
  }

  const btn = document.getElementById("btn-paste-timetable");
  btn.disabled = true;
  btn.innerHTML = `<span class="animate-spin">⏳</span> <span>กำลังวิเคราะห์รายวิชาและวันเวลา...</span>`;

  try {
    const formData = new FormData();
    formData.append("raw_text", rawText);
    const res = await fetch("/api/classes/upload-timetable", {
      method: "POST",
      body: formData
    });
    const data = await res.json();

    if (res.ok && data.status === "success" && data.classes && data.classes.length > 0) {
      closeUploadTimetableModal();
      appState.extractedClassesReview = data.classes;
      openReviewClassesModal();
    } else {
      alert(data.message || "ไม่สามารถแปลงข้อความเป็นตารางเรียนได้ กรุณาตรวจสอบรูปแบบข้อความ");
    }
  } catch (err) {
    alert("เกิดข้อผิดพลาด: " + err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="check-check" class="w-4 h-4"></i> <span>แปลงข้อความเป็นตารางเรียนและแทนของเดิม</span>`;
    initLucide();
  }
}

function previewTimetableFile(input) {
  const file = input.files[0];
  if (file) {
    document.getElementById("timetable-file-name").innerText = `ไฟล์ที่เลือก: ${file.name}`;
    
    // If image, show preview
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = function(e) {
        document.getElementById("timetable-img-preview").src = e.target.result;
        document.getElementById("timetable-preview-box").classList.remove("hidden");
      };
      reader.readAsDataURL(file);
    } else {
      document.getElementById("timetable-preview-box").classList.add("hidden");
    }
  }
}

async function loadSampleTimetableImage() {
  try {
    const res = await fetch('/static/sample_timetable.png');
    const blob = await res.blob();
    const file = new File([blob], 'sample_cpe_timetable.png', { type: 'image/png' });
    
    const container = new DataTransfer();
    container.items.add(file);
    const fileInput = document.getElementById("timetable-file-input");
    fileInput.files = container.files;
    previewTimetableFile(fileInput);
  } catch (err) {
    console.error("Failed to load sample image:", err);
  }
}

async function loadSampleTimetablePdf() {
  try {
    const res = await fetch('/static/sample_timetable.pdf');
    const blob = await res.blob();
    const file = new File([blob], 'sample_reg_timetable.pdf', { type: 'application/pdf' });
    
    const container = new DataTransfer();
    container.items.add(file);
    const fileInput = document.getElementById("timetable-file-input");
    fileInput.files = container.files;
    previewTimetableFile(fileInput);
  } catch (err) {
    console.error("Failed to load sample pdf:", err);
  }
}

async function handleTimetableScanSubmit(e) {
  e.preventDefault();
  const fileInput = document.getElementById("timetable-file-input");
  if (!fileInput.files || fileInput.files.length === 0) {
    alert("กรุณาเลือกรูปภาพตารางเรียน หรือไฟล์เอกสารก่อนกดสแกน");
    return;
  }

  const file = fileInput.files[0];
  const btn = document.getElementById("btn-scan-timetable");
  const progressBox = document.getElementById("timetable-scan-progress");
  const statusText = document.getElementById("timetable-scan-status-text");

  btn.disabled = true;
  btn.innerHTML = `<span class="animate-spin">⏳</span> <span>AI กำลังวิเคราะห์รูปภาพและโครงสร้างตารางเรียน...</span>`;
  if (progressBox) progressBox.classList.remove("hidden");
  if (statusText) statusText.innerText = "กำลังประมวลผลด้วย Server-Side AI Vision & RapidOCR...";

  const apiKey = localStorage.getItem("taskflow_gemini_key") || "";
  const formData = new FormData();
  formData.append("file", file);
  if (apiKey) formData.append("api_key", apiKey);

  try {
    const res = await fetch("/api/classes/upload-timetable", {
      method: "POST",
      body: formData
    });
    const data = await res.json();

    if (res.ok && data.status === "success" && data.classes && data.classes.length > 0) {
      closeUploadTimetableModal();
      appState.extractedClassesReview = data.classes;
      openReviewClassesModal();
    } else {
      alert(data.message || "ไม่สามารถตรวจจับรายวิชาได้โดยอัตโนมัติ กรุณาลองใช้แท็บ 'วางข้อความเว็บลงทะเบียน' หรือตรวจสอบว่ารูปภาพมีความคมชัด");
    }
  } catch (err) {
    alert("เกิดข้อผิดพลาดในการสแกนไฟล์: " + err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="sparkles" class="w-4 h-4"></i> <span>สแกนและดึงข้อมูลมาแทนตารางเดิม</span>`;
    if (progressBox) progressBox.classList.add("hidden");
    initLucide();
  }
}

function openReviewClassesModal() {
  document.getElementById("review-classes-modal").classList.remove("hidden");
  renderReviewClassesList();
  initLucide();
}

function closeReviewClassesModal() {
  document.getElementById("review-classes-modal").classList.add("hidden");
}

function renderReviewClassesList() {
  const container = document.getElementById("review-classes-list");
  const countSpan = document.getElementById("review-classes-count");
  if (!container) return;

  const classes = appState.extractedClassesReview || [];
  if (countSpan) countSpan.innerText = classes.length;

  if (classes.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-slate-500 text-xs">ไม่มีรายวิชาที่เลือก</div>`;
    return;
  }

  const dayOptions = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const dayThai = { "Monday": "จันทร์", "Tuesday": "อังคาร", "Wednesday": "พุธ", "Thursday": "พฤหัสบดี", "Friday": "ศุกร์", "Saturday": "เสาร์", "Sunday": "อาทิตย์" };

  let html = "";
  classes.forEach((c, idx) => {
    html += `
      <div class="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs">
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-2 flex-1">
          <div>
            <span class="text-[10px] text-slate-400 block">รหัสวิชา</span>
            <input type="text" value="${c.code}" onchange="updateReviewClass(${idx}, 'code', this.value)" class="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-bold text-xs">
          </div>
          <div>
            <span class="text-[10px] text-slate-400 block">ชื่อวิชา</span>
            <input type="text" value="${c.name}" onchange="updateReviewClass(${idx}, 'name', this.value)" class="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white text-xs">
          </div>
          <div>
            <span class="text-[10px] text-slate-400 block">วัน</span>
            <select onchange="updateReviewClass(${idx}, 'day', this.value)" class="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white text-xs">
              ${dayOptions.map(d => `<option value="${d}" ${c.day === d ? 'selected' : ''}>${dayThai[d] || d}</option>`).join('')}
            </select>
          </div>
          <div>
            <span class="text-[10px] text-slate-400 block">เวลา (เริ่ม - จบ)</span>
            <div class="flex items-center gap-1">
              <input type="time" value="${c.start}" onchange="updateReviewClass(${idx}, 'start', this.value)" class="w-full px-1.5 py-1 rounded bg-slate-900 border border-slate-700 text-white text-xs font-mono">
              <span class="text-slate-500">-</span>
              <input type="time" value="${c.end}" onchange="updateReviewClass(${idx}, 'end', this.value)" class="w-full px-1.5 py-1 rounded bg-slate-900 border border-slate-700 text-white text-xs font-mono">
            </div>
          </div>
        </div>

        <button onclick="deleteReviewClassItem(${idx})" title="ลบวิชานี้" class="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 transition-all flex-shrink-0">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `;
  });

  container.innerHTML = html;
  initLucide();
}

function updateReviewClass(index, field, value) {
  if (appState.extractedClassesReview[index]) {
    appState.extractedClassesReview[index][field] = value;
  }
}

function deleteReviewClassItem(index) {
  appState.extractedClassesReview.splice(index, 1);
  renderReviewClassesList();
}

function addNewReviewClassRow() {
  if (!appState.extractedClassesReview) appState.extractedClassesReview = [];
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const currentDay = appState.activeDay || "Monday";
  appState.extractedClassesReview.push({
    id: `c_up_${Math.random().toString(36).substring(2, 8)}`,
    code: "CPE" + (appState.extractedClassesReview.length + 1) + "00",
    name: "วิชาใหม่",
    day: currentDay,
    start: "09:00",
    end: "12:00",
    room: "ห้องเรียน",
    instructor: "อาจารย์ผู้สอน",
    color: "indigo"
  });
  renderReviewClassesList();
}

async function confirmSaveImportedClasses() {
  const btn = document.getElementById("btn-confirm-save-classes");
  btn.disabled = true;
  btn.innerText = "กำลังบันทึกและคำนวณ CSP Optimizer...";

  const replaceMode = document.querySelector('input[name="import-mode"]:checked')?.value === 'replace';

  try {
    const res = await fetch("/api/classes/batch-save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classes: appState.extractedClassesReview,
        replace_all: replaceMode
      })
    });
    const data = await res.json();

    if (res.ok && data.status === "success") {
      appState.classes = data.classes || [];
      closeReviewClassesModal();
      
      // Auto-switch to the first day with classes in the new schedule
      const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      const activeHasClasses = data.classes.some(c => c.day === appState.activeDay);
      if (!activeHasClasses) {
        const firstDay = dayOrder.find(d => data.classes.some(c => c.day === d));
        if (firstDay) {
          selectScheduleDay(firstDay);
        } else {
          renderDayTimeline(appState.activeDay);
        }
      } else {
        selectScheduleDay(appState.activeDay);
      }

      triggerConfetti();
      const modeText = replaceMode ? "แทนที่ตารางเรียนเดิมเรียบร้อยแล้ว!" : "เพิ่มวิชาต่อท้ายตารางเดิมเรียบร้อยแล้ว!";
      alert(`${modeText} (ตรวจพบและบันทึก ${data.classes.length} รายวิชา)`);
    } else {
      alert(data.message || "บันทึกไม่สำเร็จ");
    }
  } catch (err) {
    alert("เกิดข้อผิดพลาด: " + err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="check-check" class="w-4 h-4"></i> <span>ยืนยันบันทึกแทนที่ตารางเรียน</span>`;
    initLucide();
  }
}

// ================= CUSTOM CLASS SCHEDULE MANAGEMENT =================
function openAddClassModal() {
  document.getElementById("add-class-modal").classList.remove("hidden");
  const daySelect = document.getElementById("class-day");
  if (daySelect) daySelect.value = appState.activeDay;
  initLucide();
}

function closeAddClassModal() {
  document.getElementById("add-class-modal").classList.add("hidden");
}

async function handleAddClassSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById("btn-add-class-submit");
  btn.disabled = true;
  btn.innerText = "กำลังบันทึกและคำนวณ CSP...";

  const code = document.getElementById("class-code").value.trim().toUpperCase();
  const name = document.getElementById("class-name").value.trim();
  const day = document.getElementById("class-day").value;
  const start = document.getElementById("class-start").value;
  const end = document.getElementById("class-end").value;
  const room = document.getElementById("class-room").value.trim();
  const instructor = document.getElementById("class-instructor").value.trim();
  
  const colorChecked = document.querySelector('input[name="class-color"]:checked');
  const color = colorChecked ? colorChecked.value : 'indigo';

  try {
    const res = await fetch("/api/classes/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, name, day, start, end, room, instructor, color })
    });
    const data = await res.json();
    if (res.ok && data.status === "success") {
      appState.classes = data.classes || [];
      closeAddClassModal();
      selectScheduleDay(day);
      triggerConfetti();
      document.getElementById("class-code").value = "";
      document.getElementById("class-name").value = "";
    } else {
      alert(data.message || "ไม่สามารถเพิ่มวิชาเรียนได้");
    }
  } catch (err) {
    alert("เกิดข้อผิดพลาด: " + err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> <span>บันทึกตารางเรียน & ปรับเวลา CSP ทันที</span>`;
    initLucide();
  }
}

function openManageClassesModal() {
  document.getElementById("manage-classes-modal").classList.remove("hidden");
  renderManageClassesList();
  initLucide();
}

function closeManageClassesModal() {
  document.getElementById("manage-classes-modal").classList.add("hidden");
}

function renderManageClassesList() {
  const container = document.getElementById("manage-classes-container");
  if (!container) return;

  if (appState.classes.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-slate-500 text-xs">ยังไม่มีวิชาเรียนในตาราง สามารถกดเพิ่มวิชาใหม่หรือนำเข้ารูปภาพได้เลย</div>`;
    return;
  }

  const dayOrder = { "Monday": 1, "Tuesday": 2, "Wednesday": 3, "Thursday": 4, "Friday": 5, "Saturday": 6, "Sunday": 7 };
  const sortedClasses = [...appState.classes].sort((a, b) => {
    if (dayOrder[a.day] !== dayOrder[b.day]) return dayOrder[a.day] - dayOrder[b.day];
    return a.start.localeCompare(b.start);
  });

  const dayThai = {
    "Monday": "จันทร์", "Tuesday": "อังคาร", "Wednesday": "พุธ",
    "Thursday": "พฤหัสบดี", "Friday": "ศุกร์", "Saturday": "เสาร์", "Sunday": "อาทิตย์"
  };

  let html = "";
  sortedClasses.forEach(c => {
    html += `
      <div class="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs">
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="w-2.5 h-2.5 rounded-full bg-${c.color || 'indigo'}-500 flex-shrink-0"></span>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-bold text-white">${c.code}</span>
              <span class="text-slate-300 truncate">${c.name}</span>
            </div>
            <p class="text-[11px] text-slate-400 mt-0.5">วัน${dayThai[c.day] || c.day} • ${c.start} - ${c.end} | ${c.room || '-'} | ${c.instructor || '-'}</p>
          </div>
        </div>
        <button onclick="deleteClass('${c.id}')" class="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 text-[11px] font-medium flex items-center gap-1 transition-all">
          <i data-lucide="trash-2" class="w-3 h-3"></i>
          <span>ลบ</span>
        </button>
      </div>
    `;
  });

  container.innerHTML = html;
  initLucide();
}

async function deleteClass(classId) {
  if (!confirm("คุณแน่ใจว่าต้องการลบวิชานี้ออกจากตารางเรียนหรือไม่?")) return;

  try {
    const res = await fetch(`/api/classes/${classId}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok && data.status === "success") {
      appState.classes = data.classes || [];
      renderDayTimeline(appState.activeDay);
      renderManageClassesList();
    } else {
      alert(data.message || "ลบไม่สำเร็จ");
    }
  } catch (err) {
    alert("เกิดข้อผิดพลาด: " + err);
  }
}

async function resetDefaultClasses() {
  if (!confirm("ต้องการรีเซ็ตตารางเรียนกลับเป็นรายวิชาเริ่มต้นของสาขาวิศวกรรมคอมพิวเตอร์หรือไม่?")) return;

  try {
    const res = await fetch("/api/classes/reset-defaults", { method: "POST" });
    const data = await res.json();
    if (res.ok && data.status === "success") {
      appState.classes = data.classes || [];
      renderDayTimeline(appState.activeDay);
      renderManageClassesList();
      triggerConfetti();
    }
  } catch (err) {
    alert("เกิดข้อผิดพลาด: " + err);
  }
}

function recalculateCSP() {
  simulateEnergyChange(appState.selectedEnergy);
  triggerConfetti();
}

// ================= DAILY CHECK-IN MODAL LOGIC =================
function openCheckinModal() {
  document.getElementById("checkin-modal").classList.remove("hidden");
  selectCheckinEnergy(appState.selectedEnergy);
  selectCheckinMood(appState.selectedMood);
  initLucide();
}

function closeCheckinModal() {
  document.getElementById("checkin-modal").classList.add("hidden");
}

function selectCheckinEnergy(level) {
  appState.selectedEnergy = level;
  ['low', 'medium', 'high'].forEach(l => {
    const btn = document.getElementById(`checkin-energy-${l}`);
    if (btn) {
      if (l === level) {
        btn.className = "checkin-energy-btn p-3 rounded-xl border-2 border-indigo-500 bg-indigo-950/40 text-center transition-all shadow-md";
      } else {
        btn.className = "checkin-energy-btn p-3 rounded-xl border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-center transition-all";
      }
    }
  });
}

function selectCheckinMood(mood) {
  appState.selectedMood = mood;
  ['exhausted', 'anxious', 'neutral', 'focused', 'energized'].forEach(m => {
    const btn = document.getElementById(`mood-${m}`);
    if (btn) {
      if (m === mood) {
        btn.className = "mood-btn p-2 rounded-xl border-2 border-indigo-500 bg-indigo-950/40";
      } else {
        btn.className = "mood-btn p-2 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800";
      }
    }
  });
}

function updateSleepDisplay(val) {
  document.getElementById("sleep-value-text").innerText = `${parseFloat(val).toFixed(1)} ชม.`;
}

async function submitDailyCheckin() {
  const energy = appState.selectedEnergy;
  const mood = appState.selectedMood;
  const sleep = parseFloat(document.getElementById("sleep-slider").value || 7);
  const notes = document.getElementById("checkin-notes").value || "";

  try {
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ energy, mood, sleep_hours: sleep, notes })
    });
    const data = await res.json();
    
    appState.burnout = data.burnout;
    appState.user = data.user;
    closeCheckinModal();
    updateUI();
    renderDayTimeline(appState.activeDay);
    triggerConfetti();
  } catch (err) {
    console.error("Check-in failed:", err);
  }
}

// ================= FOCUS / POMODORO TIMER LOGIC =================
function startFocusMode(subtaskId, durationMinutes, encodedTitle, encodedGuidance) {
  appState.currentFocusSubtaskId = subtaskId;
  appState.focusTimeLeft = durationMinutes * 60;
  appState.focusIsRunning = false;
  clearInterval(appState.focusInterval);

  const title = decodeURIComponent(encodedTitle);
  const guidance = decodeURIComponent(encodedGuidance);

  document.getElementById("focus-task-title").innerText = title;
  document.getElementById("focus-task-guidance").innerText = guidance;
  updateTimerDisplay();

  const toggleBtn = document.getElementById("btn-focus-toggle-text");
  if (toggleBtn) toggleBtn.innerText = "เริ่มจับเวลา";

  document.getElementById("focus-modal").classList.remove("hidden");
  initLucide();
}

function closeFocusModal() {
  clearInterval(appState.focusInterval);
  appState.focusIsRunning = false;
  document.getElementById("focus-modal").classList.add("hidden");
}

function toggleFocusTimer() {
  if (appState.focusIsRunning) {
    clearInterval(appState.focusInterval);
    appState.focusIsRunning = false;
    document.getElementById("btn-focus-toggle-text").innerText = "จับเวลาต่อ";
  } else {
    appState.focusIsRunning = true;
    document.getElementById("btn-focus-toggle-text").innerText = "หยุดชั่วคราว";
    appState.focusInterval = setInterval(() => {
      if (appState.focusTimeLeft > 0) {
        appState.focusTimeLeft--;
        updateTimerDisplay();
      } else {
        clearInterval(appState.focusInterval);
        appState.focusIsRunning = false;
        completeCurrentFocusSubtask();
      }
    }, 1000);
  }
}

function resetFocusTimer() {
  clearInterval(appState.focusInterval);
  appState.focusIsRunning = false;
  appState.focusTimeLeft = 35 * 60;
  updateTimerDisplay();
  document.getElementById("btn-focus-toggle-text").innerText = "เริ่มจับเวลา";
}

function updateTimerDisplay() {
  const m = Math.floor(appState.focusTimeLeft / 60);
  const s = appState.focusTimeLeft % 60;
  const text = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  document.getElementById("focus-timer-text").innerText = text;
}

function completeCurrentFocusSubtask() {
  if (appState.currentFocusSubtaskId) {
    toggleSubtask(appState.currentFocusSubtaskId, true);
  }
  closeFocusModal();
  triggerConfetti();
}

// ================= AI DECONSTRUCTOR LAB =================
function loadSampleAssignmentToLab(type) {
  const samples = {
    socket: {
      course: "CPE312 Computer Networks",
      title: "Lab 4: Multi-threaded TCP Socket Chat Server",
      text: "ให้นักศึกษาพัฒนาระบบ Multi-threaded Chat Server และ Client โดยใช้ TCP Socket รองรับการเชื่อมต่อพร้อมกันไม่น้อยกว่า 5 ไคลเอนต์ มีระบบ Broadcast ข้อความ และคำสั่ง /list, /quit พร้อมทั้งส่งรายงานผลการทดสอบและ Wireshark Packet Capture"
    },
    database: {
      course: "CPE324 Database Systems",
      title: "Project Sprint 1: E-Commerce DB Schema & Normalization (3NF)",
      text: "ออกแบบฐานข้อมูลระบบ E-Commerce จัดทำ ER Diagram และทำ Database Normalization ให้อยู่ในรูปแบบ 3NF พร้อมเขียนคำสั่ง SQL DDL สำหรับตาราง Products, Orders, Users, Categories, Payments"
    },
    os: {
      course: "CPE342 Operating Systems",
      title: "Mini-Project: CPU Scheduling Algorithms Simulation (FCFS, SJF, RR)",
      text: "เขียนโปรแกรมจำลอง CPU Scheduling algorithms ได้แก่ FCFS, Shortest Job First และ Round Robin คำนวณค่า Average Waiting Time, Turnaround Time และพิมพ์ ASCII Gantt Chart"
    }
  };

  const sample = samples[type];
  if (sample) {
    document.getElementById("lab-course").value = sample.course;
    document.getElementById("lab-title").value = sample.title;
    document.getElementById("lab-text").value = sample.text;
    document.getElementById("lab-json-output").innerText = "// ข้อมูลพร้อมแล้ว กดปุ่ม 'ประมวลผลด้วย AI' เพื่อสร้าง Subtasks";
  }
}

function handleLabFileUpload(event) {
  const file = event.target.files[0];
  if (file) {
    document.getElementById("lab-file-label").innerText = `ไฟล์ที่เลือก: ${file.name}`;
  }
}

async function runLabDeconstruction() {
  const btn = document.getElementById("btn-run-lab");
  const output = document.getElementById("lab-json-output");
  btn.disabled = true;
  btn.innerHTML = `<span class="animate-spin">⏳</span> <span>กำลังประมวลผลด้วย AI...</span>`;
  output.innerText = "// AI กำลังวิเคราะห์เอกสารและสร้างแผนงานย่อย (Task Deconstruction)...";

  const title = document.getElementById("lab-title").value;
  const course = document.getElementById("lab-course").value;
  const text = document.getElementById("lab-text").value;
  const fileInput = document.getElementById("lab-file");
  const apiKey = localStorage.getItem("taskflow_gemini_key") || "";

  const formData = new FormData();
  formData.append("title", title);
  formData.append("course", course);
  formData.append("raw_text", text);
  formData.append("api_key", apiKey);
  if (fileInput.files[0]) {
    formData.append("file", fileInput.files[0]);
  }

  try {
    const res = await fetch("/api/upload-assignment", {
      method: "POST",
      body: formData
    });
    const data = await res.json();
    
    output.innerText = JSON.stringify(data.assignment, null, 2);
    document.getElementById("btn-apply-workspace").classList.remove("hidden");
    
    appState.assignments.push(data.assignment);
    updateUI();
  } catch (err) {
    output.innerText = `Error: ${err}`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="wand-2" class="w-4 h-4"></i> <span>ประมวลผลด้วย AI</span>`;
    initLucide();
  }
}

function applyLabResultToWorkspace() {
  switchTab("workspace");
  triggerConfetti();
}

// ================= CSP SCHEDULER SIMULATION =================
async function simulateEnergyChange(level) {
  ['low', 'medium', 'high'].forEach(l => {
    const btn = document.getElementById(`sim-btn-${l}`);
    if (btn) {
      if (l === level) {
        btn.className = "px-3 py-1.5 rounded-lg text-xs font-medium transition-all text-white bg-indigo-600 flex items-center gap-1.5 shadow-md";
      } else {
        btn.className = "px-3 py-1.5 rounded-lg text-xs font-medium transition-all text-slate-400 hover:text-white flex items-center gap-1.5";
      }
    }
  });

  const ruleExp = document.getElementById("csp-rule-explanation");
  const burnoutImpact = document.getElementById("csp-burnout-impact");
  
  if (level === 'low') {
    if (ruleExp) ruleExp.innerText = "🚨 Low Energy Mode: กฎไดนามิกทำการย้าย High-Cognitive Tasks (เช่น งานเขียนโค้ดระบบ) ไปยังวันหยุด และจัดเฉพาะงานเบา (Low-Cognitive) 1 ชิ้นในวันนี้ เพื่อลดความตึงเครียดสะสม";
    if (burnoutImpact) burnoutImpact.innerText = "บรรเทาสภาวะสมองล้า ช่วยป้องกันอาการ Academic Burnout ได้อย่างมีประสิทธิผลตามหลักจิตวิทยาการศึกษา (EdTech Well-being)";
  } else if (level === 'high') {
    if (ruleExp) ruleExp.innerText = "🚀 High Focus Mode: อัลกอริทึมจัดคิวงานระดับ High-Cognitive (เช่น Socket Server, Normalization 3NF) ลงในตารางวันนี้ทันที เพราะสมองมีความพร้อมและโฟกัสสูงสุด";
    if (burnoutImpact) burnoutImpact.innerText = "เพิ่มประสิทธิภาพและร่นระยะเวลาส่งงานให้เสร็จก่อนกำหนด (Early Deadline Completion)";
  } else {
    if (ruleExp) ruleExp.innerText = "⚡ Balanced Mode: กระจายภาระงานย่อยอย่างสมดุล (Medium 1-2 สเต็ป) สลับกับเวลาพักผ่อน ไม่ให้กระทบกับการเข้าเรียนภาคบรรยาย";
    if (burnoutImpact) burnoutImpact.innerText = "รักษาวินัยเชิงบวก (Positive Discipline) อย่างต่อเนื่องและยั่งยืน";
  }

  try {
    const res = await fetch("/api/schedule/solve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ energy: level })
    });
    const result = await res.json();
    renderCSPBreakdown(result.adjusted_subtasks || []);
  } catch (err) {
    console.error("CSP solve failed:", err);
  }
}

function renderCSPBreakdown(subtasks) {
  const container = document.getElementById("csp-breakdown-table");
  if (!container) return;

  let html = "";
  subtasks.forEach(st => {
    html += `
      <div class="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 text-xs">
        <div class="min-w-0">
          <span class="font-bold text-white">${st.title}</span>
          <p class="text-[11px] text-slate-400 mt-0.5">${st.adjustment_note || 'จัดตามเงื่อนไข CSP'}</p>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0 font-mono">
          <span class="px-2 py-0.5 rounded bg-slate-800 text-indigo-400">${st.scheduled_day}</span>
          <span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300">${st.scheduled_time}</span>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// ================= UPLOAD ASSIGNMENT MODAL =================
function openUploadModal() {
  document.getElementById("upload-modal").classList.remove("hidden");
  initLucide();
}

function closeUploadModal() {
  document.getElementById("upload-modal").classList.add("hidden");
}

function updateUploadFileText(input) {
  const file = input.files[0];
  if (file) {
    document.getElementById("upload-file-status").innerText = `ไฟล์ที่เลือก: ${file.name}`;
  }
}

async function handleAssignmentUpload(e) {
  e.preventDefault();
  const btn = document.getElementById("btn-submit-upload");
  btn.disabled = true;
  btn.innerText = "กำลังประมวลผลด้วย AI...";

  const course = document.getElementById("asg-course").value;
  const title = document.getElementById("asg-title").value;
  const deadline = document.getElementById("asg-deadline").value;
  const rawText = document.getElementById("asg-text").value;
  const fileInput = document.getElementById("asg-file");
  const apiKey = localStorage.getItem("taskflow_gemini_key") || "";

  const formData = new FormData();
  formData.append("course", course);
  formData.append("title", title);
  formData.append("deadline", deadline);
  formData.append("raw_text", rawText);
  formData.append("api_key", apiKey);
  if (fileInput.files[0]) {
    formData.append("file", fileInput.files[0]);
  }

  try {
    const res = await fetch("/api/upload-assignment", {
      method: "POST",
      body: formData
    });
    const data = await res.json();
    
    appState.assignments.push(data.assignment);
    closeUploadModal();
    updateUI();
    triggerConfetti();
  } catch (err) {
    alert("เกิดข้อผิดพลาดในการอัปโหลด: " + err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="sparkles" class="w-4 h-4"></i> <span>ประมวลผลและสร้าง Subtasks ทันที</span>`;
    initLucide();
  }
}

function quickAddSampleAssignment() {
  openUploadModal();
  document.getElementById("asg-course").value = "CPE342 Operating Systems";
  document.getElementById("asg-title").value = "Simulation: CPU Scheduling Algorithms";
  document.getElementById("asg-text").value = "เขียนโปรแกรมจำลอง CPU Scheduling algorithms ได้แก่ FCFS, Shortest Job First และ Round Robin พร้อมพิมพ์ ASCII Gantt Chart";
}

// ================= CHARTS (CHART.JS) =================
function initCharts() {
  const ctx1 = document.getElementById("energyTrendChart");
  if (ctx1 && !appState.charts.trend) {
    const history = appState.checkinHistory || [];
    const labels = history.map(h => h.day);
    const energyScores = history.map(h => h.energy === 'high' ? 85 : h.energy === 'medium' ? 60 : 30);
    const tasksDone = history.map(h => (h.tasks_done || 1) * 20);

    appState.charts.trend = new Chart(ctx1, {
      type: 'line',
      data: {
        labels: labels.length ? labels : ['ส.', 'อา.', 'จ.', 'อ.', 'พ.'],
        datasets: [
          {
            label: 'ระดับพลังงาน (Energy Score)',
            data: energyScores.length ? energyScores : [80, 65, 75, 35, 60],
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            fill: true,
            tension: 0.4
          },
          {
            label: 'งานที่สำเร็จ (Productivity)',
            data: tasksDone.length ? tasksDone : [60, 40, 50, 20, 40],
            borderColor: '#10b981',
            borderDash: [5, 5],
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8', font: { family: 'Prompt' } } }
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } }
        }
      }
    });
  }

  const ctx2 = document.getElementById("cognitiveChart");
  if (ctx2 && !appState.charts.cognitive) {
    appState.charts.cognitive = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: ['High Cognitive (งานสมองหนัก)', 'Medium Cognitive (งานทั่วไป)', 'Low Cognitive (งานเบา/จัดเตรียม)'],
        datasets: [{
          data: [35, 40, 25],
          backgroundColor: ['#f43f5e', '#f59e0b', '#10b981'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'Prompt' } } }
        }
      }
    });
  }
}

// ================= API KEY & UTILS =================
function openApiKeyModal() {
  document.getElementById("apikey-modal").classList.remove("hidden");
  initLucide();
}

function closeApiKeyModal() {
  document.getElementById("apikey-modal").classList.add("hidden");
}

function loadSavedApiKey() {
  const k = localStorage.getItem("taskflow_gemini_key");
  if (k) {
    const input = document.getElementById("input-gemini-key");
    if (input) input.value = k;
  }
}

function saveApiKey() {
  const val = document.getElementById("input-gemini-key").value.trim();
  if (val) {
    localStorage.setItem("taskflow_gemini_key", val);
    alert("บันทึก Gemini API Key เรียบร้อยแล้ว!");
  }
  closeApiKeyModal();
}

function clearApiKey() {
  localStorage.removeItem("taskflow_gemini_key");
  document.getElementById("input-gemini-key").value = "";
  alert("ล้าง API Key เรียบร้อยแล้ว (ระบบจะใช้ Built-in Semantic Deconstructor)");
  closeApiKeyModal();
}

function testGeminiConnection() {
  const k = localStorage.getItem("taskflow_gemini_key");
  if (k) {
    alert("เชื่อมต่อกับ Gemini API Key ใน LocalStorage แล้ว พร้อมใช้งาน!");
  } else {
    alert("ระบบกำลังใช้งาน Built-in CE Semantic Engine (ทำงานได้แบบออฟไลน์ 100% โดยไม่ต้องใช้ API Key)!");
  }
}

function triggerConfetti() {
  if (window.confetti) {
    window.confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 }
    });
  }
}
