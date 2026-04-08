import express from "express"
import { body } from "express-validator"
import {
  getAllPlantillas,
  getPlantillaById,
  createPlantilla,
  updatePlantilla,
  updatePlantillaCompleto,
  deletePlantilla,
  addProductToPlantilla,
  removeProductFromPlantilla,
  updateProductQuantity,
} from "../controllers/plantillaController.js"
import { authenticate } from "../middlewares/auth.js"
import { validate } from "../middlewares/validation.js"

const router = express.Router()

// Todas las rutas requieren autenticación
router.use(authenticate)

// Obtener todas las plantillas
router.get("/", getAllPlantillas)

// Obtener plantilla por ID
router.get("/:id", getPlantillaById)

// Crear plantilla
router.post("/", [body("nombre").notEmpty().withMessage("El nombre es requerido"), validate], createPlantilla)

// Actualizar plantilla + productos en un solo request (antes de PUT /:id genérico)
router.put(
  "/:id/completo",
  [
    body("nombre").notEmpty().withMessage("El nombre es requerido"),
    body("productos").isArray({ min: 1 }).withMessage("Debe incluir al menos un producto"),
    body("productos.*.producto_id").isInt({ min: 1 }).withMessage("Cada producto debe tener producto_id válido"),
    body("productos.*.cantidad_deseada")
      .isInt({ min: 1 })
      .withMessage("Cada cantidad deseada debe ser un entero mayor a 0"),
    validate,
  ],
  updatePlantillaCompleto,
)

// Actualizar plantilla
router.put("/:id", [body("nombre").notEmpty().withMessage("El nombre es requerido"), validate], updatePlantilla)

// Eliminar plantilla
router.delete("/:id", deletePlantilla)

// Agregar producto a plantilla
router.post(
  "/:id/productos",
  [
    body("producto_id").isInt().withMessage("El ID del producto es requerido"),
    body("cantidad_deseada").isInt({ min: 0 }).withMessage("La cantidad deseada debe ser un número positivo"),
    validate,
  ],
  addProductToPlantilla,
)

// Eliminar producto de plantilla
router.delete("/:id/productos/:producto_id", removeProductFromPlantilla)

// Actualizar cantidad deseada
router.put(
  "/:id/productos/:producto_id",
  [body("cantidad_deseada").isInt({ min: 0 }).withMessage("La cantidad deseada debe ser un número positivo"), validate],
  updateProductQuantity,
)

export default router
