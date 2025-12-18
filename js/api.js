// ===== 외부 API 연동 =====

// Google Books API로 책 검색
export async function searchBooks(query) {
  const q = query.trim();
  if (!q) return [];
  
  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=10`;
    const response = await fetch(url);
    
    if (!response.ok) throw new Error("API 요청 실패");
    
    const data = await response.json();
    
    return (data.items || []).map(item => ({
      id: item.id,
      title: item.volumeInfo?.title || "제목 없음",
      year: (item.volumeInfo?.publishedDate || "").slice(0, 4),
      author: (item.volumeInfo?.authors || []).join(", "),
      thumbnail: item.volumeInfo?.imageLinks?.thumbnail || null,
      description: item.volumeInfo?.description || "",
      type: "book"
    }));
  } catch (error) {
    console.error("책 검색 실패:", error);
    return [];
  }
}

// OMDB API로 영화 검색 (무료 API 키 필요 - 데모용으로 간단한 검색)
// 참고: 실제 서비스에서는 본인의 API 키를 사용하세요
export async function searchMovies(query) {
  const q = query.trim();
  if (!q) return [];
  
  try {
    // OMDB API (무료 버전, 일일 1000건 제한)
    // API 키가 없는 경우 더미 데이터 반환
    const apiKey = "3e974fca"; // 데모용 API 키 (자신의 키로 교체 권장)
    const url = `https://www.omdbapi.com/?apikey=${apiKey}&s=${encodeURIComponent(q)}&type=movie`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error("API 요청 실패");
    
    const data = await response.json();
    
    if (data.Response === "False") {
      return [];
    }
    
    return (data.Search || []).map(item => ({
      id: item.imdbID,
      title: item.Title,
      year: item.Year,
      thumbnail: item.Poster !== "N/A" ? item.Poster : null,
      type: "movie"
    }));
  } catch (error) {
    console.error("영화 검색 실패:", error);
    return [];
  }
}

// 통합 검색 (책 + 영화)
export async function searchAll(query) {
  const q = query.trim();
  if (!q) return [];
  
  try {
    const [books, movies] = await Promise.all([
      searchBooks(q),
      searchMovies(q)
    ]);
    
    // 번갈아가며 결과 합치기
    const result = [];
    const maxLength = Math.max(books.length, movies.length);
    
    for (let i = 0; i < maxLength; i++) {
      if (i < movies.length) result.push(movies[i]);
      if (i < books.length) result.push(books[i]);
    }
    
    return result.slice(0, 15); // 최대 15개만 반환
  } catch (error) {
    console.error("통합 검색 실패:", error);
    return [];
  }
}

// 네이버 검색 API를 프록시 없이 사용하기 어려우므로
// 간단한 수동 입력 모드도 지원
export function createManualEntry(title, type, year = "") {
  return {
    id: `manual-${Date.now()}`,
    title,
    type,
    year,
    thumbnail: null,
    isManual: true
  };
}
