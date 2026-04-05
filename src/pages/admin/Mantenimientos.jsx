import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatFechaCorta, formatMoneda } from '@/lib/utils'

export default function Mantenimientos() {
  const [mantenimientos, setMantenimientos] = useState([])
  const [vehiculos, setVehiculos] = useState([])
  const [mecanicos, setMecanicos] = useState([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const initialState = { id: null, vehiculo_id: '', mecanico_id: '', fecha: '', tipo: 'preventivo', descripcion: '', costo: '', kilometraje: '', proximo_km: '', estado: 'programado' }
  const [form, setForm] = useState(initialState)

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    try {
      const [resMant, resVeh, resMec] = await Promise.all([
        supabase.from('mantenimientos').select('*, vehiculo:vehiculos(marca, modelo, patente), mecanico:mecanicos(nombre)').order('fecha', { ascending: false }),
        supabase.from('vehiculos').select('id, marca, modelo, patente').eq('activo', true),
        supabase.from('mecanicos').select('id, nombre').eq('activo', true)
      ])
      setMantenimientos(resMant.data || [])
      setVehiculos(resVeh.data || [])
      setMecanicos(resMec.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (mant) => {
    setForm({
      ...mant,
      fecha: mant.fecha ? mant.fecha.split('T')[0] : '',
      costo: mant.costo || '',
      proximo_km: mant.proximo_km || '',
      kilometraje: mant.kilometraje || ''
    })
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
      const { id, vehiculo, mecanico, ...dataToSave } = form
      
      const payload = {
        ...dataToSave,
        costo: dataToSave.costo ? parseFloat(dataToSave.costo) : null,
        kilometraje: dataToSave.kilometraje ? parseInt(dataToSave.kilometraje) : null,
        proximo_km: dataToSave.proximo_km ? parseInt(dataToSave.proximo_km) : null,
        mecanico_id: dataToSave.mecanico_id || null
      }

      if (id) {
        await supabase.from('mantenimientos').update(payload).eq('id', id)
      } else {
        await supabase.from('mantenimientos').insert(payload)
      }
      await cargarDatos()
      handleCancel()
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Mantenimientos</h2>
        <p className="text-lazdin-on-primary-container text-sm">Registro histórico y programado de service en la flota.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1">
          <form onSubmit={handleSubmit} className="bg-lazdin-surface border border-slate-800 rounded-xl p-6 shadow-xl sticky top-6">
            <h3 className="text-lg font-bold mb-4">{isEditing ? 'Editar Registro' : 'Cargar Mantenimiento'}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Vehículo *</label>
                <select required value={form.vehiculo_id} onChange={e=>setForm({...form, vehiculo_id: e.target.value})} className="form-field mt-1">
                  <option value="">Seleccionar vehículo</option>
                  {vehiculos.map(v => <option key={v.id} value={v.id}>{v.patente} - {v.marca} {v.modelo}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Estado *</label>
                  <select required value={form.estado} onChange={e=>setForm({...form, estado: e.target.value})} className={`form-field mt-1 font-bold ${form.estado==='completado'?'text-lazdin-emerald':form.estado==='en_curso'?'text-amber-500':form.estado==='cancelado'?'text-red-500':'text-sky-400'}`}>
                    <option value="programado">Programado</option>
                    <option value="en_curso">En Curso</option>
                    <option value="completado">Completado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Tipo *</label>
                  <select required value={form.tipo} onChange={e=>setForm({...form, tipo: e.target.value})} className="form-field mt-1">
                    <option value="preventivo">Preventivo (Service)</option>
                    <option value="correctivo">Correctivo (Reparación)</option>
                    <option value="cubiertas">Cambio de Cubiertas</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Fecha *</label>
                <input required type="date" value={form.fecha} onChange={e=>setForm({...form, fecha: e.target.value})} className="form-field p-2 mt-1" />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Descripción de la Tarea *</label>
                <textarea required rows="2" value={form.descripcion} onChange={e=>setForm({...form, descripcion: e.target.value})} className="form-field mt-1" placeholder="Cambio de aceite, filtros y revisión de frenos" />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Taller / Mecánico</label>
                <select value={form.mecanico_id} onChange={e=>setForm({...form, mecanico_id: e.target.value})} className="form-field mt-1">
                  <option value="">Servicio Interno / Sin especificar</option>
                  {mecanicos.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Costo ($)</label>
                  <input type="number" step="0.01" value={form.costo} onChange={e=>setForm({...form, costo: e.target.value})} className="form-field mt-1" placeholder="0.00" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Odómetro Actual</label>
                  <input type="number" value={form.kilometraje} onChange={e=>setForm({...form, kilometraje: e.target.value})} className="form-field mt-1" placeholder="km" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Próximo Venc. (km)</label>
                  <input type="number" value={form.proximo_km} onChange={e=>setForm({...form, proximo_km: e.target.value})} className="form-field mt-1" placeholder="km" />
                </div>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              {isEditing && <button type="button" onClick={handleCancel} className="btn-secondary flex-1">Cancelar</button>}
              <button type="submit" disabled={saving || !form.vehiculo_id || !form.fecha} className="btn-primary flex-1">{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </form>
        </div>

        <div className="xl:col-span-2 space-y-4">
          {loading ? (
             <div className="p-8 text-center text-slate-500">Cargando...</div>
          ) : mantenimientos.length === 0 ? (
             <div className="p-8 text-center text-slate-500 bg-slate-800/30 rounded-xl">No hay mantenimientos cargados.</div>
          ) : mantenimientos.map(mant => (
            <div key={mant.id} className="bg-lazdin-surface border border-slate-800 rounded-xl overflow-hidden shadow-lg hover:border-slate-600 transition-colors">
              <div className="p-5 flex flex-col md:flex-row gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border ${mant.tipo === 'preventivo' ? 'bg-sky-500/10 border-sky-500/30 text-sky-400' : mant.tipo === 'cubiertas' ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' : 'bg-red-500/10 border-red-500/30 text-red-500'}`}>
                  <span className="material-symbols-outlined">{mant.tipo === 'preventivo' ? 'build' : mant.tipo === 'correctivo' ? 'car_crash' : 'tire_repair'}</span>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                     <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${mant.estado === 'completado' ? 'bg-lazdin-emerald/20 text-lazdin-emerald border border-lazdin-emerald/30' : mant.estado === 'programado' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : mant.estado === 'en_curso' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'bg-red-500/20 text-red-500 border border-red-500/30'}`}>
                       {mant.estado}
                     </span>
                     <span className="text-xs text-slate-400 font-medium bg-slate-800 px-2 py-0.5 rounded capitalize">{mant.tipo}</span>
                     <span className="text-xs text-slate-500 font-mono ml-auto">{formatFechaCorta(mant.fecha)}</span>
                  </div>
                  
                  {mant.vehiculo && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono bg-slate-800 border border-slate-700 px-2 rounded text-slate-300 text-xs">{mant.vehiculo.patente}</span>
                      <span className="font-bold text-white text-sm">{mant.vehiculo.marca} {mant.vehiculo.modelo}</span>
                    </div>
                  )}

                  <p className="text-sm text-slate-300 mb-3">{mant.descripcion}</p>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 p-3 bg-slate-900/50 rounded-lg">
                    {mant.mecanico && (
                      <div className="flex items-center gap-1" title="Taller">
                        <span className="material-symbols-outlined text-[14px]">storefront</span>
                        <span className="font-medium">{mant.mecanico.nombre}</span>
                      </div>
                    )}
                    {(mant.kilometraje || mant.proximo_km) && (
                      <div className="flex items-center gap-1" title="Odómetro">
                        <span className="material-symbols-outlined text-[14px]">speed</span>
                        <span>{mant.kilometraje? `${mant.kilometraje}km` : '-'} {mant.proximo_km? `➔ Próx: ${mant.proximo_km}km` : ''}</span>
                      </div>
                    )}
                    {mant.costo > 0 && (
                      <div className="flex items-center gap-1 text-red-400 font-bold ml-auto">
                        {formatMoneda(mant.costo)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="md:border-l md:border-slate-800 md:pl-4 flex md:flex-col justify-end">
                  <button onClick={() => handleEdit(mant)} className="text-slate-500 hover:text-white transition-colors p-2 bg-slate-800/50 hover:bg-slate-700 rounded-lg">
                    <span className="material-symbols-outlined text-sm block">edit</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}