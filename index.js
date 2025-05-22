import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import crypto from "crypto";

// .env dosyasını yükle
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const SHOPIFY_WEBHOOK_SECRET = "918f092b39dfb13f4c36b2eb781ad044";

app.use(
  cors({
    origin: [
      "http://localhost:5173", // local geliştirme
      "https://karvego.com",   // kendi domaininiz
      "https://www.karvego.com", // www versiyonu da varsa
      "https://karvego-874729167381.europe-west1.run.app",
      "https://karvego-backend-900677923244.europe-west1.run.app",
      "https://stopping-prospective-unity-standards.trycloudflare.com"
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// JSON body parser
app.use(express.json());

// Sürat Kargo API bilgileri
const SURAT_KARGO_API_URL = "https://api01.suratkargo.com.tr";
const SURAT_KARGO_USERNAME = "1472651760";
const SURAT_KARGO_PASSWORD = "Kargo.2025";
const SURAT_KARGO_CANCEL_CARI_KODU = "1472651760";
const SURAT_KARGO_CANCEL_PASSWORD = "kARGO.2025";

// Alan uzunluk sınırlamaları
const FIELD_LENGTH_LIMITS = {
  ReferansNo: 15,
  OzelKargoTakipNo: 10,
  AliciKodu: 10,
  KargoIcerigi: 100,
  KisiKurum: 40,
  AliciAdresi: 100,
  SevkAdresi: 30
};

// Ana endpoint
app.get("/", (req, res) => {
  res.send("Karvego API Proxy Server çalışıyor");
});

// Sürat Kargo ortak Barkod Oluşturma endpoint'i
app.post("/api/surat-kargo/barkod-olustur", async (req, res) => {
  try {
    console.log("Sürat Kargo isteği alındı:", {
      ...req.body,
      password: "******",
    });

    // Alan uzunluklarını kontrol et ve kısalt
    const sanitizedGonderi = { ...req.body.Gonderi };
    
    // Alan uzunluklarını sınırla
    Object.keys(FIELD_LENGTH_LIMITS).forEach(fieldName => {
      if (sanitizedGonderi[fieldName] && typeof sanitizedGonderi[fieldName] === 'string') {
        if (sanitizedGonderi[fieldName].length > FIELD_LENGTH_LIMITS[fieldName]) {
          console.log(`${fieldName} alanı kısaltıldı: ${sanitizedGonderi[fieldName].length} -> ${FIELD_LENGTH_LIMITS[fieldName]}`);
          sanitizedGonderi[fieldName] = sanitizedGonderi[fieldName].substring(0, FIELD_LENGTH_LIMITS[fieldName]);
        }
      }
    });
    
    // İl ve ilçe kontrolü
    if (sanitizedGonderi.Il === "İstanbul" && !isValidIstanbulDistrict(sanitizedGonderi.Ilce)) {
      console.log(`Geçersiz İstanbul ilçesi: ${sanitizedGonderi.Ilce}, Üsküdar ile değiştiriliyor`);
      sanitizedGonderi.Ilce = "Üsküdar";
    }
    
    // OzelKargoTakipNo kontrolü ve düzeltme
    if (!sanitizedGonderi.OzelKargoTakipNo || sanitizedGonderi.OzelKargoTakipNo.length > FIELD_LENGTH_LIMITS.OzelKargoTakipNo) {
      // 3636 ile başlayan bir takip numarası oluştur
      const randomCode = Math.floor(Math.random() * 1000000).toString();
      sanitizedGonderi.OzelKargoTakipNo = `3636${randomCode}`.substring(0, FIELD_LENGTH_LIMITS.OzelKargoTakipNo);
      console.log(`OzelKargoTakipNo otomatik oluşturuldu: ${sanitizedGonderi.OzelKargoTakipNo}`);
    } else if (!sanitizedGonderi.OzelKargoTakipNo.startsWith("3636")) {
      // Eğer 3636 ile başlamıyorsa, başına 3636 ekle ve sınırı aşmayacak şekilde kısalt
      sanitizedGonderi.OzelKargoTakipNo = `3636${sanitizedGonderi.OzelKargoTakipNo}`.substring(0, FIELD_LENGTH_LIMITS.OzelKargoTakipNo);
      console.log(`OzelKargoTakipNo 3636 ile başlayacak şekilde düzeltildi: ${sanitizedGonderi.OzelKargoTakipNo}`);
    }

    // ReferansNo çok uzunsa özgün bir kısaltma oluştur
    if (!sanitizedGonderi.ReferansNo || sanitizedGonderi.ReferansNo.length > FIELD_LENGTH_LIMITS.ReferansNo) {
      // Benzersiz ve kısa bir referans numarası oluştur
      const randomCode = Math.floor(Math.random() * 1000000).toString();
      sanitizedGonderi.ReferansNo = `REF-${randomCode}`;
      console.log(`ReferansNo otomatik oluşturuldu: ${sanitizedGonderi.ReferansNo}`);
    }

    // API için istek payload'ını oluştur
    const request = {
      KullaniciAdi: SURAT_KARGO_USERNAME,
      Sifre: SURAT_KARGO_PASSWORD,
      Gonderi: sanitizedGonderi,
    };

    console.log("Sürat Kargo API'sine istek gönderiliyor");
    console.log("Gönderilen veri:", JSON.stringify(request, null, 2));
    
    // API isteği gönder
    const response = await axios.post(
      `${SURAT_KARGO_API_URL}/api/OrtakBarkodOlustur`,
      request,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Sürat Kargo API yanıtı alındı", response.data);

    // API yanıtını dönüştür ve istemciye gönder
    const data = response.data;

    if (data.isError) {
      throw new Error(
        data.Message || "Kargo etiketi oluşturulurken bir hata oluştu"
      );
    }

    // API yanıtını formatla ve gönder
    res.json({
      Message: data.Message,
      IsError: data.isError,
      StatusCode: 200,
      Value: {
        Barkod: data.BarcodeNo[0],
        ZplKodu: data.Barcode[0],
        KargoTakipNo: data.KargoTakipNo,
      },
    });
  } catch (error) {
    console.error("Sürat Kargo API Hatası:", error.message);
    console.error("Tam hata:", error.response ? error.response.data : error);

    // Hata durumunda gerçek hata mesajını gönder
    res.status(400).json({
      Message: error.response?.data?.Message || error.message || "Kargo etiketi oluşturulurken bir hata oluştu",
      IsError: true,
      StatusCode: 400,
      Value: null,
    });
  }
});

// Yeni Sürat Kargo GonderiyiKargoyaGonder endpointi
app.post("/api/surat-kargo/gonderiye-gonder", async (req, res) => {
  try {
    console.log("Sürat Kargo Gönderiye Gönder isteği alındı:", {
      ...req.body,
      Sifre: "******",
    });

    // Alan uzunluklarını kontrol et ve kısalt
    const sanitizedGonderi = { ...req.body.Gonderi };
    
    // Alan uzunluklarını sınırla
    Object.keys(FIELD_LENGTH_LIMITS).forEach(fieldName => {
      if (sanitizedGonderi[fieldName] && typeof sanitizedGonderi[fieldName] === 'string') {
        if (sanitizedGonderi[fieldName].length > FIELD_LENGTH_LIMITS[fieldName]) {
          console.log(`${fieldName} alanı kısaltıldı: ${sanitizedGonderi[fieldName].length} -> ${FIELD_LENGTH_LIMITS[fieldName]}`);
          sanitizedGonderi[fieldName] = sanitizedGonderi[fieldName].substring(0, FIELD_LENGTH_LIMITS[fieldName]);
        }
      }
    });
    
    // İl ve ilçe kontrolü
    if (sanitizedGonderi.Il === "İstanbul" && !isValidIstanbulDistrict(sanitizedGonderi.Ilce)) {
      console.log(`Geçersiz İstanbul ilçesi: ${sanitizedGonderi.Ilce}, Üsküdar ile değiştiriliyor`);
      sanitizedGonderi.Ilce = "Üsküdar";
    }

    // API için istek payload'ını oluştur
    const request = {
      KullaniciAdi: SURAT_KARGO_USERNAME,
      Sifre: SURAT_KARGO_PASSWORD,
      Gonderi: sanitizedGonderi,
    };

    console.log("Sürat Kargo API'sine istek gönderiliyor");
    console.log("Gönderilen veri:", JSON.stringify(request, null, 2));
    
    // Yeni API endpointi çağrısı
    const response = await axios.post(
      `${SURAT_KARGO_API_URL}/api/GonderiyiKargoyaGonder`,
      request,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Sürat Kargo API yanıtı alındı", response.data);

    // API yanıtını dönüştür ve istemciye gönder
    const data = response.data;

    if (data.isError) {
      throw new Error(
        data.Message || "Kargo etiketi oluşturulurken bir hata oluştu"
      );
    }

    // API yanıtını formatla ve gönder
    res.json({
      Message: data.Message || `${sanitizedGonderi.OzelKargoTakipNo} nolu kayıt başarıyla oluşturuldu`,
      IsError: data.isError || false,
      StatusCode: 200,
      Value: null
    });
  } catch (error) {
    console.error("Sürat Kargo GonderiyiKargoyaGonder API Hatası:", error.message);
    console.error("Tam hata:", error.response ? error.response.data : error);

    // Hata durumunda gerçek hata mesajını gönder
    res.status(400).json({
      Message: error.response?.data?.Message || error.message || "Kargo etiketi oluşturulurken bir hata oluştu",
      IsError: true,
      StatusCode: 400,
      Value: null,
    });
  }
});

// İstanbul ilçesi geçerli mi kontrolü
function isValidIstanbulDistrict(district) {
  const validDistricts = [
    "Adalar", "Arnavutköy", "Ataşehir", "Avcılar", "Bağcılar", 
    "Bahçelievler", "Bakırköy", "Başakşehir", "Bayrampaşa", "Beşiktaş", 
    "Beykoz", "Beylikdüzü", "Beyoğlu", "Büyükçekmece", "Çatalca", 
    "Çekmeköy", "Esenler", "Esenyurt", "Eyüpsultan", "Fatih", 
    "Gaziosmanpaşa", "Güngören", "Kadıköy", "Kağıthane", "Kartal", 
    "Küçükçekmece", "Maltepe", "Pendik", "Sancaktepe", "Sarıyer", 
    "Silivri", "Sultanbeyli", "Sultangazi", "Şile", "Şişli", 
    "Tuzla", "Ümraniye", "Üsküdar", "Zeytinburnu"
  ];
  
  return validDistricts.includes(district);
}


app.post('/api/surat-kargo/cancel-label', async (req, res) => {
  try {
    const { trackingNumber } = req.body;
    console.log('Etiket iptal isteği alındı:', { trackingNumber });
    
    const apiUrl = `${SURAT_KARGO_API_URL}/api/GonderiSil?CariKodu=${SURAT_KARGO_CANCEL_CARI_KODU}&Sifre=${SURAT_KARGO_CANCEL_PASSWORD}&WebSiparisKodu=${trackingNumber}`;
    console.log('Sürat Kargo API isteği:', { url: apiUrl });
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log('Sürat Kargo API yanıtı:', { 
      status: response.status, 
      statusText: response.statusText 
    });

    const data = await response.json();
    console.log('Sürat Kargo API yanıt verisi:', data);
    
    if (!response.ok) {
      throw new Error(data.Message || 'Etiket iptal edilirken bir hata oluştu');
    }

    res.json({ success: true, message: 'Etiket başarıyla iptal edildi' });
  } catch (error) {
    console.error('Sürat Kargo etiket iptal hatası:', error);
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Etiket iptal edilirken bir hata oluştu' 
    });
  }
});

// GDPR webhook endpoints for Shopify App
app.post('/gdpr/customer-data-request', (req, res) => {
  console.log('GDPR Customer Data Request:', req.body);
  res.status(200).json({ success: true });
});

app.post('/gdpr/customer-erasure', (req, res) => {
  console.log('GDPR Customer Erasure Request:', req.body);
  res.status(200).json({ success: true });
});

function verifyShopifyHmac(req, secret) {
  const hmacHeader = req.get('X-Shopify-Hmac-Sha256') || '';
  const body = JSON.stringify(req.body);
  const hash = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64');
  return crypto.timingSafeEqual(Buffer.from(hmacHeader, 'utf8'), Buffer.from(hash, 'utf8'));
}

app.post('/gdpr/shop-erasure', (req, res) => {
  const isValid = verifyShopifyHmac(req, process.env.SHOPIFY_WEBHOOK_SECRET);

  if (!isValid) {
    console.warn("Invalid HMAC for /gdpr/shop-erasure");
    return res.status(401).send("Unauthorized");
  }

  console.log('Valid GDPR Shop Erasure Request:', req.body);
  res.status(200).json({ success: true });
});

// Server'ı başlat
app.listen(port, () => {
  console.log(`Karvego API Proxy Server şu portta çalışıyor: ${port}`);
});
