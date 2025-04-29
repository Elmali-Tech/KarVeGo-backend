FROM node:18-slim

WORKDIR /app

# Önce package.json ve package-lock.json'ı kopyala
COPY package*.json ./

# Bağımlılıkları yükle
RUN npm ci --only=production

# Uygulama dosyalarını kopyala
COPY . .

# Port 3000'i dışarıya aç
EXPOSE 3000

# Uygulamayı başlat
CMD ["npm", "start"] 