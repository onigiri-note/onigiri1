import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot, setDoc, doc } from 'firebase/firestore';
import { ChevronLeft, ChevronRight, Download, BarChart2, ArrowLeft } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay, isToday, subMonths, subYears } from 'date-fns';
import { ja } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import DailyNoteView from './components/DailyNoteView';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};
const appId = firebaseConfig.appId;

// =================================================================
// View Components
// =================================================================

const CalendarView = React.memo(({
    currentMonth, goToPrevMonth, goToNextMonth, firstDay, daysOfMonth,
    handleDayClick, selectedDate, dayHasRecord, setView
}) => (
    <div className="w-full md:w-1/2 p-4 bg-gray-50 rounded-xl shadow-inner">
        <div className="flex justify-between items-center mb-4">
            <button onClick={goToPrevMonth}><ChevronLeft /></button>
            <h2 className="text-2xl font-bold">{format(currentMonth, 'yyyy年 M月', { locale: ja })}</h2>
            <button onClick={goToNextMonth}><ChevronRight /></button>
        </div>
        <div className="grid grid-cols-7 text-center font-semibold text-sm text-gray-600">
            {['日', '月', '火', '水', '木', '金', '土'].map(day => <div key={day} className="py-2">{day}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
            {daysOfMonth.map(day => (
                <button key={day.toISOString()} onClick={() => handleDayClick(day)}
                    className={`h-12 flex flex-col items-center justify-center rounded-lg transition-all ${isSameDay(day, selectedDate) ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'} ${isToday(day) && !isSameDay(day, selectedDate) ? 'border-2 border-blue-500' : ''}`}>
                    <span>{format(day, 'd')}</span>
                    {dayHasRecord(day) && <span className={`w-2 h-2 rounded-full mt-1 ${isSameDay(day, selectedDate) ? 'bg-white' : 'bg-blue-500'}`}></span>}
                </button>
            ))}
        </div>
        <div className="mt-8 flex justify-center">
            <button onClick={() => setView('graph')} className="bg-purple-500 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-purple-600 flex items-center">
                <BarChart2 className="w-5 h-5 mr-2" />グラフを見る
            </button>
        </div>
    </div>
));

const GraphView = React.memo(({ setView, graphViewRange, setGraphViewRange, chartData }) => (
    <div className="w-full md:w-1/2 p-4 bg-gray-50 rounded-xl shadow-inner">
        <div className="flex justify-between items-center mb-4">
            <button onClick={() => setView('calendar')} className="flex items-center text-gray-600"><ArrowLeft className="w-5 h-5 mr-1" />カレンダーに戻る</button>
            <h2 className="text-2xl font-bold flex items-center"><BarChart2 className="w-6 h-6 mr-2" />体重の推移</h2>
        </div>
        <div className="flex justify-center space-x-2 mb-4">
            {['1month', '3months', '6months', '1year'].map(range => (
                <button key={range} onClick={() => setGraphViewRange(range)}
                    className={`py-2 px-4 rounded-full text-sm font-semibold ${graphViewRange === range ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}>
                    {range === '1month' ? '1ヶ月' : range === '3months' ? '3ヶ月' : '6ヶ月' : '1年'}
                </button>
            ))}
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm h-[300px]">
            {chartData.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}><CartesianGrid /><XAxis dataKey="date" /><YAxis /><Tooltip /><Line type="monotone" dataKey="体重" stroke="#8884d8" /></LineChart>
                </ResponsiveContainer>
            ) : <div className="flex items-center justify-center h-full text-gray-500">データが不足しています</div>}
        </div>
    </div>
));

const initialDailyRecord = {
    weights: { morning: null, evening: null, other: null },
    meals: {
        morning: { menus: Array(5).fill(''), alcohols: Array(5).fill({ degree: '', amount: '' }), photos: Array(2).fill(null) },
        lunch: { menus: Array(5).fill(''), alcohols: Array(5).fill({ degree: '', amount: '' }), photos: Array(2).fill(null) },
        dinner: { menus: Array(5).fill(''), alcohols: Array(5).fill({ degree: '', amount: '' }), photos: Array(2).fill(null) },
    },
    overtime: { type: '0時間', hours: 0 },
    diary: '',
};

// =================================================================
// Main App Component
// =================================================================

const App = () => {
    const [db, setDb] = useState(null);
    const [userId, setUserId] = useState(null);
    const [allRecords, setAllRecords] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [view, setView] = useState('calendar');
    const [graphViewRange, setGraphViewRange] = useState('1month');
    const [currentMonth, setCurrentMonth] = useState(() => new Date(localStorage.getItem('onigiri-note-currentMonth') || new Date()));
    const [selectedDate, setSelectedDate] = useState(() => new Date(localStorage.getItem('onigiri-note-selectedDate') || new Date()));
    const [dailyRecord, setDailyRecord] = useState(initialDailyRecord);

    useEffect(() => {
        try {
            const app = initializeApp(firebaseConfig);
            const firestore = getFirestore(app);
            const auth = getAuth(app);
            setDb(firestore);
            const unsubscribe = onAuthStateChanged(auth, user => {
                if (user) { setUserId(user.uid); }
                else { signInAnonymously(auth); }
            });
            return unsubscribe;
        } catch (error) { console.error("Firebase Init Error:", error); setIsLoading(false); }
    }, []);

    useEffect(() => {
        if (!db || !userId) return;
        const collectionPath = `artifacts/${appId}/users/${userId}/daily-records`;
        const q = query(collection(db, collectionPath));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const records = {};
            snapshot.forEach(doc => { records[doc.id] = doc.data(); });
            setAllRecords(records);
            setIsLoading(false);
        }, error => { console.error("Firestore Snapshot Error:", error); setIsLoading(false); });
        return unsubscribe;
    }, [db, userId]);

    useEffect(() => {
        if (view === 'daily') {
            const dateKey = format(selectedDate, 'yyyy-MM-dd');
            setDailyRecord(allRecords[dateKey] || initialDailyRecord);
        }
    }, [selectedDate, allRecords, view]);

    useEffect(() => {
        localStorage.setItem('onigiri-note-currentMonth', currentMonth.toISOString());
        localStorage.setItem('onigiri-note-selectedDate', selectedDate.toISOString());
    }, [currentMonth, selectedDate]);

    const daysOfMonth = useMemo(() => eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) }), [currentMonth]);
    const firstDay = useMemo(() => getDay(startOfMonth(currentMonth)), [currentMonth]);
    const dayHasRecord = useCallback(date => !!allRecords[format(date, 'yyyy-MM-dd')], [allRecords]);
    const handleDayClick = useCallback(date => { setSelectedDate(date); setView('daily'); }, []);
    const goToPrevMonth = useCallback(() => setCurrentMonth(prev => subMonths(prev, 1)), []);
    const goToNextMonth = useCallback(() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)), []);

    const handleSaveRecord = useCallback(async (e) => {
        e.preventDefault();
        if (!db || !userId) return;
        setIsSaving(true);
        const dateKey = format(selectedDate, 'yyyy-MM-dd');
        try {
            await setDoc(doc(db, `artifacts/${appId}/users/${userId}/daily-records`, dateKey), dailyRecord, { merge: true });
        } catch (error) { console.error("Save Error:", error); }
        finally { setIsSaving(false); }
    }, [db, userId, selectedDate, dailyRecord]);
    
    const handleWeightChange = useCallback((type, field, value) => { setDailyRecord(p => ({ ...p, weights: { ...p.weights, [type]: { ...(p.weights[type] || {}), [field]: value } } })); }, []);
    const handleMealMenuChange = useCallback((mealType, index, value) => { setDailyRecord(p => { const n = [...p.meals[mealType].menus]; n[index] = value; return { ...p, meals: { ...p.meals, [mealType]: { ...p.meals[mealType], menus: n } } }; }); }, []);
    const handleMealAlcoholChange = useCallback((mealType, index, field, value) => { setDailyRecord(p => { const n = [...p.meals[mealType].alcohols]; n[index] = { ...n[index], [field]: value }; return { ...p, meals: { ...p.meals, [mealType]: { ...p.meals[mealType], alcohols: n } } }; }); }, []);
    
    const handlePhotoUpload = useCallback((mealType, index, file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width, height = img.height;
                if (width > height) { if (width > 640) { height *= 640 / width; width = 640; } }
                else { if (height > 480) { width *= 480 / height; height = 480; } }
                canvas.width = width; canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                canvas.toBlob(blob => {
                    const r = new FileReader();
                    r.readAsDataURL(blob);
                    r.onloadend = () => {
                        setDailyRecord(p => { const n = [...p.meals[mealType].photos]; n[index] = r.result; return { ...p, meals: { ...p.meals, [mealType]: { ...p.meals[mealType], photos: n } } }; });
                    };
                }, 'image/webp', 0.8);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }, []);

    const handleRemovePhoto = useCallback((mealType, index) => { setDailyRecord(p => { const n = [...p.meals[mealType].photos]; n[index] = null; return { ...p, meals: { ...p.meals, [mealType]: { ...p.meals[mealType], photos: n } } }; }); }, []);
    const handleOvertimeChange = useCallback((e) => { const v = e.target.value; setDailyRecord(p => ({ ...p, overtime: { ...p.overtime, type: v, hours: v === '任意' ? p.overtime.hours : parseFloat(v) || 0 } })); }, []);
    const handleDiaryChange = useCallback((e) => { const v = e.target.value; setDailyRecord(p => ({ ...p, diary: v.slice(0, 200) })); }, []);
    const getTotalAlcohol = useCallback((alcohols) => alcohols?.reduce((sum, a) => sum + (parseFloat(a.degree || 0) / 100) * parseFloat(a.amount || 0), 0) || 0, []);

    const chartData = useMemo(() => {
        let startDate;
        switch (graphViewRange) {
            case '3months': startDate = subMonths(new Date(), 3); break;
            case '6months': startDate = subMonths(new Date(), 6); break;
            case '1year': startDate = subYears(new Date(), 1); break;
            default: startDate = subMonths(new Date(), 1);
        }
        return Object.keys(allRecords).sort().filter(d => new Date(d) >= startDate)
            .map(d => ({ date: format(new Date(d), 'MM/dd'), weight: parseFloat(allRecords[d].weights?.morning?.value) }))
            .filter(item => item.weight);
    }, [allRecords, graphViewRange]);

    return (
        <div className="min-h-screen bg-gray-100 p-4 font-inter flex items-center justify-center">
            <div className="w-full max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-6 md:p-8">
                <header className="flex flex-col md:flex-row justify-between items-center mb-6 border-b pb-4">
                    <h1 className="text-4xl font-extrabold text-gray-800">🍙 おにぎりノート</h1>
                    <div className="flex items-center space-x-2">
                        {userId && <div className="bg-gray-200 text-sm px-3 py-2 rounded-lg hidden md:block">ID: {userId.substring(0, 8)}...</div>}
                    </div>
                </header>

                {isLoading ? <div className="h-64 flex justify-center items-center">読み込み中...</div> : (
                    <div className="flex justify-center">
                        {view === 'calendar' && <CalendarView {...{ currentMonth, goToPrevMonth, goToNextMonth, firstDay, daysOfMonth, handleDayClick, selectedDate, dayHasRecord, setView }} />}
                        {view === 'daily' && <DailyNoteView {...{ selectedDate, dailyRecord, setDailyRecord, handleSaveRecord, isSaving, setView, handleWeightChange, handleMealMenuChange, handleMealAlcoholChange, handlePhotoUpload, handleRemovePhoto, handleOvertimeChange, handleDiaryChange, getTotalAlcohol }} />}
                        {view === 'graph' && <GraphView {...{ setView, graphViewRange, setGraphViewRange, chartData }} />}
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;