Created by 刘美秀, last modified on 六月 11, 2024

# 1. 概述

DBMS_APPLICATION_INFO用于注册应用程序名称和操作，以用于审核或性能跟踪

# 2. 需求分析

SR：    [https://pingcode.yasdb.com/pjm/items/66276af6fd997db58adfd37f](https://pingcode.yasdb.com/pjm/items/66276af6fd997db58adfd37f)    ?    
  #YDBRD-26618 支持DBMS_APPLICATION_INFO内置系统包

  


开发设计：    [YDBRD-26618 支持DBMS_APPLICATION_INFO内置系统包](https://conf.yasdb.com/pages/viewpage.action?pageId=153006049)  

测试调研：    [YDBRD-26618 支持DBMS_APPLICATION_INFO测试调研](https://conf.yasdb.com/pages/viewpage.action?pageId=153008589)  

概要设计：    [YDBRD-26618 支持DBMS_APPLICATION_INFO内置系统包概要设计](https://conf.yasdb.com/pages/viewpage.action?pageId=153008600)  

## 2.1 功能点分析

- DBMS_APPLICATION_INFO.READ_CLIENT_INFO：读取当前会话的字段的值client_info，V$SESSION的CLIENT_INFO
- DBMS_APPLICATION_INFO.SET_CLIENT_INFO：设置会话的字段的值client_info
- DBMS_APPLICATION_INFO.READ_MODULE：读取  当前会话的模块和操作字段，  V$SQLAREA的MODULE和ACTION
- DBMS_APPLICATION_INFO.SET_MODULE：设置会话  模块名称
- DBMS_APPLICATION_INFO.SET_ACTION：设置  当前模块中当前操作的名称
- V$SESSION新增字段：CLIENT_INFO


**接口概览-会话级**

|视图|字段|操作|接口|参数|入参/出参|参数类型|备注|
|---|---|---|---|---|---|---|---|
|v$session,  
|  `client_info-新增`  |读|**READ_CLIENT_INFO**,读取当前会话的字段的值    `client_info`  |client_info,客户端信息,  
|OUT |VARCHAR|v$session   显示当前所有会话信息|
|  
|  
|写|**SET_CLIENT_INFO**,设置会话的字段    `client_info`  |client_info|IN|VARCHAR|  
|
|V$SQLAREA,  
|MODULE|读|**READ_MODULE**,读取当前会话的模块和操作字段的值|module_name,模块名称|OUT |VARCHAR|V$SQLAREA显示共享SQL区中每条SQL的统计信息，包含SQL在statement上的内存消耗，解析，优化和执行信息|
|  
|  
|  
|  
|action_name,操作名称|OUT |VARCHAR|  
|
|  
|  
|写|**SET_MODULE**,将当前正在运行的模块的名称设置为新模块|module_name|IN|VARCHAR|  
|
|  
|  
|  
|  
|action_name|IN|VARCHAR|  
|
|  
|ACTION|写|**SET_ACTION**,设置当前模块中当前操作的名称|action_name|IN|VARCHAR|  
|


  


**开发设计的主要原理**

PL/SQL执行过程中分为  **编译**  和  **执行**  两个阶段:

1. 编译阶段一般是检查包名，参数的个数和类型是否符合要求；
1. 执行阶段可以拿到完整的参数；


## 2.2 应用场景

- 根据client_info/module_name/action_name跟踪sql执行情况


## 2.3 规格约束

1. SET_ACTION输入的action_name超过32字节截断
1. SET_CLIENT_INFO输入的client_info超过64字节截断
1. SET_MODULE输入的module_name超过48字节截断，action_name超过32字节截断
1. 设置的字段如果在过程体结束后没被设置成null，后续操作也会使用相同字段，直到会话退出。
1. 支持部署模式：单机


## 3. 详细测试设计

## 3.1 测试设计方法

|验证项|设计方法|
|:---|:---|
|入参校验|等价类划、边界值|
|业务验证|等价类划、错误推测|
|特性交互|等价类划|


## 3.2 详细测试设计

**参数验证**

DBMS_APPLICATION_INFO.READ_CLIENT_INFO

|输入条件1|输入条件2|有效等价类|无效等价类|
|:---|:---|:---|:---|
|参数校验|参数个数|1个|0个，大于1个|
||参数类型|1、varchar/char,  
|1、int/tinint/smallint/float/double/bigint/number/数组/UDT/json/clob/blob/,time/data/timestamp,INTERVAL DAY TO SECOND/INTERVAL YEAR TO MONTH,2、nchar/nvarchar|
||参数值内容|/|1,特殊值：null、''|
||参数值长度|varchar <=64字节,char <=64字节|char >64字节,8000/32k字节|
|关键字校验|/|高级包名称及其子函数大小写|高级包名称及其子函数拼写有误|


DBMS_APPLICATION_INFO.SET_CLIENT_INFO

|输入条件1|输入条件2|有效等价类|无效等价类|
|:---|:---|:---|:---|
|参数校验|参数个数|1个|0个，1个，大于2个|
||参数类型|1、varchar/char|1、int/tinint/smallint/float/double/bigint/number/数组/json/clob/blob/,time/data/timestamp,INTERVAL DAY TO SECOND/INTERVAL YEAR TO MONTH,2、nchar/nvarchar|
||参数值内容|1、常量'1'，中文、英文、特殊字符、表情符,2、表列,3、使用函数返回值作为入参|1,特殊值：null、''，‘,"|
||参数值长度|<=64字节,8000/32k字节|  
,64/65字节为中文,  
|


DBMS_APPLICATION_INFO.READ_MODULE

|输入条件1|输入条件2|有效等价类|无效等价类|
|:---|:---|:---|:---|
|参数校验|参数个数|2个|0个，1个，大于2个|
||参数类型|1、varchar/char|1、int/tinint/smallint/float/double/bigint/number/数组/json/clob/blob/,time/data/timestamp,INTERVAL DAY TO SECOND/INTERVAL YEAR TO MONTH,2、nchar/nvarchar,3、使用函数返回值最为入参|
||参数值|/|1,特殊值：null、''|


DBMS_APPLICATION_INFO.SET_MODULE：设置会话  模块名称

|输入条件1|输入条件2|有效等价类|无效等价类|
|:---|:---|:---|:---|
|参数校验|参数个数|2个|0个，1个，大于2个|
||参数类型|1、varchar/char|1、int/tinint/smallint/float/double/bigint/number/数组/json/clob/blob/,time/data/timestamp,INTERVAL DAY TO SECOND/INTERVAL YEAR TO MONTH,2、nchar/nvarchar|
||参数值内容|1、常量'1'，中文、英文、特殊字符、表情符,2、表列,3、使用函数返回值作为入参|1,特殊值：null、''，‘,"|
||参数值长度|module_name  超出48字节/  action_name超出32字节  被截断，,module_name  <=48字节，  action_name  <=32字节,8000/32k字节,  
|47/48字节为中文,  
,  
|


DBMS_APPLICATION_INFO.SET_ACTION

|输入条件1|输入条件2|有效等价类|无效等价类|
|:---|:---|:---|:---|
|参数校验|参数个数|1个|0个，大于1个|
||参数类型|1、varchar/char|1、int/tinint/smallint/float/double/bigint/number/数组/json/clob/blob/,time/data/timestamp,INTERVAL DAY TO SECOND/INTERVAL YEAR TO MONTH,2、nchar/nvarchar|
||参数值内容|1、常量'1'，中文、英文、特殊字符、表情符,2、表列,3、使用函数返回值作为入参|1,特殊值：null、''，‘,"|
||参数值长度|action_name  <=32字节,8000/32k字节|31/32字节为中文|


  


**业务验证**

|测试项|测试点|预期|备注|
|:---|---|:---|---|
|字段长度|CLIENT_INFO长度 <= READ_CLIENT_INFO.CLIENT_INFO入参长度|  
|  
|
|  
|CLIENT_INFO长度 > READ_CLIENT_INFO入参长度|报错|  
|
|  
|module_name  长度 <= READ_MODULE.  module_name  入参长度|  
|  
|
|  
|module_name  长度 > READ_MODULE.  module_name  入参长度|报错|  
|
|  
|action_name  长度 <= READ_MODULE.  action_name  入参长度|  
|  
|
|  
|action_name  长度 > READ_MODULE.  action_name  入参长度|报错|  
|
|CLIENT_INFO|SET_CLIENT_INFO后，READ_CLIENT_INFO和v$session查询结果一致|  
|  
|
|  
|SET_CLIENT_INFO后，重新登录会话，查询不到CLIENT_INFO设置|  
|依据session ID判断是否同一会话？,session id变化规则？|
|  
|默认值null|  
|  
|
|MODULE|SET_MODULE后，READ_MODULE和v$SQLAREA查询结果一致|  
|  
|
|  
|默认值？|  
|oracle默认值sqlplus@host126 (TNS V1-V3)|
|  
|根据MODULE过滤 v$SQLAREA|  
|  
|
|ACTION|SET_MODULE后，READ_MODULE和v$SQLAREA查询结果一致|  
|  
|
|  
|SET_ACTION  后，READ_MODULE和v$SQLAREA查询结果一致|  
|  
|
|  
|默认值null|  
|  
|
|  
|根据ACTION过滤 v$SQLAREA|  
|  
|
|执行方式|匿名块|  
|  
|
|  
|自定义过程体|  
|  
|
|  
|自定义高级包|  
|  
|
|视图|v/dv/gv$session 都新增字段client_info action moudle action_hash module_hash|  
|  
|
|  
|集群重启后查不到设置|  
|  
|
|  
|设置后查询v$sql|  
|  
|


  


  


**特性交互**

|测试项|描述|
|---|---|
|权限|所有用户权限都能执行|
|审计|高级包能被审计|
|备份恢复|SET_CLIENT_INFO/SET_MODULE后备份，变更，恢复备份，查看  action_name/module_name/action_name|
|升级|SET_CLIENT_INFO/SET_MODULE后升级，升级后查看  action_name/module_name/action_name|
|分布式/集群|拦截？—分布式/集群 dba拦截，sys不拦截|
|  
|分布式dn/mn执行拦截|
|新增错误码|YAS-04833 nonsupport %s in cluster/distrubute database|


**专项验证**

|测试项|描述|  
|
|---|---|---|
|HA|主机设置后，备机也能查询到设置|内存--查不到|
|并发|DDL/DML时 set/read|  
|


次数、DBMS_UTILITY

**资料：**

|验证项|验证点|当前结果|预期|备注|
|---|---|---|---|---|
|v/dv/gv SESSION|CLIENT_INFO|/|增加字段|Information set by the DBMS_APPLICATION_INFO.SET_CLIENT_INFO procedure|
|v/dv/gv SQLAREA|MODULE|保留字段|更新描述|Contains the name of the module that was executing when the SQL statement was first parsed as set by calling DBMS_APPLICATION_INFO.SET_MODULE|
|  
|ACTION|保留字段|更新描述|Contains the name of the action that was executing when the SQL statement was first parsed as set by calling DBMS_APPLICATION_INFO.SET_ACTION|
|DBMS_APPLICATION_INFO|  
|  
|新增章节|路径：开发手册/PL参考手册/内置高级包|


  


  


2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR/testkill|否|
|HA|否|
|压力|否|
|性能|是|
|可维护性|否|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

冒烟：

  


文本：

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *5人天*

计划测试执行时间：2024.5.30-2024.6.3

## Attachments:

[set_false.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMGE4OTcwYzJhZjRmNTIwZmVmIiwicmVmX2lkIjoiNjczOTZkMDk3MjgyMDZlZmI5MmYxYTVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NTA0LCJleHAiOjE3ODIzOTE5MDR9.XoLT4EfZPsrOatrkx9yBMz48opZ2cdnMp1daiO7jcV0)

 (image/png)    


[image2024-5-22_1-9-54.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMGFhMWFkOWEzMzExZGM4ZTVlIiwicmVmX2lkIjoiNjczOTZkMDk3MjgyMDZlZmI5MmYxYTVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NTA0LCJleHAiOjE3ODIzOTE5MDR9.rPCbZTz6FJO_pJsRrp-Wq2W98Sg9a4o4THGaE2wlLxs)

 (image/png)    


[DBMS_APPLICATION_INFO文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMGFhMWFkOWEzMzExZGM4ZTVmIiwicmVmX2lkIjoiNjczOTZkMDk3MjgyMDZlZmI5MmYxYTVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NTA0LCJleHAiOjE3ODIzOTE5MDR9.Blax2EZtLU9RGs7bYbQerunE84_bwPsaR3kSzm8_66E)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[test_sr26618_smoke.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMGE4OTcwYzJhZjRmNTIwZmYwIiwicmVmX2lkIjoiNjczOTZkMDk3MjgyMDZlZmI5MmYxYTVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NTA0LCJleHAiOjE3ODIzOTE5MDR9.xyltTZnVxmnvYd11orp1At2_vF0rAcPFmj9reT3-YGI)

 (application/octet-stream)    


## Comments:

|  [](null)  ,会议纪要：    
  与会人：王海峰，施新华，汪少华，林俊喆，刘美秀    
  会议时间：2024/5/22 15:45-16:15    
  会议地点：线上    
  纪要信息：    
  1.验证范围：分布式/集群---待定是否支持，少华    
  2.信息同步：主机设置后，备机查询不到设置    
  3.新增场景：SET_CLIENT_INFO/SET_MODULE，重启，重启后查询不到对应设置,Posted by liumeixiu at 五月 22, 2024 16:36|
|---|
