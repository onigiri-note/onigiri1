import React from 'react';
import { format, isValid } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Camera, Activity, FileText, ArrowLeft, Clock, XCircle, Plus, ChevronLeft, ChevronRight } from 'lucide-react';

const DailyNoteView = ({
  selectedDate,
  dailyRecord,
  isSaving,
  handleSaveRecord,
  setView,
  goToPrevDay, // ★ 追加
  goToNextDay, // ★ 追加
  handleWeightChange,
  handleMealMenuChange,
  handleAlcoholChange, // ★ 変更
  handlePhotoUpload,
  handleRemovePhoto,
  handleOvertimeChange,
  handleDiaryChange,
  getTotalAlcohol
}) => {

  if (!selectedDate || !isValid(new Date(selectedDate))) {
    return <div className="w-full md:w-1/2 p-4 flex justify-center items-center"><p>有効な日付が選択されていません。</p></div>;
  }

  return (
    <div className="w-full md:w-1/2 p-4 bg-gray-50 rounded-xl shadow-inner">
      <div className="flex justify-between items-center mb-4">
        <button onClick={() => setView('calendar')} className="p-2 rounded-full hover:bg-gray-200"><ArrowLeft /></button>
        <div className="flex items-center space-x-2">
            <button onClick={goToPrevDay} className="p-2 rounded-full hover:bg-gray-200"><ChevronLeft /></button>
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 whitespace-nowrap">
              {format(new Date(selectedDate), 'yyyy年 M月 d日', { locale: ja })}
            </h2>
            <button onClick={goToNextDay} className="p-2 rounded-full hover:bg-gray-200"><ChevronRight /></button>
        </div>
        <div className="w-10"></div> {/* スペーサー */}
      </div>

      <form onSubmit={handleSaveRecord} className="space-y-6">
        {/* 体重の記録 */}
        <div>
          <h3 className="text-xl font-bold text-gray-700 mb-2 flex items-center"><Activity className="w-5 h-5 mr-2" />体重の記録</h3>
          {['morning', 'evening', 'other'].map((type) => (
            <div key={type} className="bg-white p-4 rounded-lg shadow-sm mb-2">
              <div className="font-semibold text-gray-600 mb-2">{type === 'morning' ? '朝' : type === 'evening' ? '夜' : 'その他'}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">体重 (kg)</label>
                  <input type="number" step="0.1" value={dailyRecord.weights[type]?.value || ''} onChange={(e) => handleWeightChange(type, 'value', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">時刻 (HHMM)</label>
                  <div className="flex items-center mt-1">
                    <input type="text" value={dailyRecord.weights[type]?.time || ''} onChange={(e) => handleWeightChange(type, 'time', e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm" pattern="[0-2][0-9][0-5][0-9]" placeholder="例: 0730" />
                    <button type="button" onClick={() => handleWeightChange(type, 'time', format(new Date(), 'HHmm'))} className="ml-2 px-3 py-2 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300">現在</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 食事の記録 */}
        <div>
          <h3 className="text-xl font-bold text-gray-700 mb-2 flex items-center"><Camera className="w-5 h-5 mr-2" />食事の記録</h3>
          {['morning', 'lunch', 'dinner'].map((mealType) => (
            <div key={mealType} className="bg-white p-4 rounded-lg shadow-sm mb-2">
              <div className="font-semibold text-gray-600 mb-2">{mealType === 'morning' ? '朝食' : mealType === 'lunch' ? '昼食' : '夕食'}</div>
              <div className="space-y-2 mb-4">
                <label className="block text-sm font-medium text-gray-700">メニュー</label>
                {dailyRecord.meals[mealType]?.menus.map((menu, menuIndex) => (
                  <input key={menuIndex} type="text" value={menu} onChange={(e) => handleMealMenuChange(mealType, menuIndex, e.target.value)} maxLength="20" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" placeholder={`メニュー ${menuIndex + 1}`} />
                ))}
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">写真</label>
                <div className="flex space-x-2">
                  {dailyRecord.meals[mealType]?.photos.map((photo, photoIndex) => (
                    <div key={photoIndex} className="w-1/2 relative">
                      <input type="file" accept="image/*" onChange={(e) => handlePhotoUpload(mealType, photoIndex, e.target.files[0])} className="hidden" id={`photo-upload-${mealType}-${photoIndex}`} />
                      <label htmlFor={`photo-upload-${mealType}-${photoIndex}`} className="flex items-center justify-center h-24 w-full bg-gray-200 rounded-md cursor-pointer hover:bg-gray-300">
                        {photo ? <img src={photo} alt={`${mealType}写真`} className="object-cover h-full w-full rounded-md" /> : <Camera className="w-8 h-8 text-gray-500" />}
                      </label>
                      {photo && <button type="button" onClick={(e) => { e.preventDefault(); handleRemovePhoto(mealType, photoIndex); }} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600"><XCircle className="w-4 h-4" /></button>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* ★★★ アルコールの記録（独立したセクション） ★★★ */}
        <div>
            <h3 className="text-xl font-bold text-gray-700 mb-2 flex items-center">🍺 アルコールの記録</h3>
            <div className="bg-white p-4 rounded-lg shadow-sm mb-2">
                {dailyRecord.alcohols?.map((alcohol, index) => (
                    <div key={index} className="flex space-x-2">
                        <input type="number" value={alcohol.degree} onChange={(e) => handleAlcoholChange(index, 'degree', e.target.value)} className="w-1/3 rounded-md border-gray-300 shadow-sm" placeholder="度数 (%)" />
                        <input type="number" value={alcohol.amount} onChange={(e) => handleAlcoholChange(index, 'amount', e.target.value)} className="w-2/3 rounded-md border-gray-300 shadow-sm" placeholder="飲酒量 (ml)" />
                    </div>
                ))}
                <p className="text-sm text-gray-500 mt-2">合計アルコール量: {getTotalAlcohol(dailyRecord.alcohols).toFixed(2)} ml</p>
            </div>
        </div>

        {/* 残業時間 */}
        <div>
          <h3 className="text-xl font-bold text-gray-700 mb-2 flex items-center"><Clock className="w-5 h-5 mr-2" />残業時間</h3>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <select value={dailyRecord.overtime.type} onChange={handleOvertimeChange} className="block w-full rounded-md border-gray-300 shadow-sm">
              <option value="0時間">0時間</option>
              <option value="2時間">2時間</option>
              <option value="3時間">3時間</option>
              <option value="休日出勤">休日出勤</option>
              <option value="任意">任意</option>
            </select>
          </div>
        </div>

        {/* 簡単な日記 */}
        <div>
          <h3 className="text-xl font-bold text-gray-700 mb-2 flex items-center"><FileText className="w-5 h-5 mr-2" />簡単な日記</h3>
          <textarea value={dailyRecord.diary} onChange={handleDiaryChange} rows="4" maxLength="200" className="block w-full rounded-md border-gray-300 shadow-sm" placeholder="今日の出来事を200文字までで記録しましょう。"></textarea>
          <p className="text-right text-sm text-gray-500">{dailyRecord.diary.length}/200</p>
        </div>

        <button type="submit" disabled={isSaving} className="w-full bg-green-500 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:bg-green-600 flex items-center justify-center">
          {isSaving ? "保存中..." : "今日の記録を保存"}
        </button>
      </form>
    </div>
  );
};

export default React.memo(DailyNoteView);