import pool from "../config/database.js"

class Plantilla {
  // Crear plantilla
  static async create(plantillaData) {
    const { nombre, descripcion, usuario_id } = plantillaData

    const [result] = await pool.execute("INSERT INTO plantillas (nombre, descripcion, usuario_id) VALUES (?, ?, ?)", [
      nombre,
      descripcion || "",
      usuario_id,
    ])

    return result.insertId
  }

  // Obtener todas las plantillas con sus productos
  static async findAll(usuario_id = null) {
    let query = `
      SELECT p.*, u.nombre as usuario_nombre
      FROM plantillas p
      LEFT JOIN usuarios u ON p.usuario_id = u.id
      WHERE 1=1
    `
    const params = []

    if (usuario_id) {
      query += " AND p.usuario_id = ?"
      params.push(usuario_id)
    }

    query += " ORDER BY p.fecha_creacion DESC"

    const [plantillas] = await pool.execute(query, params)

    // Obtener productos para cada plantilla
    for (const plantilla of plantillas) {
      const [productos] = await pool.execute(
        `SELECT pp.*, prod.codigo, prod.nombre, prod.categoria, prod.stock_sistema
         FROM plantilla_productos pp
         INNER JOIN productos prod ON pp.producto_id = prod.id
         WHERE pp.plantilla_id = ?
         ORDER BY pp.orden`,
        [plantilla.id],
      )
      plantilla.productos = productos
    }

    return plantillas
  }

  // Obtener plantilla por ID con sus productos
  static async findById(id) {
    const [plantillas] = await pool.execute(
      `SELECT p.*, u.nombre as usuario_nombre
       FROM plantillas p
       LEFT JOIN usuarios u ON p.usuario_id = u.id
       WHERE p.id = ?`,
      [id],
    )

    if (plantillas.length === 0) return null

    const plantilla = plantillas[0]

    // Obtener productos de la plantilla
    const [productos] = await pool.execute(
      `SELECT pp.*, prod.codigo, prod.nombre, prod.categoria, prod.stock_sistema, prod.precio
       FROM plantilla_productos pp
       INNER JOIN productos prod ON pp.producto_id = prod.id
       WHERE pp.plantilla_id = ?
       ORDER BY pp.orden`,
      [id],
    )

    plantilla.productos = productos
    return plantilla
  }

  // Actualizar plantilla
  static async update(id, plantillaData) {
    const { nombre, descripcion } = plantillaData

    const [result] = await pool.execute(
      "UPDATE plantillas SET nombre = ?, descripcion = ?, fecha_actualizacion = NOW() WHERE id = ?",
      [nombre, descripcion, id],
    )

    return result.affectedRows > 0
  }

  // Eliminar plantilla
  static async delete(id) {
    const connection = await pool.getConnection()

    try {
      await connection.beginTransaction()

      // Eliminar productos de la plantilla
      await connection.execute("DELETE FROM plantilla_productos WHERE plantilla_id = ?", [id])

      // Eliminar plantilla
      await connection.execute("DELETE FROM plantillas WHERE id = ?", [id])

      await connection.commit()
      return true
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  // Agregar producto a plantilla
  static async addProduct(plantilla_id, producto_id, cantidad_deseada) {
    // Verificar si el producto ya existe en la plantilla
    const [existing] = await pool.execute(
      "SELECT id FROM plantilla_productos WHERE plantilla_id = ? AND producto_id = ?",
      [plantilla_id, producto_id],
    )

    if (existing.length > 0) {
      // Actualizar cantidad deseada
      const [result] = await pool.execute(
        "UPDATE plantilla_productos SET cantidad_deseada = ? WHERE plantilla_id = ? AND producto_id = ?",
        [cantidad_deseada, plantilla_id, producto_id],
      )
      return result.affectedRows > 0
    }

    // Obtener el siguiente orden
    const [maxOrden] = await pool.execute(
      "SELECT COALESCE(MAX(orden), 0) as max_orden FROM plantilla_productos WHERE plantilla_id = ?",
      [plantilla_id],
    )

    const orden = maxOrden[0].max_orden + 1

    const [result] = await pool.execute(
      "INSERT INTO plantilla_productos (plantilla_id, producto_id, cantidad_deseada, orden) VALUES (?, ?, ?, ?)",
      [plantilla_id, producto_id, cantidad_deseada, orden],
    )

    return result.insertId
  }

  // Eliminar producto de plantilla
  static async removeProduct(plantilla_id, producto_id) {
    const [result] = await pool.execute("DELETE FROM plantilla_productos WHERE plantilla_id = ? AND producto_id = ?", [
      plantilla_id,
      producto_id,
    ])

    return result.affectedRows > 0
  }

  // Actualizar cantidad deseada de un producto en la plantilla
  static async updateProductQuantity(plantilla_id, producto_id, cantidad_deseada) {
    const [result] = await pool.execute(
      "UPDATE plantilla_productos SET cantidad_deseada = ? WHERE plantilla_id = ? AND producto_id = ?",
      [cantidad_deseada, plantilla_id, producto_id],
    )

    return result.affectedRows > 0
  }

  // Actualiza cabecera y reemplaza todas las filas de plantilla_productos en una transacción
  static async syncCompleto(id, data) {
    const { nombre, descripcion, productos } = data
    const connection = await pool.getConnection()

    try {
      await connection.beginTransaction()

      const [upd] = await connection.execute(
        "UPDATE plantillas SET nombre = ?, descripcion = ?, fecha_actualizacion = NOW() WHERE id = ?",
        [nombre, descripcion ?? "", id],
      )

      if (upd.affectedRows === 0) {
        await connection.rollback()
        return { ok: false, code: "NOT_FOUND" }
      }

      await connection.execute("DELETE FROM plantilla_productos WHERE plantilla_id = ?", [id])

      if (productos.length > 0) {
        const uniqueIds = [...new Set(productos.map((p) => p.producto_id))]
        if (uniqueIds.length !== productos.length) {
          await connection.rollback()
          return { ok: false, code: "DUPLICATE_PRODUCTOS" }
        }

        const placeholders = uniqueIds.map(() => "?").join(",")
        const [existing] = await connection.execute(`SELECT id FROM productos WHERE id IN (${placeholders})`, uniqueIds)

        if (existing.length !== uniqueIds.length) {
          await connection.rollback()
          return { ok: false, code: "INVALID_PRODUCTOS" }
        }

        let orden = 1
        for (const p of productos) {
          await connection.execute(
            "INSERT INTO plantilla_productos (plantilla_id, producto_id, cantidad_deseada, orden) VALUES (?, ?, ?, ?)",
            [id, p.producto_id, p.cantidad_deseada, orden],
          )
          orden++
        }
      }

      await connection.commit()
      return { ok: true }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }
}

export default Plantilla
