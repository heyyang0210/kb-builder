Created by 陈钦卿, last modified on 七月 30, 2024

# 1. 概述

SR：    [https://pingcode.yasdb.com/pjm/items/66a0708366228b9470768f3a](https://pingcode.yasdb.com/pjm/items/66a0708366228b9470768f3a)    ?#YDBRD-30674 【yasql】spool支持正常获取文件名

开发设计：

交付形态：单机、分布式、集群

# 2. 需求分析

## 2.1 功能点分析

### 语法

```
SPO[OLOUT] [file_name[.ext] [CRE[ATE] | REP[LACE] | APP[END]] | OFF | OUT]
```

- file_name：  要保存输出内容的文件名。  您必须在包含空格的文件名两边使用引号。如果未指定扩展，SPOOL 将使用默认扩展（大多数系统上的 LST 或 LIS）。
- CRE[ATE]：使用指定的名称创建一个新文件
- REP[LACE]：替换现有文件的内容。如果该文件不存在，则 REPLACE 将创建该文件。这是默认行为。
- APP[END]：将缓冲区的内容添加到您指定的文件的末尾
- OFF：停止后台打印。
- OUT：停止后台打印并将文件发送到计算机的标准（默认）打印机。此选项在某些操作系统上不可用。


### 新增

spool支持数字开头文件名

## 2.2 应用场景

  


## 2.3 规格约束

  


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


  


|测试场景|测试项|有效等价类|无效等价类|预期|备注|
|:---|:---|---|---|:---|:---|
|关键字格式及功能|- SPO
- SPOOL
- SPOOLOUT ---- 不支持同Oracle
|大小写不敏感|拼写检查|输入不带子句的 SPOOL 以列出当前后台打印状态|  
|
|  
|- file_name
- file_name.ext
|- 数字开头
- 字母/字符开头
- 文件名长度  ----限制255
- 文件名包含空格需使用引号
- 带扩展且用引号包围
- 目录（带/不带斜杠），  最终目录会变为：目录/.lst
- 文件名带路径，（当前路径/data，  相对路径  ：path/1.txt，./1.txt，../1.txt）/data/path/1.txt
|  
|  
|- 默认后缀名：win：LST（大写）     linux：lst（小写）
- 扩展名不会附加到 /dev/null 和 /dev/stderr 等系统文件（spool /dev/null）
- 不校验文件名是否合法
|
|  
|- CRE
- CRE[ATE]
|spool CRE CRE|- 顺序错误：spool CRE filename
- 重复：spool filename CRE CRE
- 文件存在则报错
|创建一个新文件|只报错，不提示用法|
|  
|- REP
- REP[LACE]
|  
|  
|- 替换现有文件的内容，若不存在则创建。
- 默认行为
|  
|
|  
|- APP
- APP[END]
|  
|  
|添加到您指定的文件的末尾|  
|
|  
|- OFF
- OUT
- exit
|  
|  
|停止后台打印|out暂不支持，报错|
|结合set|- set num 20
- set serveroutput on
- set timi[ng] on|off
- set def[ine] on|off
- define
- set hea[ding] on|off
- set feed[back] on|off
- COLUMN
|  
|  
|  
|  
|
|结合@|在sql文件中使用|  
|  
|  
|  
|
|中间内容|  `SQL> spool employees.txt`      
    `SQL> select * from employees;`  ,……plsql、ddl、dml、外部shell、spool 同名/不同名文件……,  `SQL> spool off`  |  
|  
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

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZDhhMWFkOWEzMzExZGM5M2VjIiwicmVmX2lkIjoiNjczOTZkZDg3MjgyMDZlZmI5MmYyM2Q2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyMjUwLCJleHAiOjE3ODIzOTg2NTB9.fOkSeXieAAgXtrmr5jXMJ5f-U38P6vlTWMw72C_QI3Q)

## Attachments:

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZDhhMWFkOWEzMzExZGM5M2VjIiwicmVmX2lkIjoiNjczOTZkZDg3MjgyMDZlZmI5MmYyM2Q2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyMjUwLCJleHAiOjE3ODIzOTg2NTB9.fOkSeXieAAgXtrmr5jXMJ5f-U38P6vlTWMw72C_QI3Q)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZDhhMWFkOWEzMzExZGM5M2VkIiwicmVmX2lkIjoiNjczOTZkZDg3MjgyMDZlZmI5MmYyM2Q2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyMjUwLCJleHAiOjE3ODIzOTg2NTB9.bpPxOlgro4aW9MKugRqj6morlaMX_o0DJ0tlwazkeqU)

 (application/msword)    
