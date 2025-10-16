// db.js

const dbPromise = idb.openDB('tareas-db', 1, {
  upgrade(db) {
    // Si la BD no existe, crea un 'almacén de objetos' (como una tabla)
    if (!db.objectStoreNames.contains('tareas')) {
      db.createObjectStore('tareas', { keyPath: 'id', autoIncrement: true });
    }
  },
});

// Función para guardar una tarea en IndexedDB
async function guardarTarea(tarea) {
  const db = await dbPromise;
  const tx = db.transaction('tareas', 'readwrite');
  tx.store.add(tarea);
  await tx.done;
}

// Función para obtener todas las tareas de IndexedDB
async function obtenerTareas() {
  const db = await dbPromise;
  return db.getAll('tareas');
}