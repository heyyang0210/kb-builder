Created by 陈钦卿, last modified on 七月 29, 2024

# 1. 概述

SR：    [https://pingcode.yasdb.com/pjm/items/669db8b466228b9470758b99](https://pingcode.yasdb.com/pjm/items/669db8b466228b9470758b99)    ?#YDBRD-30552 【yasql】YASQL支持@@功能

开发设计：

交付形态：单机、分布式、集群

# 2. 需求分析

## 2.1 功能点分析

@@调用当前脚本同级目录下的脚本

## 2.2 应用场景

yasql通过@方式执行sql文件

## 2.3 规格约束

  


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


  


|测试场景|测试项|预期|备注|
|:---|:---|:---|:---|
|sql命令行直接输入@@|绝对路径|  
|与@等价|
|  
|相对路径,- @@a.sql
- @@db/a.sql
,相对路径,- @a.sql
- @db/a.sql
|  
|  
|
|  
|路径不存在|  
|  
|
|  
|**文件名中包含@**|  
|  
|
|  
|**路径长度**|  
|  
|
|sql命令行直接输入@|绝对路径|  
|  
|
|  
|相对路径,- @@a.sql
- @@db/a.sql
,相对路径,- @a.sql
- @db/a.sql
|  
|  
|
|  
|路径不存在|  
|  
|
|  
|**文件名中包含@**|  
|  
|
|/data/db/a.sql脚本中输入@@|绝对路径|  
|  
|
|  
|相对路径,1. @@1.sql ---- /data/db/1.sql
1. @@db/1.sql ---- 以当前目录为起点，找到的文件为/data/db/1.sql
|  
|  
|
|  
|路径不存在|  
|  
|
|yasql   …… @@a.sql|绝对路径|  
|  
|
|  
|相对路径,- @@a.sql
- @@db/a.sql
|  
|  
|
|  
|路径不存在|  
|  
|
|  
|/ as sysdba|  
|  
|
|  
|nolog|  
|  
|
|  
|yasql -S|  
|  
|
|yasql   …… @a.sql,a.sql脚本中输入@@|绝对路径|  
|  
|
|  
|相对路径,1. @@1.sql
1. @@db/1.sql
|1.sql与a.sql同级目录1. db与a.sql同级目录
|  
|
|  
|路径不存在|  
|  
|
|  
|/ as sysdba|  
|  
|
|  
|nolog|  
|  
|
|  
|yasql -S|  
|  
|
|多级调用sql脚本|$cat 1.sql,select 1 from dual;,@2.sql,@@3.sql,$ cat 2.sql    
  select 2 from dual;,@@3.sql,$ cat 3.sql    
  select 3 from dual;|- 层数？
- 部分sql文件无执行权限
- 部分sql文件不存在
- 过程中切换用户
|  
|
|分布式CN/DN执行|  
|  
|  
|


|系统级DFX分类|是否涉及|测试点|
|---|---|---|
|CT|  
|  
|
|KT|  
|  
|
|长稳|  
|  
|
|一致性|  
|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|  
|
|安全|  
|  
|
|DFR|  
|  
|
|HA|  
|  
|
|压力|  
|  
|
|性能|  
|  
|
|可维护性|  
|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- guider


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|单机|


# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZDg4OTcwYzJhZjRmNTIxNTc4IiwicmVmX2lkIjoiNjczOTZkZDg1OTNmOTljOWZmMjM4MDI3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyMjE5LCJleHAiOjE3ODIzOTg2MTl9.fTJkuSmXkgzNy0ghCYdmMuKILmRShxvWrWgtBFLpHZU)

## Attachments:

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZDg4OTcwYzJhZjRmNTIxNTc4IiwicmVmX2lkIjoiNjczOTZkZDg1OTNmOTljOWZmMjM4MDI3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyMjE5LCJleHAiOjE3ODIzOTg2MTl9.fTJkuSmXkgzNy0ghCYdmMuKILmRShxvWrWgtBFLpHZU)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZDg4OTcwYzJhZjRmNTIxNTc5IiwicmVmX2lkIjoiNjczOTZkZDg1OTNmOTljOWZmMjM4MDI3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyMjE5LCJleHAiOjE3ODIzOTg2MTl9.9RReVbGMiLxWnRtGQwXIqarlw89VHvTUulUgXSIzwRo)

 (application/msword)    
