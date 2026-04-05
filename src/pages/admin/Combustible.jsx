import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatFechaCorta, formatMoneda } from '@/lib/utils'

export default function Combustible() {
  const [cargas, setCargas] = useState([])
  const [vehiculos, setVehiculos] = useState([])
  const [choferes, setChoferes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const initialState = { 
    id: null, 
    vehiculo_id: '', 
    chofer_id: '', 
    fecha_hora: new Date().toISOString().substring(0, 16), 
    litros: '', 
    precio_por_litro: '', 
    precio_total: '', 
    odometro_actual: '',
    estacion: '',
    tipo_combustible: 'Gasoil'
  }
  const [form, setForm] = useState(initialState)

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    try {
      const [resCargas, resVeh, resChof] = await Promise.all([
        supabase.from('cargas_combustible').select('*, vehiculo:vehiculos(patente), chofer:choferes(nombre)').order('fecha_hora', { ascending: false }),
        supabase.from('vehiculos').select('id, patente').eq('activo', true),
        supabase.from('choferes').select('id, nombre').eq('activo', true)
      ])
      setCargas(resCargas.data || [])
      setVehiculos(resVeh.data || [])
      setChoferes(resChof.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handlePriceCalc = (newForm) => {
    const l = parseFloat(newForm.litros) || 0
    const p = parseFloat(newForm.precio_por_litro) || 0
    if (l && p) {
      setForm({ ...newForm, precio_total: (l * p).toFixed(2) })
    } else {
      setForm(newForm)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        vehiculo_id: form.vehiculo_id,
        chofer_id: form.chofer_id || null,
        fecha_hora: new Date(form.fecha_hora).toISOString(),
        litros: parseFloat(form.litros),
        precio_por_litro: parseFloat(form.precio_por_litro),
        precio_total: parseFloat(form.precio_total),
        odometro_actual: parseFloat(form.odometro_actual),
        estacion: form.estacion,
        tipo_combustible: form.tipo_combustible
      }

      const { error } = await supabase.from('cargas_combustible').insert(payload)
      if (error) throw error
      
      alert('Carga registrada correctamente!')
      setForm(initialState)
      await cargarDatos()
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Cargas de Combustible</h2>
        <p className="text-lazdin-on-primary-container text-sm">Registro de repostajes y control de consumo de la flota.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1">
          <form onSubmit={handleSubmit} className="bg-lazdin-surface border border-slate-800 rounded-xl p-6 shadow-xl sticky top-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-amber-500">
              <span className="material-symbols-outlined">local_gas_station</span>
              Nueva Carga
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Vehículo *</label>
                <select required value={form.vehiculo_id} onChange={e=>setForm({...form, vehiculo_id: e.target.value})} className="form-field mt-1">
                  <option value="">Seleccionar camión...</option>
                  {vehiculos.map(v => <option key={v.id} value={v.id}>{v.patente}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Chofer (Opcional)</label>
                <select value={form.chofer_id} onChange={e=>setForm({...form, chofer_id: e.target.value})} className="form-field mt-1">
                  <option value="">Quién cargó...</option>
                  {choferes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Litros *</label>
                  <input required type="number" step="0.01" value={form.litros} onChange={e=>handlePriceCalc({...form, litros: e.target.value})} className="form-field mt-1" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Precio x Ltr ($) *</label>
                  <input required type="number" step="0.01" value={form.precio_por_litro} onChange={e=>handlePriceCalc({...form, precio_por_litro: e.target.value})} className="form-field mt-1" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Total Abonado ($)</label>
                <input required type="number" step="0.01" value={form.precio_total} onChange={e=>setForm({...form, precio_total: e.target.value})} className="form-field mt-1 font-bold text-lazdin-emerald" />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">KM Odómetro Actual *</label>
                <input required type="number" value={form.odometro_actual} onChange={e=>setForm({...form, odometro_actual: e.target.value})} className="form-field mt-1 font-mono" placeholder="Ej: 145000" />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Estación / Lugar</label>
                <input value={form.estacion} onChange={e=>setForm({...form, estacion: e.target.value})} className="form-field mt-1" placeholder="YPF, Shell, Axion..." />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Fecha y Hora</label>
                <input type="datetime-local" value={form.fecha_hora} onChange={e=>setForm({...form, fecha_hora: e.target.value})} className="form-field p-2 mt-1" />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button type="submit" disabled={saving || !form.vehiculo_id || !form.litros} className="btn-primary flex-1">
                {saving ? 'Guardando...' : 'Registrar Carga'}
              </button>
            </div>
          </form>
        </div>

        <div className="xl:col-span-2">
          <div className="bg-lazdin-surface border border-slate-800 rounded-xl overflow-hidden shadow-xl">
             <div className="p-4 border-b border-slate-800 bg-slate-900/50">
               <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Historial de Cargas</h3>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                 <thead>
                   <tr className="bg-slate-800/20 text-slate-500 uppercase text-[10px] font-bold">
                     <th className="px-6 py-4">Fecha</th>
                     <th className="px-6 py-4">Patente</th>
                     <th className="px-6 py-4">Litros</th>
                     <th className="px-6 py-4">Monto</th>
                     <th className="px-6 py-4">KM</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-800">
                   {loading ? (
                     <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-500">Cargando historial...</td></tr>
                   ) : cargas.length === 0 ? (
                     <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-500">No hay cargas registradas aún.</td></tr>
                   ) : cargas.map(c => (
                     <tr key={c.id} className="hover:bg-slate-800/10">
                       <td className="px-6 py-4 text-xs font-mono text-slate-400">
                         {formatFechaCorta(c.fecha_hora)}
                       </td>
                       <td className="px-6 py-4">
                         <span className="font-bold text-white uppercase">{c.vehiculo?.patente}</span>
                       </td>
                       <td className="px-6 py-4 text-amber-500 font-bold">
                         {c.litros} L
                       </td>
                       <td className="px-6 py-4 font-mono font-bold text-lazdin-emerald">
                         {formatMoneda(c.precio_total)}
                       </td>
                       <td className="px-6 py-4 font-mono text-slate-400 text-xs">
                         {c.odometro_actual} km
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}