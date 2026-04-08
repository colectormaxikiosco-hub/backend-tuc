import pool from "../config/database.js"

class Product {
  // Crear producto
  static async create(productData) {
    const { codigo, nombre, categoria, stock_sistema, precio } = productData

    const [result] = await pool.execute(
      "INSERT INTO productos (codigo, nombre, categoria, stock_sistema, precio) VALUES (?, ?, ?, ?, ?)",
      [codigo, nombre, categoria || "", stock_sistema || 0, precio || 0],
    )

    return result.insertId
  }

  // Crear múltiples productos (para carga desde Excel)
  static async createBulk(products) {
    const connection = await pool.getConnection()

    const zeroStockProducts = []
    let inserted = 0
    let updated = 0

    try {
      await connection.beginTransaction()

      const batchSize = 100

      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize)

        for (const product of batch) {
          const { codigo, nombre, categoria, stock_sistema, precio } = product
          const stock = stock_sistema ?? 0

          if (stock === 0) {
            zeroStockProducts.push({ codigo, nombre })
          }

          const [existing] = await connection.execute("SELECT id FROM productos WHERE codigo = ?", [codigo])

          if (existing.length > 0) {
            await connection.execute(
              "UPDATE productos SET nombre = ?, categoria = ?, stock_sistema = ?, precio = ?, fecha_actualizacion = NOW() WHERE codigo = ?",
              [nombre, categoria, stock, precio, codigo],
            )
            updated++
          } else {
            await connection.execute(
              "INSERT INTO productos (codigo, nombre, categoria, stock_sistema, precio) VALUES (?, ?, ?, ?, ?)",
              [codigo, nombre, categoria, stock, precio],
            )
            inserted++
          }
        }
      }

      await connection.commit()
      return {
        processed: products.length,
        inserted,
        updated,
        zeroStockProducts,
      }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  // Obtener todos los productos
  static async findAll(filters = {}) {
    let query = "SELECT * FROM productos WHERE 1=1"
    const params = []

    if (filters.categoria) {
      query += " AND categoria = ?"
      params.push(filters.categoria)
    }

    if (filters.search) {
      query += " AND (nombre LIKE ? OR codigo LIKE ?)"
      params.push(`%${filters.search}%`, `%${filters.search}%`)
    }

    query += " ORDER BY nombre ASC"

    const [rows] = await pool.execute(query, params)
    return rows
  }

  // Obtener producto por ID
  static async findById(id) {
    const [rows] = await pool.execute("SELECT * FROM productos WHERE id = ?", [id])
    return rows[0]
  }

  // Obtener producto por código
  static async findByCode(codigo) {
    const [rows] = await pool.execute("SELECT * FROM productos WHERE codigo = ?", [codigo])
    return rows[0]
  }

  // Actualizar producto
  static async update(id, productData) {
    const { codigo, nombre, categoria, stock_sistema, precio } = productData

    const [result] = await pool.execute(
      "UPDATE productos SET codigo = ?, nombre = ?, categoria = ?, stock_sistema = ?, precio = ?, fecha_actualizacion = NOW() WHERE id = ?",
      [codigo, nombre, categoria, stock_sistema, precio, id],
    )

    return result.affectedRows > 0
  }

  // Actualizar solo el stock del sistema
  static async updateStock(id, stock_sistema) {
    const [result] = await pool.execute(
      "UPDATE productos SET stock_sistema = ?, fecha_actualizacion = NOW() WHERE id = ?",
      [stock_sistema, id],
    )

    return result.affectedRows > 0
  }

  // Actualizar solo stock en lote — devuelve conteo y códigos sin coincidencia en BD
  static async updateStockBulk(stockUpdates) {
    const connection = await pool.getConnection()

    try {
      await connection.beginTransaction()

      let updated = 0
      const notFound = []

      const batchSize = 100
      for (let i = 0; i < stockUpdates.length; i += batchSize) {
        const batch = stockUpdates.slice(i, i + batchSize)

        for (const item of batch) {
          const { codigo, stock_sistema } = item

          const [result] = await connection.execute(
            "UPDATE productos SET stock_sistema = ?, fecha_actualizacion = NOW() WHERE codigo = ?",
            [stock_sistema, codigo],
          )

          if (result.affectedRows > 0) {
            updated++
          } else {
            notFound.push({
              codigo,
              descripcionArchivo: item.descripcionArchivo || null,
            })
          }
        }
      }

      await connection.commit()
      return {
        updated,
        notFound,
        totalAttempted: stockUpdates.length,
      }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  // Eliminar producto
  static async delete(id) {
    const [result] = await pool.execute("DELETE FROM productos WHERE id = ?", [id])

    return result.affectedRows > 0
  }

  // Obtener categorías únicas
  static async getCategories() {
    const [rows] = await pool.execute(
      'SELECT DISTINCT categoria FROM productos WHERE categoria IS NOT NULL AND categoria != "" ORDER BY categoria',
    )
    return rows.map((row) => row.categoria)
  }

  // Eliminar todos los productos
  static async deleteAll() {
    const [result] = await pool.execute("DELETE FROM productos")
    return result.affectedRows
  }
}

export default Product
