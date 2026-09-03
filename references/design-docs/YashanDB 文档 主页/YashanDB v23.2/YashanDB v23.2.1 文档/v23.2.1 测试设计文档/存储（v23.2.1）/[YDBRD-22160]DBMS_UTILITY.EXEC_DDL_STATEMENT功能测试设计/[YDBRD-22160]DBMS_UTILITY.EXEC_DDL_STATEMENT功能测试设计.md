Created by 王伟, last modified on 十二月 14, 2023

# 1. 概述

EXEC_DDL_STATEMENT是文件操作高级包DBMS_UTILITY下的一个子函数，是  参考Oracle数据库的实现，用于在PL/SQL中动态执行DDL语句的接口。

其功能与  execute immedaite动态执行sql一致，但执行的sql命令仅局限于DDL，非正确的DDL命令视为错误的入参。

SR：       [YDBRD-22160](https://jira.yasdb.com/browse/YDBRD-22160?src=confmacro)    -  支持DBMS_UTILITY.EXEC_DDL_STATEMENT函数  完成

开发设计：    [DBMS_UTILITY.EXEC_DDL_STATEMENT设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=133579247)  

# 2. 需求分析

## 2.1 功能点分析

### Syntax（语法）

```
DBMS_UTILITY.EXEC_DDL_STATEMENT (
 parse_string IN VARCHAR2);
```

###   `  
`     Parameter（参数）

|参数|参数类型|数据类型|是否必填|默认值|说明|
|:---|:---|:---|:---|:---|:---|
|parse_string|IN|VARCHAR2|是|-|待执行的DDL语句|


### Detail Design（详细设计）

【基本参考execute immediate。中间对非ddl语句编译后直接返回。】

1. 校验入参parse_string的合法性（只有参数个数错误时才编译阶段报错）
1. bipExecExecDdlStatement中用anlPrepare2进行语句编译校验
1. 判断是否为DDL语句，不是则返回，并不抛出任何异常
1. 是DDL则进行anlExecute。


## 2.2 应用场景

- PLSQL代码块应用（匿名块、函数、存储过程、触发器、包、定时任务、自定义类型）。


## 2.3 规格约束

- 只支持单机和集群（暂不支持分布式）。
- 只支持DDL语句的执行，非DDL只编译不执行。
- 有且只能有一个参数，且参数类型为VARCHAR2。


|入参|结果|
|:---|:---|
|空|PLS-00306: 调用 'EXEC_DDL_STATEMENT' 时参数个数或类型错误|
|显式NULL|ORA-06561: 程序包 DBMS_SQL 不支持给定的语句[报错信息包含了DBMS_UTILITY和DBMS_SQL，感觉是oracle内部实现有点问题]|
|非字符串类型|ORA-00900: 无效 SQL 语句|
|字符串类型但完全不是sql语句|ORA-00900: 无效 SQL 语句|
|DDL结尾有分号|ORA-00922: 选项缺失或无效|
|多条DDL，中间用分号进行分割|ORA-00922: 选项缺失或无效（估计是因为中间识别到分号了）|
|非DDL，sql语句本身不合法（例：select不存在的表）|子函数执行出错，非ddl编译出错，报非ddl编译时的错误 【plsql用exception可捕获】|
|非DDL，sql语句本身合法|子函数执行成功，非ddl编译成功，但未执行|
|DDL，sql语句本身不合法（例：create已存在的表）|子函数执行出错，根据ddl本身编译执行的报错位置进行报错 【plsql用exception可捕获】|
|DDL，sql语句本身合法|子函数执行成功，且ddl语句编译执行成功|
|varchar变量，且变量内存的是合法ddl|子函数执行成功，且ddl语句编译执行成功|
|varchar变量，且变量内存的是合法非ddl|子函数执行成功，非ddl编译成功，但未执行|
|多条sql一起执行 begin..end （例：匿名块中有条insert触发唯一主键约束的语句，对匿名块来说是编译不报错，执行报错）|子函数执行成功与否取决于 匿名块编译结果。匿名块本身不执行|
|带procedure begin..end内含procedure|子函数执行成功与否取决于 匿名块及其内部的proc编译结果。匿名块本身不执行|
|sql调udf，udf调高级包，高级包内有dml,ddl。调研此时dml,ddl的编译执行情况。|DML编译但不执行，DDL编译且执行|
|调研入参是否支持lob转成的字符串。调研udf返回的字符串当入参的情况。|和正常赋值一样支持|
|调研varchar长度32000和sql长度2M不匹配对此需求的影响。|如果sql长度超过2M赋值给varchar变量时就已经被拦截。不会走到子函数|
|审计是否会记录由DBMS_UTILITY.EXEC_DDL_STATEMENT执行的sql语句|可以审计到单独的ddl sql语句,单独的非ddl无法审计到|
|调研使用DBMS_UTILITY.EXEC_DDL_STATEMENT(sql)时，用户对此条sql的执行权限对此条子函数执行结果的影响。|用户拥有相应的执行权限才可成功执行子函数|
|调研非ddl编译在子函数内进行编译后，v$sql表是否能查到。|查到的是整个匿名块的编译记录，ddl单独的编译记录无法查到，非ddl单独的编译记录可以查到|
|ddl执行成功后是会默认进行commit的。调研先dml，后子函数执行ddl，ddl的commit是否会把dml也提交上。|是|
|编译完就会有context（即使是非ddl在子函数内也要编译），代码上注意释放非ddl编译后的context|已释放|


# 3. 测试设计

## 3.1 测试设计方法

正交试验法：入参支持DDL语句，DDL语法树庞大，需要进行筛选部份进行DDL语法类型测试覆盖。

等价类划分：入参的有效输入和无效输入类型划分

边界值：入参的varchar2类似的字符串长度为0~32000，对该边界进行测试。

## 3.2 详细测试设计

[EXEC_DDL_STATEMENT.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZGU4OTcwYzJhZjRmNTIwNzg3IiwicmVmX2lkIjoiNjczOTZiZGU3MjgyMDZlZmI5MmYwYWU0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTQyLCJleHAiOjE3ODIzODM5NDJ9.Awpnv1-32DtyQBKIkhDYWhMYMDwQ5j4KFGMwy-qnpN8)

## 3.3 专项覆盖

|专项|是否涉及|说明|
|:---|:---|:---|
|并发|涉及|  
|
|长稳|-|  
|
|一致性|涉及|  
|
|三方测试工具    
  (sqltest，sqlancer)|-|  
|
|安全|-|  
|
|DFR/testkill|-|  
|
|HA|-|  
|
|压力|-|  
|
|性能|-|  
|
|可维护性|-|  
|
|兼容性|-|  
|


# 4. 测试用例

[EXEC_DDL_STATEMENT文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZGZhMWFkOWEzMzExZGM4NWZjIiwicmVmX2lkIjoiNjczOTZiZGU3MjgyMDZlZmI5MmYwYWU0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTQyLCJleHAiOjE3ODIzODM5NDJ9.rGtEtltx-r27V97N8qgKgqFb3fmY97RjabpVfcSDxdI)

# 5. 测试框架设计

- 功能自动化用例添加到yasft（Guider测试框架满足使用）
- 并发用例使用testkill框架（testkill满足使用需求）


# 6. 测试环境说明

|类型|说明|
|---|---|
|操作系统|Linux|
|部署|2实例集群、单机|
|测试工具|guider|


## Attachments:

[image2023-10-30_16-24-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZGZhMWFkOWEzMzExZGM4NWZkIiwicmVmX2lkIjoiNjczOTZiZGU3MjgyMDZlZmI5MmYwYWU0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTQyLCJleHAiOjE3ODIzODM5NDJ9.cmkUZK2Y9kkNmQjwlFcLvR5pAN4f8eBoIM64mv9nFf8)

 (image/png)    


[EXEC_DDL_STATEMENT.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZGY4OTcwYzJhZjRmNTIwNzhiIiwicmVmX2lkIjoiNjczOTZiZGU3MjgyMDZlZmI5MmYwYWU0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTQyLCJleHAiOjE3ODIzODM5NDJ9.yiaeSNUjJC1Pj5tTV9HAQQYnQs2jdlXHvrCTAIRmW40)

 (application/x-xmind)    


[EXEC_DDL_STATEMENT.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZGY4OTcwYzJhZjRmNTIwNzhkIiwicmVmX2lkIjoiNjczOTZiZGU3MjgyMDZlZmI5MmYwYWU0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTQyLCJleHAiOjE3ODIzODM5NDJ9.9ViULJ-k-xsE7uW2ugGgdVPHuvEQeqhVpF9rGXFUUms)

 (application/x-xmind)    


[EXEC_DDL_STATEMENT.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZGU4OTcwYzJhZjRmNTIwNzg3IiwicmVmX2lkIjoiNjczOTZiZGU3MjgyMDZlZmI5MmYwYWU0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTQyLCJleHAiOjE3ODIzODM5NDJ9.Awpnv1-32DtyQBKIkhDYWhMYMDwQ5j4KFGMwy-qnpN8)

 (application/x-xmind)    


[EXEC_DDL_STATEMENT文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZGZhMWFkOWEzMzExZGM4NWZmIiwicmVmX2lkIjoiNjczOTZiZGU3MjgyMDZlZmI5MmYwYWU0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTQyLCJleHAiOjE3ODIzODM5NDJ9.Gr-CJGzyWUuISEckYjiZV_aeRYkPh2ySnQFcE1OgVUk)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[EXEC_DDL_STATEMENT文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZGZhMWFkOWEzMzExZGM4NWZjIiwicmVmX2lkIjoiNjczOTZiZGU3MjgyMDZlZmI5MmYwYWU0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTQyLCJleHAiOjE3ODIzODM5NDJ9.rGtEtltx-r27V97N8qgKgqFb3fmY97RjabpVfcSDxdI)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
