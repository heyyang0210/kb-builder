Created by 刘大境, last modified on 十一月 06, 2023

## 1.概述

SR：    [[YDBRD-21378] 支持create/drop directory - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-21378)  

设计文档：    [DIRECTORY - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/YAS/DIRECTORY)  

YashanDB支持创建删除目录。

  


## 2.功能

1.支持创建目录

sql语法：CREATE [OR REPLACE] DIRECTORY directory AS 'path_name';

根据输入的目录名创建object    
  将创建的objectid以及目录路径写入新添加的系统表dir$    
  新增权限create any directory，只有拥有该权限的用户才能创建directory  （需要DBA用户下才能赋予create any directory权限）

![](https://conf.yasdb.com/download/attachments/130142976/create_directory.gif?version=2&modificationDate=1696924233000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgyMjcsImV4cCI6MTc4MjMwOTAyN30.NvN77MOzDtlBSbm2DfqJZ3GYa2MHTJV8XLO-Uh_C3-M)

  


2.支持删除目录

sql语法： DROP DIRECTORY directory_name;

根据输入的目录名删除对应的目录    
  新增权限drop any directory， 只有拥有该权限的用户才能删除directory  （需要DBA用户下才能赋予drop any directory权限）

![](https://conf.yasdb.com/download/attachments/130142976/drop_directory.GIF?version=1&modificationDate=1696924240000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgyMjcsImV4cCI6MTc4MjMwOTAyN30.NvN77MOzDtlBSbm2DfqJZ3GYa2MHTJV8XLO-Uh_C3-M)

  


## 3.需求分析

#### (1) 规格约束限制

1.创建目录时不对路径是否存在做判断，需要在使用该目录时再做判断    
  2.不允许使用父目录    
  3.默认用户为sys且不能修改    
  4.路径最大长度为4000

  


(2) 新增系统表及视图

1.系统表dir$  存放目录对应地址

|字段|类型|说明|
|---|---|---|
|obj#|BINARY_BIGINT，not null|目录oid|
|os_path|VARCHAR(4000)|目录地址|


  


2.系统视图  all_directories,dba_directories

|字段|类型|说明|
|---|---|---|
|owner|VARCHAR(64)，not null|目录owner名字|
|directory_name|VARCHAR(64), not null|目录名称|
|directory_path|VARCHAR(4000)|目录地址|


  


## 4.测试设计方法

(1) 主要采用场景法和错误推算法及边界测试法进行设计

|专项|是否涉及|
|---|---|
|并发|是|
|长稳|  
|
|一致性|  
|
|安全|  
|
|HA|是|
|压力|  
|
|性能|  
|
|资料|是|


## 4.1 文本用例

## 5.详细测试设计

(1) 语法验证

|输入条件|有效等价类|无效等价类|
|---|---|---|
|create    directory |create  DIRECTORY directory AS 'path_name';,  
|**路径异常：**,路径不存在（不报错）,路径为windows格式,路径非法,路径包含特殊字符,无文件的读写权限,带../的路径,$PWD/xxx   $带变量的路径,路径超过4000,路径不带引号,递归创建相同名称路径（通过PL/SQL存储过程方式，来创建）|
|  
|create or replace DIRECTORY directory AS 'path_name';|**directory_name**  **异常:**,directory为关键字,directory为跟其他对象重名（table、view、index）,directory长度超过64位限制,directory为1或为空,directory大小写混合,存在大写的时候再创建同名小写,directory带特殊字符、表情,以数字或者特殊字符开头,directory缺失,同名的directory已存在|
|  
|  
|关键字缺失、关键字重复、关键字拼写错误|
|drop   directory|DROP DIRECTORY directory_name;|directory_name不存在,directory_name被删除后再次删除,directory_name为其他对象（table、view、index）|


（2）功能验证

|编号|测试场景|用例详细描述|预期|优先级|备注|
|---|---|---|---|---|---|
|1|创建目录|输入一个有效的目录路径，创建一个目录对象，并查询相关系统表、视图|成功|高|  
|
|2|  
|输入一个无效的目录路径，创建一个目录对象，并查询相关系统表、视图|成功|高|  
|
|3|  
|给同一个目录创建不同的directory|  
|  
|  
|
|4|  
|创建同名目录对象（带replace和不带replace）|带replace成功，不带replace报错|中|  
|
|5|  
|输入根(父)目录，创建一个目录对象|失败|中|  
|
|  
|  
|导入导出使用该目录对象（暂时不涉及）|  
|  
|  
|
|6|权限|拥有grant create any directory to user权限的用户，创建directory|成功|高|  
|
|7|  
|无grant create any directory to user权限的用户，创建directory|失败|高|  
|
|8|  
|拥有grant drop any directory to user 权限的用户, 删除directory|成功|高|  
|
|9|  
|无grant drop any directory to user权限的用户, 删除directory|失败|高|  
|
|10|  
|DBA权限的用户执行create 、drop|成功|高|  
|
|11|  
|自定义用户不给权限，create、drop|失败|高|  
|
|12|  
|给DBA权限create、再收回DBA权限，执行drop|删除失败|  
|  
|
|  
|  
|通过角色赋权，系统角色或自定义角色|  
|  
|  
|
|  
|  
|三权分立权限|  
|  
|  
|
|  
|  
|非DBA用户下给其它用户赋权|失败|中|  
|
|13|删除目录|删除一个有效的目录路径，删除一个目录对象，并查询相关系统表、视图|成功|高|  
|
|14|  
|删除一个无效/不存在的目录路径，删除一个目录对象，并查询相关系统表、视图|删除失败|高|  
|
|15|集群拦截、不支持|输入一个有效的目录路径，创建一个目录对象，并查询相关系统表、视图|失败|中|  
|
|16|  
|删除一个有效的目录路径，删除一个目录对象，并查询相关系统表、视图|失败|中|  
|
|17|分布式拦截、不支持|输入一个有效的目录路径，创建一个目录对象，并查询相关系统表、视图|失败|中|  
|
|18|  
|删除一个有效的目录路径，删除一个目录对象，并查询相关系统表、视图|失败|中|  
|
|19|并发|不同create or replace/create directory /drop 权限、创建、删除目录|无core|高|  
|
|20|HA|1.主备切换/倒换，创建/删除目录，查询。,2.创建目录，备份、删除目录、恢复|成功|中|  
|
|  
|升级场景|旧版本升级后，使用新版本可以正常创建/删除目录，查询系统表和视图|  
|  
|22.2升级23.2，创建目录、查询、删除目录、查询|
|  
|功能|A用户(dba权限创建目录)，B用户自定义drop any权限，删除目录|  
|  
|  
|
|  
|  
|A用户(dba权限创建目录)，B目录自定义无权限，删除目录|  
|  
|  
|
|  
|  
|A用户create any权限，创建目录，B用户DBA删除|  
|  
|  
|


## Attachments:

[create_drop_directory文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZjM4OTcwYzJhZjRmNTIwODFiIiwicmVmX2lkIjoiNjczOTZiZjI3MjgyMDZlZmI5MmYwYzEyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4MjI3LCJleHAiOjE3ODIzODQ2Mjd9.QWsOD6NkSZHQmosNnXVvbXmf9piOsFRiSjXBwjBz9HQ)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[create_drop_directory文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZjM4OTcwYzJhZjRmNTIwODFjIiwicmVmX2lkIjoiNjczOTZiZjI3MjgyMDZlZmI5MmYwYzEyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4MjI3LCJleHAiOjE3ODIzODQ2Mjd9.ihf88enMZ3dvyZB1ds5Qg1EjPxc2H3Lz1lk6zrIPnHQ)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
