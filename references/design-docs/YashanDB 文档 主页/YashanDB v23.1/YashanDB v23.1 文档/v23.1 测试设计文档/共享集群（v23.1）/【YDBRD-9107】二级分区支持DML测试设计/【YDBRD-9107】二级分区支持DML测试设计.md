Created by 吕雷奇, last modified by  陈瑞 on 一月 03, 2024

# **1. 概述**

二级分区支持所有的DML包括insert、update、select（select for update）、delete，重点放在测试  优化器支持生成二级分区表的查询计划是否符合预期。

# **2. 需求分析**

SR:     [YDBRD-9107](https://jira.yasdb.com/browse/YDBRD-9107?src=confmacro)    -  二级分区支持DML  完成

开发设计：    [二级分区剪枝方案设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=109053281)  

支持9种二级分区，即：range-range, range-hash, range-list; hash-range, hash-hash, hash-list; list-range, list-hash, list-list。

|扫描类型\分区类型|HASH|RANGE|LIST|
|:---|:---|:---|:---|
|SINGLE|支持|支持|支持|
|ITERATOR|支持|支持|支持|
|ALL|支持|支持|支持|


目前单级分区扫描只支持hash、range、list分区与single、iterator、all的组合场景；二级分区认为是单级分区的基于不同的key再次分区，规则与单级分区相同，计划层面看会有两次part scan算子。

**YASDB支持一级分区剪枝情况**

**Range分区**

|扫描类型\场景|分区键单列|分区键多列|典型场景|YASDB支持情况|
|:---|:---|:---|:---|:---|
|SINGLE|subfilter中存在能确定唯一分区|subfilter中存在能确定唯一分区|**单列**  ：所有key都为等于、range包含；  **多列**  ：所有key都为等于|基于rangeSet进行判断为某一分区|
|ITERATOR|subfilter中存在能确定某些分区|subfilter中存在能确定某些分区|**单列**  ：range跨越多分区，例如key>const；  **多列**  ：range跨越多分区,例如key1=const或者key1=const and key2>const|基于rangeSet进行判断为某些分区。由于没有inlist扫描，inlist的场景并入iterator|
|ALL|无法剪枝|无法剪枝|查询无filter；列与比较的元素datatype不匹配；经过计算无法确定某个或某些分区|其余情况|
|IN-LIST|存在subfilter中是一个关于key的list或or连接多个point|存在一个subfilter是首列key的list或or连接多个point|**单列**  ：key in (x1,x2..),key = x1 or key = x2；  **多列**  ：key1 = const and key2 in (x1,x2..)|不支持|
|MULTI-COLUMN|不会产生|存在subfilter有另外列的一个条件（即不能有or，且不满足iterator的条件，如果前导列是等于条件往往就满足了iterator）|keyn = 1|不支持|
|OR|存在subfilter是多个用or连接的key的条件（且不满足其他剪枝方式）|存在subfilter是多个用or连接的某一个key的条件（且不满足其他剪枝方式）|key > const or key < const（不能区间合并）|不支持|


**Hash分区**

注意：hash分区的特殊性在于只有point条件或list条件可用于分区剪枝，并且如果分区键有多列，必须每个key上都有point条件或list条件才能剪枝。

|扫描类型\场景|分区键单列|分区键多列|典型场景|YASDB支持情况|
|:---|:---|:---|:---|:---|
|SINGLE|subfilter中存在能确定唯一分区|subfilter中存在能确定唯一分区|**单列**  ：所有key都为等于；  **多列**  ：所有key都为等于|所key都为等于|
|ITERATOR|未构造出|未构造出|  
|**单列**  ：key有多个point条件；  **多列**  ：不会选择iterator|
|ALL|无法剪枝|无法剪枝|查询无filter；列与比较的元素datatype不匹配；key是一个range条件|其余情况|
|IN-LIST|存在subfilter中是一个关于key的list或or连接多个point|每个key都能找到一个subfilter是关于他的list或or连接多个point|**单列**  ：key in (x1,x2..),key = x1 or key = x2；  **多列**  ：key1 = const and key2 in (x1,x2..)|不支持|
|MULTI-COLUMN|不会产生|未构造出|  
|不支持|
|OR|未构造出|未构造出|  
|不支持|


** List分区**

- 注意：list分区当有default分区时，有些不包含所有分区key的条件看似落在某个分区上，但其实也可能落在default上，如果没有default分区就可以是single。


|扫描类型\场景|分区键单列|分区键多列|典型场景|YASDB支持情况|
|:---|:---|:---|:---|---|
|SINGLE|subfilter中存在能确定唯一分区|subfilter中存在能确定唯一分区|**单列**  ：可以确定key的取值一定在某个list中；  **多列**  ：可以确定这一组key的取值一定在某个list中（注意：inlist的优先级似乎高于single，当满足inlist分区时，哪怕是能够判断在某个分区中，还是会走inlist扫描）|所key都为等于|
|ITERATOR|subfilter中存在能确定某些分区|subfilter中存在能确定某些分区|**单列**  ：key为一个range时，range中不在list中的会落在default分区；  **多列**  ：从第一个key上的条件开始匹配，不能匹配上single时|**单列**  ：key有多个point条件；  **多列**  ：不会选择iterator|
|ALL|无法剪枝|无法剪枝|查询无filter；列与比较的元素datatype不匹配；经过计算无法确定某个或某些分区|其余情况|
|IN-LIST|存在subfilter中是一个关于key的list或or连接多个point|存在一个subfilter是首列key的list或or连接多个point|**单列**  ：key in (x1,x2..),key = x1 or key = x2；  **多列**  ：key1 = const and key2 in (x1,x2..)|不支持|
|MULTI-COLUMN|不会产生|存在subfilter有另外列的一个条件（即不能有or，且不满足iterator的条件，如果前导列是等于条件往往就满足了iterator）|keyn = 1|不支持|
|OR|存在subfilter是多个用or连接的key的条件（且不满足其他剪枝方式）|存在subfilter是多个用or连接的某一个key的条件（且不满足其他剪枝方式）|key > const or key < const（不能区间合并）|不支持|


**二级分区实现**

**1. 基于分区key上filter的剪枝**    
  二级分区的两级剪枝之间是and关系，例如基于a进行一级分区，基于b进行二级分区，条件  a     = const1     and     b     = const2  ，则可以拆分为在一级分区上基于条件  a = const1  进行分区剪枝，再在二级分区上基于  b = const2  进行分区剪枝。    
  因此二级分区的剪枝策略为预处理filter后，将仅含一级分区key的subfilter提取出来用作一级分区剪枝，仅含二级分区key的subfilter提取出来用作二级分区剪枝。单级剪枝规则与一级分区相同。    
  **2. 基于指定分区的剪枝**    
  指定一级分区：一级分区为  PARTITION     SINGLE  ；二级分区为  PARTITION     ALL  。 指定二级分区：只有一层计划  PARTITION     COMBINED ITERATOR    
  在创建计划时检查是否有指定的分区信息，若有，则直接生成相应分区扫描计划。

静态剪枝和动态剪枝

1、静态剪枝是在优化器中进行的。当分区键有关的filter里面都是与常量比较时，即可做静态剪枝。

2、动态分区剪枝是在执行态进行的。当分区条件出现了绑定变量、子查询，或作为nested loop join的右表出现了的左表列时，静态剪枝时无法确定具体的值，所以只能在执行态确定值后进行动态分区剪枝。

- 注意：动态分区剪枝与静态结合时规则如下：


|二级分区\一级分区|STATIC|DYNAMIC|
|:---|:---|:---|
|STATIC|两层STATIC|两层DYNAMIC|
|DYNAMIC|一级STATIC 二级DYNAMIC|两层DYNAMIC|


# **3. 测试设计方法**  ** **

**测试设计方法：**

- 使用场景法和正交组合覆盖二级分区DML组合场景和并发+kill场景；
- 使用场景法和正交组合所有的剪枝分支和组合；


  


**测试关注点：**

- DML操作符合执行预期；
- 构造剪枝场景的执行计划符合预期；


  


**专项覆盖：**

|专项|是否涉及|说明|
|:---|:---|:---|
|并发|涉及|  
|
|长稳|涉及|  
|
|一致性|涉及|  
|
|三方测试工具    
  (sqltest，sqlancer)|/|  
|
|安全|/|  
|
|DFR/testkill|涉及|  
|
|HA|涉及|  
|
|压力|/|  
|
|性能|涉及|  
|
|可维护性|/|  
|
|兼容性|/|  
|


# 4.   **详细测试设计**   

# 5.   **测试用例**

  


# 6.   **测试框架设计**

自动化用例添加到regress框架

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[物化视图全量刷新.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YWVhMWFkOWEzMzExZGM3ODVjIiwicmVmX2lkIjoiNjczOTY5YWU3MjgyMDZlZmI5MmVmNjE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MzM1LCJleHAiOjE3ODIyOTQ3MzV9.XjQzg6OoRcVhV7TAINkTSXzpFf_UypvRJ_ZkCSJemMU)

 (application/vnd.xmind.workbook)    


[支持ROWID数据类型测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YWU4OTcwYzJhZjRmNTFmOWU2IiwicmVmX2lkIjoiNjczOTY5YWU3MjgyMDZlZmI5MmVmNjE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MzM1LCJleHAiOjE3ODIyOTQ3MzV9.DXGREe5uDQoLIkyyeaAmDg5Z1J43fgxn0q31UCdL_ew)

 (application/vnd.xmind.workbook)    


[image2023-11-14_18-24-46.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YWZhMWFkOWEzMzExZGM3ODVkIiwicmVmX2lkIjoiNjczOTY5YWU3MjgyMDZlZmI5MmVmNjE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MzM1LCJleHAiOjE3ODIyOTQ3MzV9.8G2N9OpcIXzjr9gfOmB5Cr3LViIwxobQY0R6gBdqQ_k)

 (image/png)    


[二级分区支持dml.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YWY4OTcwYzJhZjRmNTFmOWU3IiwicmVmX2lkIjoiNjczOTY5YWU3MjgyMDZlZmI5MmVmNjE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MzM1LCJleHAiOjE3ODIyOTQ3MzV9.azQ32qSv96P-HwkkyHUPjPYKX6CdXfr9NfKy_jGf9d0)

 (application/x-xmind)    
