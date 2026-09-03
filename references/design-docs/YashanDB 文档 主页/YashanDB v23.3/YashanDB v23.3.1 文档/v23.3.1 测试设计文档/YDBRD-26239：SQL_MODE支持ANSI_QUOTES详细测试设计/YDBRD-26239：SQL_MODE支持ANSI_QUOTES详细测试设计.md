Created by 陈伟旭, last modified on 十月 15, 2024

# 1. 概述

支持SQL_MODE中的ANSI_QUOTES

需求范围：

开发设计文档：    [【MySQL兼容】SQL_MODE支持REAL_AS_FLOAT/PIPES_AS_CONCAT/ANSI_QUOTES设计文档 - 马士杰 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=156112199)  

SR链接：    [https://pingcode.yasdb.com/pjm/items/66190298fd997db58ad876ec](https://pingcode.yasdb.com/pjm/items/66190298fd997db58ad876ec)    ?    
  #YDBRD-26239 SQL_MODE支持ANSI_QUOTES

# 2. 需求分析

## 2.1 功能点分析

1.  不设置ANSI_QUOTES和设置ANSI_QUOTES的情况下，字符串和对象标识符均可正确识别，行为与MySQL一致

MySQL的反引号（`）用于引用标识符，双引号（"）用于引用字符串；

而  yasql的  双引号（"）用于引用标识符

  


2.mysql的表现

|SQL_MODE|开启状态（默认值为false）|表现|
|---|---|---|
|ANSI_QUOTES|false|MySQL的反引号（`）用于引用标识符，双引号（"）用于引用字符串|
||true|ANSI_QUOTES开启后，  双引号（"）变为标识符引用字符，而不是字符串引用字符；反引号（`）依旧用于引用标识符|


## 2.2 应用场景

MySQL生态业务

## 2.3 规格约束

1.sqlmode的设置语法为：

set sql_mode = 'text,text...';或set sql_mode = '';

其中的text必须为存在的sql_mode,当不指定任何内容时，视为将所有sqlmode置为false

2.sqlmode的查询语法为：

select @@sql_mode;

当出现不存在的sqlmode时，报错处理

3.  ANSI_QUOTES 默认值为false

**ANSI_QUOTES打开关闭的表现对齐MYSQL**

# 3. 详细测试设计

## 3.1 测试设计方法

*测试点分析采用等价类测试设计工程方法*

## 3.2 详细测试设计

1.功能测试

  


06.20：

|大类|场景|预期结果|备注|  
|
|---|---|---|---|---|
|ANSI_QUOTES设置的语法 |正确语法 拼写|预期成功|  
|  
|
|  
|错误语法 拼写|预期失败|  
|  
|
|兼容模式下不设置  ANSI_QUOTES|对象名使用双引号|覆盖所有对象，预期失败|--可以根据反引号已有用例修改，不设置  ANSI_QUOTES，26183全量用例执行无异常|  
|
|  
|对象名使用反引号包裹双引号，单引号|预期成功|--可以根据反引号已有用例修改|  
,  
|
|  
|对象名使用双引号包裹反引号，单引号|预期失败|  
|  
|
|  
|  
|  
|  
|  
|
|兼容模式下设置  ANSI_QUOTES|对象名使用反引号|覆盖所有对象，预期成功|--执行反引号已有用例，设置  ANSI_QUOTES，26183全量用例应执行无异常|  
|
|  
|对象名使用双引号|覆盖所有对象，预期成功|--可以根据反引号已有用例修改，将对象名的反引号改为双引号后，设置  ANSI_QUOTES，26183全量用例应执行无异常|  
|
|  
|对象名使用反引号包裹双引号，单引号|预期成功|  
|  
,  
|
|  
|对象名使用双引号包裹反引号，单引号|预期成功|  
|  
|
|  
|当前设置情况下，单引号包裹字符串,  
|预期成功|当前设置情况下，应该只有单引号可以包裹字符串|  
|
|  
|当前设置情况下，除单引号外的双引号 反引号包裹字符串|预期失败|  
|  
|
|  
|查询select @@session.sql_mode |预期正常查询|  
|  
|
|  
|  
|  
|  
|  
|
|非兼容模式下设置  ANSI_QUOTES|非兼容模式下执行 set sql_mode|预期拦截报错|  
|  
|
|  
|当前设置，单引号 反引号 双引号表现仍然保持崖山的实现|验证符合预期|  
|  
|
|其他场景|兼容模式下，设置  ANSI_QUOTES，用双引号包裹创建对象；,关闭ANSI_QUOTES，删除对象|验证表现同MYSQL 一致|  
|  
|
|  
|兼容模式下，设置  ANSI_QUOTES，用反引号包裹双引号创建对象；,关闭ANSI_QUOTES，删除对象|验证表现同MYSQL 一致|  
|  
|
|  
|兼容模式下，不设置  ANSI_QUOTES，用反引号包裹双引号创建对象；,设置ANSI_QUOTES，删除对象|验证表现同MYSQL 一致|  
|  
|
|  
|兼容模式下，不设置  ANSI_QUOTES ，创建对象；,然后设置ANSI_QUOTES，用双引号创建同名对象|预期应该创建失败|  
|  
|
|  
|兼容模式下，不设置  ANSI_QUOTES ，创建对象；,然后设置ANSI_QUOTES，用双引号包裹对象名使用|预期应该正常使用|  
|  
|
|  
|不设置  ANSI_QUOTES，建表default值设置为'"aaa"',insert 第一条数据,设置ANSI_QUOTES，insert 第二条数据|验证表现同MYSQL 一致,default列都正常显示为   "aaa"|  
|  
|
|以上场景均补充 schema 对象,  
|  
|  
|create schema 语法参考    [standalone/testcase/ddl_03/mysql/schema/test_sdv_create_schema_02.sql · dev · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/blob/dev/standalone/testcase/ddl_03/mysql/schema/test_sdv_create_schema_02.sql)  |  
|
|补充部分内置函数场景|  
|  
|MYSQL支持内置函数名带反引号，,select `abs`(1) from dual;,设置  ANSI_QUOTES后，兼容模式下 yashan 是否也支持内置函数名带双引号 ？,select "abs"(1) from dual;|覆盖内置函数；,  
|


|mysql|yashan|  
|
|---|---|---|
|mysql：对象名使用反引号包裹反引号时成功,![](https://pingcode.yasdb.com/atlas/files/public/67396e5ba1ad9a3311dc96df/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUNBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFnQUFBQUFBQUFBQUFBWUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE1NjQsImV4cCI6MTc4MjM4MjM2NH0.2JThCZvdtDpWJ3DhJ5uX_fABgwiIvlPnvqXWelRdKKo)|yasql：兼容模式下，未设置sql_mode。对象名使用反引号包裹反引号时会报错,![](https://pingcode.yasdb.com/atlas/files/public/67396e5b8970c2af4f52186e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUNBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFnQUFBQUFBQUFBQUFBWUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE1NjQsImV4cCI6MTc4MjM4MjM2NH0.2JThCZvdtDpWJ3DhJ5uX_fABgwiIvlPnvqXWelRdKKo)|不支持，反引号里包含反引号会报错|


  


  


2.dfx功能涉及情况

|系统级DFX分类|是否涉及|
|:---|:---|
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

冒烟用例：

  


# 5. 测试框架设计

  


# 6. 测试环境说明

  


# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

## Attachments:

[ANSI_QUOTES.rar](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNWI4OTcwYzJhZjRmNTIxODZkIiwicmVmX2lkIjoiNjczOTZlNWI1OTNmOTljOWZmMjM4NDAyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNTY0LCJleHAiOjE3ODI0NTc5NjR9.hUcf6Uz34-BXkHBkPH5dqVbHyj12CBQkk3cPg33rb_w)

 (application/octet-stream)    


## Comments:

|  [](null)  ,1.可复用mysql支持反引号用例 ,  [standalone/testcase/dml1/mysql/backticks · dev · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/dev/standalone/testcase/dml1/mysql/backticks)  ,  
,Posted by huxiaopan at 六月 20, 2024 10:58|
|---|
