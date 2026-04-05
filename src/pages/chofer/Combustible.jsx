import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'

export default function ChoferCombustible() {
  const { choferData, vehiculoAsignado } = useAuth()
  const { tema } = useTheme()
  const navigate = useNavigate()

  // Referencias para los inputs de archivos ocultos
  const ticketInputRef = useRef(null)
  const surtidorInputRef = useRef(null)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [turnoActivo, setTurnoActivo] = useState(null)
  
  const [form, setForm] = useState({
    litros: '',
    odometro_actual: '',
    estacion: '',
    tipo_combustible: 'Gasoil'
  })

  const [fotoTicket, setFotoTicket] = useState(null)
  const [fotoSurtidor, setFotoSurtidor] = useState(null)
  const [previewTicket, setPreviewTicket] = useState(null)
  const [previewSurtidor, setPreviewSurtidor] = useState(null)

  const estaciones = ['YPF', 'Axion', 'Puma', 'Shell', 'Estacion Blanca']

  useEffect(() => {
    if (choferData?.id) cargarTurnoActivo()
  }, [choferData])

  async function cargarTurnoActivo() {
    try {
      const { data } = await supabase
        .from('turnos')
        .select('*')
        .eq('chofer_id', choferData.id)
        .eq('activo', true)
        .single()
      
      if (data) setTurnoActivo(data)
    } catch (err) {
      console.log('No hay turno activo', err)
    }
  }

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleFileChange = (e, type) => {
    const file = e.target.files[0]
    if (file) {
      if (type === 'ticket') {
        setFotoTicket(file)
        setPreviewTicket(URL.createObjectURL(file))
      } else {
        setFotoSurtidor(file)
        setPreviewSurtidor(URL.createObjectURL(file))
      }
    }
  }

  async function uploadFile(file, prefix) {
    if (!file) return null
    const fileExt = file.name.split('.').pop()
    const fileName = `${prefix}-${Date.now()}.${fileExt}`
    const { data, error } = await supabase.storage
      .from('tickets-combustible')
      .upload(`${choferData.id}/${fileName}`, file)
    
    if (error) throw error
    const { data: { publicUrl } } = supabase.storage
      .from('tickets-combustible')
      .getPublicUrl(data.path)
    return publicUrl
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!vehiculoAsignado) {
      setError('No tienes un vehículo asignado para cargar combustible.')
      return
    }

    if (!form.estacion) {
      setError('Debes seleccionar una estación de servicio.')
      return
    }

    if (!fotoTicket || !fotoSurtidor) {
      setError('Debes capturar ambas fotos (Ticket y Surtidor) para continuar.')
      return
    }
    
    setSaving(true)
    setError(null)
    
    try {
      // 1. Subir archivos primero
      const ticketUrl = await uploadFile(fotoTicket, 'ticket')
      const surtidorUrl = await uploadFile(fotoSurtidor, 'surtidor')

      // 2. Calcular consumo (opcional, igual que antes)
      const { data: anterior } = await supabase
        .from('cargas_combustible')
        .select('*')
        .eq('vehiculo_id', vehiculoAsignado.id)
        .order('fecha_hora', { ascending: false })
        .limit(1)

      const odometro_anterior = anterior && anterior.length > 0 ? anterior[0].odometro_actual : null
      
      let consumo_calculado = null
      if (odometro_anterior && Number(form.odometro_actual) > Number(odometro_anterior)) {
        const kms = Number(form.odometro_actual) - Number(odometro_anterior)
        consumo_calculado = (Number(form.litros) / kms) * 100 
      }

      // 3. Insertar registro
      const { error: insError } = await supabase.from('cargas_combustible').insert({
        vehiculo_id: vehiculoAsignado.id,
        chofer_id: choferData.id,
        turno_id: turnoActivo?.id || null,
        litros: Number(form.litros),
        odometro_actual: Number(form.odometro_actual),
        odometro_anterior: odometro_anterior,
        consumo_calculado: consumo_calculado,
        estacion: form.estacion,
        tipo_combustible: form.tipo_combustible,
        foto_url: ticketUrl,
        foto_surtidor_url: surtidorUrl
      })

      if (insError) throw insError

      // 4. Actualizar KM del vehículo
      await supabase
        .from('vehiculos')
        .update({ kilometraje_actual: Number(form.odometro_actual) })
        .eq('id', vehiculoAsignado.id)

      setSuccess(true)
      setTimeout(() => navigate('/chofer'), 2000)

    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto py-20 animate-in fade-in flex flex-col items-center text-center">
        <div className={`w-24 h-24 rounded-full ${tema.accentBg} flex items-center justify-center mb-6 shadow-2xl`}>
          <span className={`material-symbols-outlined text-5xl ${tema.accentText}`}>check_circle</span>
        </div>
        <h2 className="text-3xl font-black mb-2 italic">CARGA REGISTRADA</h2>
        <p className="text-slate-400">El suministro se ha guardado correctamente.</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto pb-10 animate-in">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/chofer')} className="w-10 h-10 flex items-center justify-center bg-lazdin-surface-high hover:bg-lazdin-surface-highest rounded-xl text-slate-300 transition-all active:scale-90">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h2 className="text-2xl font-black italic tracking-tighter uppercase">Combustible</h2>
      </div>

      {!turnoActivo && (
        <div className="bg-amber-500/10 border border-amber-500/40 text-amber-500 p-4 rounded-xl mb-6 text-[10px] uppercase font-black tracking-widest flex items-start gap-3">
          <span className="material-symbols-outlined shrink-0 text-amber-500">warning</span>
          <span>No estás en un turno activo. Se recomienda iniciar jornada antes de cargar.</span>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/40 text-red-500 p-4 rounded-xl mb-6 text-xs font-bold flex items-center gap-3">
           <span className="material-symbols-outlined">error</span>
           <span>{error}</span>
        </div>
      )}

      {/* Hidden file inputs */}
      <input type="file" ref={ticketInputRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handleFileChange(e, 'ticket')} />
      <input type="file" ref={surtidorInputRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handleFileChange(e, 'surtidor')} />

      <form onSubmit={handleSubmit} className="bg-lazdin-surface/50 backdrop-blur-md shadow-2xl rounded-3xl overflow-hidden border border-slate-800">
        <div className={`h-2 w-full ${tema.accentBg} shadow-2xl shadow-emerald-900/40`}></div>
        <div className="p-6 md:p-8 space-y-8">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Odómetro Km</label>
              <div className="relative group">
                <input required type="number" name="odometro_actual" value={form.odometro_actual} onChange={handleChange} className="form-field text-2xl font-mono text-center h-14 bg-slate-950/50" placeholder="00000" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 text-[10px] font-black tracking-tighter">KM</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Litros</label>
              <div className="relative group">
                <input required type="number" step="0.01" name="litros" value={form.litros} onChange={handleChange} className="form-field text-2xl font-mono text-center h-14 bg-slate-950/50" placeholder="0.0" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 text-[10px] font-black tracking-tighter text-blue-500">LTS</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Estación de Servicio</label>
            <div className="grid grid-cols-3 gap-2">
              {estaciones.map(e => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setForm({...form, estacion: e})}
                  className={`py-3 px-1 rounded-xl text-[10px] font-black border transition-all active:scale-95 ${form.estacion === e ? 'bg-lazdin-emerald border-lazdin-emerald text-slate-950 shadow-lg shadow-emerald-900/30' : 'bg-slate-950/30 border-slate-800/80 text-slate-500'}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Fotos Obligatorias</label>
            <div className="grid grid-cols-2 gap-4">
              {/* Card Foto Ticket */}
              <div 
                onClick={() => ticketInputRef.current.click()}
                className={`group relative h-36 border-2 border-dashed ${fotoTicket ? 'border-lazdin-emerald bg-lazdin-emerald/10' : 'border-slate-800 bg-slate-950/30'} rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all active:scale-[0.98] overflow-hidden`}
              >
                {previewTicket ? (
                  <img src={previewTicket} className="absolute inset-0 w-full h-full object-cover opacity-60" />
                ) : (
                  <span className={`material-symbols-outlined text-4xl mb-2 ${fotoTicket ? 'text-lazdin-emerald' : 'text-slate-700'}`}>receipt_long</span>
                )}
                <div className="relative z-10 flex flex-col items-center">
                   <span className={`text-[10px] font-black text-center ${fotoTicket ? 'text-white' : 'text-slate-600 uppercase'}`}>
                     {fotoTicket ? 'TICKET LISTO' : 'FOTO TICKET'}
                   </span>
                   {fotoTicket && <span className="text-[8px] bg-emerald-500 text-white px-2 py-0.5 rounded-full mt-1 font-black">EDITAR</span>}
                </div>
              </div>

              {/* Card Foto Surtidor */}
              <div 
                onClick={() => surtidorInputRef.current.click()}
                className={`group relative h-36 border-2 border-dashed ${fotoSurtidor ? 'border-lazdin-emerald bg-lazdin-emerald/10' : 'border-slate-800 bg-slate-950/30'} rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all active:scale-[0.98] overflow-hidden`}
              >
                {previewSurtidor ? (
                  <img src={previewSurtidor} className="absolute inset-0 w-full h-full object-cover opacity-60" />
                ) : (
                  <span className={`material-symbols-outlined text-4xl mb-2 ${fotoSurtidor ? 'text-lazdin-emerald' : 'text-slate-700'}`}>gas_meter</span>
                )}
                <div className="relative z-10 flex flex-col items-center">
                   <span className={`text-[10px] font-black text-center ${fotoSurtidor ? 'text-white' : 'text-slate-600 uppercase'}`}>
                     {fotoSurtidor ? 'SURTIDOR LISTO' : 'FOTO SURTIDOR'}
                   </span>
                   {fotoSurtidor && <span className="text-[8px] bg-emerald-500 text-white px-2 py-0.5 rounded-full mt-1 font-black">EDITAR</span>}
                </div>
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={saving || !form.litros || !form.odometro_actual} 
            className={`w-full h-16 ${tema.buttonBg} ${tema.buttonHover} ${tema.buttonText} font-black rounded-2xl shadow-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-lg mt-4 disabled:opacity-30`}
          >
            {saving ? (
              <><span className="material-symbols-outlined animate-spin font-bold">sync</span> SUBIENDO DATOS...</>
            ) : (
              <><span className="material-symbols-outlined font-black">rocket_launch</span> REGISTRAR CARGA</>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}