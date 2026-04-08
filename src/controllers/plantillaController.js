import Plantilla from "../models/Plantilla.js"

// Obtener todas las plantillas
export const getAllPlantillas = async (req, res, next) => {
  try {
    const { usuario_id } = req.query
    const plantillas = await Plantilla.findAll(usuario_id)

    res.json({
      success: true,
      data: plantillas,
    })
  } catch (error) {
    next(error)
  }
}

// Obtener plantilla por ID
export const getPlantillaById = async (req, res, next) => {
  try {
    const { id } = req.params
    const plantilla = await Plantilla.findById(id)

    if (!plantilla) {
      return res.status(404).json({
        success: false,
        message: "Plantilla no encontrada",
      })
    }

    res.json({
      success: true,
      data: plantilla,
    })
  } catch (error) {
    next(error)
  }
}

// Crear plantilla
export const createPlantilla = async (req, res, next) => {
  try {
    const { nombre, descripcion } = req.body
    const usuario_id = req.user.id

    const plantillaId = await Plantilla.create({ nombre, descripcion, usuario_id })

    res.status(201).json({
      success: true,
      message: "Plantilla creada exitosamente",
      data: { id: plantillaId },
    })
  } catch (error) {
    next(error)
  }
}

// Actualizar plantilla
export const updatePlantilla = async (req, res, next) => {
  try {
    const { id } = req.params
    const { nombre, descripcion } = req.body

    const updated = await Plantilla.update(id, { nombre, descripcion })

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Plantilla no encontrada",
      })
    }

    res.json({
      success: true,
      message: "Plantilla actualizada exitosamente",
    })
  } catch (error) {
    next(error)
  }
}

// Actualizar plantilla + reemplazar lista de productos en una sola transacción
export const updatePlantillaCompleto = async (req, res, next) => {
  try {
    const { id } = req.params
    const { nombre, descripcion, productos } = req.body

    const idsEnOrden = productos.map((p) => p.producto_id)
    const idSet = new Set(idsEnOrden)
    if (idSet.size !== idsEnOrden.length) {
      return res.status(400).json({
        success: false,
        message: "La lista contiene el mismo producto más de una vez",
      })
    }

    const result = await Plantilla.syncCompleto(Number.parseInt(id, 10), {
      nombre,
      descripcion: descripcion ?? "",
      productos,
    })

    if (!result.ok) {
      if (result.code === "NOT_FOUND") {
        return res.status(404).json({
          success: false,
          message: "Plantilla no encontrada",
        })
      }
      if (result.code === "DUPLICATE_PRODUCTOS") {
        return res.status(400).json({
          success: false,
          message: "La lista contiene el mismo producto más de una vez",
        })
      }
      if (result.code === "INVALID_PRODUCTOS") {
        return res.status(400).json({
          success: false,
          message: "Uno o más productos no existen en el catálogo",
        })
      }
    }

    const plantilla = await Plantilla.findById(id)

    res.json({
      success: true,
      message: "Plantilla actualizada correctamente",
      data: plantilla,
    })
  } catch (error) {
    next(error)
  }
}

// Eliminar plantilla
export const deletePlantilla = async (req, res, next) => {
  try {
    const { id } = req.params
    const deleted = await Plantilla.delete(id)

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Plantilla no encontrada",
      })
    }

    res.json({
      success: true,
      message: "Plantilla eliminada exitosamente",
    })
  } catch (error) {
    next(error)
  }
}

// Agregar producto a plantilla
export const addProductToPlantilla = async (req, res, next) => {
  try {
    const { id } = req.params
    const { producto_id, cantidad_deseada } = req.body

    await Plantilla.addProduct(id, producto_id, cantidad_deseada)

    res.json({
      success: true,
      message: "Producto agregado a la plantilla exitosamente",
    })
  } catch (error) {
    next(error)
  }
}

// Eliminar producto de plantilla
export const removeProductFromPlantilla = async (req, res, next) => {
  try {
    const { id, producto_id } = req.params

    const deleted = await Plantilla.removeProduct(id, producto_id)

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Producto no encontrado en la plantilla",
      })
    }

    res.json({
      success: true,
      message: "Producto eliminado de la plantilla exitosamente",
    })
  } catch (error) {
    next(error)
  }
}

// Actualizar cantidad deseada de un producto
export const updateProductQuantity = async (req, res, next) => {
  try {
    const { id, producto_id } = req.params
    const { cantidad_deseada } = req.body

    const updated = await Plantilla.updateProductQuantity(id, producto_id, cantidad_deseada)

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Producto no encontrado en la plantilla",
      })
    }

    res.json({
      success: true,
      message: "Cantidad actualizada exitosamente",
    })
  } catch (error) {
    next(error)
  }
}
