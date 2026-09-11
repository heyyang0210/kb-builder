Created by 徐瑶, last modified on 四月 10, 2024

# 1. 概述

本文描述UTL_ENCODE系统包实现两个子函数（  BASE64_ENCODE、BASE64_DECODE  ）的测试设计

## 1.1 相关文档

SR:          [YDBRD-18476](https://jira.yasdb.com/browse/YDBRD-18476?src=confmacro)    -  支持UTL_ENCODE内置系统包  设计中

开发设计文档：    [YDBRD-18476：UTL_ENCODE的支持---设计文档](147776613.html)  

调研文档：    [01-测试调研](https://conf.yasdb.com/pages/viewpage.action?pageId=150602605)  

概要设计文档：    [02-测试概要设计](150603619.html)  

参考文档：    [https://docs.oracle.com/en/database/oracle/oracle-database/21/arpls/UTL_ENCODE.html#GUID-0C0E009F-5E2E-49B8-B746-5B9D875F2A02](https://docs.oracle.com/en/database/oracle/oracle-database/21/arpls/UTL_ENCODE.html#GUID-0C0E009F-5E2E-49B8-B746-5B9D875F2A02)  

  [https://baike.baidu.com/item/BASE64/8545775](https://baike.baidu.com/item/BASE64/8545775)  

# 2. 需求分析

## 2.1 功能点分析

### 1）功能：将RAW类型数据进行编码，传给对端，对端能解码出原始的RAW类型数据。

高级包中实现两个子函数：

(1)  BASE64_ENCODE：  对RAW类型数据进行编码的函数

(2)  BASE64_DECODE：  对已经编码好的RAW类型数据进行解码的函数

![](https://pingcode.yasdb.com/atlas/files/public/67396cb0a1ad9a3311dc8c4a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ1FBQUFBQUFBRUFBQUFBQUFBRUFBQUFBQUFBUUFBQUFRQUFDQUFBQUFBQUFBQUFBQUFBQUVBUUFBQUFBQVNBQUFBQUFBSUFFQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUlBQUFBSUFBQUFBQUFnQUJBQUFBQUFFQUFBQUFBQUFBQUFBQUVnQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUNBQUFBZ2dBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDI3MDksImV4cCI6MTc4MjMxMzUwOX0.shPQGt340KMAha84uGvEVfDZwMCbxNlfuycfsYGu7zo)

2）语法介绍：

**UTL_ENCODE.BASE64_ENCODE**   (    
  r IN RAW)     
  RETURN RAW;

**UTL_ENCODE.BASE64_DECODE**   (    
  r IN RAW)     
  RETURN RAW;

## 2.2 应用场景

- 单语句中作为函数使用（单独使用或指定参数使用）


![](https://pingcode.yasdb.com/atlas/files/public/67396cb08970c2af4f520dd9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ1FBQUFBQUFBRUFBQUFBQUFBRUFBQUFBQUFBUUFBQUFRQUFDQUFBQUFBQUFBQUFBQUFBQUVBUUFBQUFBQVNBQUFBQUFBSUFFQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUlBQUFBSUFBQUFBQUFnQUJBQUFBQUFFQUFBQUFBQUFBQUFBQUVnQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUNBQUFBZ2dBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDI3MDksImV4cCI6MTc4MjMxMzUwOX0.shPQGt340KMAha84uGvEVfDZwMCbxNlfuycfsYGu7zo)

- pl/sql中使用（单独使用，参数绑定参数使用）


单独使用：

![](https://pingcode.yasdb.com/atlas/files/public/67396cb0a1ad9a3311dc8c4b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ1FBQUFBQUFBRUFBQUFBQUFBRUFBQUFBQUFBUUFBQUFRQUFDQUFBQUFBQUFBQUFBQUFBQUVBUUFBQUFBQVNBQUFBQUFBSUFFQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUlBQUFBSUFBQUFBQUFnQUJBQUFBQUFFQUFBQUFBQUFBQUFBQUVnQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUNBQUFBZ2dBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDI3MDksImV4cCI6MTc4MjMxMzUwOX0.shPQGt340KMAha84uGvEVfDZwMCbxNlfuycfsYGu7zo)

绑定参数使用：

![](https://pingcode.yasdb.com/atlas/files/public/67396cb08970c2af4f520dda/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ1FBQUFBQUFBRUFBQUFBQUFBRUFBQUFBQUFBUUFBQUFRQUFDQUFBQUFBQUFBQUFBQUFBQUVBUUFBQUFBQVNBQUFBQUFBSUFFQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUlBQUFBSUFBQUFBQUFnQUJBQUFBQUFFQUFBQUFBQUFBQUFBQUVnQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUNBQUFBZ2dBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDI3MDksImV4cCI6MTc4MjMxMzUwOX0.shPQGt340KMAha84uGvEVfDZwMCbxNlfuycfsYGu7zo)

- 对编码结果进行解码可以正确还原


## 2.3 规格约束

- 本次需求支持单机和集群环境，分布式（lsc/tac）拦截报错（  以执行计划为准，列执行不支持  ）
- 只接受一个参数，参数类型为raw类型，  或可以隐式、强制转换为raw的类型（字符，blob，rowid，urowid，  返回类型为raw，  长度？？  。  json数据能否转换到raw
- raw最大长度为8000 bytes（oracle长度为2000，  long raw范围2^31-1  ）。  运算上限raw是32000
- 如果入参为Null，''，报错。


# 3. 详细测试设计

## 3.1 测试设计方法

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*


|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|:---|
|部署形态|  
|- 单机
- 集群
|单机lsc、tac也不支持|分布式（lsc、tac）|拦截报错|
|关键字校验|  
|- 高级包覆盖 全大小，全小写，大小写混合
- 函数名覆盖 全大小，全小写，大小写混合
- 创建同名表和视图"  UTL_ENCODE.BASE64_ENCODE  "
- 创建  UTL_ENCODE  用户，  BASE64_ENCODE、BASE64_DECODE表
|  
|- 高级包拼写缺失
- 缺少  UTL_ENCODE
|报错，提示正确|
|单语句中作为函数使用|参数校验|- 参数个数为1个
- 输入为合法的十六进制数据，中英文数字（  0-9、a-f、A-F  ）
- 小于等于最大限制的数据（8000字节）
- 插入字符串的字节长度等于小于RAW列宽度的2倍
|覆盖常量和列值|- 参数个数为0个，2个
- 不合法的十六进制数
- 中文，韩文，其他特殊语言，表情包等
- null，  空字符串（''），空格串'  '
- 特殊字符、不可见字符；
- 长度超过最大限制数据（8000字节）
- 插入字符串的字节长度超过RAW列宽度的2倍
|报错，提示正确|
|  
|参数类型|- 入参为raw类型，长度覆盖raw(1),raw(2000),raw(8000)
- 入参为其他能隐式转换到raw的类型（BLOB/ROWID/UROWID/字符型）
- 显式转换到raw的类型（CAST、TO_CHAR）
- 字符型特别是char、nchar，插入长度需等于定义长度
|覆盖常量和列值|- 其他数据类型（日期型、大对象型（clob、nclob）、boolean、  json  、xmltype）
- 插入数据长度小于char、nchar定义长度
|报错，提示正确|
|  
|函数功能|1. 函数自嵌套127层（  BASE64_ENCODE、BASE64_DECODE单独嵌套、混合嵌套  ）
,  
,  
|  
|嵌套大于127层,  
|  
|
|  
|  
|2.返回类型与长度：,- 采用typeof()查看返回值  （函数返回值类型固定为raw  ）
,- 长度length\lengthb  （  长度部分按转换后实际字符长度计算？？create view返回为最大8000  ）
|2.返回类型和长度在全篇测试点中均需要注意，不单独测试了|  
|  
|
|  
|  
|3.与其他函数嵌套,- 普通函数：coalesce、instr/instrb，  substr/substrb/substring  、ifnull、nullif、trim、ltrm，rtrim，nlssort、nvl/nvl2等
- 聚合函数：  wm_concat、concat、string_agg、group_concat、  listagg等（注意拼接长度！！）
- 窗口函数：DENSE_RANK、FIRST_VALUE、LAST_VALUE、lag、lead、rank、ROW_NUMBER、LISTAGG等
|  
|函数拼接超过    `32000`  |  
|
|  
|  
|4.与其他高级包嵌套,1）DBMS_LOB：compare、get_length\getlength、SUB_STR\SUBSTR等|  
|  
|  
|
|  
|dql|作为select投影列，单列，多列，4096列|  
|  
|  
|
|  
|  
|select 语句中带有order by、where、limit、in/not in、exists/not exists、like/not like、between and、case when、destinct等|  
|  
|  
|
|  
|  
|结合  any/all/some/is null/is not null等子查询|  
|  
|  
|
|  
|  
|结合group by分组(聚合函数和窗口函数)|  
|  
|  
|
|  
|  
|单表查询、多表关联查询、子查询的filter、投影|  
|  
|  
|
|  
|dml|update作为set值以及where条件|  
|  
|  
|
|  
|  
|insert作为value值，  insert values中带子查询，子查询调用该函数|  
|  
|  
|
|  
|  
|insert into select|  
|  
|  
|
|  
|  
|delete 作为where条件|  
|  
|  
|
|  
|ddl|create table/view as select  utl_encode.base64_encode|跟普通表和分区表应该没关系，可挑选穿插一个分区表和临时表|- create table/view时作为列的default值
- alter时作为列的default值 【alter...add column...】
|？？待确认|
|  
|  
|  
|  
|  
|  
|
|plsql中使用|  
|单独使用编码及解码，覆盖（不）  指定参数'=>'|  
|  
|  
|
|  
|匿名块|- 匿名块调用高级包和其他plsql（其他plsql中也调用高级包）
- exception调用UTL_ENCODE.BASE64_ENCODE 高级包
- for循环里面调用UTL_ENCODE.BASE64_ENCODE 高级包
|BASE64_DECODE同理|  
|  
|
|  
|自定义函数|- case xx when（多个），部分when调用BASE64_ENCODE 高级包，部分不调用；构造数据匹配when条件
- if 分支，else分支调用BASE64_ENCODE 高级包（  需要构造匹配if，匹配else的场景  ）
- while分支调用BASE64_ENCODE 高级包
- return BASE64_ENCODE 高级包
- exception调用BASE64_ENCODE 高级包
|  
|  
|  
|
|  
|存储过程|- insert into table values 调用高级包
- update set赋值给指定列时指定BASE64_ENCODE 高级包
- loop分支调用BASE64_ENCODE 
- exception分支调用BASE64_ENCODE 高级包
|  
|  
|  
|
|  
|自定义高级包|- head中调用BASE64_ENCODE ，body中不调用
- head中不调用，body中调用
- head、body中同时调用
- package中调用存储过程，存储过程调用自定义函数，自定义函数中调用高级包，同时package也调用高级包
|  
|  
|  
|
|  
|job|- DBMS_JOB.SUBMIT创建job，  执行的PL/SQL文本  指定调用含高级包的 plsql，触发job运行
|  
|  
|  
|
|  
|调用次数|- 调用1次
- 连续调用多次（可以通过for循环实现）
|  
|  
|  
|
|  
|  
|  
|  
|  
|  
|
|绑定参数|plsql|- insert into table values值
- select作为where条件
-  update set赋值给指定列时
- delete作为where的限定条件
- group by 、order by
|编写参考：    [guider 编写绑定参数用例](https://conf.yasdb.com/pages/viewpage.action?pageId=133566807)  ,  
|  
|  
|
|  
|jdbc|- 绑定变量（覆盖上述测试点）
- 批量绑定
|  
|  
|  
|
|权限|/|- 暂不涉及
|  
|  
|  
|


  


1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|KT|是|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR|  
|
|HA|  
|
|压力|  
|
|性能|  
|
|可维护性|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


文本用例：

# 5. 测试框架设计

1. 功能测试guider框架已满足
1. ct/kt，testkill框架可满足


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：10  *人天*

计划测试完成时间：2024.04.23

## Attachments:

[image2023-12-7_14-39-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYjBhMWFkOWEzMzExZGM4YzQ2IiwicmVmX2lkIjoiNjczOTZjYWY1OTNmOTljOWZmMjM3MWVmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyNzA5LCJleHAiOjE3ODIzODkxMDl9.-hIz1Mk0JinAN2hFU_xvWzF8Eu3DCs5US34AeDxCxcY)

 (image/png)    


[image2024-4-10_11-26-16.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYjA4OTcwYzJhZjRmNTIwZGQ3IiwicmVmX2lkIjoiNjczOTZjYWY1OTNmOTljOWZmMjM3MWVmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyNzA5LCJleHAiOjE3ODIzODkxMDl9.VEpK1kTzf2HvwEBZRNj2eEph4eVUdw52TIRnA46gITw)

 (image/png)    


[支持utl_encode系统包文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYjA4OTcwYzJhZjRmNTIwZGQ4IiwicmVmX2lkIjoiNjczOTZjYWY1OTNmOTljOWZmMjM3MWVmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyNzA5LCJleHAiOjE3ODIzODkxMDl9.NDFeqJiU2wK6Luykj0NWK4TQ8wJs9g7tNSWbxyJcfMc)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[支持utl_encode系统包文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYjBhMWFkOWEzMzExZGM4YzQ5IiwicmVmX2lkIjoiNjczOTZjYWY1OTNmOTljOWZmMjM3MWVmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyNzA5LCJleHAiOjE3ODIzODkxMDl9.Y3FCgszw9CnxG-XCud7svbQALCaNw4MdzhMZLRceROU)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,会议纪要,参与人：孟麟、谭思宇、李坤宇、徐瑶    
  评审时间：2024年4月10日 16：00    
  评审地点：25座702会议    
  会议主题：YDBRD-18476 支持UTL_ENCODE内置系统包测试设计评审,会议纪要信息：    
  1、该高级包函数能否作为列的默认值    
  2、列存是否支持以执行计划为准，列执行不支持    
  3、json数据按blob存储，能否转换到raw    
  4、raw作为列值最大长度为8000bytes，运算上限为32000    
  5、出参返回类型为raw、长度以转换后实际长度为准，create view返回长度为最大8000,评审结论：通过,Posted by xuyao at 四月 10, 2024 17:00|
|---|
|  [](null)  ,UTL_ENCODE函数补测：    
,![](https://pingcode.yasdb.com/atlas/files/public/67396cb0a1ad9a3311dc8c4c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ1FBQUFBQUFBRUFBQUFBQUFBRUFBQUFBQUFBUUFBQUFRQUFDQUFBQUFBQUFBQUFBQUFBQUVBUUFBQUFBQVNBQUFBQUFBSUFFQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUlBQUFBSUFBQUFBQUFnQUJBQUFBQUFFQUFBQUFBQUFBQUFBQUVnQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUNBQUFBZ2dBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDI3MDksImV4cCI6MTc4MjMxMzUwOX0.shPQGt340KMAha84uGvEVfDZwMCbxNlfuycfsYGu7zo),utl_raw_guosen.sql,**1.base64_decode函数解析含有换行符的数据**,- 回车，ASCII码13，"\r"
- 换行，ASCII码10，"\n"
- 空格，ASCII码32
,**2.与utl_raw.cast_to_raw结合的**,utl_raw高级包：  对RAW数据进行操作以及对RAW和number类型及CHAR数据类型间的转换,Posted by xuyao at 十月 18, 2024 10:10|
|CAST_TO_RAW|Converts a VARCHAR2 value into a RAW value |将VARCHAR2值转换为RAW值|UTL_RAW.CAST_TO_RAW (    
  c IN VARCHAR2)    
  RETURN RAW;|- NULL:输入null返回null
|
|CAST_TO_VARCHAR2|Converts a RAW value into a VARCHAR2 value |将 RAW 值转换为VARCHAR2值|UTL_RAW.CAST_TO_VARCHAR2 (    
  r IN RAW)    
  RETURN VARCHAR2;|- NULL:输入null返回null
|


|CAST_TO_RAW|Converts a VARCHAR2 value into a RAW value |将VARCHAR2值转换为RAW值|UTL_RAW.CAST_TO_RAW (    
  c IN VARCHAR2)    
  RETURN RAW;|- NULL:输入null返回null
|
|:---|:---|:---|:---|:---|
|CAST_TO_VARCHAR2|Converts a RAW value into a VARCHAR2 value |将 RAW 值转换为VARCHAR2值|UTL_RAW.CAST_TO_VARCHAR2 (    
  r IN RAW)    
  RETURN VARCHAR2;|- NULL:输入null返回null
|
