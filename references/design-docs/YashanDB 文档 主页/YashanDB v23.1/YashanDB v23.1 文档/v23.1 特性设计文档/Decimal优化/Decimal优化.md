Created by 叶显昊, last modified by  林博 on 一月 19, 2024

YDBRD-13105 : Decimal Optimization Design（优化decimal和整数计算方案设计）

SR链接：    [YDBRD-13105](https://jira.yasdb.com/browse/YDBRD-13105?src=confmacro)    -  【列存计算】优化decimal和整形的计算  完成

##   [1. Overview（概述）](#1-overview概述)  

1.当decimal的scale为0时，整数转成了decimal就可以直接运算 ,如果评估出来不溢出，可以用uncheck接口进行计算。

2.当decimal的scale不为0时，需要先转成scale一样的decimal，如果能够用unchecked方法的，要用uncheck方法实现。

对于非溢出的场景，表达式性能提升要在50%以上。

##   [2. Features（功能特性）](#2-features功能特性)  

整数可以看成scale为0的decimal

|原始类型|等价表示|
|---|---|
|tinyint|number(3, 0)|
|smallint|number(5, 0)|
|int|number(10, 0)|
|bigint|number(19, 0)|


- 加法、减法


|功能|设计表现|设计说明|
|---|---|---|
|两个参数的scale相等，最大precision不是38|使用uncheck接口计算（decimal之间运算之前已经做了，这个特性会优化整数和decimal之间运算）|没有超过10^38的范围，不会溢出|
|两个参数的scale相等，最大precision为38|使用check接口计算|可能溢出|
|两个参数的scale不等|参数的scale按低位对齐，之后按照scale相等判断（这个特性适配两个decimal，不溢出情况不用都转成decimal）|行为解释说明|


- 乘法


|功能|设计表现|设计说明|
|---|---|---|
|scale相加在-126和130之间，precision相加超过当前native的最大precision，但是不超过38|使用uncheck接口计算（同上）|没有超过10^38的范围，不会溢出|
|precision相加超过38|使用check接口计算|可能溢出|
|scale相加不在-126和130之间|使用check接口计算|可能溢出|


##   [3. Interfaces（接口）](#3-interfaces接口)  

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

是scale固定的number类型之间和对整数类型的运算的优化

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

- 为整型实现等价的number表示
- 按上述规则判断是否会溢出
- 不会溢出进入uncheck接口计算
    - 为不同scale的number实现uncheck接口


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

- 验证之前的number计算用例
- 验证性能的优化效果


##   [7.资料设计章节](#7资料设计章节)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  