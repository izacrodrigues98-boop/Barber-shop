
import React, { useState, useEffect, useMemo } from 'react';
import { Appointment, Service, BarberConfig, Barber, Shop } from '../types';
import { storageService } from '../services/storageService';
import { BARBER_CREDENTIALS } from '../constants';

interface BarberDashboardProps {
  currentUser: string;
  onShopUpdate?: () => void;
}

const BarberDashboard: React.FC<BarberDashboardProps> = ({ currentUser, onShopUpdate }) => {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const myProfile = useMemo(() => barbers.find(b => b.username === currentUser), [barbers, currentUser]);
  const isAdmin = myProfile?.isAdmin || currentUser === BARBER_CREDENTIALS.username;
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [config, setConfig] = useState<BarberConfig>(storageService.getConfig());
  const [activeTab, setActiveTab] = useState<'agenda' | 'faturamento' | 'equipe' | 'cortes' | 'lojas' | 'perfil'>('agenda');
  const [statusFilter, setStatusFilter] = useState<Appointment['status'] | 'all'>('pending');
  const [selectedBarbers, setSelectedBarbers] = useState<string[]>(['all']);
  
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editAvatar, setEditAvatar] = useState<string | null>(null);

  const [isFinishingApp, setIsFinishingApp] = useState<string | null>(null);
  const [productSaleValue, setProductSaleValue] = useState<string>('0');

  const [isEditingBarber, setIsEditingBarber] = useState(false);
  const [editingBarber, setEditingBarber] = useState<Partial<Barber>>({ 
    name: '', 
    username: '', 
    password: '', 
    assignedServices: [], 
    active: true
  });
  
  const [isEditingService, setIsEditingService] = useState(false);
  const [editingService, setEditingService] = useState<Partial<Service>>({ name: '', price: 0, durationMinutes: 30 });

  const [isEditingShop, setIsEditingShop] = useState(false);
  const [editingShop, setEditingShop] = useState<Partial<Shop>>({ name: '', address: '', phone: '', whatsapp: '', instagram: '', active: true });

  const [saveMessage, setSaveMessage] = useState(false);
  const [showGoalEditor, setShowGoalEditor] = useState(false);

  useEffect(() => {
    loadData();
    const handleRefresh = () => loadData();
    window.addEventListener('na_regua_new_booking', handleRefresh);
    window.addEventListener('na_regua_status_update', handleRefresh);
    return () => {
      window.removeEventListener('na_regua_new_booking', handleRefresh);
      window.removeEventListener('na_regua_status_update', handleRefresh);
    };
  }, [currentUser]);

  useEffect(() => {
    if (myProfile) {
      setEditName(myProfile.name);
      setEditUsername(myProfile.username);
      setEditAvatar(myProfile.avatar || null);
      if (!isAdmin) {
        setSelectedBarbers([myProfile.id]);
      }
    }
  }, [myProfile, isAdmin]);

  const loadData = () => {
    const apps = storageService.getAppointments();
    const brbs = storageService.getBarbers();
    const svs = storageService.getServices();
    setAppointments(apps.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()));
    setServices(svs);
    setBarbers(brbs);
    setShops(storageService.getShops());
    setConfig(storageService.getConfig());
  };

  const handleStatusChange = (id: string, status: Appointment['status'], productsRev?: number) => {
    storageService.updateAppointmentStatus(id, status, productsRev);
    setIsFinishingApp(null);
    setProductSaleValue('0');
    loadData();
  };

  const handleDeleteService = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este serviço?')) {
      storageService.deleteService(id);
      loadData();
    }
  };

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName || !editUsername) return;
    const updatedProfile = storageService.updateBarberProfile(currentUser, {
      name: editName,
      username: editUsername,
      avatar: editAvatar || undefined
    });
    if (updatedProfile) {
      if (editUsername !== currentUser) {
        localStorage.setItem('na_regua_barber_user', editUsername);
        window.location.reload(); 
      }
      setSaveMessage(true);
      setTimeout(() => setSaveMessage(false), 3000);
      loadData();
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setEditAvatar(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleBarberSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBarber.name || !editingBarber.username) return;
    const updated = editingBarber.id 
      ? barbers.map(b => b.id === editingBarber.id ? { ...b, ...editingBarber } : b)
      : [...barbers, { ...(editingBarber as Barber), id: crypto.randomUUID(), active: true, isAdmin: false }];
    storageService.saveBarbers(updated as Barber[]);
    setIsEditingBarber(false);
    loadData();
  };

  const handleServiceSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService.name || (editingService.price || 0) <= 0) return;
    const updated = editingService.id
      ? services.map(s => s.id === editingService.id ? { ...s, ...editingService } : s)
      : [...services, { ...(editingService as Service), id: crypto.randomUUID(), description: '' }];
    storageService.saveServices(updated);
    setIsEditingService(false);
    loadData();
  };

  const handleShopSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShop.name) return;
    const updated = editingShop.id
      ? shops.map(s => s.id === editingShop.id ? { ...s, ...editingShop } as Shop : s)
      : [...shops, { ...editingShop, id: crypto.randomUUID(), latitude: 0, longitude: 0 } as Shop];
    storageService.saveShops(updated);
    setIsEditingShop(false);
    if (onShopUpdate) onShopUpdate();
    loadData();
  };

  const handleGoalSave = () => {
    storageService.saveConfig(config);
    setShowGoalEditor(false);
    setSaveMessage(true);
    setTimeout(() => setSaveMessage(false), 3000);
  };

  const billingData = useMemo(() => {
    const completed = appointments.filter(a => a.status === 'completed');
    const filteredByAccess = isAdmin 
      ? (selectedBarbers.includes('all') ? completed : completed.filter(a => selectedBarbers.includes(a.barberId)))
      : completed.filter(a => a.barberId === myProfile?.id);
    
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const firstDayOfWeek = new Date(now);
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    firstDayOfWeek.setDate(diff);
    firstDayOfWeek.setHours(0,0,0,0);
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let daily = 0, weekly = 0, monthly = 0;
    let productsDaily = 0, productsMonthly = 0;
    
    const dailyChartData: { date: string, value: number }[] = [];
    for (let i = 14; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      dailyChartData.push({ date: dStr, value: 0 });
    }

    const serviceRevenue: Record<string, number> = {};

    filteredByAccess.forEach(app => {
      const appDateStr = app.dateTime.split('T')[0];
      const appDate = new Date(app.dateTime);
      const srv = services.find(s => s.id === app.serviceId);
      const srvRev = (srv?.price || 0) - (app.discountApplied || 0);
      const totalRevenue = srvRev + (app.productsRevenue || 0);
      
      if (appDateStr === todayStr) { daily += totalRevenue; productsDaily += (app.productsRevenue || 0); }
      if (appDate >= firstDayOfWeek) weekly += totalRevenue;
      if (appDate >= firstDayOfMonth) { monthly += totalRevenue; productsMonthly += (app.productsRevenue || 0); }
      
      const chartIndex = dailyChartData.findIndex(d => d.date === appDateStr);
      if (chartIndex !== -1) dailyChartData[chartIndex].value += totalRevenue;

      if (srv) {
        serviceRevenue[srv.name] = (serviceRevenue[srv.name] || 0) + srvRev;
      }
    });

    const topServices = Object.entries(serviceRevenue)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);

    return { 
      daily, weekly, monthly, 
      productsDaily, productsMonthly, 
      dailyChartData, 
      topServices,
      maxDailyValue: Math.max(...dailyChartData.map(d => d.value), 1)
    };
  }, [appointments, services, isAdmin, myProfile, selectedBarbers]);

  const filteredAppointments = useMemo(() => {
    let filtered = appointments;
    if (statusFilter !== 'all') filtered = filtered.filter(a => a.status === statusFilter);
    if (isAdmin) {
      if (!selectedBarbers.includes('all')) filtered = filtered.filter(a => selectedBarbers.includes(a.barberId));
    } else {
      filtered = filtered.filter(a => a.barberId === myProfile?.id);
    }
    return filtered;
  }, [appointments, statusFilter, selectedBarbers, isAdmin, myProfile]);

  const pendingCount = appointments.filter(a => (isAdmin ? true : a.barberId === myProfile?.id) && a.status === 'pending').length;

  const currentFinishingApp = useMemo(() => {
    if (!isFinishingApp) return null;
    return appointments.find(a => a.id === isFinishingApp);
  }, [isFinishingApp, appointments]);

  const currentFinishingService = useMemo(() => {
    if (!currentFinishingApp) return null;
    return services.find(s => s.id === currentFinishingApp.serviceId);
  }, [currentFinishingApp, services]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-fade-in pb-32">
      <div className="flex flex-col lg:flex-row justify-between items-center mb-10 gap-6">
        <div className="flex items-center gap-4">
           <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center">
             {myProfile?.avatar ? <img src={myProfile.avatar} className="w-full h-full object-cover" /> : <i className="fa-solid fa-user-tie text-amber-500 text-3xl"></i>}
           </div>
           <div>
              <h1 className="text-4xl font-brand text-white uppercase tracking-tight leading-none">{myProfile?.name}</h1>
              <p className="text-amber-500 text-[10px] font-black uppercase tracking-widest mt-1">
                {isAdmin ? 'Administrador Master' : 'Barbeiro Profissional'}
              </p>
           </div>
        </div>

        <div className="flex bg-slate-800 p-1.5 rounded-2xl border border-slate-700 shadow-2xl overflow-x-auto no-scrollbar w-full lg:w-auto">
          {[
            { id: 'agenda', label: 'Agenda', adminOnly: false },
            { id: 'faturamento', label: 'Faturamento', adminOnly: false },
            { id: 'perfil', label: 'Meu Perfil', adminOnly: false },
            { id: 'equipe', label: 'Equipa', adminOnly: true },
            { id: 'cortes', label: 'Cortes', adminOnly: true },
            { id: 'lojas', label: 'Unidades', adminOnly: true }
          ].filter(t => !t.adminOnly || isAdmin).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`relative px-5 py-3 rounded-xl text-[10px] font-black transition-all whitespace-nowrap uppercase tracking-widest ${activeTab === tab.id ? 'bg-amber-500 text-slate-900' : 'text-slate-500 hover:text-white'}`}>
              {tab.label}
              {tab.id === 'agenda' && pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white flex items-center justify-center rounded-full text-[8px] border-2 border-slate-800 animate-pulse">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'agenda' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
             <h2 className="text-2xl font-brand text-white uppercase">Agenda</h2>
             <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="bg-slate-800 border border-slate-700 text-[10px] font-bold uppercase p-2 rounded-xl text-slate-300 outline-none w-full md:w-auto">
               <option value="pending">Pendentes</option>
               <option value="confirmed">Confirmados</option>
               <option value="all">Todos</option>
             </select>
          </div>

          {isAdmin && (
            <div className="space-y-2">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Barbeiros:</p>
              <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar">
                <button onClick={() => setSelectedBarbers(['all'])} className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border whitespace-nowrap ${selectedBarbers.includes('all') ? 'bg-amber-500 border-amber-500 text-slate-900' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>Todos</button>
                {barbers.map(b => (
                  <button key={b.id} onClick={() => setSelectedBarbers([b.id])} className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border whitespace-nowrap ${selectedBarbers.includes(b.id) && !selectedBarbers.includes('all') ? 'bg-amber-500 border-amber-500 text-slate-900' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>{b.name}</button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            {filteredAppointments.length > 0 ? filteredAppointments.map(app => (
              <div key={app.id} className={`bg-slate-800/40 p-6 rounded-3xl border transition-all flex flex-col md:flex-row justify-between items-center gap-6 ${app.status === 'pending' ? 'border-amber-500/40 bg-amber-500/5' : 'border-slate-700'}`}>
                <div className="flex gap-4 items-center">
                   <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center font-brand text-2xl text-amber-500 border border-slate-700">{app.customerName.charAt(0)}</div>
                   <div>
                      <h4 className="font-bold text-white">{app.customerName}</h4>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest">{services.find(s => s.id === app.serviceId)?.name || 'Serviço'} • {new Date(app.dateTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                      <p className="text-[9px] text-amber-500/60 font-bold uppercase mt-1">Barbeiro: {barbers.find(b => b.id === app.barberId)?.name}</p>
                   </div>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                   {app.status === 'pending' && <button onClick={() => handleStatusChange(app.id, 'confirmed')} className="flex-1 bg-green-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase">Aceitar</button>}
                   {app.status === 'confirmed' && <button onClick={() => setIsFinishingApp(app.id)} className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase">Finalizar</button>}
                   <button onClick={() => handleStatusChange(app.id, 'cancelled')} className="flex-1 bg-red-600/10 text-red-500 px-6 py-2 rounded-xl text-[10px] font-bold border border-red-500/20">Recusar</button>
                </div>
              </div>
            )) : <p className="text-center py-20 text-slate-600 italic">Nenhum agendamento.</p>}
          </div>
        </div>
      )}

      {activeTab === 'faturamento' && (
        <div className="space-y-10 animate-fade-in">
           <div className="flex flex-col md:flex-row justify-between items-end gap-6">
              <div>
                 <h2 className="text-2xl font-brand text-white uppercase tracking-wider">{isAdmin ? 'Performance Financeira' : 'Minha Performance'}</h2>
                 <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">Dados de faturamento e metas</p>
              </div>
              {isAdmin && (
                <div className="flex gap-2 bg-slate-800 p-1 rounded-xl border border-slate-700">
                   <button onClick={() => setSelectedBarbers(['all'])} className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase transition-all ${selectedBarbers.includes('all') ? 'bg-amber-500 text-slate-900' : 'text-slate-500'}`}>Toda Loja</button>
                   <button onClick={() => setSelectedBarbers([myProfile?.id || ''])} className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase transition-all ${!selectedBarbers.includes('all') ? 'bg-amber-500 text-slate-900' : 'text-slate-500'}`}>Só Eu</button>
                </div>
              )}
           </div>

           {/* Gráfico */}
           <div className="bg-slate-800/40 border border-slate-700 p-8 rounded-[40px]">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-10">Faturamento Diário (15 dias)</h3>
              <div className="h-48 flex items-end gap-2 md:gap-4">
                 {billingData.dailyChartData.map((d, i) => (
                   <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                      <div className="w-full bg-gradient-to-t from-amber-600 to-amber-400 rounded-t-lg" style={{ height: `${(d.value / billingData.maxDailyValue) * 100}%`, minHeight: d.value > 0 ? '4px' : '0' }}></div>
                      <p className="text-[7px] font-bold text-slate-600 uppercase mt-4 rotate-45">{new Date(d.date).toLocaleDateString([], {day:'2-digit'})}</p>
                   </div>
                 ))}
              </div>
           </div>

           {/* Metas Integradas */}
           <div className="bg-slate-800/60 p-8 rounded-3xl border border-slate-700 shadow-xl">
              <div className="flex justify-between items-center mb-6">
                 <div>
                    <h3 className="text-xl font-brand text-white uppercase">Meta Mensal da Unidade</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Objetivo: € {config.monthlyGoal.toFixed(2)}</p>
                 </div>
                 {isAdmin && (
                   <button onClick={() => setShowGoalEditor(!showGoalEditor)} className="text-amber-500 hover:text-white transition-colors">
                     <i className="fa-solid fa-gear"></i>
                   </button>
                 )}
              </div>
              
              {showGoalEditor && isAdmin && (
                <div className="mb-8 p-6 bg-slate-950/50 rounded-2xl border border-slate-700 animate-fade-in flex flex-col md:flex-row gap-4 items-end">
                  <div className="flex-1 space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase px-1">Nova Meta Financeira (€)</label>
                    <input type="number" value={config.monthlyGoal} onChange={e => setConfig({...config, monthlyGoal: parseFloat(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl text-white outline-none focus:border-amber-500" />
                  </div>
                  <button onClick={handleGoalSave} className="bg-amber-500 text-slate-900 px-6 py-3 rounded-xl font-black uppercase text-[10px]">Atualizar Meta</button>
                </div>
              )}

              <div className="w-full h-4 bg-slate-900 rounded-full overflow-hidden border border-slate-700 p-0.5">
                 <div className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (billingData.monthly / (config.monthlyGoal || 1)) * 100)}%` }}></div>
              </div>
              <div className="flex justify-between mt-3">
                <p className="text-[10px] font-black text-slate-500 uppercase">Progresso: € {billingData.monthly.toFixed(2)}</p>
                <p className="text-[10px] font-black text-amber-500 uppercase">{((billingData.monthly / (config.monthlyGoal || 1)) * 100).toFixed(1)}%</p>
              </div>
           </div>

           <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700 text-center">
                 <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Hoje</p>
                 <p className="text-2xl font-brand text-white">€ {billingData.daily.toFixed(2)}</p>
              </div>
              <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700 text-center">
                 <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Semana</p>
                 <p className="text-2xl font-brand text-amber-500">€ {billingData.weekly.toFixed(2)}</p>
              </div>
              <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700 text-center">
                 <p className="text-[9px] font-black text-slate-500 uppercase mb-2">No Mês</p>
                 <p className="text-2xl font-brand text-green-500">€ {billingData.monthly.toFixed(2)}</p>
              </div>
              <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700 text-center">
                 <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Produtos</p>
                 <p className="text-2xl font-brand text-violet-400">€ {billingData.productsMonthly.toFixed(2)}</p>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'lojas' && isAdmin && (
        <div className="space-y-8 animate-fade-in">
           <div className="flex justify-between items-center">
              <div>
                 <h2 className="text-2xl font-brand text-white uppercase tracking-wider">Nossas Unidades</h2>
                 <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">Gerencie endereços e contatos</p>
              </div>
              <button onClick={() => { setEditingShop({ name: '', address: '', phone: '', whatsapp: '', instagram: '', facebook: '', active: true }); setIsEditingShop(true); }} className="bg-amber-500 text-slate-900 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                <i className="fa-solid fa-shop mr-2"></i>
                Adicionar Loja
              </button>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {shops.map(shop => (
                 <div key={shop.id} className="bg-slate-800/40 p-8 rounded-3xl border border-slate-700 hover:border-slate-500 transition-all flex justify-between items-start group">
                    <div className="space-y-4">
                       <div>
                          <h3 className="text-2xl font-brand text-white uppercase mb-1">{shop.name}</h3>
                          <p className="text-[10px] text-slate-500 flex items-center gap-2"><i className="fa-solid fa-location-dot"></i> {shop.address}</p>
                       </div>
                       <div className="flex gap-4">
                          {shop.phone && <div className="text-[10px] font-bold text-slate-400 uppercase"><i className="fa-solid fa-phone mr-1"></i> {shop.phone}</div>}
                          {shop.whatsapp && <div className="text-[10px] font-bold text-green-500 uppercase"><i className="fa-brands fa-whatsapp mr-1"></i> {shop.whatsapp}</div>}
                          {shop.instagram && <div className="text-[10px] font-bold text-amber-500 uppercase"><i className="fa-brands fa-instagram mr-1"></i> @{shop.instagram}</div>}
                       </div>
                    </div>
                    <button onClick={() => { setEditingShop(shop); setIsEditingShop(true); }} className="text-slate-500 hover:text-amber-500 transition-colors p-2"><i className="fa-solid fa-pen"></i></button>
                 </div>
              ))}
           </div>
        </div>
      )}

      {/* REUTILIZAR MODAIS DA VERSÃO ANTERIOR PARA BARBEIROS E CORTES (EQUIPE/CORTES) */}
      {activeTab === 'cortes' && isAdmin && (
        <div className="space-y-8 animate-fade-in">
           <div className="flex justify-between items-center">
              <div><h2 className="text-2xl font-brand text-white uppercase">Cortes e Preços</h2></div>
              <button onClick={() => { setEditingService({ name: '', price: 0, durationMinutes: 30 }); setIsEditingService(true); }} className="bg-amber-500 text-slate-900 px-6 py-3 rounded-2xl text-[10px] font-black uppercase">Novo Serviço</button>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map(s => (
                 <div key={s.id} className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700 flex justify-between items-center group">
                    <div>
                       <p className="font-bold text-white uppercase mb-1">{s.name}</p>
                       <p className="text-[11px] text-amber-500 font-black">€ {s.price.toFixed(2)} • {s.durationMinutes}m</p>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => { setEditingService(s); setIsEditingService(true); }} className="text-slate-500 hover:text-white p-2"><i className="fa-solid fa-pen"></i></button>
                       <button onClick={() => handleDeleteService(s.id)} className="text-slate-500 hover:text-red-500 p-2"><i className="fa-solid fa-trash"></i></button>
                    </div>
                 </div>
              ))}
           </div>
        </div>
      )}

      {activeTab === 'equipe' && isAdmin && (
        <div className="space-y-8 animate-fade-in">
           <div className="flex justify-between items-center">
              <div><h2 className="text-2xl font-brand text-white uppercase tracking-wider">Equipa de Barbeiros</h2></div>
              <button onClick={() => { setEditingBarber({ name: '', username: '', password: '', assignedServices: [], active: true }); setIsEditingBarber(true); }} className="bg-amber-500 text-slate-900 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-amber-500/10">Novo Barbeiro</button>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {barbers.map(b => (
                 <div key={b.id} className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700 flex justify-between items-center group hover:border-slate-500 transition-all">
                    <div className="flex items-center gap-4">
                       <div className="w-14 h-14 rounded-2xl bg-slate-900 overflow-hidden flex items-center justify-center border border-slate-700">
                          {b.avatar ? <img src={b.avatar} className="w-full h-full object-cover" /> : <i className="fa-solid fa-user-tie text-slate-600 text-2xl"></i>}
                       </div>
                       <div>
                          <p className="font-bold text-white uppercase tracking-wide">{b.name}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest">@{b.username}</p>
                          {b.isAdmin && <span className="inline-block mt-1 text-[7px] bg-amber-500/10 text-amber-500 border border-amber-500/30 px-2 py-0.5 rounded-full font-black uppercase">Admin Master</span>}
                       </div>
                    </div>
                    <div className="flex gap-2">
                       {!b.isAdmin && <button onClick={() => { setEditingBarber(b); setIsEditingBarber(true); }} className="text-slate-500 hover:text-amber-500 p-2"><i className="fa-solid fa-pen"></i></button>}
                    </div>
                 </div>
              ))}
           </div>
        </div>
      )}

      {activeTab === 'perfil' && (
        <div className="max-w-2xl mx-auto animate-fade-in">
           <form onSubmit={handleProfileSave} className="bg-slate-800/40 p-10 rounded-[40px] border border-slate-700 space-y-8 shadow-2xl">
              <h2 className="text-3xl font-brand text-white uppercase tracking-widest text-center">Meu Perfil</h2>
              <div className="flex flex-col items-center gap-4">
                 <div className="relative group">
                    <div className="w-32 h-32 rounded-3xl bg-slate-900 border-2 border-slate-700 overflow-hidden flex items-center justify-center">
                       {editAvatar ? <img src={editAvatar} className="w-full h-full object-cover" /> : <i className="fa-solid fa-user-tie text-5xl text-slate-700"></i>}
                    </div>
                    <label className="absolute -bottom-2 -right-2 w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center cursor-pointer shadow-xl border-2 border-slate-800 hover:scale-110 transition-transform">
                       <i className="fa-solid fa-camera text-slate-900"></i>
                       <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
                    </label>
                 </div>
              </div>
              <div className="grid grid-cols-1 gap-6">
                 <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-slate-950/50 border border-slate-700 p-4 rounded-2xl text-white outline-none focus:border-amber-500" placeholder="Nome Profissional" />
                 <input type="text" value={editUsername} onChange={e => setEditUsername(e.target.value)} className="w-full bg-slate-950/50 border border-slate-700 p-4 rounded-2xl text-white outline-none focus:border-amber-500" placeholder="Usuário" />
              </div>
              <button type="submit" className="w-full bg-amber-500 py-5 rounded-2xl font-black text-slate-900 uppercase tracking-widest shadow-xl">Salvar Alterações</button>
           </form>
        </div>
      )}

      {/* MODAL EDIÇÃO LOJA */}
      {isEditingShop && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto">
           <form onSubmit={handleShopSave} className="bg-slate-900 border border-slate-700 w-full max-w-xl p-10 my-8 rounded-[40px] space-y-8 animate-fade-in">
              <div className="text-center">
                 <h3 className="text-3xl font-brand text-white uppercase tracking-widest">Configuração da Unidade</h3>
                 <p className="text-[9px] text-slate-500 uppercase font-black">Dados visíveis para os clientes</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                 <div className="md:col-span-2 space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase px-2">Nome da Barbearia</label>
                    <input type="text" value={editingShop.name} onChange={e => setEditingShop({...editingShop, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-4 rounded-2xl text-white outline-none" required />
                 </div>
                 <div className="md:col-span-2 space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase px-2">Endereço Completo</label>
                    <input type="text" value={editingShop.address} onChange={e => setEditingShop({...editingShop, address: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-4 rounded-2xl text-white outline-none" required />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase px-2">Telemóvel (Site)</label>
                    <input type="text" value={editingShop.phone} onChange={e => setEditingShop({...editingShop, phone: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-4 rounded-2xl text-white outline-none" />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase px-2">WhatsApp</label>
                    <input type="text" value={editingShop.whatsapp} onChange={e => setEditingShop({...editingShop, whatsapp: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-4 rounded-2xl text-white outline-none" />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase px-2">Instagram (@)</label>
                    <input type="text" value={editingShop.instagram} onChange={e => setEditingShop({...editingShop, instagram: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-4 rounded-2xl text-white outline-none" />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase px-2">Facebook</label>
                    <input type="text" value={editingShop.facebook} onChange={e => setEditingShop({...editingShop, facebook: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-4 rounded-2xl text-white outline-none" />
                 </div>
              </div>
              <div className="flex gap-4">
                 <button type="button" onClick={() => setIsEditingShop(false)} className="flex-1 text-slate-500 font-black uppercase text-xs">Cancelar</button>
                 <button type="submit" className="flex-2 bg-amber-500 text-slate-900 font-black py-4 px-8 rounded-2xl uppercase text-xs">Salvar Unidade</button>
              </div>
           </form>
        </div>
      )}

      {/* MODAL EDIÇÃO BARBEIRO */}
      {isEditingBarber && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto">
           <form onSubmit={handleBarberSave} className="bg-slate-900 border border-slate-700 w-full max-w-lg p-10 my-8 rounded-[40px] space-y-8 animate-fade-in">
              <h3 className="text-2xl font-brand text-white uppercase text-center">Gestão de Barbeiro</h3>
              <div className="space-y-4">
                 <input type="text" placeholder="Nome" value={editingBarber.name} onChange={e => setEditingBarber({...editingBarber, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-4 rounded-2xl text-white outline-none" required />
                 <input type="text" placeholder="Usuário" value={editingBarber.username} onChange={e => setEditingBarber({...editingBarber, username: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-4 rounded-2xl text-white outline-none" required />
                 <input type="password" placeholder="Senha" value={editingBarber.password || ''} onChange={e => setEditingBarber({...editingBarber, password: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-4 rounded-2xl text-white outline-none" required={!editingBarber.id} />
                 <div className="flex flex-wrap gap-2">
                    {services.map(s => (
                       <button key={s.id} type="button" onClick={() => {
                          const current = editingBarber.assignedServices || [];
                          const updated = current.includes(s.id) ? current.filter(id => id !== s.id) : [...current, s.id];
                          setEditingBarber({...editingBarber, assignedServices: updated});
                       }} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${editingBarber.assignedServices?.includes(s.id) ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                          {s.name}
                       </button>
                    ))}
                 </div>
              </div>
              <div className="flex gap-4">
                 <button type="button" onClick={() => setIsEditingBarber(false)} className="flex-1 text-slate-500 font-black uppercase text-xs">Cancelar</button>
                 <button type="submit" className="flex-2 bg-amber-500 text-slate-900 font-black py-4 px-8 rounded-2xl uppercase text-xs">Salvar</button>
              </div>
           </form>
        </div>
      )}

      {/* MODAL EDIÇÃO SERVIÇO */}
      {isEditingService && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
           <form onSubmit={handleServiceSave} className="bg-slate-900 border border-slate-700 w-full max-w-md p-10 rounded-[40px] space-y-6">
              <h3 className="text-2xl font-brand text-white uppercase text-center">Novo Serviço</h3>
              <input type="text" placeholder="Nome" value={editingService.name} onChange={e => setEditingService({...editingService, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-4 rounded-2xl text-white outline-none" required />
              <div className="grid grid-cols-2 gap-4">
                 <input type="number" placeholder="Preço" value={editingService.price} onChange={e => setEditingService({...editingService, price: parseFloat(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 p-4 rounded-2xl text-white outline-none" required />
                 <input type="number" placeholder="Minutos" value={editingService.durationMinutes} onChange={e => setEditingService({...editingService, durationMinutes: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 p-4 rounded-2xl text-white outline-none" required />
              </div>
              <div className="flex gap-4">
                 <button type="button" onClick={() => setIsEditingService(false)} className="flex-1 text-slate-500 font-bold uppercase text-xs">Cancelar</button>
                 <button type="submit" className="flex-1 bg-amber-500 text-slate-900 font-black py-4 rounded-2xl uppercase text-xs">Salvar</button>
              </div>
           </form>
        </div>
      )}

      {/* MODAL FINALIZAR AGENDAMENTO COM PRODUTOS - REFINADO */}
      {isFinishingApp && currentFinishingApp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
           <div className="bg-slate-900 border border-slate-700 w-full max-w-sm p-10 rounded-[40px] space-y-8 animate-fade-in shadow-2xl">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
                   <i className="fa-solid fa-basket-shopping text-blue-500 text-2xl"></i>
                </div>
                <h3 className="text-3xl font-brand text-white uppercase tracking-widest leading-none">Finalizar e Vender</h3>
                <div className="mt-4 p-4 bg-slate-950/50 rounded-2xl border border-slate-800">
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Atendimento para</p>
                  <p className="text-white font-bold">{currentFinishingApp.customerName}</p>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-800">
                    <p className="text-[10px] text-slate-500 font-black uppercase">{currentFinishingService?.name}</p>
                    <p className="text-amber-500 font-brand">€ {(currentFinishingService?.price || 0).toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-500 uppercase px-2">Venda de Produtos Adicionais (€)</label>
                   <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-brand text-amber-500">€</span>
                      <input 
                        type="number" 
                        step="0.01" 
                        autoFocus
                        value={productSaleValue} 
                        onChange={e => setProductSaleValue(e.target.value)} 
                        className="w-full bg-slate-950 border border-slate-700 p-4 pl-8 rounded-2xl text-white font-brand text-3xl outline-none focus:border-amber-500 transition-colors" 
                      />
                   </div>
                   <p className="text-[9px] text-slate-500 italic px-2">Ex: Pomadas, Shampoos, Óleos, etc.</p>
                </div>

                <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl flex justify-between items-center">
                   <p className="text-[10px] text-slate-400 font-black uppercase">Total do Faturamento:</p>
                   <p className="text-2xl font-brand text-amber-500">€ {((currentFinishingService?.price || 0) + (parseFloat(productSaleValue) || 0)).toFixed(2)}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                 <button onClick={() => handleStatusChange(isFinishingApp, 'completed', parseFloat(productSaleValue))} className="w-full bg-green-600 text-white font-black py-5 rounded-2xl uppercase text-xs shadow-xl shadow-green-500/10 hover:brightness-110 active:scale-95 transition-all">Concluir Atendimento</button>
                 <button onClick={() => setIsFinishingApp(null)} className="w-full text-slate-500 font-black uppercase text-[10px] tracking-widest pt-2 hover:text-white transition-colors">Cancelar</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default BarberDashboard;
