# Karvego Backend Proxy Server

Karvego uygulaması için Sürat Kargo API Proxy sunucusu. Bu sunucu, tarayıcıdaki CORS kısıtlamalarını aşmak için kullanılmaktadır.

## Kurulum

1. Gerekli bağımlılıkları yükleyin:
```
cd backend
npm install
```

2. `.env` dosyası oluşturun:
```
PORT=3000
SURAT_KARGO_API_URL=https://api01.suratkargo.com.tr
SURAT_KARGO_USERNAME=your_username
SURAT_KARGO_PASSWORD=your_password
```

3. Sunucuyu başlatın:
```
npm run dev
```

## Endpointler

- `GET /`: Server durumunu kontrol etmek için
- `POST /api/surat-kargo/barkod-olustur`: Sürat Kargo barkod oluşturma API'sine proxy
- `GET /api/surat-kargo/test`: Test amaçlı mock veri döndürür

## Kullanım

Frontend tarafında, doğrudan Sürat Kargo API'sine istek yapmak yerine, bu proxy sunucusuna istek yapmanız gerekiyor. Böylece CORS hatalarından kaçınmış olursunuz.

Örnek:
```javascript
// Doğrudan API'ye istek yapmak (CORS hatası verir)
fetch('https://api01.suratkargo.com.tr/api/OrtakBarkodOlustur', {...})

// Proxy sunucusu üzerinden istek yapmak (CORS hatası vermez)
fetch('http://localhost:3000/api/surat-kargo/barkod-olustur', {...})
``` 