import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot, setDoc, doc } from 'firebase/firestore';
import { ChevronLeft, ChevronRight, Download, Plus, BarChart2, ArrowLeft } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay, isToday, subMonths, subYears } from 'date-fns';
import { ja } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import DailyNoteView from './components/DailyNoteView';

// .env.localファイルからFirebase設定を読み込む
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const appId = firebaseConfig.appId;
const initialAuthToken = null;

// ★★★ ここからビューコンポーネントの定義 ★★★

const CalendarView = React.memo(({
    currentMonth,
    goToPrevMonth,
    goToNextMonth,
    firstDay,
    daysOfMonth,
    handleDayClick,
    selectedDate,
    dayHasRecord,
    setView
}) => (
    <div className="w-full md:w-1/2 p-4 bg-gray-50 rounded-xl shadow-inner">
        <div className="flex justify-between items-center mb-4">
            <button onClick={goToPrevMonth} className="p-2 rounded-full hover:bg-gray-200">
                <ChevronLeft className="w-6 h-6" />
            </button>
            <h2 className="text-2xl font-bold text-gray-800">
                {format(currentMonth, 'yyyy年 M月', { locale: ja })}
            </h2>
            <button onClick={goToNextMonth} className="p-2 rounded-full hover:bg-gray-200">
                <ChevronRight className="w-6 h-6" />
            </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center font-semibold text-sm text-gray-600">
            {['日', '月', '火', '水', '木', '金', '土'].map(day => <div key={day} className="py-2">{day}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} className="h-10"></div>)}
            {daysOfMonth.map(day => (
                <button
                    key={day.toISOString()}
                    onClick={() => handleDayClick(day)}
                    className={`h-12 flex flex-col items-center justify-center rounded-lg transition-all duration-200 
                        ${isSameDay(day, selectedDate) ? 'bg-blue-500 text-white shadow-lg scale-105' : 'bg-gray-100 hover:bg-gray-200'}
                        ${isToday(day) && !isSameDay(day, selectedDate) ? 'border-2 border-blue-500' : ''}`}
                >
                    <span className="text-lg font-bold">{format(day, 'd')}</span>
                    {dayHasRecord(day) && (
                        <span className={`w-2 h-2 rounded-full mt-1 ${isSameDay(day, selectedDate) ? 'bg-white' : 'bg-blue-500'}`}></span>
                    )}
                </button>
            ))}
        </div>
        <div className="mt-8 flex space-x-4 justify-center">
            <button
                onClick={() => setView('graph')}
                className="bg-purple-500 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-purple-600 transition-colors duration-200 flex items-center"
            >
                <BarChart2 className="w-5 h-5 mr-2" />
                グラフを見る
            </button>
        </div>
    </div>
));

