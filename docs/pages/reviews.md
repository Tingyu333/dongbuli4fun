<!-- 從 CLAUDE.md 拆出來的（2026-11-17）。改了這部分的功能，記得一起改這份。 -->

# reviews.html

留言板。`GET ?action=getReviews` 讀取、POST `type: 'review'` 新增（等後端回覆，成功就把那則直接放到最上面、朱色標一下，失敗用 `showToast()` 說原因）。新的在前面（前端自己依時間排序）、一次 10 則「往前翻」、標題旁有「共 N 則・平均 X 顆星」、時間顯示「剛剛／3 小時前／昨天」。名字和留言用 `esc()` 跳脫、換行照原樣顯示；留言最多 300 字（有字數）；名字記在 `localStorage`（`dongbuli-review-name`）。手機上表單放在列表前面。
