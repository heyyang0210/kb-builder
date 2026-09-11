Created by 陈钦卿, last modified on 六月 07, 2024

# 1. 概述

SR：    [https://pingcode.yasdb.com/pjm/items/66115684579a3edb84d68cbe](https://pingcode.yasdb.com/pjm/items/66115684579a3edb84d68cbe)    ? #YDBRD-19168 【imp/exp】支持执行过程中打印进度和输出日志

开发设计：    [YDBRD-19204 支持imp/exp执行过程打印进度和输出日志， YDBRD-26275 支持imp导入完成后删除原始数据文件 设计方案 - 叶子 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=153010208)  

交付形态：单机、分布式、集群

# 2. 需求分析

## 2.1 功能点分析

|功能点|新增参数|含义|备注|
|---|---|---|---|
|exp --csv|~~--detail~~|~~控制CSV导出过程是否显示导出进度。缺省时表示不显示导出进度。~~|进度写入日志|
|exp导出元数据|~~PROGRESS~~|~~控制元数据导出过程是否显示导出进度信息。默认值为NULL，取值范围为[NULL,DETAIL]。~~|导出时一定将过程进度打印在前端|
|  
|LOG_PATH|指定写入日志文件的目录,   **缺省时不生成日志文件**  ，支持相对路径（不可为../相对路径）|进度写入日志。路径长度规格--256字节|
|  
|LOG_LEVEL|控制日志的日志级别，默认值为INFO，取值范围为[OFF, ERROR, WARN, INFO, DEBUG, TRACE]|  
|
|imp|~~PROGRESS~~|~~控制导入过程是否打印导入进度。默认值为NULL，取值范围为[NULL,DETAIL]。~~|  
|
||LOG_PATH|指定写入日志文件的目录,  ** 缺省时不生成日志文件**  ，支持相对路径（不可为../相对路径）|进度写入日志|
||LOG_LEVEL|控制日志的日志级别，默认值为INFO，取值范围为[OFF, ERROR, WARN, INFO, DEBUG, TRACE]|  
|


## 2.2 规格约束

- 无


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


  


|测试场景|测试项一|测试项二|有效等价类|无效等价类|备注|
|:---|:---|---|:---|:---|---|
|参数校验|LOG_PATH|拼写|大写、小写、大小写混合|拼写错误|  
|
|  
|  
|取值|绝对路径、相对路径(./     ?/   `pwd`/-支持  ),路径长度、路径权限|../相对路径,无关字符串：数字、字母、表情、中文等,路径不存在——报错？重新创建？|相对路径规格|
|  
|  
|格式|  
|  
|  
|
|  
|  
|位置、重复指定|  
|  
|  
|
|  
|LOG_LEVEL|拼写|大写、小写、大小写混合|拼写错误|  
|
|  
|  
|取值|[OFF, ERROR, WARN, INFO, DEBUG, TRACE],大小写、大小写混合|拼写错误,无关字符串：数字、字母、表情、中文等|默认为INFO|
|  
|  
|格式|  
|  
|  
|
|  
|  
|位置、重复指定|  
|  
|  
|
|exp功能校验|对象全覆盖|  点击此处展开...,- tablespace
- profile
- user
- privilege
- dblink
- sequence
- synonyms
- type
- table
- ac
- index
- constraint
- primary key
- foreign key
- audit policy
- outline
- sql map
|  
|  
|各对象导出时检查进度是否显示,用户自定义表空间不导出，是否有过程进度信息,临时表不导出数据。,full导出大概长这样，改成复数。打印出表所属用户。,![](https://pingcode.yasdb.com/atlas/files/public/67396ceea1ad9a3311dc8d9c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBSUFBQUFBQUFnQ0FBQ0FBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUJBQUFBRUFJQUFBRUFBQUFBQkVBQUFBQkFBQUFBQ0FBQUFBZ0FBQUFnQUFBQkFBQUlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDQ3NjIsImV4cCI6MTc4MjMxNTU2Mn0.ilOeMy64CjTpEOmcqhVkp1_iVjbWX6N1wedXxRdkSdY)|
|  
|导出模式|full、owner、tables、rows|全库导出不能导出用户|  
|  
|
|  
|兼容性|  
|  
|  
|  
|
|  
|权限|导出其他用户下的数据|  
|  
|  
|
|  
|导出失败|  
|  
|  
|  
|
|imp功能校验|对象全覆盖|  点击此处展开...,- tablespace
- table
- index
- constraint
- object
- trigger
- store object
- sql
- user
- role
- profile
- privilege
- table privilege
- object privilege
- audit policy
- outline
- sql map
- type dep
- ac
- dblink
,profile只在full下才能导入|  
|  
|各对象导入时检查进度是否显示,full导入大概长这样，要打印出导入表记录数,![](https://pingcode.yasdb.com/atlas/files/public/67396cee8970c2af4f520f2c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBSUFBQUFBQUFnQ0FBQ0FBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUJBQUFBRUFJQUFBRUFBQUFBQkVBQUFBQkFBQUFBQ0FBQUFBZ0FBQUFnQUFBQkFBQUlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDQ3NjIsImV4cCI6MTc4MjMxNTU2Mn0.ilOeMy64CjTpEOmcqhVkp1_iVjbWX6N1wedXxRdkSdY),fromuser导入大概长这样，要打印出导入表记录数,![](https://pingcode.yasdb.com/atlas/files/public/67396ceea1ad9a3311dc8d9d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBSUFBQUFBQUFnQ0FBQ0FBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUJBQUFBRUFJQUFBRUFBQUFBQkVBQUFBQkFBQUFBQ0FBQUFBZ0FBQUFnQUFBQkFBQUlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDQ3NjIsImV4cCI6MTc4MjMxNTU2Mn0.ilOeMy64CjTpEOmcqhVkp1_iVjbWX6N1wedXxRdkSdY),tables导入大概长这样，要打印出导入表记录数,![](https://pingcode.yasdb.com/atlas/files/public/67396ceea1ad9a3311dc8d9e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBSUFBQUFBQUFnQ0FBQ0FBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUJBQUFBRUFJQUFBRUFBQUFBQkVBQUFBQkFBQUFBQ0FBQUFBZ0FBQUFnQUFBQkFBQUlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDQ3NjIsImV4cCI6MTc4MjMxNTU2Mn0.ilOeMy64CjTpEOmcqhVkp1_iVjbWX6N1wedXxRdkSdY)|
|  
|导入模式|full、fromuser、tables、touser、    
  ignore（对象已存在）、    
  rows、    
  data_only、    
  truncate|  
|  
|构造对应场景|
|  
|元数据大小|小于1M，大于1M|  
|  
|  
|
|  
|权限|  
|  
|  
|  
|
|  
|兼容性|  
|  
|  
|  
|
|  
|并发|用户模式下各个用户并发导元数据|  
|  
|  
|
|  
|  
|表模式下各个表并发导元数据,  
|  
|  
|  
|
|  
|导入失败|  
|  
|  
|  
|
|exp、imp功能交互|full导出user导入、user导出table导入等|  
|  
|  
|  
|
|日志打印|内容|ERROR, WARN, INFO, DEBUG, TRACE有何区别,过程进度|  
|  
|当前的日志名：run.log —— 默认文件名改为exp.log、imp.log,是否需要支持指定文件名 —— 不支持,大概观测日志内容是否合理即可,日志覆盖or追加？  —— 追加,中文--表名等|
|可靠性|ctrl+c|也要记录日志？—— 捕捉ctrl+c信号，打印信息后退出|  
|  
|  
|
|  
|kill数据库进程|  
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

[expimp支持过程打印和输出日志文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWQ4OTcwYzJhZjRmNTIwZjI1IiwicmVmX2lkIjoiNjczOTZjZWQ3MjgyMDZlZmI5MmYxODliIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NzYxLCJleHAiOjE3ODIzOTExNjF9.vQADkGw-qD9RaX2R06gvs82G5uzfiziCxEyn8mwKRgs)

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


  


- 本次测试采用exp_imp_test测试框架实现，执行py文件，对比期望结果与输出结果，输出测试结果。


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|单机|


# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWQ4OTcwYzJhZjRmNTIwZjI2IiwicmVmX2lkIjoiNjczOTZjZWQ3MjgyMDZlZmI5MmYxODliIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NzYxLCJleHAiOjE3ODIzOTExNjF9.PGLTD_upUw8apyVsyeTl-eIZ-xHIqrt8zikpaSCyBmw)

## Attachments:

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWQ4OTcwYzJhZjRmNTIwZjI2IiwicmVmX2lkIjoiNjczOTZjZWQ3MjgyMDZlZmI5MmYxODliIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NzYxLCJleHAiOjE3ODIzOTExNjF9.PGLTD_upUw8apyVsyeTl-eIZ-xHIqrt8zikpaSCyBmw)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWQ4OTcwYzJhZjRmNTIwZjI3IiwicmVmX2lkIjoiNjczOTZjZWQ3MjgyMDZlZmI5MmYxODliIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NzYxLCJleHAiOjE3ODIzOTExNjF9.5N4BZdm8wGeDwScFa6aw2nKnTub9SaWOPfO-V4GOQO8)

 (application/msword)    


[image2024-4-11_11-20-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWQ4OTcwYzJhZjRmNTIwZjI4IiwicmVmX2lkIjoiNjczOTZjZWQ3MjgyMDZlZmI5MmYxODliIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NzYxLCJleHAiOjE3ODIzOTExNjF9.ZGrUNozVJr5XMm8Aql6otSSWedImMgO0AemZOY36ogw)

 (image/png)    


[image2024-4-11_11-25-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWRhMWFkOWEzMzExZGM4ZDk1IiwicmVmX2lkIjoiNjczOTZjZWQ3MjgyMDZlZmI5MmYxODliIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NzYxLCJleHAiOjE3ODIzOTExNjF9.WMIswSpr7e2dMoCfHq5Qht81123UhgOxNMCth2Gff9E)

 (image/png)    


[image2024-4-11_11-29-51.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWRhMWFkOWEzMzExZGM4ZDk2IiwicmVmX2lkIjoiNjczOTZjZWQ3MjgyMDZlZmI5MmYxODliIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NzYxLCJleHAiOjE3ODIzOTExNjF9.g6TtDITEda1Po_9PjtkEvxnr-MQYd7ANinEpVHNslzg)

 (image/png)    


[image2024-4-11_11-35-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWRhMWFkOWEzMzExZGM4ZDk3IiwicmVmX2lkIjoiNjczOTZjZWQ3MjgyMDZlZmI5MmYxODliIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NzYxLCJleHAiOjE3ODIzOTExNjF9.dYmc06vfMSj5E4BMH7YgyQ_h_2m2afPc04A6_N3TNjw)

 (image/png)    


[image2024-4-11_11-36-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWQ4OTcwYzJhZjRmNTIwZjI5IiwicmVmX2lkIjoiNjczOTZjZWQ3MjgyMDZlZmI5MmYxODliIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NzYxLCJleHAiOjE3ODIzOTExNjF9.PxQ13wOFGS7315k5J2ILDZcorg8wTQcFFDGi1Zm2vLM)

 (image/png)    


[image2024-4-11_11-44-19.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWRhMWFkOWEzMzExZGM4ZDk4IiwicmVmX2lkIjoiNjczOTZjZWQ3MjgyMDZlZmI5MmYxODliIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NzYxLCJleHAiOjE3ODIzOTExNjF9.RbFWHSfC2liAkaMZmE4a_ewp6UoyeDm1xg_TZH05wzE)

 (image/png)    


[expimp支持过程打印和输出日志文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWQ4OTcwYzJhZjRmNTIwZjJhIiwicmVmX2lkIjoiNjczOTZjZWQ3MjgyMDZlZmI5MmYxODliIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NzYxLCJleHAiOjE3ODIzOTExNjF9.Hy2gKl6s3Y9Ne_zhywWoh9Esj21sxFeRyEQAoX37IZM)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[expimp支持过程打印和输出日志文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWQ4OTcwYzJhZjRmNTIwZjI1IiwicmVmX2lkIjoiNjczOTZjZWQ3MjgyMDZlZmI5MmYxODliIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NzYxLCJleHAiOjE3ODIzOTExNjF9.vQADkGw-qD9RaX2R06gvs82G5uzfiziCxEyn8mwKRgs)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,测试设计评审纪要    
  与会人：陈钦卿、范瑜、叶子、史鑫、谢昭贤    
  评审时间：2024.05.29 11:30:00    
  会议纪要：    
  1、确定新增参数：LOG_PATH、LOG_LEVEL。不支持指定文件名。    
  2、确定过程打印规格：前端必打印，是否生成日志由参数控制，日志包含过程信息    
  3、exp/imp需要捕捉ctrl+c信号，打印信息后退出进程    
  4、待确定规格：相对路径、路径长度,Posted by chenqinqing at 五月 29, 2024 16:55|
|---|
