Created by 赵忠源, last modified on 二月 29, 2024

  


#   [YDBRD-18924 : Instrb Design](#ydbrd-18924--instrb-design)  

IR链接：    [https://jira.yasdb.com/browse/YDBRD-18924](https://jira.yasdb.com/browse/YDBRD-18924)      
  SR链接：    [https://jira.yasdb.com/browse/YDBRD-18932](https://jira.yasdb.com/browse/YDBRD-18932)  

##   [1. Overview（概述）](#1-overview概述)  

实现instrb函数，支持按字节字符串匹配，完全兼容oracle功能。

需要返回特定位置的字节，需求场景为单机行表

Instrb调研文档    [https://conf.yasdb.com/pages/viewpage.action?pageId=122070586](https://conf.yasdb.com/pages/viewpage.action?pageId=122070586)  

##   [2. Features（功能特性）](#2-features功能特性)  

###   [2.1 基础语法](#21-基础语法)  

![](https://docs.oracle.com/cd/B19306_01/server.102/b14200/img/instr.gif?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg5MDEsImV4cCI6MTc4MjMwOTcwMX0.xL_ttsoeW3ucumU5vbvM0V87V9WkIXtKZmROW_wjxdk)

INSTRB(string , substring [, position [, occurrence ] ])

##   [2.2 功能概述](#22-功能概述)  

INSTRB函数，在string中的position位置开始查找substring，并返回第occurrence次出现的位置。

string起始位置记为第1位，返回值为匹配到的substring的第1位字节的位置,  **未命中返回0**

string和substring不可为空

position和occurrence可为空，两个参数的默认值为1。

position必须是非0参数，如果是负数，就从后向前匹配。

occurrence必须大于零。

小数情况直接取整

##   [3. Interfaces（接口）](#3-interfaces接口)  

```
CodResult bifVerifyInstrb(AnlVerifier* vrfr, ExprNode* node);  

CodResult bifExecInstrb(AnlStmt* stmt, ExprNode* func, Variant* retValue);  

CodResult bifConcludeInstrb(AnlStmt* stmt, ExprNode* node, TypeDesc* retType);  

```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

###   [4.1 参数规格](#41-参数规格)  

**String和Substring**    
  支持INT,FLOAT,NUMBER，SMALLINT，BIGINT等数值类型，本质为转换为数字对应的字符串做匹配

支持char/varchar2/date/timestamp,NCHAR,NVARCHAR2等字符串或能转换成字符串类型，支持CLOB,NCLOB.但不支持多字节字符集

**Position和Occurence**    
  支持INT,FLOAT,NUMBER，SMALLINT，BIGINT等数值类型

支持char/varchar2/NCHAR,NVARCHAR2等字符串能转换成数值类型

数值为小数时，number类型向下取整，浮点类型时，函数将其奇进偶舍至整数。

|  
|INT|FLOAT|DOUBLE|NUMBER|SMALLINT|BIGINT|CHAR|VARCHAR|NCHAR|NVARCHAR|CLOB|NCLOB|date|time|timestamp|bit|raw|boolean|json|
|:---:|:---:|:---:|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
|**String**|**√**|**√**|**√**|**√**|**√**|**√**|**√**|**√**|**√**|**√**|**√**,**（不支持多字节字符集）**|**√**,**（不支持多字节字符集）**|**√**|**√**|**√**|**√**|**√**|**√**|**√**|
|**Substring**|**√**|**√**|**√**|**√**|**√**|**√**|**√**|**√**|**√**|**√**|**√**,**（不支持多字节字符集）**|**√**,**（不支持多字节字符集）**|**√**|**√**|**√**|**√**|**√**|**√**|**√**|
|**Position**|**√**|**√**|**√**|**√**|**√**|**√**|**√**,**(可转数值)**|**√**,**(可转数值)**|**√**,**(可转数值)**|**√**,**(可转数值)**|**×**|**×**|**×**|**×**|**×**|**√**|x|**√**|x|
|**Occurence**|**√**|**√**|**√**|**√**|**√**|**√**|**√**,**(可转数值)**|**√**,**(可转数值)**|**√**,**(可转数值)**|**√**,**(可转数值)**|**×**|**×**|**×**|**×**|**×**|**√**|x|**√**|x|


NCHAR/NVARCHAR和CHAR/VARCHAR 都可进行匹配，匹配结果按String所属字符集进行计算

###   [4.2 Limitations（功能限制）](#42-limitations功能限制)  

1.不支持多字符数据集下的CLOB和NCLOB（oracle）

yasdb目前的instr也不支持CLOB和NCLOB，需同时修改

2.position和occurrence 输入规格默认为INT64，oracle里为NUMBER

但yasdb字符串长度只支持到CodUInt32精度（length类型限制）。

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Data Structures & Flow（数据结构与流程）](#51-data-structures--flow数据结构与流程)  

算法本质是对原字符串和目标字符串按字节做匹配搜索，从position位开始搜索目标字符串位置

若pos>0,则直接通过kmp算法/直接匹配对字符串位置进行匹配

若pos<0,则从倒数第abs(pos)位开始，从右往左进行搜索。

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

见附件    [https://conf.yasdb.com/pages/viewpage.action?pageId=127637262](https://conf.yasdb.com/pages/viewpage.action?pageId=127637262)  

##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

[image2023-8-29_11-29-35.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMGZhMWFkOWEzMzExZGM4NzY5IiwicmVmX2lkIjoiNjczOTZjMGY3MjgyMDZlZmI5MmYwZDFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4OTAxLCJleHAiOjE3ODIzODUzMDF9.HOZJpaIXX-lmwQ1oIZ5ikq-piNtLcP9I99sLU5kRQR8)

 (image/png)    


[image2023-8-29_11-31-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMGY4OTcwYzJhZjRmNTIwOGY5IiwicmVmX2lkIjoiNjczOTZjMGY3MjgyMDZlZmI5MmYwZDFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4OTAxLCJleHAiOjE3ODIzODUzMDF9.UVGJCes034wbDX7fy0zQ-ptYgucbZTjHAEpza4z0DKs)

 (image/png)    


[image2023-8-29_11-32-9.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMGY4OTcwYzJhZjRmNTIwOGZhIiwicmVmX2lkIjoiNjczOTZjMGY3MjgyMDZlZmI5MmYwZDFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4OTAxLCJleHAiOjE3ODIzODUzMDF9.owFWiwV5bNqsOk9xZAfhHzMq47rXZelbi8GwI5scC2w)

 (image/png)    


[image2023-8-29_11-32-35.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMGZhMWFkOWEzMzExZGM4NzZhIiwicmVmX2lkIjoiNjczOTZjMGY3MjgyMDZlZmI5MmYwZDFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4OTAxLCJleHAiOjE3ODIzODUzMDF9.gd-Fy4DBtTIADUfAd8ovbP7AzbKMO6-SDn13AJTgCpg)

 (image/png)    


[image2023-8-29_11-32-52.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMGZhMWFkOWEzMzExZGM4NzZiIiwicmVmX2lkIjoiNjczOTZjMGY3MjgyMDZlZmI5MmYwZDFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4OTAxLCJleHAiOjE3ODIzODUzMDF9.OzdMdkfxxl3O8Xzcwgy4cGulK6-J6gx6UVvsW6QCEts)

 (image/png)    


[image2023-8-29_11-33-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMGY4OTcwYzJhZjRmNTIwOGZiIiwicmVmX2lkIjoiNjczOTZjMGY3MjgyMDZlZmI5MmYwZDFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4OTAxLCJleHAiOjE3ODIzODUzMDF9.cvRhOE9ua19NBxo16cs4o_AJG0rFd2H3xR2H6ZpqcUU)

 (image/png)    


[image2023-8-29_11-33-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMGY4OTcwYzJhZjRmNTIwOGZkIiwicmVmX2lkIjoiNjczOTZjMGY3MjgyMDZlZmI5MmYwZDFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4OTAxLCJleHAiOjE3ODIzODUzMDF9.uOziC_F3xITz143cvAuIJ4jXaO-EO2-vkQW76LG8tbw)

 (image/png)    


[image2023-8-29_11-33-51.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMGZhMWFkOWEzMzExZGM4NzZkIiwicmVmX2lkIjoiNjczOTZjMGY3MjgyMDZlZmI5MmYwZDFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4OTAxLCJleHAiOjE3ODIzODUzMDF9.neVZxOnI1-7yFRonTXwdaVgI2Vl0xf6WbVCQt6f0UpY)

 (image/png)    


[image2023-8-29_11-34-9.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMGZhMWFkOWEzMzExZGM4NzZlIiwicmVmX2lkIjoiNjczOTZjMGY3MjgyMDZlZmI5MmYwZDFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4OTAxLCJleHAiOjE3ODIzODUzMDF9.N_8iAkbRWEkQLsuHtjayE2cCjpCwnHifL1RI_WVfVXk)

 (image/png)    


[image2023-8-29_11-34-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMGY4OTcwYzJhZjRmNTIwOTAwIiwicmVmX2lkIjoiNjczOTZjMGY3MjgyMDZlZmI5MmYwZDFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4OTAxLCJleHAiOjE3ODIzODUzMDF9.p_wzbwCRK1n49b5olEaBkcbciZWRlL-ZmIW2Gq7AwS0)

 (image/png)    


[image2023-8-29_11-35-8.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMGZhMWFkOWEzMzExZGM4NzcxIiwicmVmX2lkIjoiNjczOTZjMGY3MjgyMDZlZmI5MmYwZDFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4OTAxLCJleHAiOjE3ODIzODUzMDF9.BNmy5D41oktWVwbKfGBvc-cbq7d8wuDESoeJAhCLW_g)

 (image/png)    


## Comments:

|  [](null)  ,1.补充所有参数类型支持（RAW,boolean,json,bit等）,2.pos，occ数值超uint32改为报错,3.nchar/nvarchar char/varchar在参数1、2出现时，函数对应表现情况，确定转成什么类型比较,4.多字符集下CLOB/NCLOB，BLOB的支持情况（单字符集是否能支持，三端字符集是什么情况下支持）,Posted by zhaozhongyuan at 八月 31, 2023 14:51|
|---|
