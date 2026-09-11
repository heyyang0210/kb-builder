Created by 张欣, last modified on 十月 14, 2024

# 1.   **概述**

  [YDBRD-14378](https://jira.yasdb.com/browse/YDBRD-14378?src=confmacro)    -  dba_/all_/user_tab_columns视图增加char_length字段  完成

研发文档

# 2.   **需求分析**

该特性是在dba_tab_cols/dba_tab_colums、all_tab_cols/all_tab_colums、user_tab_cols/user_tab_colums视图上添加char_length字段，描述列定义的字符长度信息。

字符型数据类型 【char(n)/char(n char)/varchar(n)/varchar(n char)/nchar(n)/nvarchar(n)】包含UDT展开列是这些数据类型的，char_length = n

其他的非字符数据类型，包含UDT类型，char_length = 0。

覆盖heap,lsc，tac 3种表类型。

|列定义|char_length字段|data_length字段（与char_length字段区分）（字符集编码为UTF8，国家字符集编码为UTF16）|备注|
|---|---|---|---|
|char(n)|n|n|  
|
|char(n char)|n|4 * n  （最大32000）|  
|
|varchar(n)|n|n|  
|
|varchar(n char)|n|4 * n（最大32000）|  
|
|nchar(n)|n|2 * n（最大32000）|现版本未支持，但是对应需求已在开发阶段，可以添加用例预埋|
|nvarchar(n)|n|2 * n（最大32000）|现版本未支持，但是对应需求已在开发阶段，可以添加用例预埋|


# 3.   **测试设计方法**

本测试设计使用等价类划分法。主要是覆盖上述预期char_length字段为n的几类数据类型，以及此范围外的类型。

|char_length = n|char_length = 0|
|---|---|
|char(n)/char(n char)/varchar(n)/varchar(n char)/nchar(n)/nvarchar(n)|数值型:TINYINT、SMALLINT、INT/INTEGER、BIGINT、NUMBER、FLOAT、DOUBLE、BIT    
  时间日期:DATE、TIME、TIMESTAMP、INTERVAL YEAR TO MONTH、INTERVAL DAY TO SECOND    
  bool    
  lob    
  clob    
  blob    
  nclob      
  ROWID/UROWID    
  RAW    
  JSON,UDT:object,varray,nested table|


# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

本需求场景比较简单。各数据类型在表列中使用时，  视图上添加char_length字段，描述列定义的字符长度信息。

1.测试方法：建表，表列覆盖各类数据类型，检查  dba_tab_cols/dba_tab_colums、all_tab_cols/all_tab_colums、user_tab_cols/user_tab_colums视图char_length字段字段的值是否符合预期。同时对于新增类型（char(n char)，varchar(n char)），也关注下data_length字段的正确性。

2.特殊的，nchar(n)，nvarchar(n) 当前版本还不支持，后续迭代将合入支持，所以先预留用例，避免之后遗漏。

3.对于UDT类型，要关注object 做表列会有展开列，如果objectde 成员属性是  【char(n)/char(n char)/varchar(n)/varchar(n char)/nchar(n)/nvarchar(n)】 则对应的展开列，预期char_length字段为n;非上述类型，展开列，预期char_length字段为0

2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|/|
|长稳|/|
|一致性|/|
|三方测试工具    
  (sqltest，sqlancer)|/|
|安全|/|
|DFR/testkill|/|
|HA|/|
|压力|/|
|性能|/|
|可维护性|/|


# 5.   **测试用例**

测试设计细化后的文本用例

详见附件

# 6.   **测试框架设计**

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


# 7.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

## Attachments:

[视图增加char_length字段.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTY4OTcwYzJhZjRmNTFmOTM5IiwicmVmX2lkIjoiNjczOTY5OTY1OTNmOTljOWZmMjM1MDU3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NTQyLCJleHAiOjE3ODIyOTM5NDJ9.dHEEeGiTCnGqgF7aP3BN53EUjTf_A018w0uhJDVqJto)

 (application/x-xmind)    
