// ===== 웹 스토리지 관리 =====
const RECORDS_KEY = "movie_book_records";
const COLLECTIONS_KEY = "collections";

// 모든 기록 불러오기
export function loadRecords() {
  try {
    const data = localStorage.getItem(RECORDS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("기록 불러오기 실패:", error);
    return [];
  }
}

// 모든 기록 저장하기
export function saveRecords(records) {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
    return true;
  } catch (error) {
    console.error("기록 저장 실패:", error);
    return false;
  }
}

// 새 기록 추가 또는 기존 기록 수정
export function upsertRecord(record) {
  const records = loadRecords();
  const index = records.findIndex(r => r.id === record.id);
  
  if (index >= 0) {
    records[index] = { ...records[index], ...record, updatedAt: Date.now() };
  } else {
    records.unshift({
      ...record,
      id: record.id || generateId(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }
  
  saveRecords(records);
  return record;
}

// 기록 삭제
export function deleteRecord(id) {
  const records = loadRecords();
  const filtered = records.filter(r => r.id !== id);
  saveRecords(filtered);
}

// 고유 ID 생성
export function generateId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// 컬렉션 불러오기
export function loadCollections() {
  try {
    const data = localStorage.getItem(COLLECTIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("컬렉션 불러오기 실패:", error);
    return [];
  }
}

// 컬렉션 저장하기
export function saveCollections(collections) {
  try {
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
    return true;
  } catch (error) {
    console.error("컬렉션 저장 실패:", error);
    return false;
  }
}

// 새 컬렉션 추가
export function addCollection(name) {
  const collections = loadCollections();
  if (!collections.includes(name)) {
    collections.push(name);
    saveCollections(collections);
  }
  return collections;
}

// 기록 검색
export function searchRecords(query, type = "all") {
  const records = loadRecords();
  const q = query.toLowerCase().trim();
  
  return records.filter(record => {
    // 타입 필터
    if (type !== "all" && record.type !== type) return false;
    
    // 검색어가 없으면 전체 반환
    if (!q) return true;
    
    // 제목, 감상평, 태그에서 검색
    const title = (record.title || "").toLowerCase();
    const note = (record.note || "").toLowerCase();
    const tags = (record.tags || []).join(",").toLowerCase();
    
    return title.includes(q) || note.includes(q) || tags.includes(q);
  });
}

// 이번 달 최고작 가져오기
export function getMonthlyBest(type = "all", limit = 5) {
  const records = loadRecords();
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  return records
    .filter(record => {
      if (type !== "all" && record.type !== type) return false;
      
      if (!record.date) return false;
      const date = new Date(record.date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    })
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit);
}

// 통계 가져오기
export function getStats(range = "year") {
  const records = loadRecords();
  const now = new Date();
  
  const filtered = records.filter(record => {
    if (range === "all") return true;
    if (!record.date) return false;
    
    const date = new Date(record.date);
    if (range === "year") return date.getFullYear() === now.getFullYear();
    if (range === "month") {
      return date.getFullYear() === now.getFullYear() && 
             date.getMonth() === now.getMonth();
    }
    return true;
  });
  
  const books = filtered.filter(r => r.type === "book").length;
  const movies = filtered.filter(r => r.type === "movie").length;
  const avgRating = filtered.length > 0 
    ? filtered.reduce((sum, r) => sum + (r.rating || 0), 0) / filtered.length 
    : 0;
  
  return { books, movies, avgRating, total: filtered.length };
}

// JSON 내보내기
export function exportToJSON() {
  const records = loadRecords();
  const collections = loadCollections();
  const data = { records, collections, exportedAt: new Date().toISOString() };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = `movie_book_records_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
}

// JSON 가져오기
export async function importFromJSON(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  
  if (data.records && Array.isArray(data.records)) {
    saveRecords(data.records);
  }
  
  if (data.collections && Array.isArray(data.collections)) {
    saveCollections(data.collections);
  }
  
  return { 
    recordsCount: data.records?.length || 0,
    collectionsCount: data.collections?.length || 0
  };
}
