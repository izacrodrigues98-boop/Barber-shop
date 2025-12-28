
import React, { useState, useEffect, useMemo } from 'react';
import { Service, Appointment, BarberConfig, LoyaltyProfile, Barber } from '../types';
import { storageService } from '../services/storageService';

const POINTS_TO_REDEEM = 10; // 10 cortes = benefício
const DISCOUNT_VALUE = 20.00;

interface ClientBookingProps {
  clientPhone: string;
}

const ClientBooking: React.FC<ClientBookingProps> = ({ clientPhone }) => {
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [config, setConfig] = useState<BarberConfig>(storageService.getConfig());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [myAppointments, setMyAppointments] = useState<Appointment[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltyProfile | null>(null);

  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const [selectedService, setSelectedService] = useState('');
  const [selectedBarber, setSelectedBarber] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);

  const [currentMonth, setCurrentMonth] = useState(new Date());

  const refreshAppointments = () => {
    const allApps = storageService.getAppointments();
    setAppointments(allApps);
    const filtered = allApps.filter(a => a.customerPhone === clientPhone);
    setMyAppointments(filtered.sort((a,b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()));
    
    const profile = storageService.getLoyaltyProfile(clientPhone);
    setLoyalty(profile);
    if (profile.name) setName(profile.name);
    if (profile.avatar) setAvatar(profile.avatar);
  };

  useEffect(() => {
    setServices(storageService.getServices());
    setBarbers(storageService.getBarbers());
    setConfig(storageService.getConfig());
    refreshAppointments();

    const handleRefresh = () => refreshAppointments();
    window.addEventListener('na_regua_status_update', handleRefresh);
    return () => window.removeEventListener('na_regua_status_update', handleRefresh);
  }, [clientPhone]);

  const handleProfileUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    storageService.updateClientProfile(clientPhone, { name, avatar: avatar || undefined });
    setIsEditingProfile(false);
    alert('Perfil atualizado!');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const changeMonth = (offset: number) => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1);
    setCurrentMonth(next);
  };

  const selectedServiceObj = useMemo(() => 
    services.find(s => s.id === selectedService), 
  [selectedService, services]);

  const eligibleBarbers = useMemo(() => {
    if (!selectedService) return [];
    return barbers.filter(b => b.active && b.assignedServices.includes(selectedService));
  }, [selectedService, barbers]);

  const finalPrice = useMemo(() => {
    if (!selectedServiceObj) return 0;
    let price = selectedServiceObj.price;
    if (useLoyaltyPoints) price = Math.max(0, price - DISCOUNT_VALUE);
    return price;
  }, [selectedServiceObj, useLoyaltyPoints]);

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < (firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1); i++) days.push({ day: null });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let d = 1; d <= daysInMonth; d++) {
      const fullDate = new Date(year, month, d);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ day: d, dateStr, isPast: fullDate < today, isSunday: fullDate.getDay() === 0, isSelected: date === dateStr });
    }
    return days;
  }, [currentMonth, date]);

  const availableSlots = useMemo(() => {
    if (!date || !selectedBarber) return [];
    const barber = barbers.find(b => b.id === selectedBarber);
    const bConfig = barber?.config || config;
    const slots = [];
    const [openH, openM] = bConfig.openTime.split(':').map(Number);
    const [closeH, closeM] = bConfig.closeTime.split(':').map(Number);
    const startTimeBase = new Date(date + 'T00:00:00');
    const endTimeBase = new Date(date + 'T00:00:00');
    startTimeBase.setHours(openH, openM, 0, 0);
    endTimeBase.setHours(closeH, closeM, 0, 0);
    const now = new Date();
    let current = new Date(startTimeBase);
    while (current < endTimeBase) {
      const timeString = current.toTimeString().substring(0, 5);
      const isPast = current < now;
      const isBooked = appointments.some(app => {
        if (app.barberId !== selectedBarber || app.status === 'cancelled') return false;
        if (app.dateTime.split('T')[0] !== date) return false;
        const appStart = new Date(app.dateTime);
        const service = services.find(s => s.id === app.serviceId);
        const appEnd = new Date(appStart);
        appEnd.setMinutes(appEnd.getMinutes() + (service?.durationMinutes || 30));
        return current >= appStart && current < appEnd;
      });
      slots.push({ time: timeString, available: !isBooked && !isPast });
      current.setMinutes(current.getMinutes() + (bConfig.slotInterval || 60));
    }
    return slots;
  }, [date, config, appointments, services, selectedBarber, barbers]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !selectedService || !selectedBarber || !date || !time) return;
    setIsSubmitting(true);
    storageService.addAppointment({
      id: crypto.randomUUID(),
      customerName: name,
      customerPhone: clientPhone,
      serviceId: selectedService,
      barberId: selectedBarber,
      dateTime: `${date}T${time}:00`,
      status: 'pending',
      createdAt: new Date().toISOString(),
      usedLoyaltyPoints: useLoyaltyPoints,
      discountApplied: useLoyaltyPoints ? DISCOUNT_VALUE : 0
    });
    if (useLoyaltyPoints) storageService.updateLoyaltyPoints(clientPhone, -POINTS_TO_REDEEM);
    setTimeout(() => {
      setIsSubmitting(false);
      setBookingSuccess(true);
      refreshAppointments();
    }, 1000);
  };

  const Tooltip = ({ text }: { text: string }) => (
    <div className="group relative inline-block ml-2 align-middle">
      <i className="fa-solid fa-circle-info text-slate-500 hover:text-amber-500 transition-colors cursor-help text-xs"></i>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-950 border border-amber-500/30 rounded-xl text-[10px] text-slate-300 font-medium leading-relaxed opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 z-50 shadow-2xl scale-95 group-hover:scale-100">
        <p>{text}</p>
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-950"></div>
      </div>
    </div>
  );

  if (bookingSuccess) {
    return (
      <div className="max-w-md mx-auto text-center py-20 px-6 animate-fade-in">
        <div className="w-24 h-24 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-amber-500/20 border-4 border-slate-900">
          <i className="fa-solid fa-paper-plane text-slate-900 text-4xl"></i>
        </div>
        <h2 className="text-4xl font-brand mb-4 text-white uppercase tracking-wider">Pronto!</h2>
        <p className="text-slate-200 mb-2 font-bold">Seu agendamento foi enviado para seu barbeiro.</p>
        <p className="text-slate-500 mb-10 text-sm italic">Status: Enviado, aguardando resposta.</p>
        <button onClick={() => setBookingSuccess(false)} className="bg-amber-500 text-slate-900 font-bold py-4 px-10 rounded-2xl w-full uppercase tracking-widest text-sm">Entendido</button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 relative">
      {/* Modal Editar Perfil */}
      {isEditingProfile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm p-8 rounded-3xl animate-fade-in shadow-2xl">
            <h3 className="text-2xl font-brand text-white mb-6 uppercase tracking-widest text-center">Editar Meu Perfil</h3>
            <form onSubmit={handleProfileUpdate} className="space-y-6">
              <div className="flex flex-col items-center gap-4">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-amber-500 overflow-hidden flex items-center justify-center">
                    {avatar ? <img src={avatar} className="w-full h-full object-cover" /> : <i className="fa-solid fa-user text-4xl text-slate-600"></i>}
                  </div>
                  <label className="absolute bottom-0 right-0 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform shadow-lg">
                    <i className="fa-solid fa-camera text-slate-900 text-xs"></i>
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Seu Nome</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 p-4 rounded-2xl text-white outline-none focus:ring-2 focus:ring-amber-500" required />
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsEditingProfile(false)} className="flex-1 text-slate-500 text-xs font-bold uppercase">Cancelar</button>
                <button type="submit" className="flex-2 bg-amber-500 text-slate-900 font-bold py-3 px-8 rounded-xl uppercase text-xs">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Banner de Boas-vindas */}
      <div className="mb-12 flex flex-col md:flex-row items-center justify-between gap-8 p-10 rounded-3xl bg-slate-800/20 border border-slate-800 relative">
        <div className="flex items-center gap-6">
           <div className="w-20 h-20 rounded-2xl bg-slate-900 border border-slate-700 overflow-hidden flex items-center justify-center group cursor-pointer relative" onClick={() => setIsEditingProfile(true)}>
             {avatar ? <img src={avatar} className="w-full h-full object-cover" /> : <i className="fa-solid fa-user text-3xl text-slate-600"></i>}
             <div className="absolute inset-0 bg-amber-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
               <i className="fa-solid fa-pencil text-slate-900"></i>
             </div>
           </div>
           <div>
             <h1 className="text-4xl md:text-5xl font-brand tracking-tight text-white uppercase leading-none">OLÁ, {name ? name.split(' ')[0] : 'AMIGO'}</h1>
             <p className="text-slate-500 font-bold uppercase text-[9px] tracking-[0.3em] mt-1">Sempre um prazer te ver na régua</p>
           </div>
        </div>
        <button onClick={() => setIsEditingProfile(true)} className="bg-slate-900/50 hover:bg-slate-800 text-amber-500 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-700 transition-all flex items-center gap-3">
          <i className="fa-solid fa-sliders"></i>
          Meu Perfil
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-8">
          {/* Dashboard Fidelidade */}
          <div className="bg-slate-800/40 border-2 border-slate-700/50 p-8 rounded-3xl backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
               <div className="text-center md:text-left">
                  <h3 className="text-amber-500 font-brand text-3xl mb-1 uppercase tracking-wider">Cartão Fidelidade</h3>
                  <p className="text-slate-400 text-sm">Você acumulou <span className="text-white font-bold text-xl mx-1">{loyalty?.points || 0}</span> pontos (cortes).</p>
               </div>
               
               <div className="flex flex-col items-center gap-3">
                 <div className="flex gap-2">
                    {[...Array(10)].map((_, i) => (
                      <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${i < ((loyalty?.points || 0) % 11) ? 'bg-amber-500 border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-slate-900 border-slate-700'}`}></div>
                    ))}
                 </div>
                 {loyalty && loyalty.points >= POINTS_TO_REDEEM && (
                   <button onClick={() => setUseLoyaltyPoints(!useLoyaltyPoints)} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${useLoyaltyPoints ? 'bg-slate-700 text-amber-500 border border-amber-500' : 'bg-amber-500 text-slate-900 hover:scale-105 shadow-xl'}`}>
                     {useLoyaltyPoints ? 'Desconto de €20 Ativado' : 'Resgatar €20 de Desconto'}
                   </button>
                 )}
               </div>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/50 p-8 rounded-3xl backdrop-blur-md shadow-2xl space-y-12">
            <h2 className="text-3xl font-brand text-white text-center uppercase tracking-widest border-b border-slate-700 pb-6">Novo Agendamento</h2>
            
            <form onSubmit={handleSubmit} className="space-y-12">
              <div className="space-y-6">
                <h2 className="text-2xl font-brand text-white flex items-center">
                  <span className="w-8 h-8 rounded-lg bg-amber-500 text-slate-900 flex items-center justify-center font-bold mr-4">1</span>
                  Serviço
                  <Tooltip text="Escolha o tratamento desejado. Cada serviço tem um preço e duração específicos que ajustam automaticamente os horários disponíveis na agenda." />
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {services.map(srv => (
                    <label key={srv.id} className={`p-6 rounded-3xl border-2 cursor-pointer transition-all flex justify-between items-center ${selectedService === srv.id ? 'bg-amber-500/10 border-amber-500' : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'}`}>
                      <input type="radio" name="service" className="hidden" onChange={() => { setSelectedService(srv.id); setSelectedBarber(''); setTime(''); setDate(''); }} />
                      <div>
                        <p className={`font-bold ${selectedService === srv.id ? 'text-amber-500' : 'text-slate-100'}`}>{srv.name}</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{srv.durationMinutes} min</p>
                      </div>
                      <p className={`font-brand text-2xl ${selectedService === srv.id ? 'text-amber-500' : 'text-slate-400'}`}>€{srv.price.toFixed(2)}</p>
                    </label>
                  ))}
                </div>
              </div>

              {selectedService && (
                <div className="space-y-6 animate-fade-in">
                  <h2 className="text-2xl font-brand text-white flex items-center">
                    <span className="w-8 h-8 rounded-lg bg-amber-500 text-slate-900 flex items-center justify-center font-bold mr-4">2</span>
                    Profissional
                    <Tooltip text="Selecione seu profissional de confiança. Mostramos apenas os barbeiros habilitados para o serviço escolhido e que possuem agenda aberta." />
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {eligibleBarbers.map(barber => (
                      <label key={barber.id} className={`p-5 rounded-3xl border-2 cursor-pointer text-center transition-all ${selectedBarber === barber.id ? 'bg-amber-500/10 border-amber-500' : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'}`}>
                        <input type="radio" name="barber" className="hidden" onChange={() => { setSelectedBarber(barber.id); setDate(''); setTime(''); }} />
                        <div className="w-16 h-16 rounded-2xl mx-auto mb-3 overflow-hidden border border-slate-700">
                          {barber.avatar ? <img src={barber.avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-800 flex items-center justify-center text-amber-500 font-brand text-2xl">{barber.name.charAt(0)}</div>}
                        </div>
                        <p className={`text-[10px] font-black uppercase tracking-widest ${selectedBarber === barber.id ? 'text-amber-500' : 'text-slate-500'}`}>{barber.name}</p>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {selectedBarber && (
                <div className="space-y-6 animate-fade-in">
                  <h2 className="text-2xl font-brand text-white flex items-center">
                    <span className="w-8 h-8 rounded-lg bg-amber-500 text-slate-900 flex items-center justify-center font-bold mr-4">3</span>
                    Dia e Hora
                    <Tooltip text="Escolha o melhor momento para o seu atendimento. Os horários exibidos são os slots livres na agenda do profissional selecionado, respeitando o tempo do serviço." />
                  </h2>
                  
                  <div className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800 shadow-inner">
                    <div className="flex justify-between items-center mb-6">
                      <button type="button" onClick={() => changeMonth(-1)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-slate-400"><i className="fa-solid fa-chevron-left"></i></button>
                      <h3 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">{currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h3>
                      <button type="button" onClick={() => changeMonth(1)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-slate-400"><i className="fa-solid fa-chevron-right"></i></button>
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                      {calendarDays.map((d, i) => (
                        <div key={i}>
                          {d.day && (
                            <button type="button" disabled={d.isPast || d.isSunday} onClick={() => { setDate(d.dateStr || ''); setTime(''); }} className={`w-full aspect-square rounded-xl text-xs font-bold transition-all border ${d.isSelected ? 'bg-amber-500 border-amber-500 text-slate-900' : d.isPast || d.isSunday ? 'opacity-10 pointer-events-none' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-amber-500/50'}`}>
                              {d.day}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {date && (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pt-4 animate-fade-in">
                      {availableSlots.map(slot => (
                        <button key={slot.time} type="button" disabled={!slot.available} onClick={() => setTime(slot.time)} className={`py-3 rounded-xl text-[10px] font-black border transition-all ${time === slot.time ? 'bg-amber-500 border-amber-500 text-slate-900' : slot.available ? 'bg-slate-950 border-slate-800 text-slate-500' : 'opacity-10'}`}>
                          {slot.time}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="sticky bottom-4 left-0 right-0 bg-slate-900/90 backdrop-blur-lg p-6 rounded-3xl border border-slate-700 flex justify-between items-center shadow-2xl z-20">
                <div className="space-y-0.5">
                   <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Valor do Serviço</p>
                   <p className="text-3xl font-brand text-white">€ {finalPrice.toFixed(2)}</p>
                </div>
                <button type="submit" disabled={isSubmitting || !time} className="bg-amber-500 text-slate-900 font-bold py-5 px-10 rounded-2xl shadow-xl shadow-amber-500/20 text-xl disabled:opacity-20 active:scale-95 transition-all flex items-center gap-4">
                  {isSubmitting ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-calendar-plus"></i>}
                  <span className="uppercase tracking-widest font-black text-sm">Agendar Agora</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-10">
          <div className="bg-slate-800/20 border border-slate-800 p-8 rounded-3xl sticky top-24">
             <h2 className="text-2xl font-brand text-white mb-6 flex items-center gap-3">
               <i className="fa-solid fa-history text-amber-500"></i>
               Seu Histórico
             </h2>
             <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 no-scrollbar">
                {myAppointments.length === 0 ? (
                   <div className="text-center py-10 opacity-30"><p className="text-[10px] font-black uppercase tracking-widest">Sem registros.</p></div>
                ) : (
                  myAppointments.map(app => (
                    <div key={app.id} className={`p-5 rounded-2xl border transition-all ${app.status === 'cancelled' ? 'bg-slate-950/50 border-slate-800 opacity-50' : 'bg-slate-900/50 border-slate-700/50'}`}>
                       <div className="flex justify-between items-start mb-2">
                          <p className="font-bold text-slate-100 text-sm leading-tight">{services.find(s => s.id === app.serviceId)?.name}</p>
                          <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase ${app.status === 'confirmed' ? 'bg-blue-600' : app.status === 'pending' ? 'bg-amber-500 text-slate-900' : app.status === 'completed' ? 'bg-green-600' : 'bg-slate-800'}`}>
                            {app.status === 'pending' ? 'Enviado - Aguardando' : 
                             app.status === 'confirmed' ? 'Confirmado' : 
                             app.status === 'completed' ? 'Concluído' : 
                             'Cancelado'}
                          </span>
                       </div>
                       <div className="space-y-1">
                          <p className="text-[10px] text-amber-500/80 font-bold uppercase">{barbers.find(b => b.id === app.barberId)?.name}</p>
                          <p className="text-[10px] text-slate-400">{new Date(app.dateTime).toLocaleDateString()} às {new Date(app.dateTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                       </div>
                    </div>
                  ))
                )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientBooking;
