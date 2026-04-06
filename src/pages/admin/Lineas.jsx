import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatMoneda } from '@/lib/utils'

export default function LineasPage() {
  const [lineas, setLineas] = useState([])
  const [todosVehiculos, setTodosVehiculos] = useState([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const initialState = {
    id: null, nombre: '', descripcion: '', distancia_estimada_km: '',
    horario_salida: '', horario_regreso: '', remuneracion_base: ''
  }
  const [form, setForm] = useState(initialState)

  useEffect(() => { 
    cargarLineas() 
    cargarVehiculos()
  }, [])

  async function cargarVehiculos() {
    const { data } = await supabase.from('vehiculos').select('id, patente').eq('activo', true).order('patente')
    setTodosVehiculos(data || [])
  }

  async function vincularVehiculo(vehiculoId, lineaId) {
    if (!vehiculoId) return
    setSaving(true)
    try {
      const { error } = await supabase.from('vehiculos').update({ linea_principal_id: lineaId }).eq('id', vehiculoId)
      if (error) throw error
      await cargarLineas()
    } catch (err) {
      alert('Error al vincular: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function cargarLineas() {
    try {
      const { data } = await supabase
        .from('lineas')
        .select(`
          *,
          vehiculos:vehiculos (
            id, 
            patente,
            asignaciones:asignaciones_vehiculo_chofer(
              id,
              activo,
              chofer:choferes(nombre)
            )
          )
        `)
        .order('nombre')
      
      // Filtrar solo asignaciones activas para cada vehículo
      const lineasProcesadas = (data || []).map(l => ({
        ...l,
        personal: l.vehiculos
          ?.map(v => ({
            patente: v.patente,
            chofer: v.asignaciones?.find(a => a.activo)?.chofer?.nombre
          }))
          .filter(p => p.patente) || []
      }))

      setLineas(lineasProcesadas)
    } catch (err) { console.error('Error cargando líneas:', err) }
    finally { setLoading(false) }
  }

  const handleEdit = (linea) => {
    setForm(linea)
    setIsEditing(true)
  }

  const handleCancel = () => {
    setForm(initialState)
    setIsEditing(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { id, created_at, updated_at, ...rawForm } = form
      
      // Limpiar y asegurar tipos de datos numéricos
      const dataToSave = {
        ...rawForm,
        distancia_estimada_km: rawForm.distancia_estimada_km ? parseFloat(rawForm.distancia_estimada_km) : null,
        remuneracion_base: rawForm.remuneracion_base ? parseFloat(rawForm.remuneracion_base) : 0,
        horario_salida: rawForm.horario_salida || null,
        horario_regreso: rawForm.horario_regreso || null,
        activo: rawForm.activo !== undefined ? rawForm.activo : true
      }

      if (id) {
        dataToSave.updated_at = new Date().toISOString()
        const { error: saveError } = await supabase.from('lineas').update(dataToSave).eq('id', id)
        if (saveError) throw saveError
      } else {
        const { error: saveError } = await supabase.from('lineas').insert(dataToSave)
        if (saveError) throw saveError
      }
      
      await cargarLineas()
      handleCancel()
    } catch (err) {
      console.error('Error guardando línea:', err)
      alert('No se pudo guardar la línea: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Líneas y Recorridos</h2>
        <p className="text-lazdin-on-primary-container text-sm">Administre las rutas habituales y tarifas base.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="bg-lazdin-surface border border-slate-800 rounded-xl p-6 shadow-xl">
            <h3 className="text-lg font-bold mb-4">{isEditing ? 'Editar Línea' : 'Nueva Línea'}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Nombre *</label>
                <input required value={form.nombre} onChange={e=>setForm({...form, nombre: e.target.value})} className="form-field" placeholder="Ej: R1 - Zarate" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Descripción / Ruta</label>
                <textarea value={form.descripcion} onChange={e=>setForm({...form, descripcion: e.target.value})} className="form-field" rows="2" placeholder="Ej: Planta A -> Planta B" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Horario Salida</label>
                  <input type="time" value={form.horario_salida} onChange={e=>setForm({...form, horario_salida: e.target.value})} className="form-field p-2" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Regreso</label>
                  <input type="time" value={form.horario_regreso} onChange={e=>setForm({...form, horario_regreso: e.target.value})} className="form-field p-2" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Km Estimado</label>
                  <input type="number" step="0.1" value={form.distancia_estimada_km} onChange={e=>setForm({...form, distancia_estimada_km: e.target.value})} className="form-field" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Tarifa Base</label>
                  <input type="number" value={form.remuneracion_base} onChange={e=>setForm({...form, remuneracion_base: e.target.value})} className="form-field" />
                </div>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              {isEditing && <button type="button" onClick={handleCancel} className="btn-secondary flex-1">Cancelar</button>}
              <button type="submit" disabled={saving || !form.nombre} className="btn-primary flex-1">{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </form>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {loading ? (
             <div className="p-8 text-center text-slate-500">Cargando...</div>
          ) : lineas.map(linea => (
            <div key={linea.id} className="bg-lazdin-surface border border-slate-800 rounded-xl p-5 shadow-lg flex justify-between items-center hover:border-slate-600 transition-colors">
              <div>
                <h4 className="font-black text-lg text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-lazdin-emerald">route</span>
                  {linea.nombre}
                </h4>
                <p className="text-sm text-slate-400 mt-1">{linea.descripcion}</p>
                <div className="flex items-center gap-4 mt-3">
                  {(linea.horario_salida || linea.horario_regreso) && (
                    <div className="text-xs font-bold text-slate-300 bg-slate-800 px-2 py-1 rounded">
                      ⏱ {linea.horario_salida?.slice(0,5)} - {linea.horario_regreso?.slice(0,5)}
                    </div>
                  )}
                  {linea.distancia_estimada_km && (
                    <div className="text-xs font-bold text-slate-300">📍 {linea.distancia_estimada_km} km</div>
                  )}
                </div>

                {/* Sección de Personal Asignado */}
                <div className="mt-4 pt-4 border-t border-slate-800/60">
                   <h5 className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-2">Personal y Flota:</h5>
                   <div className="flex flex-wrap gap-2">
                     {linea.personal.length > 0 ? (
                       linea.personal.map((p, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-slate-900/40 border border-slate-800 px-3 py-1.5 rounded-lg">
                           <span className="material-symbols-outlined text-sm text-lazdin-emerald">local_shipping</span>
                           <span className="text-xs font-bold text-white uppercase">{p.patente}</span>
                           <span className="text-xs text-slate-400">—</span>
                           <span className="text-xs text-slate-300 italic">{p.chofer || 'S/Chofer'}</span>
                        </div>
                       ))
                     ) : (
                       <span className="text-[10px] text-slate-600 font-bold uppercase tracking-tighter italic">No hay personal asignado actualmente</span>
                     )}
                   </div>
                </div>

                {/* Herramienta de Vinculación Rápida */}
                <div className="mt-4 pt-3 border-t border-slate-800/40 flex items-center gap-3">
                   <select 
                     id={`select-vehiculo-${linea.id}`} 
                     className="bg-slate-900 border-slate-800 text-[10px] h-8 rounded-lg text-slate-400 focus:text-white transition-all flex-1"
                   >
                     <option value="">Vincular Camioneta/Camión...</option>
                     {todosVehiculos.map(v => (
                       <option key={v.id} value={v.id}>{v.patente}</option>
                     ))}
                   </select>
                   <button 
                     onClick={() => {
                       const sel = document.getElementById(`select-vehiculo-${linea.id}`);
                       if (sel.value) vincularVehiculo(sel.value, linea.id);
                     }}
                     disabled={saving}
                     className="h-8 px-4 bg-lazdin-emerald/10 text-lazdin-emerald hover:bg-lazdin-emerald hover:text-white border border-lazdin-emerald/30 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all active:scale-95 whitespace-nowrap"
                   >
                     VINCULAR
                   </button>
                </div>
              </div>
              <div className="flex flex-col items-end gap-3">
                {linea.remuneracion_base > 0 && <span className="text-emerald-400 font-bold">{formatMoneda(linea.remuneracion_base)}</span>}
                <button onClick={() => handleEdit(linea)} className="text-slate-500 hover:text-white transition-colors p-2">
                  <span className="material-symbols-outlined text-sm">edit</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}