import React from 'react';
import { format, isValid } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Camera, Activity, FileText, ArrowLeft, Clock, XCircle, Plus } from 'lucide-react';

const DailyNoteView = ({
  selectedDate,
  dailyRecord,
  isSaving,
  handleSaveRecord,
  setView,
  handleWeightChange,
  handleMealMenuChange,
  handleMealAlcoholChange,
  handlePhotoUpload,
  handleRemovePhoto,
  handleOvertimeChange,
  handleDiaryChange,
  getTotalAlcohol
}) => {

  // propsで渡された日付が有効かチェック
  if (!selectedDate || !isValid(new Date(selectedDate))) {
    return (
      <div className="w-full md:w-1/2 p-4 flex justify-center items-center">
        <p>有効な日付が選択されていません。</p>
      </div>
    );
  }

  return (
    <div className="w-full md:w-1/2 p-4 bg-gray-50 rounded-xl shadow-inner">
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => setView('calendar')}
          className="p-2 rounded-full hover:bg-gray-200 flex items-center text-gray-600"
        >
          <ArrowLeft className="w-5 h-5 mr-1" />
          カレンダーに戻る
        </button>
        <h2 className="text-2xl font-bold text-gray-800">
          {format(new Date(selectedDate), 'yyyy年 M月 d日', { locale: ja })} の記録
        </h2>
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
                  <input
                    type="number"
                    step="0.1"
                    value={dailyRecord.weights[type]?.value || ''}
                    onChange={(e) => handleWeightChange(type, 'value', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">時刻 (HHMM)</label>
                  <div className="flex items-center mt-1">
                    <input
                      type="text"
                      value={dailyRecord.weights[type]?.time || ''}
                      onChange={(e) => handleWeightChange(type, 'time', e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm"
                      pattern="[0-2][0-9][0-5][0-9]"
                      placeholder="例: 0730"
                    />
                    <button
                      type="button"
                      onClick={() => handleWeightChange(type, 'time', format(new Date(), 'HHmm'))}
                      className="ml-2 px-3 py-2 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300 transition-colors"
                    >
                      現在
                    </button>
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
                  <input
                    key={menuIndex}
                    type="text"
                    value={menu}
                    onChange={(e) => handleMealMenuChange(mealType, menuIndex, e.target.value)}
                    maxLength="20"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                    placeholder={`メニュー ${menuIndex + 1}`}
                  />
                ))}
              </div>
              <div className="space-y-2 mb-4">
                <label className="block text-sm font-medium text-gray-700">アルコール</label>
                {dailyRecord.meals[mealType]?.alcohols.map((alcohol, alcoholIndex) => (
                  <div key={alcoholIndex} className="flex space-x-2">
                    <input type="number" value={alcohol.degree} onChange={(e) => handleMealAlcoholChange(mealType, alcoholIndex, 'degree', e.target.value)} className="w-1/3 rounded-md border-gray-300 shadow-sm" placeholder="度数 (%)" />
                    <input type="number" value={alcohol.amount} onChange={(e) => handleMealAlcoholChange(mealType, alcoholIndex, 'amount', e.target.value)} className="w-2/3 rounded-md border-gray-300 shadow-sm" placeholder="飲酒量 (ml)" />
                  </div>
                ))}
                <p className="text-sm text-gray-500 mt-2">合計アルコール量: {getTotalAlcohol(dailyRecord.meals[mealType]?.alcohols).toFixed(2)} ml</p>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">写真</label>
                <div className="flex space-x-2">
                  {dailyRecord.meals[mealType]?.photos.map((photo, photoIndex) => (
                    <div key={photoIndex} className="w-1/2 relative">
                      <input type="file" accept="image/*" onChange={(e) => { console.log('onChangeイベント発生'); handlePhotoUpload(mealType, photoIndex, e.target.files[0]); }} className="hidden" id={`photo-upload-${mealType}-${photoIndex}`} />
                      <label htmlFor={`photo-upload-${mealType}-${photoIndex}`} className="flex items-center justify-center h-24 w-full bg-gray-200 rounded-md cursor-pointer hover:bg-gray-300 transition-colors">
                        {photo ? <img src={photo} alt={`${mealType}食事写真${photoIndex + 1}`} className="object-cover h-full w-full rounded-md" /> : <Camera className="w-8 h-8 text-gray-500" />}
                      </label>
                      {photo && <button type="button" onClick={(e) => { e.preventDefault(); handleRemovePhoto(mealType, photoIndex); }} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600"><XCircle className="w-4 h-4" /></button>}
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
            <select value={dailyRecord.overtime.type} onChange={handleOvertimeChange} className="block w-full rounded-md border-gray-300 shadow-sm">
              <option value="0時間">0時間</option>
              <option value="2時間">2時間</option>
              <option value="3時間">3時間</option>
              <option value="休日出勤">休日出勤</option>
              <option value="任意">任意</option>
            </select>
            {dailyRecord.overtime.type === '任意' && (
              <input type="number" step="0.25" value={dailyRecord.overtime.hours} onChange={(e) => { /* この部分はApp.jsxで定義した方が良いが、一旦残す */ }} className="mt-2 block w-full rounded-md border-gray-300 shadow-sm" placeholder="0.25時間単位で入力" />
            )}
          </div>
        </div>

        {/* 簡単な日記 */}
        <div>
          <h3 className="text-xl font-bold text-gray-700 mb-2 flex items-center"><FileText className="w-5 h-5 mr-2" />簡単な日記</h3>
          <textarea value={dailyRecord.diary} onChange={handleDiaryChange} rows="4" maxLength="200" className="block w-full rounded-md border-gray-300 shadow-sm" placeholder="今日の出来事を200文字までで記録しましょう。"></textarea>
          <p className="text-right text-sm text-gray-500">{dailyRecord.diary.length}/200</p>
        </div>

        <button type="submit" disabled={isSaving} className="w-full bg-green-500 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:bg-green-600 transition-colors duration-200 flex items-center justify-center">
          {isSaving ? <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <Plus className="w-5 h-5 mr-2" />}
          {isSaving ? "保存中..." : "今日の記録を保存"}
        </button>
      </form>
    </div>
  );
};

export default React.memo(DailyNoteView);