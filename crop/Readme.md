## 设计文档
### 使用方法
new Crop(img, options)
- img：裁剪的图片元素
- options: 
    minWidth：最小宽度
    minHeight：最小高度，存在等比缩放时，会对 minHeight 进行矫正，minHeight  = minWidth / aspectRatio
    width：裁剪元素初始宽度
    aspectRatio：长宽比，为 0 时不做宽高限制
    dragNodes：缩放拖动点元素，默认值 ['left', 'right', 'top', 'bottom', 'leftTop', 'leftBottom', 'rightTop', 'rightBottom']

### 对角实现说明
1. 存在宽高等比缩放时
- 向左缩放的实现同时也是左上方向的实现
- 向上缩放的实现同时也是右上方向的实现
- 向右缩放的实现同时也是右下方向的实现
- 向下缩放的实现同时也是左下方向的实现
2. 不存在宽高等比缩放时，对角缩放由两个方向合成实现