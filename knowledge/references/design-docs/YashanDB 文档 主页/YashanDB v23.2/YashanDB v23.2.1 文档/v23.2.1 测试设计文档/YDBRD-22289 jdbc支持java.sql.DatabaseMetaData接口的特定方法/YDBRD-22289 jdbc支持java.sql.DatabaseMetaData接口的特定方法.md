Created by 李潮, last modified by  施新华 on 十一月 21, 2023

# **1. 概述**

IR：    [YDBRD-20702](https://jira.yasdb.com/browse/YDBRD-20702?src=confmacro)    -  JDBC支持java.sql.DatabaseMetaData接口的特定方法  完成

SR:       [YDBRD-22289](https://jira.yasdb.com/browse/YDBRD-22289?src=confmacro)    -  【jdbc】JDBC支持java.sql.DatabaseMetaData接口的特定方法  完成

参考：开发设计文档：    [YDBRD-20702 JDBC支持java.sql.DatabaseMetaData接口的特定方法 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133588011)  

调研文档：    [YDBRD-20702 JDBC支持java.sql.DatabaseMetaData接口的特定方法调研 - 赵育 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133584841)  

####   [DatabaseMetaData - Java 11中文版 - API参考文档 (apiref.com)](https://www.apiref.com/java11-zh/java.sql/java/sql/DatabaseMetaData.html#getSuperTypes(java.lang.String,java.lang.String,java.lang.String))    +

jdbc客户端新增UDTs相关接口，可查询用户自定义UDTs类型，可获取其UDTs父类信息。

# **2. 需求分析**

## 2.1 功能介绍

JDBC支持java.sql.DatabaseMetaData接口的特定方法

1.getUDTs:获取用户创建的UDT对象的信息,目前YashanDB只能获取object对象信息。

2.getSuperTypes:获取用户创建的指定UDT对象的父类信息。

## 2.2 规格约束

无

# **3 详细测试设计**

|getUDTs|类型|配置值|备注|
|---|---|---|---|
|入参||||
|catalog |String|任意值（null,"test",“”）|无|
|schemaPattern|String|1.完全匹配  2.模糊匹配  3.空串  3.null|用户名|
|typeNamePattern|String |同上|类型名|
|types|int[] |1.是否含2002（Types.STRUCT）  2.null|类型|
|出参||||
|TYPE_CAT|String|null|无|
|TYPE_SCHEM |String|用户名|  
|
| TYPE_NAME|String|类型名|  
|
|class_name|String|null|无|
|DATA_TYPE|int|2002|只有Object|
|null as REMARKS|String|null|无|
|BASE_TYPE|short|null|无|


  


|getSuperTypes|类型|配置值|备注|
|---|---|---|---|
|入参||||
|catalog |String|任意值（null,"test",“”）|无|
|schemaPattern|String|1.完全匹配  2.模糊匹配  3.空串  3.null|用户名|
|typeNamePattern|String |同上|类型名|
|出参||||
|TYPE_CAT|String|null|无|
|TYPE_SCHEM |String|子类用户名|  
|
| TYPE_NAME|String|子类类型名|  
|
|SUPERTYPE_CAT|String|null|无|
|SUPERTYPE_SCHEM|String|父类用户名|  
|
|SUPERTYPE_NAME |String|父类类型名|  
|


  


**采用等价类划分法**

**前置条件：创建regress1,regress2用户，为sys用户和regress1/2用户创建Object类型和子类对象若干，Varray类型对象若干，Nested Table类型对象若干**

1.两个接口函数对入参所有配置值进行排列组合，验证基本功能

2.模糊功能匹配验证，  **yashandb:% （非java）**

3.getUDTs使用带重复2002的types作为入参

4.创建三个用户下的Object父子孙类对象，连续调用getSuperTypes——不支持，需要在一个schema下创建

5.创建一父类二子类对象，分别调用getSuperTypes获取两子类对象的父类是否一致.

6.  getSuperTypes传入Varry对象名称，Nested Table对象名称。

7.交互测试：通过getUDTs获取后通过getSuperTypes获取父类，在通过getUDTs获取UDT信息

8.边界值验证：输入字节数为  65535的  String类型，type类型输入  2^31-1长度的int数组带2002

9.异常：无

补充：  ST_GEOMETRY是自定义对象

专项测试设计情况：

|专项|是否涉及|
|:---|:---|
|并发|否|
|可靠性|否|


# **4 文本用例**

# **5 测试用例**

  
    


# **5 测试框架设计**

Gradle

  


  


## Attachments:

[metaData冒烟.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWRhMWFkOWEzMzExZGM4NGJkIiwicmVmX2lkIjoiNjczOTZiYWQ3MjgyMDZlZmI5MmYwOGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MjU2LCJleHAiOjE3ODIzODI2NTZ9.ohLK-IMjL7dv6ep8YuNFdEzg-VxCW6Sban_6unFvwD8)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[image2023-11-20_17-20-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWU4OTcwYzJhZjRmNTIwNjQ4IiwicmVmX2lkIjoiNjczOTZiYWQ3MjgyMDZlZmI5MmYwOGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MjU2LCJleHAiOjE3ODIzODI2NTZ9.WeaFp0xDGLuwnrwvwEh0rSmdk8wRraBE3Zur8z9cu2s)

 (image/png)    


[DatabaseMetaDataByUserTest.java](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWVhMWFkOWEzMzExZGM4NGJmIiwicmVmX2lkIjoiNjczOTZiYWQ3MjgyMDZlZmI5MmYwOGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MjU2LCJleHAiOjE3ODIzODI2NTZ9.1Q32oxaoXKGm7Lm1LNHHa0pag48223_3D7wwhjYeVtU)

 (text/x-java-source)    


[DatabaseMetaDataNormalTest.java](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWU4OTcwYzJhZjRmNTIwNjRhIiwicmVmX2lkIjoiNjczOTZiYWQ3MjgyMDZlZmI5MmYwOGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MjU2LCJleHAiOjE3ODIzODI2NTZ9.mpBIVSUQdJc89EWl8PFPIDwtFK0EeFNATw_sjydGvCA)

 (text/x-java-source)    


[metaData冒烟.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWU4OTcwYzJhZjRmNTIwNjRiIiwicmVmX2lkIjoiNjczOTZiYWQ3MjgyMDZlZmI5MmYwOGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MjU2LCJleHAiOjE3ODIzODI2NTZ9.15eGwtuOqgBxQFnZaVFRQpcFyWM352gwJ56WnBWa6FA)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
