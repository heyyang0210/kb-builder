Created by 孟麟 on 三月 18, 2024

# YDBRD-11491测试概要设计

  [YDBRD-11491](https://jira.yasdb.com/browse/YDBRD-11491?src=confmacro)    -  支持LENGTH2函数  完成

## 1. 需求概述

1、需求来源：市场需求，华润银行

2、需求概述：  支持LENGTH2函数，函数功能是以UTF-16返回参数长度（固定宽度编码，2bytes）

3、部署形态：主备(单机)行表、集群

## 2. 功能点

1、功能：函数输入char类型，返回number（bigint）

![](https://conf.yasdb.com/download/attachments/133573260/WXWorkLocal_16969061178717.png?version=3&modificationDate=1698148874000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTQ0NjAsImV4cCI6MTc4MjMwNTI2MH0.T03zFCV5ifbBUDBVO5aCCQuZl6ocjfS33bZMEFED9K0)

2、差异：无

## 3. 规格约束

- 不支持CLOB/NCLOB/BLOB/BIT。
- 输入字符串内的空格也会计入返回长度。
- 当输入Null的时候，返回Null。
- 参数可以输入任意能转成字符串的类型。
- 不支持不输入参数。
- 支持绑定参数。


## 4. 主要应用场景

1、应用场景：按2字节获取参数长度

2、关联场景：无

## 5. 概要测试设计

### 5.1 功能测试设计

1、功能设计：

（1）函数公共部分参考函数顶层设计

（2）需额外注意的测试点：1）不同字符集下函数计数正确性；2）特殊字符，如不同国家语言，表情计算正确性

（3）功能一致性：对齐oracle

2、拦截：分布式，单机列表拦截

### 5.2 DFX测试设计

1、专项覆盖：CT、KT

2、可维可测：已满足

## 6. 测试策略

  


|测试项|自动化|框架|详细|
|:---|:---|:---|:---|
|功能|是|yasft|1）不同字符集下函数计数正确性；2）特殊字符，如不同国家语言，表情计算正确性|
|CT/KT|是|testkill|补充典型函数使用语句|


## 7. 后续关注(可选)

*依赖特性识别*

*后续测试详细设计中需要关注的内容*