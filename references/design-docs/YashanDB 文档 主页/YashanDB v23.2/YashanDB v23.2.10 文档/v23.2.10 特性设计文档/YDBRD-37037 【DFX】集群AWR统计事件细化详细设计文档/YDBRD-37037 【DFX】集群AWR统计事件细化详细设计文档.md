Created by 雷世柱 on 十一月 06, 2024

*详细设计-YDBRD-37037  : 【DFX】集群AWR统计事件细化*

*IR链接：*  [https://pingcode.yasdb.com/pjm/items/67723be8a9f31a27f6b0f75b?](https://pingcode.yasdb.com/pjm/items/67723be8a9f31a27f6b0f75b?)  

#YDBRD-37037 【DFX】集群AWR统计事件细化

##   [1. 总述](#1-总述)  

说明本设计方案的需求来源，需求分析，功能概要描述。

###   [1.1 需求来源](#11-需求来源)  

需求来源：内部需求；

需求描述：  *【DFX】集群AWR统计事件细化*

需求场景：

1. **Y**  **AC Report Summary 统计相关数据单位不明确的问题，需要标注补齐;**
1. 单机AWR：  **VM情况+**  Report Summary--缓存信息补充;


需求范围：单机、集群

###   [1.2 调研文档](#12-调研文档)  

1. 集群AWR调研:  [yac-awr | 知识管理 - PingCode (yasdb.com)](https://pingcode.yasdb.com/wiki/spaces/SHIXIN/pages/6773a0581e1551235bedfc90)  
1. 单机AWR调研:  [AWR-调研 | 知识管理 - PingCode (yasdb.com)](https://pingcode.yasdb.com/wiki/spaces/SHIXIN/pages/6771f806ea9f2a2870928831)  


###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|---|---|---|---|---|---|
|功能|Y  AC Report Summary 统计相关数据单位不明确的问题|补齐相关单位|是|是|  [https://pingcode.yasdb.com/pjm/items/67723be8a9f31a27f6b0f75b?](https://pingcode.yasdb.com/pjm/items/67723be8a9f31a27f6b0f75b?)  ,#YDBRD-37037 【DFX】集群AWR统计事件细化|
||AWR报告补充VM情况信息|只补充行存的信息，记录后一个快照id的信息|是|是||
||Report Summary--缓存信息补充|补充V$SGA展示所有的信息，记录后一个快照id的信息|是|是||
|||||||


###   [1.4 数据字典](#14-数据字典)  

无

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|  [DBMS_AWR](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/PL-Reference-Manual/Built-in-Advanced-PL-Packages/DBMS_AWR.html)  . AWR_REPORT|生成AWR快照|是|


##   [3. 规格与约束](#3-规格与约束)  

**说明从IR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**  规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

##   [4. 特性](#4-特性)  

###   [4.1 YAC Report Summary 相关数据单位不明确](#41-特性功能点1)  

![image.png](https://pingcode.yasdb.com/atlas/files/public/678df0b0a1ad9a3311de6e80/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUJBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBaEFBQUFBQUFBQUFBSUFBQUFBQUFBQWdBQUFnQUFBQUFBQUFBQ0FBSUFBQUFBQUFBQUFnPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDU0ODcsImV4cCI6MTc4MjM1NjI4N30.0VJStgKASPh8nmLs1O07dn2Kc73APUlWHWe9fTyPBIM)

*补齐单位*

###   [4.2 VM信息补充](#42-特性功能点2)  

新创建一个标签Memory Statistics，里面添加VM信息，并说明只统计行存

![image.png](https://pingcode.yasdb.com/atlas/files/public/678e1146a1ad9a3311de6ed0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUJBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBaEFBQUFBQUFBQUFBSUFBQUFBQUFBQWdBQUFnQUFBQUFBQUFBQ0FBSUFBQUFBQUFBQUFnPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDU0ODcsImV4cCI6MTc4MjM1NjI4N30.0VJStgKASPh8nmLs1O07dn2Kc73APUlWHWe9fTyPBIM)

![image.png](https://pingcode.yasdb.com/atlas/files/public/678f00eea1ad9a3311de6f2d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUJBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBaEFBQUFBQUFBQUFBSUFBQUFBQUFBQWdBQUFnQUFBQUFBQUFBQ0FBSUFBQUFBQUFBQUFnPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDU0ODcsImV4cCI6MTc4MjM1NjI4N30.0VJStgKASPh8nmLs1O07dn2Kc73APUlWHWe9fTyPBIM)

###   [4.3 Report Summary缓存信息补充](#43-特性性能点1)  

#### 展示V$SGA所有的信息即可:

data buffer                                 

temporary buffer                         

large pool                                 

redo buffer                                    

hot cache                               

share pool                               

global application pool                

dbwr buffer                                 

job pool                                      

parallel execute buffer                  

audit queue buffer   

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

|测试场景|预期|
|---|---|
|单机生成AWR报告|增加VM信息和缓存信息(V$SGA)|
|集群生成AWR报告|补充相关数据单位|
|||


##   [6.资料设计章节](#6资料设计章节)  

  [性能报告 | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.2/zh/Performance-Tuning/Performance-Tuning-Features-and-Tools/Performance-Reports.html)  报告内容中添加新增的VM和缓存信息;



##   [7.未来规划](#7未来规划)  

可见调研文档中其他带补充的内容。