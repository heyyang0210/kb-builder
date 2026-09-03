Created by 龚雯, last modified on 十二月 28, 2023

# SR：    [YDBRD-22270](https://jira.yasdb.com/browse/YDBRD-22270?src=confmacro)    -  【c驱动】API支持返回YAC_SUCCESS_WITH_INFO  完成

# 1. 概述

*简要说明本功能/需求的背景，本文档的适用范围*

*外场超图使用C驱动，需要支持返回值*  ***YAC_SUCCESS_WITH_INFO***  *。*

# 2. 需求分析

## 2.1 功能点分析

- *对功能/需求进行详细说明及分析，*  *对应提供的功能点、函数、语法图、配置参数、视图、接口等；*
- *开发设计的主要原理*


|接口|类型|说明|
|:---|:---|:---|
|yacFetch|修改|新增YAC_SUCCESS_WITH_INFO的返回值|
|yacSetStmtAttr|修改|新增  SQL_ATTR_ROW_STATUS_PTR的参数类型，用于在绑定参数时获取每一行的行状态。|
|yacSetEnvAttr|修改|新增属性YAC_ATTR_RETURN_SUCCESS_WITH_INFO，值YAC_TRUE,YAC_FALSE,数据类型YacBool|
|yacGetEnvAttr|修改|新增属性YAC_ATTR_RETURN_SUCCESS_WITH_INFO获取属性值，数据类型YacBool|


## 2.2 应用场景

- *需求本身的主要应用场景*
- *需求与其他特性的关联场景*


*在fetch到的数据截断时，需要返回YAC_SUCCESS_WITH_INFO，并且可以获取数据截断的提示信息*

## 2.3 规格约束

- *需求定义的规格、约束，系统/模块上下文等*
- *内部机制涉及的规格约束*


*无*

# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

*截断字符长度-边界值*

*被截断的场景有多个等价类-等价类*

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|测试点|
|:---|:---|:---|
|CT|否|  
|
|KT|否|  
|
|长稳|否|  
|
|一致性|否|  
|
|三方测试工具    
  (sqltest，sqlancer)|否|  
|
|安全|是|asan工程|
|DFR|否|  
|
|HA|否|  
|
|压力|否|  
|
|性能|否|  
|
|可维护性|否|  
|


yacSetEnvAttr-设置环境参数，新增属性YAC_ATTR_RETURN_SUCCESS_WITH_INFO

yacGetEnvAttr-获取环境参数，不设置时默认值YAC_FALSE

设置后查看获取值是否等于设置值，验证设置是否生效，若返回SUCCESS_WITH_INFO需要验证信息

|输入条件|有效等价类|编号|备注|无效等价类|编号|备注|
|:---|:---|:---|:---|:---|:---|:---|
|YAC_ATTR_RETURN_SUCCESS_WITH_INFO设置的值|YAC_TRUE|  
|  
|其他数值|  
|  
|
|  
|YAC_FALSE|  
|  
|  
|  
|  
|


yacSetStmtAttr-设置  SQL_ATTR_ROW_STATUS_PTR，用于在批量绑定的时候，返回每一行的状态信息，用于确定每一行的状态

|输入条件|有效等价类|编号|备注|无效等价类|编号|备注|
|:---|:---|:---|:---|:---|:---|:---|
|传参数值|数组指针，元素数与行集中的行数相同|  
|  
|  
|  
|  
|
|  
|数组指针，元素数大于行集中的行数|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|数组指针，元素数小于行集中的行数|  
|  
|
|  
|null指针|  
|不返回  每一行的状态信息|  
|  
|  
|


yacFetch-获取查询到的数据到分配的空间

|输入条件|有效等价类|编号|备注|无效等价类|编号|备注|
|:---|:---|:---|:---|:---|:---|:---|
|被截断的原数据类型|clob|  
|  
|char|  
|  
|
|  
|nclob|  
|  
|nchar|  
|  
|
|  
|blob|  
|  
|varchar|  
|  
|
|  
|json|  
|  
|nvarchar|  
|  
|
|  
|xml|  
|  
|raw|  
|  
|
|  
|  
|  
|  
|rowid|  
|  
|
|绑定的c类型|YAC_SQLT_CHAR|  
|  
|  
|  
|  
|
|  
|YAC_SQLT_VARCHAR|  
|  
|  
|  
|  
|
|  
|YAC_SQLT_BINARY|  
|  
|  
|  
|  
|
|  
|YAC_SQLT_CLOB|  
|  
|  
|  
|  
|
|  
|YAC_SQLT_BLOB|  
|  
|  
|  
|  
|
|  
|YAC_SQLT_NCLOB|  
|  
|  
|  
|  
|
|  
|YAC_SQLT_JSON|  
|  
|  
|  
|  
|
|  
|YAC_SQLT_CHAR2|  
|  
|  
|  
|  
|
|  
|YAC_SQLT_VARCHAR2|  
|  
|  
|  
|  
|
|  
|YAC_SQLT_BINARY2|  
|  
|  
|  
|  
|
|yacFetch单行绑定返回值|YAC_SUCCESS|  
|  
|  
|  
|  
|
|  
|YAC_ERROR|  
|  
|  
|  
|  
|
|  
|YAC_SUCCESS_WITH_INFO|  
|  
|  
|  
|  
|
|yacFetch多行绑定，每行数据是否截断|无截断|test_success_with_info_7|  
|  
|  
|  
|
|  
|首行截断，其他行不截断|  
|  
|  
|  
|  
|
|  
|末行截断，其他行不截断|  
|  
|  
|  
|  
|
|  
|中间一行截断，其他行不截断|  
|  
|  
|  
|  
|
|  
|全截断|  
|  
|  
|  
|  
|
|  
|截断与不截断的行交替出现|  
|  
|  
|  
|  
|
|  
|前面有截断与不截断的行，中间一行error，后面的行success（只执行到error的行）|  
|  
|  
|  
|  
|
|fetch到被截断的行数|0|  
|  
|  
|  
|  
|
|  
|1|  
|  
|  
|  
|  
|
|  
|10000（是否有上限）|  
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
|  
|


测试后来设置的开关值是否影响之前申请的stmt句柄

测试多个env句柄下，某个env句柄参数的改变是否影响其他env句柄

有时间可以测下打开开关的全量用例执行

# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


*使用OCI已有框架*

# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

*单机x86服务器*

# 7. 工作量评估

工作量：  *3人天*

计划测试完成时间：

## Attachments:

[c驱动success_with_info文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWQ4OTcwYzJhZjRmNTIwNjQ1IiwicmVmX2lkIjoiNjczOTZiYWM1OTNmOTljOWZmMjM2NWFjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MjI1LCJleHAiOjE3ODIzODI2MjV9.oRNfzTQ7OpjXRzXE6_YC0g3XAr5zFsbhoO90gXvUl3I)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[c驱动success_with_info文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWQ4OTcwYzJhZjRmNTIwNjQ2IiwicmVmX2lkIjoiNjczOTZiYWM1OTNmOTljOWZmMjM2NWFjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MjI1LCJleHAiOjE3ODIzODI2MjV9.xe6wI5Wyb0FsSMpY9_se7vS1EKUzHfu1u_iu-nJkFUM)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
