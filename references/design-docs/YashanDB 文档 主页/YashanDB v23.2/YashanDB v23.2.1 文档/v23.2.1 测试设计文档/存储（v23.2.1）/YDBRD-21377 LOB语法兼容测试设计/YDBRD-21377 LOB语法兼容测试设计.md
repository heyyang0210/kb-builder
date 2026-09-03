Created by 卢凯舜, last modified on 十一月 07, 2023

# 1. 概述

ORACLE的DDL语法LOB STORE AS SECUREFILE语法兼容

# 2. 需求分析

(1)SR链接：    [YDBRD-21377](https://jira.yasdb.com/browse/YDBRD-21377?src=confmacro)    -  兼容oracle LOB STORE AS SECUREFILE语法  完成

(2)开发文档：    [YDBRD-21377 LOB语法兼容设计文档 - 张志鹏 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133564631)  

(3)语法：

syntax::= LOB "("(column) {"," (column)} ")" STORE AS [BASICFILE|SECUREFILE]    
  "("    
  (    
  TABLESPACE space_name    
  |(ENABLE|DISABLE) STORAGE IN ROW    
  **| CHUNK integer**    
  **| {CACHE | NOCACHE | CACHE READS }**    
  **| {LOGING | NOLOGING}**    
  **| {(COMPRESS (LOW|MEDIUM|HIGH))|NOCOMPRESS}**    
  **| {DEDUPLICATE|KEEP_DUPLICATES}**    
  )    
  ")"

(4)支持范围

部署形态：单机/集群

表类型：heap/tac/lsc

(5)规格限制

1. chunk interger interger的范围是(0,32K], 2, 32768, 1k, 32K
1. store as lob_segment_name是否语法不兼容，如 lob(a) store as (parameters)
1. 二级分区不能指定lob_parameters，支持tablespace
1. 分区表的lob分区子句的tablespace不校验


# 3. 测试设计方法 

对本测试设计使用的工程方法做说明，如常用的边界值，等价类，流程图及相关的组合策略

   1.基本语法验证 采用场景法 + 正交实验法，针对语法图的新增部分进行分支覆盖

 2.无相关视图变更

# 4. 详细测试设计    

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

支持范围

  


语法校验

|输入条件||有效等价类|编号|无效等价类|编号|
|:---|---|:---|:---|:---|:---|
|[BASICFILE|SECUREFILE]|  
|正确字段输入|  
|字段拼写错误|  
|
|  
|  
|字段缺失|  
|字段重复|  
|
|  
|  
|字段大小写|  
|  
|  
|
|CHUNK integer|  
|正确字段输入|  
|字段拼写错误|  
|
|  
|  
|字段缺失|  
|字段重复|  
|
|  
|  
|字段大小写|  
|  
|  
|
|  
| integer值|取值范围(0,32K]|  
|小数，0，负数|  
|
|  
|  
|1到32768或者32k，边界值|  
|超过边界值|  
|
|  
|  
|  
|  
|其他字符，特殊字符|  
|
|CACHE | NOCACHE | CACHE READS [LOGING | NOLOGING]|  
|正确字段输入|  
|字段拼写错误|  
|
|  
|  
|字段缺失|  
|字段重复|  
|
|  
|  
|字段大小写|  
|  
|  
|
|  
|[LOGING | NOLOGING]|  
|  
|不接在cache后|  
|
|(COMPRESS (LOW|MEDIUM|HIGH))|NOCOMPRESS|  
|正确字段输入|  
|字段拼写错误|  
|
|  
|  
|字段缺失|  
|字段重复|  
|
|  
|  
|字段大小写|  
|  
|  
|
|  
|  
|指定/不指定LOW|MEDIUM|HIGH|  
|  
|  
|
|DEDUPLICATE|KEEP_DUPLICATES|  
|正确字段输入|  
|字段拼写错误|  
|
|  
|  
|字段缺失|  
|字段重复|  
|
|  
|  
|字段大小写|  
|  
|  
|
|多个lob_clause|  
|  
|  
|  
|  
|
|语法图字段顺序改变|  
|  
|  
|  
|  
|
|使用多个字段|  
|  
|  
|  
|  
|
|alter table 增加lob列指定参数|  
|  
|  
|  
|  
|


场景测试

|序号|测试场景||预期|备注|
|:---:|:---:|---|:---:|:---:|
|  
|分区表带  lob_parameters clause|list，range，interval|创建成功|  
|
|  
|  
|hash分区不适配|创建失败|  
|
|  
|二级分区指定  lob store as(tablespace ts)|只指定  tablespace |创建成功|  
|
|  
|  
|添加其他字段|创建失败|  
|
|  
|  
|tablespace不存在|创建成功|  
|
|  
|使用指定语法后进行dml|  
|dml执行正常，不受影响|  
|
|  
|使用指定语法后进行ddl|drop，alter，truncate|ddl执行正常，不受影响|  
|
|  
|元数据导入导出场景|  
|  
|  
|
|  
|并发场景|并发创建|  
|  
|
|  
|  
|并发创建+ddl+dml|  
|  
|
|  
|ha场景|  
|  
|  
|


2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR/testkill|是|
|HA|  
|
|压力|否|
|性能|  
|
|可维护性|否|


  


# 5. 测试用例

文本用例

[YDBRD-21377 LOB语法兼容文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTM4OTcwYzJhZjRmNTIwN2NkIiwicmVmX2lkIjoiNjczOTZiZTM1OTNmOTljOWZmMjM2N2U4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTg0LCJleHAiOjE3ODIzODM5ODR9.eQ5akAdg9bKNGCYpfdsAZgH5XISDnrhzESleYcZ-pE0)

# 6. 测试框架设计

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


# 7. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[YDBRD-21377 LOB语法兼容文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTM4OTcwYzJhZjRmNTIwN2NkIiwicmVmX2lkIjoiNjczOTZiZTM1OTNmOTljOWZmMjM2N2U4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTg0LCJleHAiOjE3ODIzODM5ODR9.eQ5akAdg9bKNGCYpfdsAZgH5XISDnrhzESleYcZ-pE0)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
