// 日付抽出機能のテスト
const { extractDueDateFromText } = require('./src/utils/helpers');

console.log('📅 日付抽出テスト開始\n');

const testCases = [
  '11/18までにお願いします',
  '2024/12/25にリリース予定',
  '11月18日までに確認してください',
  '明日までに対応お願いします',
  '来週までに完了させます',
  'これは期限なしのタスクです',
];

testCases.forEach((text, index) => {
  console.log(`\nテスト${index + 1}: "${text}"`);
  const dueDate = extractDueDateFromText(text);
  
  if (dueDate) {
    console.log(`✅ 期限検出: ${dueDate.toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo'
    })}`);
  } else {
    console.log('❌ 期限なし');
  }
});

console.log('\n✅ テスト完了');
