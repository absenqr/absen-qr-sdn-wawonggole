/**
 * API Connection Layer
 * Centralized API calls untuk kedua aplikasi (mobile & desktop)
 */

const API_BASE_URL = 'https://absen-qr-sdn-wawonggole-default-rtdb.asia-southeast1.firebasedatabase.app';

// ══════════════════════════════════════
// VALIDATION UTILITIES
// ══════════════════════════════════════

export const Validators = {
  email: (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },
  
  pin: (pin) => {
    // PIN format: DDMMYYYY (tanggal lahir)
    return /^\d{8}$/.test(pin);
  },
  
  password: (pass) => {
    // Min 6 chars, at least 1 letter and 1 number
    return /^(?=.*[a-zA-Z])(?=.*\d).{6,}$/.test(pass);
  },

  required: (val) => {
    return val && val.trim().length > 0;
  },

  minLength: (val, min) => {
    return val && val.length >= min;
  },

  maxLength: (val, max) => {
    return val && val.length <= max;
  },

  time: (time) => {
    // Format: HH:MM
    return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
  }
};

// ══════════════════════════════════════
// API CALLS - SHARED
// ══════════════════════════════════════

export const API = {
  /**
   * Fetch guru list dengan presensi hari ini
   */
  async fetchGuruWithAttendance(date) {
    try {
      const response = await fetch(`${API_BASE_URL}/guru.json`);
      if (!response.ok) throw new Error('Failed to fetch guru');
      
      const guruData = await response.json() || {};
      const attendanceData = await API.fetchAttendance(date);
      
      return Object.entries(guruData).map(([uid, guru]) => ({
        uid,
        ...guru,
        attendance: attendanceData[uid] || {}
      }));
    } catch (err) {
      console.error('fetchGuruWithAttendance:', err);
      return [];
    }
  },

  /**
   * Fetch attendance records untuk tanggal tertentu
   */
  async fetchAttendance(date) {
    try {
      const response = await fetch(`${API_BASE_URL}/attendance/${date}.json`);
      if (!response.ok) return {};
      return await response.json() || {};
    } catch (err) {
      console.error('fetchAttendance:', err);
      return {};
    }
  },

  /**
   * Save attendance record
   */
  async saveAttendance(date, uid, data) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/attendance/${date}/${uid}.json`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...data,
            timestamp: new Date().toISOString()
          })
        }
      );
      if (!response.ok) throw new Error('Failed to save attendance');
      return await response.json();
    } catch (err) {
      console.error('saveAttendance:', err);
      return null;
    }
  },

  /**
   * Fetch laporan bulanan
   */
  async fetchMonthlyReport(year, month, filter = {}) {
    try {
      const response = await fetch(`${API_BASE_URL}/attendance.json`);
      if (!response.ok) throw new Error('Failed to fetch report');
      
      const allData = await response.json() || {};
      const report = [];
      
      for (const [date, attendances] of Object.entries(allData)) {
        const [y, m] = date.split('-');
        if (y !== String(year) || m !== String(month).padStart(2, '0')) continue;
        
        for (const [uid, att] of Object.entries(attendances || {})) {
          if (filter.uid && uid !== filter.uid) continue;
          if (filter.status && att.status !== filter.status) continue;
          
          report.push({ date, uid, ...att });
        }
      }
      
      return report;
    } catch (err) {
      console.error('fetchMonthlyReport:', err);
      return [];
    }
  },

  /**
   * Fetch jadwal guru
   */
  async fetchJadwal(uid) {
    try {
      const response = await fetch(`${API_BASE_URL}/jadwal/${uid}.json`);
      if (!response.ok) return null;
      return await response.json();
    } catch (err) {
      console.error('fetchJadwal:', err);
      return null;
    }
  },

  /**
   * Save jadwal guru
   */
  async saveJadwal(uid, jadwalData) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/jadwal/${uid}.json`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(jadwalData)
        }
      );
      if (!response.ok) throw new Error('Failed to save jadwal');
      return await response.json();
    } catch (err) {
      console.error('saveJadwal:', err);
      return null;
    }
  },

  /**
   * Fetch libur khusus
   */
  async fetchLibur() {
    try {
      const response = await fetch(`${API_BASE_URL}/libur_khusus.json`);
      if (!response.ok) return {};
      return await response.json() || {};
    } catch (err) {
      console.error('fetchLibur:', err);
      return {};
    }
  },

  /**
   * Save libur khusus
   */
  async saveLibur(date, data) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/libur_khusus/${date}.json`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        }
      );
      if (!response.ok) throw new Error('Failed to save libur');
      return await response.json();
    } catch (err) {
      console.error('saveLibur:', err);
      return null;
    }
  },

  /**
   * Fetch kode darurat
   */
  async fetchKodeDarurat(date) {
    try {
      const response = await fetch(`${API_BASE_URL}/kode_darurat/${date}.json`);
      if (!response.ok) return {};
      return await response.json() || {};
    } catch (err) {
      console.error('fetchKodeDarurat:', err);
      return {};
    }
  },

  /**
   * Verify kode darurat
   */
  async verifyKodeDarurat(date, kode) {
    try {
      const kodeDarurat = await API.fetchKodeDarurat(date);
      
      for (const [id, data] of Object.entries(kodeDarurat)) {
        if (data.kode === kode && !data.used) {
          return { valid: true, uid: data.uid, mode: data.mode, id };
        }
      }
      
      return { valid: false };
    } catch (err) {
      console.error('verifyKodeDarurat:', err);
      return { valid: false };
    }
  }
};

// ══════════════════════════════════════
// FORM VALIDATION HELPERS
// ══════════════════════════════════════

export const FormValidator = {
  /**
   * Validate login form (mobile & admin)
   */
  validateLogin(email, password) {
    const errors = {};
    
    if (!Validators.required(email)) {
      errors.email = 'Email tidak boleh kosong';
    } else if (!Validators.email(email)) {
      errors.email = 'Format email tidak valid';
    }
    
    if (!Validators.required(password)) {
      errors.password = 'Password/PIN tidak boleh kosong';
    }
    
    return {
      valid: Object.keys(errors).length === 0,
      errors
    };
  },

  /**
   * Validate jadwal form
   */
  validateJadwal(masuk, pulang) {
    const errors = {};
    
    if (!Validators.time(masuk)) {
      errors.masuk = 'Format jam tidak valid (HH:MM)';
    }
    
    if (!Validators.time(pulang)) {
      errors.pulang = 'Format jam tidak valid (HH:MM)';
    }
    
    if (masuk && pulang && masuk >= pulang) {
      errors.pulang = 'Jam pulang harus lebih besar dari jam masuk';
    }
    
    return {
      valid: Object.keys(errors).length === 0,
      errors
    };
  },

  /**
   * Validate alasan form
   */
  validateAlasan(alasan, detail) {
    const errors = {};
    
    if (!Validators.required(alasan)) {
      errors.alasan = 'Pilih alasan terlebih dahulu';
    }
    
    if (detail && !Validators.maxLength(detail, 200)) {
      errors.detail = 'Maksimal 200 karakter';
    }
    
    return {
      valid: Object.keys(errors).length === 0,
      errors
    };
  }
};

// ══════════════════════════════════════
// UTILITY HELPERS
// ══════════════════════════════════════

export const Utils = {
  /**
   * Format date to ISO string (YYYY-MM-DD)
   */
  dateToISO(date = new Date()) {
    return date.toLocaleDateString('sv-SE');
  },

  /**
   * Format time to HH:MM
   */
  timeFormat(hours, minutes) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  },

  /**
   * Calculate distance between two coordinates (haversine)
   */
  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + 
              Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * 
              Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  },

  /**
   * Generate random 6-digit code
   */
  generateCode() {
    return String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
  },

  /**
   * Escape HTML entities
   */
  escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
};
