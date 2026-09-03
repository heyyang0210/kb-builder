Created by 赵育, last modified by  杜卓林 on 七月 02, 2024

# 1. 概述

  [https://pingcode.yasdb.com/pjm/items/661903edfd997db58ad87ac2](https://pingcode.yasdb.com/pjm/items/661903edfd997db58ad87ac2)    ?    
  #YDBRD-26241 【mysql兼容】（协议）MYSQL驱动相关协议适配-支持常规类型（非LOB）批量绑定执行

常规类型（非LOB）批量绑定执行，规格见需求分析  ---评审时说也支持 LOB 类型，实际是否支持？

## 2.2 应用场景

用户使用 mysql client/mysql jdbc 驱动将数据同步/插入到 yashandb 服务端，通过 mysql client/mysql jdbc驱动查询不同数据类型的数据；测试场景均基于该前提。

- 部分数据类型 mysql server 与 yashandb 范围未严格一致，不考虑通过 yashandb 客户端插入数据，通过 mysql client 端获取数据的情况；


## 2.3 规格约束

无

# 3. 详细测试设计

## 3.1 测试设计方法

从功能出发，结合等价类、边界值的测试设计方法，输出测试设计。

测试策略：

1、JDBC：需设  useServerPrepStmts=true参数才能走到绑定参数，绑定参数涉及的 JDBC 驱动接口：    [PreparedStatement (Java Platform SE 8 ) (oracle.com)](https://docs.oracle.com/javase/8/docs/api/java/sql/PreparedStatement.html)  

2、对于绑定参数的接口有一些对结果集的处理参数也需要覆盖，返回值为     [PreparedStatement](https://docs.oracle.com/javase/8/docs/api/java/sql/PreparedStatement.html)     的接口；    [Connection (Java Platform SE 8 ) (oracle.com)](https://docs.oracle.com/javase/8/docs/api/java/sql/Connection.html)  

3、覆盖2种批量执行的模式：  rewriteBatchedStatements=true、rewriteBatchedStatements=false ，参考：    [MySQL :: MySQL Connector/J Developer Guide :: 6.3.13 Performance Extensions](https://dev.mysql.com/doc/connector-j/en/connector-j-connp-props-performance-extensions.html)  

4、对于 jdbc 驱动端参数，可以覆盖：    [MySQL :: MySQL Connector/J Developer Guide :: 6.3.7 Prepared Statements](https://dev.mysql.com/doc/connector-j/en/connector-j-connp-props-prepared-statements.html)  

## 3.2 详细测试设计

- 功能测试


|序号|数据类型|YashanDB类型映射|测试点分析|
|---|---|---|---|
|1|MYSQL_TYPE_TINY|YSDB_TINYINT|1、按照     [YDBRD-26216: （协议）COM_QUERY文本结果集支持LOB类型测试设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=156115128)     中字段类型的范围，使用绑定参数，覆盖类型值的边界值进行验证,2、通过   java.sql.ParameterMetaData 接口下的方法验证绑定参数的元数据正确性,3、分别覆盖插入、查询的参数绑定及批量执行场景,4、参数值覆盖：有符号、无符号    ---无符号不支持，暂不测试|
|2|MYSQL_TYPE_SHORT|YSDB_SMALLINT|同上|
|3|MYSQL_TYPE_LONG|YSDB_INTEGER|同上|
|4|MYSQL_TYPE_LONGLONG|YSDB_BIGINT|同上|
|5|MYSQL_TYPE_FLOAT|YSDB_FLOAT|同上|
|6|MYSQL_TYPE_DOUBLE|YSDB_DOUBLE|同上|
|7|MYSQL_TYPE_DECIMAL,MYSQL_TYPE_NEWDECIMAL|YSDB_VARCHAR|同上|
|8|MYSQL_TYPE_TIME|YSDB_SHORTTIME|同上|
|9|MYSQL_TYPE_DATE|YSDB_DATE|同上|
|10|MYSQL_TYPE_DATETIME,MYSQL_TYPE_TIMESTAMP|YSDB_TIMESTAMP|同上|
|11|MYSQL_TYPE_TINY_BLOB,MYSQL_TYPE_MEDIUM_BLOB,MYSQL_TYPE_LONG_BLOB,MYSQL_TYPE_BLOB|YSDB_RAW|二进制不支持，暂不测试|
|12|default|YSDB_VARCHAR|同上|


- C  OM_STMT_SEND_LONG_DATA 协议测试


1、TEXT 类型通过绑定参数的方式批量执行

2、BLOB 类型通过绑定参数的方式批量执行  ---暂不支持，

- 字符集验证


1、对于字符串类型，验证客户端和服务端字符集相同、不同的场景

- prepare + execute；


1、插入记录，一次 add batch；一次 excute；观察插入记录数

2、插入记录，一次 add batch；多次 excute ；观察插入记录数

  


*2、梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*

|系统级DFX分类|是否涉及|
|---|---|
|CT|不涉及|
|KT|不涉及|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR|不涉及|
|HA|不涉及|
|压力|不涉及|
|性能|不涉及|
|可维护性|不涉及|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

[MYSQL驱动相关协议适配-支持常规类型（非LOB）批量绑定执行测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNWJhMWFkOWEzMzExZGM5NmUwIiwicmVmX2lkIjoiNjczOTZlNWI1OTNmOTljOWZmMjM4NDA2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNTc1LCJleHAiOjE3ODI0NTc5NzV9.39vjjwDqUE9wI2W24zfAYFtkD3whRurfdKZOPBB_jbo)

# 5. 测试框架设计

- 适配 mysql-test 测试框架，目前原生测试用例无法执行，可以新增测试套的方式往该测试框架里边补充测试用例
- testng 测试框架，补充 mysql jdbc 驱动测试用例


# 6. 测试环境说明

*不涉及*

# 7. 工作量评估

工作量：  *5人天*

计划测试完成时间：

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNWNhMWFkOWEzMzExZGM5NmUxIiwicmVmX2lkIjoiNjczOTZlNWI1OTNmOTljOWZmMjM4NDA2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNTc1LCJleHAiOjE3ODI0NTc5NzV9.g_XhBV37nbxylxTqtK8F_QOLVwFUYIw-KUdc2J-oCBA)

## Attachments:

[image2024-5-16_15-15-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNWNhMWFkOWEzMzExZGM5NmUyIiwicmVmX2lkIjoiNjczOTZlNWI1OTNmOTljOWZmMjM4NDA2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNTc1LCJleHAiOjE3ODI0NTc5NzV9.Olzoxu7zfXendFNh4q5gvQ2o3BtAPOexAJXknucSqvQ)

 (image/png)    


[COM_QUERY文本结果集支持基础类型测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNWM4OTcwYzJhZjRmNTIxODZmIiwicmVmX2lkIjoiNjczOTZlNWI1OTNmOTljOWZmMjM4NDA2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNTc1LCJleHAiOjE3ODI0NTc5NzV9.K_-vdntJgb8sucKL6WgJg7BVNRo7lZGKDTeiSk_Mv3w)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[image2024-4-23_11-26-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNWM4OTcwYzJhZjRmNTIxODcwIiwicmVmX2lkIjoiNjczOTZlNWI1OTNmOTljOWZmMjM4NDA2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNTc1LCJleHAiOjE3ODI0NTc5NzV9.yy5qfF9Rf1Z3X9qyUW4gwgrUyYRIMjVVbzWKpEI9edk)

 (image/png)    


[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNWNhMWFkOWEzMzExZGM5NmUxIiwicmVmX2lkIjoiNjczOTZlNWI1OTNmOTljOWZmMjM4NDA2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNTc1LCJleHAiOjE3ODI0NTc5NzV9.g_XhBV37nbxylxTqtK8F_QOLVwFUYIw-KUdc2J-oCBA)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNWNhMWFkOWEzMzExZGM5NmUzIiwicmVmX2lkIjoiNjczOTZlNWI1OTNmOTljOWZmMjM4NDA2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNTc1LCJleHAiOjE3ODI0NTc5NzV9.SjvGhx_02l5N8Fx8WJ0-ulid948aNI3H7H-uMQLNr8k)

 (application/msword)    


[MYSQL驱动相关协议适配-支持常规类型（非LOB）批量绑定执行测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNWJhMWFkOWEzMzExZGM5NmUwIiwicmVmX2lkIjoiNjczOTZlNWI1OTNmOTljOWZmMjM4NDA2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNTc1LCJleHAiOjE3ODI0NTc5NzV9.39vjjwDqUE9wI2W24zfAYFtkD3whRurfdKZOPBB_jbo)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
