
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
  
  // Modais de Edição
  const [isEditingBarber, setIsEditingBarber] = useState(false);
  const [editingBarber, setEditingBarber] = useState<Partial<Barber>>({ name: '', username: '', password: '', assignedServices: [], active: true });
  const [isEditingService, setIsEditingService] = useState(false);
  const [editingService, setEditingService] = useState<Partial<Service>>({ name: '', price: 0, durationMinutes: 30 });
  const [isEditingShop, setIsEditingShop] = useState(false);
  const [editingShop, setEditingShop] = useState<Partial<Shop>>({ name: '', address: '', phone: '', whatsapp: '', instagram: '', active: true });
  
  // Finalização de agendamento
  const [isFinishingApp, setIsFinishingApp] = useState<string | null>(null);
  const [productSaleValue, setProductSaleValue] = useState<string>('0');

  // Perfil
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editAvatar, setEditAvatar] = useState<string | null>(null);
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
      if (!isAdmin) setSelectedBarbers([myProfile.id]);
    }
  }, [myProfile, isAdmin]);

  const loadData = () => {
    setAppointments(storageService.getAppointments().sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()));
    setServices(storageService.getServices());
    setBarbers(storageService.getBarbers());
    setShops(storageService.getShops());
    setConfig(storageService.getConfig());
  };

  const handleStatusChange = (id: string, status: Appointment['status'], productsRev?: number) => {
    storageService.updateAppointmentStatus(id, status, productsRev);
    setIsFinishingApp(null);
    setProductSaleValue('0');
    loadData();
  };

  const handleServiceSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService.name || (editingService.price || 0) <= 0) return;
    const updated = editingService.id
      ? services.map(s => s.id === editingService.id ? { ...s, ...editingService } as Service : s)
      : [...services, { ...editingService, id: crypto.randomUUID(), description: '' } as Service];
    storageService.saveServices(updated);
    setIsEditingService(false);
    loadData();
  };

  const handleDeleteService = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este serviço?')) {
      storageService.deleteService(id);
      loadData();
    }
  };

  const handleShopSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = editingShop.id
      ? shops.map(s => s.id === editingShop.id ? { ...s, ...editingShop } as Shop : s)
      : [...shops, { ...editingShop, id: crypto.randomUUID(), latitude: 0, longitude: 0, active: true } as Shop];
    storageService.saveShops(updated);
    setIsEditingShop(false);
    if (onShopUpdate) onShopUpdate();
    loadData();
  };

  const handleBarberSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = editingBarber.id
      ? barbers.map(b => b.id === editingBarber.id ? { ...b, ...editingBarber } as Barber : b)
      : [...barbers, { ...editingBarber, id: crypto.randomUUID(), active: true, isAdmin: false } as Barber];
    storageService.saveBarbers(updated);
    setIsEditingBarber(false);
    loadData();
  };

  const billingData = useMemo(() => {
    const completed = appointments.filter(a => a.status === 'completed');
    const filtered = isAdmin 
      ? (selectedBarbers.includes('all') ? completed : completed.filter(a => selectedBarbers.includes(a.barberId)))
      : completed.filter(a => a.barberId === myProfile?.id);
    
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    let daily = 0, weekly = 0, monthly = 0, productsMonthly = 0;
    const dailyChartData: { date: string, value: number }[] = [];
    for (let i = 14; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      dailyChartData.push({ date: d.toISOString().split('T')[0], value: 0 });
    }

    const serviceRanking: Record<string, number> = {};

    filtered.forEach(app => {
      const appDate = new Date(app.dateTime);
      const appDateStr = app.dateTime.split('T')[0];
      const srv = services.find(s => s.id === app.serviceId);
      const rev = (srv?.price || 0) + (app.productsRevenue || 0);
      
      if (appDateStr === todayStr) daily += rev;
      if (appDate >= firstDayOfMonth) {
        monthly += rev;
        productsMonthly += (app.productsRevenue || 0);
      }
      
      const chartIdx = dailyChartData.findIndex(d => d.date === appDateStr);
      if (chartIdx !== -1) dailyChartData[chartIdx].value += rev;
      if (srv) serviceRanking[srv.name] = (serviceRanking[srv.name] || 0) + rev;
    });

    return { 
      daily, monthly, productsMonthly, 
      chart: dailyChartData,
      maxVal: Math.max(...dailyChartData.map(d => d.value), 1),
      topServices: Object.entries(serviceRanking).sort((a,b) => b[1]-a[1]).slice(0,3)
    };
  }, [appointments, services, isAdmin, myProfile, selectedBarbers]);

  const filteredApps = useMemo(() => {
    let list = appointments;
    if (statusFilter !== 'all') list = list.filter(a => a.status === statusFilter);
    if (isAdmin) {
      if (!selectedBarbers.includes('all')) list = list.filter(a => selectedBarbers.includes(a.barberId));
    } else {
      list = list.filter(a => a.barberId === myProfile?.id);
    }
    return list;
  }, [appointments, statusFilter, selectedBarbers, isAdmin, myProfile]);

  const currentFinishing = useMemo(() => {
    const app = appointments.find(a => a.id === isFinishingApp);
    const srv = services.find(s => s.id === app?.serviceId);
    return { app, srv };
  }, [isFinishingApp, appointments, services]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-fade-in pb-32">
      <div className="flex flex-col lg:flex-row justify-between items-center mb-10 gap-6">
        <div className="flex items-center gap-4">
           <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center">
             {myProfile?.avatar ? <img src={myProfile.avatar} className="w-full h-full object-cover" /> : <i className="fa-solid fa-user-tie text-amber-500 text-3xl"></i>}
           </div>
           <div>
              <h1 className="text-4xl font-brand text-white uppercase tracking-tight">{myProfile?.name}</h1>
              <p className="text-amber-500 text-[10px] font-black uppercase tracking-widest">{isAdmin ? 'Master' : 'Barbeiro'}</p>
           </div>
        </div>

        <div className="flex bg-slate-800 p-1.5 rounded-2xl border border-slate-700 overflow-x-auto no-scrollbar w-full lg:w-auto">
          {[
            { id: 'agenda', label: 'Agenda', adminOnly: false },
            { id: 'faturamento', label: 'Faturamento', adminOnly: false },
            { id: 'perfil', label: 'Perfil', adminOnly: false },
            { id: 'equipe', label: 'Equipa', adminOnly: true },
            { id: 'cortes', label: 'Cortes', adminOnly: true },
            { id: 'lojas', label: 'Unidades', adminOnly: true }
          ].filter(t => !t.adminOnly || isAdmin).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-5 py-3 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest ${activeTab === tab.id ? 'bg-amber-500 text-slate-900' : 'text-slate-500 hover:text-white'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'agenda' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-brand text-white uppercase">Meus Horários</h2>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="bg-slate-800 border border-slate-700 text-[10px] font-bold p-2 rounded-xl text-slate-300 outline-none">
              <option value="pending">Pendentes</option>
              <option value="confirmed">Confirmados</option>
              <option value="all">Todos</option>
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredApps.length > 0 ? filteredApps.map(app => (
              <div key={app.id} className={`bg-slate-800/40 p-6 rounded-3xl border flex flex-col md:flex-row justify-between items-center gap-6 ${app.status === 'pending' ? 'border-amber-500/40 bg-amber-500/5' : 'border-slate-700'}`}>
                <div className="flex gap-4 items-center">
                   <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center font-brand text-2xl text-amber-500 border border-slate-700">{app.customerName.charAt(0)}</div>
                   <div>
                      <h4 className="font-bold text-white">{app.customerName}</h4>
                      <p className="text-[10px] text-slate-500 uppercase">{services.find(s => s.id === app.serviceId)?.name || 'Serviço'} • {new Date(app.dateTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                   </div>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                   {app.status === 'pending' && <button onClick={() => handleStatusChange(app.id, 'confirmed')} className="flex-1 bg-green-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase">Aceitar</button>}
                   {app.status === 'confirmed' && <button onClick={() => setIsFinishingApp(app.id)} className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase">Finalizar</button>}
                   <button onClick={() => handleStatusChange(app.id, 'cancelled')} className="flex-1 bg-red-600/10 text-red-500 px-6 py-2 rounded-xl text-[10px] font-bold border border-red-500/20">Recusar</button>
                </div>
              </div>
            )) : <p className="text-center py-20 text-slate-600 italic">Nada para mostrar aqui.</p>}
          </div>
        </div>
      )}

      {activeTab === 'faturamento' && (
        <div className="space-y-10 animate-fade-in">
           <div className="flex justify-between items-end">
              <h2 className="text-2xl font-brand text-white uppercase tracking-wider">Performance Financeira</h2>
              {isAdmin && (
                <button onClick={() => setShowGoalEditor(!showGoalEditor)} className="text-amber-500 text-xs font-black uppercase tracking-widest"><i className="fa-solid fa-gear mr-2"></i> Ajustar Meta</button>
              )}
           </div>

           {showGoalEditor && (
             <div className="bg-slate-800/60 p-6 rounded-3xl border border-amber-500/30 flex gap-4 items-end animate-fade-in">
                <div className="flex-1 space-y-1">
                   <label className="text-[9px] font-black text-slate-500 uppercase px-2">Meta de Faturamento Mensal (€)</label>
                   <input type="number" value={config.monthlyGoal} onChange={e => setConfig({...config, monthlyGoal: parseFloat(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl text-white font-brand text-2xl" />
                </div>
                <button onClick={() => { storageService.saveConfig(config); setShowGoalEditor(false); }} className="bg-amber-500 text-slate-900 px-8 py-4 rounded-xl font-black uppercase text-xs">Salvar</button>
             </div>
           )}

           <div className="bg-slate-800/40 p-8 rounded-[40px] border border-slate-700">
              <div className="h-48 flex items-end gap-2 md:gap-4">
                 {billingData.chart.map((d, i) => (
                   <div key={i} className="flex-1 h-full flex flex-col justify-end group relative">
                      <div className="w-full bg-gradient-to-t from-amber-600 to-amber-400 rounded-t-lg transition-all" style={{ height: `${(d.value / billingData.maxVal) * 100}%`, minHeight: d.value > 0 ? '4px' : '0' }}></div>
                      <p className="text-[7px] font-bold text-slate-600 uppercase mt-4 rotate-45">{d.date.split('-')[2]}/{d.date.split('-')[1]}</p>
                   </div>
                 ))}
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-800/40 p-8 rounded-3xl border border-slate-700">
                 <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Hoje</p>
                 <p className="text-4xl font-brand text-white">€ {billingData.daily.toFixed(2)}</p>
              </div>
              <div className="bg-slate-800/40 p-8 rounded-3xl border border-slate-700">
                 <p className="text-[9px] font-black text-slate-500 uppercase mb-2">No Mês</p>
                 <p className="text-4xl font-brand text-green-500">€ {billingData.monthly.toFixed(2)}</p>
                 <div className="mt-4 h-1.5 bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 transition-all" style={{ width: `${Math.min(100, (billingData.monthly / config.monthlyGoal) * 100)}%` }}></div>
                 </div>
              </div>
              <div className="bg-slate-800/40 p-8 rounded-3xl border border-slate-700">
                 <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Venda de Produtos (Mês)</p>
                 <p className="text-4xl font-brand text-violet-400">€ {billingData.productsMonthly.toFixed(2)}</p>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'lojas' && isAdmin && (
        <div className="space-y-8">
           <div className="flex justify-between items-center">
              <h2 className="text-2xl font-brand text-white uppercase">Gestão de Unidades</h2>
              <button onClick={() => { setEditingShop({ name: '', address: '', phone: '', whatsapp: '', instagram: '', facebook: '' }); setIsEditingShop(true); }} className="bg-amber-500 text-slate-900 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">Nova Unidade</button>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {shops.map(s => (
                 <div key={s.id} className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700 flex justify-between items-start">
                    <div>
                       <h3 className="text-xl font-brand text-white uppercase">{s.name}</h3>
                       <p className="text-xs text-slate-500 mb-4">{s.address}</p>
                       <div className="flex gap-4 text-xs text-slate-400 font-bold uppercase">
                          <span><i className="fa-solid fa-phone mr-1"></i> {s.phone}</span>
                          <span className="text-green-500"><i className="fa-brands fa-whatsapp mr-1"></i> {s.whatsapp}</span>
                          <span className="text-amber-500"><i className="fa-brands fa-instagram mr-1"></i> @{s.instagram}</span>
                       </div>
                    </div>
                    <button onClick={() => { setEditingShop(s); setIsEditingShop(true); }} className="text-slate-500 hover:text-white"><i className="fa-solid fa-pen"></i></button>
                 </div>
              ))}
           </div>
        </div>
      )}

      {activeTab === 'cortes' && isAdmin && (
        <div className="space-y-8">
           <div className="flex justify-between items-center">
              <h2 className="text-2xl font-brand text-white uppercase">Menu de Serviços</h2>
              <button onClick={() => { setEditingService({ name: '', price: 0, durationMinutes: 30 }); setIsEditingService(true); }} className="bg-amber-500 text-slate-900 px-6 py-2 rounded-xl text-[10px] font-black uppercase">Novo Serviço</button>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {services.map(s => (
                 <div key={s.id} className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700 flex justify-between items-center">
                    <div>
                       <p className="font-bold text-white uppercase">{s.name}</p>
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

      {/* MODAL CHECKOUT PRODUTOS */}
      {isFinishingApp && currentFinishing.app && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
           <div className="bg-slate-900 border border-slate-700 w-full max-w-sm p-10 rounded-[40px] space-y-8 animate-fade-in shadow-2xl">
              <div className="text-center">
                <h3 className="text-3xl font-brand text-white uppercase tracking-widest">Finalizar e Vender</h3>
                <div className="mt-4 p-4 bg-slate-950/50 rounded-2xl border border-slate-800">
                  <p className="text-[10px] text-slate-500 font-black uppercase">{currentFinishing.app.customerName}</p>
                  <p className="text-white font-bold">{currentFinishing.srv?.name}</p>
                  <p className="text-amber-500 font-brand text-xl">€ {currentFinishing.srv?.price.toFixed(2)}</p>
                </div>
              </div>
              <div className="space-y-4">
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase px-2">Venda Extra (Produtos)</label>
                    <div className="relative">
                       <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500 font-brand">€</span>
                       <input type="number" step="0.50" value={productSaleValue} onChange={e => setProductSaleValue(e.target.value)} className="w-full bg-slate-950 border border-slate-700 p-4 pl-8 rounded-2xl text-white font-brand text-3xl outline-none" />
                    </div>
                 </div>
                 <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex justify-between items-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Total do Ticket:</p>
                    <p className="text-2xl font-brand text-green-500">€ {((currentFinishing.srv?.price || 0) + (parseFloat(productSaleValue) || 0)).toFixed(2)}</p>
                 </div>
              </div>
              <div className="flex flex-col gap-3">
                 <button onClick={() => handleStatusChange(isFinishingApp, 'completed', parseFloat(productSaleValue))} className="w-full bg-green-600 text-white font-black py-5 rounded-2xl uppercase text-xs">Concluir Serviço</button>
                 <button onClick={() => setIsFinishingApp(null)} className="w-full text-slate-500 font-black uppercase text-[10px] pt-2">Voltar</button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL EDIÇÃO UNIDADE */}
      {isEditingShop && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto">
           <form onSubmit={handleShopSave} className="bg-slate-900 border border-slate-700 w-full max-w-xl p-10 my-8 rounded-[40px] space-y-8">
              <div className="text-center"><h3 className="text-3xl font-brand text-white uppercase tracking-widest">Configuração da Loja</h3></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                 <input type="text" placeholder="Nome" value={editingShop.name} onChange={e => setEditingShop({...editingShop, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-4 rounded-2xl text-white" required />
                 <input type="text" placeholder="Endereço" value={editingShop.address} onChange={e => setEditingShop({...editingShop, address: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-4 rounded-2xl text-white md:col-span-2" required />
                 <input type="text" placeholder="Telemóvel" value={editingShop.phone} onChange={e => setEditingShop({...editingShop, phone: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-4 rounded-2xl text-white" />
                 <input type="text" placeholder="WhatsApp" value={editingShop.whatsapp} onChange={e => setEditingShop({...editingShop, whatsapp: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-4 rounded-2xl text-white" />
                 <input type="text" placeholder="Instagram (@)" value={editingShop.instagram} onChange={e => setEditingShop({...editingShop, instagram: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-4 rounded-2xl text-white" />
                 <input type="text" placeholder="Facebook" value={editingShop.facebook} onChange={e => setEditingShop({...editingShop, facebook: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-4 rounded-2xl text-white" />
              </div>
              <div className="flex gap-4">
                 <button type="button" onClick={() => setIsEditingShop(false)} className="flex-1 text-slate-500 font-bold uppercase text-xs">Cancelar</button>
                 <button type="submit" className="flex-2 bg-amber-500 text-slate-900 font-black py-4 rounded-2xl uppercase text-xs">Salvar</button>
              </div>
           </form>
        </div>
      )}

      {/* MODAL EDIÇÃO SERVIÇO */}
      {isEditingService && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
           <form onSubmit={handleServiceSave} className="bg-slate-900 border border-slate-700 w-full max-w-md p-10 rounded-[40px] space-y-6">
              <h3 className="text-3xl font-brand text-white uppercase text-center">Configurar Corte</h3>
              <input type="text" placeholder="Nome" value={editingService.name} onChange={e => setEditingService({...editingService, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-4 rounded-2xl text-white" required />
              <div className="grid grid-cols-2 gap-4">
                 <input type="number" placeholder="Preço (€)" value={editingService.price} onChange={e => setEditingService({...editingService, price: parseFloat(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 p-4 rounded-2xl text-white" required />
                 <input type="number" placeholder="Duração (m)" value={editingService.durationMinutes} onChange={e => setEditingService({...editingService, durationMinutes: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 p-4 rounded-2xl text-white" required />
              </div>
              <div className="flex gap-4">
                 <button type="button" onClick={() => setIsEditingService(false)} className="flex-1 text-slate-500 font-bold uppercase text-xs">Cancelar</button>
                 <button type="submit" className="flex-1 bg-amber-500 text-slate-900 font-black py-4 rounded-2xl uppercase text-xs">Salvar</button>
              </div>
           </form>
        </div>
      )}
    </div>
  );
};

export default BarberDashboard;
