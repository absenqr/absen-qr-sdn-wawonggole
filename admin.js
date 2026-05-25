/**
 * ADMIN PANEL JAVASCRIPT
 * Login, form validation, panel management, dan API calls
 */

import { Validators, FormValidator, API, Utils } from './api.js';

// ══════════════════════════════════════
// STATE
// ══════════════════════════════════════

let adminUser = null;
let adminUid = null;
let guruList = [];
let selectedGuru = null;
let jadwalData = {};
let liburData = {};
let pendingLiburChanges = {};
let currentReportFilter = { month: null, year: null, guru: null, status: null };

// ══════════════════════════════════════
// DOM ELEMENTS CACHE
// ══════════════════════════════════════

const el = {
  loginPage: document.getElementById('login-page'),
  app: document.getElementById('app'),
  emailInput: document.getElementById('a-email'),
  passInput: document.getElementById('a-pass'),
  loginErr: document.getElementById('login-err'),
  btnLogin: document.getElementById('btn-login'),
  sbAdminName: document.getElementById('sb-admin-name'),
  topbarTitle: document.getElementById('topbar-title'),
  topbarSub: document.getElementById('topbar-sub'),
  topbarDate: document.getElementById('topbar-date'),
  sGuru: document.getElementById('s-guru'),
  sHadir: document.getElementById('s-hadir'),
  sIzin: document.getElementById('s-izin'),
  sBelum: document.getElementById('s-belum'),
  sTanpaJadwal: document.getElementById('s-tanpa-jadwal'),
  toast: document.getElementById('toast')
};

// ══════════════════════════════════════
// TOAST NOTIFICATIONS
// ══════════════════════════════════════

function showToast(message, type = 'success', duration = 3500) {
  if (!el.toast) return;
  el.toast.textContent = message;
  el.toast.className = `${type} show`;
  
  clearTimeout(el.toast._timeoutId);
  el.toast._timeoutId = setTimeout(() => {
    el.toast.classList.remove('show');
  }, duration);
}

// ══════════════════════════════════════
// LOGIN FORM
// ══════════════════════════════════════

function showLoginError(message) {
  if (!el.loginErr) return;
  el.loginErr.textContent = message;
  el.loginErr.classList.add('show');
}

function clearLoginError() {
  if (!el.loginErr) return;
  el.loginErr.classList.remove('show');
}

window.doLogin = async function() {
  const email = el.emailInput?.value?.trim() || '';
  const password = el.passInput?.value?.trim() || '';
  
  // Validate form
  const validation = FormValidator.validateLogin(email, password);
  if (!validation.valid) {
    showLoginError(Object.values(validation.errors)[0]);
    return;
  }
  
  clearLoginError();
  el.btnLogin.disabled = true;
  
  try {
    // Simulate Firebase login (replace with actual Firebase Auth call)
    // For now: hardcoded demo
    if (email.includes('admin') && password.length >= 6) {
      adminUser = { email, displayName: 'Administrator' };
      adminUid = 'admin_001';
      
      localStorage.setItem('admin_email', email);
      localStorage.setItem('admin_uid', adminUid);
      
      showLoginPage(false);
      initializeApp();
      showToast('Login berhasil!', 'success');
    } else {
      showLoginError('Email atau password salah');
    }
  } catch (error) {
    showLoginError('Gagal login: ' + error.message);
  } finally {
    el.btnLogin.disabled = false;
  }
};

window.doLogout = function() {
  adminUser = null;
  adminUid = null;
  localStorage.removeItem('admin_email');
  localStorage.removeItem('admin_uid');
  
  showLoginPage(true);
  showToast('Logout berhasil', 'success');
};

function showLoginPage(show) {
  if (!el.loginPage || !el.app) return;
  el.loginPage.style.display = show ? 'flex' : 'none';
  el.app.style.display = show ? 'none' : 'flex';
}

