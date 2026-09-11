Created by 贺天欢, last modified by  徐瑶 on 一月 04, 2024

#   [YDBRD-22119](https://jira.yasdb.com/browse/YDBRD-22119?src=confmacro)    **-**  **支持NLS_DATABASE_PARAMETERS视图**  **完成**    [YDBRD-22118](https://jira.yasdb.com/browse/YDBRD-22118?src=confmacro)    **-**  **支持 nls_numeric_characters功能**  **完成**

# 1.   **概述**

场 景：    
  1、对接zabbix server和web监控系统    
    
  需求描述：    
  支持设置nls_numeric_characters功能，zabbix-server有用到但是yasdb不支持的语句，设置数值和字符串转换时的小数点符号和组分割符号（千，百万，十亿。。），同时需要支持NLS_DATABASE_PARAMETERS视图    
  alter session/system set nls_numeric_characters='. '（里面是点号和空格）    
    
  需求范围：    
  单机    
    
  需求规格：    
  1）nls_numeric_characters只做'. '和'.,'，即小数点保持为'.'，千分位为' '和',' 两种情况，    
  2）按配置情况，number合法字符串确保to_char和to_number入参和打印支持    
  3) 支持NLS_DATABASE_PARAMETERS视图

# 2.   **需求分析**

## 2.1涉及语法

ALTER system SET NLS_NUMERIC_CHARACTERS = '. ' scope = spfile ;（重启生效）

ALTER SESSION SET NLS_NUMERIC_CHARACTERS = '.,';

SELECT * FROM NLS_DATABASE_PARAMETERS;

SELECT * FROM NLS_SESSION_PARAMETERS;

## 2.2开发设计的主要原理

2.1.1  nls_numeric_characters参数

a.添加配置参数    
  新增nls_numeric_characters参数    
  添加set和get回调函数

b.to_char/to_number修改数据结构，并实现千分位分隔符

- 在DigitFmt结构体上新增decimalCharacter变量，用于记录decimal character的值，默认为'.'
- 新增groupSeparator变量，用于记录group separator的值，默认为','
- 当使用'.'和','格式符时，即使用默认的字符；当使用'D'和'G'格式符时，即使用设置的字符（若没设置则为默认字符）
- 根据千分位符的位置信息groupSeparatorMap，校验输入Text是否合法，若不合法则报错
- 移除所有千分位符，以便asciiTextAsNumber将Text转为Number


2.1.2NLS_DATABASE_PARAMETERS和NLS_SESSION_PARAMETERS视图

\dbr\dbcr目录下添加nls_views.sql    
  分别创建NLS_DATABASE_PARAMETERS和NLS_SESSION_PARAMETERS视图    
  赋予视图对应权限  （对于动态视图权限，22.2没做权限控制，无dba权限用户可以查询，而23.2则需要授权，无dba权限无法查询）

其他的功能点和规格约束见测试概要设计

# 3.   **测试设计方法**

主要采用的等价类法，边界值  ，场景法组合进行设计

列出所有的参数种类，划分有效等价类和无效等价类，该方法中会穿插使用边界值法。无效等价类单独进行测试

# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|---|---|
|并发|参数配置并发测试；,视图查询并发测试；|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR/testkill|不涉及|
|HA|不涉及|
|压力|不涉及|
|性能|不涉及|
|可维护性|不涉及|


  


  


# 5.   **测试用例**

测试设计细化后的文本用例

# 6.   **测试框架设计**

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


# 7.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

  


ps。用例属性表

## Attachments:

[nls_numeric_characters和NLS_DATABASE_PARAMETERS测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiODlhMWFkOWEzMzExZGM4M2JlIiwicmVmX2lkIjoiNjczOTZiODk3MjgyMDZlZmI5MmYwNzNiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1MzI1LCJleHAiOjE3ODIzODE3MjV9.Fk96LER9suROgZ7B4BSeMeHytIfLMfKE2TaIXsDUYxo)

 (application/x-xmind)    


[nls_numeric_characters和NLS_DATABASE_PARAMETERS文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiODlhMWFkOWEzMzExZGM4M2JmIiwicmVmX2lkIjoiNjczOTZiODk3MjgyMDZlZmI5MmYwNzNiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1MzI1LCJleHAiOjE3ODIzODE3MjV9.N-1HbUBd3na4zgTIBwXNQbuj7-p-bFJOP6iCMg9odkE)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[用例属性表-hth.csv](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiODk4OTcwYzJhZjRmNTIwNTQ4IiwicmVmX2lkIjoiNjczOTZiODk3MjgyMDZlZmI5MmYwNzNiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1MzI1LCJleHAiOjE3ODIzODE3MjV9.Y36q3blu0HmElYGMiTkyVTI1N1WDUaIwPsED73QNk_A)

 (text/csv)    


## Comments:

|  [](null)  ,  [配置参数测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=76929337)  ,Posted by hetianhuan at 十月 31, 2023 16:12|
|---|
