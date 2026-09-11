Created by 徐伟, last modified on 四月 11, 2024

*详细设计-YDBRD-2815: to_char的date_format支持[yyyy-mm-dd]格式设计方案*

* IR链接：YASHAN-2815*

*SR链接：YDBRD-26045*

##   [1. 总述](#1-总述)  

时间类型格式符中支持'[]'格式符，中括号包括左中括号跟右中括号两个，该分隔符不需要严格匹配，对称出现；这两个会作为普通分隔符被用作于时间类型与字符串的转换匹配上。

###   [1.1 需求来源](#11-需求来源)  

原始的客户需求描述。关注需求的来源、规格、合理性，要用明确的语言描述，不能模棱两可。要把客户的业务场景描述清楚，知道客户希望怎么用，而且除了功能特性要求，也要尽可能了解非功能特性要求，例如性能、安全等。

该需求来源于客户： 国信证券/融选适配。客户场景未to_char中支持中括号输出，对应语句场景为：

```
select to_char(sysdate, '[yyyymmdd]') from dual;
select to_char(sysdate, '[yyyy/mm/dd]') from dual;
select to_char(sysdate, '[yyyy-mm-dd]') from dual;

```

###   [1.2 调研文档](#12-调研文档)  

###   [1.3 需求分析](#13-需求分析)  

需求实现只需往格式符数组中注册两个分隔符，在string2DateTime，DateTime2String处适配分隔符的显示与匹配即可。    
  增加后有如下场景会同步支持：

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|字符串转时间类型|把中括号注册进分隔符数组，按分隔符匹配规格即可|是|是|
|功能|时间类型转字符串|添加中括号枚举，并在枚举处输出中括号格式符|是|是|
|功能|set date_format|中括号加入格式符数值后天然支持|是|是|
|性能|性能场景1|该场景下关键性能指标通过什么方案满足|是/否|是/否|
|可用性|恢复场景|----|是/否|是/否|
|可靠性|故障场景|----|是/否|是/否|
|可维可测|DFX功能1|----|是/否|是/否|
|安全|安全场景1|----|是/否|是/否|
|易用性|----|----|是/否|是/否|
|可修改性|----|----|是/否|是/否|
|兼容性|----|----|是/否|是/否|
|周边配合|权限|----|----|是/否|
|周边配合|审计|----|----|是/否|
|周边配合|导入导出工具|----|----|是/否|


###   [1.4 数据字典](#14-数据字典)  

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|语法分支1描述|----|是/否|
|SQL语法|语法分支2描述|----|是/否|
|函数|参数/返回值描述|----|是/否|
|高级包|高级包子对象描述|----|是/否|
|系统视图|视图域段描述|----|是/否|
|动态视图|视图域段描述|----|是/否|
|配置参数|配置参数作用、生效方式|----|是/否|
|驱动接口|驱动对外提供接口描述|----|是/否|
|错误码|错误码、ACTION描述|----|是/否|
|告警|告警描述|----|是/否|
|日志|日志触发条件、等级、事件描述|----|是/否|


##   [3. 规格与约束](#3-规格与约束)  

##   [4. 特性](#4-特性)  

###   [4.1 特性设计](#41-特性设计)  

1、alter session set date_format: 将'[]'加入date_format数组后即可天然支持

2、时间类型转字符串：增加中括号枚举，根据[]输出对应左中括号跟右中括号

3、字符串转时间类型：将中括号加入分隔符中，匹配规格跟其他分隔符一致。

###   [4.2 特性功能点2](#42-特性功能点2)  

###   [4.3 特性性能点1](#43-特性性能点1)  

###   [4.4 特性性能点2](#44-特性性能点2)  

###   [4.5 特性可维可测设计](#45-特性可维可测设计)  

###   [4.6 特性安全设计](#46-特性安全设计)  

###   [4.7 特性周边配合](#47-特性周边配合)  

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

```

alter session set date_format='yyyy[mm]dd';
select to_date('20121021') from sys.dual;
select to_date('2022/2[3') from sys.dual;
select to_date('2024]09[15') from sys.dual;
select to_date('2024-09[15]') from sys.dual;
select to_date('[2024]09[15') from sys.dual;

alter session set date_format='[yyyymmdd]';
select to_date('20121021') from sys.dual;
select to_date('[20121021]') from sys.dual;
select to_date('[20121021') from sys.dual;
select to_date('  [20121021') from sys.dual;
select to_date('20121021]') from sys.dual;
select to_date('20121021]  ') from sys.dual;

select to_date('-[20121021]') from sys.dual;
select to_date('[20121021//') from sys.dual;
select to_date(' -[20121021') from sys.dual;
select to_date('2022/2[3') from sys.dual;
select to_date('2024]09[15') from sys.dual;
select to_date('2024-09[15]') from sys.dual;
select to_date('[2024]09[15') from sys.dual;

select to_date('[20240915]','[yyyymmdd]') from sys.dual;
select to_date('[20240915]','[yyyy/mm/dd]') from sys.dual;
select to_date('[20240915]','[yyyy-mm-dd]') from sys.dual;
select to_date('-20240915/','[yyyymmdd]') from sys.dual;
select to_date('[2024-09-15]','[yyyy/mm/dd]') from sys.dual;
select to_date('2024-09-15','[yyyy/mm/dd]') from sys.dual;
select to_date('20240915','[yyyy-mm-dd]') from sys.dual;

select to_char(date'20240915','[yyyymmdd]') from sys.dual;
select to_char(date'2024-9-15','[yyyy/mm/dd]') from sys.dual;
select to_char(date'2024/9/15','[yyyy-mm-dd]') from sys.dual;
select to_char(date'2024-9-15','[yyyy][mmdd]') from sys.dual;
select to_char(date'2024-9-15','[yyyy/]mm/dd]') from sys.dual;
select to_char(date'2024-9-15','[yyyy]/mm/[dd]') from sys.dual;
select to_char(date'2024-9-15','[yyyy]-mm-[dd]') from sys.dual;
select to_char(date'2024-9-15','[[yyyy/mm/dd]]') from sys.dual;
select to_char(date'2024/9/15','[]yyyy-mm-dd[]') from sys.dual;
select to_char(date'2024-9-15','[]]yyyymmdd]]]') from sys.dual;
select to_char(date'2024-9-15','[[[[yyyy/mm/dd]]') from sys.dual;
select to_char(date'2024-9-15','[yyyy]]]/mm/[[[dd]') from sys.dual;
select to_char(date'2024-9-15','[yyyy[-]mm]-[dd]') from sys.dual;



```

##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

[image2023-6-2_15-22-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYzJhMWFkOWEzMzExZGM4Y2EyIiwicmVmX2lkIjoiNjczOTZjYzI3MjgyMDZlZmI5MmYxNjc3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMjcxLCJleHAiOjE3ODIzODk2NzF9.d2QfLieTAQULzhEF-n14jJjJwFt-hK1o2jw7EHNuRvI)

 (image/png)    
