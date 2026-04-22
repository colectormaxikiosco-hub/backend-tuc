import Product from "../models/Product.js"
import xlsx from "xlsx"

// Obtener todos los productos
export const getAllProducts = async (req, res, next) => {
  try {
    const { categoria, search } = req.query
    const products = await Product.findAll({ categoria, search })

    res.json({
      success: true,
      data: products,
    })
  } catch (error) {
    next(error)
  }
}

// Obtener producto por ID
export const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params
    const product = await Product.findById(id)

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Producto no encontrado",
      })
    }

    res.json({
      success: true,
      data: product,
    })
  } catch (error) {
    next(error)
  }
}

// Obtener producto por código
export const getProductByCode = async (req, res, next) => {
  try {
    const { codigo } = req.params
    const product = await Product.findByCode(codigo)

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Producto no encontrado",
      })
    }

    res.json({
      success: true,
      data: product,
    })
  } catch (error) {
    next(error)
  }
}

// Crear producto
export const createProduct = async (req, res, next) => {
  try {
    const productData = req.body
    const productId = await Product.create(productData)

    // Obtener el producto completo recién creado
    const newProduct = await Product.findById(productId)

    res.status(201).json({
      success: true,
      message: "Producto creado exitosamente",
      data: newProduct,
    })
  } catch (error) {
    next(error)
  }
}

// Actualizar producto
export const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params
    const productData = req.body

    const updated = await Product.update(id, productData)

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Producto no encontrado",
      })
    }

    res.json({
      success: true,
      message: "Producto actualizado exitosamente",
    })
  } catch (error) {
    next(error)
  }
}

// Eliminar producto
export const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params
    const deleted = await Product.delete(id)

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Producto no encontrado",
      })
    }

    res.json({
      success: true,
      message: "Producto eliminado exitosamente",
    })
  } catch (error) {
    next(error)
  }
}

// Cargar productos desde Excel
export const uploadExcel = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No se proporcionó ningún archivo",
      })
    }

    // Leer archivo Excel/CSV
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = xlsx.utils.sheet_to_json(worksheet)

    if (data.length === 0) {
      return res.status(400).json({
        success: false,
        message: "El archivo está vacío",
      })
    }

    const skippedInvalid = []

    const products = data.map((row, idx) => {
      const codigo = String(row.Codigo || row.codigo || row.CODIGO || "").trim()
      const nombre = String(row.Descripcion || row.descripcion || row.DESCRIPCION || row.Nombre || row.nombre || "").trim()
      const categoria = String(row.Rubro || row.rubro || row.RUBRO || row.Categoria || row.categoria || "").trim()
      const stock_sistema = Number.parseInt(row.Stock || row.stock || row.STOCK || 0, 10) || 0
      const precio = Number.parseFloat(row.Precio || row.precio || row.PRECIO || 0) || 0
      return { rowNumber: idx + 2, codigo, nombre, categoria, stock_sistema, precio }
    })

    const validProducts = []
    for (const p of products) {
      if (!p.codigo || !p.nombre) {
        const reasons = []
        if (!p.codigo) reasons.push("falta código")
        if (!p.nombre) reasons.push("falta nombre o descripción")
        skippedInvalid.push({
          fila: p.rowNumber,
          codigo: p.codigo || "—",
          nombre: p.nombre || "—",
          motivo: reasons.join("; "),
        })
        continue
      }
      validProducts.push({
        codigo: p.codigo,
        nombre: p.nombre,
        categoria: p.categoria,
        stock_sistema: p.stock_sistema,
        precio: p.precio,
      })
    }

    if (validProducts.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No hay filas válidas para importar (todas carecen de código o nombre)",
        data: {
          report: {
            mode: "full",
            totalFilasArchivo: data.length,
            procesadosOk: 0,
            insertados: 0,
            actualizados: 0,
            filasOmitidas: skippedInvalid,
            productosSinStock: [],
          },
        },
      })
    }

    const bulkResult = await Product.createBulk(validProducts)

    res.json({
      success: true,
      message: `Importación completada: ${bulkResult.inserted} nuevos, ${bulkResult.updated} actualizados`,
      data: {
        report: {
          mode: "full",
          totalFilasArchivo: data.length,
          procesadosOk: bulkResult.processed,
          insertados: bulkResult.inserted,
          actualizados: bulkResult.updated,
          filasOmitidas: skippedInvalid,
          productosSinStock: bulkResult.zeroStockProducts,
        },
      },
    })
  } catch (error) {
    next(error)
  }
}

