

# 1. 概述

## 1.1 相关文档

SR:   [https://pingcode.yasdb.com/pjm/items/67652db3622069d46dfa8bbf?](https://pingcode.yasdb.com/pjm/items/67652db3622069d46dfa8bbf?)  

#YDBRD-36766 支持outline lob字段长度的计算

开发设计文档：  [YDBRD-36766 支持outline lob字段长度的计算特性设计 | 知识管理 - PingCode](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/678f4a16d06ac74ecc3f669b)  

个人调研文档：  [6.2.1【YDBRD-36766】Part1 个人调研 | 知识管理 - PingCode](https://pingcode.yasdb.com/wiki/spaces/XIEZHAOXIAN/pages/67886170b31fad21ea0d71bb)  

调研文档：

概要设计文档：

## 1.2 特性说明

列表的CLOB、BLOB，需要支持字段长度函数计算，包括：LENGTH/LENGTHB、OCTET_LENGTH、CHAR_LENGTH/CHARACTER_LENGTH  


# 2. 需求分析

## 2.1 功能点分析

|语法|作用|单机/分布式是否支持|
|---|---|---|
|LENGTHB|**按字节统计**|√|
|OCTET_LENGTH|**按字节统计**|√|
|LENGTH|**按字符统计**|√|
|CHAR_LENGTH|**按字符统计**|√|
|CHARACTER_LENGTH|**按字符统计**|√|
|  [DBMS_LOB | YashanDB Doc](https://cod-doc.yasdb.com/yashandb/23.4/zh/Development-Guide/PL-Reference-Manual/Built-in-Advanced-PL-Packages/DBMS_LOB.html)  |单机列存，本sr暂不放开|分布式不支持|
|jdbc|||
|c驱动|||




  


## 2.2 应用场景

1）  智慧工会&电子处方等客户使用

2）

## 2.3 规格约束

1）  针对 LENGTH/LENGTHB、OCTET_LENGTH、CHAR_LENGTH/CHARACTER_LENGTH，  ** 不包括 LENGTH2、BIT_LENGTH**

2）    

3）



# 3. 详细测试设计

## 3.1 测试设计方法

对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略

1）使用等价类划分、边界值覆盖

## 3.2 详细测试设计

### 3.2.1 DFX测试

|系统级DFX分类|是否涉及|测试点|
|---|---|---|
|CT并发|否  
|  
|
|KT|否  
|  
|
|长稳|否  
|  
|
|一致性|否  
|  
|
|三方测试工具  
(sqltest，sqlancer)|否  
|  
|
|安全|否  
|  
|
|DFR故障|否  
|  
|
|HA高可用|否  
|  
|
|压力|否  
|  
|
|性能|否  
|  
|
|可维护性|否  
|  
|


### 3.2.2 等价类

|序|类别|输入条件|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|---|
||功能校验|函数,,|LENGTHB,OCTET_LENGTH,LENGTH,CHAR_LENGTH,CHARACTER_LENGTH,|  
|  
|  
|
|||驱动|  [java.sql.Clob | YashanDB Doc](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/JDBC-Driver/Status-of-Support-for-JDBC-Interfaces/java.sql.Clob.html)     length(),  [java.sql.Blob | YashanDB Doc](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/JDBC-Driver/Status-of-Support-for-JDBC-Interfaces/java.sql.Blob.html)     length(),  [yacLobGetLength | YashanDB Doc](https://cod-doc.yasdb.com/yashandb/23.4/zh/Development-Guide/C-Language-Family-Drivers/C-Driver/C-Driver-Interfaces/LOB-Functions/yacLobGetLength.html)  ||||
|||高级包|  [DBMS_LOB | YashanDB Doc](https://cod-doc.yasdb.com/yashandb/23.4/zh/Development-Guide/PL-Reference-Manual/Built-in-Advanced-PL-Packages/DBMS_LOB.html)  ||||
|||数据长度|0,100以内,4000,31999,32000,288888,4G 数据  上限||||
|||数据内容|null,空串,1、0、-1,gbk 字符,emoji,特殊字符,utf8,utf16||||
|||一整个数据列|全是行内,全是行外,行外行内混合？||||
|||建表不指定行外lob|数据,行表，4000以内 + 以外,列表，32000以内 + 以外|  
|  
|  
|
||||temp lob|  
|  
|  
|
||||查类型  GET_TYPE_NAME()||||
|||表组织|单机分区表、非分区表,二级分区,分布表（数据分布到不同节点）,复制表,单dn,多dn,多列 （40 400 1024 ）,多表   ||||
|||字符集|列存  18030 utf8,不同字符集性能  
|  
|  
|  
|
|||性能    |单机行列对比||||
||场景校验|  
|create table as select ,建视图、对视图查询,系统视图含有lob的 （行表）,  [GROUPING | YashanDB Doc](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/Built-in-Functions/GROUPING.html)    聚合函数,窗口函数|  
|  
|  
|
||场景校验||求 大lob 的长度的时候，其中一个dn挂掉||||
||||匿名块绑定参数：单个、多个||||
||  
|压缩  
|  [compression-clause](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/SQL-Statements/CREATE-TABLE.html#compression-clause)    
|  
|  
|  
|
||||不支持的 写一个用例里||||
|||待确定|![clipbord_1739168573952.png](https://pingcode.yasdb.com/atlas/files/public/67a9a5c398ac295b69be0c3d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDE2NjUsImV4cCI6MTc4MjM1MjQ2NX0.Am4EBD6Bi7x5Ey_ri-SHlRLecN3kfZvpxxePqHRd6TA)||||
||参数校验|  
|  
|  
|  
|  
|
||文档校验|  
|正确删除相关函数里的,“ 在向量化执行引擎中，expr不能为  **LOB类型的行外存储数据。 ” **|  
|  
|  
|
||  
|  
|  
|  
|  
|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


## 4.1 冒烟用例

```
1.
```

  


## 4.2 文本用例

文本用例：



属性表：

# 5. 测试框架设计

- 如果用例不能实现自动化需要在此标注并说明原因
- 确认使用的测试框架及其满足度


1） 自动化用例：

Guider框架执行用例，生成预期，使用yasql模式执行。

使用导入导出框架进行测试  [https://git.yasdb.com/cod-x/yastest_dfx/-/tree/master/exp_imp_test](https://git.yasdb.com/cod-x/yastest_dfx/-/tree/master/exp_imp_test)  

# 6. 测试环境说明

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

1）辅助工具：

Guider部署、执行、字符集配置脚本：  [https://git.yasdb.com/xiezhaoxian/scripts](https://git.yasdb.com/xiezhaoxian/scripts)  

2）测试环境：

|  
|CPU|操作系统|可用内存|可用磁盘空间|磁盘类型|
|:---|:---|:---|:---|:---|:---|
|192.168.7.105|Intel(R) Xeon(R) Gold 6230R CPU @ 2.10GHz|Linux AchorBase 3.10.0-1160.114.2.el7.x86_64|50G|303G|HDD|


# 7. 工作量评估

工作量：天

计划测试完成时间：  
