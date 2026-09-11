Created by 林俊喆, last modified on 五月 08, 2024

## 1. 算子补充

topn语法补充

limit + sort

window function + topn

distinct + topn

group by + topn

join情况拓展 join condition，连接消除

A not exists(A) ,A anti join A 未实现

result 判断filter

## 2. 遇到不应该出现在该阶段的算子补充报内部错误

  


## 3. 需要校验所有算子，对于新增算子未新增函数需要报内部错误

## 4. 在staticTransform实现逻辑

## 5. 优化的子树中带子查询（先不修改，增加删除子查询引用接口），带cte（增加删除cte引用接口）