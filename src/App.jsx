import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot, setDoc, doc, getDoc } from 'firebase/firestore';
import { ChevronLeft, ChevronRight, Calendar, Download, Plus, Clock, Camera, Activity, FileText, ArrowLeft, BarChart2, XCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay, isToday, subMonths, subYears } from 'date-fns';
import { ja } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Firebase設定のグローバル変数
// const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
// const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
// const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// .env.localファイルからFirebase設定を読み込む
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// アプリIDと初期トークンは今回の使い方では不要なので、シンプルにします。
const appId = firebaseConfig.appId;
const initialAuthToken = null;

// メインアプリケーションコンポーネント
const App = () => {
    const [db, setDb] = useState(null);
    const [userId, setUserId] = useState(null);
    const [allRecords, setAllRecords] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [message, setMessage] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [view, setView] = useState('calendar'); // 'calendar', 'daily', or 'graph'
    const [graphViewRange, setGraphViewRange] = useState('1month'); // '1month', '3months', '6months', '1year'

    // 選択された日のレコードの状態
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

    // メッセージ表示用のヘルパー関数
    const showMessage = (msg) => {
        setMessage(msg);
        setTimeout(() => setMessage(''), 3000);
    };

    // Firebaseの初期化と認証
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
                        if (initialAuthToken) {
                            await signInWithCustomToken(firebaseAuth, initialAuthToken);
                        } else {
                            await signInAnonymously(firebaseAuth);
                        }
                    }
                });

            } catch (error) {
                console.error("Firebaseの初期化または認証エラー:", error);
                showMessage("エラー: Firebaseの初期化に失敗しました。");
                setIsLoading(false);
            }
        };
        initializeFirebase();
    }, []);

    // Firestoreからのデータ取得（リアルタイム同期）
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
            showMessage("エラー: データ取得に失敗しました。");
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [db, userId]);

    // 選択された日付のレコードを読み込む
    useEffect(() => {
        if (view === 'daily') {
            const dateKey = format(selectedDate, 'yyyy-MM-dd');
            const record = allRecords[dateKey];
            if (record) {
                setDailyRecord(record);
            } else {
                setDailyRecord({
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
        }
    }, [selectedDate, allRecords, view]);

    // カレンダー関連のヘルパー関数
    const getDaysInMonth = (date) => eachDayOfInterval({ start: startOfMonth(date), end: endOfMonth(date) });
    const daysOfMonth = getDaysInMonth(currentMonth);
    const firstDay = getDay(startOfMonth(currentMonth));
    const dayHasRecord = (date) => {
        const dateKey = format(date, 'yyyy-MM-dd');
        return !!allRecords[dateKey];
    };
    
    // 日付クリックハンドラ
    const handleDayClick = (date) => {
        setSelectedDate(date);
        setView('daily');
    };

    // 月のナビゲーション
    const goToPrevMonth = () => setCurrentMonth(prevMonth => new Date(prevMonth.getFullYear(), prevMonth.getMonth() - 1, 1));
    const goToNextMonth = () => setCurrentMonth(prevMonth => new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 1));

    // データ保存
    const handleSaveRecord = async (e) => {
        e.preventDefault();
        if (!db || !userId) {
            showMessage("エラー: 認証が完了していません。");
            return;
        }

        setIsSaving(true);
        const dateKey = format(selectedDate, 'yyyy-MM-dd');
        const docRef = doc(db, `artifacts/${appId}/users/${userId}/daily-records`, dateKey);

        try {
            await setDoc(docRef, dailyRecord, { merge: true });
            showMessage("記録が正常に保存されました！");
        } catch (error) {
            console.error("記録の保存エラー:", error);
            showMessage("エラー: 記録の保存に失敗しました。");
        } finally {
            setIsSaving(false);
        }
    };
    
    // CSVエクスポート
    const handleExportCSV = () => {
        if (Object.keys(allRecords).length === 0) {
            showMessage("エクスポートするデータがありません。");
            return;
        }
        
        const headers = ["日付", "体重(朝)", "時刻(朝)", "オプション1(朝)", "オプション2(朝)", "メモ(朝)",
                        "体重(夜)", "時刻(夜)", "オプション1(夜)", "オプション2(夜)", "メモ(夜)",
                        "体重(その他)", "時刻(その他)", "オプション1(その他)", "オプション2(その他)", "メモ(その他)",
                        "朝食メニュー1", "朝食メニュー2", "朝食メニュー3", "朝食メニュー4", "朝食メニュー5",
                        "朝食アルコール1度数", "朝食アルコール1量", "朝食アルコール2度数", "朝食アルコール2量", "朝食アルコール3度数", "朝食アルコール3量", "朝食アルコール4度数", "朝食アルコール4量", "朝食アルコール5度数", "朝食アルコール5量", "朝食合計アルコール量(ml)",
                        "昼食メニュー1", "昼食メニュー2", "昼食メニュー3", "昼食メニュー4", "昼食メニュー5",
                        "昼食アルコール1度数", "昼食アルコール1量", "昼食アルコール2度数", "昼食アルコール2量", "昼食アルコール3度数", "昼食アルコール3量", "昼食アルコール4度数", "昼食アルコール4量", "昼食アルコール5度数", "昼食アルコール5量", "昼食合計アルコール量(ml)",
                        "夕食メニュー1", "夕食メニュー2", "夕食メニュー3", "夕食メニュー4", "夕食メニュー5",
                        "夕食アルコール1度数", "夕食アルコール1量", "夕食アルコール2度数", "夕食アルコール2量", "夕食アルコール3度数", "夕食アルコール3量", "夕食アルコール4度数", "夕食アルコール4量", "夕食アルコール5度数", "夕食アルコール5量", "夕食合計アルコール量(ml)",
                        "残業時間タイプ", "残業時間(h)", "日記"
                    ];
        
        const rows = Object.keys(allRecords).map(dateKey => {
            const record = allRecords[dateKey];
            const rowData = [dateKey];

            // 体重データの整形
            ['morning', 'evening', 'other'].forEach(type => {
                const w = record.weights?.[type];
                if (w) {
                    rowData.push(w.value || '', w.time || '', w.option1 || '', w.option2 || '', w.note || '');
                } else {
                    rowData.push('', '', '', '', '');
                }
            });

            // 食事データの整形
            ['morning', 'lunch', 'dinner'].forEach(type => {
                const meal = record.meals?.[type];
                if (meal) {
                    rowData.push(...meal.menus.map(m => m || ''));
                    meal.alcohols.forEach(a => {
                        rowData.push(a.degree || '', a.amount || '');
                    });
                    const totalAlcohol = meal.alcohols.reduce((sum, a) => sum + (Number(a.degree || 0) / 100) * Number(a.amount || 0), 0);
                    rowData.push(totalAlcohol);
                } else {
                    rowData.push(...Array(15).fill(''), 0); // menus(5) + alcohols(5*2) + totalAlcohol(1)
                }
            });

            // 残業と日記
            rowData.push(record.overtime?.type || '', record.overtime?.hours || '', record.diary || '');

            return rowData.map(d => `"${String(d).replace(/"/g, '""')}"`).join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lifelog_notes_${format(new Date(), 'yyyyMMdd')}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showMessage("CSVファイルがエクスポートされました！");
    };

    // --- 各フォームの変更ハンドラ ---
    const handleWeightChange = useCallback((type, field, value) => {
      setDailyRecord(prev => ({
          ...prev,
          weights: {
              ...prev.weights,
              [type]: {
                  ...(prev.weights[type] || {}),
                  [field]: value
              }
          }
      }));
  }, [setDailyRecord]);

    const handleMealMenuChange = useCallback((mealType, index, value) => {
        setDailyRecord(prev => {
            const newMenus = [...(prev.meals[mealType]?.menus || Array(5).fill(''))];
            newMenus[index] = value;
            return {
                ...prev,
                meals: {
                    ...prev.meals,
                    [mealType]: { ...(prev.meals[mealType] || {}), menus: newMenus }
                }
            };
        });
    }, [setDailyRecord]);

    const handleMealAlcoholChange = useCallback((mealType, index, field, value) => {
        setDailyRecord(prev => {
            const newAlcohols = [...(prev.meals[mealType]?.alcohols || Array(5).fill({ degree: '', amount: '' }))];
            newAlcohols[index] = { ...newAlcohols[index], [field]: value };
            return {
                ...prev,
                meals: {
                    ...prev.meals,
                    [mealType]: { ...(prev.meals[mealType] || {}), alcohols: newAlcohols }
                }
            };
        });
    }, [setDailyRecord]);
    
    // 画像圧縮とアップロードの新しいハンドラ
    const handlePhotoUpload = useCallback((mealType, index, file) => {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 640;
                const MAX_HEIGHT = 480;
                let width = img.width;
                let height = img.height;

                // 縦横比を維持しつつリサイズ
                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(blob);
                    reader.onloadend = () => {
                        const base64data = reader.result;
                        setDailyRecord(prev => {
                            const newPhotos = [...(prev.meals[mealType]?.photos || Array(2).fill(null))];
                            newPhotos[index] = base64data;
                            return {
                                ...prev,
                                meals: {
                                    ...prev.meals,
                                    [mealType]: { ...(prev.meals[mealType] || {}), photos: newPhotos }
                                }
                            };
                        });
                    };
                }, 'image/webp', 0.8); // 可逆圧縮に近いwebp形式と画質を指定
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }, [setDailyRecord]);

    // 写真を削除
    const handleRemovePhoto = useCallback((mealType, index) => {
        setDailyRecord(prev => {
            const newPhotos = [...(prev.meals[mealType]?.photos || Array(2).fill(null))];
            newPhotos[index] = null;
            return {
                ...prev,
                meals: {
                    ...prev.meals,
                    [mealType]: { ...(prev.meals[mealType] || {}), photos: newPhotos }
                }
            };
        });
    }, [setDailyRecord]);

    // アルコール量の合計を計算
    const getTotalAlcohol = (alcohols) => {
        return alcohols?.reduce((sum, a) => {
            const degree = parseFloat(a.degree) || 0;
            const amount = parseFloat(a.amount) || 0;
            return sum + (degree / 100) * amount;
        }, 0) || 0;
    };

    // グラフデータの準備
    const chartData = useMemo(() => {
        const today = new Date();
        let startDate;
        let dateFormat;

        // 選択された期間に基づいて開始日と日付フォーマットを決定
        switch (graphViewRange) {
            case '3months':
                startDate = subMonths(today, 3);
                dateFormat = 'yyyy/MM/dd';
                break;
            case '6months':
                startDate = subMonths(today, 6);
                dateFormat = 'yyyy/MM/dd';
                break;
            case '1year':
                startDate = subYears(today, 1);
                dateFormat = 'yyyy/MM/dd';
                break;
            case '1month':
            default:
                startDate = subMonths(today, 1);
                dateFormat = 'MM/dd';
                break;
        }

        const sortedKeys = Object.keys(allRecords).sort();
        const filteredKeys = sortedKeys.filter(dateKey => new Date(dateKey) >= startDate);
        
        // データをRecharts形式に整形
        return filteredKeys.map(dateKey => {
            const record = allRecords[dateKey];
            const morningWeight = record.weights?.morning?.value;
            // 体重の記録がある日のみ表示
            if (morningWeight) {
                return {
                    date: format(new Date(dateKey), dateFormat, { locale: ja }),
                    体重: parseFloat(morningWeight)
                };
            }
            return null;
        }).filter(item => item !== null);
    }, [allRecords, graphViewRange]);

    // カレンダービュー
    const CalendarView = () => (
        <div className="md:w-1/2 p-4 bg-gray-50 rounded-xl shadow-inner">
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
                {['日', '月', '火', '水', '木', '金', '土'].map(day => (
                    <div key={day} className="py-2">{day}</div>
                ))}
            </div>
    
            <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-10"></div>
                ))}
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
    );

    // 日次ノートビュー
    const DailyNoteView = () => (
        <div className="md:w-1/2 p-4 bg-gray-50 rounded-xl shadow-inner">
            <div className="flex justify-between items-center mb-4">
                <button
                    onClick={() => setView('calendar')}
                    className="p-2 rounded-full hover:bg-gray-200 flex items-center text-gray-600"
                >
                    <ArrowLeft className="w-5 h-5 mr-1" />
                    カレンダーに戻る
                </button>
                <h2 className="text-2xl font-bold text-gray-800">
                    {format(selectedDate, 'yyyy年 M月 d日', { locale: ja })} の記録
                </h2>
            </div>
            
            <form onSubmit={handleSaveRecord} className="space-y-6">
                {/* 体重の記録 */}
                <div>
                    <h3 className="text-xl font-bold text-gray-700 mb-2 flex items-center"><Activity className="w-5 h-5 mr-2" />体重の記録</h3>
                    {['朝', '夜', 'その他'].map((type, i) => (
                        <div key={i} className="bg-white p-4 rounded-lg shadow-sm mb-2">
                            <div className="font-semibold text-gray-600 mb-2">{type}</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">体重 (kg)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={dailyRecord.weights[i === 0 ? 'morning' : i === 1 ? 'evening' : 'other']?.value || ''}
                                        onChange={(e) => handleWeightChange(i === 0 ? 'morning' : i === 1 ? 'evening' : 'other', 'value', e.target.value)}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">時刻 (HHMM)</label>
                                    <div className="flex items-center mt-1">
                                        <input
                                            type="text"
                                            value={dailyRecord.weights[i === 0 ? 'morning' : i === 1 ? 'evening' : 'other']?.time || ''}
                                            onChange={(e) => handleWeightChange(i === 0 ? 'morning' : i === 1 ? 'evening' : 'other', 'time', e.target.value)}
                                            className="block w-full rounded-md border-gray-300 shadow-sm"
                                            pattern="[0-2][0-9][0-5][0-9]"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleWeightChange(i === 0 ? 'morning' : i === 1 ? 'evening' : 'other', 'time', format(new Date(), 'HHmm'))}
                                            className="ml-2 px-3 py-2 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300 transition-colors"
                                        >
                                            現在時刻
                                        </button>
                                    </div>
                                </div>
                                <div className="col-span-full grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">オプション1</label>
                                        <select
                                            value={dailyRecord.weights[i === 0 ? 'morning' : i === 1 ? 'evening' : 'other']?.option1 || ''}
                                            onChange={(e) => handleWeightChange(i === 0 ? 'morning' : i === 1 ? 'evening' : 'other', 'option1', e.target.value)}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                                        >
                                            <option value="">選択してください</option>
                                            <option value="起床後">起床後</option>
                                            <option value="食後">食後</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">オプション2</label>
                                        <select
                                            value={dailyRecord.weights[i === 0 ? 'morning' : i === 1 ? 'evening' : 'other']?.option2 || ''}
                                            onChange={(e) => handleWeightChange(i === 0 ? 'morning' : i === 1 ? 'evening' : 'other', 'option2', e.target.value)}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                                        >
                                            <option value="">選択してください</option>
                                            <option value="排尿後">排尿後</option>
                                            <option value="排便後">排便後</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="col-span-full">
                                    <label className="block text-sm font-medium text-gray-700">メモ (16文字まで)</label>
                                    <input
                                        type="text"
                                        value={dailyRecord.weights[i === 0 ? 'morning' : i === 1 ? 'evening' : 'other']?.note || ''}
                                        onChange={(e) => handleWeightChange(i === 0 ? 'morning' : i === 1 ? 'evening' : 'other', 'note', e.target.value)}
                                        maxLength="16"
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
    
                {/* 食事の記録 */}
                <div>
                    <h3 className="text-xl font-bold text-gray-700 mb-2 flex items-center"><Camera className="w-5 h-5 mr-2" />食事の記録</h3>
                    {['朝', '昼', '夜'].map((type, i) => (
                        <div key={i} className="bg-white p-4 rounded-lg shadow-sm mb-2">
                            <div className="font-semibold text-gray-600 mb-2">{type}食</div>
                            {/* メニュー入力 */}
                            <div className="space-y-2 mb-4">
                                <label className="block text-sm font-medium text-gray-700">メニュー (5個まで, 20文字まで)</label>
                                {dailyRecord.meals[i === 0 ? 'morning' : i === 1 ? 'lunch' : 'dinner']?.menus.map((menu, menuIndex) => (
                                    <input
                                        key={menuIndex}
                                        type="text"
                                        value={menu}
                                        onChange={(e) => handleMealMenuChange(i === 0 ? 'morning' : i === 1 ? 'lunch' : 'dinner', menuIndex, e.target.value)}
                                        maxLength="20"
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                                        placeholder={`メニュー ${menuIndex + 1}`}
                                    />
                                ))}
                            </div>
                            {/* アルコール入力 */}
                            <div className="space-y-2 mb-4">
                                <label className="block text-sm font-medium text-gray-700">アルコール (5個まで)</label>
                                {dailyRecord.meals[i === 0 ? 'morning' : i === 1 ? 'lunch' : 'dinner']?.alcohols.map((alcohol, alcoholIndex) => (
                                    <div key={alcoholIndex} className="flex space-x-2">
                                        <input
                                            type="number"
                                            value={alcohol.degree}
                                            onChange={(e) => handleMealAlcoholChange(i === 0 ? 'morning' : i === 1 ? 'lunch' : 'dinner', alcoholIndex, 'degree', e.target.value)}
                                            className="w-1/3 rounded-md border-gray-300 shadow-sm"
                                            placeholder="度数 (%)"
                                        />
                                        <input
                                            type="number"
                                            value={alcohol.amount}
                                            onChange={(e) => handleMealAlcoholChange(i === 0 ? 'morning' : i === 1 ? 'lunch' : 'dinner', alcoholIndex, 'amount', e.target.value)}
                                            className="w-2/3 rounded-md border-gray-300 shadow-sm"
                                            placeholder="飲酒量 (ml)"
                                        />
                                    </div>
                                ))}
                                <p className="text-sm text-gray-500 mt-2">
                                    合計アルコール量: {getTotalAlcohol(dailyRecord.meals[i === 0 ? 'morning' : i === 1 ? 'lunch' : 'dinner']?.alcohols).toFixed(2)} ml
                                </p>
                            </div>
                            {/* 写真アップロード */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">写真 (2枚まで)</label>
                                <div className="flex space-x-2">
                                    {dailyRecord.meals[i === 0 ? 'morning' : i === 1 ? 'lunch' : 'dinner']?.photos.map((photo, photoIndex) => (
                                        <div key={photoIndex} className="w-1/2 relative">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => handlePhotoUpload(i === 0 ? 'morning' : i === 1 ? 'lunch' : 'dinner', photoIndex, e.target.files[0])}
                                                className="hidden"
                                                id={`photo-upload-${type}-${photoIndex}`}
                                            />
                                            <label
                                                htmlFor={`photo-upload-${type}-${photoIndex}`}
                                                className="flex items-center justify-center h-24 w-full bg-gray-200 rounded-md cursor-pointer hover:bg-gray-300 transition-colors"
                                            >
                                                {photo ? (
                                                    <img src={photo} alt={`${type}食事写真${photoIndex + 1}`} className="object-cover h-full w-full rounded-md" />
                                                ) : (
                                                    <Camera className="w-8 h-8 text-gray-500" />
                                                )}
                                            </label>
                                            {photo && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.preventDefault(); handleRemovePhoto(i === 0 ? 'morning' : i === 1 ? 'lunch' : 'dinner', photoIndex); }}
                                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                                                >
                                                    <XCircle className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
    
                {/* 残業時間 */}
                <div>
                    <h3 className="text-xl font-bold text-gray-700 mb-2 flex items-center"><Clock className="w-5 h-5 mr-2" />残業時間</h3>
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                        <select
                            value={dailyRecord.overtime.type}
                            onChange={(e) => setDailyRecord(prev => ({ ...prev, overtime: { ...prev.overtime, type: e.target.value, hours: e.target.value === '任意' ? prev.overtime.hours : parseFloat(e.target.value) || 0 } }))}
                            className="block w-full rounded-md border-gray-300 shadow-sm"
                        >
                            <option value="0時間">0時間</option>
                            <option value="2時間">2時間</option>
                            <option value="3時間">3時間</option>
                            <option value="休日出勤">休日出勤</option>
                            <option value="任意">任意</option>
                        </select>
                        {dailyRecord.overtime.type === '任意' && (
                            <input
                                type="number"
                                step="0.25"
                                value={dailyRecord.overtime.hours}
                                onChange={(e) => setDailyRecord(prev => ({ ...prev, overtime: { ...prev.overtime, hours: parseFloat(e.target.value) || 0 } }))}
                                className="mt-2 block w-full rounded-md border-gray-300 shadow-sm"
                                placeholder="0.25時間単位で入力"
                            />
                        )}
                    </div>
                </div>
    
                {/* 簡単な日記 */}
                <div>
                    <h3 className="text-xl font-bold text-gray-700 mb-2 flex items-center"><FileText className="w-5 h-5 mr-2" />簡単な日記</h3>
                    <textarea
                        value={dailyRecord.diary}
                        onChange={(e) => setDailyRecord(prev => ({ ...prev, diary: e.target.value.slice(0, 200) }))}
                        rows="4"
                        maxLength="200"
                        className="block w-full rounded-md border-gray-300 shadow-sm"
                        placeholder="今日の出来事を200文字までで記録しましょう。"
                    ></textarea>
                    <p className="text-right text-sm text-gray-500">{dailyRecord.diary.length}/200</p>
                </div>
                
                <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full bg-green-500 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:bg-green-600 transition-colors duration-200 flex items-center justify-center"
                >
                    {isSaving ? (
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    ) : (
                        <Plus className="w-5 h-5 mr-2" />
                    )}
                    {isSaving ? "保存中..." : "今日の記録を保存"}
                </button>
            </form>
        </div>
    );
    
    // グラフビュー
    const GraphView = () => (
        <div className="md:w-1/2 p-4 bg-gray-50 rounded-xl shadow-inner">
            <div className="flex justify-between items-center mb-4">
                <button
                    onClick={() => setView('calendar')}
                    className="p-2 rounded-full hover:bg-gray-200 flex items-center text-gray-600"
                >
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
    );
    
    return (
        <div className="min-h-screen bg-gray-100 p-4 font-inter">
            {/* メッセージボックス */}
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
                        <button
                            onClick={handleExportCSV}
                            className="bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-600 transition-colors duration-200 flex items-center"
                        >
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
                        {view === 'calendar' ? <CalendarView /> : view === 'daily' ? <DailyNoteView /> : <GraphView />}
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;