const GraphView = React.memo(({ setView, graphViewRange, setGraphViewRange, chartData }) => ( // ★★★ propsを受け取るように修正 ★★★
    <div className="w-full md:w-1/2 p-4 bg-gray-50 rounded-xl shadow-inner">
        <div className="flex justify-between items-center mb-4">
            <button onClick={() => setView('calendar')} className="p-2 rounded-full hover:bg-gray-200 flex items-center text-gray-600">
                <ArrowLeft className="w-5 h-5 mr-1" />
                カレンダーに戻る
            </button>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                <BarChart2 className="w-6 h-6 mr-2" />
                体重の推移
            </h2>
        </div>
        <div className="flex justify-center space-x-2 mb-4">
            {['1month', '3months', '6months', '1year'].map(range => (
                <button
                    key={range}
                    onClick={() => setGraphViewRange(range)}
                    className={`py-2 px-4 rounded-full text-sm font-semibold transition-colors duration-200 
                        ${graphViewRange === range ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                >
                    {range === '1month' ? '1ヶ月' : range === '3months' ? '3ヶ月' : range === '6months' ? '6ヶ月' : '1年'}
                </button>
            ))}
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm">
            {chartData.length > 1 ? (
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="体重" stroke="#8884d8" activeDot={{ r: 8 }} />
                    </LineChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-500">
                    データを2日以上記録するとグラフが表示されます。
                </div>
            )}
        </div>
    </div>
));

// ★★★ ここからメインのAppコンポーネント ★★★

const App = () => {
    const [db, setDb] = useState(null);
    const [userId, setUserId] = useState(null);
    const [allRecords, setAllRecords] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(() => {
        const savedMonth = localStorage.getItem('onigiri-note-currentMonth');
        return savedMonth ? new Date(savedMonth) : new Date();
    });
    const [selectedDate, setSelectedDate] = useState(() => {
        const savedDate = localStorage.getItem('onigiri-note-selectedDate');
        return savedDate ? new Date(savedDate) : new Date();
    });
    const [message, setMessage] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [view, setView] = useState('calendar');
    const [graphViewRange, setGraphViewRange] = useState('1month');
    const [dailyRecord, setDailyRecord] = useState({
        weights: { morning: null, evening: null, other: null },
        meals: {
            morning: { menus: Array(5).fill(''), alcohols: Array(5).fill({ degree: '', amount: '' }), photos: Array(2).fill(null) },
            lunch: { menus: Array(5).fill(''), alcohols: Array(5).fill({ degree: '', amount: '' }), photos: Array(2).fill(null) },
            dinner: { menus: Array(5).fill(''), alcohols: Array(5).fill({ degree: '', amount: '' }), photos: Array(2).fill(null) },
        },
        overtime: { type: '0時間', hours: 0 },
        diary: '',
    });

    const showMessage = (msg) => {
        setMessage(msg);
        setTimeout(() => setMessage(''), 3000);
    };

    useEffect(() => {
        const initializeFirebase = async () => {
            try {
                const app = initializeApp(firebaseConfig);
                const firestore = getFirestore(app);
                const firebaseAuth = getAuth(app);
                setDb(firestore);
                onAuthStateChanged(firebaseAuth, async (user) => {
                    if (user) {
                        setUserId(user.uid);
                    } else {
                        await signInAnonymously(firebaseAuth);
                    }
                });
            } catch (error) {
                console.error("Firebaseの初期化または認証エラー:", error);
                setIsLoading(false);
            }
        };
        initializeFirebase();
    }, []);

    useEffect(() => {
        if (!db || !userId) return;
        const collectionPath = `artifacts/${appId}/users/${userId}/daily-records`;
        const q = query(collection(db, collectionPath));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const fetchedRecords = {};
            querySnapshot.forEach((doc) => {
                fetchedRecords[doc.id] = doc.data();
            });
            setAllRecords(fetchedRecords);
            setIsLoading(false);
        }, (error) => {
            console.error("Firestoreからのデータ取得エラー:", error);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [db, userId]);

    useEffect(() => {
        if (view === 'daily') {
            const dateKey = format(selectedDate, 'yyyy-MM-dd');
            const record = allRecords[dateKey];
            setDailyRecord(record || {
                weights: { morning: null, evening: null, other: null },
                meals: {
                    morning: { menus: Array(5).fill(''), alcohols: Array(5).fill({ degree: '', amount: '' }), photos: Array(2).fill(null) },
                    lunch: { menus: Array(5).fill(''), alcohols: Array(5).fill({ degree: '', amount: '' }), photos: Array(2).fill(null) },
                    dinner: { menus: Array(5).fill(''), alcohols: Array(5).fill({ degree: '', amount: '' }), photos: Array(2).fill(null) },
                },
                overtime: { type: '0時間', hours: 0 },
                diary: '',
            });
        }
    }, [selectedDate, allRecords, view]);

    useEffect(() => {
        localStorage.setItem('onigiri-note-currentMonth', currentMonth.toISOString());
        localStorage.setItem('onigiri-note-selectedDate', selectedDate.toISOString());
    }, [currentMonth, selectedDate]);

    const daysOfMonth = useMemo(() => eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) }), [currentMonth]);
    const firstDay = useMemo(() => getDay(startOfMonth(currentMonth)), [currentMonth]);
    
    const dayHasRecord = useCallback((date) => {
        const dateKey = format(date, 'yyyy-MM-dd');
        return !!allRecords[dateKey];
    }, [allRecords]);

    const handleDayClick = useCallback((date) => {
        setSelectedDate(date);
        setView('daily');
    }, []);

    const goToPrevMonth = useCallback(() => setCurrentMonth(prev => subMonths(prev, 1)), []);
    const goToNextMonth = useCallback(() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)), []);

    const handleSaveRecord = useCallback(async (e) => {
        e.preventDefault();
        if (!db || !userId) return;
        setIsSaving(true);
        const dateKey = format(selectedDate, 'yyyy-MM-dd');
        const docRef = doc(db, `artifacts/${appId}/users/${userId}/daily-records`, dateKey);
        try {
            await setDoc(docRef, dailyRecord, { merge: true });
            showMessage("記録が正常に保存されました！");
        } catch (error) {
            console.error("記録の保存エラー:", error);
        } finally {
            setIsSaving(false);
        }
    }, [db, userId, selectedDate, dailyRecord]);

    const handleExportCSV = useCallback(() => { /* CSVエクスポートのロジックは省略 */ }, [allRecords]);
    
    const handleWeightChange = useCallback((type, field, value) => {
        setDailyRecord(prev => ({...prev, weights: {...prev.weights, [type]: {...(prev.weights[type] || {}), [field]: value}}}));
    }, []);

    const handleMealMenuChange = useCallback((mealType, index, value) => {
        setDailyRecord(prev => {
            const newMenus = [...(prev.meals[mealType]?.menus || Array(5).fill(''))];
            newMenus[index] = value;
            return {...prev, meals: {...prev.meals, [mealType]: {...(prev.meals[mealType] || {}), menus: newMenus}}};
        });
    }, []);

    const handleMealAlcoholChange = useCallback((mealType, index, field, value) => {
        setDailyRecord(prev => {
            const newAlcohols = [...(prev.meals[mealType]?.alcohols || Array(5).fill({ degree: '', amount: '' }))];
            newAlcohols[index] = { ...newAlcohols[index], [field]: value };
            return {...prev, meals: {...prev.meals, [mealType]: {...(prev.meals[mealType] || {}), alcohols: newAlcohols}}};
        });
    }, []);

    const handlePhotoUpload = useCallback((mealType, index, file) => { /* 写真アップロードのロジックは省略 */ }, []);
    const handleRemovePhoto = useCallback((mealType, index) => { /* 写真削除のロジックは省略 */ }, []);
    
    const getTotalAlcohol = useCallback((alcohols) => {
        return alcohols?.reduce((sum, a) => sum + (parseFloat(a.degree || 0) / 100) * parseFloat(a.amount || 0), 0) || 0;
    }, []);

    const chartData = useMemo(() => {
        const today = new Date();
        let startDate;
        switch (graphViewRange) {
            case '3months': startDate = subMonths(today, 3); break;
            case '6months': startDate = subMonths(today, 6); break;
            case '1year': startDate = subYears(today, 1); break;
            default: startDate = subMonths(today, 1);
        }
        const sortedKeys = Object.keys(allRecords).sort();
        const filteredKeys = sortedKeys.filter(dateKey => new Date(dateKey) >= startDate);
        return filteredKeys.map(dateKey => {
            const record = allRecords[dateKey];
            const morningWeight = record.weights?.morning?.value;
            return morningWeight ? { date: format(new Date(dateKey), 'MM/dd', { locale: ja }), 体重: parseFloat(morningWeight) } : null;
        }).filter(item => item !== null);
    }, [allRecords, graphViewRange]);

    return (
        <div className="min-h-screen bg-gray-100 p-4 font-inter flex items-center justify-center">
            {message && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-md z-50">
                    {message}
                </div>
            )}
            <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-lg p-6 md:p-8">
                <header className="flex flex-col md:flex-row justify-between items-center mb-6 border-b pb-4">
                    <h1 className="text-4xl font-extrabold text-gray-800 mb-2 md:mb-0">
                        <span role="img" aria-label="onigiri" className="mr-2">🍙</span>
                        おにぎりノート
                    </h1>
                    <div className="flex items-center space-x-2">
                        <button onClick={handleExportCSV} className="bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-600 transition-colors duration-200 flex items-center">
                            <Download className="w-5 h-5 mr-2" />
                            CSVエクスポート
                        </button>
                        {userId && (
                            <div className="bg-gray-200 text-gray-700 text-sm px-3 py-2 rounded-lg hidden md:block">
                                <span className="font-semibold">ユーザーID:</span> {userId.substring(0, 8)}...
                            </div>
                        )}
                    </div>
                </header>
    
                {isLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <p className="text-xl text-gray-600">データを読み込み中...</p>
                    </div>
                ) : (
                    <div className="flex justify-center">
                        {view === 'calendar' ? (
                            <CalendarView
                                currentMonth={currentMonth}
                                goToPrevMonth={goToPrevMonth}
                                goToNextMonth={goToNextMonth}
                                firstDay={firstDay}
                                daysOfMonth={daysOfMonth}
                                handleDayClick={handleDayClick}
                                selectedDate={selectedDate}
                                dayHasRecord={dayHasRecord}
                                setView={setView}
                                // isToday と isSameDay は date-fns から直接インポートしているので渡す必要がありません
                                isToday={isToday}
                                isSameDay={isSameDay}
                            />
                        ) : view === 'daily' ? (
                            <DailyNoteView
                                selectedDate={selectedDate}
                                dailyRecord={dailyRecord}
                                setDailyRecord={setDailyRecord} // ★★★ DailyNoteView側で直接更新する関数も渡す ★★★
                                handleSaveRecord={handleSaveRecord}
                                isSaving={isSaving}
                                setView={setView} // ★★★ setViewを渡すのを忘れない ★★★
                                handleWeightChange={handleWeightChange}
                                handleMealMenuChange={handleMealMenuChange}
                                handleMealAlcoholChange={handleMealAlcoholChange}
                                handlePhotoUpload={handlePhotoUpload}
                                handleRemovePhoto={handleRemovePhoto}
                                getTotalAlcohol={getTotalAlcohol}
                            />
                        ) : (
                            <GraphView
                                setView={setView}
                                graphViewRange={graphViewRange}
                                setGraphViewRange={setGraphViewRange}
                                chartData={chartData}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;