// ══════════════════════════════════════
// APP INITIALIZATION
// ══════════════════════════════════════

function initializeApp() {
  updateTopbar('Dashboard', 'Ringkasan data absensi hari ini');
  updateDateTime();
  populateFilters();
  loadDashboard();
  
  // Auto-refresh setiap 30 detik
  setInterval(() => {
    if (document.querySelector('.panel.active')?.id === 'panel-dashboard') {
      loadDashboard();
    }
  }, 30000);
}

function updateDateTime() {
  if (!el.topbarDate) return;
  const now = new Date();
  el.topbarDate.textContent = now.toLocaleDateString('id-ID', {
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

function updateTopbar(title, subtitle) {
  if (el.topbarTitle) el.topbarTitle.textContent = title;
  if (el.topbarSub) el.topbarSub.textContent = subtitle;
}

// ══════════════════════════════════════
// PANEL MANAGEMENT
// ══════════════════════════════════════

window.showPanel = function(panelName) {
  // Hide all panels
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  
  // Show selected panel
  const panel = document.getElementById(`panel-${panelName}`);
  if (panel) panel.classList.add('active');
  
  // Update sidebar
  document.querySelectorAll('.sb-item').forEach(item => {
    item.classList.toggle('active', item.dataset.panel === panelName);
  });
  
  // Update topbar
  const titles = {
    dashboard: ['Dashboard', 'Ringkasan data absensi hari ini'],
    guru: ['Manajemen Guru', 'Kelola data, jadwal, dan kehadiran guru'],
    laporan: ['Laporan Absensi', 'Filter dan cetak laporan kehadiran guru'],
    jadwal: ['Atur Jadwal Guru', 'Kelola jadwal masuk, pulang, dan hari tanpa jadwal'],
    libur: ['Libur Khusus', 'Kelola hari libur khusus di sekolah'],
    kode_darurat: ['Kode Darurat QR', 'Generate kode untuk guru yang lupa membawa QR']
  };
  
  if (titles[panelName]) {
    updateTopbar(titles[panelName][0], titles[panelName][1]);
  }
  
  // Load data jika needed
  if (panelName === 'guru') loadGuruPanel();
  if (panelName === 'laporan') loadLaporanPanel();
  if (panelName === 'jadwal') loadJadwalPanel();
  if (panelName === 'libur') loadLiburPanel();
};

// ══════════════════════════════════════
// DASHBOARD PANEL
// ══════════════════════════════════════

async function loadDashboard() {
  const today = Utils.dateToISO();
  
  try {
    const guruWithAttendance = await API.fetchGuruWithAttendance(today);
    guruList = guruWithAttendance;
    
    let hadir = 0, izin = 0, belum = 0, tanpaJadwal = 0;
    const todayList = [];
    
    for (const guru of guruList) {
      const att = guru.attendance || {};
      if (att.status === 'hadir' || att.status === 'hadir_awal') hadir++;
      else if (att.status === 'izin' || att.status === 'sakit') izin++;
      else if (att.status === 'tanpa_jadwal') tanpaJadwal++;
      else belum++;
      
      todayList.push({
        name: guru.name || 'Unknown',
        jabatan: guru.jabatan || 'Guru',
        masuk: att.masuk || '—',
        pulang: att.pulang || '—'
      });
    }
    
    // Update stats
    if (el.sGuru) el.sGuru.textContent = guruList.length;
    if (el.sHadir) el.sHadir.textContent = hadir;
    if (el.sIzin) el.sIzin.textContent = izin;
    if (el.sBelum) el.sBelum.textContent = belum;
    if (el.sTanpaJadwal) el.sTanpaJadwal.textContent = tanpaJadwal;
    
    // Update today list
    const todayListEl = document.getElementById('today-list');
    if (todayListEl) {
      todayListEl.innerHTML = todayList.map(guru => `
        <div class="today-row">
          <div class="today-avatar">👤</div>
          <div>
            <div class="today-name">${Utils.escapeHtml(guru.name)}</div>
            <div class="today-jabatan">${Utils.escapeHtml(guru.jabatan)}</div>
          </div>
          <div class="today-times">
            <span class="time-badge">${guru.masuk}</span>
            <span class="time-badge">${guru.pulang}</span>
          </div>
        </div>
      `).join('');
    }
    
    // Draw pie chart
    drawPieChart([hadir, izin, belum, tanpaJadwal]);
    
  } catch (error) {
    console.error('loadDashboard:', error);
    showToast('Gagal memuat dashboard', 'error');
  }
}

function drawPieChart(data) {
  const canvas = document.getElementById('pie-canvas');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const colors = ['#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
  const labels = ['Hadir', 'Izin/Sakit', 'Belum Absen', 'Tdk Ada Jadwal'];
  const total = data.reduce((a, b) => a + b, 1);
  
  let currentAngle = 0;
  const radius = 70;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  
  // Draw pie slices
  data.forEach((value, index) => {
    const sliceAngle = (value / total) * 2 * Math.PI;
    
    ctx.fillStyle = colors[index];
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
    ctx.lineTo(centerX, centerY);
    ctx.fill();
    
    currentAngle += sliceAngle;
  });
  
  // Draw legend
  const legend = document.getElementById('pie-legend');
  if (legend) {
    legend.innerHTML = labels.map((label, idx) => `
      <div class="pie-legend-item">
        <div class="pie-dot" style="background:${colors[idx]};"></div>
        <span>${label}</span>
      </div>
    `).join('');
  }
}

// ══════════════════════════════════════
// GURU PANEL
// ══════════════════════════════════════

async function loadGuruPanel() {
  try {
    const today = Utils.dateToISO();
    const guruWithAttendance = await API.fetchGuruWithAttendance(today);
    guruList = guruWithAttendance;
    
    // Update guru kehadiran list
    const kehadiranList = document.getElementById('guru-kehadiran-list');
    if (kehadiranList) {
      kehadiranList.innerHTML = guruList.map(guru => `
        <div class="today-row">
          <div class="today-avatar">👤</div>
          <div>
            <div class="today-name">${Utils.escapeHtml(guru.name || 'Unknown')}</div>
            <div class="today-jabatan">${Utils.escapeHtml(guru.jabatan || 'Guru')}</div>
          </div>
          <div class="today-times">
            <span class="time-badge">${guru.attendance?.masuk || '—'}</span>
            <span class="time-badge">${guru.attendance?.pulang || '—'}</span>
          </div>
        </div>
      `).join('');
    }
    
    // Update guru list
    const guruListEl = document.getElementById('guru-list');
    if (guruListEl) {
      guruListEl.innerHTML = guruList.map(guru => `
        <div class="guru-card">
          <div class="guru-avatar">👤</div>
          <div>
            <div class="guru-name">${Utils.escapeHtml(guru.name || 'Unknown')}</div>
            <div class="guru-meta">${Utils.escapeHtml(guru.jabatan || 'Guru')}</div>
          </div>
          <div class="guru-actions">
            <button class="btn btn-ghost btn-sm" onclick="editGuruJadwal('${guru.uid}')">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L21 3z"/>
              </svg>
              Edit
            </button>
          </div>
        </div>
      `).join('');
    }
    
  } catch (error) {
    console.error('loadGuruPanel:', error);
    showToast('Gagal memuat daftar guru', 'error');
  }
}

window.refreshGuruKehadiran = function() {
  loadGuruPanel();
  showToast('Data diperbarui', 'success');
};

window.refreshGuruList = function() {
  loadGuruPanel();
  showToast('Daftar guru diperbarui', 'success');
};

// ══════════════════════════════════════
// LAPORAN PANEL
// ══════════════════════════════════════

function populateFilters() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  // Populate bulan
  const fBulan = document.getElementById('f-bulan');
  if (fBulan) {
    const bulanNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    fBulan.innerHTML = bulanNames.map((b, idx) => 
      `<option value="${idx + 1}" ${idx + 1 === currentMonth ? 'selected' : ''}>${b}</option>`
    ).join('');
  }
  
  // Populate tahun
  const fTahun = document.getElementById('f-tahun');
  if (fTahun) {
    fTahun.innerHTML = [currentYear - 1, currentYear, currentYear + 1]
      .map(y => `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`)
      .join('');
  }
  
  // Populate guru
  const fGuru = document.getElementById('f-guru');
  if (fGuru && guruList.length > 0) {
    fGuru.innerHTML = '<option value="">Semua Guru</option>' + 
      guruList.map(g => `<option value="${g.uid}">${Utils.escapeHtml(g.name)}</option>`).join('');
  }
}

async function loadLaporanPanel() {
  const month = document.getElementById('f-bulan')?.value;
  const year = document.getElementById('f-tahun')?.value;
  
  if (!month || !year) {
    document.getElementById('laporan-table').innerHTML = '<div class="empty">Pilih bulan dan tahun untuk menampilkan data</div>';
    return;
  }
  
  currentReportFilter = { month, year };
  await fetchLaporan();
}

window.fetchLaporan = async function() {
  const month = document.getElementById('f-bulan')?.value;
  const year = document.getElementById('f-tahun')?.value;
  const guruFilter = document.getElementById('f-guru')?.value;
  const statusFilter = document.getElementById('f-status')?.value;
  
  if (!month || !year) return;
  
  try {
    const report = await API.fetchMonthlyReport(year, month, { 
      uid: guruFilter || null, 
      status: statusFilter || null 
    });
    
    const tableHtml = report.length === 0 
      ? '<div class="empty">Tidak ada data untuk filter yang dipilih</div>'
      : `<table>
          <thead><tr>
            <th>Tanggal</th>
            <th>Guru</th>
            <th>Jam Masuk</th>
            <th>Jam Pulang</th>
            <th>Status</th>
            <th>Keterangan</th>
          </tr></thead>
          <tbody>
            ${report.map(r => `<tr>
              <td>${r.date}</td>
              <td class="td-name">${Utils.escapeHtml(guruList.find(g => g.uid === r.uid)?.name || 'Unknown')}</td>
              <td class="td-mono">${r.masuk || '—'}</td>
              <td class="td-mono">${r.pulang || '—'}</td>
              <td><span class="chip chip-${r.status === 'hadir' ? 'ok' : 'gray'}">${r.status}</span></td>
              <td>${Utils.escapeHtml(r.keterangan || '—')}</td>
            </tr>`).join('')}
          </tbody>
        </table>`;
    
    const container = document.getElementById('laporan-table');
    if (container) container.innerHTML = tableHtml;
    
    const count = document.getElementById('lap-count');
    if (count) count.textContent = `${report.length} data ditemukan`;
    
  } catch (error) {
    console.error('fetchLaporan:', error);
    showToast('Gagal memuat laporan', 'error');
  }
};

window.doExport = function() {
  showToast('Export Excel (not yet implemented)', 'info');
};

window.doPrint = function() {
  window.print();
  showToast('Printing...', 'info');
};

// ══════════════════════════════════════
// JADWAL PANEL
// ══════════════════════════════════════

async function loadJadwalPanel() {
  try {
    const container = document.getElementById('jadwal-container');
    if (!container) return;
    
    container.innerHTML = guruList.map(guru => `
      <div class="jadwal-card">
        <div class="jadwal-card-head">
          <div>
            <div class="jadwal-name">${Utils.escapeHtml(guru.name || 'Unknown')}</div>
            <div class="jadwal-meta">${Utils.escapeHtml(guru.jabatan || 'Guru')}</div>
          </div>
        </div>
        <div class="jadwal-body">
          <div class="jadwal-fields">
            <div class="field-group">
              <label class="field-label">Masuk Default</label>
              <input type="time" class="jadwal-input-masuk" value="${(guru.jadwal?.default?.masuk || '07:20').replace(/^(\d{2}):(\d{2})/, '$1:$2')}" 
                     onchange="updateJadwalGuru('${guru.uid}', 'masuk', this.value)">
            </div>
            <div class="field-group">
              <label class="field-label">Pulang Default</label>
              <input type="time" class="jadwal-input-pulang" value="${(guru.jadwal?.default?.pulang || '15:30').replace(/^(\d{2}):(\d{2})/, '$1:$2')}" 
                     onchange="updateJadwalGuru('${guru.uid}', 'pulang', this.value)">
            </div>
            <button class="btn btn-prim" onclick="saveJadwalGuru('${guru.uid}')">Simpan</button>
          </div>
        </div>
      </div>
    `).join('');
    
  } catch (error) {
    console.error('loadJadwalPanel:', error);
    showToast('Gagal memuat jadwal', 'error');
  }
}

window.fetchJadwal = function() {
  loadJadwalPanel();
  showToast('Jadwal diperbarui', 'success');
};

window.updateJadwalGuru = function(uid, type, value) {
  if (!jadwalData[uid]) jadwalData[uid] = { default: {} };
  jadwalData[uid].default[type] = value;
};

window.saveJadwalGuru = async function(uid) {
  try {
    if (!jadwalData[uid]) return;
    await API.saveJadwal(uid, jadwalData[uid]);
    showToast(`Jadwal guru diperbarui`, 'success');
  } catch (error) {
    console.error('saveJadwalGuru:', error);
    showToast('Gagal menyimpan jadwal', 'error');
  }
};

// ══════════════════════════════════════
// LIBUR PANEL
// ══════════════════════════════════════

async function loadLiburPanel() {
  try {
    liburData = await API.fetchLibur();
    renderKalender();
    renderLiburList();
  } catch (error) {
    console.error('loadLiburPanel:', error);
    showToast('Gagal memuat libur', 'error');
  }
}

window.renderKalender = function() {
  const kalBulan = document.getElementById('kal-bulan');
  const kalTahun = document.getElementById('kal-tahun');
  
  if (!kalBulan || !kalTahun) return;
  
  const month = parseInt(kalBulan.value) || new Date().getMonth() + 1;
  const year = parseInt(kalTahun.value) || new Date().getFullYear();
  
  // Generate calendar HTML
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();
  
  let html = '<div class="kal-grid">';
  
  // Header (day names)
  ['Min','Sen','Sel','Rab','Kam','Jum','Sab'].forEach(day => {
    html += `<div class="kal-head">${day}</div>`;
  });
  
  // Previous month days
  for (let i = firstDay - 1; i >= 0; i--) {
    html += `<div class="kal-day empty"></div>`;
  }
  
  // Current month days
  const today = new Date().toLocaleDateString('sv-SE');
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const libur = liburData[dateStr];
    const isToday = dateStr === today;
    let classes = 'kal-day';
    
    if (isToday) classes += ' today';
    else if (libur) classes += ' libur-khusus';
    
    html += `<div class="${classes}" onclick="pilihTanggal('${dateStr}')">
      <span class="kal-tgl">${day}</span>
      ${libur ? `<span class="kal-ket">${Utils.escapeHtml(libur.keterangan || '')}</span>` : ''}
      ${libur ? `<button class="kal-hapus" onclick="hapusLibur('${dateStr}', event)">✕</button>` : ''}
    </div>`;
  }
  
  // Next month days
  const totalCells = html.match(/<div class="kal-day/g).length - firstDay - daysInMonth;
  for (let i = 1; i <= totalCells + 7; i++) {
    html += `<div class="kal-day empty"></div>`;
  }
  
  html += '</div>';
  
  const wrap = document.getElementById('kalender-wrap');
  if (wrap) wrap.innerHTML = html;
};

window.pilihTanggal = function(dateStr) {
  const dialog = document.getElementById('libur-dialog');
  const ketInput = document.getElementById('dialog-ket');
  if (!dialog || !ketInput) return;
  
  window._selectedDate = dateStr;
  ketInput.value = liburData[dateStr]?.keterangan || '';
  dialog.dataset.date = dateStr;
  dialog.style.display = 'block';
};

window.tutupDialog = function() {
  const dialog = document.getElementById('libur-dialog');
  if (dialog) dialog.style.display = 'none';
};

window.konfirmasiTambahLibur = function() {
  const dateStr = window._selectedDate;
  const ket = document.getElementById('dialog-ket')?.value || '';
  
  if (!ket.trim()) {
    showToast('Masukkan keterangan libur', 'warning');
    return;
  }
  
  pendingLiburChanges[dateStr] = { keterangan: ket };
  renderKalender();
  updateBulkSaveUI();
  tutupDialog();
  showToast('Libur ditambahkan (belum disimpan)', 'info');
};

window.hapusLibur = function(dateStr, e) {
  e.stopPropagation();
  delete pendingLiburChanges[dateStr];
  delete liburData[dateStr];
  renderKalender();
  updateBulkSaveUI();
};

function updateBulkSaveUI() {
  const bulkWrap = document.getElementById('bulk-save-wrap');
  const bulkInfo = document.getElementById('bulk-info');
  const count = Object.keys(pendingLiburChanges).length;
  
  if (bulkWrap) {
    bulkWrap.style.display = count > 0 ? 'flex' : 'none';
  }
  if (bulkInfo && count > 0) {
    bulkInfo.textContent = `${count} perubahan`;
  }
}

window.simpanSemuaLibur = async function() {
  try {
    for (const [date, data] of Object.entries(pendingLiburChanges)) {
      await API.saveLibur(date, data);
      liburData[date] = data;
    }
    
    pendingLiburChanges = {};
    renderKalender();
    updateBulkSaveUI();
    showToast('Libur disimpan ke Firebase', 'success');
  } catch (error) {
    console.error('simpanSemuaLibur:', error);
    showToast('Gagal menyimpan libur', 'error');
  }
};

window.batalSemuaLibur = function() {
  pendingLiburChanges = {};
  renderKalender();
  updateBulkSaveUI();
  showToast('Pembatalan libur dibatalkan', 'info');
};

async function renderLiburList() {
  const list = document.getElementById('libur-list');
  if (!list) return;
  
  const items = Object.entries(liburData).map(([date, data]) => `
    <div class="libur-item">
      <div class="libur-info">
        <div class="libur-tgl">${date}</div>
        <div class="libur-ket">${Utils.escapeHtml(data.keterangan || '')}</div>
      </div>
      <button class="btn-hapus-libur" onclick="hapusLiburPerm('${date}')">Hapus</button>
    </div>
  `).join('');
  
  list.innerHTML = items || '<div class="empty">Tidak ada libur khusus</div>';
}

window.hapusLiburPerm = async function(date) {
  try {
    await API.saveLibur(date, null);
    delete liburData[date];
    await loadLiburPanel();
    showToast('Libur dihapus', 'success');
  } catch (error) {
    console.error('hapusLiburPerm:', error);
    showToast('Gagal menghapus libur', 'error');
  }
};

// ══════════════════════════════════════
// INITIALIZATION
// ══════════════════════════════════════

document.addEventListener('DOMContentLoaded', function() {
  const savedEmail = localStorage.getItem('admin_email');
  const savedUid = localStorage.getItem('admin_uid');
  
  if (savedEmail && savedUid) {
    adminUser = { email: savedEmail };
    adminUid = savedUid;
    showLoginPage(false);
    initializeApp();
  } else {
    showLoginPage(true);
  }
});
