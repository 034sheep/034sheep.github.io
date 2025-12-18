// ===== 메인 앱 로직 =====
import { 
  loadRecords, 
  upsertRecord, 
  deleteRecord, 
  generateId,
  loadCollections,
  addCollection,
  getStats,
  getMonthlyBest,
  searchRecords
} from "./storage.js";

import { searchAll, searchBooks, searchMovies, createManualEntry } from "./api.js";

// DOM 요소 캐시
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// 앱 상태
const state = {
  currentView: "view-home",
  records: loadRecords(),
  collections: loadCollections(),
  range: "year",
  
  // 기록 작성 상태
  selectedItem: null,
  rating: 0,
  editingId: null,
  
  // 검색 결과
  apiResults: [],
  searchTimeout: null,
  searchType: "all" // 검색 타입: all, movie, book
};

// ===== 유틸리티 함수 =====
function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const dayName = days[date.getDay()];
  return `${year}.${month}.${day}. (${dayName})`;
}

function getTodayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

// 토스트 메시지 표시
function showToast(message, isError = false) {
  const toast = $("#toast");
  const toastMessage = $("#toast-message");
  
  toastMessage.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");
  
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

// ===== 뷰 전환 =====
function showView(viewId) {
  state.currentView = viewId;
  
  // 모든 뷰 숨기기
  $$(".view").forEach(view => view.classList.remove("active"));
  
  // 선택된 뷰 표시
  const targetView = $(`#${viewId}`);
  if (targetView) {
    targetView.classList.add("active");
  }
  
  // 네비게이션 활성화 상태 업데이트
  $$(".nav-item").forEach(item => {
    const navView = item.dataset.view;
    item.classList.toggle("active", navView === viewId);
  });
  
  // 뷰별 초기화
  switch (viewId) {
    case "view-home":
      renderHome();
      break;
    case "view-search":
      renderLocalSearch();
      break;
    case "view-write-search":
      resetWriteFlow();
      break;
    case "view-write-rating":
      renderRating();
      break;
    case "view-write-review":
      renderReview();
      break;
  }
}

// ===== 홈 화면 렌더링 =====
function renderHome() {
  state.records = loadRecords();
  
  // 통계 업데이트
  const stats = getStats(state.range);
  $("#stat-books").textContent = String(stats.books).padStart(2, "0") + "권";
  $("#stat-movies").textContent = String(stats.movies).padStart(2, "0") + "편";
  
  // 컬렉션 렌더링
  renderCollections();
  
  // 이달의 최고작 렌더링
  renderBestList();
}

function renderCollections() {
  const collections = loadCollections();
  const container = $("#collection-grid");
  
  // 만들기 버튼은 유지
  container.innerHTML = `
    <div class="collection-item add-collection" id="btn-add-collection">
      <i class="fas fa-plus"></i>
      <span>만들기</span>
    </div>
  `;
  
  // 컬렉션 추가
  collections.forEach(name => {
    const item = document.createElement("div");
    item.className = "collection-item";
    item.innerHTML = `<span>${escapeHtml(name)}</span>`;
    item.addEventListener("click", () => {
      $("#search-input").value = name;
      showView("view-search");
      renderLocalSearch();
    });
    container.appendChild(item);
  });
  
  // 만들기 버튼 이벤트
  $("#btn-add-collection").addEventListener("click", () => {
    const name = prompt("새 컬렉션 이름을 입력하세요:");
    if (name && name.trim()) {
      addCollection(name.trim());
      renderCollections();
    }
  });
}

function renderBestList() {
  const filter = $("#best-filter").value;
  const bestItems = getMonthlyBest(filter, 5);
  const container = $("#best-list");
  
  if (bestItems.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-star"></i>
        <p>이번 달 기록이 없습니다</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = bestItems.map(item => `
    <div class="best-item" data-id="${item.id}">
      <div class="item-thumb">
        ${item.thumbnail 
          ? `<img src="${escapeHtml(item.thumbnail)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">` 
          : `<i class="fas fa-image"></i>`
        }
      </div>
      <div class="item-info">
        <div class="item-title">${escapeHtml(item.title)}</div>
        <div class="item-sub">${item.type === "movie" ? "영화" : "책"}${item.year ? ` / ${item.year}` : ""}</div>
      </div>
    </div>
  `).join("");
  
  // 클릭 이벤트
  container.querySelectorAll(".best-item").forEach(el => {
    el.addEventListener("click", () => {
      const id = el.dataset.id;
      const record = state.records.find(r => r.id === id);
      if (record) {
        showDetail(record);
      }
    });
  });
}

// ===== 로컬 검색 (내 기록 검색) =====
function renderLocalSearch() {
  const query = $("#search-input").value;
  const results = searchRecords(query);
  const container = $("#search-results");
  
  if (results.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-search"></i>
        <p>검색 결과가 없습니다</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = results.map(item => `
    <div class="search-result-item" data-id="${item.id}">
      <div class="item-thumb">
        ${item.thumbnail 
          ? `<img src="${escapeHtml(item.thumbnail)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">` 
          : `<i class="fas fa-image"></i>`
        }
      </div>
      <div class="item-info">
        <div class="item-title">${escapeHtml(item.title)}</div>
        <div class="item-sub">${item.type === "movie" ? "영화" : "책"}${item.year ? ` / ${item.year}` : ""} · ★${item.rating?.toFixed(1) || "0.0"}</div>
      </div>
    </div>
  `).join("");
  
  // 클릭 이벤트
  container.querySelectorAll(".search-result-item").forEach(el => {
    el.addEventListener("click", () => {
      const id = el.dataset.id;
      const record = state.records.find(r => r.id === id);
      if (record) {
        showDetail(record);
      }
    });
  });
}

// ===== 기록 작성 플로우 =====
function resetWriteFlow() {
  state.selectedItem = null;
  state.rating = 0;
  state.editingId = null;
  state.searchType = "all";
  
  $("#write-search-input").value = "";
  $("#write-search-results").innerHTML = "";
  $("#btn-write-next-1").style.display = "none";
  
  // 검색 타입 탭 초기화
  $$(".search-type-tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.type === "all");
  });
}

// API 검색 (기록 작성용)
async function doAPISearch() {
  const query = $("#write-search-input").value.trim();
  const container = $("#write-search-results");
  
  if (!query) {
    container.innerHTML = "";
    return;
  }
  
  container.innerHTML = `<div class="loading"><i class="fas fa-spinner fa-spin"></i> 검색 중...</div>`;
  
  try {
    let results = [];
    
    // 검색 타입에 따라 API 호출
    if (state.searchType === "movie") {
      results = await searchMovies(query);
    } else if (state.searchType === "book") {
      results = await searchBooks(query);
    } else {
      results = await searchAll(query);
    }
    
    state.apiResults = results;
    
    if (results.length === 0) {
      // 결과가 없으면 수동 입력 옵션 제공
      let manualOptions = '';
      
      if (state.searchType === "movie" || state.searchType === "all") {
        manualOptions += `
          <div class="search-result-item manual-entry" data-type="movie">
            <div class="item-thumb"><i class="fas fa-film"></i></div>
            <div class="item-info">
              <div class="item-title">"${escapeHtml(query)}" (영화로 추가)</div>
              <div class="item-sub">직접 입력</div>
            </div>
          </div>
        `;
      }
      
      if (state.searchType === "book" || state.searchType === "all") {
        manualOptions += `
          <div class="search-result-item manual-entry" data-type="book">
            <div class="item-thumb"><i class="fas fa-book"></i></div>
            <div class="item-info">
              <div class="item-title">"${escapeHtml(query)}" (책으로 추가)</div>
              <div class="item-sub">직접 입력</div>
            </div>
          </div>
        `;
      }
      
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-search"></i>
          <p>검색 결과가 없습니다</p>
          <p style="margin-top:8px;font-size:13px;">아래를 클릭하여 직접 입력하세요</p>
        </div>
        ${manualOptions}
      `;
      
      container.querySelectorAll(".manual-entry").forEach(el => {
        el.addEventListener("click", () => {
          const type = el.dataset.type;
          state.selectedItem = createManualEntry(query, type);
          updateSelectedState();
        });
      });
      return;
    }
    
    container.innerHTML = results.map((item, idx) => `
      <div class="search-result-item" data-idx="${idx}">
        <div class="item-thumb">
          ${item.thumbnail 
            ? `<img src="${escapeHtml(item.thumbnail)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">` 
            : `<i class="fas fa-${item.type === 'movie' ? 'film' : 'book'}"></i>`
          }
        </div>
        <div class="item-info">
          <div class="item-title">${escapeHtml(item.title)}</div>
          <div class="item-sub">${item.type === "movie" ? "영화" : "책"}${item.year ? ` / ${item.year}` : ""}</div>
        </div>
      </div>
    `).join("");
    
    // 선택 이벤트
    container.querySelectorAll(".search-result-item").forEach(el => {
      el.addEventListener("click", () => {
        const idx = parseInt(el.dataset.idx);
        state.selectedItem = state.apiResults[idx];
        updateSelectedState(idx);
      });
    });
    
  } catch (error) {
    container.innerHTML = `
      <div class="empty-state">
        <p>검색 중 오류가 발생했습니다</p>
        <p style="margin-top:8px;">${escapeHtml(error.message)}</p>
      </div>
    `;
  }
}

function updateSelectedState(selectedIdx = null) {
  // 선택 상태 UI 업데이트
  $$('#write-search-results .search-result-item').forEach((el, idx) => {
    el.classList.remove('selected');
    if (selectedIdx !== null && parseInt(el.dataset.idx) === selectedIdx) {
      el.classList.add('selected');
    }
  });
  
  // 수동 입력 항목 선택 처리
  $$('#write-search-results .manual-entry').forEach(el => {
    if (state.selectedItem && state.selectedItem.isManual && el.dataset.type === state.selectedItem.type) {
      el.classList.add('selected');
    }
  });
  
  if (state.selectedItem) {
    $("#btn-write-next-1").style.display = "block";
    // 선택 알림
    const typeText = state.selectedItem.type === 'movie' ? '영화' : '책';
    console.log(`선택됨: ${state.selectedItem.title} (${typeText})`);
  }
}

// 별점 화면
function renderRating() {
  if (!state.selectedItem) {
    showView("view-write-search");
    return;
  }
  
  // 선택된 아이템 표시
  const display = $("#selected-item-display");
  display.innerHTML = `
    <div class="item-thumb">
      ${state.selectedItem.thumbnail 
        ? `<img src="${escapeHtml(state.selectedItem.thumbnail)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">` 
        : `<i class="fas fa-image"></i>`
      }
    </div>
    <div class="item-info">
      <div class="item-title">${escapeHtml(state.selectedItem.title)}</div>
      <div class="item-sub">${state.selectedItem.type === "movie" ? "영화" : "책"}${state.selectedItem.year ? ` / ${state.selectedItem.year}` : ""}</div>
    </div>
  `;
  
  // 별점 생성
  renderStars();
}

function renderStars() {
  const container = $("#star-rating");
  container.innerHTML = "";
  
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement("button");
    star.type = "button";
    star.className = "star-btn" + (i <= state.rating ? " filled" : "");
    star.innerHTML = i <= state.rating ? "★" : "☆";
    star.addEventListener("click", () => {
      state.rating = i;
      renderStars();
    });
    container.appendChild(star);
  }
  
  $("#rating-score").textContent = state.rating.toFixed(1);
}

// 감상평 화면
function renderReview() {
  if (!state.selectedItem) {
    showView("view-write-search");
    return;
  }
  
  // 선택된 아이템 표시
  const display = $("#selected-item-display-2");
  display.innerHTML = `
    <div class="item-thumb">
      ${state.selectedItem.thumbnail 
        ? `<img src="${escapeHtml(state.selectedItem.thumbnail)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">` 
        : `<i class="fas fa-image"></i>`
      }
    </div>
    <div class="item-info">
      <div class="item-title">${escapeHtml(state.selectedItem.title)}</div>
      <div class="item-sub">${state.selectedItem.type === "movie" ? "영화" : "책"}${state.selectedItem.year ? ` / ${state.selectedItem.year}` : ""}</div>
    </div>
  `;
  
  // 날짜 설정
  $("#record-date").textContent = formatDate(getTodayISO());
  
  // placeholder 업데이트
  $("#review-text").placeholder = `'${state.selectedItem.title}' 에 대해 어떻게 생각하시나요?`;
  
  // 기존 수정 모드인 경우 데이터 채우기
  if (state.editingId) {
    const existing = state.records.find(r => r.id === state.editingId);
    if (existing) {
      $("#review-text").value = existing.note || "";
      $("#tags-input").value = (existing.tags || []).join(", ");
      if (existing.date) {
        $("#record-date").textContent = formatDate(existing.date);
      }
    }
  } else {
    $("#review-text").value = "";
    $("#tags-input").value = "";
  }
}

// 기록 저장
function saveRecord() {
  if (!state.selectedItem) {
    showToast("작품을 선택해주세요.", true);
    return;
  }
  
  if (state.rating === 0) {
    showToast("별점을 선택해주세요.", true);
    return;
  }
  
  const record = {
    id: state.editingId || generateId(),
    title: state.selectedItem.title,
    type: state.selectedItem.type,
    year: state.selectedItem.year || "",
    thumbnail: state.selectedItem.thumbnail || null,
    author: state.selectedItem.author || "",
    rating: state.rating,
    date: getTodayISO(),
    note: $("#review-text").value.trim(),
    tags: $("#tags-input").value.split(",").map(t => t.trim()).filter(Boolean)
  };
  
  upsertRecord(record);
  state.records = loadRecords();
  
  // 태그를 컬렉션에 추가
  record.tags.forEach(tag => addCollection(tag));
  
  showToast(state.editingId ? "수정되었습니다!" : "저장되었습니다!");
  showView("view-home");
}

// ===== 상세 페이지 =====
function showDetail(record) {
  // 아이템 표시
  const display = $("#detail-item-display");
  display.innerHTML = `
    <div class="item-thumb">
      ${record.thumbnail 
        ? `<img src="${escapeHtml(record.thumbnail)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">` 
        : `<i class="fas fa-image"></i>`
      }
    </div>
    <div class="item-info">
      <div class="item-title">${escapeHtml(record.title)}</div>
      <div class="item-sub">${record.type === "movie" ? "영화" : "책"}${record.year ? ` / ${record.year}` : ""}</div>
    </div>
  `;
  
  // 별점 표시
  const starsContainer = $("#detail-stars");
  starsContainer.innerHTML = Array(5).fill(0).map((_, i) => 
    i < record.rating ? "★" : "☆"
  ).join("");
  
  $("#detail-score").textContent = record.rating?.toFixed(1) || "0.0";
  
  // 날짜
  $("#detail-date").textContent = record.date ? formatDate(record.date) : "";
  
  // 감상평
  $("#detail-review").textContent = record.note || "(감상평 없음)";
  
  // 태그
  const tagsContainer = $("#detail-tags");
  tagsContainer.innerHTML = (record.tags || []).map(tag => 
    `<span class="tag-chip">${escapeHtml(tag)}</span>`
  ).join("");
  
  // 수정/삭제 버튼에 ID 저장
  state.editingId = record.id;
  
  showView("view-detail");
}

// ===== 이벤트 바인딩 =====
function bindEvents() {
  // 하단 네비게이션
  $$(".nav-item").forEach(item => {
    item.addEventListener("click", () => {
      const viewId = item.dataset.view;
      showView(viewId);
    });
  });
  
  // 탭 버튼 (올해/이번달/평생)
  $$(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      $$(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.range = btn.dataset.range;
      renderHome();
    });
  });
  
  // 베스트 필터
  $("#best-filter").addEventListener("change", () => {
    renderBestList();
  });
  
  // 로컬 검색 입력
  $("#search-input").addEventListener("input", () => {
    renderLocalSearch();
  });
  
  // API 검색 입력 (디바운스 적용)
  $("#write-search-input").addEventListener("input", () => {
    clearTimeout(state.searchTimeout);
    state.searchTimeout = setTimeout(doAPISearch, 500);
  });
  
  // 검색 타입 탭
  $$(".search-type-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      $$(".search-type-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      state.searchType = tab.dataset.type;
      
      // 검색어가 있으면 다시 검색
      if ($("#write-search-input").value.trim()) {
        doAPISearch();
      }
    });
  });
  
  // Enter 키로 검색
  $("#write-search-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      clearTimeout(state.searchTimeout);
      doAPISearch();
    }
  });
  
  // 다음 버튼 (검색 → 별점)
  $("#btn-write-next-1").addEventListener("click", () => {
    if (state.selectedItem) {
      showView("view-write-rating");
    }
  });
  
  // 다음 버튼 (별점 → 감상평)
  $("#btn-write-next-2").addEventListener("click", () => {
    if (state.rating > 0) {
      showView("view-write-review");
    } else {
      showToast("별점을 선택해주세요.", true);
    }
  });
  
  // 저장 버튼
  $("#btn-save-record").addEventListener("click", saveRecord);
  
  // 수정 버튼
  $("#btn-edit-record").addEventListener("click", () => {
    const record = state.records.find(r => r.id === state.editingId);
    if (record) {
      state.selectedItem = {
        title: record.title,
        type: record.type,
        year: record.year,
        thumbnail: record.thumbnail
      };
      state.rating = record.rating || 0;
      showView("view-write-rating");
    }
  });
  
  // 삭제 버튼
  $("#btn-delete-record").addEventListener("click", () => {
    if (confirm("정말 삭제하시겠습니까?")) {
      deleteRecord(state.editingId);
      state.records = loadRecords();
      showToast("삭제되었습니다!");
      showView("view-home");
    }
  });
  
  // 컬렉션 추가 버튼 (감상평 화면)
  $("#btn-add-to-collection").addEventListener("click", () => {
    const name = prompt("추가할 컬렉션 이름:");
    if (name && name.trim()) {
      const tagsInput = $("#tags-input");
      const currentTags = tagsInput.value ? tagsInput.value.split(",").map(t => t.trim()) : [];
      if (!currentTags.includes(name.trim())) {
        currentTags.push(name.trim());
        tagsInput.value = currentTags.join(", ");
      }
    }
  });
}

// ===== 초기화 =====
function init() {
  bindEvents();
  showView("view-home");
}

// 앱 시작
document.addEventListener("DOMContentLoaded", init);