// Actualizar solo el stock desde Excel
export const updateStockFromExcel = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No se proporcionó ningún archivo",
      })
    }

    // Leer archivo Excel/CSV
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = xlsx.utils.sheet_to_json(worksheet)

    if (data.length === 0) {
      return res.status(400).json({
        success: false,
        message: "El archivo está vacío",
      })
    }

    const skippedInvalid = []

    const stockUpdates = data.map((row, idx) => {
      const codigo = String(row.Codigo || row.codigo || row.CODIGO || "").trim()
      const stock_sistema = Number.parseInt(row.Stock || row.stock || row.STOCK || 0, 10) || 0
      const descripcionArchivo = String(
        row.Descripcion || row.descripcion || row.DESCRIPCION || row.Nombre || row.nombre || "",
      ).trim()
      const categoriaArchivo = String(row.Rubro || row.rubro || row.RUBRO || row.Categoria || row.categoria || "").trim()
      const precioRaw = row.Precio ?? row.precio ?? row.PRECIO
      const precioArchivo = precioRaw === undefined || precioRaw === null || precioRaw === "" ? null : Number.parseFloat(precioRaw)
      return {
        rowNumber: idx + 2,
        codigo,
        stock_sistema,
        descripcionArchivo: descripcionArchivo || null,
        categoriaArchivo: categoriaArchivo || null,
        precioArchivo: Number.isFinite(precioArchivo) ? precioArchivo : null,
      }
    })

    const validUpdates = []
    for (const row of stockUpdates) {
      if (!row.codigo) {
        skippedInvalid.push({
          fila: row.rowNumber,
          codigo: "—",
          nombre: row.descripcionArchivo || "—",
          motivo: "falta código",
        })
        continue
      }
      validUpdates.push({
        codigo: row.codigo,
        stock_sistema: row.stock_sistema,
        descripcionArchivo: row.descripcionArchivo,
        categoriaArchivo: row.categoriaArchivo,
        precioArchivo: row.precioArchivo,
      })
    }

    if (validUpdates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No hay filas con código válido para actualizar stock",
        data: {
          report: {
            mode: "stock",
            totalFilasArchivo: data.length,
            actualizadosEnBd: 0,
            sinCoincidencia: [],
            filasOmitidas: skippedInvalid,
            productosSinStockEnArchivo: [],
          },
        },
      })
    }

    const stockResult = await Product.updateStockBulk(validUpdates)

    const sinStockEnArchivo = validUpdates.filter((u) => u.stock_sistema === 0).map((u) => ({
      codigo: u.codigo,
      nombre: u.descripcionArchivo || null,
    }))

    res.json({
      success: true,
      message: `Actualización completada: ${stockResult.updated} actualizados, ${stockResult.inserted} agregados`,
      data: {
        report: {
          mode: "stock",
          totalFilasArchivo: data.length,
          intentosValidos: validUpdates.length,
          actualizadosEnBd: stockResult.updated,
          insertados: stockResult.inserted,
          sinCoincidencia: stockResult.notFound.map((n) => ({
            codigo: n.codigo,
            nombreArchivo: n.descripcionArchivo || null,
            motivo: n.motivo || "No se pudo procesar esta fila",
          })),
          filasOmitidas: skippedInvalid,
          productosSinStockEnArchivo: sinStockEnArchivo,
        },
      },
    })
  } catch (error) {
    next(error)
  }
}

// Obtener categorías
export const getCategories = async (req, res, next) => {
  try {
    const categories = await Product.getCategories()

    res.json({
      success: true,
      data: categories,
    })
  } catch (error) {
    next(error)
  }
}

// Eliminar todos los productos
export const deleteAllProducts = async (req, res, next) => {
  try {
    const deleted = await Product.deleteAll()

    res.json({
      success: true,
      message: `${deleted} productos eliminados exitosamente`,
      data: { deleted },
    })
  } catch (error) {
    next(error)
  }
}
