# KarVeGo Backend

Karvego için Sürat Kargo API proxy sunucusu

## Başlangıç

Projeyi yerel makinenizde çalıştırmak için:

```bash
# Bağımlılıkları yükleyin
npm install

# Geliştirme modunda çalıştırın
npm run dev

# Prodüksiyon modunda çalıştırın
npm start
```

Sunucu varsayılan olarak http://localhost:3000 adresinde çalışacaktır.

## Google Cloud Run Deployment

Uygulamayı Google Cloud Run'a deploy etmek için aşağıdaki adımları takip edin:

### Ön Gereksinimler

1. Google Cloud SDK kurulumu
2. Docker kurulumu
3. Bir Google Cloud hesabı ve aktif bir proje

### Deploy Adımları

1. Google Cloud'a giriş yapın:
```bash
gcloud auth login
```

2. Google Cloud projenizi ayarlayın:
```bash
gcloud config set project karvego-backend
```

3. Docker imajını oluşturun:
```bash
docker build -t gcr.io/karvego-backend/karvego-backend .
```

4. İmajı Google Container Registry'ye gönderin:
```bash
docker push gcr.io/karvego-backend/karvego-backend
```

5. Cloud Run'a deploy edin:
```bash
gcloud run deploy karvego-backend --image gcr.io/karvego-backend/karvego-backend --platform managed --region europe-west1 --allow-unauthenticated --min-instances=0 --max-instances=10
```

Deploy işlemi tamamlandığında, Google Cloud size bir URL verecektir.

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