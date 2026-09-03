Created by 胡晓畔, last modified on 四月 02, 2024

## 1. 需求概述

  [YDBRD-28586](https://jira.yasdb.com/browse/YDBRD-28586)       -     支持ROWIDTOCHAR函数     设计中

1、需求来源：市场需求，  国信证券

2、需求概述：  支持ROWIDTOCHAR函数，将rowid值转换为VARCHAR数据类型，长度根据rowid值而定

3、  需求范围：  单机、集群，   行表

  


## 2. 功能点

1、功能：函数输入字符类型或rowid类型，返回varchar

![](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/img/rowidtochar.gif?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDI2MTQsImV4cCI6MTc4MjMxMzQxNH0.gLR27kDX0Nk4x5qt32uE_QUgYIJwHNZsIprEUZ5ZfuQ)

  


2、差异：函数返回结果长度不定

  


## 3. 规格约束

1.崖山rowid与oracle规格不同，请见     [Rowid](https://conf.yasdb.com/display/~zhaozhongyuan/Rowid)  

2.  入参仅支持字符串类型及rowid类型，不支持其他类型

3.返回类型为VARCHAR，非法入参报错

4.入参为null时返回null

5.返回长度并不固定，最少为9位(0:0:0:0:0)，最多为42位(18446744073709551615:2047:63:67108863:4095)

  


## 4. 主要应用场景

1、应用场景：将rowid入参转换为字符串

2、关联场景：无

  


## 5. 概要测试设计

### 5.1 功能测试设计

1、功能设计：

（1）函数公共部分参考函数顶层设计

（2）需额外注意的测试点：不同字符集下函数结果正确性 ； 崖山rowid各个组成模块的边界值覆盖； 函数返回结果长度的范围覆盖 ； 考虑绑定参数 

  


2、拦截：分布式、单机列表拦截；非法入参类型拦截； 不满足rowid格式的字符类型拦截

  


### 5.2 DFX测试设计

1、专项覆盖：CT、KT

2、可维可测：已满足

  


## 6. 测试策略

|测试项|自动化|框架|详细|
|:---|:---|:---|:---|
|功能|是|yasft|  
|
|CT/KT|是|testkill|补充典型函数使用语句|


  


## 7. 后续关注(可选)

*依赖特性识别*

*后续测试详细设计中需要关注的内容*