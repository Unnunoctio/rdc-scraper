# Usamos la imagen oficial de Bun
FROM oven/bun:1.1.14-slim

# Establecemos el directorio de trabajo
WORKDIR /app

# Copiamos package.json y bun.lockb (si existe)
COPY package.json bun.lockb* ./

# Instalamos las dependencias
RUN bun install --frozen-lockfile --production

# Copiamos el resto del código de la aplicación
COPY . .

# Configuramos las variables de entorno
ENV NODE_ENV=production

# Exponemos el puerto (asumiendo que su aplicación usa el puerto 3000)
EXPOSE 3000

# Ejecutamos la aplicación
CMD ["bun", "src/index.ts"]