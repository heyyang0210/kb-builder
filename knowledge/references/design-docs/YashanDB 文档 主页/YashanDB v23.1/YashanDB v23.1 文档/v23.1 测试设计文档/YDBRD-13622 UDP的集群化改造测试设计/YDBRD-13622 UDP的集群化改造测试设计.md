Created by 党文琪, last modified on 十月 12, 2024

# 1.   **概述**

本文档描述集群支持自定义高级包相关测试设计。

# 2.   **需求分析**

1、SR链接

  [YDBRD-13622](https://jira.yasdb.com/browse/YDBRD-13622?src=confmacro)    -  UDP的集群化改造  完成

2、研发方案

  [https://conf.yasdb.com/x/nwK4Bg](https://conf.yasdb.com/x/nwK4Bg)  

3、分析

从研发方案来看，UDP基本功能无变化，本次测试的侧重点在集群功能与UDP的适配。测试需要关注串行，并行场景下，UDP的同步，修改，并发，各实例能够调用公有变量，修改UDP定义，在视图中查询及调用无异常。

关注UDP的编译顺序，依赖对象失效或有效的情况下不同实例的信息同步。

# 3.   **测试设计方法**

本测试设计使用的工程方法有边界值，等价类，流程图及相关的组合策略，结合集群的特性，梳理测试重点

# 4.   **详细测试设计**

1、相关视图梳理：

dba_procedures    
  dba_arguments    
  dba_source    
  dba_objects

DBA_DEPENDENCIES

2、串行场景

|测试场景|  
|  
|
|---|---|---|
|创建|创建head|create/create or replace,创建的先后顺序不同,创建有同名对象,创建执行不同的schema,关注各实例调用及系统视图的同步|
|  
|创建body||
|修改|alter package|编译package，head，body及触发自动编译，检查各实例是否生效|
|  
|依赖对象|依赖表,依赖某自定义类型,依赖其他pkg|
|  
|语法检查|语法有错误时的报错信息及状态变化,dba_objects状态变化|
|  
|GET_DDL|获取后能否在其他实例执行创建成功|
|调用|支持的对象|type_definition    
  item_declaration    
  cursor_declareation    
  function_declaration    
  procedure_declaration|
|  
|调用对象|公有变量在实例间调用,公有类型的初始化,存储过程在不同实例间调用，传入不同类型的入参|
|  
|异常情况|权限不足,状态非有效|
|删除|drop/drop if|有效性检查,依赖对象检查,调用检查|


  


3、并行场景

|  
|测试点|
|---|---|
|创建|创建依赖的表,UDT,创建多个pkg|
|删除|删除pkg,依赖对象|
|调用|pkg相互调用,调用类型,变量,存储过程|
|修改|修改pkg,修改依赖对象,修改调用方式,alter package的应用|
|并发方式|单实例,多实例|


4、xmind版测试设计

# 5.   **测试用例**

测试设计细化后的文本用例

详见附件

2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR/testkill|  
|
|HA|  
|
|压力|  
|
|性能|  
|
|可维护性|  
|


# 6.   **测试框架设计**

# 7.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

## Attachments:

[集群支持pkg.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OGY4OTcwYzJhZjRmNTFmOTE2IiwicmVmX2lkIjoiNjczOTY5OGY3MjgyMDZlZmI5MmVmNDc0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3MjE3LCJleHAiOjE3ODIyOTM2MTd9.6p8ZIe2xndgGn0rmc831ShCB24arOnE56ReKoYroNBs)

 (application/x-xmind)    


[集群支持pkg.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OGZhMWFkOWEzMzExZGM3NzhkIiwicmVmX2lkIjoiNjczOTY5OGY3MjgyMDZlZmI5MmVmNDc0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3MjE3LCJleHAiOjE3ODIyOTM2MTd9.DD5RhluAx0mrXeehS9khgz03SHDBabs-cq4M8pwWqNE)

 (application/x-xmind)    


[集群支持udp.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OGY4OTcwYzJhZjRmNTFmOTE3IiwicmVmX2lkIjoiNjczOTY5OGY3MjgyMDZlZmI5MmVmNDc0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3MjE3LCJleHAiOjE3ODIyOTM2MTd9.qrPicWA0uRXYOXhbrvdXtEp0rjrOy5ZDxdF0Z174yUA)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
