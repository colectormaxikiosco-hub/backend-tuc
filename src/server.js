import express from "express"
import cors from "cors"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import dotenv from "dotenv"
import { testConnection } from "./config/database.js"
import { errorHandler, notFound } from "./middlewares/errorHandler.js"

// Importar rutas
import authRoutes from "./routes/auth.routes.js"
import userRoutes from "./routes/user.routes.js"
import productRoutes from "./routes/product.routes.js"
import plantillaRoutes from "./routes/plantilla.routes.js"
import conteoRoutes from "./routes/conteo.routes.js"

dotenv.config()

process.on("uncaughtException", (error) => {
  console.error("\n❌ ERROR NO CAPTURADO:")
  console.error("Mensaje:", error.message)
  console.error("Stack:", error.stack)
  console.error("\n")
  // En producción, salir del proceso para que el gestor de procesos lo reinicie
  if (process.env.NODE_ENV === "production") {
    process.exit(1)
  }
})

process.on("unhandledRejection", (reason, promise) => {
  console.error("\n❌ PROMESA RECHAZADA NO MANEJADA:")
  console.error("Razón:", reason)
  console.error("Promesa:", promise)
  console.error("\n")
  // En producción, salir del proceso para que el gestor de procesos lo reinicie
  if (process.env.NODE_ENV === "production") {
    process.exit(1)
  }
})

const app = express()
const PORT = process.env.PORT || 5000
const isProduction = process.env.NODE_ENV === "production"

const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",")
  : ["http://localhost:5173", "http://localhost:3000"]

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir requests sin origin (como mobile apps o curl)
      if (!origin) return callback(null, true)

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true)
      } else {
        callback(new Error("No permitido por CORS"))
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
)

app.use(
  helmet({
    contentSecurityPolicy: isProduction,
    crossOriginEmbedderPolicy: isProduction,
  }),
)

// Body parser
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

if (!isProduction) {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
    next()
  })
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 100 : 1000,
  message: "Demasiadas peticiones desde esta IP, por favor intenta de nuevo más tarde",
  standardHeaders: true,
  legacyHeaders: false,
})
app.use("/api/", limiter)

if (!isProduction) {
  app.use((err, req, res, next) => {
    console.error("\n❌ ERROR EN MIDDLEWARE:")
    console.error("Ruta:", req.path)
    console.error("Método:", req.method)
    console.error("Error:", err.message)
    console.error("Stack:", err.stack)
    console.error("\n")
    next(err)
  })
}

// Rutas
app.use("/api/auth", authRoutes)
app.use("/api/users", userRoutes)
app.use("/api/products", productRoutes)
app.use("/api/plantillas", plantillaRoutes)
app.use("/api/conteos", conteoRoutes)

// Ruta de health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "API funcionando correctamente",
    sucursal: "Maxikiosco Tuc",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  })
})

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Sistema Colector de Datos - Maxikiosco Tuc (API)",
    sucursal: "Maxikiosco Tuc",
    version: "1.0.0",
    status: "online",
  })
})

// Manejo de errores
app.use(notFound)
app.use(errorHandler)

// Iniciar servidor
const startServer = async () => {
  try {
    if (!isProduction) {
      console.log("\n🔄 Iniciando servidor...")
      console.log("📋 Configuración:")
      console.log("   - Puerto:", PORT)
      console.log("   - Entorno:", process.env.NODE_ENV || "development")
      console.log("   - Frontend URL:", allowedOrigins.join(", "))
      console.log("   - Base de datos:", process.env.DB_NAME || "sistema_colector")
      console.log("\n🔌 Conectando a la base de datos...")
    }

    // Verificar conexión a la base de datos
    const dbConnected = await testConnection()

    if (!dbConnected) {
      console.error("\n❌ ERROR: No se pudo conectar a la base de datos")
      if (!isProduction) {
        console.error("Verifica que MySQL esté corriendo y las credenciales sean correctas")
        console.error("Configuración actual:")
        console.error("   - Host:", process.env.DB_HOST || "localhost")
        console.error("   - Usuario:", process.env.DB_USER || "root")
        console.error("   - Base de datos:", process.env.DB_NAME || "sistema_colector")
      }
      console.error("\n")
      process.exit(1)
    }

    app.listen(PORT, "0.0.0.0", () => {
      if (isProduction) {
        console.log(`✅ Servidor en producción corriendo en puerto ${PORT}`)
      } else {
        console.log("\n✅ SERVIDOR INICIADO CORRECTAMENTE")
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        console.log(`🚀 Servidor corriendo en puerto ${PORT}`)
        console.log(`📍 Entorno: ${process.env.NODE_ENV || "development"}`)
        console.log(`🌐 API disponible en: http://localhost:${PORT}/api`)
        console.log(`💚 Health check: http://localhost:${PORT}/api/health`)
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
      }
    })
  } catch (error) {
    console.error("\n❌ ERROR FATAL AL INICIAR EL SERVIDOR:")
    console.error("Mensaje:", error.message)
    if (!isProduction) {
      console.error("Stack:", error.stack)
    }
    console.error("\n") 
    process.exit(1)
  }
}

startServer()
  