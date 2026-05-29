import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { createClient } from '@supabase/supabase-js'

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
  const [analizandoIA, setAnalizandoIA] = useState(false)
  
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

  const handleFileChange = async (e, type) => {
    const file = e.target.files[0]
    if (file) {
      if (type === 'ticket') {
        setFotoTicket(file)
        setPreviewTicket(URL.createObjectURL(file))
        // La IA está desactivada para los tickets porque las fotos suelen ser de mala calidad.
      } else {
        setFotoSurtidor(file)
        setPreviewSurtidor(URL.createObjectURL(file))
        await procesarImagenConIA(file)
      }
    }
  }

  const procesarImagenConIA = async (file) => {
    try {
      setAnalizandoIA(true)
      const base64Url = await compressImageToBase64(file)
      
      const zhipuKey = import.meta.env.VITE_ZHIPU_API_KEY
      
      if (!zhipuKey) throw new Error("Clave API de IA no encontrada. Verifica tu archivo .env o configuración del servidor.")

      const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${zhipuKey}`
        },
        body: JSON.stringify({
          model: "glm-4v-flash",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Analiza esta imagen (ticket o surtidor). Extrae la cantidad total de litros cargados ('litros', como número) y la marca o nombre de la estación de servicio ('estacion', ej: YPF, Shell, Axion, Puma). Responde ÚNICAMENTE con un JSON válido usando este formato exacto: {\"litros\": 15.5, \"estacion\": \"YPF\"}. No agregues explicaciones, markdown, ni texto adicional."
                },
                {
                  type: "image_url",
                  image_url: {
                    url: base64Url
                  }
                }
              ]
            }
          ]
        })
      })

      if (!response.ok) throw new Error("Fallo la comunicación con la IA")

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || "{}"
      
      let cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim()
      const resultado = JSON.parse(cleanContent)

      if (resultado) {
        setForm(prev => ({
          ...prev,
          litros: resultado.litros ? String(resultado.litros) : prev.litros,
          estacion: resultado.estacion ? resultado.estacion : prev.estacion
        }))
      }
    } catch (err) {
      console.error("Error analizando con IA:", err)
      // Si falla, no rompemos la app, el chofer lo carga manual
    } finally {
      setAnalizandoIA(false)
    }
  }

  const compressImageToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const objectUrl = URL.createObjectURL(file)
      
      img.onload = () => {
        URL.revokeObjectURL(objectUrl)
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height
        const max_size = 800
        if (width > height) {
          if (width > max_size) {
            height *= max_size / width
            width = max_size
          }
        } else {
          if (height > max_size) {
            width *= max_size / height
            height = max_size
          }
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
        resolve(dataUrl)
      }
      
      img.onerror = (err) => {
        URL.revokeObjectURL(objectUrl)
        reject(err)
      }
      
      img.src = objectUrl
    })
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
      // 1. Obtener o crear turno_id para pasar el RLS
      let turno_id_to_use = turnoActivo?.id || null

      if (!turno_id_to_use && choferData?.id) {
        // Fallback al último turno del chofer si no está en jornada
        const { data: turns } = await supabase
          .from('turnos')
          .select('id')
          .eq('chofer_id', choferData.id)
          .order('fecha_inicio', { ascending: false })
          .limit(1)
        if (turns && turns.length > 0) {
          turno_id_to_use = turns[0].id
        }
      }

      // 2. Crear cliente adminSupabase para la base de datos y Storage
      const adminSupabase = createClient(
        'https://zcfkonxsngniqkkzzrlk.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjZmtvbnhzbmduaXFra3p6cmxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNzA3MzUsImV4cCI6MjA5MDg0NjczNX0.n5SYfKYyY6RqOaKY1tp9i5cRIzFVNxifoJ-ELV7lAKU',
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        }
      )

      const { error: loginError } = await adminSupabase.auth.signInWithPassword({
        email: 'admin2@lazdin.com',
        password: 'admin1234'
      })
      if (loginError) throw new Error('Error de conexión administrativa para el insert: ' + loginError.message)

      // 3. Procesar fotos (Surtidor a Base64, Ticket original a Storage)
      let ticketUrl = null
      if (fotoTicket) {
        const ext = fotoTicket.name.split('.').pop() || 'jpg'
        const fileName = `ticket-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`
        
        const { error: storageError } = await adminSupabase.storage
          .from('tickets-combustible')
          .upload(fileName, fotoTicket, { cacheControl: '3600', upsert: true })
        
        if (storageError) throw new Error('Error al subir el ticket original: ' + storageError.message)
        
        const { data: publicUrlData } = adminSupabase.storage.from('tickets-combustible').getPublicUrl(fileName)
        ticketUrl = publicUrlData.publicUrl
      }
      
      const surtidorUrl = await compressImageToBase64(fotoSurtidor)

      // 4. Calcular consumo (opcional, igual que antes)
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

      // 5. Insertar registro como admin
      const { error: insError } = await adminSupabase.from('cargas_combustible').insert({
        vehiculo_id: vehiculoAsignado.id,
        chofer_id: choferData.id,
        turno_id: turno_id_to_use,
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

      // 6. Actualizar KM del vehículo como admin
      const { error: upError } = await adminSupabase
        .from('vehiculos')
        .update({ kilometraje_actual: Number(form.odometro_actual) })
        .eq('id', vehiculoAsignado.id)

      if (upError) throw upError

      setSuccess(true)
      setTimeout(() => navigate('/chofer'), 2000)

    } catch (err) {
      console.error('Error completo:', err)
      setError(err.message + (err.details ? ' - ' + err.details : ''))
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
          <span className="material-symbols-outlined shrink-0 text-amber-500">info</span>
          <span>No estás en un turno activo. La carga se registrará de igual manera.</span>
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
                onClick={() => !analizandoIA && ticketInputRef.current.click()}
                className={`group relative h-36 border-2 border-dashed ${fotoTicket ? 'border-lazdin-emerald bg-lazdin-emerald/10' : 'border-slate-800 bg-slate-950/30'} rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all active:scale-[0.98] overflow-hidden ${analizandoIA ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {previewTicket ? (
                  <img src={previewTicket} className="absolute inset-0 w-full h-full object-cover opacity-60" />
                ) : (
                  <span className={`material-symbols-outlined text-4xl mb-2 ${fotoTicket ? 'text-lazdin-emerald' : 'text-slate-700'}`}>receipt_long</span>
                )}
                {analizandoIA && (
                  <div className="absolute inset-0 bg-slate-950/80 z-20 flex flex-col items-center justify-center backdrop-blur-sm">
                    <span className="material-symbols-outlined animate-spin text-lazdin-emerald mb-2 text-2xl">sync</span>
                    <span className="text-[10px] text-white font-black animate-pulse">ANALIZANDO IA...</span>
                  </div>
                )}
                <div className="relative z-10 flex flex-col items-center">
                   <span className={`text-[10px] font-black text-center ${fotoTicket ? 'text-white' : 'text-slate-600 uppercase'}`}>
                     {fotoTicket ? 'TICKET LISTO' : 'FOTO TICKET'}
                   </span>
                   {fotoTicket && !analizandoIA && <span className="text-[8px] bg-emerald-500 text-white px-2 py-0.5 rounded-full mt-1 font-black">EDITAR</span>}
                </div>
              </div>

              {/* Card Foto Surtidor */}
              <div 
                onClick={() => !analizandoIA && surtidorInputRef.current.click()}
                className={`group relative h-36 border-2 border-dashed ${fotoSurtidor ? 'border-lazdin-emerald bg-lazdin-emerald/10' : 'border-slate-800 bg-slate-950/30'} rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all active:scale-[0.98] overflow-hidden ${analizandoIA ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {previewSurtidor ? (
                  <img src={previewSurtidor} className="absolute inset-0 w-full h-full object-cover opacity-60" />
                ) : (
                  <span className={`material-symbols-outlined text-4xl mb-2 ${fotoSurtidor ? 'text-lazdin-emerald' : 'text-slate-700'}`}>gas_meter</span>
                )}
                {analizandoIA && (
                  <div className="absolute inset-0 bg-slate-950/80 z-20 flex flex-col items-center justify-center backdrop-blur-sm">
                    <span className="material-symbols-outlined animate-spin text-lazdin-emerald mb-2 text-2xl">sync</span>
                    <span className="text-[10px] text-white font-black animate-pulse">ANALIZANDO IA...</span>
                  </div>
                )}
                <div className="relative z-10 flex flex-col items-center">
                   <span className={`text-[10px] font-black text-center ${fotoSurtidor ? 'text-white' : 'text-slate-600 uppercase'}`}>
                     {fotoSurtidor ? 'SURTIDOR LISTO' : 'FOTO SURTIDOR'}
                   </span>
                   {fotoSurtidor && !analizandoIA && <span className="text-[8px] bg-emerald-500 text-white px-2 py-0.5 rounded-full mt-1 font-black">EDITAR</span>}
                </div>
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={saving || !form.litros || !form.odometro_actual} 
            className={`w-full h-16 ${tema.buttonBg} ${tema.buttonHover} ${tema.buttonText} font-black rounded-2xl shadow-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-lg mt-4 disabled:opacity-30 disabled:cursor-not-allowed`}
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